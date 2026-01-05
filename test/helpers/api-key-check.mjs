/**
 * API Key Check Helper
 * 
 * Provides utilities to check if API keys are available for tests.
 * Tests should skip gracefully when API keys are missing.
 */

import { createConfig } from '../../src/config.mjs';

/**
 * Check if any API provider is enabled (has valid API key)
 * 
 * @returns {boolean} True if at least one provider has an API key
 */
export function hasAnyApiKey() {
  const config = createConfig();
  return config.enabled;
}

/**
 * Check if a specific provider has an API key
 * 
 * @param {string} provider - Provider name (gemini, openai, claude, groq)
 * @returns {boolean} True if provider has API key
 */
export function hasApiKey(provider) {
  const config = createConfig({ provider });
  return config.enabled;
}

/**
 * Get list of available providers (those with API keys)
 * 
 * @returns {string[]} Array of provider names with API keys
 */
export function getAvailableProviders() {
  const providers = ['gemini', 'openai', 'claude', 'groq'];
  return providers.filter(p => hasApiKey(p));
}

/**
 * Skip test if no API keys are available
 * 
 * @param {TestContext} testContext - Node test context (this)
 * @param {string} [message] - Optional skip message
 * @returns {boolean} True if test should be skipped
 */
export function skipIfNoApiKey(testContext, message = 'No API keys available') {
  if (!hasAnyApiKey()) {
    testContext.skip(message);
    return true;
  }
  return false;
}

/**
 * Skip test if specific provider doesn't have API key
 * 
 * @param {TestContext} testContext - Node test context (this)
 * @param {string} provider - Provider name
 * @param {string} [message] - Optional skip message
 * @returns {boolean} True if test should be skipped
 */
export function skipIfNoProviderKey(testContext, provider, message = null) {
  if (!hasApiKey(provider)) {
    const skipMsg = message || `No ${provider.toUpperCase()}_API_KEY available`;
    testContext.skip(skipMsg);
    return true;
  }
  return false;
}

