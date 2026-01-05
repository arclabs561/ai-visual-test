#!/usr/bin/env node
/**
 * Data-Driven Multi-Dataset Evaluation
 * 
 * Runs evaluations across all available datasets to gather performance data,
 * then analyzes patterns to drive implementation improvements.
 * 
 * Usage:
 *   node evaluation/runners/data-driven-evaluation.mjs [options]
 * 
 * Options:
 *   --datasets <names>  Comma-separated dataset names (default: all)
 *   --limit <number>    Samples per dataset (default: 50)
 *   --output <file>     Output analysis file (default: evaluation/analysis/data-driven-results.json)
 */

import { loadEnv } from '../../src/load-env.mjs';

// Auto-load .env for API keys
loadEnv();

import { runEvaluation } from './evaluate.mjs';
import { loadDataset } from '../utils/dataset-adapters.mjs';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const RESULTS_DIR = join(process.cwd(), 'evaluation', 'results');
const ANALYSIS_DIR = join(process.cwd(), 'evaluation', 'analysis');

// Ensure directories exist
if (!existsSync(ANALYSIS_DIR)) {
  mkdirSync(ANALYSIS_DIR, { recursive: true });
}

/**
 * Run evaluation on a single dataset
 */
async function evaluateDataset(datasetName, options = {}) {
  const { limit = 50, provider = 'groq' } = options;
  
  console.log(`\n📊 Evaluating ${datasetName} (limit: ${limit})...`);
  
  try {
    // Check dataset availability
    const datasetInfo = await loadDataset(datasetName, { limit: 1 });
    const totalAvailable = datasetInfo.totalAvailable || 0;
    
    if (totalAvailable === 0) {
      return {
        dataset: datasetName,
        error: 'Dataset not available or empty',
        totalAvailable: 0
      };
    }
    
    // Run evaluation
    const actualLimit = Math.min(limit, totalAvailable);
    const result = await runEvaluation({
      dataset: datasetName,
      limit: actualLimit,
      provider
    });
    
    // Extract key metrics
    const metrics = result.summary?.metrics || {};
    const samples = result.summary?.total || 0;
    const successful = result.summary?.successful || 0;
    
    return {
      dataset: datasetName,
      totalAvailable,
      evaluated: samples,
      successful,
      metrics: {
        mae: metrics.mae,
        rmse: metrics.rmse,
        precision: metrics.precision,
        recall: metrics.recall,
        f1: metrics.f1,
        correlation: metrics.correlation,
        avgScore: metrics.averageScore
      },
      resultFile: result.resultFile
    };
  } catch (error) {
    console.error(`❌ Error evaluating ${datasetName}:`, error.message);
    return {
      dataset: datasetName,
      error: error.message
    };
  }
}

/**
 * Analyze patterns across datasets
 */
function analyzePatterns(results) {
  const analysis = {
    timestamp: new Date().toISOString(),
    datasets: results,
    patterns: {},
    recommendations: []
  };
  
  // Calculate aggregate metrics
  const validResults = results.filter(r => !r.error && r.metrics);
  if (validResults.length === 0) {
    analysis.error = 'No valid results to analyze';
    return analysis;
  }
  
  // Aggregate metrics (with null safety)
  const aggregate = {
    totalSamples: validResults.reduce((sum, r) => sum + (r.evaluated || 0), 0),
    avgPrecision: average(validResults.map(r => r.metrics?.precision).filter(v => v != null && !isNaN(v))),
    avgRecall: average(validResults.map(r => r.metrics?.recall).filter(v => v != null && !isNaN(v))),
    avgF1: average(validResults.map(r => r.metrics?.f1).filter(v => v != null && !isNaN(v))),
    avgMAE: average(validResults.map(r => r.metrics?.mae).filter(v => v != null && !isNaN(v))),
    avgRMSE: average(validResults.map(r => r.metrics?.rmse).filter(v => v != null && !isNaN(v)))
  };
  
  analysis.aggregate = aggregate;
  
  // Identify patterns
  const patterns = [];
  
  // Pattern 1: Precision vs Recall trade-off
  const precisionRecall = validResults.map(r => ({
    dataset: r.dataset,
    precision: r.metrics?.precision,
    recall: r.metrics?.recall,
    f1: r.metrics?.f1
  }));
  
  const highPrecision = precisionRecall.filter(p => p.precision > 0.8);
  const highRecall = precisionRecall.filter(p => p.recall > 0.8);
  const balanced = precisionRecall.filter(p => p.precision > 0.6 && p.recall > 0.6);
  
  if (highPrecision.length > 0) {
    patterns.push({
      type: 'high_precision',
      description: `${highPrecision.length} dataset(s) with precision > 0.8`,
      datasets: highPrecision.map(p => p.dataset),
      recommendation: 'Consider lowering thresholds to improve recall'
    });
  }
  
  if (highRecall.length > 0) {
    patterns.push({
      type: 'high_recall',
      description: `${highRecall.length} dataset(s) with recall > 0.8`,
      datasets: highRecall.map(p => p.dataset),
      recommendation: 'Consider raising thresholds to improve precision'
    });
  }
  
  if (balanced.length > 0) {
    patterns.push({
      type: 'balanced',
      description: `${balanced.length} dataset(s) with balanced precision/recall`,
      datasets: balanced.map(p => p.dataset),
      recommendation: 'Current thresholds are well-calibrated for these datasets'
    });
  }
  
  // Pattern 2: Error analysis
  const errorAnalysis = validResults.map(r => ({
    dataset: r.dataset,
    mae: r.metrics?.mae,
    rmse: r.metrics?.rmse
  }));
  
  const highError = errorAnalysis.filter(e => e.mae > 2.0 || e.rmse > 3.0);
  if (highError.length > 0) {
    patterns.push({
      type: 'high_error',
      description: `${highError.length} dataset(s) with high error (MAE > 2.0 or RMSE > 3.0)`,
      datasets: highError.map(e => e.dataset),
      recommendation: 'Investigate score calibration and ground truth quality'
    });
  }
  
  // Pattern 3: Dataset size impact
  const sizeImpact = validResults.map(r => ({
    dataset: r.dataset,
    samples: r.evaluated,
    f1: r.metrics?.f1
  }));
  
  const largeDatasets = sizeImpact.filter(s => s.samples >= 100);
  const smallDatasets = sizeImpact.filter(s => s.samples < 20);
  
  if (largeDatasets.length > 0 && smallDatasets.length > 0) {
    const largeAvgF1 = average(largeDatasets.map(s => s.f1));
    const smallAvgF1 = average(smallDatasets.map(s => s.f1));
    
    if (Math.abs(largeAvgF1 - smallAvgF1) > 0.1) {
      patterns.push({
        type: 'size_impact',
        description: `F1 differs between large (${largeAvgF1.toFixed(2)}) and small (${smallAvgF1.toFixed(2)}) datasets`,
        recommendation: 'Consider stratified sampling or dataset-specific calibration'
      });
    }
  }
  
  analysis.patterns = patterns;
  
  // Generate recommendations
  const recommendations = [];
  
  if (aggregate.avgPrecision != null && aggregate.avgPrecision < 0.7) {
    recommendations.push({
      priority: 'high',
      area: 'precision',
      issue: `Average precision is ${aggregate.avgPrecision.toFixed(2)} (target: >0.7)`,
      action: 'Review issue filtering thresholds and embedding similarity thresholds'
    });
  }
  
  if (aggregate.avgRecall != null && aggregate.avgRecall < 0.7) {
    recommendations.push({
      priority: 'high',
      area: 'recall',
      issue: `Average recall is ${aggregate.avgRecall.toFixed(2)} (target: >0.7)`,
      action: 'Review matching thresholds and consider lowering Jaccard/embedding thresholds'
    });
  }
  
  if (aggregate.avgF1 != null && aggregate.avgF1 < 0.7) {
    recommendations.push({
      priority: 'medium',
      area: 'f1',
      issue: `Average F1 is ${aggregate.avgF1.toFixed(2)} (target: >0.7)`,
      action: 'Balance precision and recall by adjusting thresholds'
    });
  }
  
  if (aggregate.avgMAE != null && aggregate.avgMAE > 2.0) {
    recommendations.push({
      priority: 'medium',
      area: 'calibration',
      issue: `Average MAE is ${aggregate.avgMAE.toFixed(2)} (target: <2.0)`,
      action: 'Improve score calibration and ground truth precision'
    });
  }
  
  analysis.recommendations = recommendations;
  
  return analysis;
}

function average(values) {
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return sum / values.length;
}

/**
 * Main evaluation runner
 */
async function runDataDrivenEvaluation(options = {}) {
  const {
    datasets = ['webui', 'screenai', 'wcag', 'real'],
    limit = 50,
    provider = 'groq',
    output = join(ANALYSIS_DIR, 'data-driven-results.json')
  } = options;
  
  console.log('🔬 Data-Driven Multi-Dataset Evaluation');
  console.log('========================================');
  console.log(`Datasets: ${datasets.join(', ')}`);
  console.log(`Limit per dataset: ${limit}`);
  console.log(`Provider: ${provider}`);
  console.log('');
  
  // Evaluate all datasets
  const results = [];
  for (const datasetName of datasets) {
    const result = await evaluateDataset(datasetName, { limit, provider });
    results.push(result);
  }
  
  // Analyze patterns
  console.log('\n📈 Analyzing patterns...');
  const analysis = analyzePatterns(results);
  
  // Save results
  writeFileSync(output, JSON.stringify(analysis, null, 2));
  console.log(`\n💾 Results saved to: ${output}`);
  
  // Print summary
  console.log('\n📊 Summary:');
  console.log('===========');
  if (analysis.aggregate) {
    console.log(`Total samples: ${analysis.aggregate.totalSamples}`);
    if (analysis.aggregate.avgPrecision != null) {
      console.log(`Average Precision: ${(analysis.aggregate.avgPrecision * 100).toFixed(1)}%`);
    }
    if (analysis.aggregate.avgRecall != null) {
      console.log(`Average Recall: ${(analysis.aggregate.avgRecall * 100).toFixed(1)}%`);
    }
    if (analysis.aggregate.avgF1 != null) {
      console.log(`Average F1: ${(analysis.aggregate.avgF1 * 100).toFixed(1)}%`);
    }
    if (analysis.aggregate.avgMAE != null) {
      console.log(`Average MAE: ${analysis.aggregate.avgMAE.toFixed(2)}`);
    }
    if (analysis.aggregate.avgRMSE != null) {
      console.log(`Average RMSE: ${analysis.aggregate.avgRMSE.toFixed(2)}`);
    }
  }
  
  if (analysis.patterns.length > 0) {
    console.log(`\n🔍 Patterns found: ${analysis.patterns.length}`);
    analysis.patterns.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.description}`);
    });
  }
  
  if (analysis.recommendations.length > 0) {
    console.log(`\n💡 Recommendations: ${analysis.recommendations.length}`);
    analysis.recommendations.forEach((r, i) => {
      console.log(`  ${i + 1}. [${r.priority.toUpperCase()}] ${r.area}: ${r.issue}`);
      console.log(`     → ${r.action}`);
    });
  }
  
  return analysis;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const options = {};
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--datasets') {
      options.datasets = args[++i].split(',');
    } else if (args[i] === '--limit') {
      options.limit = parseInt(args[++i], 10);
    } else if (args[i] === '--provider') {
      options.provider = args[++i];
    } else if (args[i] === '--output') {
      options.output = args[++i];
    }
  }
  
  runDataDrivenEvaluation(options).catch(error => {
    console.error('❌ Evaluation failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  });
}

export { runDataDrivenEvaluation, analyzePatterns };

