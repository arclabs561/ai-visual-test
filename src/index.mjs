/**
 * @visual-ai/validate
 * 
 * Visual testing utilities using Vision Language Models (VLLM) for screenshot validation.
 * 
 * Main entry point - exports all public APIs.
 */

export { VLLMJudge, validateScreenshot } from './judge.mjs';
export { 
  multiModalValidation,
  captureTemporalScreenshots,
  extractRenderedCode,
  multiPerspectiveEvaluation
} from './multi-modal.mjs';
export {
  aggregateTemporalNotes,
  formatNotesForPrompt,
  calculateCoherenceExported as calculateCoherence
} from './temporal.mjs';
export {
  getCached,
  setCached,
  clearCache,
  getCacheStats
} from './cache.mjs';
export {
  createConfig,
  getProvider,
  getConfig
} from './config.mjs';
export { loadEnv } from './load-env.mjs';
export { ScoreTracker } from './score-tracker.mjs';
export { BatchOptimizer } from './batch-optimizer.mjs';
export { extractStructuredData } from './data-extractor.mjs';
export { aggregateFeedback, generateRecommendations } from './feedback-aggregator.mjs';
export { compressContext, compressStateHistory } from './context-compressor.mjs';
export { experiencePageAsPersona, experiencePageWithPersonas } from './persona-experience.mjs';

