#!/usr/bin/env node

/**
 * ai-visual-test CLI
 *
 * Validate screenshots against natural-language expectations using
 * Vision Language Models.
 *
 * Usage:
 *   ai-visual-test check <image> "<prompt>" [options]
 *   ai-visual-test --help
 *   ai-visual-test --version
 */

import { readFileSync, existsSync, statSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkgPath = join(__dirname, '..', 'package.json');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readVersion() {
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    return pkg.version;
  } catch {
    return 'unknown';
  }
}

// Detection order: cheapest/fastest first (matches src/config.mjs priority)
const PROVIDER_ENV_MAP = {
  groq: 'GROQ_API_KEY',
  gemini: 'GEMINI_API_KEY',
  openai: 'OPENAI_API_KEY',
  claude: 'ANTHROPIC_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
};

function detectProvider() {
  for (const [provider, envVar] of Object.entries(PROVIDER_ENV_MAP)) {
    if (process.env[envVar]) {
      return provider;
    }
  }
  return null;
}

function die(message, code = 1) {
  process.stderr.write(`Error: ${message}\n`);
  process.exit(code);
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = argv.slice(2); // strip node + script
  const parsed = {
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

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
      i++;
    } else if (arg === '--version' || arg === '-V') {
      parsed.version = true;
      i++;
    } else if (arg === '--json') {
      parsed.json = true;
      i++;
    } else if (arg === '--verbose' || arg === '-v') {
      parsed.verbose = true;
      i++;
    } else if (arg === '--provider' && i + 1 < args.length) {
      parsed.provider = args[i + 1];
      i += 2;
    } else if (arg === '--model' && i + 1 < args.length) {
      parsed.model = args[i + 1];
      i += 2;
    } else if (arg === '--min-score' && i + 1 < args.length) {
      const n = Number(args[i + 1]);
      if (Number.isNaN(n) || n < 0 || n > 10) {
        die('--min-score must be a number between 0 and 10');
      }
      parsed.minScore = n;
      i += 2;
    } else if (arg.startsWith('-')) {
      die(`Unknown option: ${arg}\nRun "ai-visual-test --help" for usage.`);
    } else if (!parsed.command) {
      parsed.command = arg;
      i++;
    } else if (parsed.command === 'check' && !parsed.image) {
      parsed.image = arg;
      i++;
    } else if (parsed.command === 'check' && !parsed.prompt) {
      parsed.prompt = arg;
      i++;
    } else {
      die(`Unexpected argument: ${arg}\nRun "ai-visual-test --help" for usage.`);
    }
  }

  return parsed;
}

// ---------------------------------------------------------------------------
// Help text
// ---------------------------------------------------------------------------

const HELP = `\
ai-visual-test v${readVersion()}

Validate screenshots against natural-language expectations using
Vision Language Models (Gemini, OpenAI, Claude, Groq).

USAGE
  ai-visual-test check <image> "<prompt>" [options]
  ai-visual-test --help
  ai-visual-test --version

COMMANDS
  check   Validate a screenshot against a prompt

CHECK OPTIONS
  --provider <name>    LLM provider (groq, gemini, openai, claude, openrouter)
                       Auto-detected from env vars if omitted
  --model <name>       Model name (provider-specific)
  --min-score <n>      Minimum passing score, 0-10 (default: 7)
  --json               Machine-readable JSON output
  --verbose            Show additional details
  -h, --help           Show this help
  -V, --version        Show version

ENVIRONMENT
  GROQ_API_KEY         Groq (cheapest, auto-detected first)
  GEMINI_API_KEY       Gemini
  OPENAI_API_KEY       OpenAI
  ANTHROPIC_API_KEY    Claude (not CLAUDE_API_KEY)
  OPENROUTER_API_KEY   OpenRouter

  Provider is auto-detected from whichever key is set (cheapest
  first). Explicit --provider flag takes precedence.

  A .env file in the current directory is loaded automatically.

EXIT CODES
  0   Score >= min-score (pass)
  1   Score < min-score (fail) or runtime error
`;

// ---------------------------------------------------------------------------
// Human-readable output
// ---------------------------------------------------------------------------

function formatHuman(result, minScore, verbose) {
  const lines = [];
  const score = result.score ?? 'N/A';
  const pass = typeof result.score === 'number' && result.score >= minScore;

  lines.push(`Score:    ${score}/10`);
  lines.push(`Result:   ${pass ? 'PASSED' : 'FAILED'} (threshold: ${minScore})`);

  if (result.provider) {
    lines.push(`Provider: ${result.provider}${result.model ? ` (${result.model})` : ''}`);
  }

  if (result.issues && result.issues.length > 0) {
    lines.push('');
    lines.push('Issues:');
    for (const issue of result.issues) {
      lines.push(`  - ${issue}`);
    }
  }

  if (result.recommendations && result.recommendations.length > 0) {
    lines.push('');
    lines.push('Recommendations:');
    for (const rec of result.recommendations) {
      lines.push(`  - ${rec}`);
    }
  }

  if (result.strengths && result.strengths.length > 0) {
    lines.push('');
    lines.push('Strengths:');
    for (const s of result.strengths) {
      lines.push(`  - ${s}`);
    }
  }

  if (verbose) {
    if (result.judgment) {
      lines.push('');
      lines.push('Judgment:');
      lines.push(`  ${result.judgment}`);
    }
    if (result.rawScore !== undefined && result.rawScore !== result.score) {
      lines.push(`Raw score (before calibration): ${result.rawScore}`);
    }
    if (result.estimatedCost !== undefined) {
      const cost = typeof result.estimatedCost === 'number'
        ? result.estimatedCost
        : result.estimatedCost?.total ?? 0;
      lines.push(`Estimated cost: $${cost.toFixed(4)}`);
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const parsed = parseArgs(process.argv);

  if (parsed.help) {
    process.stdout.write(HELP + '\n');
    process.exit(0);
  }

  if (parsed.version) {
    process.stdout.write(readVersion() + '\n');
    process.exit(0);
  }

  if (!parsed.command) {
    die('No command specified. Run "ai-visual-test --help" for usage.');
  }

  if (parsed.command !== 'check') {
    die(`Unknown command: ${parsed.command}\nRun "ai-visual-test --help" for usage.`);
  }

  // --- check command ---

  if (!parsed.image) {
    die('Missing <image> argument.\nUsage: ai-visual-test check <image> "<prompt>"');
  }
  if (!parsed.prompt) {
    die('Missing "<prompt>" argument.\nUsage: ai-visual-test check <image> "<prompt>"');
  }

  const imagePath = resolve(parsed.image);
  if (!existsSync(imagePath)) {
    die(`Image file not found: ${imagePath}`);
  }
  try {
    if (statSync(imagePath).isDirectory()) {
      die(`Path is a directory, not an image file: ${imagePath}`);
    }
  } catch {
    // statSync failed -- existsSync passed, so this shouldn't happen
  }

  // Load .env BEFORE detecting provider so .env keys are available
  const { loadEnv } = await import('../src/load-env.mjs');
  loadEnv(process.cwd());

  // Validate --provider if explicitly set
  const validProviders = Object.keys(PROVIDER_ENV_MAP);
  if (parsed.provider && !validProviders.includes(parsed.provider)) {
    die(`Unknown provider: "${parsed.provider}". Must be one of: ${validProviders.join(', ')}`);
  }

  // Determine provider (explicit flag > auto-detect from env)
  const provider = parsed.provider || detectProvider();
  if (!provider) {
    const keys = Object.values(PROVIDER_ENV_MAP).join(', ');
    die(
      `No provider detected. Set one of the following environment variables:\n  ${keys}\nOr use --provider <name>.`
    );
  }

  // Verify the API key is available for the chosen provider
  const envVar = PROVIDER_ENV_MAP[provider];
  if (envVar && !process.env[envVar]) {
    die(`Provider "${provider}" selected but ${envVar} is not set.`);
  }

  // Build context
  const context = { provider };
  if (parsed.model) {
    context.model = parsed.model;
  }
  if (parsed.verbose) {
    context.debug = { verbose: true };
  }

  // Run validation
  const { validateScreenshot } = await import('../src/judge.mjs');

  let result;
  try {
    result = await validateScreenshot(imagePath, parsed.prompt, context);
  } catch (err) {
    if (parsed.json) {
      process.stdout.write(JSON.stringify({ error: err.message }, null, 2) + '\n');
    } else {
      die(err.message);
    }
    process.exit(1);
  }

  // Output
  const pass = typeof result.score === 'number' && result.score >= parsed.minScore;

  if (parsed.json) {
    const output = { ...result, pass, minScore: parsed.minScore };
    process.stdout.write(JSON.stringify(output, null, 2) + '\n');
  } else {
    process.stdout.write(formatHuman(result, parsed.minScore, parsed.verbose) + '\n');
  }

  process.exit(pass ? 0 : 1);
}

main().catch(err => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
