/**
 * Startup Validation
 * 
 * Validates required environment variables and configuration at startup.
 * Provides clear error messages if required configuration is missing.
 */

import { ConfigError } from './errors.mjs';
import { getConfig } from './config.mjs';
import { warn, error } from './logger.mjs';

/**
 * Required environment variables for each provider
 */
const REQUIRED_ENV_VARS = {
  gemini: ['GEMINI_API_KEY'],
  openai: ['OPENAI_API_KEY'],
  anthropic: ['ANTHROPIC_API_KEY'],
  claude: ['ANTHROPIC_API_KEY'], // Claude uses Anthropic API key
  groq: ['GROQ_API_KEY'],
  openrouter: ['OPENROUTER_API_KEY']
};

/**
 * Validate startup configuration
 * 
 * @param {Object} [options={}] - Validation options
 * @param {boolean} [options.strict=true] - If true, throw on missing required vars. If false, warn only.
 * @param {string} [options.provider=null] - Provider to validate (auto-detects if null)
 * @throws {ConfigError} If strict mode and required vars are missing
 */
export function validateStartup(options = {}) {
  const { strict = true, provider = null } = options;
  
  try {
    const config = getConfig();
    const providerToCheck = provider || config.provider;
    
    if (!providerToCheck) {
      if (strict) {
        throw new ConfigError(
          'No provider configured. Set VLM_PROVIDER environment variable or provide provider in config. ' +
          'Supported providers: gemini, openai, claude, groq, openrouter. ' +
          'At least one API key must be set: GEMINI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, GROQ_API_KEY, or OPENROUTER_API_KEY.',
          {
            supportedProviders: ['gemini', 'openai', 'claude', 'groq', 'openrouter'],
            requiredEnvVars: ['GEMINI_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GROQ_API_KEY', 'OPENROUTER_API_KEY']
          }
        );
      } else {
        warn('[StartupValidation] No provider configured. Some features may not work.');
        return { valid: false, warnings: ['No provider configured'] };
      }
    }
    
    // Check if provider is valid
    const validProviders = ['gemini', 'openai', 'claude', 'anthropic', 'groq', 'openrouter'];
    if (!validProviders.includes(providerToCheck.toLowerCase())) {
      if (strict) {
        throw new ConfigError(
          `Invalid provider: ${providerToCheck}. Supported providers: ${validProviders.join(', ')}.`,
          {
            provided: providerToCheck,
            supported: validProviders
          }
        );
      } else {
        warn(`[StartupValidation] Invalid provider: ${providerToCheck}`);
        return { valid: false, warnings: [`Invalid provider: ${providerToCheck}`] };
      }
    }
    
    // Check required API keys for the provider
    const requiredVars = REQUIRED_ENV_VARS[providerToCheck.toLowerCase()] || [];
    const missingVars = requiredVars.filter(key => !process.env[key]);
    
    if (missingVars.length > 0) {
      const errorMsg = `Missing required environment variables for provider '${providerToCheck}': ${missingVars.join(', ')}. ` +
        `Set these in your .env file or as environment variables. ` +
        `Example: ${missingVars[0]}=your-api-key-here`;
      
      if (strict) {
        throw new ConfigError(errorMsg, {
          provider: providerToCheck,
          missingVars,
          requiredVars
        });
      } else {
        warn(`[StartupValidation] ${errorMsg}`);
        return { valid: false, warnings: [errorMsg] };
      }
    }
    
    // Check if config is enabled
    if (!config.enabled) {
      warn('[StartupValidation] VLLM validation is disabled. Set enabled: true in config to enable.');
      return { valid: true, warnings: ['VLLM validation is disabled'] };
    }
    
    return { valid: true, warnings: [] };
  } catch (err) {
    if (err instanceof ConfigError) {
      throw err;
    }
    
    // Unexpected error
    error('[StartupValidation] Unexpected error during validation:', err);
    if (strict) {
      throw new ConfigError(
        `Startup validation failed: ${err.message}`,
        { originalError: err.message }
      );
    }
    return { valid: false, warnings: [`Validation error: ${err.message}`] };
  }
}

/**
 * Validate startup configuration (non-strict, returns warnings)
 * 
 * @param {Object} [options={}] - Validation options
 * @returns {Object} Validation result with valid flag and warnings array
 */
export function validateStartupSoft(options = {}) {
  return validateStartup({ ...options, strict: false });
}

