/**
 * Utils Sub-Module
 *
 * Utility functions, helpers, and infrastructure.
 *
 * Import from '@arclabs561/ai-visual-test/utils'
 */

// Cache
export {
  getCached,
  setCached,
  clearCache,
  getCacheStats,
  initCache,
  generateCacheKey,
} from '../cache.js';

// Config
export {
  createConfig,
  getProvider,
  getConfig,
  setConfig,
} from '../config.js';

// Environment
export { loadEnv } from '../load-env.js';

// Logger
export { enableDebug, disableDebug, isDebugEnabled, warn, log, error } from '../logger.js';

// Errors
export {
  AIBrowserTestError,
  ValidationError,
  CacheError,
  ConfigError,
  ProviderError,
  TimeoutError,
  FileError,
  StateMismatchError,
  isAIBrowserTestError,
  isErrorType,
} from '#errors';

// Retry
export {
  retryWithBackoff,
  isRetryableError,
  calculateBackoff,
  enhanceErrorMessage,
} from '../retry.js';

// Cost tracking
export {
  CostTracker,
  getCostTracker,
  recordCost,
  getCostStats,
  setBudgetLimit,
  getBudgetStatus,
} from '../cost-tracker.js';

// Score tracking
export { ScoreTracker } from '../score-tracker.js';

// Batch optimization
export { BatchOptimizer } from '../batch-optimizer.js';
export { LatencyAwareBatchOptimizer } from '../latency-aware-batch-optimizer.js';

// Data extraction
export { extractStructuredData } from '../data-extractor.js';

// Feedback aggregation
export { aggregateFeedback, generateRecommendations } from '../feedback-aggregator.js';

// Context compression
export { compressContext, compressStateHistory } from '../context-compressor.js';

// Metrics
export {
  spearmanCorrelation,
  pearsonCorrelation,
  calculateRankAgreement,
} from '../metrics.js';

// Type guards
export {
  isObject,
  isString,
  isNumber,
  isArray,
  isFunction,
  isPromise,
  isValidationResult,
  isValidationContext,
  isPersona,
  isTemporalNote,
  assertObject,
  assertString,
  assertNonEmptyString,
  assertNumber,
  assertArray,
  assertFunction,
  pick,
  getProperty,
} from '../type-guards.js';

// Constants
export {
  CACHE_CONSTANTS,
  TEMPORAL_CONSTANTS,
  API_CONSTANTS,
  UNCERTAINTY_CONSTANTS,
  BATCH_OPTIMIZER_CONSTANTS,
} from '../constants.js';

// Validation result normalization
export { normalizeValidationResult } from '#validation-result-normalizer';

// Error handlers
export { initErrorHandlers } from '../error-handler.js';

// Rubrics
export {
  DEFAULT_RUBRIC,
  buildRubricPrompt,
  getRubricForTestType,
} from '../rubrics.js';

// Model tier selection
export {
  selectModelTier,
  selectProvider,
  selectModelTierAndProvider,
} from '../model-tier-selector.js';

// Startup validation
export { validateStartup, validateStartupSoft } from '../startup-validation.js';

// Cost optimization
export {
  calculateCostComparison,
  optimizeCost,
} from '../cost-optimization.js';

// Score calibration
export {
  calibrateScore,
  setCalibrationProfile,
  getCalibrationProfile,
  resetCalibrationProfiles,
  deriveCalibrationProfile,
  analyzeScoreDistribution,
} from '../score-calibration.js';
