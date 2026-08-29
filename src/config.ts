/**
 * Configuration System
 *
 * Handles provider selection, API keys, and settings.
 * Designed to be flexible and extensible.
 */

import { loadEnv } from './load-env.js';
import { API_CONSTANTS } from './constants.js';
import { MODEL_TIERS, PROVIDER_CONFIGS, canonicalizeProviderName } from './provider-data.mjs';

export type Environment = Record<string, string | undefined>;
type ModelTier = 'fast' | 'balanced' | 'best';
type AnchorEntry = string | { text?: string; image?: string; label?: string; dimension?: string };

export interface VisualAnchors {
  domain?: string;
  positive?: AnchorEntry[];
  negative?: AnchorEntry[];
}

export interface ConfigOptions {
  provider?: string | null;
  apiKey?: string | null;
  env?: Environment;
  cacheDir?: string | null;
  cacheEnabled?: boolean;
  maxConcurrency?: number;
  timeout?: number;
  verbose?: boolean;
  modelTier?: ModelTier | null;
  model?: string | null;
  anchors?: VisualAnchors | null;
}

export interface ProviderConfig {
  name: string;
  apiUrl: string;
  model: string;
  freeTier: boolean;
  pricing: { input: number; output: number };
  priority: number;
  latency?: number;
  throughput?: number;
  visionSupported?: boolean;
}

export interface Config {
  provider: string;
  apiKey: string | null;
  providerConfig: ProviderConfig;
  enabled: boolean;
  anchors: VisualAnchors | null;
  cache: { enabled: boolean; dir: string | null };
  performance: { maxConcurrency: number; timeout: number };
  debug: { verbose: boolean };
}

const providerConfigs = PROVIDER_CONFIGS as Record<string, ProviderConfig>;
const modelTiers = MODEL_TIERS as Record<string, Partial<Record<ModelTier, string>>>;

function canonicalProviderName(value: string | null | undefined): string {
  const canonical = canonicalizeProviderName(value);
  return typeof canonical === 'string' ? canonical : 'gemini';
}

function defaultProviderConfig(): ProviderConfig {
  const gemini = providerConfigs.gemini;
  if (!gemini) {
    throw new Error('Gemini provider configuration is missing');
  }
  return gemini;
}

// Load .env file on module load
loadEnv();

/**
 * Create configuration from environment or options.
 *
 * Precedence (highest to lowest):
 *   1. Explicit options (provider, apiKey, model, modelTier)
 *   2. Environment variables (VLM_PROVIDER, VLM_MODEL, VLM_MODEL_TIER, *_API_KEY)
 *   3. Defaults (auto-detect cheapest provider, default model per provider)
 *
 * @param options - Configuration options
 * @returns Configuration object
 */
export function createConfig(options: ConfigOptions = {}): Config {
  const {
    provider = null,
    apiKey = null,
    env = process.env,
    cacheDir = null,
    cacheEnabled = process.env.DISABLE_LLM_CACHE !== 'true',
    maxConcurrency = API_CONSTANTS.DEFAULT_MAX_CONCURRENCY,
    timeout = API_CONSTANTS.DEFAULT_TIMEOUT_MS,
    verbose = false,
    modelTier = null, // 'fast', 'balanced', 'best', or null for default
    model = null,     // Explicit model override
    anchors = null    // Domain visual anchors: { domain?, positive?: string[], negative?: string[] }
  } = options;

  // Auto-detect provider if not specified
  const selectedProvider = canonicalProviderName(provider || detectProvider(env));

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
  const providerConfig = { ...(providerConfigs[selectedProvider] ?? defaultProviderConfig()) };

  // Override model if specified
  if (model) {
    providerConfig.model = model;
  } else if (modelTier) {
    // Use tier-based model selection
    const tierModel = modelTiers[selectedProvider]?.[modelTier];
    if (tierModel) providerConfig.model = tierModel;
  } else if (env.VLM_MODEL_TIER && isModelTier(env.VLM_MODEL_TIER)) {
    // Check environment variable for model tier
    const tierModel = modelTiers[selectedProvider]?.[env.VLM_MODEL_TIER];
    if (tierModel) providerConfig.model = tierModel;
  } else if (env.VLM_MODEL) {
    // Explicit model override from environment
    providerConfig.model = env.VLM_MODEL;
  }

  // Normalize anchors: ensure arrays, filter empty/invalid entries.
  // Each entry can be a plain string or { text?, image?, label?, dimension? }.
  let normalizedAnchors: VisualAnchors | null = null;
  if (anchors && typeof anchors === 'object') {
    const normalizeEntries = (entries: unknown): AnchorEntry[] => {
      if (!Array.isArray(entries)) return [];
      return entries.filter((entry): entry is AnchorEntry => {
        if (typeof entry === 'string') return entry.trim().length > 0;
        if (entry && typeof entry === 'object') {
          const candidate = entry as { text?: unknown; image?: unknown };
          return (typeof candidate.text === 'string' && candidate.text.trim().length > 0) ||
                 (typeof candidate.image === 'string' && candidate.image.trim().length > 0);
        }
        return false;
      });
    };
    const pos = normalizeEntries(anchors.positive);
    const neg = normalizeEntries(anchors.negative);
    const domain = typeof anchors.domain === 'string' ? anchors.domain.trim() : '';

    if (pos.length > 0 || neg.length > 0 || domain) {
      normalizedAnchors = {};
      if (domain) normalizedAnchors.domain = domain;
      if (pos.length > 0) normalizedAnchors.positive = pos;
      if (neg.length > 0) normalizedAnchors.negative = neg;
    }
  }

  const enabled = !!selectedApiKey;
  if (!enabled && selectedProvider) {
    const expectedKey = selectedProvider === 'claude' ? 'ANTHROPIC_API_KEY' : `${selectedProvider.toUpperCase()}_API_KEY`;
    // Import warn lazily to avoid circular deps at module load
    import('./logger.js').then(({ warn }) => {
      warn(`[Config] No API key found for provider "${selectedProvider}". Set ${expectedKey} in your environment or .env file. VLM calls will be disabled.`);
    }).catch(() => {});
  }

  return {
    provider: selectedProvider,
    apiKey: selectedApiKey,
    providerConfig,
    enabled,
    anchors: normalizedAnchors,
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
function isModelTier(value: string): value is ModelTier {
  return value === 'fast' || value === 'balanced' || value === 'best';
}

function detectProvider(env: Environment): string {
  // Priority: explicit VLM_PROVIDER > auto-detect from API keys > default to gemini
  const explicitProvider = env.VLM_PROVIDER?.trim().toLowerCase();
  if (explicitProvider && providerConfigs[explicitProvider]) {
    return explicitProvider;
  }

  // Auto-detect: prefer cheaper/faster providers first
  // Groq has priority 0 (highest) for high-frequency decisions
  const availableProviders = Object.values(providerConfigs)
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
    ? availableProviders[0]?.name ?? 'gemini'
    : 'gemini'; // Default to gemini (cheapest)
}

/**
 * Get API key for provider
 */
function getApiKey(provider: string, env: Environment): string | null {
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
 * @returns {import('#public-contract').Config} Current configuration
 */
let configInstance: Config | null = null;

export function getConfig(): Config {
  if (!configInstance) {
    configInstance = createConfig();
  }
  return configInstance;
}

/**
 * Set configuration (useful for testing)
 *
 * @param config - Configuration to set, or null to clear the singleton.
 */
export function setConfig(config: Config | null): void {
  configInstance = config;
}

/**
 * Get provider configuration
 *
 * @param providerName - Provider name, or null to use default
 * @returns Provider configuration
 */
export function getProvider(providerName: string | null = null): ProviderConfig {
  const config = getConfig();
  const provider = providerName || config.provider;
  return providerConfigs[provider] ?? defaultProviderConfig();
}
