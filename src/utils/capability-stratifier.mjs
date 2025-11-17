/**
 * Capability Stratifier
 * 
 * Tests VLLM capabilities at different levels (low/mid/high)
 * 
 * Research context:
 * - VLMs exhibit widespread deficits in low- and mid-level visual abilities
 * - High-level object recognition performance cannot predict low-level capabilities
 * - Need stratified testing to identify capability gaps
 */

import { validateScreenshot } from '../judge.mjs';

/**
 * Test capability at specific level
 * 
 * @param {string} level - 'low', 'mid', or 'high'
 * @param {Array<{imagePath: string, prompt: string, expected: any}>} testCases
 * @param {Object} options - Test options
 * @returns {Promise<Object>} Capability test result
 */
export async function testCapabilityLevel(level, testCases, options = {}) {
  const results = await Promise.all(
    testCases.map(async (tc) => {
      const result = await validateScreenshot(tc.imagePath, tc.prompt, {
        testType: `capability-${level}`,
        ...options
      });

      const extractedValue = result.extractedValue || result.score;
      const correct = extractedValue === tc.expected ||
                     (typeof extractedValue === 'number' && typeof tc.expected === 'number' &&
                      Math.abs(extractedValue - tc.expected) < 0.1);

      return {
        testCase: tc,
        result,
        correct,
        extractedValue,
        expected: tc.expected
      };
    })
  );

  const accuracy = results.filter(r => r.correct).length / results.length;

  return {
    level,
    accuracy,
    total: results.length,
    correct: results.filter(r => r.correct).length,
    results,
    recommendation: accuracy < 0.7
      ? `Low ${level}-level capability accuracy. VLLM may struggle with ${level}-level visual tasks.`
      : `${level}-level capability appears adequate.`
  };
}

/**
 * Stratified capability testing (all levels)
 * 
 * @param {Object} testSuites - {low: [...], mid: [...], high: [...]}
 * @param {Object} options - Test options
 * @returns {Promise<Object>} Stratified test results
 */
export async function testStratifiedCapabilities(testSuites, options = {}) {
  const levels = ['low', 'mid', 'high'];
  const results = {};

  for (const level of levels) {
    if (testSuites[level] && testSuites[level].length > 0) {
      results[level] = await testCapabilityLevel(level, testSuites[level], options);
    }
  }

  // Detect gaps (high-level >0.9 but low-level <0.7)
  const gaps = [];
  if (results.high && results.low) {
    if (results.high.accuracy > 0.9 && results.low.accuracy < 0.7) {
      gaps.push({
        type: 'high-low-gap',
        highAccuracy: results.high.accuracy,
        lowAccuracy: results.low.accuracy,
        recommendation: 'High-level performance does not predict low-level capabilities. Validate low-level tasks separately.'
      });
    }
  }

  if (results.high && results.mid) {
    if (results.high.accuracy > 0.9 && results.mid.accuracy < 0.7) {
      gaps.push({
        type: 'high-mid-gap',
        highAccuracy: results.high.accuracy,
        midAccuracy: results.mid.accuracy,
        recommendation: 'High-level performance does not predict mid-level capabilities. Validate mid-level tasks separately.'
      });
    }
  }

  return {
    results,
    gaps,
    overallRecommendation: gaps.length > 0
      ? 'Capability gaps detected. High-level performance cannot predict low/mid-level capabilities.'
      : 'Capability levels appear consistent.'
  };
}

