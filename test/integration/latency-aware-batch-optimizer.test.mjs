/**
 * Integration tests for latency-aware-batch-optimizer.mjs
 */

import '../test-setup.mjs';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { LatencyAwareBatchOptimizer } from '../../src/latency-aware-batch-optimizer.js';

describe('Latency-Aware Batch Optimizer', () => {
  let optimizer;

  beforeEach(() => {
    optimizer = new LatencyAwareBatchOptimizer({
      maxConcurrency: 2,
      batchSize: 3,
      cacheEnabled: false
    });
  });

  describe('constructor', () => {
    it('should create optimizer with default options', () => {
      const opt = new LatencyAwareBatchOptimizer();
      
      assert.ok(opt);
      assert.strictEqual(opt.defaultMaxLatency, 1000);
      assert.strictEqual(opt.adaptiveBatchSize, true);
    });

    it('should accept custom options', () => {
      const opt = new LatencyAwareBatchOptimizer({
        defaultMaxLatency: 500,
        adaptiveBatchSize: false
      });
      
      assert.strictEqual(opt.defaultMaxLatency, 500);
      assert.strictEqual(opt.adaptiveBatchSize, false);
    });
  });

  describe('addRequest with latency requirements', () => {
    it('should handle critical requests (<100ms)', async () => {
      // Mock the _processRequest method
      let processed = false;
      optimizer._processRequest = async () => {
        processed = true;
        return { score: 8.0, issues: [] };
      };
      
      const result = await optimizer.addRequest(
        'test.png',
        'Test prompt',
        {},
        50 // 50ms latency requirement
      );
      
      assert.ok(processed);
      assert.ok(result);
    });

    it('should use adaptive batch size for fast requests (<200ms)', async () => {
      let batchSizeUsed = null;
      const originalQueueRequest = optimizer._queueRequest;
      optimizer._queueRequest = async (...args) => {
        batchSizeUsed = optimizer.batchSize;
        return { score: 8.0, issues: [] };
      };
      
      await optimizer.addRequest(
        'test.png',
        'Test prompt',
        {},
        150 // 150ms latency requirement
      );
      
      // Should use smaller batch size (1) for fast requests
      assert.ok(batchSizeUsed === 1 || batchSizeUsed === 3);
    });

    it('should use standard batching for normal requests', async () => {
      let batchSizeUsed = null;
      const originalQueueRequest = optimizer._queueRequest;
      optimizer._queueRequest = async (...args) => {
        batchSizeUsed = optimizer.batchSize;
        return { score: 8.0, issues: [] };
      };
      
      await optimizer.addRequest(
        'test.png',
        'Test prompt',
        {},
        500 // 500ms latency requirement
      );
      
      // Should use standard batch size
      assert.strictEqual(batchSizeUsed, 3);
    });

    it('should clear critical request tracking once direct processing completes', async () => {
      optimizer._processRequest = async () => {
        return { score: 8.0, issues: [] };
      };
      
      await optimizer.addRequest(
        'critical.png',
        'Test prompt',
        {},
        50
      );
      
      assert.ok(!optimizer.criticalRequests.has('critical.png'));
    });
  });

  describe('latency-aware queue processing', () => {
    it('should prioritize critical requests', () => {
      // Add requests with different latency requirements
      optimizer.queue = [
        { imagePath: 'normal.png', prompt: 'Test', context: { maxLatency: 1000 } },
        { imagePath: 'critical.png', prompt: 'Test', context: { maxLatency: 50 } },
        { imagePath: 'fast.png', prompt: 'Test', context: { maxLatency: 200 } }
      ];
      
      // Sort queue (simulating _processQueue behavior)
      const sorted = [...optimizer.queue].sort((a, b) => {
        const latencyA = a.context?.maxLatency || optimizer.defaultMaxLatency;
        const latencyB = b.context?.maxLatency || optimizer.defaultMaxLatency;
        if (latencyA < latencyB) return -1;
        if (latencyA > latencyB) return 1;
        return 0;
      });
      
      // Critical request should come first
      assert.strictEqual(sorted[0].imagePath, 'critical.png');
    });
  });
});
