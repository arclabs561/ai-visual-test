#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STAGE = join(ROOT, 'build');
const mode = process.argv[2] || 'unit';

function collect(directory, predicate) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collect(path, predicate));
    else if (predicate(entry.name)) files.push(relative(STAGE, path));
  }
  return files;
}

const directoryModes = new Set(['unit', 'integration', 'e2e', 'security']);
const testDirectory = directoryModes.has(mode) ? join(STAGE, 'test', mode) : join(STAGE, 'test');
const files = collect(
  testDirectory,
  mode === 'validation'
    ? name => name.startsWith('validation-') && name.endsWith('.test.mjs')
    : name => name.endsWith('.test.mjs'),
).sort();

if (files.length === 0) {
  process.stderr.write(`No staged tests found for ${mode}\n`);
  process.exit(1);
}

const testEnvironment = { ...process.env };
if (testEnvironment.AI_VISUAL_TEST_LIVE !== '1') {
  testEnvironment.AI_VISUAL_TEST_DISABLE_ENV_FILE = '1';
  for (const key of [
    'GROQ_API_KEY',
    'GEMINI_API_KEY',
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'OPENROUTER_API_KEY',
    'API_KEY',
    'VLLM_API_KEY',
    'VLM_PROVIDER',
    'VLM_MODEL',
  ]) {
    delete testEnvironment[key];
  }
}

const result = spawnSync(process.execPath, ['--test', ...files], {
  cwd: STAGE,
  env: testEnvironment,
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
