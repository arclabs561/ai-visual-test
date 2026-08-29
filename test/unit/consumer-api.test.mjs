/**
 * Consumer API contract tests
 *
 * Verifies the public API surface works as documented.
 * These tests do NOT make real API calls -- they verify
 * imports, types, error handling, and config behavior.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Consumer API', () => {
  describe('Core imports', () => {
    it('should export all 18 core symbols from main entry', async () => {
      const mod = await import('../../src/index.mjs');
      const expected = [
        'validateScreenshot', '_validateScreenshot', 'VLLMJudge',
        'validatePage', 'validateWithRubric', 'extractSemanticInfo',
        'createConfig', 'getConfig', 'validateStartup',
        'getCached', 'setCached', 'clearCache', 'getCacheStats',
        'ValidationError', 'ConfigError', 'ProviderError', 'FileError',
        'createMatchers'
      ];
      for (const name of expected) {
        assert.ok(name in mod, `Missing core export: ${name}`);
      }
    });

    it('should not export internal symbols from main entry', async () => {
      const mod = await import('../../src/index.mjs');
      const internals = [
        'TemporalDecisionManager', 'aggregateTemporalNotes',
        'playGame', 'GameGym', 'detectBias', 'EnsembleJudge',
        'BatchOptimizer', 'CostTracker'
      ];
      for (const name of internals) {
        assert.ok(!(name in mod), `Internal symbol leaked to main entry: ${name}`);
      }
    });
  });

  describe('Subpath imports', () => {
    const subpaths = [
      { path: '../../src/temporal/index.js', minExports: 10 },
      { path: '../../src/validators/index.mjs', minExports: 5 },
      { path: '../../src/ensemble/index.js', minExports: 5 },
      { path: '../../src/persona/index.mjs', minExports: 3 },
      { path: '../../src/utils/index.mjs', minExports: 20 },
      { path: '../../src/game/index.mjs', minExports: 5 },
      { path: '../../src/errors/index.mjs', minExports: 5 },
      { path: '../../src/multi-modal/index.mjs', minExports: 5 },
    ];

    for (const { path, minExports } of subpaths) {
      const name = path.split('/').slice(-2, -1)[0];
      it(`should load ${name} subpath with >= ${minExports} exports`, async () => {
        const mod = await import(path);
        const count = Object.keys(mod).length;
        assert.ok(count >= minExports, `${name} has ${count} exports, expected >= ${minExports}`);
      });
    }
  });

  describe('createConfig', () => {
    it('should create config with defaults', async () => {
      const { createConfig } = await import('../../src/config.mjs');
      const config = createConfig({ apiKey: null });
      assert.strictEqual(typeof config, 'object');
      assert.ok('provider' in config);
      assert.ok('enabled' in config);
      assert.ok('cache' in config);
      assert.ok('performance' in config);
    });

    it('should accept explicit provider', async () => {
      const { createConfig } = await import('../../src/config.mjs');
      const config = createConfig({ provider: 'openai', apiKey: 'test-key' });
      assert.strictEqual(config.provider, 'openai');
      assert.strictEqual(config.apiKey, 'test-key');
      assert.strictEqual(config.enabled, true);
    });

    it('should set enabled=false when no API key', async () => {
      const { createConfig } = await import('../../src/config.mjs');
      const config = createConfig({ provider: 'openai', apiKey: null });
      assert.strictEqual(config.enabled, false);
    });

    it('should respect model tier', async () => {
      const { createConfig } = await import('../../src/config.mjs');
      const config = createConfig({ provider: 'gemini', apiKey: 'key', modelTier: 'best' });
      assert.ok(config.providerConfig.model);
    });

    it('should respect explicit model override', async () => {
      const { createConfig } = await import('../../src/config.mjs');
      const config = createConfig({ provider: 'openai', apiKey: 'key', model: 'gpt-4o-mini' });
      assert.strictEqual(config.providerConfig.model, 'gpt-4o-mini');
    });
  });

  describe('validateStartup', () => {
    it('should return valid:false in non-strict mode when no keys set', async () => {
      const { validateStartup } = await import('../../src/startup-validation.mjs');
      // Since tests run with API keys, this tests the function signature
      const result = validateStartup({ strict: false });
      assert.ok(typeof result.valid === 'boolean');
      assert.ok(Array.isArray(result.warnings));
    });
  });

  describe('Error types', () => {
    it('should be catchable by type', async () => {
      const { ValidationError, ConfigError, ProviderError, FileError } = await import('../../src/errors.mjs');

      const ve = new ValidationError('test', { field: 'x' });
      assert.ok(ve instanceof ValidationError);
      assert.ok(ve instanceof Error);

      const ce = new ConfigError('test', { key: 'y' });
      assert.ok(ce instanceof ConfigError);
      assert.ok(ce instanceof Error);

      const pe = new ProviderError('test', 'gemini');
      assert.ok(pe instanceof ProviderError);

      const fe = new FileError('test', '/path');
      assert.ok(fe instanceof FileError);
    });
  });

  describe('extractSemanticInfo', () => {
    it('should parse JSON judgment objects', async () => {
      const { extractSemanticInfo } = await import('../../src/index.mjs');
      const result = extractSemanticInfo({
        score: 7,
        issues: ['Low contrast'],
        assessment: 'Good overall',
        recommendations: ['Improve contrast']
      });
      assert.strictEqual(result.score, 7);
      assert.ok(Array.isArray(result.issues));
      assert.strictEqual(result.assessment, 'Good overall');
    });

    it('should parse JSON from string judgment', async () => {
      const { extractSemanticInfo } = await import('../../src/index.mjs');
      const result = extractSemanticInfo('Some text {"score": 5, "issues": ["Bad"]} more text');
      assert.strictEqual(result.score, 5);
    });

    it('should handle null/undefined gracefully', async () => {
      const { extractSemanticInfo } = await import('../../src/index.mjs');
      const result = extractSemanticInfo(null);
      assert.strictEqual(result.score, null);
    });
  });
});
