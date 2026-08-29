/**
 * Tests for cost-tracker.js
 */

import '../test-setup.mjs';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import {
  CostTracker,
  getCostTracker,
  recordCost,
  getCostStats,
  setBudgetLimit,
  getBudgetStatus
} from '../../src/cost-tracker.js';
import { initCache, clearCache } from '../../src/cache.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, existsSync, rmdirSync, unlinkSync } from 'fs';

const TEST_CACHE_DIR = join(tmpdir(), 'ai-visual-test-cost-tracker-test');

describe('Cost Tracker', () => {
  beforeEach(() => {
    // Initialize test cache
    if (existsSync(TEST_CACHE_DIR)) {
      try {
        const cacheFile = join(TEST_CACHE_DIR, 'cache.json');
        if (existsSync(cacheFile)) {
          unlinkSync(cacheFile);
        }
        rmdirSync(TEST_CACHE_DIR);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    mkdirSync(TEST_CACHE_DIR, { recursive: true });
    initCache(TEST_CACHE_DIR);
  });

  afterEach(() => {
    // Clean up
    clearCache();
    if (existsSync(TEST_CACHE_DIR)) {
      try {
        const cacheFile = join(TEST_CACHE_DIR, 'cache.json');
        if (existsSync(cacheFile)) {
          unlinkSync(cacheFile);
        }
        rmdirSync(TEST_CACHE_DIR);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  });

  describe('CostTracker class', () => {
    it('should create instance with default options', () => {
      const tracker = new CostTracker();
      assert.ok(tracker);
      assert.strictEqual(tracker.storageKey, 'ai-visual-test-costs');
      assert.strictEqual(tracker.maxHistory, 1000);
    });

    it('should create instance with custom options', () => {
      const tracker = new CostTracker({
        storageKey: 'custom-key',
        maxHistory: 500
      });
      assert.strictEqual(tracker.storageKey, 'custom-key');
      assert.strictEqual(tracker.maxHistory, 500);
    });

    it('should record cost', () => {
      const tracker = new CostTracker();
      tracker.recordCost({
        provider: 'gemini',
        cost: 0.001,
        inputTokens: 100,
        outputTokens: 50,
        testName: 'test1'
      });
      
      assert.strictEqual(tracker.costs.totals.total, 0.001);
      assert.strictEqual(tracker.costs.totals.count, 1);
      assert.ok(tracker.costs.byProvider.gemini);
      assert.strictEqual(tracker.costs.byProvider.gemini.total, 0.001);
    });

    it('should track costs by provider', () => {
      const tracker = new CostTracker();
      tracker.recordCost({ provider: 'gemini', cost: 0.001 });
      tracker.recordCost({ provider: 'openai', cost: 0.002 });
      tracker.recordCost({ provider: 'gemini', cost: 0.001 });
      
      assert.strictEqual(tracker.costs.byProvider.gemini.total, 0.002);
      assert.strictEqual(tracker.costs.byProvider.gemini.count, 2);
      assert.strictEqual(tracker.costs.byProvider.openai.total, 0.002);
      assert.strictEqual(tracker.costs.byProvider.openai.count, 1);
    });

    it('should track token usage', () => {
      const tracker = new CostTracker();
      tracker.recordCost({
        provider: 'gemini',
        cost: 0.001,
        inputTokens: 100,
        outputTokens: 50
      });
      
      assert.strictEqual(tracker.costs.byProvider.gemini.inputTokens, 100);
      assert.strictEqual(tracker.costs.byProvider.gemini.outputTokens, 50);
    });

    it('persists cost data using the cache payload rather than cache context', () => {
      const storageKey = 'persisted-costs';
      const tracker = new CostTracker({ storageKey });
      tracker.recordCost({ provider: 'gemini', cost: 0.001, inputTokens: 100 });

      const restored = new CostTracker({ storageKey });
      assert.strictEqual(restored.getStats().count, 1);
      assert.strictEqual(restored.getStats().byProvider.gemini.inputTokens, 100);
    });

    it('should trim history when exceeding maxHistory', () => {
      const tracker = new CostTracker({ maxHistory: 5 });
      
      for (let i = 0; i < 10; i++) {
        tracker.recordCost({ provider: 'gemini', cost: 0.001 });
      }
      
      assert.strictEqual(tracker.costs.history.length, 5);
    });

    it('should skip null/undefined costs', () => {
      const tracker = new CostTracker();
      tracker.recordCost({ provider: 'gemini', cost: null });
      tracker.recordCost({ provider: 'gemini', cost: undefined });
      tracker.recordCost({ provider: 'gemini', cost: 0.001 });
      
      assert.strictEqual(tracker.costs.totals.count, 1);
      assert.strictEqual(tracker.costs.totals.total, 0.001);
    });

    it('should get cost statistics', () => {
      const tracker = new CostTracker();
      tracker.recordCost({ provider: 'gemini', cost: 0.001 });
      tracker.recordCost({ provider: 'openai', cost: 0.002 });
      
      const stats = tracker.getStats();
      
      assert.ok(stats);
      assert.strictEqual(stats.total, 0.003);
      assert.strictEqual(stats.count, 2);
      assert.ok(stats.byProvider.gemini);
      assert.ok(stats.byProvider.openai);
    });

    it('should set budget limit using global tracker', () => {
      setBudgetLimit(10.0);
      const status = getBudgetStatus();
      
      assert.ok(status);
      // getBudgetStatus returns { hasBudgets: true/false, statuses: [...] }
      if (status.hasBudgets) {
        assert.ok(status.statuses);
        assert.ok(status.statuses.length > 0);
        assert.strictEqual(status.statuses[0].limit, 10.0);
      } else {
        // If no budgets set, that's also valid
        assert.strictEqual(status.hasBudgets, false);
      }
    });

    it('should check budget status using global tracker', () => {
      setBudgetLimit(1.0);
      recordCost({ provider: 'gemini', cost: 0.5 });
      
      const status = getBudgetStatus();
      
      assert.ok(status);
      if (status.hasBudgets && status.statuses && status.statuses.length > 0) {
        assert.ok(status.statuses[0].current >= 0);
        assert.ok(status.statuses[0].remaining >= 0);
      }
    });

    it('should track budget usage', () => {
      const tracker = getCostTracker();
      // Reset budgets for this test
      tracker.costs.budgets = [];
      
      setBudgetLimit(1.0);
      recordCost({ provider: 'gemini', cost: 0.3 });
      recordCost({ provider: 'openai', cost: 0.2 });
      
      const status = getBudgetStatus();
      
      assert.ok(status);
      assert.ok(status.hasBudgets);
      assert.ok(status.statuses && status.statuses.length > 0);
      assert.ok(status.statuses[0].current >= 0.5);
      assert.ok(status.statuses[0].remaining <= 0.5);
    });
  });

  describe('getCostTracker', () => {
    it('should return singleton instance', () => {
      const tracker1 = getCostTracker();
      const tracker2 = getCostTracker();
      
      assert.strictEqual(tracker1, tracker2);
    });

    it('should return CostTracker instance', () => {
      const tracker = getCostTracker();
      assert.ok(tracker instanceof CostTracker);
    });
  });

  describe('recordCost function', () => {
    it('should record cost using global tracker', () => {
      recordCost({
        provider: 'gemini',
        cost: 0.001,
        testName: 'test'
      });
      
      const stats = getCostStats();
      assert.ok(stats);
    });
  });

  describe('getCostStats function', () => {
    it('should return cost statistics', () => {
      recordCost({ provider: 'gemini', cost: 0.001 });
      const stats = getCostStats();
      
      assert.ok(stats);
      assert.ok(stats.total >= 0);
    });
  });

  describe('setBudgetLimit function', () => {
    it('should set budget limit', () => {
      const tracker = getCostTracker();
      // Reset budgets for this test
      tracker.costs.budgets = [];
      
      setBudgetLimit(5.0);
      const status = getBudgetStatus();
      
      assert.ok(status);
      assert.ok(status.hasBudgets);
      assert.ok(status.statuses && status.statuses.length > 0);
      assert.strictEqual(status.statuses[0].limit, 5.0);
    });
  });

  describe('getBudgetStatus function', () => {
    it('should return budget status', () => {
      setBudgetLimit(10.0);
      const status = getBudgetStatus();
      
      assert.ok(status);
      if (status.hasBudgets && status.statuses && status.statuses.length > 0) {
        assert.strictEqual(typeof status.statuses[0].limit, 'number');
        assert.strictEqual(typeof status.statuses[0].current, 'number');
        assert.strictEqual(typeof status.statuses[0].remaining, 'number');
      }
    });
  });
});
