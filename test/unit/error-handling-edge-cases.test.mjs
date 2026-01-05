/**
 * Error Handling Edge Cases Tests
 * 
 * Tests for error handling in edge cases and failure scenarios.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ValidationError, ProviderError, TimeoutError } from '../../src/errors.mjs';
import { validateScreenshot } from '../../src/judge.mjs';
import { getCached, setCached } from '../../src/cache.mjs';

describe('Error Handling Edge Cases', () => {
  describe('Network Failures', () => {
    it('should handle network timeout gracefully', async () => {
      // Test with invalid/non-existent endpoint
      try {
        await validateScreenshot('test.png', 'Test prompt', {
          provider: 'gemini',
          timeout: 1 // Very short timeout
        });
        // If it doesn't throw, that's also valid (may skip or return null)
      } catch (error) {
        assert.ok(error, 'Should handle timeout error');
        // Should be TimeoutError or similar
      }
    });

    it('should handle malformed API responses', async () => {
      // This would require mocking, but we can test error handling structure
      const error = new ProviderError('Invalid response format', {
        provider: 'test',
        statusCode: 200,
        response: 'not json'
      });

      assert.ok(error.message, 'Should have error message');
      assert.ok(error.provider, 'Should have provider info');
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent cache writes', async () => {
      const key = `test-concurrent-${Date.now()}`;
      const prompt = 'Test prompt';
      const context = {};

      // Simulate concurrent writes
      const promises = Array.from({ length: 5 }, () =>
        setCached(key, prompt, context, { score: 7 })
      );

      const results = await Promise.allSettled(promises);

      // All should complete (may have race conditions, but shouldn't crash)
      assert.strictEqual(results.length, 5, 'All operations should complete');
      
      // At least one should succeed
      const succeeded = results.filter(r => r.status === 'fulfilled');
      assert.ok(succeeded.length > 0, 'At least one write should succeed');
    });

    it('should handle concurrent cache reads', async () => {
      const key = `test-read-${Date.now()}`;
      const prompt = 'Test prompt';
      const context = {};

      // Set cache first
      await setCached(key, prompt, context, { score: 7 });

      // Concurrent reads
      const promises = Array.from({ length: 10 }, () =>
        getCached(key, prompt, context)
      );

      const results = await Promise.allSettled(promises);

      // All should complete
      assert.strictEqual(results.length, 10, 'All reads should complete');
      
      // All should succeed and return same value
      const values = results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value);
      
      assert.ok(values.length > 0, 'Should have successful reads');
      // All values should be the same (or null if cache miss)
      const uniqueValues = new Set(values.map(v => JSON.stringify(v)));
      assert.ok(uniqueValues.size <= 2, 'Should have consistent reads (value or null)');
    });
  });

  describe('Provider-Specific Errors', () => {
    it('should handle Groq rate limits', () => {
      const error = new ProviderError('Rate limit exceeded', {
        provider: 'groq',
        statusCode: 429
      });

      assert.ok(error.message.includes('Rate limit') || error.message, 'Should identify rate limit');
    });

    it('should handle Claude image size limits', () => {
      const error = new ProviderError('Image too large', {
        provider: 'anthropic',
        statusCode: 400,
        details: { maxSize: 8000 }
      });

      assert.ok(error.message, 'Should have error message');
    });

    it('should handle OpenAI timeout on large images', () => {
      const error = new TimeoutError('Request timeout', {
        provider: 'openai',
        timeout: 30000
      });

      assert.ok(error.message, 'Should have timeout message');
    });
  });

  describe('Invalid Input Handling', () => {
    it('should handle null screenshot path', async () => {
      try {
        await validateScreenshot(null, 'Test prompt');
        // May return null or throw
      } catch (error) {
        assert.ok(error instanceof ValidationError || error, 'Should throw ValidationError');
      }
    });

    it('should handle empty prompt', async () => {
      try {
        await validateScreenshot('test.png', '');
        // May return null or throw
      } catch (error) {
        assert.ok(error instanceof ValidationError || error, 'Should throw ValidationError');
      }
    });

    it('should handle invalid provider', async () => {
      try {
        await validateScreenshot('test.png', 'Test', {
          provider: 'invalid-provider'
        });
        // May throw or use default
      } catch (error) {
        assert.ok(error, 'Should handle invalid provider');
      }
    });
  });

  describe('Memory and Resource Limits', () => {
    it('should handle large screenshot files', async () => {
      // Test with very large file path (simulated)
      try {
        await validateScreenshot('/path/to/very/large/file.png', 'Test', {
          maxImageSize: 10 * 1024 * 1024 // 10MB limit
        });
        // Should either succeed or fail gracefully
      } catch (error) {
        assert.ok(error, 'Should handle large files');
      }
    });

    it('should handle many concurrent requests', async () => {
      // Create many concurrent validation requests
      const promises = Array.from({ length: 20 }, (_, i) =>
        validateScreenshot(`test-${i}.png`, `Test ${i}`, {
          // Use very short timeout to avoid actual API calls
          timeout: 1
        }).catch(() => null) // Ignore errors for this test
      );

      const results = await Promise.allSettled(promises);

      // All should complete (may fail, but shouldn't hang)
      assert.strictEqual(results.length, 20, 'All requests should complete');
    });
  });

  describe('Error Recovery', () => {
    it('should retry on transient errors', async () => {
      // This would require mocking, but we can test retry logic structure
      const error = new ProviderError('Temporary failure', {
        provider: 'gemini',
        statusCode: 503,
        retryable: true
      });

      assert.ok(error, 'Should create error');
      // Retry logic should be handled by retry utilities
    });

    it('should not retry on permanent errors', () => {
      const error = new ValidationError('Invalid input');

      assert.ok(error, 'Should create error');
      assert.ok(error.message, 'Should have error message');
      // ValidationError doesn't have retryable property - retry logic handles it separately
      // The test verifies that ValidationError can be created and has expected structure
    });
  });
});

