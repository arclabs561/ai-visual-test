/**
 * Tests for bin/ai-visual-test.mjs CLI argument parsing and formatting.
 *
 * These tests import internal functions by spawning the CLI as a subprocess.
 * They do NOT make real API calls.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { execFile } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = join(__dirname, '..', '..', 'bin', 'ai-visual-test.mjs');

// Run CLI with stripped API keys to prevent real API calls.
// HOME is set to /tmp to prevent .env loading from the repo root.
const CLEAN_ENV = {
  PATH: process.env.PATH,
  HOME: '/tmp',
  NODE_PATH: process.env.NODE_PATH || '',
};

async function run(...args) {
  try {
    const result = await exec('node', [CLI, ...args], {
      timeout: 10000,
      env: CLEAN_ENV,
      cwd: '/tmp',
    });
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (err) {
    return { code: err.code ?? 1, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
  }
}

describe('CLI', () => {
  describe('--help', () => {
    it('should print usage and exit 0', async () => {
      const { code, stdout } = await run('--help');
      assert.strictEqual(code, 0);
      assert.ok(stdout.includes('ai-visual-test'));
      assert.ok(stdout.includes('USAGE'));
      assert.ok(stdout.includes('check'));
    });

    it('should list all providers in help', async () => {
      const { stdout } = await run('--help');
      assert.ok(stdout.includes('groq'));
      assert.ok(stdout.includes('gemini'));
      assert.ok(stdout.includes('openai'));
      assert.ok(stdout.includes('claude'));
      assert.ok(stdout.includes('openrouter'));
    });

    it('should note ANTHROPIC_API_KEY for Claude provider', async () => {
      const { stdout } = await run('--help');
      assert.ok(stdout.includes('ANTHROPIC_API_KEY'));
      // Should explicitly warn that it's NOT CLAUDE_API_KEY
      assert.ok(stdout.includes('not CLAUDE_API_KEY'));
    });
  });

  describe('--version', () => {
    it('should print version and exit 0', async () => {
      const { code, stdout } = await run('--version');
      assert.strictEqual(code, 0);
      assert.match(stdout.trim(), /^\d+\.\d+\.\d+$/);
    });
  });

  describe('check command', () => {
    it('should error when no arguments given', async () => {
      const { code, stderr } = await run();
      assert.notStrictEqual(code, 0);
      assert.ok(stderr.includes('No command specified'));
    });

    it('should error when image is missing', async () => {
      const { code, stderr } = await run('check');
      assert.notStrictEqual(code, 0);
      assert.ok(stderr.includes('Missing'));
    });

    it('should error when prompt is missing', async () => {
      const { code, stderr } = await run('check', 'some-image.png');
      assert.notStrictEqual(code, 0);
      assert.ok(stderr.includes('Missing'));
    });

    it('should error when image file does not exist', async () => {
      const { code, stderr } = await run('check', 'nonexistent.png', 'test prompt');
      assert.notStrictEqual(code, 0);
      assert.ok(stderr.includes('not found'));
    });

    it('should error when no API key is set', async () => {
      const { code, stderr } = await run('check', join(__dirname, '..', 'test-image-utils.mjs'), 'test');
      assert.notStrictEqual(code, 0);
      assert.ok(stderr.includes('No provider detected') || stderr.includes('not set'));
    });

    it('should reject invalid --min-score', async () => {
      const { code, stderr } = await run('check', 'img.png', 'prompt', '--min-score', '15');
      assert.notStrictEqual(code, 0);
      assert.ok(stderr.includes('min-score'));
    });

    it('should reject unknown flags', async () => {
      const { code, stderr } = await run('check', 'img.png', 'prompt', '--bogus');
      assert.notStrictEqual(code, 0);
      assert.ok(stderr.includes('Unknown option'));
    });
  });

  describe('unknown command', () => {
    it('should error on unknown command', async () => {
      const { code, stderr } = await run('deploy');
      assert.notStrictEqual(code, 0);
      assert.ok(stderr.includes('Unknown command'));
    });
  });
});
