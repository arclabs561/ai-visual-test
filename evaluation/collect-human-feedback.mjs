#!/usr/bin/env node
/**
 * Human Feedback Collection Tool
 * 
 * Interactive tool for collecting human judgments on VLLM evaluations.
 * Can be used standalone or integrated into evaluation workflows.
 */

import { getHumanValidationManager, initHumanValidation } from '../src/human-validation-manager.mjs';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { VALIDATION_DIR } from './human-validation.mjs';

/**
 * Simple CLI interface for collecting human feedback
 */
async function collectHumanFeedback() {
  console.log('👤 Human Feedback Collection Tool\n');
  console.log('This tool helps you provide human judgments on VLLM evaluations.\n');
  
  // Initialize human validation
  const manager = initHumanValidation({
    enabled: true,
    autoCollect: true,
    smartSampling: false, // Collect all for manual review
    humanValidatorFn: async (vllmJudgment) => {
      // This will be called for each VLLM judgment
      // Return null to skip, or return human judgment
      return await promptForHumanJudgment(vllmJudgment);
    }
  });
  
  // Load pending VLLM judgments
  const vllmJudgments = manager.loadVLLMJudgments();
  
  if (vllmJudgments.length === 0) {
    console.log('No VLLM judgments found. Run some evaluations first!');
    console.log('Human validation will automatically collect VLLM judgments when enabled.\n');
    return;
  }
  
  console.log(`Found ${vllmJudgments.length} VLLM judgments.\n`);
  console.log('To provide human feedback, use the API or implement a custom validator function.\n');
  
  // Show calibration status
  const status = manager.getCalibrationStatus();
  if (status.calibrated) {
    console.log('📊 Calibration Status:');
    console.log(`   Correlation: ${status.correlation.toFixed(3)}`);
    console.log(`   Kappa: ${status.kappa.toFixed(3)}`);
    console.log(`   MAE: ${status.mae.toFixed(2)}`);
    console.log(`   Sample Size: ${status.sampleSize}`);
    console.log(`   Status: ${status.isGood ? '✅ Good' : '⚠️  Needs Improvement'}\n`);
    
    if (status.recommendations && status.recommendations.length > 0) {
      console.log('💡 Recommendations:');
      status.recommendations.forEach((rec, i) => {
        console.log(`   ${i + 1}. ${rec}`);
      });
      console.log();
    }
  } else {
    console.log('📊 Calibration Status: Not calibrated yet');
    console.log('   Provide human judgments to enable calibration.\n');
  }
}

/**
 * Prompt for human judgment (example implementation)
 * 
 * In a real implementation, this could:
 * - Show screenshot in a UI
 * - Display VLLM judgment
 * - Collect human score and issues
 * - Return human judgment object
 */
async function promptForHumanJudgment(vllmJudgment) {
  // Example: Return null to skip (implement your own UI here)
  // In a real implementation, you might:
  // 1. Display screenshot
  // 2. Show VLLM judgment
  // 3. Collect human input
  // 4. Return human judgment
  
  console.log(`\n📸 Screenshot: ${vllmJudgment.screenshot}`);
  console.log(`🤖 VLLM Score: ${vllmJudgment.vllmScore}/10`);
  console.log(`🤖 VLLM Issues: ${vllmJudgment.vllmIssues.join(', ') || 'None'}`);
  console.log(`🤖 VLLM Reasoning: ${vllmJudgment.vllmReasoning.substring(0, 100)}...\n`);
  
  // In a real implementation, you would:
  // - Show the screenshot
  // - Prompt for human score (0-10)
  // - Prompt for human issues
  // - Prompt for human reasoning
  // - Return the human judgment
  
  return null; // Skip for now (implement your own UI)
}

/**
 * Show calibration report
 */
async function showCalibrationReport() {
  const manager = getHumanValidationManager();
  const status = manager.getCalibrationStatus();
  
  if (!status.calibrated) {
    console.log('No calibration data available.');
    return;
  }
  
  console.log('\n📊 Calibration Report\n');
  console.log('Agreement Metrics:');
  console.log(`  Cohen's Kappa: ${status.kappa.toFixed(3)}`);
  console.log(`  MAE: ${status.mae.toFixed(2)} points`);
  console.log(`  Pearson's r: ${status.correlation.toFixed(3)}`);
  console.log(`  Sample Size: ${status.sampleSize}\n`);
  
  console.log('Status:', status.isGood ? '✅ Good Calibration' : '⚠️  Needs Improvement');
  
  if (status.recommendations && status.recommendations.length > 0) {
    console.log('\nRecommendations:');
    status.recommendations.forEach((rec, i) => {
      console.log(`  ${i + 1}. ${rec}`);
    });
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  
  if (command === 'report') {
    showCalibrationReport().catch(console.error);
  } else {
    collectHumanFeedback().catch(console.error);
  }
}

export { collectHumanFeedback, showCalibrationReport };

