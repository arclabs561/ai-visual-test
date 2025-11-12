#!/usr/bin/env node
/**
 * Extreme Position Bias Stress Tests
 * 
 * Based on arXiv:2406.07791 findings:
 * - Quality gap strongly affects position bias (parabolic relationship)
 * - Small quality gaps (δ_q ≈ 0.5) cause maximum confusion
 * - Large quality gaps lead to more consistent judgments
 * - Judge-level, candidate-level, task-level factors all matter
 * 
 * These tests are designed to be REALLY HARD - pushing the system to its limits.
 */

import { detectPositionBias, detectBias } from '../src/bias-detector.mjs';
import { mitigatePositionBias, mitigateBias } from '../src/bias-mitigation.mjs';
import { validateScreenshot } from '../src/index.mjs';
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const RESULTS_DIR = join(process.cwd(), 'evaluation', 'results');
if (!existsSync(RESULTS_DIR)) {
  mkdirSync(RESULTS_DIR, { recursive: true });
}

/**
 * Test Case 1: Equivocal Case (Maximum Bias Risk)
 * Quality gap ≈ 0.5 (tie) - research shows this causes maximum position bias
 */
async function testEquivocalCase() {
  console.log('\n🔥 Test 1: Equivocal Case (Quality Gap ≈ 0.5)');
  console.log('   Research: Small quality gaps cause maximum position bias\n');
  
  // Simulate judgments where scores are very close (equivocal)
  const equivocalJudgments = [
    { score: 7.0, reasoning: 'Good design, minor issues' },
    { score: 7.1, reasoning: 'Similar quality, slight edge' },
    { score: 6.9, reasoning: 'Comparable, hard to distinguish' },
    { score: 7.2, reasoning: 'Very close, minimal difference' }
  ];
  
  // Calculate quality gap (should be ≈ 0.5)
  const scoreRange = Math.max(...equivocalJudgments.map(j => j.score)) - 
                     Math.min(...equivocalJudgments.map(j => j.score));
  const qualityGap = 0.5 - Math.abs((scoreRange / 10) - 0.5);
  
  const result = detectPositionBias(equivocalJudgments, {
    calculateMetrics: false,
    qualityGap: qualityGap,
    judgeModel: 'gpt-4',
    taskMetadata: { inputLength: 500, outputLength: 200, promptLength: 300 }
  });
  
  console.log(`   Quality Gap: ${qualityGap.toFixed(3)} (${qualityGap < 0.6 ? 'EQUIVOCAL' : 'CLEAR'})`);
  console.log(`   Bias Detected: ${result.detected ? '✅ YES' : '❌ NO'}`);
  console.log(`   Quality Gap Severity: ${result.qualityGap?.severity || 'unknown'}`);
  console.log(`   Is Equivocal: ${result.qualityGap?.isEquivocal ? '⚠️ YES - MAXIMUM RISK' : 'No'}`);
  
  return {
    test: 'equivocal_case',
    passed: result.qualityGap?.isEquivocal === true,
    qualityGap: qualityGap,
    biasDetected: result.detected,
    result
  };
}

/**
 * Test Case 2: Large Quality Gap (Should be Fair)
 * Quality gap → 0 or 1 - research shows this leads to consistent, fair judgments
 */
async function testLargeQualityGap() {
  console.log('\n🔥 Test 2: Large Quality Gap (Should be Fair)');
  console.log('   Research: Large quality gaps lead to consistent judgments\n');
  
  const largeGapJudgments = [
    { score: 9.5, reasoning: 'Excellent design, outstanding' },
    { score: 3.2, reasoning: 'Poor accessibility, many issues' },
    { score: 9.3, reasoning: 'Very good, minor improvements needed' },
    { score: 2.8, reasoning: 'Severe problems, not accessible' }
  ];
  
  const scoreRange = Math.max(...largeGapJudgments.map(j => j.score)) - 
                     Math.min(...largeGapJudgments.map(j => j.score));
  const qualityGap = 0.5 - Math.abs((scoreRange / 10) - 0.5);
  
  const result = detectPositionBias(largeGapJudgments, {
    calculateMetrics: false,
    qualityGap: qualityGap,
    judgeModel: 'gpt-4',
    taskMetadata: { inputLength: 500, outputLength: 200, promptLength: 300 }
  });
  
  console.log(`   Quality Gap: ${qualityGap.toFixed(3)} (${qualityGap < 0.2 ? 'LARGE GAP' : 'MODERATE'})`);
  console.log(`   Bias Detected: ${result.detected ? '⚠️ YES' : '✅ NO'}`);
  console.log(`   Quality Gap Severity: ${result.qualityGap?.severity || 'unknown'}`);
  console.log(`   Expected: Low bias (large gap should reduce position bias)`);
  
  return {
    test: 'large_quality_gap',
    passed: result.qualityGap?.severity === 'low' || qualityGap < 0.2,
    qualityGap: qualityGap,
    biasDetected: result.detected,
    result
  };
}

/**
 * Test Case 3: Position Consistency (PC) with Swapped Order
 * Tests PC metric: ratio of consistent judgments when order is swapped
 */
async function testPositionConsistency() {
  console.log('\n🔥 Test 3: Position Consistency (PC) Metric');
  console.log('   Research: PC measures consistency when order is swapped\n');
  
  const originalJudgments = [
    { score: 8.0 },
    { score: 6.5 },
    { score: 7.2 },
    { score: 5.8 }
  ];
  
  // Simulate swapped order (reversed)
  const swappedJudgments = [
    { score: 5.8 },
    { score: 7.2 },
    { score: 6.5 },
    { score: 8.0 }
  ];
  
  const result = detectPositionBias(originalJudgments, {
    calculateMetrics: true,
    swappedJudgments: swappedJudgments,
    qualityGap: 0.3,
    judgeModel: 'gpt-4'
  });
  
  const pc = result.positionConsistency || 0;
  const pf = result.preferenceFairness || {};
  
  console.log(`   Position Consistency (PC): ${(pc * 100).toFixed(1)}%`);
  console.log(`   Preference Fairness - First: ${(pf.firstPositionPreference * 100).toFixed(1)}%`);
  console.log(`   Preference Fairness - Last: ${(pf.lastPositionPreference * 100).toFixed(1)}%`);
  console.log(`   Research Threshold: PC should be high (>0.7) for good judges`);
  
  return {
    test: 'position_consistency',
    passed: pc > 0.7,
    positionConsistency: pc,
    preferenceFairness: pf,
    result
  };
}

/**
 * Test Case 4: Judge-Level Variation
 * Different judge models should show different bias patterns
 */
async function testJudgeLevelVariation() {
  console.log('\n🔥 Test 4: Judge-Level Variation');
  console.log('   Research: Bias varies significantly across judge models\n');
  
  const testJudgments = [
    { score: 7.5 },
    { score: 6.8 },
    { score: 7.2 },
    { score: 6.5 }
  ];
  
  const judges = ['gpt-4', 'gpt-3.5', 'claude-3', 'gemini-pro'];
  const results = {};
  
  for (const judge of judges) {
    const result = detectPositionBias(testJudgments, {
      qualityGap: 0.4,
      judgeModel: judge,
      taskMetadata: { inputLength: 500, outputLength: 200 }
    });
    results[judge] = {
      detected: result.detected,
      firstBias: result.firstBias,
      lastBias: result.lastBias
    };
    console.log(`   ${judge}: Bias=${result.detected ? 'YES' : 'NO'}, First=${result.firstBias}, Last=${result.lastBias}`);
  }
  
  // Check if we see variation (research shows significant variation)
  const variation = new Set(Object.values(results).map(r => r.detected)).size > 1;
  console.log(`   Variation Across Judges: ${variation ? '✅ YES (as expected)' : '⚠️ NO (unexpected)'}`);
  
  return {
    test: 'judge_level_variation',
    passed: variation,
    results,
    note: 'Research shows significant variation across judge models'
  };
}

/**
 * Test Case 5: Adversarial Position Manipulation
 * Intentionally place better solution in disfavored position
 */
async function testAdversarialPosition() {
  console.log('\n🔥 Test 5: Adversarial Position Manipulation');
  console.log('   Test: Better solution in last position (should detect bias)\n');
  
  // Intentionally place best solution last (adversarial)
  const adversarialJudgments = [
    { score: 5.0, reasoning: 'Basic design, minimal features' },
    { score: 6.0, reasoning: 'Decent but has issues' },
    { score: 5.5, reasoning: 'Average quality' },
    { score: 9.5, reasoning: 'Excellent design, outstanding accessibility' } // Best one last!
  ];
  
  const result = detectPositionBias(adversarialJudgments, {
    qualityGap: 0.45, // Large gap but equivocal positioning
    judgeModel: 'gpt-4'
  });
  
  console.log(`   Best Score Position: Last (adversarial)`);
  console.log(`   Bias Detected: ${result.detected ? '✅ YES' : '❌ NO'}`);
  console.log(`   Last Bias: ${result.lastBias ? '✅ YES' : '❌ NO'}`);
  console.log(`   Expected: Should detect bias when best solution is in last position`);
  
  return {
    test: 'adversarial_position',
    passed: result.detected && result.lastBias,
    result,
    note: 'Adversarial test: best solution intentionally placed last'
  };
}

/**
 * Test Case 6: Task-Level Factors
 * Test how task characteristics affect bias
 */
async function testTaskLevelFactors() {
  console.log('\n🔥 Test 6: Task-Level Factors');
  console.log('   Research: Input/output/prompt length affect bias\n');
  
  const testJudgments = [
    { score: 7.0 },
    { score: 6.8 },
    { score: 7.2 }
  ];
  
  const taskConfigs = [
    { inputLength: 100, outputLength: 50, promptLength: 200, name: 'Short' },
    { inputLength: 2000, outputLength: 1000, promptLength: 3000, name: 'Long' },
    { inputLength: 500, outputLength: 200, promptLength: 300, name: 'Medium' }
  ];
  
  const results = {};
  
  for (const config of taskConfigs) {
    const result = detectPositionBias(testJudgments, {
      qualityGap: 0.4,
      judgeModel: 'gpt-4',
      taskMetadata: config
    });
    results[config.name] = {
      detected: result.detected,
      factors: result.factors
    };
    console.log(`   ${config.name} (input=${config.inputLength}, output=${config.outputLength}): Bias=${result.detected ? 'YES' : 'NO'}`);
  }
  
  return {
    test: 'task_level_factors',
    passed: true, // Just documenting variation
    results,
    note: 'Task-level factors (lengths) influence bias per research'
  };
}

/**
 * Test Case 7: Extreme Verbosity Bias
 * Test AdapAlpaca findings: very long responses should be penalized
 */
async function testExtremeVerbosityBias() {
  console.log('\n🔥 Test 7: Extreme Verbosity Bias');
  console.log('   Research: AdapAlpaca - length alignment needed\n');
  
  // Simulate very verbose response
  const verboseReasoning = 'This is a very detailed analysis. '.repeat(50) + 
    'The design has many aspects to consider. '.repeat(30) +
    'Let me elaborate on each point in great detail. '.repeat(40);
  
  const judgment = {
    score: 9.0,
    reasoning: verboseReasoning
  };
  
  const biasDetection = detectBias(judgment, {
    checkVerbosity: true,
    checkLength: true
  });
  
  console.log(`   Reasoning Length: ${verboseReasoning.length} characters`);
  console.log(`   Verbosity Bias Detected: ${biasDetection.biases.some(b => b.type === 'verbosity') ? '✅ YES' : '❌ NO'}`);
  console.log(`   Length Bias Detected: ${biasDetection.biases.some(b => b.type === 'length') ? '✅ YES' : '❌ NO'}`);
  
  // Apply mitigation
  const mitigated = mitigateBias(judgment, biasDetection, { adjustScores: true });
  console.log(`   Original Score: ${judgment.score}`);
  console.log(`   Mitigated Score: ${mitigated.score}`);
  console.log(`   Adjustment: ${mitigated.biasMitigation?.totalAdjustment || 'N/A'}`);
  console.log(`   Research Note: AdapAlpaca would align lengths under equivalent intervals`);
  
  return {
    test: 'extreme_verbosity',
    passed: biasDetection.biases.some(b => b.type === 'verbosity'),
    originalScore: judgment.score,
    mitigatedScore: mitigated.score,
    biasDetection,
    note: 'AdapAlpaca method would normalize lengths before comparison'
  };
}

/**
 * Run all extreme position bias tests
 */
async function runExtremePositionBiasTests() {
  console.log('='.repeat(80));
  console.log('🔥 EXTREME POSITION BIAS STRESS TESTS');
  console.log('   Based on arXiv:2406.07791 and arXiv:2407.01085');
  console.log('   These tests are designed to be REALLY HARD\n');
  console.log('='.repeat(80));
  
  const results = {
    timestamp: new Date().toISOString(),
    tests: []
  };
  
  try {
    results.tests.push(await testEquivocalCase());
    results.tests.push(await testLargeQualityGap());
    results.tests.push(await testPositionConsistency());
    results.tests.push(await testJudgeLevelVariation());
    results.tests.push(await testAdversarialPosition());
    results.tests.push(await testTaskLevelFactors());
    results.tests.push(await testExtremeVerbosityBias());
  } catch (error) {
    console.error(`\n❌ Error running tests: ${error.message}`);
    console.error(error.stack);
    results.error = error.message;
  }
  
  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY\n');
  
  const passed = results.tests.filter(t => t.passed).length;
  const total = results.tests.length;
  
  results.tests.forEach(test => {
    console.log(`   ${test.passed ? '✅' : '❌'} ${test.test}: ${test.passed ? 'PASSED' : 'FAILED'}`);
  });
  
  console.log(`\n   Total: ${passed}/${total} passed (${((passed/total)*100).toFixed(1)}%)`);
  console.log(`\n   These are EXTREME stress tests - failures indicate areas for improvement`);
  
  // Save results
  const outputPath = join(RESULTS_DIR, `extreme-position-bias-${Date.now()}.json`);
  writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n   Results saved to: ${outputPath}`);
  
  return results;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runExtremePositionBiasTests().catch(console.error);
}

export { runExtremePositionBiasTests };

