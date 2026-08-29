/**
 * Tests for exported but previously untested functions
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  LatencyAwareBatchOptimizer,
  normalizeValidationResult
} from '../../src/utils/index.mjs';
import {
  checkCrossModalConsistency,
  validateExperienceConsistency
} from '../../src/multi-modal/index.js';

describe('Exported Functions Tests', () => {

  describe('LatencyAwareBatchOptimizer', () => {
    it('should create instance with default options', () => {
      const optimizer = new LatencyAwareBatchOptimizer();
      assert.ok(optimizer);
      assert.strictEqual(typeof optimizer.addRequest, 'function');
      assert.strictEqual(typeof optimizer.batchValidate, 'function');
    });

    it('should create instance with custom options', () => {
      const optimizer = new LatencyAwareBatchOptimizer({
        maxConcurrency: 3,
        defaultMaxLatency: 1000,
        batchSize: 5
      });
      assert.ok(optimizer);
    });
  });

  describe('checkCrossModalConsistency', () => {
    it('should check consistency with valid inputs', () => {
      const result = checkCrossModalConsistency({
        screenshot: 'test.png',
        renderedCode: '<div>Test</div>',
        pageState: { loaded: true }
      });

      assert.ok(result);
      assert.strictEqual(typeof result.isConsistent, 'boolean');
      assert.ok(Array.isArray(result.issues || []));
    });

    it('should handle missing inputs gracefully', () => {
      const result = checkCrossModalConsistency({
        screenshot: 'test.png'
      });

      assert.ok(result);
      assert.strictEqual(typeof result.isConsistent, 'boolean');
    });
  });

  describe('validateExperienceConsistency', () => {
    it('should validate experience consistency', () => {
      const result = validateExperienceConsistency({
        screenshot: 'test.png',
        renderedCode: '<div>Test</div>'
      });

      assert.ok(result);
      assert.strictEqual(typeof result.isConsistent, 'boolean');
    });
  });

  describe('normalizeValidationResult', () => {
    it('should normalize a validation result', () => {
      const input = {
        score: 8.5,
        issues: ['Issue 1', 'Issue 2'],
        assessment: 'Good',
        reasoning: 'Test reasoning'
      };

      const normalized = normalizeValidationResult(input);

      assert.ok(normalized);
      assert.strictEqual(typeof normalized.score, 'number');
      assert.ok(Array.isArray(normalized.issues));
    });

    it('should handle missing fields', () => {
      const input = {
        score: 7
      };

      const normalized = normalizeValidationResult(input);

      assert.ok(normalized);
      assert.strictEqual(normalized.score, 7);
      assert.ok(Array.isArray(normalized.issues));
    });
  });
});
