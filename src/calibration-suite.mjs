/**
 * Calibration Suite (Meta-evaluation)
 *
 * Measures how well a VLM judge performs against human-labeled ground truth.
 * When using ML as a test oracle, you need tests of the tests
 * (LLMShot, arXiv:2507.10062; Stanford CS 329T).
 *
 * Usage:
 *   const suite = createCalibrationSuite([
 *     { screenshot: 'good.png', expectedScore: 9, label: 'clean homepage' },
 *     { screenshot: 'broken.png', expectedScore: 2, label: 'broken layout' },
 *   ]);
 *   const report = await suite.run({ provider: 'gemini' });
 *   // report.correlation, report.meanAbsoluteError, report.falsePositiveRate, ...
 */

import { VLLMJudge } from './judge.mjs';
import { ValidationError, ConfigError } from './errors.mjs';
import { warn } from './logger.mjs';
import { pearsonCorrelation, spearmanCorrelation } from './metrics.mjs';
import { deriveCalibrationProfile, analyzeScoreDistribution } from './score-calibration.mjs';

/**
 * @typedef {Object} CalibrationSample
 * @property {string} screenshot - Path to screenshot file
 * @property {number} expectedScore - Human-labeled expected score (0-10)
 * @property {string} [label] - Description of the sample
 * @property {string} [prompt] - Custom prompt (defaults to generic quality evaluation)
 */

/**
 * @typedef {Object} CalibrationReport
 * @property {number} sampleCount - Number of samples evaluated
 * @property {number} pearsonR - Pearson correlation between VLM and expected scores
 * @property {number} spearmanR - Spearman rank correlation
 * @property {number} meanAbsoluteError - Average |VLM score - expected score|
 * @property {number} maxError - Worst single-sample error
 * @property {number} falsePositiveRate - Rate of VLM pass (>=7) when expected fail (<7)
 * @property {number} falseNegativeRate - Rate of VLM fail (<7) when expected pass (>=7)
 * @property {{ offset: number, scale: number, r2: number }} suggestedCalibration - Derived calibration profile
 * @property {{ mean: number, stddev: number, skew: number }} scoreDistribution - VLM score distribution
 * @property {Array<{ screenshot: string, label: string, expected: number, actual: number, error: number }>} details
 */

const DEFAULT_PROMPT = 'Evaluate the overall quality of this screenshot. Consider layout, visual design, readability, accessibility, and functional correctness.';
const DEFAULT_PASS_THRESHOLD = 7;

/**
 * Create a calibration suite
 *
 * @param {CalibrationSample[]} samples - Labeled screenshot samples
 * @param {{ passThreshold?: number }} [options={}] - Suite options
 * @returns {{ run: (judgeOptions: object) => Promise<CalibrationReport>, samples: CalibrationSample[] }}
 */
export function createCalibrationSuite(samples, options = {}) {
  if (!Array.isArray(samples) || samples.length < 2) {
    throw new ValidationError('Calibration suite requires at least 2 labeled samples', { count: samples?.length ?? 0 });
  }

  for (const s of samples) {
    if (typeof s.screenshot !== 'string' || typeof s.expectedScore !== 'number') {
      throw new ValidationError('Each sample must have a screenshot path (string) and expectedScore (number)', { screenshot: typeof s.screenshot, expectedScore: typeof s.expectedScore });
    }
    if (s.expectedScore < 0 || s.expectedScore > 10) {
      throw new ValidationError(`expectedScore must be 0-10, got ${s.expectedScore}`, { expectedScore: s.expectedScore });
    }
  }

  const passThreshold = options.passThreshold ?? DEFAULT_PASS_THRESHOLD;

  return {
    samples: [...samples],

    /**
     * Run the calibration suite against a judge
     *
     * @param {object} judgeOptions - Options passed to VLLMJudge constructor
     * @returns {Promise<CalibrationReport>}
     */
    async run(judgeOptions = {}) {
      const judge = new VLLMJudge(judgeOptions);

      if (!judge.enabled) {
        throw new ConfigError('VLLMJudge is disabled -- cannot run calibration suite');
      }

      const details = [];
      const rawScores = [];
      const expectedScores = [];

      for (const sample of samples) {
        const prompt = sample.prompt || DEFAULT_PROMPT;
        try {
          const result = await judge.judgeScreenshot(sample.screenshot, prompt);
          const parsed = judge.extractSemanticInfo(result.judgment || '');
          const score = parsed.score ?? result.score ?? null;

          if (score !== null) {
            const error = Math.abs(score - sample.expectedScore);
            rawScores.push(score);
            expectedScores.push(sample.expectedScore);
            details.push({
              screenshot: sample.screenshot,
              label: sample.label || sample.screenshot,
              expected: sample.expectedScore,
              actual: score,
              error
            });
          } else {
            details.push({
              screenshot: sample.screenshot,
              label: sample.label || sample.screenshot,
              expected: sample.expectedScore,
              actual: null,
              error: null,
              skipped: 'No score returned'
            });
          }
        } catch (err) {
          warn(`[CalibrationSuite] Sample "${sample.label || sample.screenshot}" failed: ${err.message}`);
          details.push({
            screenshot: sample.screenshot,
            label: sample.label || sample.screenshot,
            expected: sample.expectedScore,
            actual: null,
            error: null,
            errorMessage: err.message,
            skipped: true
          });
        }
      }

      // Compute metrics from scored samples only
      const scored = details.filter(d => d.actual !== null);
      const n = scored.length;

      if (n < 2) {
        return {
          sampleCount: samples.length,
          scoredCount: n,
          pearsonR: null,
          spearmanR: null,
          meanAbsoluteError: null,
          maxError: null,
          falsePositiveRate: null,
          falseNegativeRate: null,
          suggestedCalibration: null,
          scoreDistribution: analyzeScoreDistribution(rawScores),
          details,
          error: 'Fewer than 2 samples scored -- cannot compute metrics'
        };
      }

      const errors = scored.map(d => d.error);
      const meanAbsoluteError = errors.reduce((a, b) => a + b, 0) / n;
      const maxError = Math.max(...errors);

      // Correlation
      const actualScores = scored.map(d => d.actual);
      const expScores = scored.map(d => d.expected);
      const pearsonR = pearsonCorrelation(actualScores, expScores);
      const spearmanR = spearmanCorrelation(actualScores, expScores);

      // False positive/negative rates (relative to passThreshold)
      let fp = 0, fn = 0, expectedFail = 0, expectedPass = 0;
      for (const d of scored) {
        if (d.expected >= passThreshold) {
          expectedPass++;
          if (d.actual < passThreshold) fn++;
        } else {
          expectedFail++;
          if (d.actual >= passThreshold) fp++;
        }
      }
      const falsePositiveRate = expectedFail > 0 ? fp / expectedFail : 0;
      const falseNegativeRate = expectedPass > 0 ? fn / expectedPass : 0;

      // Derive calibration profile
      const pairs = scored.map(d => ({ raw: d.actual, expected: d.expected }));
      const suggestedCalibration = deriveCalibrationProfile(pairs);

      return {
        sampleCount: samples.length,
        scoredCount: n,
        pearsonR,
        spearmanR,
        meanAbsoluteError,
        maxError,
        falsePositiveRate,
        falseNegativeRate,
        suggestedCalibration,
        scoreDistribution: analyzeScoreDistribution(rawScores),
        details
      };
    }
  };
}
