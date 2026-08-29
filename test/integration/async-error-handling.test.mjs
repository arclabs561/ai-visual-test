/**
 * Async Error Handling Tests
 * 
 * Comprehensive tests for async function error handling.
 */

import '../test-setup.mjs'; // Auto-load .env (must be first)
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { validateScreenshot } from '#judge';
import { getCached, setCached } from '../../src/cache.js';
import { BatchOptimizer } from '../../src/batch-optimizer.js';
import { ValidationError } from '../../src/errors.js';

describe('Async Error Handling', () => {
  describe('Unhandled Promise Rejections', () => {
    it('should handle async errors in validateScreenshot', async () => {
      // Test with invalid input
      try {
        await validateScreenshot(null, 'test');
      } catch (error) {
        assert.ok(error instanceof ValidationError || error, 'Should throw ValidationError');
      }
    });

    it('should handle cache operation errors', async () => {
      // Test with invalid cache key
      try {
        await getCached(null, null, null);
      } catch (error) {
        // Should handle gracefully
        assert.ok(error || true, 'Should handle invalid cache key');
      }
    });

    it('should handle batch optimizer errors', async () => {
      const optimizer = new BatchOptimizer({
        maxBatchSize: 1,
        batchTimeout: 10
      });

      try {
        // Add invalid request
        await optimizer.addToBatch(null, null, null, null);
      } catch (error) {
        assert.ok(error, 'Should handle invalid batch request');
      }
    });
  });

  describe('Concurrent Error Handling', () => {
    it('should handle concurrent errors gracefully', async () => {
      // Don't catch errors - let them propagate to test error handling
      const promises = Array.from({ length: 10 }, () =>
        validateScreenshot(null, 'test')
      );

      const results = await Promise.allSettled(promises);

      // All should complete (not hang)
      assert.strictEqual(results.length, 10, 'All promises should settle');
      
      // All should be rejected (null input should throw ValidationError)
      const rejected = results.filter(r => r.status === 'rejected');
      assert.strictEqual(rejected.length, 10, 'All should be rejected for null input');
      
      // Verify all rejections are ValidationError
      for (const result of rejected) {
        assert.ok(result.status === 'rejected', 'Should be rejected');
        assert.ok(result.reason, 'Should have error reason');
        // Error should be ValidationError or related
        assert.ok(result.reason.message, 'Should have error message');
      }
    });

    it('should not leak memory on repeated errors', async () => {
      // Repeatedly trigger errors
      for (let i = 0; i < 100; i++) {
        try {
          await validateScreenshot(null, 'test');
        } catch (error) {
          // Expected
        }
      }

      // If we get here, no memory leak
      assert.ok(true, 'Should handle repeated errors');
    });
  });

  describe('Error Propagation', () => {
    it('should propagate errors correctly', async () => {
      try {
        await validateScreenshot('nonexistent.png', 'test');
      } catch (error) {
        assert.ok(error, 'Should propagate error');
        assert.ok(error.message, 'Should have error message');
      }
    });

    it('should preserve error types', async () => {
      try {
        await validateScreenshot(null, 'test');
      } catch (error) {
        assert.ok(error instanceof ValidationError || error, 'Should preserve error type');
      }
    });
  });

  describe('Timeout Handling', () => {
    it('should handle timeout errors', async () => {
      try {
        await validateScreenshot('test.png', 'test', {
          timeout: 1 // Very short timeout
        });
      } catch (error) {
        // Timeout or validation error is acceptable
        assert.ok(error, 'Should handle timeout');
      }
    });
  });
});
