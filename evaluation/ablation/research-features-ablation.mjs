/**
 * Research Features Ablation Study
 * 
 * Systematically tests each research feature to measure actual impact:
 * - TemporalDecisionManager (98.5% reduction claim)
 * - EnsembleJudge (10-20% improvement claim)
 * - Multi-Scale Aggregation (coherence improvement)
 * - Human Perception Time (persona experience improvement)
 * - Temporal Preprocessing (latency reduction)
 * - Entity Extraction Caching (cache hit rates)
 * 
 * Metrics collected:
 * - LLM call count
 * - Accuracy (vs. ground truth)
 * - Latency (ms)
 * - Cost ($)
 * - Cache hit rates
 */

import { validateScreenshot } from '../../src/index.mjs';
import { testGameplay } from '../../src/convenience.mjs';
import { aggregateMultiScale } from '../../src/temporal-decision.mjs';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { CostTracker } from '../../src/cost-tracker.mjs';

const RESULTS_DIR = join(process.cwd(), 'evaluation', 'results', 'ablation');
const METRICS_FILE = join(RESULTS_DIR, 'research-features-metrics.json');

// Initialize results directory
if (!existsSync(RESULTS_DIR)) {
  const { mkdirSync } = await import('fs');
  mkdirSync(RESULTS_DIR, { recursive: true });
}

/**
 * Metrics collector for ablation studies
 */
class AblationMetrics {
  constructor() {
    this.metrics = {
      temporalDecision: { with: [], without: [] },
      ensemble: { with: [], without: [] },
      multiScale: { with: [], without: [] },
      humanPerception: { with: [], without: [] },
      temporalPreprocessing: { with: [], without: [] },
      entityCaching: { with: [], without: [] }
    };
    this.costTracker = new CostTracker();
  }

  record(feature, variant, metrics) {
    if (!this.metrics[feature]) {
      this.metrics[feature] = { with: [], without: [] };
    }
    this.metrics[feature][variant].push({
      ...metrics,
      timestamp: Date.now()
    });
  }

  save() {
    writeFileSync(METRICS_FILE, JSON.stringify(this.metrics, null, 2));
  }

  getSummary() {
    const summary = {};
    for (const [feature, data] of Object.entries(this.metrics)) {
      const withData = data.with || [];
      const withoutData = data.without || [];
      
      if (withData.length > 0 && withoutData.length > 0) {
        const withAvg = {
          llmCalls: withData.reduce((sum, m) => sum + (m.llmCalls || 0), 0) / withData.length,
          accuracy: withData.reduce((sum, m) => sum + (m.accuracy || 0), 0) / withData.length,
          latency: withData.reduce((sum, m) => sum + (m.latency || 0), 0) / withData.length,
          cost: withData.reduce((sum, m) => sum + (m.cost || 0), 0) / withData.length
        };
        
        const withoutAvg = {
          llmCalls: withoutData.reduce((sum, m) => sum + (m.llmCalls || 0), 0) / withoutData.length,
          accuracy: withoutData.reduce((sum, m) => sum + (m.accuracy || 0), 0) / withoutData.length,
          latency: withoutData.reduce((sum, m) => sum + (m.latency || 0), 0) / withoutData.length,
          cost: withoutData.reduce((sum, m) => sum + (m.cost || 0), 0) / withoutData.length
        };
        
        summary[feature] = {
          improvement: {
            llmCalls: ((withoutAvg.llmCalls - withAvg.llmCalls) / withoutAvg.llmCalls * 100).toFixed(2) + '%',
            accuracy: ((withAvg.accuracy - withoutAvg.accuracy) / withoutAvg.accuracy * 100).toFixed(2) + '%',
            latency: ((withoutAvg.latency - withAvg.latency) / withoutAvg.latency * 100).toFixed(2) + '%',
            cost: ((withoutAvg.cost - withAvg.cost) / withoutAvg.cost * 100).toFixed(2) + '%'
          },
          with: withAvg,
          without: withoutAvg
        };
      }
    }
    return summary;
  }
}

const metrics = new AblationMetrics();

/**
 * Test TemporalDecisionManager impact
 */
export async function testTemporalDecisionManager(samples = []) {
  console.log('\n🔬 Testing TemporalDecisionManager...\n');
  
  for (const sample of samples) {
    if (!sample.screenshot || !existsSync(sample.screenshot)) continue;
    
    // Without TemporalDecisionManager
    const startWithout = Date.now();
    const resultWithout = await validateScreenshot(
      sample.screenshot,
      sample.prompt || 'Evaluate this screenshot',
      {
        testType: 'ablation-temporal-decision',
        temporalNotes: sample.temporalNotes || []
      }
    );
    const latencyWithout = Date.now() - startWithout;
    
    // With TemporalDecisionManager
    const startWith = Date.now();
    const resultWith = await validateScreenshot(
      sample.screenshot,
      sample.prompt || 'Evaluate this screenshot',
      {
        testType: 'ablation-temporal-decision',
        temporalNotes: sample.temporalNotes || [],
        useTemporalDecision: true,
        currentState: { score: resultWithout.score },
        previousState: sample.previousState || null
      }
    );
    const latencyWith = Date.now() - startWith;
    
    // Count LLM calls (approximate: 1 call per validation, unless skipped)
    const llmCallsWithout = 1;
    const llmCallsWith = resultWith.skipped ? 0 : 1;
    
    metrics.record('temporalDecision', 'without', {
      llmCalls: llmCallsWithout,
      accuracy: sample.groundTruth ? Math.abs(resultWithout.score - sample.groundTruth.score) : null,
      latency: latencyWithout,
      cost: resultWithout.estimatedCost?.total || 0
    });
    
    metrics.record('temporalDecision', 'with', {
      llmCalls: llmCallsWith,
      accuracy: sample.groundTruth ? Math.abs(resultWith.score - sample.groundTruth.score) : null,
      latency: latencyWith,
      cost: resultWith.estimatedCost?.total || 0
    });
  }
  
  metrics.save();
  return metrics.getSummary().temporalDecision;
}

/**
 * Test EnsembleJudge impact
 */
export async function testEnsembleJudge(samples = []) {
  console.log('\n🔬 Testing EnsembleJudge...\n');
  
  for (const sample of samples) {
    if (!sample.screenshot || !existsSync(sample.screenshot)) continue;
    
    // Without EnsembleJudge (single provider)
    const startWithout = Date.now();
    const resultWithout = await validateScreenshot(
      sample.screenshot,
      sample.prompt || 'Evaluate this screenshot',
      {
        testType: 'ablation-ensemble',
        useEnsemble: false
      }
    );
    const latencyWithout = Date.now() - startWithout;
    
    // With EnsembleJudge (multiple providers)
    const startWith = Date.now();
    const resultWith = await validateScreenshot(
      sample.screenshot,
      sample.prompt || 'Evaluate this screenshot',
      {
        testType: 'ablation-ensemble',
        useEnsemble: true,
        ensembleProviders: ['gemini', 'openai']
      }
    );
    const latencyWith = Date.now() - startWith;
    
    // Count LLM calls (ensemble = multiple providers)
    const llmCallsWithout = 1;
    const llmCallsWith = 2; // gemini + openai
    
    metrics.record('ensemble', 'without', {
      llmCalls: llmCallsWithout,
      accuracy: sample.groundTruth ? Math.abs(resultWithout.score - sample.groundTruth.score) : null,
      latency: latencyWithout,
      cost: resultWithout.estimatedCost?.total || 0
    });
    
    metrics.record('ensemble', 'with', {
      llmCalls: llmCallsWith,
      accuracy: sample.groundTruth ? Math.abs(resultWith.score - sample.groundTruth.score) : null,
      latency: latencyWith,
      cost: resultWith.estimatedCost?.total || 0
    });
  }
  
  metrics.save();
  return metrics.getSummary().ensemble;
}

/**
 * Test Multi-Scale Aggregation impact
 */
export async function testMultiScaleAggregation(samples = []) {
  console.log('\n🔬 Testing Multi-Scale Aggregation...\n');
  
  for (const sample of samples) {
    if (!sample.temporalNotes || sample.temporalNotes.length === 0) continue;
    
    // Without multi-scale (single-scale aggregation)
    const startWithout = Date.now();
    const { aggregateTemporalNotes } = await import('../../src/temporal.mjs');
    const aggregatedWithout = aggregateTemporalNotes(sample.temporalNotes, {
      windowSize: 10000
    });
    const latencyWithout = Date.now() - startWithout;
    
    // With multi-scale
    const startWith = Date.now();
    const aggregatedWith = aggregateMultiScale(sample.temporalNotes, {
      timeScales: {
        immediate: 100,
        short: 1000,
        medium: 10000,
        long: 60000
      }
    });
    const latencyWith = Date.now() - startWith;
    
    metrics.record('multiScale', 'without', {
      llmCalls: 0, // No LLM calls for aggregation
      accuracy: null, // Coherence is the metric
      latency: latencyWithout,
      cost: 0,
      coherence: aggregatedWithout.coherence || 0
    });
    
    metrics.record('multiScale', 'with', {
      llmCalls: 0,
      accuracy: null,
      latency: latencyWith,
      cost: 0,
      coherence: Object.values(aggregatedWith.coherence || {}).reduce((sum, c) => sum + c, 0) / Object.keys(aggregatedWith.coherence || {}).length || 0
    });
  }
  
  metrics.save();
  return metrics.getSummary().multiScale;
}

/**
 * Run all ablation studies
 */
export async function runAllAblationStudies(samples = []) {
  console.log('🧪 Starting Research Features Ablation Study\n');
  console.log('='.repeat(60));
  
  const results = {};
  
  // Test each feature
  if (samples.length > 0) {
    results.temporalDecision = await testTemporalDecisionManager(samples);
    results.ensemble = await testEnsembleJudge(samples);
    results.multiScale = await testMultiScaleAggregation(samples);
  }
  
  // Save summary
  const summary = metrics.getSummary();
  const summaryFile = join(RESULTS_DIR, 'ablation-summary.json');
  writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
  
  console.log('\n📊 Ablation Study Summary:\n');
  console.log(JSON.stringify(summary, null, 2));
  
  return summary;
}

/**
 * Generate ablation report
 */
export function generateAblationReport() {
  const summary = metrics.getSummary();
  
  console.log('\n📋 Research Features Ablation Report\n');
  console.log('='.repeat(60));
  
  for (const [feature, data] of Object.entries(summary)) {
    console.log(`\n${feature.toUpperCase()}:`);
    console.log(`  LLM Calls: ${data.improvement.llmCalls} reduction`);
    console.log(`  Accuracy: ${data.improvement.accuracy} improvement`);
    console.log(`  Latency: ${data.improvement.latency} reduction`);
    console.log(`  Cost: ${data.improvement.cost} reduction`);
  }
  
  return summary;
}

