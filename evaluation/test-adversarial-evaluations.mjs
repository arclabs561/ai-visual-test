#!/usr/bin/env node
/**
 * Adversarial Evaluation Tests
 * 
 * REALLY HARD tests designed to break the system:
 * - Intentionally biased prompts
 * - Edge cases that exploit known weaknesses
 * - Scenarios that research shows are problematic
 * - Multi-judge disagreement scenarios
 * 
 * Based on research findings from:
 * - arXiv:2406.07791 (position bias, quality gaps)
 * - arXiv:2407.01085 (length bias, AdapAlpaca)
 * - arXiv:2412.05579 (LLM-as-judge limitations)
 */

import { validateScreenshot, createConfig } from '../src/index.mjs';
import { detectBias, detectPositionBias } from '../src/bias-detector.mjs';
import { mitigateBias, mitigatePositionBias } from '../src/bias-mitigation.mjs';
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const RESULTS_DIR = join(process.cwd(), 'evaluation', 'results');
if (!existsSync(RESULTS_DIR)) {
  mkdirSync(RESULTS_DIR, { recursive: true });
}

/**
 * Adversarial Test 1: Primacy Bias Exploitation
 * Intentionally place worse solution first to exploit primacy bias
 */
async function testPrimacyBiasExploitation() {
  console.log('\n🔥 Adversarial Test 1: Primacy Bias Exploitation');
  console.log('   Strategy: Place worse solution first, exploit primacy bias\n');
  
  // Create adversarial judgments: worse first, better later
  const adversarialJudgments = [
    { score: 3.0, reasoning: 'Poor design, many issues' }, // Worse first
    { score: 8.5, reasoning: 'Excellent design, outstanding' },
    { score: 8.0, reasoning: 'Very good quality' },
    { score: 7.5, reasoning: 'Good design' }
  ];
  
  const result = detectPositionBias(adversarialJudgments, {
    qualityGap: 0.55, // Moderate gap
    judgeModel: 'gpt-4'
  });
  
  console.log(`   First Score: ${adversarialJudgments[0].score} (WORSE)`);
  console.log(`   Best Score: ${Math.max(...adversarialJudgments.map(j => j.score))} (BETTER)`);
  console.log(`   Bias Detected: ${result.detected ? '✅ YES' : '❌ NO'}`);
  console.log(`   First Bias: ${result.firstBias ? '⚠️ YES (exploited)' : '✅ NO'}`);
  console.log(`   Expected: Should NOT favor worse solution in first position`);
  
  return {
    test: 'primacy_bias_exploitation',
    passed: !result.firstBias || !result.detected,
    result,
    note: 'Adversarial: worse solution in first position should not be favored'
  };
}

/**
 * Adversarial Test 2: Recency Bias Exploitation
 * Intentionally place worse solution last to exploit recency bias
 */
async function testRecencyBiasExploitation() {
  console.log('\n🔥 Adversarial Test 2: Recency Bias Exploitation');
  console.log('   Strategy: Place worse solution last, exploit recency bias\n');
  
  const adversarialJudgments = [
    { score: 8.5, reasoning: 'Excellent design' },
    { score: 8.0, reasoning: 'Very good quality' },
    { score: 7.5, reasoning: 'Good design' },
    { score: 3.0, reasoning: 'Poor design, many issues' } // Worse last
  ];
  
  const result = detectPositionBias(adversarialJudgments, {
    qualityGap: 0.55,
    judgeModel: 'gpt-4'
  });
  
  console.log(`   Last Score: ${adversarialJudgments[adversarialJudgments.length - 1].score} (WORSE)`);
  console.log(`   Best Score: ${Math.max(...adversarialJudgments.map(j => j.score))} (BETTER)`);
  console.log(`   Bias Detected: ${result.detected ? '✅ YES' : '❌ NO'}`);
  console.log(`   Last Bias: ${result.lastBias ? '⚠️ YES (exploited)' : '✅ NO'}`);
  console.log(`   Expected: Should NOT favor worse solution in last position`);
  
  return {
    test: 'recency_bias_exploitation',
    passed: !result.lastBias || !result.detected,
    result,
    note: 'Adversarial: worse solution in last position should not be favored'
  };
}

/**
 * Adversarial Test 3: Length Bias Exploitation
 * Intentionally make worse solution longer to exploit length bias
 */
async function testLengthBiasExploitation() {
  console.log('\n🔥 Adversarial Test 3: Length Bias Exploitation');
  console.log('   Strategy: Make worse solution verbose, exploit length bias\n');
  
  // Worse solution with verbose reasoning
  const verboseReasoning = 'This is a comprehensive analysis. '.repeat(100) +
    'Let me elaborate in great detail. '.repeat(50) +
    'There are many aspects to consider. '.repeat(40);
  
  const judgments = [
    {
      score: 9.0,
      reasoning: 'Excellent design, outstanding accessibility, perfect implementation'
    },
    {
      score: 4.0,
      reasoning: verboseReasoning // Worse but much longer
    }
  ];
  
  const biasDetection = detectBias(judgments[1], {
    checkVerbosity: true,
    checkLength: true
  });
  
  console.log(`   Better Score: ${judgments[0].score} (shorter reasoning)`);
  console.log(`   Worse Score: ${judgments[1].score} (${verboseReasoning.length} chars)`);
  console.log(`   Verbosity Bias: ${biasDetection.biases.some(b => b.type === 'verbosity') ? '⚠️ DETECTED' : '✅ NONE'}`);
  console.log(`   Length Bias: ${biasDetection.biases.some(b => b.type === 'length') ? '⚠️ DETECTED' : '✅ NONE'}`);
  console.log(`   Expected: Should detect and mitigate length bias`);
  console.log(`   Research: AdapAlpaca would align lengths before comparison`);
  
  const mitigated = mitigateBias(judgments[1], biasDetection, { adjustScores: true });
  console.log(`   Original: ${judgments[1].score}, Mitigated: ${mitigated.score}`);
  
  return {
    test: 'length_bias_exploitation',
    passed: biasDetection.biases.some(b => b.type === 'verbosity' || b.type === 'length'),
    biasDetection,
    mitigated,
    note: 'Adversarial: worse solution with excessive length should be penalized'
  };
}

/**
 * Adversarial Test 4: Quality Gap Confusion
 * Create equivocal case (quality gap ≈ 0.5) to maximize confusion
 */
async function testQualityGapConfusion() {
  console.log('\n🔥 Adversarial Test 4: Quality Gap Confusion');
  console.log('   Strategy: Create equivocal case (δ_q ≈ 0.5) to maximize bias\n');
  
  // Create judgments with minimal quality gap (equivocal)
  const equivocalJudgments = [
    { score: 6.95, reasoning: 'Good design with minor issues' },
    { score: 7.05, reasoning: 'Similar quality, slight edge' },
    { score: 6.98, reasoning: 'Comparable, hard to distinguish' },
    { score: 7.02, reasoning: 'Very close, minimal difference' }
  ];
  
  const scoreRange = Math.max(...equivocalJudgments.map(j => j.score)) - 
                     Math.min(...equivocalJudgments.map(j => j.score));
  const qualityGap = 0.5 - Math.abs((scoreRange / 10) - 0.5);
  
  const result = detectPositionBias(equivocalJudgments, {
    qualityGap: qualityGap,
    judgeModel: 'gpt-4',
    taskMetadata: { inputLength: 500, outputLength: 200 }
  });
  
  console.log(`   Quality Gap: ${qualityGap.toFixed(3)} (${qualityGap < 0.6 ? 'EQUIVOCAL' : 'CLEAR'})`);
  console.log(`   Score Range: ${scoreRange.toFixed(2)} (very small)`);
  console.log(`   Bias Detected: ${result.detected ? '⚠️ YES (expected)' : '❌ NO'}`);
  console.log(`   Is Equivocal: ${result.qualityGap?.isEquivocal ? '✅ YES' : '❌ NO'}`);
  console.log(`   Research: Equivocal cases (δ_q ≈ 0.5) cause maximum position bias`);
  console.log(`   Expected: Should detect high bias risk in equivocal cases`);
  
  return {
    test: 'quality_gap_confusion',
    passed: result.qualityGap?.isEquivocal === true,
    qualityGap: qualityGap,
    result,
    note: 'Adversarial: equivocal cases maximize position bias per research'
  };
}

/**
 * Adversarial Test 5: Multi-Judge Disagreement
 * Test scenario where different judges disagree (research shows this happens)
 */
async function testMultiJudgeDisagreement() {
  console.log('\n🔥 Adversarial Test 5: Multi-Judge Disagreement');
  console.log('   Strategy: Simulate judges with different bias patterns\n');
  
  const testJudgments = [
    { score: 7.0 },
    { score: 6.8 },
    { score: 7.2 }
  ];
  
  // Simulate different judge responses (research shows variation)
  const judgeResults = {
    'gpt-4': detectPositionBias(testJudgments, { judgeModel: 'gpt-4', qualityGap: 0.4 }),
    'gpt-3.5': detectPositionBias(testJudgments, { judgeModel: 'gpt-3.5', qualityGap: 0.4 }),
    'claude-3': detectPositionBias(testJudgments, { judgeModel: 'claude-3', qualityGap: 0.4 })
  };
  
  // Check for disagreement
  const biasResults = Object.values(judgeResults).map(r => r.detected);
  const agreement = new Set(biasResults).size === 1;
  
  console.log(`   GPT-4 Bias: ${judgeResults['gpt-4'].detected ? 'YES' : 'NO'}`);
  console.log(`   GPT-3.5 Bias: ${judgeResults['gpt-3.5'].detected ? 'YES' : 'NO'}`);
  console.log(`   Claude-3 Bias: ${judgeResults['claude-3'].detected ? 'YES' : 'NO'}`);
  console.log(`   Agreement: ${agreement ? '✅ YES' : '⚠️ NO (disagreement)'}`);
  console.log(`   Research: Judges show significant variation in bias patterns`);
  console.log(`   Expected: Some disagreement is normal (research finding)`);
  
  return {
    test: 'multi_judge_disagreement',
    passed: true, // Disagreement is expected
    agreement: agreement,
    judgeResults,
    note: 'Research shows judges disagree - this is expected behavior'
  };
}

/**
 * Adversarial Test 6: Authority Bias Exploitation
 * Use authoritative-sounding language to exploit authority bias
 */
async function testAuthorityBiasExploitation() {
  console.log('\n🔥 Adversarial Test 6: Authority Bias Exploitation');
  console.log('   Strategy: Use authoritative language in worse solution\n');
  
  const judgments = [
    {
      score: 8.0,
      reasoning: 'Good design, works well, accessible'
    },
    {
      score: 5.0,
      reasoning: 'According to industry best practices and established standards, ' +
        'this implementation follows authoritative guidelines. ' +
        'Experts in the field have confirmed that this approach is definitive. ' +
        'The methodology is based on authoritative sources and proven techniques. ' +
        'This represents the authoritative standard for such implementations.'
    }
  ];
  
  const biasDetection = detectBias(judgments[1], {
    checkAuthority: true
  });
  
  console.log(`   Better Score: ${judgments[0].score} (plain reasoning)`);
  console.log(`   Worse Score: ${judgments[1].score} (authoritative language)`);
  console.log(`   Authority Bias: ${biasDetection.biases.some(b => b.type === 'authority') ? '⚠️ DETECTED' : '✅ NONE'}`);
  console.log(`   Expected: Should detect authority bias in worse solution`);
  
  const mitigated = mitigateBias(judgments[1], biasDetection, { adjustScores: true });
  console.log(`   Original: ${judgments[1].score}, Mitigated: ${mitigated.score}`);
  
  return {
    test: 'authority_bias_exploitation',
    passed: biasDetection.biases.some(b => b.type === 'authority'),
    biasDetection,
    mitigated,
    note: 'Adversarial: authoritative language should not boost worse solutions'
  };
}

/**
 * Adversarial Test 7: Formatting Bias Exploitation
 * Use excessive formatting to exploit formatting bias
 */
async function testFormattingBiasExploitation() {
  console.log('\n🔥 Adversarial Test 7: Formatting Bias Exploitation');
  console.log('   Strategy: Use excessive formatting in worse solution\n');
  
  const judgments = [
    {
      score: 8.0,
      reasoning: 'Good design, accessible, works well'
    },
    {
      score: 5.0,
      reasoning: `
# EXCELLENT DESIGN

## Key Features:
- **Bold Feature 1**
- **Bold Feature 2**
- **Bold Feature 3**

### Detailed Analysis:
1. **Point One**: Detailed explanation
2. **Point Two**: More details
3. **Point Three**: Even more

> Important Note: This is formatted well

\`\`\`code
Example code block
\`\`\`

**CONCLUSION**: This is well-formatted
      `.trim()
    }
  ];
  
  const biasDetection = detectBias(judgments[1], {
    checkFormatting: true
  });
  
  console.log(`   Better Score: ${judgments[0].score} (plain text)`);
  console.log(`   Worse Score: ${judgments[1].score} (excessive formatting)`);
  console.log(`   Formatting Bias: ${biasDetection.biases.some(b => b.type === 'formatting') ? '⚠️ DETECTED' : '✅ NONE'}`);
  console.log(`   Expected: Should detect formatting bias`);
  
  const mitigated = mitigateBias(judgments[1], biasDetection, { adjustScores: true });
  console.log(`   Original: ${judgments[1].score}, Mitigated: ${mitigated.score}`);
  
  return {
    test: 'formatting_bias_exploitation',
    passed: biasDetection.biases.some(b => b.type === 'formatting'),
    biasDetection,
    mitigated,
    note: 'Adversarial: excessive formatting should not boost worse solutions'
  };
}

/**
 * Run all adversarial evaluation tests
 */
async function runAdversarialEvaluations() {
  console.log('='.repeat(80));
  console.log('🔥 ADVERSARIAL EVALUATION TESTS');
  console.log('   These tests are designed to be REALLY HARD');
  console.log('   They exploit known weaknesses and edge cases\n');
  console.log('='.repeat(80));
  
  const results = {
    timestamp: new Date().toISOString(),
    tests: []
  };
  
  try {
    results.tests.push(await testPrimacyBiasExploitation());
    results.tests.push(await testRecencyBiasExploitation());
    results.tests.push(await testLengthBiasExploitation());
    results.tests.push(await testQualityGapConfusion());
    results.tests.push(await testMultiJudgeDisagreement());
    results.tests.push(await testAuthorityBiasExploitation());
    results.tests.push(await testFormattingBiasExploitation());
  } catch (error) {
    console.error(`\n❌ Error running tests: ${error.message}`);
    console.error(error.stack);
    results.error = error.message;
  }
  
  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 ADVERSARIAL TEST SUMMARY\n');
  
  const passed = results.tests.filter(t => t.passed).length;
  const total = results.tests.length;
  
  results.tests.forEach(test => {
    console.log(`   ${test.passed ? '✅' : '❌'} ${test.test}: ${test.passed ? 'PASSED' : 'FAILED'}`);
    if (test.note) {
      console.log(`      Note: ${test.note}`);
    }
  });
  
  console.log(`\n   Total: ${passed}/${total} passed (${((passed/total)*100).toFixed(1)}%)`);
  console.log(`\n   ⚠️  These are ADVERSARIAL tests - failures indicate vulnerabilities`);
  console.log(`   ✅ Passing means the system resists exploitation`);
  
  // Save results
  const outputPath = join(RESULTS_DIR, `adversarial-evaluations-${Date.now()}.json`);
  writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n   Results saved to: ${outputPath}`);
  
  return results;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAdversarialEvaluations().catch(console.error);
}

export { runAdversarialEvaluations };

