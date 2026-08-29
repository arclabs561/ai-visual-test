/**
 * Batch Validator
 *
 * Enhanced BatchOptimizer with cost tracking and statistics
 *
 * Provides:
 * - All BatchOptimizer functionality
 * - Cost tracking integration
 * - Performance statistics
 * - Success rate tracking
 */

import { BatchOptimizer as BatchOptimizerImpl } from '../batch-optimizer.mjs';
import { getCostTracker } from '../cost-tracker.mjs';
import type {
  BatchCostStats,
  BatchPerformanceStats,
  BatchValidationResult,
  ValidationContext,
  ValidationResult,
} from '#public-contract';

// The legacy optimizer has a wider union return type than this enriched facade.
// Keep runtime inheritance while publishing only the base behavior this class uses.
type BatchOptimizerBase = new (options?: BatchValidatorOptions) => {
  batchValidate(
    screenshots: string | string[],
    prompt: string,
    context?: ValidationContext,
  ): Promise<ValidationResult[] | BatchValidationResult>;
  clearCache(): void;
  getCacheStats(): {
    cacheSize: number;
    queueLength: number;
    activeRequests: number;
  };
  getPerformanceMetrics(): {
    queue: {
      currentLength: number;
      maxSize: number;
      rejections: number;
      totalQueued: number;
      totalProcessed: number;
      averageWaitTime: number;
      timeouts: number;
      timeoutRate: number;
      rejectionRate: number;
    };
    concurrency: {
      active: number;
      max: number;
      utilization: number;
    };
    cache: {
      cacheSize: number;
      queueLength: number;
      activeRequests: number;
    };
  };
};

const BatchOptimizer = BatchOptimizerImpl as unknown as BatchOptimizerBase;

interface BatchValidatorOptions extends ValidationContext {
  maxConcurrency?: number;
  batchSize?: number;
  cacheEnabled?: boolean;
  trackCosts?: boolean;
  trackStats?: boolean;
}

interface PerformanceAccumulator {
  totalRequests: number;
  totalDuration: number;
  successfulRequests: number;
  failedRequests: number;
  minDuration: number;
  maxDuration: number;
}

interface CostTracker {
  recordCost(cost: {
    provider: string | null | undefined;
    cost: number;
    tokens: number;
    testType: string;
    screenshot: string | undefined;
  }): void;
  getStats(): BatchCostStats;
}

interface EstimatedCost {
  total?: number;
  tokens?: number;
}

function estimatedCost(value: unknown): EstimatedCost | null {
  if (value === null || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const total = typeof candidate.total === 'number' ? candidate.total : undefined;
  const tokens = typeof candidate.tokens === 'number' ? candidate.tokens : undefined;
  if (total === undefined && tokens === undefined) {
    return null;
  }

  return {
    ...(total === undefined ? {} : { total }),
    ...(tokens === undefined ? {} : { tokens }),
  };
}

function emptyPerformanceAccumulator(): PerformanceAccumulator {
  return {
    totalRequests: 0,
    totalDuration: 0,
    successfulRequests: 0,
    failedRequests: 0,
    minDuration: Infinity,
    maxDuration: 0,
  };
}

/**
 * Batch validator with cost tracking
 */
export class BatchValidator extends BatchOptimizer {
  private readonly costTracker: CostTracker | null;
  private readonly trackCosts: boolean;
  private readonly trackStats: boolean;
  private stats: PerformanceAccumulator;

  constructor(options: BatchValidatorOptions = {}) {
    super({
      maxConcurrency: options.maxConcurrency || 5,
      batchSize: options.batchSize || 3,
      cacheEnabled: options.cacheEnabled !== false,
      ...options
    });
    this.costTracker = getCostTracker() as CostTracker | null;
    this.trackCosts = options.trackCosts !== false;
    this.trackStats = options.trackStats !== false;
    this.stats = emptyPerformanceAccumulator();
  }

  /**
   * Validate multiple screenshots with cost tracking
   */
  async batchValidate(
    screenshots: string | string[],
    prompt: string,
    context: ValidationContext = {},
  ): Promise<BatchValidationResult> {
    const startTime = Date.now();
    const screenshotsArray = Array.isArray(screenshots) ? screenshots : [screenshots];
    const results = await super.batchValidate(screenshots, prompt, context) as ValidationResult[];

    const duration = Date.now() - startTime;

    // Track costs
    const costTracker = this.costTracker;
    if (this.trackCosts && costTracker) {
      results.forEach((result, index) => {
        const resultCost = estimatedCost(result.estimatedCost);
        if (resultCost) {
          try {
            costTracker.recordCost({
              provider: result.provider,
              cost: resultCost.total || 0,
              tokens: resultCost.tokens || 0,
              testType: context.testType || 'batch',
              screenshot: screenshotsArray[index]
            });
          } catch {
            // Silently fail cost tracking to avoid breaking validation
            // Could log warning in production
          }
        }
      });
    }

    // Track stats
    if (this.trackStats) {
      this.stats.totalRequests += results.length;
      this.stats.totalDuration += duration;
      this.stats.minDuration = Math.min(this.stats.minDuration, duration);
      this.stats.maxDuration = Math.max(this.stats.maxDuration, duration);

      results.forEach((result) => {
        if (result.error) {
          this.stats.failedRequests++;
        } else {
          this.stats.successfulRequests++;
        }
      });
    }

    const passingScore = typeof context.passingScore === 'number' ? context.passingScore : 7;

    return {
      results,
      stats: this.trackStats ? {
        total: screenshotsArray.length,
        passed: results.filter((result) => (result.score ?? 0) >= passingScore).length,
        failed: results.filter((result) => (result.score ?? 0) < passingScore).length,
        duration,
        costStats: this.trackCosts && this.costTracker ? this.costTracker.getStats() : null,
        performance: this.trackStats ? {
          totalRequests: this.stats.totalRequests,
          avgDuration: this.stats.totalRequests > 0 ? this.stats.totalDuration / this.stats.totalRequests : 0,
          minDuration: this.stats.minDuration === Infinity ? 0 : this.stats.minDuration,
          maxDuration: this.stats.maxDuration,
          successRate: this.stats.totalRequests > 0 ? this.stats.successfulRequests / this.stats.totalRequests : 0
        } : null
      } : null
    };
  }

  /**
   * Get cost statistics
   */
  getCostStats(): BatchCostStats | null {
    if (!this.costTracker) {
      return null;
    }
    return this.costTracker.getStats();
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): BatchPerformanceStats {
    return {
      totalRequests: this.stats.totalRequests,
      avgDuration: this.stats.totalRequests > 0 ? this.stats.totalDuration / this.stats.totalRequests : 0,
      minDuration: this.stats.minDuration === Infinity ? 0 : this.stats.minDuration,
      maxDuration: this.stats.maxDuration,
      successRate: this.stats.totalRequests > 0 ? this.stats.successfulRequests / this.stats.totalRequests : 0
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = emptyPerformanceAccumulator();
  }
}
