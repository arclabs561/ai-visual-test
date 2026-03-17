/**
 * ai-visual-test
 *
 * Visual testing utilities using Vision Language Models (VLLM) for multi-modal validation.
 *
 * This is the core entry point with ~15 essential exports.
 * Additional functionality is available via subpath imports:
 *
 *   import { ... } from '@arclabs561/ai-visual-test/temporal'
 *   import { ... } from '@arclabs561/ai-visual-test/validators'
 *   import { ... } from '@arclabs561/ai-visual-test/multi-modal'
 *   import { ... } from '@arclabs561/ai-visual-test/ensemble'
 *   import { ... } from '@arclabs561/ai-visual-test/persona'
 *   import { ... } from '@arclabs561/ai-visual-test/specs'
 *   import { ... } from '@arclabs561/ai-visual-test/utils'
 *   import { ... } from '@arclabs561/ai-visual-test/game'
 *   import { ... } from '@arclabs561/ai-visual-test/errors'
 *   import { ... } from '@arclabs561/ai-visual-test/playwright'
 */

// Auto-load .env file on module initialization
import { loadEnv } from './load-env.mjs';
loadEnv();

// --- Core validation ---
import { VLLMJudge, validateScreenshot as _validateScreenshot } from './judge.mjs';
export { VLLMJudge, _validateScreenshot as validateScreenshot };
// Internal alias for backward compatibility
export { _validateScreenshot };

export { validatePage } from './convenience.mjs';
export { validateWithRubric } from './validators/index.mjs';

/**
 * Extract semantic information from VLLM judgment text
 *
 * Utility function to parse VLLM responses into structured data.
 * Useful for custom implementations that need to parse judgment text.
 *
 * @param {string | object} judgment - Judgment text or object from VLLM
 * @returns {Object} Structured semantic information with score, issues, assessment, reasoning, brutalistViolations (optional), zeroToleranceViolations (optional)
 */
export function extractSemanticInfo(judgment) {
  const judge = new VLLMJudge({ enabled: false });
  return judge.extractSemanticInfo(judgment);
}

// --- Config ---
export { createConfig, getConfig } from './config.mjs';

// --- Startup validation (call early to get clear error messages) ---
export { validateStartup } from './startup-validation.mjs';

// --- Cache ---
export { getCached, setCached, clearCache, getCacheStats } from './cache.mjs';

// --- Errors (user-facing types for catch blocks) ---
export { ValidationError, ConfigError, ProviderError, FileError } from './errors.mjs';

// --- Playwright integration (re-export for convenience) ---
export { createMatchers } from './integrations/playwright.mjs';
