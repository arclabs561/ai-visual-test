/** Startup configuration validation. */
import { ConfigError } from '#errors';
import { createConfig, getConfig } from './config.js';
import type { Environment } from './config.js';
import { warn, error } from './logger.js';
import { PROVIDER_NAMES, canonicalizeProviderName } from './provider-data.mjs';

export type StartupProvider = 'gemini' | 'openai' | 'claude' | 'groq' | 'openrouter';
export interface StartupValidationOptions {
  strict?: boolean;
  provider?: string | null;
  /** Environment to validate instead of the process environment. */
  env?: Environment;
}
export interface StartupValidationResult { valid: boolean; warnings: string[]; }

const REQUIRED_ENV_VARS: Record<StartupProvider, readonly string[]> = {
  gemini: ['GEMINI_API_KEY'], openai: ['OPENAI_API_KEY'], claude: ['ANTHROPIC_API_KEY'],
  groq: ['GROQ_API_KEY'], openrouter: ['OPENROUTER_API_KEY'],
};
const supportedProviders: readonly StartupProvider[] = PROVIDER_NAMES as readonly StartupProvider[];

function isStartupProvider(value: string): value is StartupProvider {
  return supportedProviders.includes(value as StartupProvider);
}
function errorMessage(caught: unknown): string {
  return caught instanceof Error ? caught.message : String(caught);
}

/** Validate the configured provider and its required API key. */
export function validateStartup(options: StartupValidationOptions = {}): StartupValidationResult {
  const { strict = true, provider = null, env } = options;
  try {
    // An injected environment must drive every configuration decision here.
    // `getConfig` is a process-wide singleton, so it would otherwise mix the
    // supplied provider with API-key and enabled state from process.env.
    const config = env ? createConfig({ provider, env }) : getConfig();
    const environment = env ?? process.env;
    const rawProvider = canonicalizeProviderName(provider || config.provider);
    const providerToCheck = typeof rawProvider === 'string' ? rawProvider : '';
    if (!providerToCheck) {
      const message = 'No provider configured. Set VLM_PROVIDER environment variable or provide provider in config. Supported providers: gemini, openai, claude, groq, openrouter. At least one API key must be set: GEMINI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, GROQ_API_KEY, or OPENROUTER_API_KEY.';
      if (strict) throw new ConfigError(message, { supportedProviders, requiredEnvVars: Object.values(REQUIRED_ENV_VARS).flat() });
      warn('[StartupValidation] No provider configured. Some features may not work.');
      return { valid: false, warnings: ['No provider configured'] };
    }
    if (!isStartupProvider(providerToCheck)) {
      const message = `Invalid provider: ${providerToCheck}. Supported providers: ${supportedProviders.join(', ')}.`;
      if (strict) throw new ConfigError(message, { provided: providerToCheck, supported: supportedProviders });
      warn(`[StartupValidation] Invalid provider: ${providerToCheck}`);
      return { valid: false, warnings: [`Invalid provider: ${providerToCheck}`] };
    }
    const requiredVars = REQUIRED_ENV_VARS[providerToCheck];
    const missingVars = requiredVars.filter((key) => !environment[key]);
    if (missingVars.length > 0) {
      const firstMissing = missingVars[0];
      const message = `Missing required environment variables for provider '${providerToCheck}': ${missingVars.join(', ')}. Set these in your .env file or as environment variables. Example: ${firstMissing}=your-api-key-here`;
      if (strict) throw new ConfigError(message, { provider: providerToCheck, missingVars, requiredVars });
      warn(`[StartupValidation] ${message}`);
      return { valid: false, warnings: [message] };
    }
    if (!config.enabled) {
      warn('[StartupValidation] VLLM validation is disabled. Set enabled: true in config to enable.');
      return { valid: true, warnings: ['VLLM validation is disabled'] };
    }
    return { valid: true, warnings: [] };
  } catch (caught) {
    if (caught instanceof ConfigError) throw caught;
    const message = errorMessage(caught);
    error('[StartupValidation] Unexpected error during validation:', caught);
    if (strict) throw new ConfigError(`Startup validation failed: ${message}`, { originalError: message });
    return { valid: false, warnings: [`Validation error: ${message}`] };
  }
}

/** Non-throwing startup validation. */
export function validateStartupSoft(options: Omit<StartupValidationOptions, 'strict'> = {}): StartupValidationResult {
  return validateStartup({ ...options, strict: false });
}
