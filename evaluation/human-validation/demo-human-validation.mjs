#!/usr/bin/env node
/**
 * Human Validation System Demonstration
 * 
 * Shows how the human validation system works in practice:
 * 1. Initialize human validation
 * 2. Run evaluations (automatic collection)
 * 3. Simulate human feedback
 * 4. Show calibration in action
 */

import { 
  initHumanValidation, 
  getHumanValidationManager,
  validateScreenshot 
} from '../../src/index.mjs';
import { chromium } from 'playwright';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const DEMO_DIR = join(process.cwd(), 'evaluation', 'demo-human-validation');
if (!existsSync(DEMO_DIR)) {
  mkdirSync(DEMO_DIR, { recursive: true });
}

/**
 * Simulate human validator (in real use, this would be your UI)
 */
async function simulateHumanValidator(vllmJudgment) {
  console.log(`\n📸 Human Validation Requested`);
  console.log(`   Screenshot: ${vllmJudgment.screenshot}`);
  console.log(`   VLLM Score: ${vllmJudgment.vllmScore}/10`);
  console.log(`   VLLM Issues: ${vllmJudgment.vllmIssues.join(', ') || 'None'}`);
  console.log(`   VLLM Reasoning: ${vllmJudgment.vllmReasoning.substring(0, 80)}...`);
  
  // Simulate human judgment (in real use, you'd collect this from UI)
  // For demo: Add some variation to show calibration working
  const humanScore = vllmJudgment.vllmScore + (Math.random() - 0.5) * 2; // ±1 point variation
  const clampedScore = Math.max(0, Math.min(10, Math.round(humanScore)));
  
  // Sometimes human finds different issues
  const humanIssues = vllmJudgment.vllmIssues.length > 0 && Math.random() > 0.7
    ? [...vllmJudgment.vllmIssues, 'Additional human-identified issue']
    : vllmJudgment.vllmIssues;
  
  const humanReasoning = `Human evaluation: ${clampedScore}/10. ${vllmJudgment.vllmReasoning.substring(0, 50)}...`;
  
  console.log(`   👤 Human Score: ${clampedScore}/10`);
  console.log(`   👤 Human Issues: ${humanIssues.join(', ') || 'None'}`);
  
  return {
    score: clampedScore,
    issues: humanIssues,
    reasoning: humanReasoning,
    evaluatorId: 'demo-user'
  };
}

/**
 * Capture screenshot from URL
 */
async function captureScreenshot(url, outputPath) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000); // Wait for page to settle
    await page.screenshot({ path: outputPath, fullPage: true });
    return outputPath;
  } finally {
    await browser.close();
  }
}

/**
 * Main demonstration
 */
async function demonstrateHumanValidation() {
  console.log('🎯 Human Validation System Demonstration\n');
  console.log('='.repeat(60));
  
  // Step 1: Initialize human validation
  console.log('\n📋 Step 1: Initializing Human Validation');
  console.log('   - Auto-collect: Enabled');
  console.log('   - Smart sampling: Enabled');
  console.log('   (Will request human validation for interesting cases)\n');
  
  const manager = initHumanValidation({
    enabled: true,
    autoCollect: true,
    smartSampling: true,
    humanValidatorFn: simulateHumanValidator
  });
  
  // Step 2: Capture some screenshots
  console.log('📸 Step 2: Capturing Screenshots');
  const testSites = [
    { name: 'Google', url: 'https://www.google.com' },
    { name: 'GitHub', url: 'https://www.github.com' },
    { name: 'Wikipedia', url: 'https://www.wikipedia.org' }
  ];
  
  const screenshots = [];
  for (const site of testSites) {
    console.log(`   Capturing ${site.name}...`);
    const screenshotPath = join(DEMO_DIR, `${site.name.toLowerCase()}-${Date.now()}.png`);
    try {
      await captureScreenshot(site.url, screenshotPath);
      screenshots.push({ name: site.name, path: screenshotPath });
      console.log(`   ✅ Captured: ${screenshotPath}`);
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
    }
  }
  
  if (screenshots.length === 0) {
    console.log('\n⚠️  No screenshots captured. Using placeholder evaluation.\n');
    // Create a demo with simulated results
    await demonstrateWithSimulatedData(manager);
    return;
  }
  
  // Step 3: Run evaluations (human validation collected automatically)
  console.log('\n🔍 Step 3: Running Evaluations (Human Validation Auto-Collecting)');
  console.log('   Each evaluation will:\n');
  console.log('   1. Get VLLM judgment');
  console.log('   2. Automatically collect for human validation (if interesting)');
  console.log('   3. Apply calibration if available\n');
  
  const prompt = `Evaluate this webpage for:
- Visual design and aesthetics
- Accessibility compliance
- Usability and clarity
- Overall quality

Provide a score from 0-10 and list any issues found.`;
  
  const results = [];
  for (const screenshot of screenshots) {
    console.log(`\n   Evaluating ${screenshot.name}...`);
    
    try {
      const result = await validateScreenshot(
        screenshot.path,
        prompt,
        {
          testType: 'demo-human-validation',
          viewport: { width: 1280, height: 720 },
          enableHumanValidation: true,
          applyCalibration: true
        }
      );
      
      results.push({
        name: screenshot.name,
        result,
        screenshot: screenshot.path
      });
      
      console.log(`   ✅ VLLM Score: ${result.score}/10`);
      if (result.calibrated) {
        console.log(`   📊 Original Score: ${result.originalScore}/10 (calibrated)`);
      }
      if (result.issues && result.issues.length > 0) {
        console.log(`   ⚠️  Issues: ${result.issues.length}`);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }
  
  // Step 4: Show calibration status
  console.log('\n📊 Step 4: Calibration Status');
  const status = manager.getCalibrationStatus();
  
  if (status.calibrated) {
    console.log(`   ✅ Calibrated: Yes`);
    console.log(`   📈 Correlation: ${status.correlation.toFixed(3)}`);
    console.log(`   📈 Kappa: ${status.kappa.toFixed(3)}`);
    console.log(`   📈 MAE: ${status.mae.toFixed(2)} points`);
    console.log(`   📊 Sample Size: ${status.sampleSize}`);
    console.log(`   ${status.isGood ? '✅' : '⚠️'} Status: ${status.isGood ? 'Good Calibration' : 'Needs Improvement'}`);
    
    if (status.recommendations && status.recommendations.length > 0) {
      console.log(`\n   💡 Recommendations:`);
      status.recommendations.forEach((rec, i) => {
        console.log(`      ${i + 1}. ${rec}`);
      });
    }
  } else {
    console.log(`   ⏳ Not calibrated yet`);
    console.log(`   📝 VLLM judgments collected: ${manager.vllmJudgments.length}`);
    console.log(`   💡 Need at least 10 human judgments for calibration`);
    console.log(`   💡 Run more evaluations to collect data`);
  }
  
  // Step 5: Manual calibration (if we have data)
  if (manager.vllmJudgments.length > 0) {
    console.log('\n🔄 Step 5: Manual Calibration');
    console.log(`   Attempting calibration with ${manager.vllmJudgments.length} VLLM judgments...`);
    
    try {
      const calibrationResult = await manager.calibrate();
      
      if (calibrationResult.success) {
        console.log(`   ✅ Calibration successful!`);
        console.log(`   📊 Sample Size: ${calibrationResult.sampleSize}`);
        console.log(`   📈 Correlation: ${calibrationResult.calibration.agreement.pearson.toFixed(3)}`);
        console.log(`   📈 Kappa: ${calibrationResult.calibration.agreement.kappa.toFixed(3)}`);
      } else {
        console.log(`   ⚠️  ${calibrationResult.message}`);
      }
    } catch (error) {
      console.log(`   ❌ Calibration error: ${error.message}`);
    }
  }
  
  // Step 6: Summary
  console.log('\n📋 Step 6: Summary');
  console.log(`   ✅ Evaluations completed: ${results.length}`);
  console.log(`   📊 VLLM judgments collected: ${manager.vllmJudgments.length}`);
  console.log(`   👤 Human validations requested: ${manager.pendingValidations.size}`);
  
  const finalStatus = manager.getCalibrationStatus();
  if (finalStatus.calibrated) {
    console.log(`   ✅ System calibrated: ${finalStatus.isGood ? 'Good' : 'Needs Improvement'}`);
  } else {
    console.log(`   ⏳ System not yet calibrated (need more human judgments)`);
  }
  
  // Save demo results
  const resultsPath = join(DEMO_DIR, `demo-results-${Date.now()}.json`);
  writeFileSync(resultsPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    results,
    calibrationStatus: finalStatus,
    vllmJudgmentsCount: manager.vllmJudgments.length
  }, null, 2));
  
  console.log(`\n💾 Demo results saved to: ${resultsPath}`);
  console.log('\n' + '='.repeat(60));
  console.log('✅ Demonstration Complete!\n');
}

/**
 * Demonstrate with simulated data (if screenshots fail)
 */
async function demonstrateWithSimulatedData(manager) {
  console.log('\n🔍 Step 3: Simulating Evaluations');
  console.log('   (Using simulated VLLM results for demonstration)\n');
  
  // Simulate some VLLM judgments
  const simulatedJudgments = [
    { score: 8, issues: ['minor contrast'], reasoning: 'Good design overall' },
    { score: 3, issues: ['accessibility', 'contrast', 'navigation'], reasoning: 'Multiple issues found' },
    { score: 9, issues: [], reasoning: 'Excellent design' },
    { score: 5, issues: ['layout'], reasoning: 'Needs improvement' },
    { score: 7, issues: ['spacing'], reasoning: 'Generally good' }
  ];
  
  for (let i = 0; i < simulatedJudgments.length; i++) {
    const sim = simulatedJudgments[i];
    console.log(`   Simulating evaluation ${i + 1}...`);
    
    const vllmResult = {
      score: sim.score,
      issues: sim.issues,
      reasoning: sim.reasoning,
      provider: 'demo',
      screenshotPath: `demo-${i}.png`
    };
    
    await manager.collectVLLMJudgment(
      vllmResult,
      `demo-${i}.png`,
      'Evaluate this page',
      { testType: 'demo' }
    );
    
    console.log(`   ✅ VLLM Score: ${sim.score}/10`);
    if (sim.issues.length > 0) {
      console.log(`   ⚠️  Issues: ${sim.issues.join(', ')}`);
    }
    
    // Small delay to show progression
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Show calibration status
  console.log('\n📊 Calibration Status');
  const status = manager.getCalibrationStatus();
  console.log(`   📝 VLLM judgments: ${manager.vllmJudgments.length}`);
  console.log(`   ⏳ Calibration: ${status.calibrated ? 'Available' : 'Not yet (need human judgments)'}`);
  
  console.log('\n✅ Simulated demonstration complete!');
  console.log('   Run with real screenshots to see full calibration in action.\n');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateHumanValidation().catch(error => {
    console.error('❌ Demonstration failed:', error);
    process.exit(1);
  });
}

export { demonstrateHumanValidation };

