#!/usr/bin/env node
/**
 * Run Real Evaluation
 * 
 * Runs comprehensive evaluation on the real dataset we just created.
 */

import { validateScreenshot, createConfig, aggregateTemporalNotes, formatNotesForPrompt } from '../../src/index.mjs';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { calculateAllMetrics, formatMetrics } from '../utils/metrics.mjs';
import { compareProviders, analyzeMethodDifferences, generateComparisonReport } from '../analysis/method-comparison.mjs';

const RESULTS_DIR = join(process.cwd(), 'evaluation', 'results');
const DATASET_FILE = join(process.cwd(), 'evaluation', 'datasets', 'real-dataset.json');

/**
 * Evaluate a single sample
 */
async function evaluateSample(sample, options = {}) {
  const { provider = null, compareWithOtherProviders = false } = options;
  
  if (!sample.screenshot || !existsSync(sample.screenshot)) {
    return {
      sampleId: sample.id,
      success: false,
      error: 'Screenshot not found'
    };
  }
  
  const prompt = `Evaluate this webpage screenshot comprehensively:

QUALITY & DESIGN:
- Visual design and aesthetics
- Layout clarity and organization
- Typography and readability
- Color scheme and visual hierarchy

FUNCTIONALITY:
- Functional correctness
- Usability and clarity
- User experience quality

ACCESSIBILITY (WCAG):
- Color contrast (should be ≥4.5:1 for normal text, ≥3:1 for large text)
- Keyboard navigation support
- Screen reader compatibility
- Alt text for images
- Semantic HTML structure

Provide:
1. A score from 0-10 (where 10 is perfect)
2. A list of specific issues found
3. Brief assessment and reasoning

Be thorough and specific.`;
  
  try {
    const result = await validateScreenshot(
      sample.screenshot,
      prompt,
      {
        testType: 'comprehensive-evaluation',
        viewport: sample.metadata?.viewport || { width: 1280, height: 720 }
      }
    );
    
    const evaluation = {
      sampleId: sample.id,
      sampleName: sample.name,
      url: sample.url,
      success: true,
      result: {
        score: result.score,
        issues: result.issues || [],
        assessment: result.assessment,
        reasoning: result.reasoning
      },
      groundTruth: sample.groundTruth || {},
      metadata: {
        provider: result.provider,
        cached: result.cached,
        responseTime: result.responseTime,
        estimatedCost: result.estimatedCost
      }
    };
    
    // Compare with other providers if requested
    if (compareWithOtherProviders) {
      console.log(`   🔄 Comparing with other providers...`);
      const comparisons = await compareProviders(sample.screenshot, prompt, {
        testType: 'comprehensive-evaluation',
        viewport: sample.metadata?.viewport || { width: 1280, height: 720 }
      });
      evaluation.providerComparisons = comparisons;
    }
    
    return evaluation;
  } catch (error) {
    return {
      sampleId: sample.id,
      success: false,
      error: error.message
    };
  }
}

/**
 * Main evaluation function
 */
async function runRealEvaluation() {
  console.log('🚀 Running Real-World Evaluation\n');
  
  // Check configuration
  const config = createConfig();
  if (!config.enabled) {
    console.error('❌ VLLM validation is disabled. Set GEMINI_API_KEY or OPENAI_API_KEY');
    process.exit(1);
  }
  
  console.log(`✅ Using provider: ${config.provider}\n`);
  
  // Load dataset
  if (!existsSync(DATASET_FILE)) {
    console.error(`❌ Dataset not found: ${DATASET_FILE}`);
    console.error('   Run: node evaluation/capture-real-dataset.mjs first');
    process.exit(1);
  }
  
  const dataset = JSON.parse(readFileSync(DATASET_FILE, 'utf-8'));
  console.log(`📊 Dataset: ${dataset.name}`);
  console.log(`   Samples: ${dataset.samples.length}\n`);
  
  // Evaluate each sample
  const results = [];
  for (let i = 0; i < dataset.samples.length; i++) {
    const sample = dataset.samples[i];
    console.log(`[${i + 1}/${dataset.samples.length}] Evaluating: ${sample.name}`);
    console.log(`   URL: ${sample.url}`);
    
    try {
      const evaluation = await evaluateSample(sample, {
        compareWithOtherProviders: false // Set to true to compare providers (slower)
      });
      
      results.push(evaluation);
      
      if (evaluation.success) {
        console.log(`   ✅ Score: ${evaluation.result.score !== null ? evaluation.result.score.toFixed(2) : 'N/A'}/10`);
        console.log(`   📋 Issues: ${evaluation.result.issues.length}`);
        if (evaluation.result.issues.length > 0) {
          evaluation.result.issues.slice(0, 3).forEach(issue => {
            console.log(`      - ${issue.substring(0, 60)}${issue.length > 60 ? '...' : ''}`);
          });
        }
        
        // Compare with ground truth
        if (evaluation.groundTruth.expectedScore) {
          const expectedMin = evaluation.groundTruth.expectedScore.min;
          const expectedMax = evaluation.groundTruth.expectedScore.max;
          const actualScore = evaluation.result.score;
          
          if (actualScore !== null) {
            const inRange = actualScore >= expectedMin && actualScore <= expectedMax;
            console.log(`   🎯 Expected: ${expectedMin}-${expectedMax}, Actual: ${actualScore.toFixed(2)} ${inRange ? '✅' : '❌'}`);
          }
        }
      } else {
        console.log(`   ❌ Error: ${evaluation.error}`);
      }
      
      console.log('');
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`   ❌ Failed: ${error.message}\n`);
      results.push({
        sampleId: sample.id,
        success: false,
        error: error.message
      });
    }
  }
  
  // Calculate metrics
  const successful = results.filter(r => r.success);
  const metrics = calculateAllMetrics(successful);
  
  // Analyze method differences if we have provider comparisons
  const allComparisons = {};
  successful.forEach(r => {
    if (r.providerComparisons) {
      allComparisons[r.sampleId] = r.providerComparisons;
    }
  });
  
  let methodAnalysis = null;
  if (Object.keys(allComparisons).length > 0) {
    methodAnalysis = analyzeMethodDifferences({ providers: allComparisons });
  }
  
  // Prepare final results
  const finalResults = {
    timestamp: new Date().toISOString(),
    dataset: dataset.name,
    config: {
      provider: config.provider,
      totalSamples: dataset.samples.length
    },
    results: results,
    metrics: metrics,
    methodComparison: methodAnalysis,
    summary: {
      total: results.length,
      successful: successful.length,
      failed: results.filter(r => !r.success).length,
      averageScore: successful.length > 0
        ? (successful.reduce((sum, r) => sum + (r.result?.score || 0), 0) / successful.length).toFixed(2)
        : 'N/A'
    }
  };
  
  // Save results
  const resultsFile = join(RESULTS_DIR, `real-evaluation-${Date.now()}.json`);
  writeFileSync(resultsFile, JSON.stringify(finalResults, null, 2));
  
  // Print summary
  console.log('📊 Evaluation Summary');
  console.log('='.repeat(50));
  console.log(`Total samples: ${results.length}`);
  console.log(`Successful: ${successful.length}`);
  console.log(`Failed: ${results.filter(r => !r.success).length}`);
  console.log(`Average score: ${finalResults.summary.averageScore}/10`);
  console.log('');
  console.log(formatMetrics(metrics));
  console.log('');
  console.log(`💾 Results saved to: ${resultsFile}`);
  
  // Print method comparison if available
  if (methodAnalysis) {
    console.log('');
    console.log(generateComparisonReport(allComparisons, methodAnalysis));
  }
  
  return finalResults;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runRealEvaluation().catch(console.error);
}

export { runRealEvaluation, evaluateSample };

