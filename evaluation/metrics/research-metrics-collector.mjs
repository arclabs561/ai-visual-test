/**
 * Research Metrics Collector
 * 
 * Collects and tracks metrics for research features:
 * - LLM call counts
 * - Accuracy (vs. ground truth)
 * - Latency (ms)
 * - Cost ($)
 * - Cache hit rates
 * - Feature usage statistics
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const METRICS_DIR = join(process.cwd(), 'evaluation', 'results', 'metrics');
const METRICS_FILE = join(METRICS_DIR, 'research-metrics.json');

// Initialize metrics directory
if (!existsSync(METRICS_DIR)) {
  mkdirSync(METRICS_DIR, { recursive: true });
}

/**
 * Research Metrics Collector
 */
export class ResearchMetricsCollector {
  constructor() {
    this.metrics = this.loadMetrics();
  }

  loadMetrics() {
    if (existsSync(METRICS_FILE)) {
      try {
        return JSON.parse(readFileSync(METRICS_FILE, 'utf8'));
      } catch (error) {
        return this.initializeMetrics();
      }
    }
    return this.initializeMetrics();
  }

  initializeMetrics() {
    return {
      temporalDecision: {
        totalCalls: 0,
        skippedCalls: 0,
        reductionPercentage: 0,
        accuracy: { with: [], without: [] },
        latency: { with: [], without: [] },
        cost: { with: [], without: [] }
      },
      ensemble: {
        totalEvaluations: 0,
        accuracy: { single: [], ensemble: [] },
        latency: { single: [], ensemble: [] },
        cost: { single: [], ensemble: [] }
      },
      multiScale: {
        totalAggregations: 0,
        coherence: { single: [], multi: [] },
        latency: { single: [], multi: [] }
      },
      humanPerception: {
        totalInteractions: 0,
        timing: { fixed: [], human: [] },
        accuracy: { fixed: [], human: [] }
      },
      temporalPreprocessing: {
        totalProcesses: 0,
        cacheHits: 0,
        cacheMisses: 0,
        latency: { with: [], without: [] }
      },
      entityCaching: {
        totalExtractions: 0,
        cacheHits: 0,
        cacheMisses: 0,
        hitRate: 0
      }
    };
  }

  saveMetrics() {
    writeFileSync(METRICS_FILE, JSON.stringify(this.metrics, null, 2));
  }

  /**
   * Record TemporalDecisionManager metrics
   */
  recordTemporalDecision(variant, metrics) {
    const { llmCalls, skipped, accuracy, latency, cost } = metrics;
    
    this.metrics.temporalDecision.totalCalls += llmCalls;
    if (skipped) {
      this.metrics.temporalDecision.skippedCalls += 1;
    }
    
    if (accuracy !== null) {
      this.metrics.temporalDecision.accuracy[variant].push(accuracy);
    }
    if (latency !== null) {
      this.metrics.temporalDecision.latency[variant].push(latency);
    }
    if (cost !== null) {
      this.metrics.temporalDecision.cost[variant].push(cost);
    }
    
    // Calculate reduction percentage
    const total = this.metrics.temporalDecision.totalCalls;
    const skipped = this.metrics.temporalDecision.skippedCalls;
    this.metrics.temporalDecision.reductionPercentage = total > 0 
      ? (skipped / total * 100).toFixed(2) 
      : 0;
    
    this.saveMetrics();
  }

  /**
   * Record EnsembleJudge metrics
   */
  recordEnsemble(variant, metrics) {
    const { accuracy, latency, cost } = metrics;
    
    this.metrics.ensemble.totalEvaluations += 1;
    
    if (accuracy !== null) {
      this.metrics.ensemble.accuracy[variant].push(accuracy);
    }
    if (latency !== null) {
      this.metrics.ensemble.latency[variant].push(latency);
    }
    if (cost !== null) {
      this.metrics.ensemble.cost[variant].push(cost);
    }
    
    this.saveMetrics();
  }

  /**
   * Record Multi-Scale Aggregation metrics
   */
  recordMultiScale(variant, metrics) {
    const { coherence, latency } = metrics;
    
    this.metrics.multiScale.totalAggregations += 1;
    
    if (coherence !== null) {
      this.metrics.multiScale.coherence[variant].push(coherence);
    }
    if (latency !== null) {
      this.metrics.multiScale.latency[variant].push(latency);
    }
    
    this.saveMetrics();
  }

  /**
   * Record Entity Extraction Caching metrics
   */
  recordEntityCaching(hit) {
    this.metrics.entityCaching.totalExtractions += 1;
    
    if (hit) {
      this.metrics.entityCaching.cacheHits += 1;
    } else {
      this.metrics.entityCaching.cacheMisses += 1;
    }
    
    const total = this.metrics.entityCaching.totalExtractions;
    const hits = this.metrics.entityCaching.cacheHits;
    this.metrics.entityCaching.hitRate = total > 0 
      ? (hits / total * 100).toFixed(2) 
      : 0;
    
    this.saveMetrics();
  }

  /**
   * Get summary statistics
   */
  getSummary() {
    const summary = {};
    
    // TemporalDecisionManager
    const td = this.metrics.temporalDecision;
    summary.temporalDecision = {
      reductionPercentage: td.reductionPercentage + '%',
      avgAccuracyWith: this.average(td.accuracy.with),
      avgAccuracyWithout: this.average(td.accuracy.without),
      avgLatencyWith: this.average(td.latency.with),
      avgLatencyWithout: this.average(td.latency.without),
      avgCostWith: this.average(td.cost.with),
      avgCostWithout: this.average(td.cost.without)
    };
    
    // EnsembleJudge
    const ens = this.metrics.ensemble;
    summary.ensemble = {
      accuracyImprovement: this.calculateImprovement(ens.accuracy.single, ens.accuracy.ensemble),
      latencyIncrease: this.calculateIncrease(ens.latency.single, ens.latency.ensemble),
      costIncrease: this.calculateIncrease(ens.cost.single, ens.cost.ensemble)
    };
    
    // Entity Caching
    const ec = this.metrics.entityCaching;
    summary.entityCaching = {
      hitRate: ec.hitRate + '%',
      totalExtractions: ec.totalExtractions,
      cacheHits: ec.cacheHits,
      cacheMisses: ec.cacheMisses
    };
    
    return summary;
  }

  average(array) {
    if (!array || array.length === 0) return null;
    return (array.reduce((sum, val) => sum + val, 0) / array.length).toFixed(2);
  }

  calculateImprovement(baseline, improved) {
    const baselineAvg = this.average(baseline);
    const improvedAvg = this.average(improved);
    if (!baselineAvg || !improvedAvg) return null;
    return ((parseFloat(improvedAvg) - parseFloat(baselineAvg)) / parseFloat(baselineAvg) * 100).toFixed(2) + '%';
  }

  calculateIncrease(baseline, increased) {
    const baselineAvg = this.average(baseline);
    const increasedAvg = this.average(increased);
    if (!baselineAvg || !increasedAvg) return null;
    return ((parseFloat(increasedAvg) - parseFloat(baselineAvg)) / parseFloat(baselineAvg) * 100).toFixed(2) + '%';
  }
}

// Global instance
export const researchMetrics = new ResearchMetricsCollector();

