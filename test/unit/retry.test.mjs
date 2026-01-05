/**
 * Tests for retry.mjs
 */

import '../test-setup.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  isRetryableError,
  calculateBackoff,
  retryWithBackoff,
  enhanceErrorMessage
} from '../../src/retry.mjs';
import { ProviderError, TimeoutError, ValidationError } from '../../src/errors.mjs';
import { RETRY_CONSTANTS } from '../../src/constants.mjs';

describe('Retry Utilities', () => {
  describe('isRetryableError', () => {
    it('should return true for TimeoutError', () => {
      const error = new TimeoutError('Operation timed out', 5000);
      assert.strictEqual(isRetryableError(error), true);
    });

    it('should return true for network errors', () => {
      const error1 = new Error('Network timeout');
      error1.name = 'NetworkError';
      assert.strictEqual(isRetryableError(error1), true);

      const error2 = new Error('Request timeout');
      assert.strictEqual(isRetryableError(error2), true);
    });

    it('should return true for rate limiting (429)', () => {
      // Test message-based check (case-sensitive: looks for 'rate limit' lowercase)
      // The implementation checks: error.message?.includes('rate limit') || error.message?.includes('429')
      const error1 = new Error('rate limit exceeded'); // lowercase to match implementation
      assert.strictEqual(isRetryableError(error1), true, 'Should detect "rate limit" in message');
      
      // Test with '429' in message
      const error2 = new Error('Error 429: Too many requests');
      assert.strictEqual(isRetryableError(error2), true, 'Should detect "429" in message');
      
      // Test ProviderError with lowercase message
      const error3 = new ProviderError('rate limit exceeded', 'gemini', { statusCode: 429 });
      assert.strictEqual(error3.details?.statusCode, 429);
      // Message contains 'rate limit' (lowercase), so should return true
      assert.strictEqual(isRetryableError(error3), true, 'ProviderError with "rate limit" message should be retryable');
    });

    it('should return true for server errors (5xx)', () => {
      const error = new ProviderError('Server error', 'gemini', { statusCode: 500 });
      assert.strictEqual(isRetryableError(error), true);

      const error502 = new ProviderError('Bad gateway', 'gemini', { statusCode: 502 });
      assert.strictEqual(isRetryableError(error502), true);
    });

    it('should return true for transient errors', () => {
      // Test with exact message patterns that match the implementation (case-sensitive)
      const error1 = new Error('Service temporarily unavailable');
      assert.strictEqual(isRetryableError(error1), true);

      const error2 = new Error('service unavailable');
      assert.strictEqual(isRetryableError(error2), true);

      const error3 = new Error('internal server error'); // lowercase to match implementation
      assert.strictEqual(isRetryableError(error3), true);
    });

    it('should return false for validation errors', () => {
      const error = new ValidationError('Invalid input');
      assert.strictEqual(isRetryableError(error), false);
    });

    it('should return false for authentication errors', () => {
      const error = new ProviderError('Unauthorized', 'gemini', { statusCode: 401 });
      assert.strictEqual(isRetryableError(error), false);
    });

    it('should return false for client errors (4xx except 429)', () => {
      const error = new ProviderError('Bad request', 'gemini', { statusCode: 400 });
      assert.strictEqual(isRetryableError(error), false);
    });
  });

  describe('calculateBackoff', () => {
    it('should calculate exponential backoff', () => {
      const baseDelay = 100;
      const attempt0 = calculateBackoff(0, baseDelay, 10000, false);
      const attempt1 = calculateBackoff(1, baseDelay, 10000, false);
      const attempt2 = calculateBackoff(2, baseDelay, 10000, false);

      assert.strictEqual(attempt0, 100); // 100 * 2^0
      assert.strictEqual(attempt1, 200); // 100 * 2^1
      assert.strictEqual(attempt2, 400); // 100 * 2^2
    });

    it('should respect max delay', () => {
      const baseDelay = 1000;
      const maxDelay = 2000;
      const attempt5 = calculateBackoff(5, baseDelay, maxDelay, false);

      assert.ok(attempt5 <= maxDelay);
    });

    it('should add jitter when enabled', () => {
      const baseDelay = 100;
      const attempt1 = calculateBackoff(1, baseDelay, 10000, true);
      const attempt2 = calculateBackoff(1, baseDelay, 10000, true);

      // Should be around 200 but with jitter
      assert.ok(attempt1 >= 0);
      assert.ok(attempt1 <= 200 * (1 + RETRY_CONSTANTS.JITTER_PERCENTAGE));
      // Two calls should produce different values (likely)
      // But we can't guarantee they're different due to randomness
    });

    it('should use default constants when not specified', () => {
      const delay = calculateBackoff(1);
      assert.ok(delay >= 0);
      assert.ok(delay <= RETRY_CONSTANTS.DEFAULT_MAX_DELAY_MS);
    });

    it('should not return negative values', () => {
      const delay = calculateBackoff(0, 0, 0, true);
      assert.ok(delay >= 0);
    });
  });

  describe('enhanceErrorMessage', () => {
    it('should enhance error message with context', () => {
      const error = new Error('API call failed');
      const enhanced = enhanceErrorMessage(error, 3, 'validateScreenshot');

      assert.ok(enhanced.includes('API call failed'));
      assert.ok(enhanced.includes('Operation: validateScreenshot'));
      assert.ok(enhanced.includes('Attempts: 3'));
    });

    it('should include provider info for ProviderError', () => {
      const error = new ProviderError('API error', 'gemini', { statusCode: 500 });
      const enhanced = enhanceErrorMessage(error, 2, 'test');

      assert.ok(enhanced.includes('Provider: gemini'));
      assert.ok(enhanced.includes('HTTP Status: 500'));
    });

    it('should include timeout info for TimeoutError', () => {
      const error = new TimeoutError('Operation timed out', 5000);
      const enhanced = enhanceErrorMessage(error, 1, 'test');

      assert.ok(enhanced.includes('Timeout: 5000ms'));
    });

    it('should handle errors without message', () => {
      const error = new Error();
      const enhanced = enhanceErrorMessage(error, 1, 'test');

      assert.ok(enhanced.includes('Unknown error'));
      assert.ok(enhanced.includes('Attempts: 1'));
    });
  });

  describe('retryWithBackoff', () => {
    it('should succeed on first attempt', async () => {
      let callCount = 0;
      const fn = async () => {
        callCount++;
        return 'success';
      };

      const result = await retryWithBackoff(fn);
      assert.strictEqual(result, 'success');
      assert.strictEqual(callCount, 1);
    });

    it('should retry on retryable error', async () => {
      let callCount = 0;
      const fn = async () => {
        callCount++;
        if (callCount < 2) {
          throw new TimeoutError('Timeout', 5000);
        }
        return 'success';
      };

      const result = await retryWithBackoff(fn, { maxRetries: 2, baseDelay: 10 });
      assert.strictEqual(result, 'success');
      assert.strictEqual(callCount, 2);
    });

    it('should throw on non-retryable error', async () => {
      let callCount = 0;
      const fn = async () => {
        callCount++;
        throw new ValidationError('Invalid input');
      };

      try {
        await retryWithBackoff(fn, { maxRetries: 2, baseDelay: 10 });
        assert.fail('Should have thrown');
      } catch (error) {
        assert.ok(error instanceof ValidationError);
        assert.strictEqual(callCount, 1); // Should not retry
      }
    });

    it('should throw after max retries', async () => {
      let callCount = 0;
      const fn = async () => {
        callCount++;
        throw new TimeoutError('Timeout', 5000);
      };

      try {
        await retryWithBackoff(fn, { maxRetries: 2, baseDelay: 10 });
        assert.fail('Should have thrown');
      } catch (error) {
        assert.ok(error instanceof TimeoutError);
        assert.strictEqual(callCount, 3); // Initial + 2 retries
        assert.ok(error.message.includes('Attempts: 3'));
      }
    });

    it('should call onRetry callback', async () => {
      const retryCalls = [];
      let callCount = 0;
      const fn = async () => {
        callCount++;
        if (callCount < 2) {
          throw new TimeoutError('Timeout', 5000);
        }
        return 'success';
      };

      await retryWithBackoff(fn, {
        maxRetries: 2,
        baseDelay: 10,
        onRetry: (error, attempt, delay) => {
          retryCalls.push({ error, attempt, delay });
        }
      });

      assert.strictEqual(retryCalls.length, 1);
      assert.ok(retryCalls[0].error instanceof TimeoutError);
      assert.strictEqual(retryCalls[0].attempt, 1);
      assert.ok(retryCalls[0].delay >= 0);
    });

    it('should use custom retryable function', async () => {
      let callCount = 0;
      const fn = async () => {
        callCount++;
        if (callCount < 2) {
          throw new ValidationError('Custom retryable');
        }
        return 'success';
      };

      const customRetryable = (error) => {
        return error instanceof ValidationError && error.message.includes('Custom');
      };

      const result = await retryWithBackoff(fn, {
        maxRetries: 2,
        baseDelay: 10,
        retryable: customRetryable
      });

      assert.strictEqual(result, 'success');
      assert.strictEqual(callCount, 2);
    });

    it('should use default constants', async () => {
      let callCount = 0;
      const fn = async () => {
        callCount++;
        if (callCount < 2) {
          throw new TimeoutError('Timeout', 5000);
        }
        return 'success';
      };

      const result = await retryWithBackoff(fn);
      assert.strictEqual(result, 'success');
      assert.strictEqual(callCount, 2);
    });
  });
});

