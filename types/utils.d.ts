import { OpaqueClass } from './shared.js';
import type { OpaqueFunction } from './shared.js';

export class AIBrowserTestError extends Error {}
export class BatchOptimizer extends OpaqueClass {}
export class CacheError extends Error {}
export class ConfigError extends Error {}
export class CostTracker extends OpaqueClass {}
export class FileError extends Error {}
export class LatencyAwareBatchOptimizer extends OpaqueClass {}
export class ProviderError extends Error {}
export class ScoreTracker extends OpaqueClass {}
export class StateMismatchError extends Error {}
export class TimeoutError extends Error {}
export class ValidationError extends Error {}

export const API_CONSTANTS: Readonly<Record<string, unknown>>;
export const BATCH_OPTIMIZER_CONSTANTS: Readonly<Record<string, unknown>>;
export const CACHE_CONSTANTS: Readonly<Record<string, unknown>>;
export const DEFAULT_RUBRIC: Readonly<Record<string, unknown>>;
export const TEMPORAL_CONSTANTS: Readonly<Record<string, unknown>>;
export const UNCERTAINTY_CONSTANTS: Readonly<Record<string, unknown>>;

export const aggregateFeedback: OpaqueFunction;
export const analyzeScoreDistribution: OpaqueFunction;
export const assertArray: OpaqueFunction;
export const assertFunction: OpaqueFunction;
export const assertNonEmptyString: OpaqueFunction;
export const assertNumber: OpaqueFunction;
export const assertObject: OpaqueFunction;
export const assertString: OpaqueFunction;
export const buildRubricPrompt: OpaqueFunction;
export const calculateBackoff: OpaqueFunction;
export const calculateCostComparison: OpaqueFunction;
export const calculateRankAgreement: OpaqueFunction;
export const calibrateScore: OpaqueFunction;
export const clearCache: OpaqueFunction;
export const compressContext: OpaqueFunction;
export const compressStateHistory: OpaqueFunction;
export const createConfig: OpaqueFunction;
export const deriveCalibrationProfile: OpaqueFunction;
export const disableDebug: OpaqueFunction;
export const enableDebug: OpaqueFunction;
export const enhanceErrorMessage: OpaqueFunction;
export const error: OpaqueFunction;
export const extractStructuredData: OpaqueFunction;
export const generateCacheKey: OpaqueFunction;
export const generateRecommendations: OpaqueFunction;
export const getBudgetStatus: OpaqueFunction;
export const getCacheStats: OpaqueFunction;
export const getCached: OpaqueFunction;
export const getCalibrationProfile: OpaqueFunction;
export const getConfig: OpaqueFunction;
export const getCostStats: OpaqueFunction;
export const getCostTracker: OpaqueFunction;
export const getProperty: OpaqueFunction;
export const getProvider: OpaqueFunction;
export const getRubricForTestType: OpaqueFunction;
export const initCache: OpaqueFunction;
export const initErrorHandlers: OpaqueFunction;
export const isAIBrowserTestError: OpaqueFunction;
export const isArray: OpaqueFunction;
export const isDebugEnabled: OpaqueFunction;
export const isErrorType: OpaqueFunction;
export const isFunction: OpaqueFunction;
export const isNumber: OpaqueFunction;
export const isObject: OpaqueFunction;
export const isPersona: OpaqueFunction;
export const isPromise: OpaqueFunction;
export const isRetryableError: OpaqueFunction;
export const isString: OpaqueFunction;
export const isTemporalNote: OpaqueFunction;
export const isValidationContext: OpaqueFunction;
export const isValidationResult: OpaqueFunction;
export const loadEnv: OpaqueFunction;
export const log: OpaqueFunction;
export const normalizeValidationResult: OpaqueFunction;
export const optimizeCost: OpaqueFunction;
export const pearsonCorrelation: OpaqueFunction;
export const pick: OpaqueFunction;
export const recordCost: OpaqueFunction;
export const resetCalibrationProfiles: OpaqueFunction;
export const retryWithBackoff: OpaqueFunction;
export const selectModelTier: OpaqueFunction;
export const selectModelTierAndProvider: OpaqueFunction;
export const selectProvider: OpaqueFunction;
export const setBudgetLimit: OpaqueFunction;
export const setCached: OpaqueFunction;
export const setCalibrationProfile: OpaqueFunction;
export const setConfig: OpaqueFunction;
export const spearmanCorrelation: OpaqueFunction;
export const validateStartup: OpaqueFunction;
export const validateStartupSoft: OpaqueFunction;
export const warn: OpaqueFunction;
