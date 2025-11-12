#!/usr/bin/env node
/**
 * Human Feedback Collection UI
 * 
 * Provides a simple CLI interface for humans to review VLLM judgments
 * and provide their own feedback. This bridges the gap between the system
 * requesting human validation and actually getting human input.
 * 
 * Usage:
 *   node evaluation/human-feedback-ui.mjs
 * 
 * This will:
 * 1. Show pending VLLM judgments that need human review
 * 2. Display screenshot and VLLM judgment
 * 3. Collect human score, issues, and reasoning
 * 4. Save human judgment for calibration
 */

import { readFileSync, readdirSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';
import { getHumanValidationManager } from '../../src/human-validation-manager.mjs';
import { collectHumanJudgment, VALIDATION_DIR } from './human-validation.mjs';

/**
 * Create readline interface for user input
 */
function createRLI() {
  return createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

/**
 * Prompt user for input
 */
function question(rl, prompt) {
  return new Promise(resolve => {
    rl.question(prompt, resolve);
  });
}

/**
 * Display screenshot info (if available)
 */
function displayScreenshotInfo(screenshotPath) {
  if (existsSync(screenshotPath)) {
    console.log(`\n📸 Screenshot: ${screenshotPath}`);
    console.log(`   💡 Open this file to view the screenshot\n`);
  } else {
    console.log(`\n⚠️  Screenshot not found: ${screenshotPath}`);
    console.log(`   (Screenshot may have been moved or deleted)\n`);
  }
}

/**
 * Collect human judgment interactively
 */
async function collectHumanJudgmentInteractive(vllmJudgment) {
  const rl = createRLI();
  
  try {
    console.log('\n' + '='.repeat(60));
    console.log('👤 Human Validation Request');
    console.log('='.repeat(60));
    
    // Display VLLM judgment
    console.log('\n🤖 VLLM Judgment:');
    console.log(`   Score: ${vllmJudgment.vllmScore}/10`);
    console.log(`   Issues: ${vllmJudgment.vllmIssues.join(', ') || 'None'}`);
    console.log(`   Reasoning: ${vllmJudgment.vllmReasoning.substring(0, 200)}...`);
    console.log(`   Test: ${vllmJudgment.context?.testType || 'unknown'}`);
    
    // Display screenshot
    displayScreenshotInfo(vllmJudgment.screenshot);
    
    // Collect human score
    console.log('📝 Please provide your judgment:\n');
    
    let humanScore;
    while (true) {
      const scoreInput = await question(rl, '   Score (0-10): ');
      humanScore = parseInt(scoreInput, 10);
      if (!isNaN(humanScore) && humanScore >= 0 && humanScore <= 10) {
        break;
      }
      console.log('   ⚠️  Please enter a number between 0 and 10');
    }
    
    // Collect issues
    console.log('\n   Issues (comma-separated, or press Enter for none):');
    const issuesInput = await question(rl, '   ');
    const humanIssues = issuesInput.trim() 
      ? issuesInput.split(',').map(i => i.trim()).filter(i => i)
      : [];
    
    // Collect reasoning
    console.log('\n   Reasoning (optional, press Enter to skip):');
    const humanReasoning = await question(rl, '   ') || `Human evaluation: ${humanScore}/10`;
    
    // Optional: evaluator ID
    console.log('\n   Your ID (optional, for tracking):');
    const evaluatorId = await question(rl, '   ') || 'human-reviewer';
    
    const humanJudgment = {
      id: vllmJudgment.id,
      screenshot: vllmJudgment.screenshot,
      prompt: vllmJudgment.prompt,
      humanScore,
      humanIssues,
      humanReasoning,
      timestamp: new Date().toISOString(),
      evaluatorId
    };
    
    // Save human judgment
    collectHumanJudgment(humanJudgment);
    
    console.log('\n✅ Human judgment saved!');
    console.log(`   Your score: ${humanScore}/10`);
    console.log(`   VLLM score: ${vllmJudgment.vllmScore}/10`);
    console.log(`   Difference: ${Math.abs(humanScore - vllmJudgment.vllmScore)} points\n`);
    
    return humanJudgment;
  } finally {
    rl.close();
  }
}

/**
 * Load pending VLLM judgments
 */
function loadPendingVLLMJudgments() {
  const manager = getHumanValidationManager();
  const vllmJudgments = manager.vllmJudgments || [];
  
  // Check which ones already have human judgments
  const humanJudgmentFiles = existsSync(VALIDATION_DIR)
    ? readdirSync(VALIDATION_DIR).filter(f => f.startsWith('human-') && f.endsWith('.json'))
    : [];
  
  const humanJudgmentIds = new Set(
    humanJudgmentFiles.map(f => f.replace('human-', '').replace('.json', ''))
  );
  
  // Return VLLM judgments that don't have human judgments yet
  return vllmJudgments.filter(j => !humanJudgmentIds.has(j.id));
}

/**
 * Main human feedback collection loop
 */
async function collectHumanFeedback() {
  console.log('👤 Human Feedback Collection UI\n');
  console.log('='.repeat(60));
  console.log('This tool helps you provide human judgments on VLLM evaluations.');
  console.log('Your feedback will be used to calibrate the VLLM system.\n');
  
  const pending = loadPendingVLLMJudgments();
  
  if (pending.length === 0) {
    console.log('✅ No pending validations found.');
    console.log('   Run some evaluations with human validation enabled first.\n');
    return;
  }
  
  console.log(`📊 Found ${pending.length} pending VLLM judgments\n`);
  console.log('You can:');
  console.log('  - Review all pending judgments');
  console.log('  - Review specific judgment by ID');
  console.log('  - Skip to calibration\n');
  
  const rl = createRLI();
  
  try {
    const mode = await question(rl, 'Review mode (all/specific/skip): ');
    
    if (mode === 'skip') {
      console.log('\n⏭️  Skipping to calibration...');
      const manager = getHumanValidationManager();
      const result = await manager.calibrate();
      if (result.success) {
        console.log(`✅ Calibrated with ${result.sampleSize} judgments`);
      } else {
        console.log(`⚠️  ${result.message}`);
      }
      return;
    }
    
    let judgmentsToReview = [];
    
    if (mode === 'all') {
      judgmentsToReview = pending;
      console.log(`\n📋 Reviewing all ${pending.length} pending judgments\n`);
    } else if (mode === 'specific') {
      console.log('\nAvailable judgments:');
      pending.forEach((j, i) => {
        console.log(`   ${i + 1}. ID: ${j.id}, Score: ${j.vllmScore}/10, Test: ${j.context?.testType || 'unknown'}`);
      });
      
      const selection = await question(rl, '\nEnter judgment number: ');
      const index = parseInt(selection, 10) - 1;
      if (index >= 0 && index < pending.length) {
        judgmentsToReview = [pending[index]];
      } else {
        console.log('❌ Invalid selection');
        return;
      }
    } else {
      console.log('❌ Invalid mode');
      return;
    }
    
    // Review each judgment
    for (let i = 0; i < judgmentsToReview.length; i++) {
      const judgment = judgmentsToReview[i];
      console.log(`\n[${i + 1}/${judgmentsToReview.length}] Reviewing judgment: ${judgment.id}`);
      
      const continueReview = await question(rl, 'Review this judgment? (y/n/q to quit): ');
      if (continueReview.toLowerCase() === 'q') {
        console.log('\n⏭️  Quitting review...');
        break;
      }
      if (continueReview.toLowerCase() !== 'y') {
        console.log('⏭️  Skipping...');
        continue;
      }
      
      await collectHumanJudgmentInteractive(judgment);
    }
    
    // Offer calibration
    console.log('\n📊 Review complete!');
    const calibrate = await question(rl, 'Run calibration now? (y/n): ');
    if (calibrate.toLowerCase() === 'y') {
      const manager = getHumanValidationManager();
      const result = await manager.calibrate();
      if (result.success) {
        console.log(`\n✅ Calibration successful!`);
        console.log(`   Sample size: ${result.sampleSize}`);
        console.log(`   Correlation: ${result.calibration.agreement.pearson.toFixed(3)}`);
        console.log(`   Kappa: ${result.calibration.agreement.kappa.toFixed(3)}`);
      } else {
        console.log(`\n⚠️  ${result.message}`);
      }
    }
    
  } finally {
    rl.close();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  collectHumanFeedback().catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}

export { collectHumanFeedback, collectHumanJudgmentInteractive };

