/**
 * Human Validation Manager
 *
 * Integrates human validation into the evaluation pipeline:
 * - Non-blocking: Doesn't slow down evaluations
 * - Automatic: Collects VLLM judgments when enabled
 * - Smart sampling: Requests human validation for interesting cases
 * - Learning: Calibrates based on collected data
 *
 * Note: The evaluation/human-validation module was removed. Disk-based
 * calibration and judgment persistence are disabled. In-memory collection,
 * smart sampling, sequence tracking, and custom humanValidatorFn still work.
 */

import { warn, log } from './logger.mjs';

/**
 * Human Validation Manager
 *
 * Manages human validation collection and calibration
 */
export class HumanValidationManager {
  /**
   * @param {{
   *   enabled?: boolean;
   *   autoCollect?: boolean;
   *   smartSampling?: boolean;
   *   calibrationThreshold?: number;
   *   humanValidatorFn?: (vllmResult: any) => Promise<any> | null;
   * }} [options={}] - Manager options
   */
  constructor(options = {}) {
    const {
      enabled = false,
      autoCollect = true,
      smartSampling = true,
      calibrationThreshold = 0.7,
      humanValidatorFn = null
    } = options;

    this.enabled = enabled;
    this.autoCollect = autoCollect;
    this.smartSampling = smartSampling;
    this.calibrationThreshold = calibrationThreshold;
    this.humanValidatorFn = humanValidatorFn;

    this.vllmJudgments = [];
    this.pendingValidations = new Map();
    this.calibrationCache = null;
  }

  /**
   * Check if result should trigger human validation (smart sampling)
   */
  _shouldRequestHumanValidation(vllmResult) {
    if (!this.smartSampling) return true;

    const score = vllmResult.score;
    // Edge cases (very high or very low scores)
    if (score !== null && (score <= 3 || score >= 9)) {
      return true;
    }

    // High uncertainty
    if (vllmResult.uncertainty && vllmResult.uncertainty > 0.3) {
      return true;
    }

    // Many issues detected (might be over-detection)
    if (vllmResult.issues && vllmResult.issues.length >= 5) {
      return true;
    }

    // No issues but low score (might be under-detection)
    if (vllmResult.issues && vllmResult.issues.length === 0 && score !== null && score < 6) {
      return true;
    }

    // Random sampling (10% of cases)
    if (Math.random() < 0.1) {
      return true;
    }

    return false;
  }

  /**
   * Collect VLLM judgment (non-blocking)
   *
   * @param {import('./index.mjs').ValidationResult} vllmResult - VLLM validation result
   * @param {string} imagePath - Screenshot path
   * @param {string} prompt - Evaluation prompt
   * @param {import('./index.mjs').ValidationContext} context - Validation context
   */
  async collectVLLMJudgment(vllmResult, imagePath, prompt, context = {}) {
    if (!this.enabled || !this.autoCollect) return;

    const id = context.validationId || `vllm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const vllmJudgment = {
      id,
      screenshot: imagePath,
      prompt,
      vllmScore: vllmResult.score,
      vllmIssues: vllmResult.issues || [],
      vllmReasoning: vllmResult.reasoning || vllmResult.assessment || '',
      provider: vllmResult.provider || 'unknown',
      timestamp: new Date().toISOString(),
      temporalNotes: context.temporalNotes || null,
      aggregatedNotes: context.aggregatedNotes || null,
      experienceTrace: context.experienceTrace || null,
      context: {
        testType: context.testType,
        viewport: context.viewport,
        persona: context.persona?.name,
        stage: context.stage,
        step: context.step,
        interaction: context.interaction,
        sessionId: context.sessionId,
        experienceTrace: context.experienceTrace?.sessionId || null
      }
    };

    this.vllmJudgments.push(vllmJudgment);

    // Request human validation if smart sampling says so
    if (this._shouldRequestHumanValidation(vllmResult) && this.humanValidatorFn) {
      this._requestHumanValidation(vllmJudgment).catch(error => {
        warn('Failed to request human validation:', error.message);
      });
    }
  }

  /**
   * Request human validation via the provided humanValidatorFn
   */
  async _requestHumanValidation(vllmJudgment) {
    if (!this.humanValidatorFn) return;

    try {
      const humanResult = await Promise.resolve(this.humanValidatorFn(vllmJudgment));

      if (humanResult) {
        const humanJudgment = {
          id: vllmJudgment.id,
          screenshot: vllmJudgment.screenshot,
          prompt: vllmJudgment.prompt,
          humanScore: humanResult.score,
          humanIssues: humanResult.issues || [],
          humanReasoning: humanResult.reasoning || '',
          timestamp: new Date().toISOString(),
          evaluatorId: humanResult.evaluatorId
        };

        this._updateCalibrationCache(vllmJudgment, humanJudgment);
      }
    } catch (error) {
      warn('Human validation request failed:', error.message);
    }
  }

  /**
   * Update in-memory calibration cache with new human judgment
   */
  _updateCalibrationCache(vllmJudgment, humanJudgment) {
    if (!this.calibrationCache) {
      this.calibrationCache = {
        judgments: [],
        lastCalibration: null,
        stats: { total: 0, agreements: 0, disagreements: 0 }
      };
    }

    this.calibrationCache.judgments.push({
      vllm: vllmJudgment,
      human: humanJudgment,
      timestamp: new Date().toISOString()
    });

    this.calibrationCache.stats.total++;
    const scoreDiff = Math.abs(vllmJudgment.vllmScore - humanJudgment.humanScore);
    if (scoreDiff <= 1) {
      this.calibrationCache.stats.agreements++;
    } else {
      this.calibrationCache.stats.disagreements++;
    }
  }

  /**
   * Get calibration status
   */
  getCalibrationStatus() {
    if (!this.calibrationCache || !this.calibrationCache.lastCalibration) {
      return {
        calibrated: false,
        message: 'No calibration data available'
      };
    }

    const cal = this.calibrationCache.lastCalibration;
    const correlation = cal.agreement.pearson;

    return {
      calibrated: true,
      correlation,
      kappa: cal.agreement.kappa,
      mae: cal.agreement.mae,
      isGood: correlation >= this.calibrationThreshold,
      sampleSize: cal.sampleSize,
      recommendations: cal.recommendations,
      lastCalibration: cal.timestamp
    };
  }

  /**
   * Track calibration degradation over screenshot sequences
   *
   * @param {number} sequenceIndex - Index in sequence
   * @param {Object} result - Validation result
   * @returns {Object} Degradation status
   */
  trackSequenceCalibration(sequenceIndex, result) {
    if (!this.sequenceHistory) {
      this.sequenceHistory = [];
    }

    const entry = {
      index: sequenceIndex,
      timestamp: Date.now(),
      confidence: result.confidence || 0.5,
      uncertainty: result.uncertainty || 0.5,
      score: result.score,
      logprobs: result.logprobs
    };

    this.sequenceHistory.push(entry);

    if (this.sequenceHistory.length >= 5) {
      const recent = this.sequenceHistory.slice(-5);
      const early = this.sequenceHistory.slice(0, 5);

      const recentAvgConfidence = recent.reduce((sum, e) => sum + e.confidence, 0) / recent.length;
      const earlyAvgConfidence = early.reduce((sum, e) => sum + e.confidence, 0) / early.length;

      const degradation = earlyAvgConfidence - recentAvgConfidence;
      const degradationThreshold = 0.15;

      if (degradation > degradationThreshold) {
        return {
          degraded: true,
          degradation,
          recommendation: 'recalibrate_or_reduce_sequence',
          suggestedAction: 'Use temporal graph representation or reduce sequence length'
        };
      }
    }

    return { degraded: false };
  }

  /**
   * Get calibration quality metrics for sequence
   */
  getSequenceCalibrationMetrics() {
    if (!this.sequenceHistory || this.sequenceHistory.length < 2) {
      return { quality: 'unknown', recommendation: 'insufficient_data' };
    }

    const confidences = this.sequenceHistory.map(e => e.confidence);
    const variance = this.calculateVariance(confidences);
    const trend = this.calculateTrend(confidences);

    if (variance > 0.1 && trend < -0.05) {
      return {
        quality: 'degrading',
        variance,
        trend,
        recommendation: 'recalibrate_or_reduce_sequence'
      };
    }

    return {
      quality: variance < 0.05 ? 'stable' : 'variable',
      variance,
      trend
    };
  }

  /**
   * Calculate variance of values
   */
  calculateVariance(values) {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Calculate trend of values (positive = increasing, negative = decreasing)
   */
  calculateTrend(values) {
    if (values.length < 2) return 0;
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    return (secondAvg - firstAvg) / firstAvg;
  }

  /**
   * Apply calibration adjustments to VLLM score
   *
   * @param {number} vllmScore - Original VLLM score
   * @returns {number} Calibrated score
   */
  applyCalibration(vllmScore) {
    if (!this.calibrationCache || !this.calibrationCache.lastCalibration) {
      return vllmScore;
    }

    const bias = this.calibrationCache.lastCalibration.bias.scoreBias;
    const calibrated = vllmScore - bias;
    return Math.max(0, Math.min(10, calibrated));
  }

  /**
   * Load existing VLLM judgments (returns in-memory cache)
   */
  loadVLLMJudgments() {
    return this.vllmJudgments;
  }

  /**
   * Manually trigger calibration (requires humanValidatorFn)
   */
  async calibrate() {
    return { success: false, message: 'Human validation module not available' };
  }
}

/**
 * Global human validation manager instance
 */
let globalHumanValidationManager = null;

/**
 * Get or create global human validation manager
 *
 * @param {Object} options - Manager options
 * @returns {HumanValidationManager} Manager instance
 */
export function getHumanValidationManager(options = {}) {
  if (!globalHumanValidationManager) {
    globalHumanValidationManager = new HumanValidationManager(options);
  }
  return globalHumanValidationManager;
}

/**
 * Initialize human validation (call this to enable)
 *
 * @param {Object} options - Manager options
 * @returns {HumanValidationManager} Manager instance
 */
export function initHumanValidation(options = {}) {
  globalHumanValidationManager = new HumanValidationManager({
    enabled: true,
    ...options
  });
  return globalHumanValidationManager;
}
