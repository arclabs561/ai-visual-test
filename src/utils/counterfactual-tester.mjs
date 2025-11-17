/**
 * Counterfactual Tester
 * 
 * Tests whether VLLM uses visual analysis vs. memorized knowledge
 * 
 * Research context:
 * - VLMs achieve only 58.57% accuracy on basic visual tasks
 * - When counterfactual images contradict training data, accuracy drops to 17.05%
 * - 75.70% of errors are bias-aligned rather than random
 * 
 * This utility helps detect when VLLM is using memorization vs. visual analysis
 */

import { validateScreenshot } from '../judge.mjs';

/**
 * Test counterfactual scenario
 * 
 * @param {string} imagePath - Path to counterfactual image
 * @param {string} prompt - Question about the image
 * @param {any} expectedMemorized - What memorized knowledge would predict
 * @param {any} expectedVisual - What visual analysis should find
 * @param {Object} options - Test options
 * @returns {Promise<Object>} Test result
 */
export async function testCounterfactual(imagePath, prompt, expectedMemorized, expectedVisual, options = {}) {
  const result = await validateScreenshot(imagePath, prompt, {
    testType: 'counterfactual',
    ...options
  });

  const extractedValue = result.extractedValue || result.score;
  const usesVisual = extractedValue === expectedVisual || 
                     (typeof extractedValue === 'number' && typeof expectedVisual === 'number' && 
                      Math.abs(extractedValue - expectedVisual) < 0.1);
  const usesMemorization = extractedValue === expectedMemorized ||
                          (typeof extractedValue === 'number' && typeof expectedMemorized === 'number' &&
                           Math.abs(extractedValue - expectedMemorized) < 0.1);

  return {
    extractedValue,
    expectedMemorized,
    expectedVisual,
    usesVisual,
    usesMemorization,
    biasAligned: usesMemorization && !usesVisual,
    result,
    recommendation: usesMemorization 
      ? 'VLLM appears to use memorized knowledge. Consider visual analysis validation.'
      : 'VLLM appears to use visual analysis.'
  };
}

/**
 * Batch test counterfactual scenarios
 * 
 * @param {Array<{imagePath: string, prompt: string, expectedMemorized: any, expectedVisual: any}>} testCases
 * @param {Object} options - Test options
 * @returns {Promise<Object>} Batch test results
 */
export async function batchTestCounterfactual(testCases, options = {}) {
  const results = await Promise.all(
    testCases.map(tc => 
      testCounterfactual(tc.imagePath, tc.prompt, tc.expectedMemorized, tc.expectedVisual, options)
    )
  );

  const visualCount = results.filter(r => r.usesVisual).length;
  const memorizationCount = results.filter(r => r.usesMemorization).length;
  const biasAlignedCount = results.filter(r => r.biasAligned).length;

  return {
    total: results.length,
    visualAccuracy: visualCount / results.length,
    memorizationRate: memorizationCount / results.length,
    biasAlignedRate: biasAlignedCount / results.length,
    results,
    recommendation: biasAlignedCount > results.length * 0.5
      ? 'High bias-aligned error rate. VLLM may be relying on memorized knowledge.'
      : 'VLLM appears to use visual analysis appropriately.'
  };
}

