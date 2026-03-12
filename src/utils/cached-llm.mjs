/**
 * Cached LLM Wrapper
 * 
 * Wraps @arclabs561/llm-utils callLLM with persistent caching to reduce costs
 * and improve performance for text-only LLM calls.
 * 
 * Uses the same cache system as vLLM calls (src/cache.mjs) for consistency.
 * Cache entries persist for 7 days and use LRU eviction.
 * 
 * DESIGN DECISION: Separate wrapper rather than modifying @arclabs561/llm-utils
 * - Why: @arclabs561/llm-utils is a shared library, we can't modify it
 * - Why: Keeps caching concerns separate from LLM calling logic
 * - Why: Allows disabling cache per-call if needed (via useCache option)
 */

import { getCachedTextLLM, setCachedTextLLM, initCache, getCacheStats } from '../cache.mjs';
import { ValidationError } from '../errors.mjs';

// Initialize cache on module load (uses default directory)
initCache();

/**
 * Normalize prompt to improve cache hit rates
 * 
 * Normalizes prompts by:
 * - Trimming leading/trailing whitespace
 * - Normalizing line endings (CRLF -> LF)
 * - Collapsing multiple spaces to single space
 * 
 * This helps catch cases where prompts are semantically identical but have
 * minor formatting differences (e.g., extra spaces, different line endings).
 * 
 * DESIGN DECISION: Conservative normalization (preserves content, only fixes formatting)
 * - Why: Aggressive normalization (e.g., lowercasing, removing punctuation) could
 *   cause cache collisions for semantically different prompts
 * - Trade-off: Some cache misses for prompts that differ only in whitespace,
 *   but avoids wrong cache hits
 * 
 * SUBTLE BEHAVIOR: The original prompt is preserved for the API call, only the
 * cache key uses the normalized version. This ensures:
 * 1. Cache hit rates improve (formatting variations hit same cache)
 * 2. API receives original prompt (preserves user intent)
 * 3. No semantic changes (only formatting normalization)
 * 
 * @param {string} prompt - Raw prompt
 * @returns {string} Normalized prompt
 */
export function normalizePrompt(prompt) {
  if (typeof prompt !== 'string') {
    return prompt;
  }
  
  return prompt
    .replace(/\r\n/g, '\n') // Normalize line endings (CRLF -> LF)
    .replace(/\r/g, '\n')   // Handle old Mac line endings
    .replace(/[ \t]+/g, ' ') // Collapse multiple spaces/tabs to single space
    .replace(/[ \t]*\n[ \t]*/g, '\n') // Normalize line breaks (remove trailing/leading spaces)
    .trim(); // Remove leading/trailing whitespace
}

/**
 * Call LLM with caching
 * 
 * Wraps @arclabs561/llm-utils callLLM with persistent caching.
 * 
 * @param {string} prompt - Text prompt
 * @param {string} provider - LLM provider (e.g., 'gemini', 'openai', 'claude')
 * @param {string} apiKey - API key for the provider
 * @param {{
 *   model?: string | null;
 *   temperature?: number;
 *   maxTokens?: number;
 *   tier?: string;
 *   useCache?: boolean;
 * }} [options={}] - LLM call options
 * @returns {Promise<string>} LLM response
 */
export async function callLLMCached(prompt, provider, apiKey, options = {}) {
  const {
    useCache = process.env.DISABLE_LLM_CACHE !== 'true', // Same env var as config.mjs cacheEnabled
    ...llmOptions
  } = options;

  // Normalize prompt to improve cache hit rates
  const normalizedPrompt = normalizePrompt(prompt);

  // Check cache first (if caching enabled)
  if (useCache) {
    const cached = getCachedTextLLM(normalizedPrompt, provider, llmOptions);
    if (cached !== null) {
      // Log cache hit (weighted: cache hits are important for performance visibility)
      try {
        const { logCacheOperation } = await import('./performance-logger.mjs');
        const stats = getCacheStats();
        logCacheOperation({
          operation: 'hit',
          hit: true,
          latency: 0, // Minimal latency for cache hits
          cacheSize: stats.size,
          maxSize: 1000, // MAX_CACHE_SIZE
          type: 'text-llm'
        });
      } catch {
        // Silently fail if performance logger unavailable
      }
      
      return cached;
    }
    
    // Log cache miss
    try {
      const { logCacheOperation } = await import('./performance-logger.mjs');
      const stats = getCacheStats();
      logCacheOperation({
        operation: 'miss',
        hit: false,
        cacheSize: stats.size,
        maxSize: 1000,
        type: 'text-llm'
      });
    } catch {
      // Silently fail if performance logger unavailable
    }
  }

  // Call actual LLM (dynamic import to make it optional)
  let llmUtils;
  try {
    llmUtils = await import('@arclabs561/llm-utils');
  } catch (error) {
    throw new ValidationError(
      `LLM call requires @arclabs561/llm-utils package. ` +
      `Install it with: npm install @arclabs561/llm-utils. ` +
      `Error: ${error.message}`,
      {
        package: '@arclabs561/llm-utils',
        installationCommand: 'npm install @arclabs561/llm-utils',
        originalError: error.message
      }
    );
  }

  const startTime = Date.now();
  const response = await llmUtils.callLLM(prompt, provider, apiKey, llmOptions);
  const latency = Date.now() - startTime;

  // Cache the response (if caching enabled)
  // Use normalized prompt for cache key consistency
  if (useCache) {
    setCachedTextLLM(normalizedPrompt, provider, llmOptions, response);
  }

  return response;
}

/**
 * Re-export callLLM from @arclabs561/llm-utils for convenience
 * (non-cached version, in case someone needs it)
 */
export async function callLLMUncached(prompt, provider, apiKey, options = {}) {
  const llmUtils = await import('@arclabs561/llm-utils');
  return llmUtils.callLLM(prompt, provider, apiKey, options);
}

