#!/usr/bin/env node
/**
 * Ablation Study Framework
 * 
 * Tests each technique in isolation to measure actual impact.
 * Rather than implementing everything from arXiv, we validate what actually works.
 * 
 * Techniques to test:
 * 1. Explicit rubrics (arXiv:2412.05579)
 * 2. Pair comparison (arXiv:2402.04788)
 * 3. Position counter-balancing (arXiv:2508.02020)
 * 4. Temporal aggregation (our implementation)
 * 5. Multi-scale temporal aggregation (our implementation)
 * 6. Hallucination detection (arXiv:2506.19513+)
 * 7. Uncertainty reduction - logprobs
 * 8. Uncertainty reduction - self-consistency (arXiv:2203.11171)
 * 9. Bias mitigation (arXiv:2406.07791)
 * 10. Few-shot examples (dynamic selection)
 * 11. Multi-modal fusion
 * 12. Cross-modal consistency
 * 13. Persona-based evaluation
 * 14. Ensemble judging (arXiv:2510.01499)
 */

import { validateScreenshot, comparePair, rankBatch } from '../src/index.mjs';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { calculateAllMetrics } from './metrics.mjs';

const RESULTS_DIR = join(process.cwd(), 'evaluation', 'results', 'ablation');
const DATASET_FILE = join(process.cwd(), 'evaluation', 'datasets', 'real-dataset.json');

// Ensure results directory exists
if (!existsSync(RESULTS_DIR)) {
  const { mkdirSync } = await import('fs');
  mkdirSync(RESULTS_DIR, { recursive: true });
}

/**
 * Baseline: No techniques, just raw VLLM judgment
 */
async function baseline(imagePath, prompt) {
  return await validateScreenshot(imagePath, prompt, {
    enableUncertaintyReduction: false,
    enableHallucinationCheck: false,
    enableBiasMitigation: false,
    useRubric: false
  });
}

/**
 * Technique 1: Explicit Rubrics
 */
async function withRubric(imagePath, prompt) {
  return await validateScreenshot(imagePath, prompt, {
    enableUncertaintyReduction: false,
    enableHallucinationCheck: false,
    enableBiasMitigation: false,
    useRubric: true // Explicit rubric
  });
}

/**
 * Technique 2: Pair Comparison
 */
async function withPairComparison(imagePath1, imagePath2, prompt) {
  return await comparePair(imagePath1, imagePath2, prompt, {
    enableUncertaintyReduction: false,
    enableHallucinationCheck: false,
    enableBiasMitigation: false
  });
}

/**
 * Technique 3: Position Counter-Balancing
 */
async function withCounterBalance(imagePath, prompt) {
  const { evaluateWithCounterBalance } = await import('../src/index.mjs');
  return await evaluateWithCounterBalance(
    validateScreenshot,
    imagePath,
    prompt,
    { enabled: true }
  );
}

/**
 * Technique 4: Temporal Aggregation
 */
async function withTemporalAggregation(imagePath, prompt, temporalNotes) {
  return await validateScreenshot(imagePath, prompt, {
    enableUncertaintyReduction: false,
    enableHallucinationCheck: false,
    enableBiasMitigation: false,
    temporalNotes: temporalNotes || []
  });
}

/**
 * Technique 5: Multi-Scale Temporal Aggregation
 */
async function withMultiScaleTemporal(imagePath, prompt, temporalNotes) {
  const { aggregateMultiScale } = await import('../src/index.mjs');
  const aggregated = aggregateMultiScale(temporalNotes || [], {
    timeScales: {
      immediate: 100,
      short: 1000,
      medium: 10000,
      long: 60000
    }
  });
  return await validateScreenshot(imagePath, prompt, {
    enableUncertaintyReduction: false,
    enableHallucinationCheck: false,
    enableBiasMitigation: false,
    temporalNotes: aggregated
  });
}

/**
 * Technique 6: Hallucination Detection
 */
async function withHallucinationDetection(imagePath, prompt) {
  return await validateScreenshot(imagePath, prompt, {
    enableUncertaintyReduction: false,
    enableHallucinationCheck: true, // Only hallucination detection
    enableBiasMitigation: false
  });
}

/**
 * Technique 7: Uncertainty Reduction - Logprobs Only
 */
async function withLogprobs(imagePath, prompt) {
  return await validateScreenshot(imagePath, prompt, {
    enableUncertaintyReduction: true,
    enableHallucinationCheck: false, // No hallucination, just logprobs
    enableBiasMitigation: false
  });
}

/**
 * Technique 8: Uncertainty Reduction - Self-Consistency
 */
async function withSelfConsistency(imagePath, prompt) {
  const { selfConsistencyCheck } = await import('../src/index.mjs');
  return await selfConsistencyCheck(
    () => validateScreenshot(imagePath, prompt, {
      enableUncertaintyReduction: false,
      enableHallucinationCheck: false,
      enableBiasMitigation: false
    }),
    3 // N=3 calls
  );
}

/**
 * Technique 9: Bias Mitigation
 */
async function withBiasMitigation(imagePath, prompt) {
  return await validateScreenshot(imagePath, prompt, {
    enableUncertaintyReduction: false,
    enableHallucinationCheck: false,
    enableBiasMitigation: true
  });
}

/**
 * Technique 10: Few-Shot Examples
 */
async function withFewShot(imagePath, prompt) {
  // Use dynamic few-shot selection
  return await validateScreenshot(imagePath, prompt, {
    enableUncertaintyReduction: false,
    enableHallucinationCheck: false,
    enableBiasMitigation: false,
    useFewShot: true
  });
}

/**
 * Technique 11: Multi-Modal Fusion
 */
async function withMultiModal(imagePath, prompt, html, css) {
  const { multiModalValidation } = await import('../src/index.mjs');
  // Would need a page object for full multi-modal, simplified here
  return await validateScreenshot(imagePath, prompt, {
    enableUncertaintyReduction: false,
    enableHallucinationCheck: false,
    enableBiasMitigation: false,
    html: html || null,
    css: css || null
  });
}

/**
 * Technique 12: Persona-Based Evaluation
 */
async function withPersona(imagePath, prompt, persona) {
  return await validateScreenshot(imagePath, prompt, {
    enableUncertaintyReduction: false,
    enableHallucinationCheck: false,
    enableBiasMitigation: false,
    persona: persona || null
  });
}

/**
 * Technique 13: Ensemble Judging
 */
async function withEnsemble(imagePath, prompt) {
  const { EnsembleJudge } = await import('../src/index.mjs');
  const ensemble = new EnsembleJudge({
    providers: ['openai', 'gemini', 'claude'],
    weights: 'optimal' // Use inverse logistic weighting
  });
  return await ensemble.judge(imagePath, prompt);
}

/**
 * Run ablation study on a single test case
 */
async function runAblation(testCase, groundTruth) {
  const { screenshot, prompt } = testCase;
  const results = {
    testCase: testCase.name || 'unknown',
    timestamp: new Date().toISOString(),
    techniques: {}
  };

  console.log(`\n🔬 Ablation Study: ${testCase.name || 'Unknown'}`);
  console.log('=' .repeat(60));

  // Baseline
  console.log('📊 Baseline (no techniques)...');
  try {
    const baselineResult = await baseline(screenshot, prompt);
    results.techniques.baseline = {
      score: baselineResult.score,
      issues: baselineResult.issues?.length || 0,
      cost: baselineResult.estimatedCost?.totalCost || 0,
      latency: baselineResult.responseTime || 0,
      uncertainty: baselineResult.uncertainty || null,
      confidence: baselineResult.confidence || null
    };
    console.log(`   Score: ${baselineResult.score}/10`);
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    results.techniques.baseline = { error: error.message };
  }

  // Technique 1: Explicit Rubrics
  console.log('📋 Technique 1: Explicit Rubrics...');
  try {
    const rubricResult = await withRubric(screenshot, prompt);
    results.techniques.explicitRubric = {
      score: rubricResult.score,
      issues: rubricResult.issues?.length || 0,
      cost: rubricResult.estimatedCost?.totalCost || 0,
      latency: rubricResult.responseTime || 0,
      improvement: rubricResult.score !== null && results.techniques.baseline?.score !== null
        ? rubricResult.score - results.techniques.baseline.score
        : null
    };
    console.log(`   Score: ${rubricResult.score}/10 (Δ: ${results.techniques.explicitRubric.improvement || 'N/A'})`);
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    results.techniques.explicitRubric = { error: error.message };
  }

  // Technique 2: Hallucination Detection
  console.log('🔍 Technique 2: Hallucination Detection...');
  try {
    const hallucinationResult = await withHallucinationDetection(screenshot, prompt);
    results.techniques.hallucinationDetection = {
      score: hallucinationResult.score,
      issues: hallucinationResult.issues?.length || 0,
      cost: hallucinationResult.estimatedCost?.totalCost || 0,
      latency: hallucinationResult.responseTime || 0,
      improvement: hallucinationResult.score !== null && results.techniques.baseline?.score !== null
        ? hallucinationResult.score - results.techniques.baseline.score
        : null
    };
    console.log(`   Score: ${hallucinationResult.score}/10 (Δ: ${results.techniques.hallucinationDetection.improvement || 'N/A'})`);
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    results.techniques.hallucinationDetection = { error: error.message };
  }

  // Technique 3: Uncertainty Reduction - Logprobs
  console.log('📈 Technique 3: Uncertainty Reduction (Logprobs)...');
  try {
    const logprobsResult = await withLogprobs(screenshot, prompt);
    results.techniques.uncertaintyLogprobs = {
      score: logprobsResult.score,
      issues: logprobsResult.issues?.length || 0,
      cost: logprobsResult.estimatedCost?.totalCost || 0,
      latency: logprobsResult.responseTime || 0,
      uncertainty: logprobsResult.uncertainty || null,
      confidence: logprobsResult.confidence || null,
      improvement: logprobsResult.score !== null && results.techniques.baseline?.score !== null
        ? logprobsResult.score - results.techniques.baseline.score
        : null
    };
    console.log(`   Score: ${logprobsResult.score}/10, Uncertainty: ${logprobsResult.uncertainty?.toFixed(2) || 'N/A'}`);
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    results.techniques.uncertaintyLogprobs = { error: error.message };
  }

  // Technique 4: Bias Mitigation
  console.log('⚖️  Technique 4: Bias Mitigation...');
  try {
    const biasResult = await withBiasMitigation(screenshot, prompt);
    results.techniques.biasMitigation = {
      score: biasResult.score,
      issues: biasResult.issues?.length || 0,
      cost: biasResult.estimatedCost?.totalCost || 0,
      latency: biasResult.responseTime || 0,
      improvement: biasResult.score !== null && results.techniques.baseline?.score !== null
        ? biasResult.score - results.techniques.baseline.score
        : null
    };
    console.log(`   Score: ${biasResult.score}/10 (Δ: ${results.techniques.biasMitigation.improvement || 'N/A'})`);
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    results.techniques.biasMitigation = { error: error.message };
  }

  // Technique 5: Position Counter-Balancing
  console.log('🔄 Technique 5: Position Counter-Balancing...');
  try {
    const counterBalanceResult = await withCounterBalance(screenshot, prompt);
    results.techniques.positionCounterBalance = {
      score: counterBalanceResult.score,
      issues: counterBalanceResult.issues?.length || 0,
      cost: counterBalanceResult.estimatedCost?.totalCost || 0,
      latency: counterBalanceResult.responseTime || 0,
      improvement: counterBalanceResult.score !== null && results.techniques.baseline?.score !== null
        ? counterBalanceResult.score - results.techniques.baseline.score
        : null
    };
    console.log(`   Score: ${counterBalanceResult.score}/10 (Δ: ${results.techniques.positionCounterBalance.improvement || 'N/A'})`);
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    results.techniques.positionCounterBalance = { error: error.message };
  }

  // Calculate metrics vs ground truth if available
  if (groundTruth) {
    results.metrics = {};
    for (const [technique, result] of Object.entries(results.techniques)) {
      if (result.score !== null && result.score !== undefined) {
        const metrics = calculateAllMetrics(
          [{ score: result.score, issues: result.issues || [] }],
          [{ score: groundTruth.score, issues: groundTruth.issues || [] }]
        );
        results.metrics[technique] = metrics;
      }
    }
  }

  return results;
}

/**
 * Run full ablation study on dataset
 */
export async function runFullAblation(datasetPath = DATASET_FILE, limit = null) {
  console.log('🔬 Ablation Study Framework');
  console.log('=' .repeat(60));
  console.log('Testing each technique in isolation to measure actual impact\n');

  // Load dataset
  if (!existsSync(datasetPath)) {
    console.error(`❌ Dataset not found: ${datasetPath}`);
    console.log('💡 Create a dataset file with test cases and ground truth');
    return;
  }

  const dataset = JSON.parse(readFileSync(datasetPath, 'utf-8'));
  // Support both formats: array of test cases or object with samples/testCases
  let testCases = [];
  if (Array.isArray(dataset)) {
    testCases = dataset;
  } else if (dataset.samples) {
    // real-dataset.json format
    testCases = dataset.samples.map(sample => ({
      name: sample.name || sample.id,
      screenshot: sample.screenshot,
      prompt: sample.prompt || 'Evaluate this webpage for accessibility, design quality, and user experience',
      groundTruth: sample.groundTruth ? {
        score: sample.groundTruth.expectedScore ? 
          (sample.groundTruth.expectedScore.min + sample.groundTruth.expectedScore.max) / 2 : null,
        issues: sample.groundTruth.expectedIssues || []
      } : null
    }));
  } else if (dataset.testCases) {
    testCases = dataset.testCases;
  }
  
  const limitedCases = limit ? testCases.slice(0, limit) : testCases;

  console.log(`📊 Running ablation on ${limitedCases.length} test case(s)\n`);

  const allResults = [];
  for (let i = 0; i < limitedCases.length; i++) {
    const testCase = limitedCases[i];
    const groundTruth = testCase.groundTruth || null;
    
    try {
      const result = await runAblation(testCase, groundTruth);
      allResults.push(result);
    } catch (error) {
      console.error(`❌ Failed to run ablation on test case ${i}: ${error.message}`);
      allResults.push({
        testCase: testCase.name || `test-${i}`,
        error: error.message
      });
    }
  }

  // Aggregate results
  const summary = aggregateAblationResults(allResults);
  
  // Save results
  const timestamp = Date.now();
  const resultsFile = join(RESULTS_DIR, `ablation-${timestamp}.json`);
  writeFileSync(resultsFile, JSON.stringify({
    summary,
    results: allResults,
    timestamp: new Date().toISOString()
  }, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log('📊 Ablation Study Summary');
  console.log('='.repeat(60));
  printSummary(summary);
  console.log(`\n💾 Results saved to: ${resultsFile}`);

  return { summary, results: allResults };
}

/**
 * Aggregate ablation results across all test cases
 */
function aggregateAblationResults(allResults) {
  const summary = {
    techniques: {},
    totalTests: allResults.length,
    successfulTests: allResults.filter(r => !r.error).length
  };

  // Collect metrics for each technique
  for (const result of allResults) {
    if (result.error) continue;

    for (const [technique, data] of Object.entries(result.techniques || {})) {
      if (data.error) continue;

      if (!summary.techniques[technique]) {
        summary.techniques[technique] = {
          scores: [],
          improvements: [],
          costs: [],
          latencies: [],
          uncertainties: [],
          confidences: []
        };
      }

      if (data.score !== null && data.score !== undefined) {
        summary.techniques[technique].scores.push(data.score);
      }
      if (data.improvement !== null && data.improvement !== undefined) {
        summary.techniques[technique].improvements.push(data.improvement);
      }
      if (data.cost !== null && data.cost !== undefined) {
        summary.techniques[technique].costs.push(data.cost);
      }
      if (data.latency !== null && data.latency !== undefined) {
        summary.techniques[technique].latencies.push(data.latency);
      }
      if (data.uncertainty !== null && data.uncertainty !== undefined) {
        summary.techniques[technique].uncertainties.push(data.uncertainty);
      }
      if (data.confidence !== null && data.confidence !== undefined) {
        summary.techniques[technique].confidences.push(data.confidence);
      }
    }
  }

  // Calculate statistics
  for (const [technique, data] of Object.entries(summary.techniques)) {
    data.avgScore = data.scores.length > 0
      ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length
      : null;
    data.avgImprovement = data.improvements.length > 0
      ? data.improvements.reduce((a, b) => a + b, 0) / data.improvements.length
      : null;
    data.avgCost = data.costs.length > 0
      ? data.costs.reduce((a, b) => a + b, 0) / data.costs.length
      : null;
    data.avgLatency = data.latencies.length > 0
      ? data.latencies.reduce((a, b) => a + b, 0) / data.latencies.length
      : null;
    data.avgUncertainty = data.uncertainties.length > 0
      ? data.uncertainties.reduce((a, b) => a + b, 0) / data.uncertainties.length
      : null;
    data.avgConfidence = data.confidences.length > 0
      ? data.confidences.reduce((a, b) => a + b, 0) / data.confidences.length
      : null;
  }

  return summary;
}

/**
 * Print summary statistics
 */
function printSummary(summary) {
  console.log(`\nTotal Tests: ${summary.totalTests}`);
  console.log(`Successful: ${summary.successfulTests}`);

  console.log('\n📊 Technique Performance:');
  console.log('-'.repeat(60));

  const baseline = summary.techniques.baseline;
  if (baseline) {
    console.log(`\nBaseline:`);
    console.log(`  Avg Score: ${baseline.avgScore?.toFixed(2) || 'N/A'}`);
    console.log(`  Avg Cost: $${baseline.avgCost?.toFixed(4) || 'N/A'}`);
    console.log(`  Avg Latency: ${baseline.avgLatency?.toFixed(0) || 'N/A'}ms`);
  }

  for (const [technique, data] of Object.entries(summary.techniques)) {
    if (technique === 'baseline') continue;

    console.log(`\n${technique}:`);
    console.log(`  Avg Score: ${data.avgScore?.toFixed(2) || 'N/A'}`);
    if (data.avgImprovement !== null) {
      const sign = data.avgImprovement >= 0 ? '+' : '';
      console.log(`  Avg Improvement: ${sign}${data.avgImprovement.toFixed(2)} vs baseline`);
    }
    console.log(`  Avg Cost: $${data.avgCost?.toFixed(4) || 'N/A'}`);
    console.log(`  Avg Latency: ${data.avgLatency?.toFixed(0) || 'N/A'}ms`);
    if (data.avgUncertainty !== null) {
      console.log(`  Avg Uncertainty: ${data.avgUncertainty.toFixed(2)}`);
    }
    if (data.avgConfidence !== null) {
      console.log(`  Avg Confidence: ${data.avgConfidence.toFixed(2)}`);
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const limit = process.argv[2] ? parseInt(process.argv[2]) : null;
  runFullAblation(DATASET_FILE, limit)
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Ablation study failed:', error);
      process.exit(1);
    });
}

