#!/usr/bin/env node
/**
 * Full Evaluation Suite
 * 
 * Runs the complete evaluation suite with all available datasets and capabilities.
 * Includes cost tracking, multi-modal validation, and comprehensive reporting.
 */

import { loadEnv } from '../../src/load-env.mjs';

// Auto-load .env for API keys
loadEnv();

import { startSession, endSession } from '../../src/index.mjs';
import { spawn } from 'child_process';
import { join } from 'path';
import { existsSync } from 'fs';

/**
 * Run a command and return promise
 */
function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options
    });
    
    proc.on('close', (code) => {
      resolve({ success: code === 0, code });
    });
    
    proc.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Main comprehensive evaluation
 */
async function runFullEvaluationSuite() {
  console.log('='.repeat(70));
  console.log('🚀 Full Evaluation Suite');
  console.log('='.repeat(70));
  console.log();

  const masterSessionId = startSession('full-evaluation-suite', { verbose: false });
  const evaluations = [];
  const startTime = Date.now();

  try {
    // 1. Quick Evaluation (warmup)
    console.log('1️⃣  Quick Evaluation (Warmup)');
    console.log('-'.repeat(70));
    const session1 = startSession('quick-evaluation');
    try {
      await runCommand('node', ['evaluation/runners/run-quick-evaluation-with-tracking.mjs']);
      evaluations.push({ name: 'Quick Evaluation', sessionId: session1, success: true });
    } catch (error) {
      evaluations.push({ name: 'Quick Evaluation', sessionId: session1, success: false, error: error.message });
    }
    endSession(session1, { verbose: false });

    // 2. Ground Truth Validation
    console.log('\n2️⃣  Ground Truth Validation');
    console.log('-'.repeat(70));
    const session2 = startSession('ground-truth-validation');
    try {
      await runCommand('node', ['evaluation/utils/validate-with-ground-truth.mjs', '10']);
      evaluations.push({ name: 'Ground Truth Validation', sessionId: session2, success: true });
    } catch (error) {
      evaluations.push({ name: 'Ground Truth Validation', sessionId: session2, success: false, error: error.message });
    }
    endSession(session2, { verbose: false });

    // 3. Real-World Evaluation
    console.log('\n3️⃣  Real-World Evaluation');
    console.log('-'.repeat(70));
    const session3 = startSession('real-world-evaluation');
    try {
      await runCommand('node', ['evaluation/runners/run-real-evaluation.mjs']);
      evaluations.push({ name: 'Real-World Evaluation', sessionId: session3, success: true });
    } catch (error) {
      evaluations.push({ name: 'Real-World Evaluation', sessionId: session3, success: false, error: error.message });
    }
    endSession(session3, { verbose: false });

    // 4. Multi-Modal Evaluation (if dataset available)
    if (existsSync(join(process.cwd(), 'evaluation', 'datasets', 'webui-ground-truth.json'))) {
      console.log('\n4️⃣  Multi-Modal Evaluation');
      console.log('-'.repeat(70));
      const session4 = startSession('multimodal-evaluation');
      try {
        await runCommand('node', ['evaluation/utils/enhance-webui-multimodal-evaluation.mjs']);
        evaluations.push({ name: 'Multi-Modal Evaluation', sessionId: session4, success: true });
      } catch (error) {
        evaluations.push({ name: 'Multi-Modal Evaluation', sessionId: session4, success: false, error: error.message });
      }
      endSession(session4, { verbose: false });
    }

    // 5. Research Datasets Evaluation
    if (existsSync(join(process.cwd(), 'evaluation', 'datasets', 'integrated', 'screenai-qa.json'))) {
      console.log('\n5️⃣  Research Datasets Evaluation');
      console.log('-'.repeat(70));
      const session5 = startSession('research-datasets-evaluation');
      try {
        await runCommand('node', ['evaluation/runners/run-research-datasets-evaluation.mjs']);
        evaluations.push({ name: 'Research Datasets Evaluation', sessionId: session5, success: true });
      } catch (error) {
        evaluations.push({ name: 'Research Datasets Evaluation', sessionId: session5, success: false, error: error.message });
      }
      endSession(session5, { verbose: false });
    }

    // 6. Capability Coverage Report
    console.log('\n6️⃣  Capability Coverage Report');
    console.log('-'.repeat(70));
    try {
      await runCommand('node', ['evaluation/utils/generate-capability-coverage-report.mjs']);
      evaluations.push({ name: 'Capability Coverage Report', success: true });
    } catch (error) {
      evaluations.push({ name: 'Capability Coverage Report', success: false, error: error.message });
    }

  } finally {
    // Final summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const summary = endSession(masterSessionId, { verbose: true });

    console.log('\n' + '='.repeat(70));
    console.log('📊 FINAL EVALUATION SUITE SUMMARY');
    console.log('='.repeat(70));
    console.log();
    console.log(`Total Duration: ${duration}s`);
    console.log(`Evaluations Run: ${evaluations.length}`);
    console.log(`Successful: ${evaluations.filter(e => e.success).length}`);
    console.log(`Failed: ${evaluations.filter(e => !e.success).length}`);
    console.log();

    if (summary && summary.costs) {
      console.log('💰 Total Costs:');
      console.log(`   Total: $${summary.costs.total.toFixed(4)}`);
      console.log(`   API Calls: ${summary.costs.apiCalls}`);
      console.log(`   Cache Hit Rate: ${summary.costs.cacheHitRate}`);
    }

    console.log();
    console.log('📋 Evaluation Details:');
    evaluations.forEach((evaluation, index) => {
      const icon = evaluation.success ? '✅' : '❌';
      console.log(`   ${icon} ${evaluation.name}`);
      if (evaluation.error) {
        console.log(`      Error: ${evaluation.error}`);
      }
    });

    console.log();
    console.log('='.repeat(70));
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runFullEvaluationSuite().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { runFullEvaluationSuite };

