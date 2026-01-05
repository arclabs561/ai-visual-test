/**
 * Provider Pricing Configuration
 * 
 * Central source of truth for provider pricing.
 * Used by config.mjs and cost-optimization.mjs.
 * 
 * Pricing per 1M tokens (USD).
 * Last updated: June 2025
 */
export const PROVIDER_PRICING = {
  gemini: {
    input: 0.10,
    output: 0.40
  },
  openai: {
    input: 5.00,
    output: 15.00
  },
  claude: {
    input: 3.00,
    output: 15.00
  },
  groq: {
    input: 0.59,
    output: 0.79
  }
};

