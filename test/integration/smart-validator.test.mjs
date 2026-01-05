/**
 * Integration tests for smart-validator.mjs
 */

import '../test-setup.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  validateSmart,
  validateAccessibilitySmart,
  validateStateSmart,
  validateElementSmart,
  detectValidationMethod
} from '../../src/smart-validator.mjs';
import { createTestImage } from '../test-image-utils.mjs';
import { unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { ValidationError } from '../../src/errors.mjs';

describe('Smart Validator', () => {
  describe('detectValidationMethod', () => {
    it('should detect programmatic method when page is available', () => {
      const mockPage = {
        evaluate: () => Promise.resolve(true)
      };
      
      const result = detectValidationMethod({
        page: mockPage,
        type: 'accessibility'
      });
      
      assert.ok(result);
      assert.strictEqual(result.hasPage, true);
      assert.ok(Array.isArray(result.recommendations));
      assert.ok(result.recommendations.length > 0);
      assert.ok(result.recommendations.some(r => r.method === 'programmatic'));
    });

    it('should detect VLLM method when only screenshot is available', () => {
      const result = detectValidationMethod({
        screenshotPath: 'test.png',
        type: 'accessibility'
      });
      
      assert.ok(result);
      assert.strictEqual(result.hasScreenshot, true);
      assert.ok(result.recommendations.some(r => r.method === 'vllm'));
    });

    it('should recommend hybrid when both are available', () => {
      const mockPage = {
        evaluate: () => Promise.resolve(true)
      };
      
      const result = detectValidationMethod({
        page: mockPage,
        screenshotPath: 'test.png',
        type: 'accessibility'
      });
      
      assert.ok(result);
      assert.strictEqual(result.hasPage, true);
      assert.strictEqual(result.hasScreenshot, true);
      assert.ok(result.recommendations.some(r => r.method === 'hybrid'));
    });
  });

  describe('validateSmart', () => {
    it('should throw error when type is missing', async () => {
      await assert.rejects(
        () => validateSmart({}),
        ValidationError
      );
    });

    it('should throw error for unknown type', async () => {
      await assert.rejects(
        () => validateSmart({ type: 'unknown' }),
        ValidationError
      );
    });

    it('should require screenshotPath for visual validation', async () => {
      await assert.rejects(
        () => validateSmart({ type: 'visual' }),
        ValidationError
      );
    });

    it('should require prompt for visual validation', async () => {
      await assert.rejects(
        () => validateSmart({ type: 'visual', screenshotPath: 'test.png' }),
        ValidationError
      );
    });
  });

  describe('validateAccessibilitySmart', () => {
    it('should throw error when neither page nor screenshot provided', async () => {
      await assert.rejects(
        () => validateAccessibilitySmart({}),
        ValidationError
      );
    });

    it('should handle screenshot-only validation', async () => {
      const tempDir = join(tmpdir(), `smart-val-${Date.now()}`);
      const screenshotPath = join(tempDir, 'test.png');
      
      // Ensure directory exists
      if (!existsSync(tempDir)) {
        const { mkdirSync } = await import('fs');
        mkdirSync(tempDir, { recursive: true });
      }
      
      await createTestImage(screenshotPath);
      
      try {
        await validateAccessibilitySmart({
          screenshotPath: screenshotPath
        });
      } catch (error) {
        // May fail due to missing API key, but should not be ValidationError (unless specific validation failed)
        // With valid image, it should reach API call or fail gracefully
        assert.ok(!(error instanceof ValidationError) || error.message.includes('API'), `Unexpected error: ${error.message}`);
      } finally {
        if (existsSync(screenshotPath)) {
          unlinkSync(screenshotPath);
        }
      }
    });
  });

  describe('validateStateSmart', () => {
    it('should throw error when expectedState is missing', async () => {
      await assert.rejects(
        () => validateStateSmart({}),
        ValidationError
      );
    });

    it('should throw error when expectedState is not an object', async () => {
      await assert.rejects(
        () => validateStateSmart({ expectedState: 'string' }),
        ValidationError
      );
    });

    it('should throw error when neither page nor screenshot provided', async () => {
      await assert.rejects(
        () => validateStateSmart({ expectedState: { score: 100 } }),
        ValidationError
      );
    });
  });

  describe('validateElementSmart', () => {
    it('should throw error when selector is missing', async () => {
      await assert.rejects(
        () => validateElementSmart({}),
        ValidationError
      );
    });

    it('should throw error when checks is missing', async () => {
      await assert.rejects(
        () => validateElementSmart({ selector: '#test' }),
        ValidationError
      );
    });
  });
});

