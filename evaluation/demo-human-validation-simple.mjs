#!/usr/bin/env node
/**
 * Simple Human Validation Demonstration
 * 
 * Shows the human validation system without requiring API calls.
 * Uses simulated VLLM results to demonstrate the workflow.
 */

import { 
  initHumanValidation, 
  getHumanValidationManager
} from '../src/index.mjs';

/**
 * Simulate human validator
 */
async function simulateHumanValidator(vllmJudgment) {
  console.log(`\n   📸 Human Validation Requested`);
  console.log(`      VLLM Score: ${vllmJudgment.vllmScore}/10`);
  console.log(`      VLLM Issues: ${vllmJudgment.vllmIssues.join(', ') || 'None'}`);
  
  // Simulate human judgment with some variation
  const humanScore = Math.max(0, Math.min(10, 
    Math.round(vllmJudgment.vllmScore + (Math.random() - 0.5) * 1.5)
  ));
  
  const humanIssues = vllmJudgment.vllmIssues.length > 0 && Math.random() > 0.6
    ? [...vllmJudgment.vllmIssues, 'Additional human-identified issue']
    : vllmJudgment.vllmIssues;
  
  console.log(`      👤 Human Score: ${humanScore}/10`);
  console.log(`      👤 Human Issues: ${humanIssues.join(', ') || 'None'}`);
  
  return {
    score: humanScore,
    issues: humanIssues,
    reasoning: `Human evaluation: ${humanScore}/10`,
    evaluatorId: 'demo-user'
  };
}

/**
 * Simulate VLLM evaluation result
 */
function createSimulatedVLLMResult(score, issues, reasoning) {
  return {
    score,
    issues,
    reasoning,
    assessment: reasoning,
    provider: 'demo',
    enabled: true,
    timestamp: new Date().toISOString(),
    screenshotPath: `demo-${Date.now()}.png`
  };
}

/**
 * Main demonstration
 */
async function demonstrateHumanValidation() {
  console.log('🎯 Human Validation System Demonstration\n');
  console.log('='.repeat(60));
  
  // Step 1: Initialize
  console.log('\n📋 Step 1: Initializing Human Validation');
  console.log('   ✅ Auto-collect: Enabled');
  console.log('   ✅ Smart sampling: Enabled');
  console.log('   ✅ Human validator: Configured\n');
  
  const manager = initHumanValidation({
    enabled: true,
    autoCollect: true,
    smartSampling: true,
    humanValidatorFn: simulateHumanValidator
  });
  
  // Step 2: Simulate evaluations
  console.log('🔍 Step 2: Simulating VLLM Evaluations');
  console.log('   (Human validation will be requested for interesting cases)\n');
  
  const testCases = [
    { name: 'High Quality Site', score: 9, issues: [], reasoning: 'Excellent design' },
    { name: 'Low Quality Site', score: 2, issues: ['accessibility', 'contrast', 'navigation'], reasoning: 'Multiple critical issues' },
    { name: 'Average Site', score: 6, issues: ['spacing'], reasoning: 'Needs improvement' },
    { name: 'Good Site', score: 8, issues: ['minor contrast'], reasoning: 'Good overall' },
    { name: 'Edge Case High', score: 10, issues: [], reasoning: 'Perfect score' },
    { name: 'Edge Case Low', score: 1, issues: ['accessibility', 'contrast', 'navigation', 'layout'], reasoning: 'Very poor' },
    { name: 'Normal Site', score: 7, issues: [], reasoning: 'Generally good' },
    { name: 'Many Issues', score: 5, issues: ['issue1', 'issue2', 'issue3', 'issue4', 'issue5'], reasoning: 'Many issues detected' },
    { name: 'Low Score No Issues', score: 4, issues: [], reasoning: 'Low score but no specific issues' },
    { name: 'Random Case', score: 6, issues: ['minor'], reasoning: 'Average' }
  ];
  
  let collectedCount = 0;
  let humanValidationCount = 0;
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`   [${i + 1}/${testCases.length}] ${testCase.name}`);
    console.log(`      VLLM: ${testCase.score}/10, Issues: ${testCase.issues.length}`);
    
    const vllmResult = createSimulatedVLLMResult(
      testCase.score,
      testCase.issues,
      testCase.reasoning
    );
    
    // Collect VLLM judgment (this happens automatically in real evaluations)
    await manager.collectVLLMJudgment(
      vllmResult,
      `demo-${i}.png`,
      'Evaluate this webpage',
      { testType: 'demo', validationId: `demo-${i}` }
    );
    
    collectedCount++;
    
    // Note: Smart sampling happens internally in collectVLLMJudgment
    // We can't directly check it, but we can see it in the output
    // (Human validation requests are shown when they occur)
    
    // Small delay for readability
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  console.log(`\n   ✅ Collected ${collectedCount} VLLM judgments`);
  console.log(`   👤 Requested ${humanValidationCount} human validations (smart sampling)`);
  
  // Step 3: Show calibration status
  console.log('\n📊 Step 3: Calibration Status');
  const status = manager.getCalibrationStatus();
  
  console.log(`   📝 VLLM judgments: ${manager.vllmJudgments.length}`);
  console.log(`   👤 Human judgments: ${status.calibrated ? 'Available' : 'Collecting...'}`);
  
  if (status.calibrated) {
    console.log(`   ✅ Calibrated: Yes`);
    console.log(`   📈 Correlation: ${status.correlation.toFixed(3)}`);
    console.log(`   📈 Kappa: ${status.kappa.toFixed(3)}`);
    console.log(`   📈 MAE: ${status.mae.toFixed(2)} points`);
    console.log(`   ${status.isGood ? '✅' : '⚠️'} Status: ${status.isGood ? 'Good' : 'Needs Improvement'}`);
  } else {
    console.log(`   ⏳ Not yet calibrated`);
    console.log(`   💡 Need at least 10 human judgments`);
    console.log(`   💡 Currently have: ${manager.vllmJudgments.length} VLLM judgments`);
  }
  
  // Step 4: Show smart sampling logic
  console.log('\n🧠 Step 4: Smart Sampling Logic');
  console.log('   Human validation is requested for:');
  console.log('   ✅ Edge cases (score ≤ 3 or ≥ 9)');
  console.log('   ✅ High uncertainty (if available)');
  console.log('   ✅ Many issues (≥ 5 issues)');
  console.log('   ✅ Low score but no issues (might be under-detection)');
  console.log('   ✅ Random 10% of cases');
  
  // Step 5: Demonstrate calibration application
  console.log('\n📈 Step 5: Calibration Application');
  console.log('   When calibration is available, scores are automatically adjusted:');
  
  const testScores = [5, 7, 9];
  for (const score of testScores) {
    const original = score;
    const calibrated = manager.applyCalibration(score);
    if (calibrated !== original) {
      console.log(`   ${original}/10 → ${calibrated.toFixed(1)}/10 (calibrated)`);
    } else {
      console.log(`   ${original}/10 → ${original}/10 (no calibration available yet)`);
    }
  }
  
  // Step 6: Summary
  console.log('\n📋 Step 6: Summary');
  console.log(`   ✅ System initialized`);
  console.log(`   ✅ ${collectedCount} VLLM judgments collected`);
  console.log(`   ✅ ${humanValidationCount} human validations requested`);
  console.log(`   ${status.calibrated ? '✅' : '⏳'} Calibration: ${status.calibrated ? 'Active' : 'Pending'}`);
  
  console.log('\n💡 Next Steps:');
  console.log('   1. Provide human judgments for the requested validations');
  console.log('   2. System will auto-calibrate after 10+ human judgments');
  console.log('   3. Calibrated scores will be applied to future evaluations');
  console.log('   4. Check calibration status with: manager.getCalibrationStatus()');
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Demonstration Complete!\n');
  console.log('💡 In real usage:');
  console.log('   - Human validation is automatically collected during evaluations');
  console.log('   - No code changes needed - just enable with initHumanValidation()');
  console.log('   - Calibration improves over time as more human judgments are collected\n');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateHumanValidation().catch(error => {
    console.error('❌ Demonstration failed:', error);
    process.exit(1);
  });
}

export { demonstrateHumanValidation };

