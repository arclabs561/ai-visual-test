import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { formatHuman, parseCliArgs, runCli } from '../../src/cli.js';

const exec = promisify(execFile);
const testDirectory = dirname(fileURLToPath(import.meta.url));
const CLI = join(testDirectory, '..', '..', 'bin', 'ai-visual-test.js');
const sandbox = mkdtempSync(join(tmpdir(), 'ai-visual-cli-'));
const image = join(sandbox, 'test.png');
writeFileSync(image, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'));
test.after(() => rmSync(sandbox, { recursive: true, force: true }));

const readyConfig = async input => ({
  provider: input.provider ?? 'gemini',
  enabled: true,
  providerConfig: { model: input.model ?? 'test-model' },
});

function readyDependencies(overrides = {}) {
  return {
    cwd: () => sandbox,
    exists: () => true,
    isDirectory: () => false,
    loadEnv: () => {},
    resolveConfig: readyConfig,
    validateScreenshot: async () => ({ score: 8, issues: ['contrast'], recommendations: ['increase contrast'] }),
    ...overrides,
  };
}

test('parses valid options without process exits and rejects absent option values', () => {
  const valid = parseCliArgs(['check', 'image.png', 'readable', '--provider', 'openai', '--min-score', '7.5', '--json']);
  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.value.provider, 'openai');
    assert.equal(valid.value.minScore, 7.5);
    assert.equal(valid.value.json, true);
  }

  const missing = parseCliArgs(['check', 'image.png', 'readable', '--model']);
  assert.deepEqual(missing, {
    ok: false,
    error: { code: 'missing_option_value', message: '--model requires a value.', json: false },
  });
  const invalid = parseCliArgs(['check', 'image.png', 'readable', '--min-score', '', '--json']);
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.equal(invalid.error.code, 'invalid_min_score');
});

test('uses canonical provider aliases and returns a typed context to the validator', async () => {
  let configInput;
  let validationContext;
  const result = await runCli(['check', image, 'readable', '--provider', 'anthropic', '--model', 'sonnet'], readyDependencies({
    resolveConfig: async input => {
      configInput = input;
      return { provider: 'claude', enabled: true, providerConfig: { model: 'sonnet' } };
    },
    validateScreenshot: async (_path, _prompt, context) => {
      validationContext = context;
      return { score: 9 };
    },
  }));
  assert.equal(configInput.provider, 'claude');
  assert.deepEqual(validationContext, { provider: 'claude', model: 'sonnet' });
  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /PASSED/);
});

test('honors VLM_PROVIDER and generic API_KEY through the canonical config path', async () => {
  let context;
  const result = await runCli(['check', image, 'readable'], readyDependencies({
    resolveConfig: undefined,
    env: { VLM_PROVIDER: 'anthropic', API_KEY: 'test-only-generic-key' },
    validateScreenshot: async (_path, _prompt, received) => {
      context = received;
      return { score: 9 };
    },
  }));
  assert.equal(result.exitCode, 0);
  assert.equal(context.provider, 'claude');
});

test('uses JSON envelopes for parser, filesystem, config, and validation errors', async () => {
  const parserError = await runCli(['--min-score', 'bad', '--json']);
  assert.deepEqual(JSON.parse(parserError.stdout), {
    error: '--min-score must be a finite number between 0 and 10.',
    code: 'invalid_min_score',
  });
  assert.equal(parserError.stderr, '');

  const directoryError = await runCli(['check', image, 'readable', '--json'], readyDependencies({ isDirectory: () => true }));
  assert.equal(JSON.parse(directoryError.stdout).code, 'image_is_directory');

  const configError = await runCli(['check', image, 'readable', '--json'], readyDependencies({
    resolveConfig: async () => ({ provider: 'gemini', enabled: false, providerConfig: {} }),
  }));
  assert.equal(JSON.parse(configError.stdout).code, 'provider_not_configured');

  const validationError = await runCli(['check', image, 'readable', '--json'], readyDependencies({
    validateScreenshot: async () => { throw 'provider rejected the request'; },
  }));
  assert.deepEqual(JSON.parse(validationError.stdout), {
    error: 'provider rejected the request',
    code: 'validation_failed',
  });
});

test('formats only safe normalized fields', () => {
  const formatted = formatHuman({
    score: Number.NaN,
    issues: ['real issue', { message: 'not a string' }],
    recommendations: 'not-an-array',
    strengths: [1],
    estimatedCost: { total: 'not-a-number' },
  }, 7, true);
  assert.match(formatted, /Score:    N\/A\/10/);
  assert.match(formatted, /real issue/);
  assert.doesNotMatch(formatted, /not-a-string|Estimated cost/);
});

async function invokeBuiltCli(...args) {
  try {
    const completed = await exec(process.execPath, [CLI, ...args], {
      cwd: sandbox,
      env: { PATH: process.env.PATH ?? '', AI_VISUAL_TEST_DISABLE_ENV_FILE: '1' },
    });
    return { code: 0, stdout: completed.stdout, stderr: completed.stderr };
  } catch (error) {
    return { code: error.code ?? 1, stdout: error.stdout ?? '', stderr: error.stderr ?? '' };
  }
}

test('compiled launcher supports help, version, and JSON preflight without network access', async () => {
  const help = await invokeBuiltCli('--help');
  assert.equal(help.code, 0, help.stderr);
  assert.match(help.stdout, /USAGE/);

  const version = await invokeBuiltCli('--version');
  assert.equal(version.code, 0, version.stderr);
  assert.match(version.stdout.trim(), /^\d+\.\d+\.\d+$/);

  const missingProvider = await invokeBuiltCli('check', image, 'readable', '--json');
  assert.equal(missingProvider.code, 1);
  assert.equal(missingProvider.stderr, '');
  assert.equal(JSON.parse(missingProvider.stdout).code, 'provider_not_configured');
});
