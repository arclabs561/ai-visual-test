/**
 * Tests for batch-optimizer.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { BatchOptimizer } from '../src/batch-optimizer.mjs';

test('BatchOptimizer - constructor with default options', () => {
  const optimizer = new BatchOptimizer();
  
  assert.ok(optimizer);
  assert.strictEqual(optimizer.maxConcurrency, 5);
  assert.strictEqual(optimizer.batchSize, 3);
  assert.strictEqual(optimizer.cache !== null, true);
});

test('BatchOptimizer - constructor with custom options', () => {
  const optimizer = new BatchOptimizer({
    maxConcurrency: 10,
    batchSize: 5,
    cacheEnabled: false
  });
  
  assert.strictEqual(optimizer.maxConcurrency, 10);
  assert.strictEqual(optimizer.batchSize, 5);
  assert.strictEqual(optimizer.cache, null);
});

test('BatchOptimizer - _getCacheKey generates consistent keys', () => {
  const optimizer = new BatchOptimizer();
  const key1 = optimizer._getCacheKey('test.png', 'prompt', { test: 'value' });
  const key2 = optimizer._getCacheKey('test.png', 'prompt', { test: 'value' });
  
  assert.strictEqual(key1, key2);
});

test('BatchOptimizer - _getCacheKey different inputs generate different keys', () => {
  const optimizer = new BatchOptimizer();
  const key1 = optimizer._getCacheKey('test1.png', 'prompt', {});
  const key2 = optimizer._getCacheKey('test2.png', 'prompt', {});
  
  assert.notStrictEqual(key1, key2);
});

test('BatchOptimizer - clearCache clears cache', () => {
  const optimizer = new BatchOptimizer({ cacheEnabled: true });
  
  // Set cache manually (since we can't easily test batchValidate without mocking)
  optimizer.cache.set('test-key', { score: 8 });
  
  optimizer.clearCache();
  
  assert.strictEqual(optimizer.cache.size, 0);
});

test('BatchOptimizer - getCacheStats returns statistics', () => {
  const optimizer = new BatchOptimizer({ cacheEnabled: true });
  
  const stats = optimizer.getCacheStats();
  
  assert.ok(stats);
  assert.strictEqual(typeof stats.cacheSize, 'number');
  assert.strictEqual(typeof stats.queueLength, 'number');
  assert.strictEqual(typeof stats.activeRequests, 'number');
  assert.strictEqual(stats.cacheSize, 0);
  assert.strictEqual(stats.queueLength, 0);
  assert.strictEqual(stats.activeRequests, 0);
});

test('BatchOptimizer - getCacheStats with cache disabled', () => {
  const optimizer = new BatchOptimizer({ cacheEnabled: false });
  
  const stats = optimizer.getCacheStats();
  
  assert.ok(stats);
  assert.strictEqual(stats.cacheSize, 0);
});

// CRITICAL ISSUE TESTS (2025-01)

test('BatchOptimizer - cache key truncation causes collisions', () => {
  // CRITICAL ISSUE: Cache key uses string concatenation with truncation
  // Different prompts/states with same prefix = same cache key = wrong cache hit
  // 
  // The problem:
  // - Prompt truncated to 100 chars, context to 50 chars
  // - Different prompts with same first 100 chars = same cache key
  // - This causes wrong cache hits
  
  const optimizer = new BatchOptimizer({ cacheEnabled: true });
  
  // Create two prompts that differ after 100 chars
  const longPrompt1 = 'a'.repeat(100) + 'DIFFERENT_SUFFIX_1';
  const longPrompt2 = 'a'.repeat(100) + 'DIFFERENT_SUFFIX_2';
  
  const key1 = optimizer._getCacheKey('test.png', longPrompt1, {});
  const key2 = optimizer._getCacheKey('test.png', longPrompt2, {});
  
  // CRITICAL: Keys should be the same (collision!) because truncation removes the difference
  // This is the documented bug - truncation causes collisions
  assert.strictEqual(key1, key2,
    'Cache key truncation causes collisions (known issue - prompts >100 chars with same prefix)');
  
  // Same prompt should produce same key (this is correct)
  const key1Again = optimizer._getCacheKey('test.png', longPrompt1, {});
  assert.strictEqual(key1, key1Again, 'Same prompt should produce same key');
});

test('BatchOptimizer - cache grows unbounded', () => {
  // CRITICAL ISSUE: No size limits or eviction
  // Cache grows unbounded in long-running processes
  // 
  // The problem:
  // - No MAX_CACHE_SIZE limit
  // - No LRU eviction
  // - No TTL expiration
  // - Memory leak in long-running processes
  
  const optimizer = new BatchOptimizer({ cacheEnabled: true });
  
  // Add many entries to cache
  for (let i = 0; i < 1000; i++) {
    optimizer.cache.set(`test-key-${i}`, { score: i });
  }
  
  // CRITICAL: Cache should have 1000 entries (no eviction)
  // This is the documented issue - cache grows unbounded
  assert.strictEqual(optimizer.cache.size, 1000,
    'Cache grows unbounded (no size limits or eviction)');
  
  // Add more entries
  for (let i = 1000; i < 2000; i++) {
    optimizer.cache.set(`test-key-${i}`, { score: i });
  }
  
  // Cache should have 2000 entries (still no eviction)
  assert.strictEqual(optimizer.cache.size, 2000,
    'Cache continues to grow unbounded (no eviction)');
});

// EDGE CASE TESTS

test('BatchOptimizer - handles empty/null inputs', () => {
  // Edge case: Empty or null inputs
  const optimizer = new BatchOptimizer({ cacheEnabled: true });
  
  const key1 = optimizer._getCacheKey('', '', {});
  const key2 = optimizer._getCacheKey(null, null, null);
  const key3 = optimizer._getCacheKey(undefined, undefined, undefined);
  
  // Should generate valid keys (even if empty)
  assert.ok(typeof key1 === 'string' && key1.length > 0);
  assert.ok(typeof key2 === 'string' && key2.length > 0);
  assert.ok(typeof key3 === 'string' && key3.length > 0);
});

test('BatchOptimizer - handles very large cache (performance)', () => {
  // Edge case: Performance test with many cache entries
  const optimizer = new BatchOptimizer({ cacheEnabled: true });
  
  const startTime = Date.now();
  
  // Add many entries
  for (let i = 0; i < 10000; i++) {
    optimizer.cache.set(`test-key-${i}`, { score: i, data: 'x'.repeat(100) });
  }
  
  const duration = Date.now() - startTime;
  
  assert.strictEqual(optimizer.cache.size, 10000, 'Should handle many entries');
  // Performance check: should complete in reasonable time (<1s for 10000 entries)
  assert.ok(duration < 1000, `Should complete quickly (${duration}ms for 10000 entries)`);
  
  // Access should still be fast
  const accessStart = Date.now();
  const value = optimizer.cache.get('test-key-5000');
  const accessDuration = Date.now() - accessStart;
  
  assert.ok(value, 'Should retrieve entries quickly');
  assert.ok(accessDuration < 10, `Access should be fast (${accessDuration}ms)`);
});

test('BatchOptimizer - getCacheStats with many entries', () => {
  // Edge case: Cache stats with many entries
  const optimizer = new BatchOptimizer({ cacheEnabled: true });
  
  // Add many entries
  for (let i = 0; i < 5000; i++) {
    optimizer.cache.set(`test-key-${i}`, { score: i });
  }
  
  const stats = optimizer.getCacheStats();
  
  assert.strictEqual(stats.cacheSize, 5000, 'Should report correct cache size');
  assert.strictEqual(typeof stats.queueLength, 'number');
  assert.strictEqual(typeof stats.activeRequests, 'number');
});

