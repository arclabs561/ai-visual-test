import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

type ProviderName = 'gemini' | 'openai' | 'claude' | 'groq' | 'openrouter';

export type CliErrorCode =
  | 'unknown_option'
  | 'missing_option_value'
  | 'invalid_min_score'
  | 'unexpected_argument'
  | 'missing_command'
  | 'unknown_command'
  | 'missing_image'
  | 'missing_prompt'
  | 'image_not_found'
  | 'image_is_directory'
  | 'unknown_provider'
  | 'provider_not_configured'
  | 'validation_failed';

export type CliArguments = {
  command: 'check' | null;
  image: string | null;
  prompt: string | null;
  provider: string | null;
  model: string | null;
  minScore: number;
  json: boolean;
  verbose: boolean;
  help: boolean;
  version: boolean;
};

export type CliRunResult = {
  exitCode: 0 | 1;
  stdout: string;
  stderr: string;
};

type ParseResult =
  | { ok: true; value: CliArguments }
  | { ok: false; error: { code: CliErrorCode; message: string; json: boolean } };

type ValidationContext = {
  provider: ProviderName;
  model?: string;
  debug?: { verbose: true };
};

type ValidationResult = Record<string, unknown>;
type ValidateScreenshot = (imagePath: string, prompt: string, context: ValidationContext) => Promise<ValidationResult>;

type ResolvedConfig = {
  provider: ProviderName;
  enabled: boolean;
  providerConfig: { model?: string };
};

export type CliDependencies = {
  cwd?: () => string;
  readVersion?: () => string;
  exists?: (path: string) => boolean;
  isDirectory?: (path: string) => boolean;
  loadEnv?: (cwd: string) => void | Promise<void>;
  resolveConfig?: (input: { provider: string | null; model: string | null; verbose: boolean; env: NodeJS.ProcessEnv }) => Promise<ResolvedConfig>;
  validateScreenshot?: ValidateScreenshot;
  env?: NodeJS.ProcessEnv;
};

const PROVIDERS: readonly ProviderName[] = ['gemini', 'openai', 'claude', 'groq', 'openrouter'];
const PROVIDER_ALIASES: Readonly<Record<string, ProviderName>> = { anthropic: 'claude' };

const USAGE = 'Run "ai-visual-test --help" for usage.';

function error(code: CliErrorCode, message: string, json: boolean): ParseResult {
  return { ok: false, error: { code, message, json } };
}

function optionValue(args: readonly string[], index: number, option: string, json: boolean): ParseResult | string {
  const value = args[index + 1];
  if (value === undefined || value.startsWith('-')) {
    return error('missing_option_value', `${option} requires a value.`, json);
  }
  return value;
}

/** Parse CLI arguments without writing streams or terminating the process. */
export function parseCliArgs(args: readonly string[]): ParseResult {
  const wantsJson = args.includes('--json');
  const parsed: CliArguments = {
    command: null,
    image: null,
    prompt: null,
    provider: null,
    model: null,
    minScore: 7,
    json: false,
    verbose: false,
    help: false,
    version: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === undefined) continue;
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    } else if (arg === '--version' || arg === '-V') {
      parsed.version = true;
    } else if (arg === '--json') {
      parsed.json = true;
    } else if (arg === '--verbose' || arg === '-v') {
      parsed.verbose = true;
    } else if (arg === '--provider' || arg === '--model' || arg === '--min-score') {
      const value = optionValue(args, index, arg, wantsJson);
      if (typeof value !== 'string') return value;
      if (arg === '--provider') parsed.provider = value;
      if (arg === '--model') parsed.model = value;
      if (arg === '--min-score') {
        const minScore = Number(value);
        if (!value.trim() || !Number.isFinite(minScore) || minScore < 0 || minScore > 10) {
          return error('invalid_min_score', '--min-score must be a finite number between 0 and 10.', wantsJson);
        }
        parsed.minScore = minScore;
      }
      index += 1;
    } else if (arg.startsWith('-')) {
      return error('unknown_option', `Unknown option: ${arg}\n${USAGE}`, wantsJson);
    } else if (parsed.command === null) {
      parsed.command = arg === 'check' ? 'check' : null;
      if (parsed.command === null) return error('unknown_command', `Unknown command: ${arg}\n${USAGE}`, wantsJson);
    } else if (parsed.image === null) {
      parsed.image = arg;
    } else if (parsed.prompt === null) {
      parsed.prompt = arg;
    } else {
      return error('unexpected_argument', `Unexpected argument: ${arg}\n${USAGE}`, wantsJson);
    }
  }
  return { ok: true, value: parsed };
}

function normalizeProvider(value: string): ProviderName | null {
  const normalized = value.trim().toLowerCase();
  const candidate = PROVIDER_ALIASES[normalized] ?? normalized;
  return PROVIDERS.includes(candidate as ProviderName) ? candidate as ProviderName : null;
}

function messageFrom(errorValue: unknown): string {
  return errorValue instanceof Error && errorValue.message
    ? errorValue.message
    : typeof errorValue === 'string' && errorValue
      ? errorValue
      : 'Validation failed with an unknown error.';
}

function outputError(code: CliErrorCode, message: string, json: boolean): CliRunResult {
  if (json) {
    return { exitCode: 1, stdout: `${JSON.stringify({ error: message, code }, null, 2)}\n`, stderr: '' };
  }
  return { exitCode: 1, stdout: '', stderr: `Error: ${message}\n` };
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

/** Format a normalized review result for an interactive terminal. */
export function formatHuman(result: ValidationResult, minScore: number, verbose: boolean): string {
  const score = typeof result.score === 'number' && Number.isFinite(result.score) ? result.score : null;
  const lines = [`Score:    ${score ?? 'N/A'}/10`, `Result:   ${score !== null && score >= minScore ? 'PASSED' : 'FAILED'} (threshold: ${minScore})`];
  const provider = typeof result.provider === 'string' ? result.provider : null;
  const model = typeof result.model === 'string' ? result.model : null;
  if (provider) lines.push(`Provider: ${provider}${model ? ` (${model})` : ''}`);

  for (const [label, values] of [['Issues', strings(result.issues)], ['Recommendations', strings(result.recommendations)], ['Strengths', strings(result.strengths)]] as const) {
    if (values.length > 0) lines.push('', `${label}:`, ...values.map(value => `  - ${value}`));
  }
  if (verbose) {
    if (typeof result.judgment === 'string' && result.judgment) lines.push('', 'Judgment:', `  ${result.judgment}`);
    if (result.rawScore !== undefined && result.rawScore !== result.score) lines.push(`Raw score (before calibration): ${String(result.rawScore)}`);
    const rawCost = typeof result.estimatedCost === 'number'
      ? result.estimatedCost
      : result.estimatedCost && typeof result.estimatedCost === 'object' && 'total' in result.estimatedCost
        ? (result.estimatedCost as { total?: unknown }).total
        : undefined;
    if (typeof rawCost === 'number' && Number.isFinite(rawCost)) lines.push(`Estimated cost: $${rawCost.toFixed(4)}`);
  }
  return lines.join('\n');
}

export function helpText(version: string): string {
  return `ai-visual-test v${version}

Validate screenshots against natural-language expectations using Vision Language Models.

USAGE
  ai-visual-test check <image> "<prompt>" [options]
  ai-visual-test --help
  ai-visual-test --version

CHECK OPTIONS
  --provider <name>    LLM provider (gemini, openai, claude, groq, openrouter)
  --model <name>       Model name (provider-specific)
  --min-score <n>      Minimum passing score, 0-10 (default: 7)
  --json               Machine-readable JSON output
  --verbose            Show additional details

ENVIRONMENT
  VLM_PROVIDER, VLM_MODEL, API_KEY, and provider-specific *_API_KEY values are supported.
  ANTHROPIC_API_KEY configures Claude.

EXIT CODES
  0   Score >= min-score
  1   Score < min-score or an error`;
}

async function defaultResolveConfig(input: { provider: string | null; model: string | null; verbose: boolean; env: NodeJS.ProcessEnv }): Promise<ResolvedConfig> {
  const { createConfig } = await import('./config.mjs');
  const selected = input.provider ?? (input.env.VLM_PROVIDER ? normalizeProvider(input.env.VLM_PROVIDER) : null);
  const config = createConfig({ provider: selected, model: input.model, verbose: input.verbose, env: input.env });
  return config as ResolvedConfig;
}

async function defaultValidateScreenshot(imagePath: string, prompt: string, context: ValidationContext): Promise<ValidationResult> {
  const { validateScreenshot } = await import('./judge.mjs');
  return validateScreenshot(imagePath, prompt, context) as Promise<ValidationResult>;
}

/** Execute the CLI command with injectable side effects for deterministic tests. */
export async function runCli(args: readonly string[], dependencies: CliDependencies = {}): Promise<CliRunResult> {
  const parsed = parseCliArgs(args);
  if (!parsed.ok) return outputError(parsed.error.code, parsed.error.message, parsed.error.json);
  const options = parsed.value;
  const version = dependencies.readVersion?.() ?? 'unknown';
  if (options.help) return { exitCode: 0, stdout: `${helpText(version)}\n`, stderr: '' };
  if (options.version) return { exitCode: 0, stdout: `${version}\n`, stderr: '' };
  if (options.command === null) return outputError('missing_command', `No command specified. ${USAGE}`, options.json);
  if (options.image === null) return outputError('missing_image', 'Missing <image> argument.\nUsage: ai-visual-test check <image> "<prompt>"', options.json);
  if (options.prompt === null) return outputError('missing_prompt', 'Missing "<prompt>" argument.\nUsage: ai-visual-test check <image> "<prompt>"', options.json);

  const imagePath = resolve(options.image);
  const exists = dependencies.exists ?? existsSync;
  const isDirectory = dependencies.isDirectory ?? (path => statSync(path).isDirectory());
  if (!exists(imagePath)) return outputError('image_not_found', `Image file not found: ${imagePath}`, options.json);
  try {
    if (isDirectory(imagePath)) return outputError('image_is_directory', `Path is a directory, not an image file: ${imagePath}`, options.json);
  } catch (errorValue) {
    return outputError('image_not_found', `Could not inspect image file: ${messageFrom(errorValue)}`, options.json);
  }

  const cwd = dependencies.cwd?.() ?? process.cwd();
  if (dependencies.loadEnv) await dependencies.loadEnv(cwd);
  else (await import('./load-env.mjs')).loadEnv(cwd);
  const explicitProvider = options.provider === null ? null : normalizeProvider(options.provider);
  if (options.provider !== null && explicitProvider === null) {
    return outputError('unknown_provider', `Unknown provider: "${options.provider}". Must be one of: ${[...PROVIDERS, 'anthropic'].join(', ')}`, options.json);
  }
  const env = dependencies.env ?? process.env;
  const config = await (dependencies.resolveConfig ?? defaultResolveConfig)({ provider: explicitProvider, model: options.model, verbose: options.verbose, env });
  if (!config.enabled) {
    return outputError('provider_not_configured', `Provider "${config.provider}" is not configured. Set its API key, or API_KEY.`, options.json);
  }
  const context: ValidationContext = { provider: config.provider };
  const model = options.model ?? config.providerConfig.model;
  if (model !== undefined) context.model = model;
  if (options.verbose) context.debug = { verbose: true };
  try {
    const result = await (dependencies.validateScreenshot ?? defaultValidateScreenshot)(imagePath, options.prompt, context);
    const score = typeof result.score === 'number' && Number.isFinite(result.score) ? result.score : null;
    const pass = score !== null && score >= options.minScore;
    return options.json
      ? { exitCode: pass ? 0 : 1, stdout: `${JSON.stringify({ ...result, pass, minScore: options.minScore }, null, 2)}\n`, stderr: '' }
      : { exitCode: pass ? 0 : 1, stdout: `${formatHuman(result, options.minScore, options.verbose)}\n`, stderr: '' };
  } catch (errorValue) {
    return outputError('validation_failed', messageFrom(errorValue), options.json);
  }
}
