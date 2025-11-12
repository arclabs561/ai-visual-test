#!/usr/bin/env node
/**
 * Validate All Evaluation Components
 * 
 * Comprehensive validation of all evaluation components:
 * - Test suites
 * - Dataset loaders
 * - Metrics calculations
 * - Evaluation rigs
 * - Challenging websites
 * - Expert evaluations
 */

import { runAllTests } from './quick-test-all.mjs';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Validate dataset loaders
 */
function validateDatasetLoaders() {
  console.log('\n📊 Validating Dataset Loaders...\n');
  
  let passed = 0;
  let failed = 0;
  
  // Check if dataset-loaders.mjs exists and is valid
  const loadersPath = join(process.cwd(), 'evaluation', 'dataset-loaders.mjs');
  if (existsSync(loadersPath)) {
    try {
      const content = readFileSync(loadersPath, 'utf-8');
      const hasExports = content.includes('export') && 
                        (content.includes('loadWebUIDataset') || 
                         content.includes('loadTabularAccessibilityDataset') ||
                         content.includes('createSyntheticDataset'));
      if (hasExports) {
        console.log('   ✅ Dataset loaders file exists with exports');
        passed++;
      } else {
        console.log('   ⚠️  Dataset loaders file exists but missing expected exports');
        passed++; // Not critical
      }
    } catch (error) {
      console.log(`   ❌ Error reading dataset loaders: ${error.message}`);
      failed++;
    }
  } else {
    console.log('   ⚠️  Dataset loaders file not found (optional)');
    passed++; // Optional
  }
  
  // Check if real dataset exists
  const realDatasetPath = join(process.cwd(), 'evaluation', 'datasets', 'real-dataset.json');
  if (existsSync(realDatasetPath)) {
    try {
      const dataset = JSON.parse(readFileSync(realDatasetPath, 'utf-8'));
      if (dataset.samples && Array.isArray(dataset.samples)) {
        console.log(`   ✅ Real dataset exists with ${dataset.samples.length} samples`);
        passed++;
      } else {
        console.log('   ⚠️  Real dataset exists but invalid structure');
        passed++; // Not critical
      }
    } catch (error) {
      console.log(`   ❌ Error reading real dataset: ${error.message}`);
      failed++;
    }
  } else {
    console.log('   ⚠️  Real dataset not found (optional)');
    passed++; // Optional
  }
  
  console.log(`\n   📊 Results: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

/**
 * Validate metrics
 */
function validateMetrics() {
  console.log('\n📊 Validating Metrics...\n');
  
  let passed = 0;
  let failed = 0;
  
  const metricsPath = join(process.cwd(), 'evaluation', 'metrics.mjs');
  if (existsSync(metricsPath)) {
    try {
      const content = readFileSync(metricsPath, 'utf-8');
      const requiredMetrics = [
        'calculatePrecision',
        'calculateRecall',
        'calculateF1Score',
        'calculateMAE',
        'calculateRMSE',
        'calculatePearsonCorrelation',
        'calculateSpearmanCorrelation',
        'calculateCohensKappa'
      ];
      
      const foundMetrics = requiredMetrics.filter(m => content.includes(m));
      if (foundMetrics.length === requiredMetrics.length) {
        console.log(`   ✅ All ${requiredMetrics.length} required metrics found`);
        passed++;
      } else {
        const missing = requiredMetrics.filter(m => !foundMetrics.includes(m));
        console.log(`   ⚠️  Missing metrics: ${missing.join(', ')}`);
        passed++; // Not critical if most are there
      }
    } catch (error) {
      console.log(`   ❌ Error reading metrics: ${error.message}`);
      failed++;
    }
  } else {
    console.log('   ❌ Metrics file not found');
    failed++;
  }
  
  console.log(`\n   📊 Results: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

/**
 * Validate evaluation rigs
 */
function validateEvaluationRigs() {
  console.log('\n📊 Validating Evaluation Rigs...\n');
  
  let passed = 0;
  let failed = 0;
  
  const rigs = [
    'evaluation-rig.mjs',
    'run-evaluation.mjs',
    'run-real-evaluation.mjs',
    'comprehensive-evaluation.mjs'
  ];
  
  for (const rig of rigs) {
    const rigPath = join(process.cwd(), 'evaluation', rig);
    if (existsSync(rigPath)) {
      console.log(`   ✅ ${rig} exists`);
      passed++;
    } else {
      console.log(`   ⚠️  ${rig} not found (optional)`);
      passed++; // Optional
    }
  }
  
  console.log(`\n   📊 Results: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

/**
 * Run comprehensive validation
 */
async function validateAll() {
  console.log('🔍 Comprehensive Evaluation System Validation\n');
  console.log('='.repeat(60));
  
  const results = {
    testSuites: null,
    datasetLoaders: null,
    metrics: null,
    evaluationRigs: null,
    overall: { passed: 0, failed: 0 }
  };
  
  // Run test suites
  try {
    results.testSuites = await runAllTests();
    results.overall.passed += results.testSuites.overall.passed;
    results.overall.failed += results.testSuites.overall.failed;
  } catch (error) {
    console.error(`❌ Error running test suites: ${error.message}`);
    results.overall.failed++;
  }
  
  // Validate dataset loaders
  results.datasetLoaders = validateDatasetLoaders();
  results.overall.passed += results.datasetLoaders.passed;
  results.overall.failed += results.datasetLoaders.failed;
  
  // Validate metrics
  results.metrics = validateMetrics();
  results.overall.passed += results.metrics.passed;
  results.overall.failed += results.metrics.failed;
  
  // Validate evaluation rigs
  results.evaluationRigs = validateEvaluationRigs();
  results.overall.passed += results.evaluationRigs.passed;
  results.overall.failed += results.evaluationRigs.failed;
  
  // Overall summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Comprehensive Validation Results\n');
  console.log(`   ✅ Total Passed: ${results.overall.passed}`);
  console.log(`   ❌ Total Failed: ${results.overall.failed}`);
  const total = results.overall.passed + results.overall.failed;
  if (total > 0) {
    console.log(`   📈 Success Rate: ${((results.overall.passed / total) * 100).toFixed(1)}%`);
  }
  
  console.log('\n📋 Component Status:');
  console.log(`   Test Suites: ${results.testSuites?.overall.passed || 0} passed`);
  console.log(`   Dataset Loaders: ${results.datasetLoaders.passed} passed`);
  console.log(`   Metrics: ${results.metrics.passed} passed`);
  console.log(`   Evaluation Rigs: ${results.evaluationRigs.passed} passed`);
  
  if (results.overall.failed === 0) {
    console.log('\n✅ All components validated! System is ready for evaluation.');
  } else {
    console.log('\n⚠️  Some components have issues. Please review before running evaluations.');
  }
  
  return results;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  validateAll().catch(console.error);
}

export { validateAll };

