/**
 * Tests for rate-limiter.mjs
 */

import '../test-setup.mjs';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  RateLimiter,
  getRateLimiter,
  resetRateLimiter
} from '../../src/utils/rate-limiter.mjs';
import { ValidationError } from '../../src/errors.js';

describe('Rate Limiter', () => {
  let limiter;

  beforeEach(() => {
    limiter = new RateLimiter({
      maxRequests: 5,
      maxCost: 10.0,
      windowMs: 1000,
      costWindowMs: 3600000
    });
    resetRateLimiter();
  });

  describe('RateLimiter', () => {
    it('should create instance with default options', () => {
      const defaultLimiter = new RateLimiter();
      
      assert.strictEqual(defaultLimiter.maxRequests, 60);
      assert.strictEqual(defaultLimiter.maxCost, 10.0);
      assert.strictEqual(defaultLimiter.windowMs, 60000);
      assert.strictEqual(defaultLimiter.costWindowMs, 3600000);
    });

    it('should create instance with custom options', () => {
      assert.strictEqual(limiter.maxRequests, 5);
      assert.strictEqual(limiter.maxCost, 10.0);
      assert.strictEqual(limiter.windowMs, 1000);
    });

    it('should allow requests within limit', () => {
      for (let i = 0; i < 5; i++) {
        assert.doesNotThrow(() => limiter.checkLimit(0.1));
      }
    });

    it('should throw ValidationError when request limit exceeded', () => {
      // Fill up the limit
      for (let i = 0; i < 5; i++) {
        limiter.checkLimit(0.1);
      }
      
      // Next request should fail
      assert.throws(() => limiter.checkLimit(0.1), ValidationError);
    });

    it('should throw ValidationError when cost limit exceeded', () => {
      // Add costs up to limit
      limiter.checkLimit(9.0);
      
      // Next request that would exceed limit should fail
      assert.throws(() => limiter.checkLimit(2.0), ValidationError);
    });

    it('should allow requests after window expires', async () => {
      // Fill up the limit
      for (let i = 0; i < 5; i++) {
        limiter.checkLimit(0.1);
      }
      
      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Should allow new request
      assert.doesNotThrow(() => limiter.checkLimit(0.1));
    });

    it('should get status', () => {
      limiter.checkLimit(1.0);
      limiter.checkLimit(2.0);
      
      const status = limiter.getStatus();
      
      assert.strictEqual(status.requests.current, 2);
      assert.strictEqual(status.requests.limit, 5);
      assert.strictEqual(status.requests.remaining, 3);
      assert.strictEqual(status.costs.current, 3.0);
      assert.strictEqual(status.costs.limit, 10.0);
      assert.strictEqual(status.costs.remaining, 7.0);
    });

    it('should reset', () => {
      limiter.checkLimit(1.0);
      limiter.reset();
      
      const status = limiter.getStatus();
      assert.strictEqual(status.requests.current, 0);
      assert.strictEqual(status.costs.current, 0);
    });

    it('should clean up old entries', async () => {
      limiter.checkLimit(1.0);
      
      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const status = limiter.getStatus();
      assert.strictEqual(status.requests.current, 0);
    });
  });

  describe('getRateLimiter', () => {
    it('should return singleton instance', () => {
      const limiter1 = getRateLimiter();
      const limiter2 = getRateLimiter();
      
      assert.strictEqual(limiter1, limiter2);
    });

    it('should create with options on first call', () => {
      const limiter = getRateLimiter({ maxRequests: 10 });
      assert.strictEqual(limiter.maxRequests, 10);
    });
  });

  describe('resetRateLimiter', () => {
    it('should reset global limiter', () => {
      const limiter1 = getRateLimiter();
      resetRateLimiter();
      const limiter2 = getRateLimiter();
      
      // Should be different instances after reset
      assert.notStrictEqual(limiter1, limiter2);
    });
  });
});
