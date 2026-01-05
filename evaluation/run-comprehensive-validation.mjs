#!/usr/bin/env node
/**
 * Run Comprehensive Validation Suite
 * 
 * Orchestrates all validation tests:
 * - Temporal aggregation and coherence
 * - Adaptive sampling and decision logic
 * - Embeddings and semantic matching
 * - Performance benchmarks
 * - Real dataset validation
 * 
 * Uses existing test infrastructure and datasets.
 */

import { runComprehensiveValidation } from './validate-improved-methods.mjs';
import { runEvaluation } from './runners/evaluate.mjs';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const RESULTS_DIR = join(process.cwd(), 'evaluation', 'results', 'comprehensive-validation');

async function runAllValidations() {
  console.log('🔬 Comprehensive Validation Suite');
  console.log('================================\n');
  
  if (!existsSync(RESULTS_DIR)) {
    mkdirSync(RESULTS_DIR, { recursive: true });
  }
  
  const timestamp = Date.now();
  const results = {
    timestamp: new Date().toISOString(),
    methodValidation: null,
    datasetEvaluation: {},
    summary: {}
  };
  
  // 1. Method validation (temporal, adaptive sampling, etc.)
  console.log('📊 Step 1: Method Validation');
  console.log('----------------------------');
  try {
    results.methodValidation = await runComprehensiveValidation();
  } catch (error) {
    console.error('❌ Method validation failed:', error.message);
    results.methodValidation = { error: error.message };
  }
  
  // 2. Dataset evaluations
  console.log('\n📈 Step 2: Dataset Evaluations');
  console.log('------------------------------');
  const datasets = ['real', 'webui', 'screenai'];
  
  for (const dataset of datasets) {
    try {
      console.log(`\nEvaluating ${dataset}...`);
      const evalResult = await runEvaluation({
        dataset,
        limit: 20, // Smaller limit for validation
        provider: 'groq', // Fast provider
        outputFile: join(RESULTS_DIR, `evaluation-${dataset}-${timestamp}.json`)
      });
      
      results.datasetEvaluation[dataset] = {
        success: true,
        metrics: evalResult.metrics,
        evaluated: evalResult.evaluated,
        total: evalResult.total
      };
      
      console.log(`✅ ${dataset}: ${evalResult.evaluated} samples, precision=${evalResult.metrics?.precision?.toFixed(3) || 'N/A'}`);
    } catch (error) {
      console.error(`❌ ${dataset} evaluation failed:`, error.message);
      results.datasetEvaluation[dataset] = {
        success: false,
        error: error.message
      };
    }
  }
  
  // 3. Generate summary
  console.log('\n📋 Step 3: Generating Summary');
  console.log('------------------------------');
  
  const methodCount = results.methodValidation ? 
    Object.keys(results.methodValidation.temporalAggregation || {}).length : 0;
  const evalCount = Object.values(results.datasetEvaluation)
    .filter(e => e.success).length;
  
  results.summary = {
    methodValidation: {
      datasets: methodCount,
      status: results.methodValidation ? 'completed' : 'failed'
    },
    datasetEvaluation: {
      datasets: evalCount,
      total: datasets.length,
      status: evalCount === datasets.length ? 'all completed' : 'partial'
    },
    overall: {
      status: methodCount > 0 && evalCount > 0 ? 'success' : 'partial',
      timestamp: new Date().toISOString()
    }
  };
  
  // Save comprehensive results
  const outputFile = join(RESULTS_DIR, `comprehensive-validation-${timestamp}.json`);
  writeFileSync(outputFile, JSON.stringify(results, null, 2));
  
  console.log('\n✅ Validation Complete!');
  console.log('======================');
  console.log(`Method Validation: ${methodCount} datasets`);
  console.log(`Dataset Evaluation: ${evalCount}/${datasets.length} datasets`);
  console.log(`Results saved to: ${outputFile}`);
  
  return results;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllValidations().catch(console.error);
}

export { runAllValidations };

