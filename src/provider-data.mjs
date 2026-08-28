/**
 * Provider Data & Pricing Configuration
 * 
 * Central source of truth for provider configuration, models, and pricing.
 * Extracted from config.mjs to facilitate updates and prevent drift.
 * 
 * ⚠️ IMPORTANT: Model names should be verified against current provider documentation.
 * Some models may be preview-only, deprecated, or have different names in production.
*/

export const PROVIDER_NAMES = Object.freeze(['gemini', 'openai', 'claude', 'groq', 'openrouter']);
export const PROVIDER_ALIASES = Object.freeze({ anthropic: 'claude' });

export function canonicalizeProviderName(provider) {
  if (typeof provider !== 'string') return provider;
  const normalized = provider.toLowerCase().trim();
  return PROVIDER_ALIASES[normalized] || normalized;
}

/**
 * Model tiers for each provider
 * 
 * Models can be overridden via environment variables:
 * - VLM_MODEL_TIER: 'fast' | 'balanced' | 'best'
 * - VLM_MODEL: explicit model name override
 * 
 * GROQ INTEGRATION:
 * - Groq added for high-frequency decisions (10-60Hz temporal decisions)
 * - ~0.22s latency (vs 1-3s for other providers)
 * - 185-276 tokens/sec throughput
 * - OpenAI-compatible API
 * - Cost-competitive, free tier available
 * - Useful for: Fast tier decisions, high-Hz temporal decisions, real-time applications
 */
export const MODEL_TIERS = {
  gemini: {
    fast: 'gemini-2.5-flash',          // Fast, cost-effective (stable)
    balanced: 'gemini-2.5-flash',      // Good balance (using Flash as default balanced too)
    best: 'gemini-3-pro-preview'       // High quality (preview)
  },
  openai: {
    fast: 'gpt-4o-mini',               // Fast, cheaper
    balanced: 'gpt-4o',                // Balanced (current production)
    best: 'gpt-5'                      // High quality (late 2025, latest production)
  },
  claude: {
    fast: 'claude-haiku-4-5',           // Fast, cheaper (Haiku 4.5, Feb 2025)
    balanced: 'claude-sonnet-4-5',      // Balanced (Sept 2025)
    best: 'claude-opus-4-6'             // High quality (Opus 4.6, March 2026)
  },
  groq: {
    // Qwen 3.6 27B is Groq's current broadly available vision model.
    fast: 'qwen/qwen3.6-27b',
    balanced: 'qwen/qwen3.6-27b',
    best: 'qwen/qwen3.6-27b'
  },
  openrouter: {
    // OpenRouter provides access to multiple models via unified API
    fast: 'anthropic/claude-haiku-4-5',       // Fast, cheaper via OpenRouter
    balanced: 'anthropic/claude-sonnet-4-5',  // Balanced via OpenRouter
    best: 'anthropic/claude-opus-4-6'         // High quality via OpenRouter
  }
};

/**
 * Default provider configurations
 * 
 * GROQ INTEGRATION:
 * - OpenAI-compatible API (easy migration)
 * - ~0.22s latency (10x faster than typical providers)
 * - Useful for high-frequency decisions (10-60Hz temporal decisions)
 * - Free tier available for testing
 */
export const PROVIDER_CONFIGS = {
  gemini: {
    name: 'gemini',
    apiUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-2.5-flash',            // Latest stable (June 2025)
    freeTier: true,
    pricing: { input: 0.10, output: 0.40 }, // 2.5 Flash is cheaper
    priority: 1
  },
  openai: {
    name: 'openai',
    apiUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',                    // Current production
    freeTier: false,
    pricing: { input: 5.00, output: 15.00 },
    priority: 2
  },
  claude: {
    name: 'claude',
    apiUrl: 'https://api.anthropic.com/v1',
    model: 'claude-sonnet-4-5',         // Latest flagship (Sept 2025)
    freeTier: false,
    pricing: { input: 3.00, output: 15.00 },
    priority: 3
  },
  groq: {
    name: 'groq',
    apiUrl: 'https://api.groq.com/openai/v1', // OpenAI-compatible endpoint
    model: 'qwen/qwen3.6-27b',          // Vision-capable, up to 3 input images
    freeTier: true,                      // Free tier available
    pricing: { input: 0.60, output: 3.00 }, // Current Qwen 3.6 27B pricing per 1M tokens
    priority: 0,                         // Highest priority for high-frequency decisions
    latency: 220,                        // ~0.22s latency in ms (10x faster than typical)
    throughput: 200,                     // ~200 tokens/sec average
    visionSupported: true
  },
  openrouter: {
    name: 'openrouter',
    apiUrl: 'https://openrouter.ai/api/v1', // OpenAI-compatible endpoint
    model: 'anthropic/claude-sonnet-4',     // Default to Claude Sonnet via OpenRouter
    freeTier: false,
    pricing: { input: 3.00, output: 15.00 }, // Varies by model
    priority: 2,
    visionSupported: true
  }
};
