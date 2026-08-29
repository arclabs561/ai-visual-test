/** Public package barrel for visual review APIs and integration conveniences. */

import { loadEnv } from './load-env.mjs';
import { VLLMJudge, validateScreenshot as validateScreenshotImpl } from '#judge';
import type { SemanticInfo } from '#public-contract';

loadEnv();

export { VLLMJudge, validateScreenshotImpl as validateScreenshot };
/** Backward-compatible alias for {@link validateScreenshot}. */
export { validateScreenshotImpl as _validateScreenshot };

export type {
  Config,
  ConfigOptions,
  SemanticInfo,
  ValidationContext,
  ValidationResult,
} from '#public-contract';

export { validatePage, validateComparison } from '#page-validation';
export type {
  PageLike,
  PageValidationOptions,
  ScreenshotPage,
  ScreenshotPageValidationOptions,
} from '#page-validation';
export { validateWithRubric } from './validators/index.mjs';

/** Extract normalized semantic fields from a VLLM judgment. */
export function extractSemanticInfo(judgment: unknown): SemanticInfo {
  return new VLLMJudge({ enabled: false }).extractSemanticInfo(judgment);
}

export { createConfig, getConfig } from './config.mjs';
export { validateStartup } from './startup-validation.mjs';
export { getCached, setCached, clearCache, getCacheStats } from './cache.mjs';
export { estimateCost } from './cost-tracker.mjs';
export { ValidationError, ConfigError, ProviderError, FileError } from './errors.js';
export { createMatchers } from '#playwright-integration';
export { VideoJudge, judgeVideo } from '#video';
export type {
  VideoContext,
  VideoInput,
  VideoInputEntry,
  VideoJudgeOptions,
  VideoTranscodeOptions,
} from '#video';
export type { ExtractedIssue } from './extractors.js';
export {
  extractIssues,
  extractFixedTimestamps,
  findConsensus,
  detectSpirals,
  timestampToSeconds,
} from './extractors.js';
