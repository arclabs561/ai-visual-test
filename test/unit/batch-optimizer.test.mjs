import { test } from 'node:test';
import assert from 'node:assert';
import { BatchOptimizer } from '../../src/batch-optimizer.js';
import { LatencyAwareBatchOptimizer } from '../../src/latency-aware-batch-optimizer.js';

// -- BatchOptimizer --

test('BatchOptimizer: constructor sets correct defaults', () => {
  const opt = new BatchOptimizer();
  assert.strictEqual(opt.maxConcurrency, 5);
  assert.strictEqual(opt.batchSize, 3);
  assert.strictEqual(opt.maxQueueSize, 1000);
  assert.strictEqual(opt.requestTimeout, 30000);
  assert.ok(opt.cache instanceof Map, 'cache should be a Map when enabled by default');
  assert.strictEqual(opt.activeRequests, 0);
  assert.deepStrictEqual(opt.queue, []);
});

test('BatchOptimizer: constructor respects custom options', () => {
  const opt = new BatchOptimizer({
    maxConcurrency: 10,
    batchSize: 5,
    cacheEnabled: false,
    maxQueueSize: 50,
    requestTimeout: 5000
  });
  assert.strictEqual(opt.maxConcurrency, 10);
  assert.strictEqual(opt.batchSize, 5);
  assert.strictEqual(opt.cache, null, 'cache should be null when disabled');
  assert.strictEqual(opt.maxQueueSize, 50);
  assert.strictEqual(opt.requestTimeout, 5000);
});

test('BatchOptimizer: getCacheStats returns zeros initially', () => {
  const opt = new BatchOptimizer();
  const stats = opt.getCacheStats();
  assert.deepStrictEqual(stats, {
    cacheSize: 0,
    queueLength: 0,
    activeRequests: 0
  });
});

test('BatchOptimizer: getCacheStats with cache disabled', () => {
  const opt = new BatchOptimizer({ cacheEnabled: false });
  const stats = opt.getCacheStats();
  assert.strictEqual(stats.cacheSize, 0, 'cacheSize should be 0 when cache is disabled');
});

test('BatchOptimizer: getPerformanceMetrics initial state', () => {
  const opt = new BatchOptimizer();
  const metrics = opt.getPerformanceMetrics();

  assert.strictEqual(metrics.queue.currentLength, 0);
  assert.strictEqual(metrics.queue.maxSize, 1000);
  assert.strictEqual(metrics.queue.rejections, 0);
  assert.strictEqual(metrics.queue.totalQueued, 0);
  assert.strictEqual(metrics.queue.totalProcessed, 0);
  assert.strictEqual(metrics.queue.averageWaitTime, 0);
  assert.strictEqual(metrics.queue.timeouts, 0);
  assert.strictEqual(metrics.queue.timeoutRate, 0);
  assert.strictEqual(metrics.queue.rejectionRate, 0);

  assert.strictEqual(metrics.concurrency.active, 0);
  assert.strictEqual(metrics.concurrency.max, 5);
  assert.strictEqual(metrics.concurrency.utilization, 0);

  assert.strictEqual(metrics.cache.cacheSize, 0);
});

test('BatchOptimizer: _getCacheKey is deterministic', () => {
  const opt = new BatchOptimizer();
  const key1 = opt._getCacheKey('/img/a.png', 'check layout', { page: 'home' });
  const key2 = opt._getCacheKey('/img/a.png', 'check layout', { page: 'home' });
  assert.strictEqual(key1, key2);
  // SHA-256 hex is 64 chars
  assert.strictEqual(key1.length, 64);
});

test('BatchOptimizer: _getCacheKey produces different keys for different inputs', () => {
  const opt = new BatchOptimizer();
  const keyA = opt._getCacheKey('/img/a.png', 'prompt A', {});
  const keyB = opt._getCacheKey('/img/b.png', 'prompt A', {});
  const keyC = opt._getCacheKey('/img/a.png', 'prompt B', {});
  const keyD = opt._getCacheKey('/img/a.png', 'prompt A', { extra: true });

  const keys = new Set([keyA, keyB, keyC, keyD]);
  assert.strictEqual(keys.size, 4, 'all four keys should be distinct');
});

test('BatchOptimizer: _getCacheKey handles null/undefined context', () => {
  const opt = new BatchOptimizer();
  const key1 = opt._getCacheKey('/img/a.png', 'prompt', null);
  const key2 = opt._getCacheKey('/img/a.png', 'prompt', undefined);
  assert.strictEqual(key1, key2, 'null and undefined context should produce the same key');
  assert.strictEqual(key1.length, 64);
});

test('BatchOptimizer: clearCache resets cache size to 0', () => {
  const opt = new BatchOptimizer();
  // Manually insert an entry into the cache
  const key = opt._getCacheKey('/img/a.png', 'prompt', {});
  opt.cache.set(key, { score: 8 });
  assert.strictEqual(opt.getCacheStats().cacheSize, 1);

  opt.clearCache();
  assert.strictEqual(opt.getCacheStats().cacheSize, 0);
});

test('BatchOptimizer: clearCache is safe when cache is disabled', () => {
  const opt = new BatchOptimizer({ cacheEnabled: false });
  // Should not throw
  opt.clearCache();
  assert.strictEqual(opt.getCacheStats().cacheSize, 0);
});

// -- LatencyAwareBatchOptimizer --

test('LatencyAwareBatchOptimizer: constructor defaults', () => {
  const opt = new LatencyAwareBatchOptimizer();
  assert.strictEqual(opt.defaultMaxLatency, 1000);
  assert.strictEqual(opt.adaptiveBatchSize, true);
  assert.ok(opt.criticalRequests instanceof Set);
  assert.strictEqual(opt.criticalRequests.size, 0);
  // Inherited defaults
  assert.strictEqual(opt.maxConcurrency, 5);
  assert.strictEqual(opt.batchSize, 3);
});

test('LatencyAwareBatchOptimizer: constructor with custom options', () => {
  const opt = new LatencyAwareBatchOptimizer({
    defaultMaxLatency: 500,
    adaptiveBatchSize: false,
    maxConcurrency: 2
  });
  assert.strictEqual(opt.defaultMaxLatency, 500);
  assert.strictEqual(opt.adaptiveBatchSize, false);
  assert.strictEqual(opt.maxConcurrency, 2);
});

test('LatencyAwareBatchOptimizer: getLatencyStats initial state', () => {
  const opt = new LatencyAwareBatchOptimizer();
  const stats = opt.getLatencyStats();
  assert.strictEqual(stats.cacheSize, 0);
  assert.strictEqual(stats.queueLength, 0);
  assert.strictEqual(stats.activeRequests, 0);
  assert.strictEqual(stats.criticalRequests, 0);
  assert.ok(Array.isArray(stats.queueLatencyRequirements));
  assert.strictEqual(stats.queueLatencyRequirements.length, 0);
});

test('LatencyAwareBatchOptimizer: _calculateAdaptiveBatchSize by latency tier', () => {
  const opt = new LatencyAwareBatchOptimizer({ batchSize: 5 });

  // Empty queue -> default batch size
  assert.strictEqual(opt._calculateAdaptiveBatchSize([]), 5);

  // <100ms -> 1 (no batching)
  assert.strictEqual(
    opt._calculateAdaptiveBatchSize([{ context: { maxLatency: 50 } }]),
    1
  );

  // <200ms -> 2 (small batches)
  assert.strictEqual(
    opt._calculateAdaptiveBatchSize([{ context: { maxLatency: 150 } }]),
    2
  );

  // >=200ms -> default batch size
  assert.strictEqual(
    opt._calculateAdaptiveBatchSize([{ context: { maxLatency: 500 } }]),
    5
  );

  // No context -> uses defaultMaxLatency (1000ms) -> default batch size
  assert.strictEqual(
    opt._calculateAdaptiveBatchSize([{ context: {} }]),
    5
  );
  assert.strictEqual(
    opt._calculateAdaptiveBatchSize([{}]),
    5
  );
});

// -- Regressions: concurrency limit and cache key --

function trackPeak(opt) {
  let active = opt.activeRequests;
  let peak = 0;
  Object.defineProperty(opt, 'activeRequests', {
    get: () => active,
    set: (value) => { active = value; peak = Math.max(peak, value); },
    configurable: true,
  });
  return () => peak;
}

const tick = (ms = 5) => new Promise(resolve => setTimeout(resolve, ms));

test('BatchOptimizer: batchValidate without validateFn respects maxConcurrency', async () => {
  // No validateFn: _processRequest imports the judge first. The slot has to
  // be taken before that await, or all ten requests are admitted at once.
  const opt = new BatchOptimizer({ maxConcurrency: 2, batchSize: 1, cacheEnabled: false });
  const peak = trackPeak(opt);
  const paths = Array.from({ length: 10 }, (_, i) => `/nonexistent/batch-${i}.png`);
  await Promise.allSettled([opt.batchValidate(paths, 'prompt', {})]);
  assert.ok(peak() >= 1, 'requests should have run');
  assert.ok(peak() <= 2, `peak concurrency ${peak()} exceeds maxConcurrency 2`);
  assert.strictEqual(opt.activeRequests, 0);
});

test('BatchOptimizer: a queued batch does not exceed maxConcurrency', async () => {
  const opt = new BatchOptimizer({ maxConcurrency: 2, batchSize: 3, cacheEnabled: false });
  let running = 0;
  let peak = 0;
  const validateFn = async () => {
    running++;
    peak = Math.max(peak, running);
    await tick();
    running--;
    return { score: 1 };
  };
  const results = await Promise.all(
    Array.from({ length: 12 }, (_, i) => opt._queueRequest(`/img/${i}.png`, 'p', {}, validateFn))
  );
  assert.strictEqual(results.length, 12);
  assert.ok(peak <= 2, `peak concurrency ${peak} exceeds maxConcurrency 2`);
  assert.strictEqual(opt.activeRequests, 0);
  assert.strictEqual(opt.queue.length, 0);
});

test('BatchOptimizer: _getCacheKey distinguishes nested context fields', () => {
  const opt = new BatchOptimizer();
  const narrow = opt._getCacheKey('/img/a.png', 'p', { viewport: { width: 100 } });
  const wide = opt._getCacheKey('/img/a.png', 'p', { viewport: { width: 2000 } });
  assert.notStrictEqual(narrow, wide);

  const stateA = opt._getCacheKey('/img/a.png', 'p', { gameState: { level: 1, items: [{ id: 'x' }] } });
  const stateB = opt._getCacheKey('/img/a.png', 'p', { gameState: { level: 1, items: [{ id: 'y' }] } });
  assert.notStrictEqual(stateA, stateB);
});

test('BatchOptimizer: _getCacheKey ignores key order at every depth', () => {
  const opt = new BatchOptimizer();
  const a = opt._getCacheKey('/img/a.png', 'p', { b: 1, viewport: { width: 1, height: 2 } });
  const b = opt._getCacheKey('/img/a.png', 'p', { viewport: { height: 2, width: 1 }, b: 1 });
  assert.strictEqual(a, b);
});

test('BatchOptimizer: _getCacheKey changes when the image file is rewritten', async () => {
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'batch-key-'));
  try {
    const file = join(dir, 'shot.png');
    const opt = new BatchOptimizer();
    writeFileSync(file, 'first');
    const before = opt._getCacheKey(file, 'p', {});
    writeFileSync(file, 'second, longer');
    const after = opt._getCacheKey(file, 'p', {});
    assert.notStrictEqual(before, after);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
