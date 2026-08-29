#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runCli } from '../src/cli.js';

const binDirectory = dirname(fileURLToPath(import.meta.url));

function readVersion(): string {
  try {
    const packageJson = JSON.parse(readFileSync(join(binDirectory, '..', 'package.json'), 'utf8')) as { version?: unknown };
    return typeof packageJson.version === 'string' ? packageJson.version : 'unknown';
  } catch {
    return 'unknown';
  }
}

try {
  const result = await runCli(process.argv.slice(2), { readVersion });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exitCode = result.exitCode;
} catch (errorValue) {
  const message = errorValue instanceof Error && errorValue.message ? errorValue.message : 'CLI failed with an unknown error.';
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = 1;
}
