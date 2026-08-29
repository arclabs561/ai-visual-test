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
  generateCacheKey
} from '../cache.mjs';

// Config
export {
  createConfig,
  getProvider,
  getConfig,
  setConfig
} from '../config.mjs';

// Environment
export { loadEnv } from '../load-env.mjs';

// Logger
export { enableDebug, disableDebug, isDebugEnabled, warn, log, error } from '../logger.mjs';

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
  isErrorType
} from '#errors';

// Retry
export {
  retryWithBackoff,
  isRetryableError,
  calculateBackoff,
  enhanceErrorMessage
} from '../retry.mjs';

// Cost tracking
export {
  CostTracker,
  getCostTracker,
  recordCost,
  getCostStats,
  setBudgetLimit,
  getBudgetStatus
} from '../cost-tracker.mjs';

// Score tracking
export { ScoreTracker } from '../score-tracker.mjs';

// Batch optimization
export { BatchOptimizer } from '../batch-optimizer.mjs';
export { LatencyAwareBatchOptimizer } from '../latency-aware-batch-optimizer.mjs';

// Data extraction
export { extractStructuredData } from '../data-extractor.mjs';

// Feedback aggregation
export { aggregateFeedback, generateRecommendations } from '../feedback-aggregator.mjs';

// Context compression
export { compressContext, compressStateHistory } from '../context-compressor.mjs';

// Metrics
export {
  spearmanCorrelation,
  pearsonCorrelation,
  calculateRankAgreement
} from '../metrics.mjs';

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
  getProperty
} from '../type-guards.mjs';

// Constants
export {
  CACHE_CONSTANTS,
  TEMPORAL_CONSTANTS,
  API_CONSTANTS,
  UNCERTAINTY_CONSTANTS,
  BATCH_OPTIMIZER_CONSTANTS
} from '../constants.mjs';

// Validation result normalization
export { normalizeValidationResult } from '#validation-result-normalizer';

// Error handlers
export { initErrorHandlers } from '../error-handler.mjs';

// Rubrics
export {
  DEFAULT_RUBRIC,
  buildRubricPrompt,
  getRubricForTestType
} from '../rubrics.mjs';

// Model tier selection
export {
  selectModelTier,
  selectProvider,
  selectModelTierAndProvider
} from '../model-tier-selector.mjs';

// Startup validation
export { validateStartup, validateStartupSoft } from '../startup-validation.mjs';

// Cost optimization
export {
  calculateCostComparison,
  optimizeCost
} from '../cost-optimization.mjs';

// Score calibration
export {
  calibrateScore,
  setCalibrationProfile,
  getCalibrationProfile,
  resetCalibrationProfiles,
  deriveCalibrationProfile,
  analyzeScoreDistribution
} from '../score-calibration.mjs';
