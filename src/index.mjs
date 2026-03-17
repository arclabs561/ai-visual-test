/**
 * ai-visual-test -- VLM-powered visual testing
 *
 * Quick start:
 *
 *   // 1. Set an API key: export GEMINI_API_KEY=... (or OPENAI/ANTHROPIC/GROQ)
 *   // 2. Validate a screenshot:
 *   import { validateScreenshot } from '@arclabs561/ai-visual-test';
 *   const result = await validateScreenshot('screenshot.png', 'Is this accessible?');
 *   // result.score (0-10), result.issues, result.recommendations
 *
 *   // 3. Optional: validate config early for clear error messages
 *   import { validateStartup } from '@arclabs561/ai-visual-test';
 *   validateStartup(); // throws ConfigError if API key missing
 *
 *   // 4. Per-call overrides (provider, model, threshold):
 *   const result = await validateScreenshot('img.png', 'prompt', {
 *     provider: 'openai',    // override auto-detected provider
 *     model: 'gpt-4o',       // override default model
 *     modelTier: 'best',     // or use tier-based selection
 *   });
 *
 * Subpath imports for advanced features:
 *
 *   '@arclabs561/ai-visual-test/temporal'    -- temporal aggregation
 *   '@arclabs561/ai-visual-test/validators'  -- smart/accessibility/state validators
 *   '@arclabs561/ai-visual-test/ensemble'    -- multi-provider ensemble judging
 *   '@arclabs561/ai-visual-test/persona'     -- persona-based experience testing
 *   '@arclabs561/ai-visual-test/game'        -- game playing and testing
 *   '@arclabs561/ai-visual-test/specs'       -- natural language spec execution
 *   '@arclabs561/ai-visual-test/playwright'  -- Playwright matchers
 *   '@arclabs561/ai-visual-test/errors'      -- all error types
 *   '@arclabs561/ai-visual-test/utils'       -- utilities, cost tracking, calibration
 */

// Auto-load .env file on module initialization
import { loadEnv } from './load-env.mjs';
loadEnv();

// --- Core validation ---
import { VLLMJudge, validateScreenshot as _validateScreenshot } from './judge.mjs';
export { VLLMJudge, _validateScreenshot as validateScreenshot };
// Internal alias for backward compatibility
export { _validateScreenshot };

export { validatePage, validateComparison } from './convenience.mjs';
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

// --- Cost estimation ---
export { estimateCost } from './cost-tracker.mjs';

// --- Errors (user-facing types for catch blocks) ---
export { ValidationError, ConfigError, ProviderError, FileError } from './errors.mjs';

// --- Playwright integration (re-export for convenience) ---
export { createMatchers } from './integrations/playwright.mjs';
