import { LatencyAwareBatchOptimizer } from '../../build/src/latency-aware-batch-optimizer.js';
import type { BatchValidationResult, ValidationResult } from '../../build/src/public-contract.js';

const optimizer = new LatencyAwareBatchOptimizer({ cacheEnabled: false });
optimizer.clearCache();

export const cacheSize: number = optimizer.getCacheStats().cacheSize;
export const queueRejections: number = optimizer.getPerformanceMetrics().queue.rejections;
export const directResult: Promise<ValidationResult> = optimizer.addRequest(
  'checkout.png',
  'Review the checkout layout',
  { maxLatency: 50 },
);
export const batchResult: Promise<ValidationResult[] | BatchValidationResult> = optimizer.batchValidate(
  ['checkout.png'],
  'Review the checkout layout',
);
