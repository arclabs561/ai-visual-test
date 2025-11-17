#!/usr/bin/env node
/**
 * Comprehensive Evaluation Suite
 * 
 * Runs evaluations across all available datasets, testing all system capabilities.
 * 
 * Based on DATASET_CAPABILITY_MAPPING.md analysis.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const RESULTS_DIR = join(process.cwd(), 'evaluation', 'results');
const COMPREHENSIVE_RESULTS_FILE = join(RESULTS_DIR, `comprehensive-suite-${Date.now()}.json`);

// Ensure results directory exists
if (!existsSync(RESULTS_DIR)) {
  mkdirSync(RESULTS_DIR, { recursive: true });
}

/**
 * Run evaluation and capture results
 */
async function runEvaluation(name, command, description) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 ${name}`);
  console.log(`   ${description}`);
  console.log(`${'='.repeat(60)}\n`);
  
  try {
    const startTime = Date.now();
    const result = execSync(command, { 
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024, // 10MB
      cwd: process.cwd()
    });
    const duration = Date.now() - startTime;
    
    return {
      name,
      description,
      command,
      success: true,
      duration,
      output: result,
      error: null
    };
  } catch (error) {
    return {
      name,
      description,
      command,
      success: false,
      duration: null,
      output: error.stdout?.toString() || '',
      error: error.message
    };
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🎯 Comprehensive Evaluation Suite');
  console.log('=====================================\n');
  console.log('Testing all system capabilities across all available datasets\n');
  
  const evaluations = [];
  const timestamp = new Date().toISOString();
  
  // 1. Ground Truth Validation (WebUI Dataset)
  evaluations.push(await runEvaluation(
    'Ground Truth Validation',
    'node evaluation/utils/validate-with-ground-truth.mjs 10',
    'Validates VLLM outputs against WebUI dataset accessibility trees'
  ));
  
  // 2. Real-World Evaluation
  if (existsSync(join(process.cwd(), 'evaluation', 'datasets', 'real-dataset.json'))) {
    evaluations.push(await runEvaluation(
      'Real-World Evaluation',
      'node evaluation/runners/run-real-evaluation.mjs',
      'Tests core validation on real websites'
    ));
  }
  
  // 3. Temporal Graph Evaluation
  if (existsSync(join(process.cwd(), 'evaluation', 'datasets', 'temporal-graph.json'))) {
    evaluations.push(await runEvaluation(
      'Temporal Graph Evaluation',
      'node --test test/temporal-graph-comprehensive.test.mjs',
      'Tests temporal graph building and entity tracking'
    ));
  }
  
  // 4. Screenshot Selection Evaluation
  if (existsSync(join(process.cwd(), 'evaluation', 'datasets', 'screenshot-selection.json'))) {
    evaluations.push(await runEvaluation(
      'Screenshot Selection Evaluation',
      'node --test test/screenshot-selection-comprehensive.test.mjs',
      'Tests screenshot selection strategies (keyframes, diversity, uniform)'
    ));
  }
  
  // 5. Calibration Degradation Evaluation
  if (existsSync(join(process.cwd(), 'evaluation', 'datasets', 'calibration-degradation.json'))) {
    evaluations.push(await runEvaluation(
      'Calibration Degradation Evaluation',
      'node --test test/calibration-degradation-comprehensive.test.mjs',
      'Tests calibration tracking and degradation detection'
    ));
  }
  
  // 6. Cohesive Goals Evaluation
  evaluations.push(await runEvaluation(
    'Cohesive Goals Evaluation',
    'node evaluation/test/test-cohesive-goals.mjs',
    'Tests variable goals and goal-based validation'
  ));
  
  // 7. Latency-Aware Batching (if test exists)
  if (existsSync(join(process.cwd(), 'evaluation', 'test', 'test-latency-aware-batching.mjs'))) {
    evaluations.push(await runEvaluation(
      'Latency-Aware Batching',
      'node evaluation/test/test-latency-aware-batching.mjs',
      'Tests high-frequency validation (60Hz) capabilities'
    ));
  }
  
  // 8. Challenging Websites
  if (existsSync(join(process.cwd(), 'evaluation', 'runners', 'run-challenging-tests.mjs'))) {
    evaluations.push(await runEvaluation(
      'Challenging Websites',
      'node evaluation/runners/run-challenging-tests.mjs',
      'Tests edge cases and challenging scenarios'
    ));
  }
  
  // 9. Unit Tests (core functionality)
  evaluations.push(await runEvaluation(
    'Core Unit Tests',
    'npm test 2>&1 | tail -50',
    'Tests core functionality (validateScreenshot, caching, etc.)'
  ));
  
  // Generate summary
  const summary = {
    timestamp,
    totalEvaluations: evaluations.length,
    successful: evaluations.filter(e => e.success).length,
    failed: evaluations.filter(e => !e.success).length,
    totalDuration: evaluations.reduce((sum, e) => sum + (e.duration || 0), 0),
    evaluations: evaluations.map(e => ({
      name: e.name,
      success: e.success,
      duration: e.duration,
      error: e.error
    }))
  };
  
  // Save results
  const fullResults = {
    timestamp,
    summary,
    evaluations
  };
  
  writeFileSync(COMPREHENSIVE_RESULTS_FILE, JSON.stringify(fullResults, null, 2));
  
  // Print summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 Evaluation Summary');
  console.log(`${'='.repeat(60)}\n`);
  console.log(`Total Evaluations: ${summary.totalEvaluations}`);
  console.log(`Successful: ${summary.successful} ✅`);
  console.log(`Failed: ${summary.failed} ${summary.failed > 0 ? '❌' : ''}`);
  console.log(`Total Duration: ${(summary.totalDuration / 1000).toFixed(1)}s`);
  console.log(`\nResults saved: ${COMPREHENSIVE_RESULTS_FILE}\n`);
  
  // Print detailed results
  console.log('Detailed Results:');
  console.log('─'.repeat(60));
  evaluations.forEach(e => {
    const status = e.success ? '✅' : '❌';
    const duration = e.duration ? `${(e.duration / 1000).toFixed(1)}s` : 'N/A';
    console.log(`${status} ${e.name.padEnd(40)} ${duration}`);
    if (e.error) {
      console.log(`   Error: ${e.error}`);
    }
  });
  
  return fullResults;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main };


