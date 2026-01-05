#!/usr/bin/env node
/**
 * Comprehensive Evaluation Runner with Session Cost Tracking
 * 
 * Runs all major evaluation components with detailed cost tracking per session.
 * Provides "trap debug" hooks to show total ML API resources for usage tracking.
 */

import { loadEnv } from '../../src/load-env.mjs';

// Auto-load .env for API keys
loadEnv();

import { startSession, endSession, getSessionCosts } from '../../src/index.mjs';
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
      if (code === 0) {
        resolve({ success: true, code });
      } else {
        resolve({ success: false, code });
      }
    });
    
    proc.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Main comprehensive evaluation with cost tracking
 */
async function runComprehensiveEvaluation() {
  console.log('='.repeat(70));
  console.log('Comprehensive Evaluation Suite with Cost Tracking');
  console.log('='.repeat(70));
  console.log();
  
  const evaluations = [];
  
  // 1. Ground Truth Validation
  const session1 = startSession('ground-truth-validation');
  console.log('📊 Running Ground Truth Validation...');
  try {
    const result = await runCommand('node', [
      'evaluation/utils/validate-with-ground-truth.mjs',
      '10'
    ]);
    evaluations.push({
      name: 'Ground Truth Validation',
      sessionId: session1,
      success: result.success
    });
  } catch (error) {
    console.error('Error in ground truth validation:', error.message);
    evaluations.push({
      name: 'Ground Truth Validation',
      sessionId: session1,
      success: false,
      error: error.message
    });
  }
  const summary1 = endSession(session1, { verbose: true });
  
  // 2. Real-World Evaluation
  const session2 = startSession('real-world-evaluation');
  console.log('\n🌐 Running Real-World Evaluation...');
  try {
    const result = await runCommand('node', [
      'evaluation/runners/run-real-evaluation.mjs'
    ]);
    evaluations.push({
      name: 'Real-World Evaluation',
      sessionId: session2,
      success: result.success
    });
  } catch (error) {
    console.error('Error in real-world evaluation:', error.message);
    evaluations.push({
      name: 'Real-World Evaluation',
      sessionId: session2,
      success: false,
      error: error.message
    });
  }
  const summary2 = endSession(session2, { verbose: true });
  
  // 3. Temporal Graph Test
  const session3 = startSession('temporal-graph-test');
  console.log('\n🕐 Running Temporal Graph Test...');
  try {
    const result = await runCommand('node', [
      'evaluation/test/test-temporal-graph.mjs'
    ]);
    evaluations.push({
      name: 'Temporal Graph Test',
      sessionId: session3,
      success: result.success
    });
  } catch (error) {
    console.error('Error in temporal graph test:', error.message);
    evaluations.push({
      name: 'Temporal Graph Test',
      sessionId: session3,
      success: false,
      error: error.message
    });
  }
  const summary3 = endSession(session3, { verbose: true });
  
  // 4. Screenshot Selection Test
  const session4 = startSession('screenshot-selection-test');
  console.log('\n📸 Running Screenshot Selection Test...');
  try {
    const result = await runCommand('node', [
      'evaluation/test/test-screenshot-selection.mjs'
    ]);
    evaluations.push({
      name: 'Screenshot Selection Test',
      sessionId: session4,
      success: result.success
    });
  } catch (error) {
    console.error('Error in screenshot selection test:', error.message);
    evaluations.push({
      name: 'Screenshot Selection Test',
      sessionId: session4,
      success: false,
      error: error.message
    });
  }
  const summary4 = endSession(session4, { verbose: true });
  
  // 5. Calibration Degradation Test
  const session5 = startSession('calibration-degradation-test');
  console.log('\n📉 Running Calibration Degradation Test...');
  try {
    const result = await runCommand('node', [
      'evaluation/test/test-calibration-degradation.mjs'
    ]);
    evaluations.push({
      name: 'Calibration Degradation Test',
      sessionId: session5,
      success: result.success
    });
  } catch (error) {
    console.error('Error in calibration degradation test:', error.message);
    evaluations.push({
      name: 'Calibration Degradation Test',
      sessionId: session5,
      success: false,
      error: error.message
    });
  }
  const summary5 = endSession(session5, { verbose: true });
  
  // 6. Core Unit Tests (if available)
  const session6 = startSession('core-unit-tests');
  console.log('\n🧪 Running Core Unit Tests...');
  try {
    const result = await runCommand('node', [
      '--test',
      'test/*.test.mjs'
    ]);
    evaluations.push({
      name: 'Core Unit Tests',
      sessionId: session6,
      success: result.success
    });
  } catch (error) {
    console.warn('Note: Core unit tests may require additional setup');
    evaluations.push({
      name: 'Core Unit Tests',
      sessionId: session6,
      success: false,
      error: error.message,
      skipped: true
    });
  }
  const summary6 = endSession(session6, { verbose: true });
  
  // Print final summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 FINAL EVALUATION SUMMARY');
  console.log('='.repeat(70));
  
  let totalCost = 0;
  let totalCalls = 0;
  let totalCacheHits = 0;
  let totalCacheMisses = 0;
  
  const summaries = [summary1, summary2, summary3, summary4, summary5, summary6].filter(s => s);
  
  summaries.forEach((summary, index) => {
    if (summary) {
      totalCost += summary.costs.total;
      totalCalls += summary.costs.apiCalls;
      totalCacheHits += summary.costs.cacheHits;
      totalCacheMisses += summary.costs.cacheMisses;
      
      console.log(`\n${evaluations[index]?.name || 'Unknown'}:`);
      console.log(`  Cost: $${summary.costs.total.toFixed(4)}`);
      console.log(`  API Calls: ${summary.costs.apiCalls}`);
      console.log(`  Cache Hit Rate: ${summary.costs.cacheHitRate}`);
      console.log(`  Duration: ${summary.durationSeconds}s`);
    }
  });
  
  console.log('\n' + '-'.repeat(70));
  console.log('💰 TOTAL ACROSS ALL SESSIONS:');
  console.log(`  Total Cost: $${totalCost.toFixed(4)}`);
  console.log(`  Total API Calls: ${totalCalls}`);
  console.log(`  Total Cache Hits: ${totalCacheHits}`);
  console.log(`  Total Cache Misses: ${totalCacheMisses}`);
  const overallHitRate = totalCacheHits + totalCacheMisses > 0
    ? ((totalCacheHits / (totalCacheHits + totalCacheMisses)) * 100).toFixed(1)
    : 0;
  console.log(`  Overall Cache Hit Rate: ${overallHitRate}%`);
  
  const cacheSavings = totalCacheHits * (totalCost / (totalCalls || 1));
  if (cacheSavings > 0) {
    console.log(`  Estimated Savings from Cache: $${cacheSavings.toFixed(4)}`);
  }
  
  console.log('='.repeat(70));
  
  // Success summary
  const successful = evaluations.filter(e => e.success).length;
  const failed = evaluations.filter(e => !e.success && !e.skipped).length;
  const skipped = evaluations.filter(e => e.skipped).length;
  
  console.log(`\n✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runComprehensiveEvaluation().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { runComprehensiveEvaluation };

