/**
 * Tests for session-cost-tracker.mjs
 */

import '../test-setup.mjs';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import {
  startSession,
  endSession,
  getSessionCosts,
  recordSessionCost,
  recordSessionCacheHit,
  recordSessionCacheMiss,
  getActiveSessions,
  getGlobalCostStats
} from '../../src/session-cost-tracker.mjs';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, existsSync, rmdirSync, unlinkSync } from 'fs';
import { initCache, clearCache } from '../../src/cache.js';

const TEST_CACHE_DIR = join(tmpdir(), 'ai-visual-test-session-cost-test');
const TEST_END_OPTIONS = { saveReport: false, verbose: false };

describe('Session Cost Tracker', () => {
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

  describe('startSession', () => {
    it('should start a new session', () => {
      const sessionId = startSession('test-session');
      
      assert.ok(sessionId);
      assert.strictEqual(typeof sessionId, 'string');
    });

    it('should create unique session IDs', () => {
      const id1 = startSession('session1');
      const id2 = startSession('session2');
      
      assert.notStrictEqual(id1, id2);
    });

    it('should track session name', () => {
      const sessionId = startSession('my-test');
      const sessions = getActiveSessions();
      
      // getActiveSessions returns array of session IDs
      assert.ok(Array.isArray(sessions));
      assert.ok(sessions.includes(sessionId));
      
      // Verify session exists by getting its costs
      const costs = getSessionCosts(sessionId);
      assert.ok(costs);
      assert.strictEqual(costs.name, 'my-test');
    });
  });

  describe('endSession', () => {
    it('should end a session and return summary', () => {
      const sessionId = startSession('test');
      recordSessionCost(sessionId, {
        provider: 'gemini',
        cost: 0.001,
        inputTokens: 100,
        outputTokens: 50
      });
      
      const summary = endSession(sessionId, TEST_END_OPTIONS);
      
      assert.ok(summary);
      assert.strictEqual(summary.sessionId, sessionId);
      assert.strictEqual(summary.name, 'test');
      // Summary structure: { sessionId, name, duration, costs: { total, ... }, ... }
      assert.ok(summary.costs);
      assert.strictEqual(summary.costs.total, 0.001);
      assert.ok(summary.duration >= 0);
    });

    it('should calculate cache hit rate', () => {
      const sessionId = startSession('test');
      recordSessionCacheHit(sessionId);
      recordSessionCacheHit(sessionId);
      recordSessionCacheMiss(sessionId);
      
      const summary = endSession(sessionId, TEST_END_OPTIONS);
      
      // cacheHitRate is in costs object
      assert.ok(summary.costs.cacheHitRate);
      // 2 hits / 3 total = 66.7%
      assert.ok(parseFloat(summary.costs.cacheHitRate) >= 66);
    });

    it('should track costs by provider', () => {
      const sessionId = startSession('test');
      recordSessionCost(sessionId, { provider: 'gemini', cost: 0.001 });
      recordSessionCost(sessionId, { provider: 'openai', cost: 0.002 });
      
      const summary = endSession(sessionId, TEST_END_OPTIONS);
      
      assert.ok(summary.costs.byProvider.gemini);
      assert.ok(summary.costs.byProvider.openai);
      assert.strictEqual(summary.costs.byProvider.gemini.total, 0.001);
      assert.strictEqual(summary.costs.byProvider.openai.total, 0.002);
    });

    it('should track costs by test', () => {
      const sessionId = startSession('test');
      recordSessionCost(sessionId, {
        provider: 'gemini',
        cost: 0.001,
        testName: 'test1'
      });
      recordSessionCost(sessionId, {
        provider: 'gemini',
        cost: 0.002,
        testName: 'test2'
      });
      
      const summary = endSession(sessionId, TEST_END_OPTIONS);
      
      assert.ok(summary.costs.byTest.test1);
      assert.ok(summary.costs.byTest.test2);
    });

    it('should track token usage', () => {
      const sessionId = startSession('test');
      recordSessionCost(sessionId, {
        provider: 'gemini',
        cost: 0.001,
        inputTokens: 100,
        outputTokens: 50
      });
      
      const summary = endSession(sessionId, TEST_END_OPTIONS);
      
      assert.strictEqual(summary.costs.tokens.input, 100);
      assert.strictEqual(summary.costs.tokens.output, 50);
      assert.strictEqual(summary.costs.tokens.total, 150);
    });
  });

  describe('recordSessionCost', () => {
    it('should record cost for a session', () => {
      const sessionId = startSession('test');
      recordSessionCost(sessionId, {
        provider: 'gemini',
        cost: 0.001
      });
      
      const summary = getSessionCosts(sessionId);
      assert.ok(summary);
      assert.strictEqual(summary.costs.total, 0.001);
    });

    it('should increment API call count', () => {
      const sessionId = startSession('test');
      recordSessionCost(sessionId, { provider: 'gemini', cost: 0.001 });
      recordSessionCost(sessionId, { provider: 'gemini', cost: 0.001 });
      
      const summary = getSessionCosts(sessionId);
      assert.strictEqual(summary.costs.apiCalls, 2);
    });
  });

  describe('recordSessionCacheHit/Miss', () => {
    it('should record cache hits', () => {
      const sessionId = startSession('test');
      recordSessionCacheHit(sessionId);
      recordSessionCacheHit(sessionId);
      
      const summary = getSessionCosts(sessionId);
      assert.strictEqual(summary.costs.cacheHits, 2);
    });

    it('should record cache misses', () => {
      const sessionId = startSession('test');
      recordSessionCacheMiss(sessionId);
      
      const summary = getSessionCosts(sessionId);
      assert.strictEqual(summary.costs.cacheMisses, 1);
    });
  });

  describe('getSessionCosts', () => {
    it('should return session costs', () => {
      const sessionId = startSession('test');
      recordSessionCost(sessionId, { provider: 'gemini', cost: 0.001 });
      
      const costs = getSessionCosts(sessionId);
      
      assert.ok(costs);
      // getSessionCosts returns session.getSummary() which has costs.total
      assert.strictEqual(typeof costs.costs, 'object');
      assert.strictEqual(costs.costs.total, 0.001);
      assert.strictEqual(costs.costs.apiCalls, 1);
    });

    it('should return null for non-existent session', () => {
      const costs = getSessionCosts('non-existent');
      assert.strictEqual(costs, null);
    });
  });

  describe('getActiveSessions', () => {
    it('should return active session IDs', () => {
      const id1 = startSession('session1');
      const id2 = startSession('session2');
      
      const sessions = getActiveSessions();
      
      assert.ok(Array.isArray(sessions));
      assert.ok(sessions.includes(id1));
      assert.ok(sessions.includes(id2));
    });

    it('should not include ended sessions', () => {
      const id1 = startSession('session1');
      const id2 = startSession('session2');
      endSession(id1, TEST_END_OPTIONS);
      
      const sessions = getActiveSessions();
      
      assert.ok(Array.isArray(sessions));
      assert.ok(!sessions.includes(id1));
      assert.ok(sessions.includes(id2));
    });
  });

  describe('getGlobalCostStats', () => {
    it('should return global cost statistics', () => {
      const sessionId = startSession('test');
      recordSessionCost(sessionId, { provider: 'gemini', cost: 0.001 });
      endSession(sessionId, TEST_END_OPTIONS);
      
      const stats = getGlobalCostStats();
      
      assert.ok(stats);
      // getGlobalCostStats returns tracker.getStats() which has total, count, byProvider
      assert.strictEqual(typeof stats.total, 'number');
      assert.strictEqual(typeof stats.count, 'number');
      assert.ok(stats.total >= 0);
      assert.ok(stats.count >= 0);
    });
  });
});
