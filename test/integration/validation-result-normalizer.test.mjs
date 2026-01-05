/**
 * Integration tests for validation-result-normalizer.mjs
 */

import '../test-setup.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { normalizeValidationResult } from '../../src/validation-result-normalizer.mjs';

describe('Validation Result Normalizer', () => {
  describe('normalizeValidationResult', () => {
    it('should handle null result', () => {
      const result = normalizeValidationResult(null, 'test');
      
      assert.ok(result);
      assert.strictEqual(result.enabled, false);
      assert.strictEqual(result.score, null);
      assert.deepStrictEqual(result.issues, []);
      assert.ok(result.reasoning.includes('null'));
    });

    it('should handle undefined result', () => {
      const result = normalizeValidationResult(undefined, 'test');
      
      assert.ok(result);
      assert.strictEqual(result.enabled, false);
      assert.strictEqual(result.score, null);
    });

    it('should normalize complete result', () => {
      const input = {
        score: 8.0,
        issues: ['Issue 1'],
        reasoning: 'Test reasoning',
        assessment: 'good'
      };
      
      const result = normalizeValidationResult(input, 'test');
      
      assert.strictEqual(result.score, 8.0);
      assert.deepStrictEqual(result.issues, ['Issue 1']);
      assert.strictEqual(result.reasoning, 'Test reasoning');
      assert.strictEqual(result.assessment, 'good');
    });

    it('should infer enabled from score', () => {
      const input = {
        score: 8.0
      };
      
      const result = normalizeValidationResult(input, 'test');
      
      assert.strictEqual(result.enabled, true);
    });

    it('should default score to null if undefined', () => {
      const input = {
        issues: []
      };
      
      const result = normalizeValidationResult(input, 'test');
      
      assert.strictEqual(result.score, null);
    });

    it('should convert non-array issues to array', () => {
      const input = {
        score: 8.0,
        issues: 'not an array'
      };
      
      const result = normalizeValidationResult(input, 'test');
      
      assert.ok(Array.isArray(result.issues));
      assert.deepStrictEqual(result.issues, []);
    });

    it('should use judgment as reasoning if reasoning missing', () => {
      const input = {
        score: 8.0,
        judgment: 'Test judgment'
      };
      
      const result = normalizeValidationResult(input, 'test');
      
      assert.strictEqual(result.reasoning, 'Test judgment');
    });

    it('should default assessment to null if undefined', () => {
      const input = {
        score: 8.0
      };
      
      const result = normalizeValidationResult(input, 'test');
      
      assert.strictEqual(result.assessment, null);
    });

    it('should preserve existing assessment', () => {
      const input = {
        score: 8.0,
        assessment: 'excellent'
      };
      
      const result = normalizeValidationResult(input, 'test');
      
      assert.strictEqual(result.assessment, 'excellent');
    });
  });
});

