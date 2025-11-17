#!/usr/bin/env node
/**
 * Consolidated Evaluation Runner
 * 
 * Main evaluation runner that:
 * 1. Uses proper statistical metrics (MAE, RMSE, Precision, Recall, F1)
 * 2. Validates against precise ground truth (not ranges)
 * 3. Reports confidence intervals and statistical significance
 * 4. Supports multiple datasets
 * 
 * This replaces the multiple overlapping runners with a single, well-designed one.
 */

import { validateScreenshot, createConfig } from '../../src/index.mjs';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
  calculateAllMetrics,
  calculateMAE,
  calculateRMSE,
  calculatePrecision,
  calculateRecall,
  calculateF1Score,
  calculateConfusionMatrix,
  calculateCorrelation,
  formatMetrics
} from '../utils/metrics.mjs';
import { filterIssues } from '../utils/issue-filter.mjs';

const RESULTS_DIR = join(process.cwd(), 'evaluation', 'results');

/**
 * Validate against precise ground truth
 */
function validateAgainstGroundTruth(result, groundTruth) {
  const validation = {
    score: null,
    issues: null,
    features: null,
    overall: { valid: true, errors: [] }
  };

  // Score validation (precise, not range)
  if (groundTruth.preciseScore !== undefined && result.score !== null) {
    const tolerance = groundTruth.scoreTolerance || 1.0;
    const error = Math.abs(result.score - groundTruth.preciseScore);
    validation.score = {
      predicted: result.score,
      actual: groundTruth.preciseScore,
      error,
      withinTolerance: error <= tolerance,
      tolerance
    };
    
    if (error > tolerance) {
      validation.overall.valid = false;
      validation.overall.errors.push(`Score error ${error.toFixed(2)} exceeds tolerance ${tolerance}`);
    }
  }

  // Issue validation (structured matching with keyword-based semantic matching)
  if (groundTruth.structuredIssues && Array.isArray(groundTruth.structuredIssues)) {
    // Filter issues to reduce false positives
    const rawIssues = result.issues || [];
    const filteredIssues = filterIssues(rawIssues);
    
    const detectedIssues = filteredIssues.map(i => i.toLowerCase().trim()).filter(i => i.length > 0);
    const expectedIssues = groundTruth.structuredIssues.map(i => i.toLowerCase().trim()).filter(i => i.length > 0);
    
    // Extract keywords from text (remove markdown, punctuation, common words)
    function extractKeywords(text) {
      // Remove markdown formatting
      text = text.replace(/\*\*?/g, '').replace(/#{1,6}\s*/g, '').replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
      // Remove punctuation, split into words
      const words = text.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);
      // Remove common stop words
      const stopWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use']);
      return words.filter(w => !stopWords.has(w));
    }
    
    // Calculate keyword overlap between two texts
    function keywordOverlap(text1, text2) {
      const keywords1 = new Set(extractKeywords(text1));
      const keywords2 = new Set(extractKeywords(text2));
      if (keywords1.size === 0 || keywords2.size === 0) return 0;
      const intersection = [...keywords1].filter(k => keywords2.has(k)).length;
      const union = keywords1.size + keywords2.size - intersection;
      return union > 0 ? intersection / union : 0; // Jaccard similarity
    }
    
    // Exact matches
    const detectedSet = new Set(detectedIssues);
    const expectedSet = new Set(expectedIssues);
    
    const exactTP = [...expectedSet].filter(i => detectedSet.has(i)).length;
    const exactFP = [...detectedSet].filter(i => !expectedSet.has(i)).length;
    const exactFN = [...expectedSet].filter(i => !detectedSet.has(i)).length;
    
    // Substring matches (original fuzzy matching)
    const substringTP = expectedIssues.filter(expected => 
      detectedIssues.some(detected => 
        detected.includes(expected) || expected.includes(detected)
      )
    ).length;
    
    // Keyword-based semantic matches (improved)
    // Match if key terms appear in both (more lenient than Jaccard)
    // Extract key terms (important words) from ground truth
    function extractKeyTerms(text) {
      const keywords = extractKeywords(text);
      // Prioritize important accessibility/design terms
      const importantTerms = ['contrast', 'color', 'wcag', 'accessibility', 'alt', 'text', 'image', 'keyboard', 'navigation', 'screen', 'reader', 'aria', 'semantic', 'html', 'design', 'layout', 'typography', 'readability'];
      return keywords.filter(k => importantTerms.some(term => k.includes(term) || term.includes(k)) || keywords.length <= 5);
    }
    
    // Match if at least 2 key terms overlap OR Jaccard > 0.15
    const keywordTP = expectedIssues.filter(expected => {
      const expectedTerms = extractKeyTerms(expected);
      return detectedIssues.some(detected => {
        const detectedTerms = extractKeyTerms(detected);
        const termOverlap = expectedTerms.filter(term => 
          detectedTerms.some(dt => dt.includes(term) || term.includes(dt))
        ).length;
        const jaccard = keywordOverlap(expected, detected);
        // Match if 2+ key terms overlap OR Jaccard > 15%
        return termOverlap >= 2 || jaccard >= 0.15;
      });
    }).length;
    
    const keywordFP = detectedIssues.filter(detected => {
      const detectedTerms = extractKeyTerms(detected);
      return !expectedIssues.some(expected => {
        const expectedTerms = extractKeyTerms(expected);
        const termOverlap = expectedTerms.filter(term => 
          detectedTerms.some(dt => dt.includes(term) || term.includes(dt))
        ).length;
        const jaccard = keywordOverlap(expected, detected);
        return termOverlap >= 2 || jaccard >= 0.15;
      });
    }).length;
    
    const keywordFN = expectedIssues.filter(expected => {
      const expectedTerms = extractKeyTerms(expected);
      return !detectedIssues.some(detected => {
        const detectedTerms = extractKeyTerms(detected);
        const termOverlap = expectedTerms.filter(term => 
          detectedTerms.some(dt => dt.includes(term) || term.includes(dt))
        ).length;
        const jaccard = keywordOverlap(expected, detected);
        return termOverlap >= 2 || jaccard >= 0.15;
      });
    }).length;
    
    // Use keyword-based matching (more robust than substring)
    const truePositives = keywordTP;
    const falsePositives = keywordFP;
    const falseNegatives = keywordFN;
    
    validation.issues = {
      truePositives,
      falsePositives,
      falseNegatives,
      exactTP,
      exactFP,
      exactFN,
      substringTP,
      substringFP: detectedIssues.length - substringTP - keywordTP,
      substringFN: expectedIssues.length - substringTP - keywordTP,
      keywordTP,
      keywordFP,
      keywordFN,
      precision: truePositives + falsePositives > 0 
        ? truePositives / (truePositives + falsePositives) 
        : (expectedIssues.length === 0 && detectedIssues.length === 0 ? 1 : 0), // Perfect if both empty
      recall: truePositives + falseNegatives > 0
        ? truePositives / (truePositives + falseNegatives)
        : (expectedIssues.length === 0 ? 1 : 0), // Perfect recall if no expected issues
      f1: 0
    };
    
    if (validation.issues.precision + validation.issues.recall > 0) {
      validation.issues.f1 = 2 * (validation.issues.precision * validation.issues.recall) / 
        (validation.issues.precision + validation.issues.recall);
    }
  }

  // Feature validation (structured features)
  if (groundTruth.structuredFeatures && result.assessment) {
    const featureMatches = {};
    const assessmentLower = result.assessment.toLowerCase();
    
    for (const [feature, expected] of Object.entries(groundTruth.structuredFeatures)) {
      if (typeof expected === 'object' && expected.level) {
        featureMatches[feature] = {
          expected: expected.level,
          detected: assessmentLower.includes(expected.level) || 
                   assessmentLower.includes(feature),
          match: assessmentLower.includes(expected.level)
        };
      }
    }
    
    validation.features = featureMatches;
  }

  return validation;
}

/**
 * Evaluate a single sample
 */
async function evaluateSample(sample, options = {}) {
  const { provider = null, prompt = null, useCache = true } = options;
  
  // Check if we can evaluate via URL (screenshot-less mode)
  if (!sample.screenshot || !existsSync(sample.screenshot)) {
    if (sample.url) {
      // Try URL-based evaluation
      try {
        const { evaluateUrlSample } = await import('../utils/url-evaluator.mjs');
        return await evaluateUrlSample(sample, { provider, prompt, useCache });
      } catch (error) {
        // Fall through to error if URL evaluation fails
        return {
          sampleId: sample.id,
          success: false,
          error: `Screenshot not found and URL evaluation failed: ${error.message}`
        };
      }
    }
    
    return {
      sampleId: sample.id,
      success: false,
      error: 'Screenshot not found and no URL provided'
    };
  }

  const defaultPrompt = `Evaluate this webpage for quality, accessibility, and design.
Check for:
- Visual design and aesthetics
- Functional correctness
- Usability and clarity
- Accessibility compliance (WCAG)
- Color contrast
- Keyboard navigation
- Screen reader compatibility

Provide a score from 0-10 and list any issues found.`;

  try {
    const result = await validateScreenshot(
      sample.screenshot,
      prompt || defaultPrompt,
      {
        testType: 'evaluation',
        viewport: sample.metadata?.viewport || sample.viewport || { width: 1280, height: 720 },
        provider,
        useCache: useCache !== false // Default to true, but allow disabling
      }
    );

    // Validate against ground truth
    const validation = sample.groundTruth 
      ? validateAgainstGroundTruth(result, sample.groundTruth)
      : null;

    // Filter issues to reduce false positives
    const filteredIssues = filterIssues(result.issues || []);
    
    return {
      sampleId: sample.id,
      success: true,
      result: {
        score: result.score,
        issues: filteredIssues,
        rawIssues: result.issues || [], // Keep original for analysis
        assessment: result.assessment,
        reasoning: result.reasoning
      },
      groundTruth: sample.groundTruth || null,
      validation,
      metadata: {
        provider: result.provider,
        cached: result.cached,
        responseTime: result.responseTime,
        estimatedCost: result.estimatedCost
      }
    };
  } catch (error) {
    return {
      sampleId: sample.id,
      success: false,
      error: error.message
    };
  }
}

/**
 * Calculate comprehensive metrics from evaluations
 */
function calculateEvaluationMetrics(evaluations) {
  const successful = evaluations.filter(e => e.success && e.validation);
  
  if (successful.length === 0) {
    return {
      error: 'No successful evaluations with ground truth',
      sampleSize: 0
    };
  }

  // Score metrics
  const scores = {
    predictions: [],
    actual: [],
    errors: []
  };

  // Issue metrics
  const issueMetrics = {
    allPrecision: [],
    allRecall: [],
    allF1: []
  };

  successful.forEach(evaluation => {
    if (evaluation.validation?.score) {
      scores.predictions.push(evaluation.result.score);
      scores.actual.push(evaluation.validation.score.actual);
      scores.errors.push(evaluation.validation.score.error);
    }
    
    if (evaluation.validation?.issues) {
      issueMetrics.allPrecision.push(evaluation.validation.issues.precision);
      issueMetrics.allRecall.push(evaluation.validation.issues.recall);
      issueMetrics.allF1.push(evaluation.validation.issues.f1);
    }
  });

  const metrics = {
    sampleSize: successful.length,
    scoreMetrics: scores.predictions.length > 0 ? {
      mae: calculateMAE(scores.predictions, scores.actual),
      rmse: calculateRMSE(scores.predictions, scores.actual),
      correlation: calculateCorrelation(scores.predictions, scores.actual),
      meanError: scores.errors.reduce((a, b) => a + b, 0) / scores.errors.length,
      withinTolerance: successful.filter(e => e.validation?.score?.withinTolerance).length / successful.length
    } : null,
    issueMetrics: issueMetrics.allPrecision.length > 0 ? {
      meanPrecision: issueMetrics.allPrecision.reduce((a, b) => a + b, 0) / issueMetrics.allPrecision.length,
      meanRecall: issueMetrics.allRecall.reduce((a, b) => a + b, 0) / issueMetrics.allRecall.length,
      meanF1: issueMetrics.allF1.reduce((a, b) => a + b, 0) / issueMetrics.allF1.length
    } : null,
    confidence: {
      // Simple confidence interval (95% CI for mean error)
      scoreErrorCI: scores.errors.length > 0 ? (() => {
        const n = scores.errors.length;
        const mean = scores.errors.reduce((a, b) => a + b, 0) / n;
        // Calculate variance correctly (single pass, after mean is known)
        const variance = scores.errors.reduce((sum, e) => sum + Math.pow(e - mean, 2), 0) / n;
        const stdDev = Math.sqrt(variance);
        
        // Use t-distribution for small samples, z-distribution for large
        // t-values for 95% CI: n=2:12.71, n=3:4.30, n=5:2.78, n=10:2.26, n=30:2.04, n→∞:1.96
        const tValues = {
          2: 12.71, 3: 4.30, 4: 3.18, 5: 2.78, 6: 2.57, 7: 2.45, 8: 2.36, 9: 2.31, 10: 2.26,
          15: 2.14, 20: 2.09, 25: 2.06, 30: 2.04
        };
        const tValue = n <= 30 ? (tValues[n] || 2.0) : 1.96; // Default to 2.0 for unknown small n, 1.96 for large n
        
        const margin = tValue * (stdDev / Math.sqrt(n));
        
        return {
          mean,
          stdDev,
          variance,
          n,
          tValue,
          lower95: mean - margin,
          upper95: mean + margin,
          margin
        };
      })() : null
    }
  };

  return metrics;
}

/**
 * Load dataset using adapters (preferred) or fallback to JSON
 */
async function loadDataset(datasetNameOrPath, options = {}) {
  const { limit = null } = options;
  
  // Try adapter first (if it's a dataset name)
  try {
    const { loadDataset: loadWithAdapter, listAvailableDatasets } = await import('../utils/dataset-adapters.mjs');
    const available = listAvailableDatasets();
    
    // Check if it matches any adapter name
    const datasetName = available.find(d => {
      const input = datasetNameOrPath.toLowerCase();
      return d.name === input || input.includes(d.name) || d.name.includes(input);
    });
    
    if (datasetName && datasetName.available) {
      console.log(`📦 Using adapter for ${datasetName.name}`);
      return await loadWithAdapter(datasetName.name, { limit });
    }
  } catch (error) {
    // Adapter not available, fall back to JSON
    console.log(`⚠️  Adapter not available, falling back to JSON: ${error.message}`);
  }
  
  // Fallback: Load from JSON file (legacy support)
  const datasetPath = datasetNameOrPath.includes('/') || datasetNameOrPath.includes('\\')
    ? datasetNameOrPath
    : join(process.cwd(), 'evaluation', 'datasets', datasetNameOrPath);
  
  if (!existsSync(datasetPath)) {
    throw new Error(`Dataset not found: ${datasetPath}. Use adapter name (webui, screenai, wcag) or provide full path.`);
  }
  
  const data = JSON.parse(readFileSync(datasetPath, 'utf-8'));
  
  // Support both old and new formats
  if (data.samples) {
    return data;
  } else if (Array.isArray(data)) {
    return { samples: data };
  } else {
    throw new Error('Invalid dataset format');
  }
}

/**
 * Main evaluation function
 */
async function runEvaluation(options = {}) {
  const {
    dataset = 'real-dataset.json',
    limit = null,
    provider = null,
    prompt = null,
    outputFile = null,
    useCache = true
  } = options;

  console.log('🔬 Evaluation Runner (Consolidated)');
  console.log('='.repeat(60));
  console.log(`📊 Dataset: ${dataset}`);
  console.log(`📁 Results: ${RESULTS_DIR}\n`);

  // Check configuration
  const config = createConfig({ provider });
  if (!config.enabled) {
    console.error('❌ VLLM validation is disabled. Set GEMINI_API_KEY or OPENAI_API_KEY');
    process.exit(1);
  }

  console.log(`✅ Provider: ${config.provider}\n`);

  // Load dataset (using adapter if available, otherwise JSON)
  // Note: limit is passed to adapter, so no need to slice again if adapter was used
  let datasetData;
  try {
    datasetData = await loadDataset(dataset, { limit });
  } catch (error) {
    console.error(`❌ Failed to load dataset: ${error.message}`);
    console.error(`   Available adapters: webui, screenai, wcag, real`);
    console.error(`   Or provide full path to JSON file`);
    process.exit(1);
  }

  // If adapter was used, samples are already limited. If JSON fallback, apply limit here.
  const samples = datasetData.adapter 
    ? datasetData.samples  // Adapter already applied limit
    : (limit ? datasetData.samples.slice(0, limit) : datasetData.samples);
  
  // Show dataset info
  if (datasetData.adapter) {
    console.log(`📦 Dataset loaded via ${datasetData.adapter}`);
    console.log(`   Total available: ${datasetData.totalAvailable || 'unknown'}`);
    console.log(`   Loaded: ${datasetData.loaded} samples`);
    if (datasetData.totalAvailable && datasetData.loaded < datasetData.totalAvailable) {
      console.log(`   💡 Use --limit to load more samples (up to ${datasetData.totalAvailable})`);
    }
  } else {
    console.log(`📊 Dataset: ${datasetData.name || 'Unknown'}`);
  }
  console.log(`📊 Evaluating ${samples.length} samples...\n`);

  // Run evaluations
  const results = [];
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    console.log(`[${i + 1}/${samples.length}] ${sample.id || sample.name || 'sample'}`);
    
    const evaluation = await evaluateSample(sample, { provider, prompt, useCache });
    results.push(evaluation);
    
    if (evaluation.success && evaluation.validation?.score) {
      const score = evaluation.validation.score;
      const status = score.withinTolerance ? '✅' : '❌';
      console.log(`   ${status} Score: ${score.predicted.toFixed(2)} (actual: ${score.actual}, error: ${score.error.toFixed(2)})`);
    } else if (evaluation.success) {
      console.log(`   ✅ Score: ${evaluation.result.score?.toFixed(2) || 'N/A'}`);
    } else {
      console.log(`   ❌ Error: ${evaluation.error}`);
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Calculate metrics
  const metrics = calculateEvaluationMetrics(results);
  
  // Prepare final results
  const finalResults = {
    timestamp: new Date().toISOString(),
    dataset: {
      name: datasetData.name || dataset,
      adapter: datasetData.adapter || null,
      totalAvailable: datasetData.totalAvailable || null,
      totalSamples: datasetData.samples?.length || 0,
      evaluated: samples.length,
      options: datasetData.options || null
    },
    config: {
      provider: config.provider,
      limit
    },
    results,
    metrics,
    summary: {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      withGroundTruth: results.filter(r => r.validation).length
    }
  };

  // Save results
  const resultsFile = outputFile || join(RESULTS_DIR, `evaluation-${Date.now()}.json`);
  writeFileSync(resultsFile, JSON.stringify(finalResults, null, 2));

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Evaluation Summary');
  console.log('='.repeat(60));
  console.log(`Total: ${finalResults.summary.total}`);
  console.log(`Successful: ${finalResults.summary.successful}`);
  console.log(`With Ground Truth: ${finalResults.summary.withGroundTruth}`);
  
  if (metrics.scoreMetrics) {
    console.log(`\nScore Metrics:`);
    console.log(`  MAE: ${metrics.scoreMetrics.mae.toFixed(3)}`);
    console.log(`  RMSE: ${metrics.scoreMetrics.rmse.toFixed(3)}`);
    console.log(`  Correlation: ${metrics.scoreMetrics.correlation?.toFixed(3) || 'N/A'}`);
    console.log(`  Within Tolerance: ${(metrics.scoreMetrics.withinTolerance * 100).toFixed(1)}%`);
    
    if (metrics.confidence.scoreErrorCI) {
      const ci = metrics.confidence.scoreErrorCI;
      console.log(`  Mean Error: ${ci.mean.toFixed(3)} (95% CI: ${ci.lower95.toFixed(3)} - ${ci.upper95.toFixed(3)})`);
    }
  }
  
  if (metrics.issueMetrics) {
    console.log(`\nIssue Detection:`);
    console.log(`  Precision: ${(metrics.issueMetrics.meanPrecision * 100).toFixed(1)}%`);
    console.log(`  Recall: ${(metrics.issueMetrics.meanRecall * 100).toFixed(1)}%`);
    console.log(`  F1: ${(metrics.issueMetrics.meanF1 * 100).toFixed(1)}%`);
  }
  
  console.log(`\n💾 Results saved to: ${resultsFile}`);
  
  // Show scaling info if adapter was used
  if (datasetData.adapter && datasetData.totalAvailable) {
    console.log(`\n💡 Dataset Scaling:`);
    console.log(`   Total available: ${datasetData.totalAvailable} samples`);
    console.log(`   Evaluated: ${samples.length} samples`);
    if (datasetData.totalAvailable > samples.length) {
      console.log(`   To evaluate more: use --limit ${Math.min(datasetData.totalAvailable, samples.length + 100)}`);
      console.log(`   To evaluate all: use --limit ${datasetData.totalAvailable} or omit --limit`);
    }
  }
  
  // Warning for small sample sizes
  if (metrics.sampleSize < 30) {
    console.log(`\n⚠️  Warning: Small sample size (${metrics.sampleSize}). Results may not be statistically significant.`);
    console.log(`   For proper validation, use datasets with 100+ samples (e.g., ScreenAI, WebUI).`);
  }

  return finalResults;
}

// Run if called directly (basic CLI support)
// For full CLI with help, use evaluate-cli.mjs
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const options = {
    dataset: args.find(a => a.startsWith('--dataset='))?.split('=')[1] || 
              args[args.indexOf('--dataset') + 1] || 'real',
    limit: args.find(a => a.startsWith('--limit='))?.split('=')[1] ? 
           parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1]) : 
           (args[args.indexOf('--limit') + 1] ? parseInt(args[args.indexOf('--limit') + 1]) : null),
    provider: args.find(a => a.startsWith('--provider='))?.split('=')[1] || 
              args[args.indexOf('--provider') + 1] || null
  };
  
  runEvaluation(options).catch(error => {
    console.error('❌ Evaluation failed:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  });
}

export { runEvaluation, evaluateSample, validateAgainstGroundTruth, calculateEvaluationMetrics };

