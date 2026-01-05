/**
 * Configuration System
 *
 * Handles provider selection, API keys, and settings.
 * Designed to be flexible and extensible.
 */

import { ConfigError } from './errors.mjs';
import { loadEnv } from './load-env.mjs';
import { API_CONSTANTS } from './constants.mjs';
import { MODEL_TIERS, PROVIDER_CONFIGS } from './provider-data.mjs';

// Load .env file on module load
loadEnv();

/**
 * Create configuration from environment or options
 *
 * @param {import('./index.mjs').ConfigOptions} [options={}] - Configuration options
 * @returns {import('./index.mjs').Config} Configuration object
 */
export function createConfig(options = {}) {
  const {
    provider = null,
    apiKey = null,
    env = process.env,
    cacheDir = null,
    cacheEnabled = true,
    maxConcurrency = API_CONSTANTS.DEFAULT_MAX_CONCURRENCY,
    timeout = API_CONSTANTS.DEFAULT_TIMEOUT_MS,
    verbose = false,
    modelTier = null, // 'fast', 'balanced', 'best', or null for default
    model = null      // Explicit model override
  } = options;

  // Auto-detect provider if not specified
  let selectedProvider = provider;
  if (!selectedProvider) {
    selectedProvider = detectProvider(env);
  }

  // Get API key - respect explicit null/undefined (don't check env if null/undefined is explicitly passed)
  // Check if apiKey was explicitly provided in options (vs defaulting to null)
  const apiKeyExplicitlyProvided = 'apiKey' in options;
  let selectedApiKey;
  if (apiKeyExplicitlyProvided && (apiKey === null || apiKey === undefined)) {
    // Explicitly null/undefined - don't check env, use null
    selectedApiKey = null;
  } else {
    // apiKey not provided or has a value - use it if provided, otherwise check env
    selectedApiKey = apiKey || getApiKey(selectedProvider, env);
  }

  // Get provider config
  let providerConfig = { ...PROVIDER_CONFIGS[selectedProvider] || PROVIDER_CONFIGS.gemini };

  // Override model if specified
  if (model) {
    providerConfig.model = model;
  } else if (modelTier && MODEL_TIERS[selectedProvider] && MODEL_TIERS[selectedProvider][modelTier]) {
    // Use tier-based model selection
    providerConfig.model = MODEL_TIERS[selectedProvider][modelTier];
  } else if (env.VLM_MODEL_TIER && MODEL_TIERS[selectedProvider] && MODEL_TIERS[selectedProvider][env.VLM_MODEL_TIER]) {
    // Check environment variable for model tier
    providerConfig.model = MODEL_TIERS[selectedProvider][env.VLM_MODEL_TIER];
  } else if (env.VLM_MODEL) {
    // Explicit model override from environment
    providerConfig.model = env.VLM_MODEL;
  }

  return {
    provider: selectedProvider,
    apiKey: selectedApiKey,
    providerConfig,
    enabled: !!selectedApiKey,
    cache: {
      enabled: cacheEnabled,
      dir: cacheDir
    },
    performance: {
      maxConcurrency,
      timeout
    },
    debug: {
      verbose
    }
  };
}

/**
 * Detect provider from environment variables
 */
function detectProvider(env) {
  // Priority: explicit VLM_PROVIDER > auto-detect from API keys > default to gemini
  const explicitProvider = env.VLM_PROVIDER?.trim().toLowerCase();
  if (explicitProvider && PROVIDER_CONFIGS[explicitProvider]) {
    return explicitProvider;
  }

  // Auto-detect: prefer cheaper/faster providers first
  // Groq has priority 0 (highest) for high-frequency decisions
  const availableProviders = Object.values(PROVIDER_CONFIGS)
    .filter(config => {
      // Check provider-specific key
      const providerKey = env[`${config.name.toUpperCase()}_API_KEY`];
      if (providerKey) {
        return true;
      }
      // Special case: Anthropic uses ANTHROPIC_API_KEY
      if (config.name === 'claude' && env.ANTHROPIC_API_KEY) {
        return true;
      }
      // Fallback to generic API_KEY
      return !!env.API_KEY;
    })
    .sort((a, b) => a.priority - b.priority); // Lower priority number = higher priority

  return availableProviders.length > 0
    ? availableProviders[0].name
    : 'gemini'; // Default to gemini (cheapest)
}

/**
 * Get API key for provider
 */
function getApiKey(provider, env) {
  // Check provider-specific key first
  const providerKey = env[`${provider.toUpperCase()}_API_KEY`];
  if (providerKey) {
    return providerKey;
  }

  // Special case: Anthropic uses ANTHROPIC_API_KEY (not CLAUDE_API_KEY)
  if (provider === 'claude' && env.ANTHROPIC_API_KEY) {
    return env.ANTHROPIC_API_KEY;
  }

  // Special case: Groq uses GROQ_API_KEY
  if (provider === 'groq' && env.GROQ_API_KEY) {
    return env.GROQ_API_KEY;
  }

  // Fallback to generic API_KEY
  return env.API_KEY || null;
}

/**
 * Get current configuration (singleton)
 *
 * @returns {import('./index.mjs').Config} Current configuration
 */
let configInstance = null;

export function getConfig() {
  if (!configInstance) {
    configInstance = createConfig();
  }
  return configInstance;
}

/**
 * Set configuration (useful for testing)
 *
 * @param {import('./index.mjs').Config} config - Configuration to set
 * @returns {void}
 */
export function setConfig(config) {
  configInstance = config;
}

/**
 * Get provider configuration
 *
 * @param {string | null} [providerName=null] - Provider name, or null to use default
 * @returns {import('./index.mjs').Config['providerConfig']} Provider configuration
 */
export function getProvider(providerName = null) {
  const config = getConfig();
  const provider = providerName || config.provider;
  return PROVIDER_CONFIGS[provider] || PROVIDER_CONFIGS.gemini;
}
