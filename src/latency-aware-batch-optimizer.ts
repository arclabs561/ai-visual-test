/**
 * Adaptive batching that honors latency requirements for reactive validation.
 */

import { BatchOptimizer as BatchOptimizerImplementation } from './batch-optimizer.js';
import type { BatchValidationResult, ValidationContext, ValidationResult } from './public-contract.js';

export interface LatencyAwareBatchOptimizerOptions extends ValidationContext {
  maxConcurrency?: number;
  batchSize?: number;
  cacheEnabled?: boolean;
  maxQueueSize?: number;
  requestTimeout?: number;
  defaultMaxLatency?: number;
  adaptiveBatchSize?: boolean;
}

export interface LatencyValidationContext extends ValidationContext {
  maxLatency?: number;
  critical?: boolean;
}

type ValidateFn = (
  imagePath: string,
  prompt: string,
  context: LatencyValidationContext,
) => Promise<ValidationResult> | ValidationResult;

interface QueueRequest {
  imagePath: string;
  prompt: string;
  context: LatencyValidationContext;
  validateFn: ValidateFn | null;
  resolve(value: ValidationResult): void;
  reject(error: unknown): void;
}

interface LatencyQueueCandidate {
  context?: LatencyValidationContext;
}

interface CacheStats {
  cacheSize: number;
  queueLength: number;
  activeRequests: number;
}

interface PerformanceMetrics {
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
  cache: CacheStats;
}

interface BatchOptimizerRuntime {
  queue: QueueRequest[];
  processing: boolean;
  cache: Map<string, ValidationResult> | null;
  batchSize: number;
  maxConcurrency: number;
  activeRequests: number;
  _getCacheKey(imagePath: string, prompt: string, context: LatencyValidationContext): string;
  _processRequest(
    imagePath: string,
    prompt: string,
    context: LatencyValidationContext,
    validateFn?: ValidateFn | null,
  ): Promise<ValidationResult>;
  _queueRequest(
    imagePath: string,
    prompt: string,
    context: LatencyValidationContext,
    validateFn?: ValidateFn | null,
  ): Promise<ValidationResult>;
  batchValidate(
    imagePaths: string | string[],
    prompt: string,
    context?: ValidationContext,
  ): Promise<ValidationResult[] | BatchValidationResult>;
  clearCache(): void;
  getCacheStats(): CacheStats;
  getPerformanceMetrics(): PerformanceMetrics;
}

type BatchOptimizerConstructor = new (
  options?: LatencyAwareBatchOptimizerOptions,
) => BatchOptimizerRuntime;

// The parent remains JavaScript for now. This explicit facade keeps this
// module's emitted declaration independent of inferred legacy JavaScript.
const BatchOptimizer = BatchOptimizerImplementation as unknown as BatchOptimizerConstructor;

export interface LatencyStats extends CacheStats {
  criticalRequests: number;
  queueLatencyRequirements: Array<{
    imagePath: string;
    maxLatency: number;
    critical: boolean;
  }>;
}

/**
 * Extends BatchOptimizer with latency-aware scheduling.
 */
export class LatencyAwareBatchOptimizer extends BatchOptimizer {
  defaultMaxLatency: number;
  adaptiveBatchSize: boolean;
  criticalRequests: Set<string>;
  declare queue: QueueRequest[];
  declare cache: Map<string, ValidationResult> | null;

  constructor(options: LatencyAwareBatchOptimizerOptions = {}) {
    super(options);
    this.defaultMaxLatency = options.defaultMaxLatency ?? 1000;
    this.adaptiveBatchSize = options.adaptiveBatchSize !== false;
    this.criticalRequests = new Set();
  }

  /** Add a validation request with an optional maximum acceptable latency. */
  async addRequest(
    imagePath: string,
    prompt: string,
    context: LatencyValidationContext = {},
    maxLatency: number | null = null,
  ): Promise<ValidationResult> {
    const latencyRequirement = maxLatency ?? context.maxLatency ?? this.defaultMaxLatency;
    const isCritical = latencyRequirement < 200;

    if (isCritical) {
      this.criticalRequests.add(imagePath);
    }

    if (latencyRequirement < 100) {
      // Intentionally omit validateFn: the inherited method imports the default
      // screenshot validator for this public direct-processing path.
      return this._processRequest(imagePath, prompt, {
        ...context,
        maxLatency: latencyRequirement,
        critical: true,
      }).finally(() => {
        this.criticalRequests.delete(imagePath);
      });
    }

    if (this.adaptiveBatchSize && latencyRequirement < 200) {
      const originalBatchSize = this.batchSize;
      this.batchSize = 1;

      try {
        return await this._queueRequest(imagePath, prompt, {
          ...context,
          maxLatency: latencyRequirement,
          critical: isCritical,
        });
      } finally {
        this.batchSize = originalBatchSize;
      }
    }

    return this._queueRequest(imagePath, prompt, {
      ...context,
      maxLatency: latencyRequirement,
    });
  }

  async _processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0 || this.activeRequests >= this.maxConcurrency) {
      return;
    }

    this.processing = true;

    try {
      const sortedQueue = [...this.queue].sort((a, b) => {
        const latencyA = a.context.maxLatency ?? this.defaultMaxLatency;
        const latencyB = b.context.maxLatency ?? this.defaultMaxLatency;
        return latencyA - latencyB;
      });

      while (sortedQueue.length > 0 && this.activeRequests < this.maxConcurrency) {
        const batchSize = this.adaptiveBatchSize
          ? this._calculateAdaptiveBatchSize(sortedQueue)
          : this.batchSize;
        const batch = sortedQueue.splice(0, batchSize);

        for (const item of batch) {
          const index = this.queue.findIndex((queued) => queued.imagePath === item.imagePath);
          if (index >= 0) this.queue.splice(index, 1);
        }

        const promises = batch.map(async ({ imagePath, prompt, context, validateFn, resolve, reject }) => {
          try {
            if (this.cache) {
              const cacheKey = this._getCacheKey(imagePath, prompt, context);
              const cached = this.cache.get(cacheKey);
              if (cached !== undefined) {
                resolve(cached);
                return;
              }
            }

            resolve(await this._processRequest(imagePath, prompt, context, validateFn));
          } catch (error) {
            reject(error);
          } finally {
            this.criticalRequests.delete(imagePath);
          }
        });

        await Promise.allSettled(promises);
      }
    } finally {
      this.processing = false;
    }
  }

  _calculateAdaptiveBatchSize(queue: readonly LatencyQueueCandidate[]): number {
    const first = queue[0];
    if (!first) return this.batchSize;

    const firstLatency = first.context?.maxLatency ?? this.defaultMaxLatency;
    if (firstLatency < 100) return 1;
    if (firstLatency < 200) return 2;
    return this.batchSize;
  }

  getLatencyStats(): LatencyStats {
    return {
      ...this.getCacheStats(),
      criticalRequests: this.criticalRequests.size,
      queueLatencyRequirements: this.queue.map((request) => {
        const maxLatency = request.context.maxLatency ?? this.defaultMaxLatency;
        return {
          imagePath: request.imagePath,
          maxLatency,
          critical: maxLatency < 200,
        };
      }),
    };
  }
}
