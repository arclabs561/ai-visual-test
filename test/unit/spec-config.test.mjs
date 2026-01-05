/**
 * Tests for spec-config.mjs
 */

import '../test-setup.mjs';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import {
  createSpecConfig,
  getSpecConfig,
  setSpecConfig,
  resetSpecConfig
} from '../../src/spec-config.mjs';

describe('Spec Config', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    resetSpecConfig();
  });

  afterEach(() => {
    process.env = originalEnv;
    resetSpecConfig();
  });

  describe('createSpecConfig', () => {
    it('should create config with defaults', () => {
      const config = createSpecConfig();
      
      assert.ok(config);
      assert.strictEqual(config.useLLM, true);
      assert.strictEqual(config.fallback, 'regex');
      assert.strictEqual(config.validateBeforeExecute, true);
      assert.strictEqual(config.strictValidation, false);
      assert.strictEqual(config.enableErrorAnalysis, true);
      assert.strictEqual(config.autoLoadTemplates, true);
      assert.strictEqual(config.timeout, 30000);
      assert.strictEqual(config.retryOnFailure, false);
      assert.strictEqual(config.maxRetries, 3);
    });

    it('should merge with custom options', () => {
      const config = createSpecConfig({
        useLLM: false,
        timeout: 60000,
        strictValidation: true
      });
      
      assert.strictEqual(config.useLLM, false);
      assert.strictEqual(config.timeout, 60000);
      assert.strictEqual(config.strictValidation, true);
      // Other defaults should remain
      assert.strictEqual(config.fallback, 'regex');
    });

    it('should respect SPEC_USE_LLM environment variable', () => {
      process.env.SPEC_USE_LLM = 'false';
      const config = createSpecConfig();
      assert.strictEqual(config.useLLM, false);
    });

    it('should respect SPEC_VALIDATE_BEFORE_EXECUTE environment variable', () => {
      process.env.SPEC_VALIDATE_BEFORE_EXECUTE = 'false';
      const config = createSpecConfig();
      assert.strictEqual(config.validateBeforeExecute, false);
    });

    it('should respect SPEC_STRICT_VALIDATION environment variable', () => {
      process.env.SPEC_STRICT_VALIDATION = 'true';
      const config = createSpecConfig();
      assert.strictEqual(config.strictValidation, true);
    });

    it('should respect SPEC_TEMPLATE_DIR environment variable', () => {
      process.env.SPEC_TEMPLATE_DIR = '/custom/templates';
      const config = createSpecConfig();
      assert.strictEqual(config.templateDir, '/custom/templates');
    });

    it('should have errorAnalysisOptions', () => {
      const config = createSpecConfig();
      
      assert.ok(config.errorAnalysisOptions);
      assert.strictEqual(config.errorAnalysisOptions.saveReport, true);
      assert.strictEqual(config.errorAnalysisOptions.outputPath, null);
    });
  });

  describe('getSpecConfig', () => {
    it('should return singleton instance', () => {
      const config1 = getSpecConfig();
      const config2 = getSpecConfig();
      
      assert.strictEqual(config1, config2);
    });

    it('should create config with defaults on first call', () => {
      const config = getSpecConfig();
      assert.strictEqual(config.useLLM, true);
    });
  });

  describe('setSpecConfig', () => {
    it('should set custom config', () => {
      const customConfig = {
        useLLM: false,
        timeout: 60000
      };
      
      setSpecConfig(customConfig);
      const retrieved = getSpecConfig();
      
      assert.strictEqual(retrieved.useLLM, false);
      assert.strictEqual(retrieved.timeout, 60000);
    });

    it('should replace existing config', () => {
      const config1 = { useLLM: true };
      setSpecConfig(config1);
      
      const config2 = { useLLM: false };
      setSpecConfig(config2);
      
      const retrieved = getSpecConfig();
      assert.strictEqual(retrieved.useLLM, false);
    });
  });

  describe('resetSpecConfig', () => {
    it('should reset to null', () => {
      setSpecConfig({ useLLM: false });
      resetSpecConfig();
      
      // Next getSpecConfig should create new default config
      const config = getSpecConfig();
      assert.strictEqual(config.useLLM, true); // Back to default
    });

    it('should allow creating new config after reset', () => {
      setSpecConfig({ useLLM: false });
      resetSpecConfig();
      
      const config1 = getSpecConfig();
      const config2 = getSpecConfig();
      
      // Should be same instance (singleton)
      assert.strictEqual(config1, config2);
      // But with defaults
      assert.strictEqual(config1.useLLM, true);
    });
  });
});

