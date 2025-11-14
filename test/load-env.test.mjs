/**
 * Tests for load-env.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { writeFileSync, unlinkSync, existsSync, mkdirSync, rmdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { loadEnv } from '../src/load-env.mjs';

const TEST_DIR = join(tmpdir(), 'ai-visual-test-load-env');

test.beforeEach(() => {
  if (existsSync(TEST_DIR)) {
    try {
      rmdirSync(TEST_DIR, { recursive: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  }
  mkdirSync(TEST_DIR, { recursive: true });
});

test.afterEach(() => {
  if (existsSync(TEST_DIR)) {
    try {
      const envFile = join(TEST_DIR, '.env');
      if (existsSync(envFile)) {
        unlinkSync(envFile);
      }
      rmdirSync(TEST_DIR, { recursive: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  }
});

test('loadEnv - returns false when no .env file', () => {
  const result = loadEnv(TEST_DIR);
  assert.strictEqual(result, false);
});

test('loadEnv - loads .env file', () => {
  const envFile = join(TEST_DIR, '.env');
  // Use whitelisted keys for testing with valid provider value
  writeFileSync(envFile, 'GEMINI_API_KEY=test_value\nVLM_PROVIDER=gemini');
  
  const originalValue = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.VLM_PROVIDER;
  
  try {
    const result = loadEnv(TEST_DIR);
    assert.strictEqual(result, true);
    assert.strictEqual(process.env.GEMINI_API_KEY, 'test_value');
    assert.strictEqual(process.env.VLM_PROVIDER, 'gemini');
  } finally {
    if (originalValue) {
      process.env.GEMINI_API_KEY = originalValue;
    } else {
      delete process.env.GEMINI_API_KEY;
    }
    delete process.env.VLM_PROVIDER;
  }
});

test('loadEnv - skips comments', () => {
  const envFile = join(TEST_DIR, '.env');
  // Use whitelisted key for testing
  writeFileSync(envFile, '# This is a comment\nGEMINI_API_KEY=test_value');
  
  const originalValue = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  
  try {
    const result = loadEnv(TEST_DIR);
    assert.strictEqual(result, true);
    assert.strictEqual(process.env.GEMINI_API_KEY, 'test_value');
  } finally {
    if (originalValue) {
      process.env.GEMINI_API_KEY = originalValue;
    } else {
      delete process.env.GEMINI_API_KEY;
    }
  }
});

test('loadEnv - removes quotes', () => {
  const envFile = join(TEST_DIR, '.env');
  // Use whitelisted keys for testing with valid provider value
  writeFileSync(envFile, 'GEMINI_API_KEY="quoted_value"\nVLM_PROVIDER=\'openai\'');
  
  const originalValue = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.VLM_PROVIDER;
  
  try {
    const result = loadEnv(TEST_DIR);
    assert.strictEqual(result, true);
    assert.strictEqual(process.env.GEMINI_API_KEY, 'quoted_value');
    assert.strictEqual(process.env.VLM_PROVIDER, 'openai');
  } finally {
    if (originalValue) {
      process.env.GEMINI_API_KEY = originalValue;
    } else {
      delete process.env.GEMINI_API_KEY;
    }
    delete process.env.VLM_PROVIDER;
  }
});

test('loadEnv - respects existing env vars', () => {
  const envFile = join(TEST_DIR, '.env');
  // Use whitelisted key for testing
  writeFileSync(envFile, 'GEMINI_API_KEY=env_file_value');
  
  process.env.GEMINI_API_KEY = 'existing_value';
  
  try {
    const result = loadEnv(TEST_DIR);
    assert.strictEqual(result, true);
    assert.strictEqual(process.env.GEMINI_API_KEY, 'existing_value'); // Should not override
  } finally {
    delete process.env.GEMINI_API_KEY;
  }
});

test('loadEnv - ignores non-whitelisted keys', () => {
  const envFile = join(TEST_DIR, '.env');
  // Include both whitelisted and non-whitelisted keys
  writeFileSync(envFile, 'GEMINI_API_KEY=allowed_value\nMALICIOUS_KEY=should_be_ignored\nANOTHER_BAD_KEY=also_ignored');
  
  delete process.env.GEMINI_API_KEY;
  delete process.env.MALICIOUS_KEY;
  delete process.env.ANOTHER_BAD_KEY;
  
  try {
    const result = loadEnv(TEST_DIR);
    assert.strictEqual(result, true);
    // Whitelisted key should be set
    assert.strictEqual(process.env.GEMINI_API_KEY, 'allowed_value');
    // Non-whitelisted keys should be ignored
    assert.strictEqual(process.env.MALICIOUS_KEY, undefined);
    assert.strictEqual(process.env.ANOTHER_BAD_KEY, undefined);
  } finally {
    delete process.env.GEMINI_API_KEY;
    delete process.env.MALICIOUS_KEY;
    delete process.env.ANOTHER_BAD_KEY;
  }
});

