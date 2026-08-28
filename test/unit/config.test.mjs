/**
 * Tests for config.mjs
 */

import '../test-setup.mjs'; // Auto-load .env (must be first)
import { test } from 'node:test';
import assert from 'node:assert';
import { createConfig, getProvider, getConfig } from '../../src/config.mjs';

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

test('createConfig - canonicalizes anthropic provider alias', () => {
  const config = createConfig({ provider: 'anthropic', apiKey: 'test-key' });

  assert.strictEqual(config.provider, 'claude');
  assert.strictEqual(config.providerConfig.name, 'claude');
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
  // Save all provider keys
  const originalKeys = {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY
  };
  
  // Clear all keys first
  delete process.env.GEMINI_API_KEY;
  delete process.env.GROQ_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  
  // Set only GEMINI_API_KEY
  process.env.GEMINI_API_KEY = 'env-key-123';
  
  try {
    const config = createConfig({ env: process.env });
    assert.strictEqual(config.provider, 'gemini');
    assert.strictEqual(config.apiKey, 'env-key-123');
  } finally {
    // Restore original keys
    if (originalKeys.GEMINI_API_KEY) {
      process.env.GEMINI_API_KEY = originalKeys.GEMINI_API_KEY;
    } else {
      delete process.env.GEMINI_API_KEY;
    }
    if (originalKeys.GROQ_API_KEY) process.env.GROQ_API_KEY = originalKeys.GROQ_API_KEY;
    if (originalKeys.OPENAI_API_KEY) process.env.OPENAI_API_KEY = originalKeys.OPENAI_API_KEY;
    if (originalKeys.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = originalKeys.ANTHROPIC_API_KEY;
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

test('createConfig - anchors normalization', () => {
  const config = createConfig({
    anchors: {
      domain: 'Card game search UI',
      positive: ['Good layout', '', 'Clear hierarchy'],
      negative: ['Broken images', null, 'Bad contrast']
    }
  });

  assert.ok(config.anchors);
  assert.strictEqual(config.anchors.domain, 'Card game search UI');
  assert.deepStrictEqual(config.anchors.positive, ['Good layout', 'Clear hierarchy']);
  // null entries filtered out (not strings)
  assert.deepStrictEqual(config.anchors.negative, ['Broken images', 'Bad contrast']);
});

test('createConfig - anchors null when empty', () => {
  const config = createConfig({ anchors: {} });
  assert.strictEqual(config.anchors, null);

  const config2 = createConfig({ anchors: { positive: [], negative: [] } });
  assert.strictEqual(config2.anchors, null);
});

test('createConfig - anchors null when not provided', () => {
  const config = createConfig();
  assert.strictEqual(config.anchors, null);
});

test('createConfig - anchors positive-only', () => {
  const config = createConfig({
    anchors: { positive: ['One signal'] }
  });
  assert.ok(config.anchors);
  assert.deepStrictEqual(config.anchors.positive, ['One signal']);
  assert.strictEqual(config.anchors.negative, undefined);
});

test('createConfig - anchors with object entries (dimension + image)', () => {
  const config = createConfig({
    anchors: {
      positive: [
        'Plain text anchor',
        { text: 'Scoped anchor', dimension: 'game_authenticity' },
        { image: '/tmp/good.png', label: 'Good layout' },
      ],
      negative: [
        { image: '/tmp/bad.png', dimension: 'spacing_layout' },
      ]
    }
  });
  assert.ok(config.anchors);
  assert.strictEqual(config.anchors.positive.length, 3);
  assert.strictEqual(config.anchors.negative.length, 1);
  // Object entries preserved
  assert.strictEqual(config.anchors.positive[1].dimension, 'game_authenticity');
  assert.strictEqual(config.anchors.positive[2].image, '/tmp/good.png');
});

test('createConfig - anchors filters invalid object entries', () => {
  const config = createConfig({
    anchors: {
      positive: [
        { text: '' },               // empty text, no image -> filtered
        { image: '' },              // empty image, no text -> filtered
        { dimension: 'foo' },       // no text or image -> filtered
        { text: 'Valid' },          // has text -> kept
        null,                       // null -> filtered
      ]
    }
  });
  assert.ok(config.anchors);
  assert.strictEqual(config.anchors.positive.length, 1);
  assert.strictEqual(config.anchors.positive[0].text, 'Valid');
});

test('createConfig - anchors mixed text and image objects', () => {
  const config = createConfig({
    anchors: {
      domain: 'E-commerce',
      positive: ['Clear CTAs'],
      negative: [{ image: '/tmp/cluttered.png', label: 'Cluttered layout' }]
    }
  });
  assert.ok(config.anchors);
  assert.strictEqual(config.anchors.domain, 'E-commerce');
  assert.deepStrictEqual(config.anchors.positive, ['Clear CTAs']);
  assert.strictEqual(config.anchors.negative[0].image, '/tmp/cluttered.png');
});

test('getConfig - singleton pattern', () => {
  const config1 = getConfig();
  const config2 = getConfig();
  
  assert.strictEqual(config1, config2);
});
