#!/usr/bin/env node
/**
 * Validate Improved Methods Using Real Datasets
 * 
 * Comprehensive validation of:
 * - Temporal aggregation (exponential vs logarithmic)
 * - Coherence calculation improvements
 * - Adaptive sampling and warm-start
 * - State change detection
 * - Performance optimizations
 * 
 * Uses real evaluation datasets via adapters.
 */

import { aggregateTemporalNotes } from '../src/temporal.mjs';
import { TemporalDecisionManager } from '../src/temporal-decision-manager.mjs';
import { loadDataset } from './utils/dataset-adapters.mjs';
import { writeFileSync } from 'fs';
import { join } from 'path';

const RESULTS_DIR = join(process.cwd(), 'evaluation', 'results', 'method-validation');

async function validateTemporalAggregation(datasetName, limit = 50) {
  console.log(`\n📊 Validating Temporal Aggregation with ${datasetName}...`);
  
  try {
    const dataset = await loadDataset(datasetName, { limit });
    
    if (!dataset) {
      console.log(`⚠️  Dataset ${datasetName} not available`);
      return null;
    }
    
    // Handle both array and object responses
    const samples = Array.isArray(dataset) ? dataset : (dataset.samples || []);
    
    if (samples.length === 0) {
      console.log(`⚠️  Dataset ${datasetName} is empty`);
      return null;
    }
    
    // Convert to temporal notes
    const notes = samples.map((sample, i) => ({
      timestamp: Date.now() - (samples.length - i) * 1000,
      score: sample.groundTruth?.preciseScore || 
             sample.groundTruth?.expectedScore?.min || 
             (sample.groundTruth?.expectedScore ? 
               (sample.groundTruth.expectedScore.min + sample.groundTruth.expectedScore.max) / 2 : 5),
      observation: sample.metadata?.url || `Sample ${i}`
    }));
    
    // Test exponential (default)
    const expStart = performance.now();
    const expResult = await aggregateTemporalNotes(notes, { decayMethod: 'exponential' });
    const expTime = performance.now() - expStart;
    
    // Test logarithmic
    const logStart = performance.now();
    const logResult = await aggregateTemporalNotes(notes, { decayMethod: 'logarithmic' });
    const logTime = performance.now() - logStart;
    
    return {
      dataset: datasetName,
      sampleCount: notes.length,
      exponential: {
        coherence: expResult.coherence,
        windows: expResult.windows.length,
        timeMs: expTime,
        timePerNote: expTime / notes.length
      },
      logarithmic: {
        coherence: logResult.coherence,
        windows: logResult.windows.length,
        timeMs: logTime,
        timePerNote: logTime / notes.length
      },
      comparison: {
        coherenceDiff: logResult.coherence - expResult.coherence,
        timeRatio: logTime / expTime,
        windowDiff: logResult.windows.length - expResult.windows.length
      }
    };
  } catch (error) {
    console.error(`❌ Error validating ${datasetName}:`, error.message);
    return null;
  }
}

async function validateAdaptiveSampling(datasetName, limit = 30) {
  console.log(`\n🎯 Validating Adaptive Sampling with ${datasetName}...`);
  
  try {
    const dataset = await loadDataset(datasetName, { limit });
    
    if (!dataset) {
      console.log(`⚠️  Dataset ${datasetName} not available`);
      return null;
    }
    
    const samples = Array.isArray(dataset) ? dataset : (dataset.samples || []);
    
    if (samples.length === 0) {
      console.log(`⚠️  Dataset ${datasetName} is empty`);
      return null;
    }
    
    const manager = new TemporalDecisionManager({
      warmStartSteps: 5,
      adaptiveSampling: true
    });
    
    const decisions = [];
    let promptCount = 0;
    
    // Simulate sequential decisions
    for (let i = 0; i < Math.min(samples.length, 20); i++) {
      const sample = samples[i];
      const currentState = {
        score: sample.groundTruth?.preciseScore || 5,
        issues: sample.groundTruth?.structuredIssues || []
      };
      const previousState = i > 0 ? {
        score: samples[i - 1].groundTruth?.preciseScore || 5,
        issues: samples[i - 1].groundTruth?.structuredIssues || []
      } : null;
      
      const notes = samples.slice(0, i + 1).map((s, idx) => ({
        timestamp: Date.now() - (i + 1 - idx) * 1000,
        score: s.groundTruth?.preciseScore || 5
      }));
      
      const decision = await manager.shouldPrompt(currentState, previousState, notes);
      decisions.push({
        step: i + 1,
        shouldPrompt: decision.shouldPrompt,
        reason: decision.reason,
        urgency: decision.urgency,
        isWarmStart: i + 1 <= 5
      });
      
      if (decision.shouldPrompt) promptCount++;
    }
    
    return {
      dataset: datasetName,
      totalSteps: decisions.length,
      warmStartSteps: 5,
      promptCount,
      promptRate: promptCount / decisions.length,
      decisions: decisions.slice(0, 10) // First 10 for analysis
    };
  } catch (error) {
    console.error(`❌ Error validating adaptive sampling with ${datasetName}:`, error.message);
    return null;
  }
}

async function validateStateChangeDetection(datasetName, limit = 30) {
  console.log(`\n🔄 Validating State Change Detection with ${datasetName}...`);
  
  try {
    const dataset = await loadDataset(datasetName, { limit });
    
    if (!dataset) {
      console.log(`⚠️  Dataset ${datasetName} not available`);
      return null;
    }
    
    const samples = Array.isArray(dataset) ? dataset : (dataset.samples || []);
    
    if (samples.length === 0) {
      console.log(`⚠️  Dataset ${datasetName} is empty`);
      return null;
    }
    
    const manager = new TemporalDecisionManager();
    const changes = [];
    
    for (let i = 1; i < Math.min(samples.length, 20); i++) {
      const current = {
        score: samples[i].groundTruth?.preciseScore || 5,
        issues: samples[i].groundTruth?.structuredIssues || []
      };
      const previous = {
        score: samples[i - 1].groundTruth?.preciseScore || 5,
        issues: samples[i - 1].groundTruth?.structuredIssues || []
      };
      
      const change = manager.calculateStateChange(current, previous);
      changes.push({
        step: i,
        change,
        scoreDiff: Math.abs(current.score - previous.score),
        issueCountDiff: Math.abs((current.issues?.length || 0) - (previous.issues?.length || 0))
      });
    }
    
    const avgChange = changes.reduce((sum, c) => sum + c.change, 0) / changes.length;
    const significantChanges = changes.filter(c => c.change > 0.3).length;
    
    return {
      dataset: datasetName,
      totalComparisons: changes.length,
      avgChange,
      significantChanges,
      significantChangeRate: significantChanges / changes.length,
      changes: changes.slice(0, 10) // First 10 for analysis
    };
  } catch (error) {
    console.error(`❌ Error validating state change detection with ${datasetName}:`, error.message);
    return null;
  }
}

async function runComprehensiveValidation() {
  console.log('🔬 Comprehensive Method Validation');
  console.log('==================================\n');
  
  const datasets = ['real', 'webui', 'screenai', 'wcag'];
  const results = {
    timestamp: new Date().toISOString(),
    temporalAggregation: {},
    adaptiveSampling: {},
    stateChangeDetection: {}
  };
  
  // Validate temporal aggregation
  for (const dataset of datasets) {
    const result = await validateTemporalAggregation(dataset, 30);
    if (result) {
      results.temporalAggregation[dataset] = result;
      console.log(`✅ ${dataset}: exp coherence=${result.exponential.coherence.toFixed(3)}, log coherence=${result.logarithmic.coherence.toFixed(3)}`);
    }
  }
  
  // Validate adaptive sampling
  for (const dataset of datasets) {
    const result = await validateAdaptiveSampling(dataset, 20);
    if (result) {
      results.adaptiveSampling[dataset] = result;
      console.log(`✅ ${dataset}: ${result.promptCount}/${result.totalSteps} prompts (${(result.promptRate * 100).toFixed(1)}%)`);
    }
  }
  
  // Validate state change detection
  for (const dataset of datasets) {
    const result = await validateStateChangeDetection(dataset, 20);
    if (result) {
      results.stateChangeDetection[dataset] = result;
      console.log(`✅ ${dataset}: avg change=${result.avgChange.toFixed(3)}, ${result.significantChanges} significant changes`);
    }
  }
  
  // Save results
  const outputFile = join(RESULTS_DIR, `method-validation-${Date.now()}.json`);
  writeFileSync(outputFile, JSON.stringify(results, null, 2));
  console.log(`\n💾 Results saved to: ${outputFile}`);
  
  // Print summary
  console.log('\n📈 Summary:');
  console.log('===========');
  console.log(`Temporal Aggregation: ${Object.keys(results.temporalAggregation).length} datasets`);
  console.log(`Adaptive Sampling: ${Object.keys(results.adaptiveSampling).length} datasets`);
  console.log(`State Change Detection: ${Object.keys(results.stateChangeDetection).length} datasets`);
  
  return results;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runComprehensiveValidation().catch(console.error);
}

export { runComprehensiveValidation, validateTemporalAggregation, validateAdaptiveSampling, validateStateChangeDetection };

