/**
 * Rate Limiter Utilities
 * 
 * Provides rate limiting to prevent API abuse and cost amplification attacks.
 * Supports both request-based and cost-based limiting.
 */

import { ValidationError } from '../errors.mjs';

/**
 * Rate Limiter Class
 * 
 * Tracks requests and costs over time windows to enforce limits.
 */
export class RateLimiter {
  constructor(options = {}) {
    this.maxRequests = options.maxRequests || 60; // per minute
    this.maxCost = options.maxCost || 10.0; // per hour (USD)
    this.windowMs = options.windowMs || 60000; // 1 minute for requests
    this.costWindowMs = options.costWindowMs || 3600000; // 1 hour for costs
    
    // In-memory storage (for single-instance deployments)
    // For distributed deployments, use Redis or similar
    this.requests = [];
    this.costs = [];
  }

  /**
   * Check if a request is allowed
   * 
   * @param {number} [estimatedCost=0] - Estimated cost of the request (USD)
   * @throws {ValidationError} If rate limit exceeded
   */
  checkLimit(estimatedCost = 0) {
    const now = Date.now();
    
    // Clean up old entries
    this.requests = this.requests.filter(timestamp => now - timestamp < this.windowMs);
    this.costs = this.costs.filter(entry => now - entry.timestamp < this.costWindowMs);
    
    // Check request limit
    if (this.requests.length >= this.maxRequests) {
      throw new ValidationError(
        `Rate limit exceeded: ${this.maxRequests} requests per ${this.windowMs / 1000} seconds`,
        null,
        {
          limit: this.maxRequests,
          window: this.windowMs,
          current: this.requests.length
        }
      );
    }
    
    // Check cost limit
    const totalCost = this.costs.reduce((sum, entry) => sum + entry.cost, 0);
    if (totalCost + estimatedCost > this.maxCost) {
      throw new ValidationError(
        `Cost limit exceeded: $${this.maxCost} per ${this.costWindowMs / 1000 / 60} minutes`,
        null,
        {
          limit: this.maxCost,
          window: this.costWindowMs,
          current: totalCost,
          estimated: estimatedCost
        }
      );
    }
    
    // Record request
    this.requests.push(now);
    
    // Record cost if provided
    if (estimatedCost > 0) {
      this.costs.push({
        cost: estimatedCost,
        timestamp: now
      });
    }
  }

  /**
   * Get current rate limit status
   * 
   * @returns {Object} Current status
   */
  getStatus() {
    const now = Date.now();
    
    // Clean up old entries
    this.requests = this.requests.filter(timestamp => now - timestamp < this.windowMs);
    this.costs = this.costs.filter(entry => now - entry.timestamp < this.costWindowMs);
    
    const totalCost = this.costs.reduce((sum, entry) => sum + entry.cost, 0);
    
    return {
      requests: {
        current: this.requests.length,
        limit: this.maxRequests,
        remaining: Math.max(0, this.maxRequests - this.requests.length),
        window: this.windowMs
      },
      costs: {
        current: totalCost,
        limit: this.maxCost,
        remaining: Math.max(0, this.maxCost - totalCost),
        window: this.costWindowMs
      }
    };
  }

  /**
   * Reset rate limiter (for testing or manual reset)
   */
  reset() {
    this.requests = [];
    this.costs = [];
  }
}

/**
 * Global rate limiter instance (singleton)
 */
let globalRateLimiter = null;

/**
 * Get or create global rate limiter
 * 
 * @param {Object} [options={}] - Rate limiter options
 * @returns {RateLimiter} Rate limiter instance
 */
export function getRateLimiter(options = {}) {
  if (!globalRateLimiter) {
    globalRateLimiter = new RateLimiter(options);
  }
  return globalRateLimiter;
}

/**
 * Reset global rate limiter (for testing)
 */
export function resetRateLimiter() {
  globalRateLimiter = null;
}

