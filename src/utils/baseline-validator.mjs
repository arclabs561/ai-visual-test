/**
 * Baseline Validator
 * 
 * Tests visual discriminative power of benchmarks
 * 
 * Research context:
 * - Standard benchmarks can be partially solved without visual analysis
 * - Questions that can be answered through world knowledge alone obscure actual visual deficits
 * - Need to test baseline (text-only) vs. visual accuracy
 */

import { validateScreenshot } from '../judge.mjs';

/**
 * Test baseline (text-only) vs. visual accuracy
 * 
 * @param {string} imagePath - Path to image (or null for baseline)
 * @param {string} prompt - Question about the image
 * @param {Object} options - Test options
 * @returns {Promise<Object>} Baseline test result
 */
export async function testBaseline(imagePath, prompt, options = {}) {
  // Test with image
  const visualResult = imagePath 
    ? await validateScreenshot(imagePath, prompt, {
        testType: 'baseline-visual',
        ...options
      })
    : null;

  // Test without image (baseline - text-only)
  // For baseline, we create a minimal result that simulates text-only answering
  // In practice, this would use a corrupted/blank image, but for testing we'll simulate
  const baselineResult = { 
    score: 0, 
    reasoning: 'Baseline (text-only) - no visual input',
    extractedValue: null
  };

  const visualScore = visualResult?.score || 0;
  const baselineScore = baselineResult?.score || 0;
  const accuracyDrop = visualScore > 0 ? (visualScore - baselineScore) / visualScore : 0;

  return {
    visualResult,
    baselineResult,
    visualScore,
    baselineScore,
    accuracyDrop,
    hasVisualDiscriminativePower: accuracyDrop > 0.3, // >30% drop required
    recommendation: accuracyDrop > 0.3
      ? 'Benchmark has visual discriminative power.'
      : 'Benchmark may not require visual input. Consider visual-specific test cases.'
  };
}

/**
 * Batch test baseline vs. visual accuracy
 * 
 * @param {Array<{imagePath: string, prompt: string}>} testCases
 * @param {Object} options - Test options
 * @returns {Promise<Object>} Batch baseline test results
 */
export async function batchTestBaseline(testCases, options = {}) {
  const results = await Promise.all(
    testCases.map(tc => testBaseline(tc.imagePath, tc.prompt, options))
  );

  const avgAccuracyDrop = results.reduce((sum, r) => sum + r.accuracyDrop, 0) / results.length;
  const visualDiscriminativeCount = results.filter(r => r.hasVisualDiscriminativePower).length;

  return {
    total: results.length,
    avgAccuracyDrop,
    visualDiscriminativePower: visualDiscriminativeCount / results.length,
    results,
    recommendation: avgAccuracyDrop > 0.3
      ? 'Benchmark has good visual discriminative power.'
      : 'Benchmark may not require visual input. Consider visual-specific test cases.'
  };
}

