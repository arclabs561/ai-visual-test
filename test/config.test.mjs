/**
 * Tests for config.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { createConfig, getProvider, getConfig } from '../src/config.mjs';

test('createConfig - default configuration', () => {
  const config = createConfig();
  
  assert.ok(config);
  assert.strictEqual(typeof config.provider, 'string');
  assert.strictEqual(typeof config.enabled, 'boolean');
  assert.ok(config.providerConfig);
  assert.ok(config.cache);
  assert.ok(config.performance);
  assert.ok(config.debug);
});

test('createConfig - explicit provider', () => {
  const config = createConfig({ provider: 'gemini' });
  
  assert.strictEqual(config.provider, 'gemini');
  assert.ok(config.providerConfig);
  assert.strictEqual(config.providerConfig.name, 'gemini');
});

test('createConfig - explicit API key', () => {
  const config = createConfig({ apiKey: 'test-key-123' });
  
  assert.strictEqual(config.apiKey, 'test-key-123');
  assert.strictEqual(config.enabled, true);
});

test('createConfig - disabled when no API key', () => {
  const config = createConfig({ apiKey: null });
  
  assert.strictEqual(config.enabled, false);
});

test('createConfig - cache configuration', () => {
  const config = createConfig({ cacheEnabled: false });
  
  assert.strictEqual(config.cache.enabled, false);
});

test('createConfig - performance configuration', () => {
  const config = createConfig({ 
    maxConcurrency: 10,
    timeout: 60000
  });
  
  assert.strictEqual(config.performance.maxConcurrency, 10);
  assert.strictEqual(config.performance.timeout, 60000);
});

test('createConfig - debug configuration', () => {
  const config = createConfig({ verbose: true });
  
  assert.strictEqual(config.debug.verbose, true);
});

test('createConfig - environment variable detection', () => {
  const originalEnv = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'env-key-123';
  
  try {
    const config = createConfig({ env: process.env });
    assert.strictEqual(config.provider, 'gemini');
    assert.strictEqual(config.apiKey, 'env-key-123');
  } finally {
    if (originalEnv) {
      process.env.GEMINI_API_KEY = originalEnv;
    } else {
      delete process.env.GEMINI_API_KEY;
    }
  }
});

test('getProvider - default provider', () => {
  const provider = getProvider();
  
  assert.ok(provider);
  assert.strictEqual(typeof provider.name, 'string');
  assert.ok(provider.apiUrl);
  assert.ok(provider.model);
  assert.ok(provider.pricing);
});

test('getProvider - specific provider', () => {
  const provider = getProvider('openai');
  
  assert.strictEqual(provider.name, 'openai');
  assert.ok(provider.apiUrl.includes('openai.com'));
});

test('getProvider - invalid provider falls back to gemini', () => {
  const provider = getProvider('invalid-provider');
  
  assert.strictEqual(provider.name, 'gemini');
});

test('getConfig - singleton pattern', () => {
  const config1 = getConfig();
  const config2 = getConfig();
  
  assert.strictEqual(config1, config2);
});

