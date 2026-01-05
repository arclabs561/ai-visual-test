/**
 * Tests for utils/performance-logger.mjs
 */

import '../test-setup.mjs';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  logAPICallPerformance,
  logCacheOperation,
  logTemporalDecision,
  logBatchOptimizer,
  logErrorPattern,
  logCacheStats
} from '../../src/utils/performance-logger.mjs';

describe('Performance Logger', () => {
  describe('logAPICallPerformance', () => {
    it('should export logAPICallPerformance function', () => {
      assert.strictEqual(typeof logAPICallPerformance, 'function');
    });

    it('should log successful API call', () => {
      assert.doesNotThrow(() => {
        logAPICallPerformance({
          provider: 'gemini',
          latency: 500,
          cost: 0.001,
          inputTokens: 100,
          outputTokens: 50,
          success: true
        });
      });
    });

    it('should log failed API call', () => {
      assert.doesNotThrow(() => {
        logAPICallPerformance({
          provider: 'gemini',
          latency: 1000,
          success: false,
          error: new Error('API error')
        });
      });
    });

    it('should log retries', () => {
      assert.doesNotThrow(() => {
        logAPICallPerformance({
          provider: 'openai',
          latency: 2000,
          retries: 2,
          cost: 0.002,
          success: true
        });
      });
    });

    it('should handle missing optional parameters', () => {
      assert.doesNotThrow(() => {
        logAPICallPerformance({
          provider: 'claude',
          latency: 300
        });
      });
    });
  });

  describe('logCacheOperation', () => {
    it('should export logCacheOperation function', () => {
      assert.strictEqual(typeof logCacheOperation, 'function');
    });

    it('should log cache hit', () => {
      assert.doesNotThrow(() => {
        logCacheOperation({
          operation: 'hit',
          hit: true,
          latency: 5
        });
      });
    });

    it('should log cache miss', () => {
      assert.doesNotThrow(() => {
        logCacheOperation({
          operation: 'miss',
          hit: false,
          latency: 10
        });
      });
    });

    it('should log cache eviction', () => {
      assert.doesNotThrow(() => {
        logCacheOperation({
          operation: 'evict',
          hit: false,
          reason: 'LRU',
          cacheSize: 1000,
          maxSize: 1000
        });
      });
    });

    it('should log cache expiration', () => {
      assert.doesNotThrow(() => {
        logCacheOperation({
          operation: 'expire',
          hit: false,
          reason: 'TTL exceeded'
        });
      });
    });
  });

  describe('logTemporalDecision', () => {
    it('should export logTemporalDecision function', () => {
      assert.strictEqual(typeof logTemporalDecision, 'function');
    });

    it('should log decision to prompt', () => {
      assert.doesNotThrow(() => {
        logTemporalDecision({
          decision: 'prompt',
          reason: 'state_change',
          urgency: 0.8,
          notesCount: 10
        });
      });
    });

    it('should log decision to skip', () => {
      assert.doesNotThrow(() => {
        logTemporalDecision({
          decision: 'skip',
          reason: 'no_change',
          urgency: 0.2,
          notesCount: 5
        });
      });
    });

    it('should handle missing optional parameters', () => {
      assert.doesNotThrow(() => {
        logTemporalDecision({
          decision: 'prompt'
        });
      });
    });
  });

  describe('logBatchOptimizer', () => {
    it('should export logBatchOptimizer function', () => {
      assert.strictEqual(typeof logBatchOptimizer, 'function');
    });

    it('should log batch processing', () => {
      assert.doesNotThrow(() => {
        logBatchOptimizer({
          batchSize: 5,
          queueDepth: 10,
          processingTime: 100
        });
      });
    });

    it('should log queue timeout', () => {
      assert.doesNotThrow(() => {
        logBatchOptimizer({
          batchSize: 3,
          queueDepth: 20,
          timeout: true
        });
      });
    });

    it('should log queue rejection', () => {
      assert.doesNotThrow(() => {
        logBatchOptimizer({
          batchSize: 0,
          queueDepth: 100,
          rejected: true,
          reason: 'queue_full'
        });
      });
    });
  });

  describe('logErrorPattern', () => {
    it('should export logErrorPattern function', () => {
      assert.strictEqual(typeof logErrorPattern, 'function');
    });

    it('should log error pattern', () => {
      assert.doesNotThrow(() => {
        logErrorPattern({
          error: new Error('ProviderError'),
          context: 'gemini API call',
          retryCount: 3
        });
      });
    });

    it('should log retry pattern', () => {
      assert.doesNotThrow(() => {
        logErrorPattern({
          error: new Error('TimeoutError'),
          context: 'API call',
          retryCount: 2,
          recovered: true
        });
      });
    });
  });

  describe('logCacheStats', () => {
    it('should export logCacheStats function', () => {
      assert.strictEqual(typeof logCacheStats, 'function');
    });

    it('should log cache statistics', () => {
      assert.doesNotThrow(() => {
        logCacheStats({
          hits: 85,
          misses: 15,
          hitRate: 0.85,
          avgLatency: 5
        });
      });
    });

    it('should handle missing optional parameters', () => {
      // hitRate and avgLatency are required, but savings is optional
      assert.doesNotThrow(() => {
        logCacheStats({
          hits: 50,
          misses: 10,
          hitRate: (50 / 60) * 100,
          avgLatency: 5
          // savings is optional
        });
      });
    });
  });
});

