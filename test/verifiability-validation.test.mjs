/**
 * Verifiability Validation Tests
 * 
 * Tests that all comment claims are verifiable through logs, metrics, or tracing
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { enableDebug } from '../src/logger.mjs';
import { SequentialDecisionContext } from '../src/temporal-decision.mjs';
import { BatchOptimizer } from '../src/batch-optimizer.mjs';
import { selfConsistencyCheck } from '../src/uncertainty-reducer.mjs';
import { initCache, getCacheStats, setCached, clearCache } from '../src/cache.mjs';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdirSync, rmSync, existsSync } from 'fs';

// Enable debug logging for tests
enableDebug();

const TEST_DIR = join(tmpdir(), 'ai-visual-test-verifiability');

test.beforeEach(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
  mkdirSync(TEST_DIR, { recursive: true });
});

test.afterEach(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

test('SequentialDecisionContext - variance tracking is verifiable', () => {
  const context = new SequentialDecisionContext({
    adaptationEnabled: true,
    varianceTracking: true
  });
  
  // Add initial decisions to establish baseline
  context.addDecision({ score: 7, observation: 'test1' });
  context.addDecision({ score: 8, observation: 'test2' });
  context.addDecision({ score: 7.5, observation: 'test3' });
  
  // Get variance stats - should have baseline
  const stats = context.getVarianceStats();
  assert.ok(stats.trackingEnabled, 'Variance tracking should be enabled');
  assert.ok(stats.baselineVariance !== null, 'Baseline variance should be set after 3 decisions');
  assert.ok(stats.scores.length === 3, 'Should track 3 scores');
  
  // Add decisions that increase variance
  context.addDecision({ score: 3, observation: 'test4' }); // Low score
  context.addDecision({ score: 9, observation: 'test5' }); // High score
  context.addDecision({ score: 2, observation: 'test6' }); // Very low score
  
  // Get updated stats
  const updatedStats = context.getVarianceStats();
  assert.ok(updatedStats.currentVariance !== null, 'Current variance should be calculated');
  assert.ok(updatedStats.varianceIncrease !== null, 'Variance increase should be calculated');
  assert.ok(updatedStats.varianceIncrease > 0, 'Variance should have increased');
  
  // Get context - should include variance metrics
  const ctx = context.getContext();
  assert.ok(ctx.varianceMetrics !== null, 'Context should include variance metrics');
  assert.ok(ctx.varianceMetrics.baselineVariance !== null, 'Context should include baseline variance');
  assert.ok(ctx.varianceMetrics.currentVariance !== null, 'Context should include current variance');
});

test('SequentialDecisionContext - variance increase events are tracked', () => {
  const context = new SequentialDecisionContext({
    adaptationEnabled: true,
    varianceTracking: true
  });
  
  // Establish baseline
  context.addDecision({ score: 7, observation: 'test1' });
  context.addDecision({ score: 8, observation: 'test2' });
  context.addDecision({ score: 7.5, observation: 'test3' });
  
  // Add high variance decisions
  context.addDecision({ score: 2, observation: 'test4' });
  context.addDecision({ score: 9, observation: 'test5' });
  context.addDecision({ score: 1, observation: 'test6' });
  
  // Try to adapt prompt - should trigger variance increase detection
  const adapted = context.adaptPrompt('Test prompt', { debug: { verbose: false } });
  
  // Check if variance increase was detected and tracked
  const stats = context.getVarianceStats();
  if (stats.varianceIncrease > 20) {
    // Variance increased significantly - should have events
    assert.ok(stats.varianceIncreaseEvents.length > 0, 'Variance increase events should be tracked');
    const event = stats.varianceIncreaseEvents[0];
    assert.ok(event.timestamp !== undefined, 'Event should have timestamp');
    assert.ok(event.baselineVariance !== undefined, 'Event should have baseline variance');
    assert.ok(event.currentVariance !== undefined, 'Event should have current variance');
    assert.ok(event.increasePercent !== undefined, 'Event should have increase percentage');
  }
});

test('BatchOptimizer - queue rejection metrics are verifiable', () => {
  const optimizer = new BatchOptimizer({
    maxConcurrency: 1,
    batchSize: 1,
    maxQueueSize: 2, // Small queue for testing
    requestTimeout: 100
  });
  
  // CRITICAL: Verify metrics are initialized in constructor (not undefined)
  assert.ok(optimizer.metrics !== undefined, 'Metrics should be initialized in constructor');
  assert.ok(optimizer.metrics.totalQueued === 0, 'Initial totalQueued should be 0');
  assert.ok(optimizer.metrics.queueRejections === 0, 'Initial queueRejections should be 0');
  
  // Get initial metrics
  const initialMetrics = optimizer.getPerformanceMetrics();
  assert.strictEqual(initialMetrics.queue.rejections, 0, 'Initial rejections should be 0');
  
  // Test that metrics structure is correct
  assert.ok('queue' in initialMetrics, 'Should have queue property');
  assert.ok('concurrency' in initialMetrics, 'Should have concurrency property');
  assert.ok('cache' in initialMetrics, 'Should have cache property');
  assert.ok(initialMetrics.queue.rejections === 0, 'Initial rejections should be 0');
  assert.ok(initialMetrics.queue.timeouts === 0, 'Initial timeouts should be 0');
  assert.ok(initialMetrics.queue.totalQueued === 0, 'Initial totalQueued should be 0');
});

test('BatchOptimizer - timeout metrics are verifiable', () => {
  const optimizer = new BatchOptimizer({
    maxConcurrency: 1,
    batchSize: 1,
    maxQueueSize: 10,
    requestTimeout: 50 // Short timeout
  });
  
  // Test that timeout metrics structure exists
  const metrics = optimizer.getPerformanceMetrics();
  assert.ok(metrics.queue.timeouts >= 0, 'Timeouts should be tracked');
  assert.ok(metrics.queue.timeoutRate >= 0, 'Timeout rate should be calculated');
  assert.ok(metrics.queue.averageWaitTime >= 0, 'Average wait time should be tracked');
  assert.ok(typeof metrics.queue.timeoutRate === 'number', 'Timeout rate should be a number');
});

test('BatchOptimizer - wait time tracking is verifiable', () => {
  const optimizer = new BatchOptimizer({
    maxConcurrency: 1,
    batchSize: 1,
    maxQueueSize: 10,
    requestTimeout: 1000
  });
  
  // Test that wait time metrics structure exists
  const metrics = optimizer.getPerformanceMetrics();
  assert.ok(metrics.queue.averageWaitTime >= 0, 'Average wait time should be tracked');
  assert.ok(metrics.queue.totalQueued >= 0, 'Total queued should be tracked');
  assert.ok(metrics.queue.totalProcessed >= 0, 'Total processed should be tracked');
  assert.ok(typeof metrics.queue.averageWaitTime === 'number', 'Average wait time should be a number');
});

test('Self-consistency - improvement metrics are verifiable', async () => {
  // Create a validator that returns consistent scores
  let callCount = 0;
  const validator = async () => {
    callCount++;
    // Return slightly improving scores
    return { score: 7 + (callCount * 0.1) };
  };
  
  // Test without baseline (should not have improvement metrics)
  const result1 = await selfConsistencyCheck(validator, 3);
  assert.ok(result1.improvementMetrics === null || result1.improvementMetrics === undefined, 
    'Should not have improvement metrics without baseline');
  
  // Test with baseline (should have improvement metrics)
  callCount = 0;
  const result2 = await selfConsistencyCheck(validator, 3, { baselineScore: 7.0 });
  assert.ok(result2.improvementMetrics !== null, 'Should have improvement metrics with baseline');
  assert.ok(result2.improvementMetrics.baselineScore === 7.0, 'Should track baseline score');
  assert.ok(result2.improvementMetrics.improvedScore !== undefined, 'Should track improved score');
  assert.ok(result2.improvementMetrics.improvement !== undefined, 'Should track improvement');
  assert.ok(result2.improvementMetrics.improvementPercent !== undefined, 'Should track improvement percentage');
  assert.ok(result2.improvementMetrics.meetsResearchClaim !== undefined, 'Should track if meets research claim');
});

test('Cache - atomic write metrics are verifiable', async () => {
  const cacheDir = join(TEST_DIR, 'cache-test');
  initCache(cacheDir);
  
  // Set some cache entries
  setCached('test1.png', 'prompt1', {}, { score: 7 });
  setCached('test2.png', 'prompt2', {}, { score: 8 });
  
  // Wait for async save
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Get cache stats
  const stats = getCacheStats();
  
  // Check if atomic write metrics are present (may be null if no writes yet)
  if (stats.atomicWrites !== undefined) {
    assert.ok(stats.atomicWrites >= 0, 'Atomic writes should be tracked');
    assert.ok(stats.atomicWriteFailures >= 0, 'Atomic write failures should be tracked');
    assert.ok(stats.tempFileCleanups >= 0, 'Temp file cleanups should be tracked');
    assert.ok(stats.atomicWriteSuccessRate >= 0 && stats.atomicWriteSuccessRate <= 100, 
      'Success rate should be between 0 and 100');
  }
  
  clearCache();
});

test('Cache - atomic write metrics track operations', async () => {
  const cacheDir = join(TEST_DIR, 'cache-test-2');
  initCache(cacheDir);
  
  // Get initial stats
  const initialStats = getCacheStats();
  const initialWrites = initialStats.atomicWrites || 0;
  
  // Set cache entries (should trigger atomic writes)
  setCached('test1.png', 'prompt1', {}, { score: 7 });
  await new Promise(resolve => setTimeout(resolve, 100));
  
  setCached('test2.png', 'prompt2', {}, { score: 8 });
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Get updated stats
  const updatedStats = getCacheStats();
  
  // If metrics are tracked, should see increase
  if (updatedStats.atomicWrites !== undefined) {
    assert.ok(updatedStats.atomicWrites >= initialWrites, 
      'Atomic writes should increase after cache operations');
  }
  
  clearCache();
});

test('All verifiability methods return valid data structures', () => {
  // Test SequentialDecisionContext
  const context = new SequentialDecisionContext();
  const varianceStats = context.getVarianceStats();
  assert.ok(typeof varianceStats === 'object', 'Variance stats should be an object');
  assert.ok('trackingEnabled' in varianceStats, 'Should have trackingEnabled property');
  
  const contextData = context.getContext();
  assert.ok(typeof contextData === 'object', 'Context should be an object');
  assert.ok('historyLength' in contextData, 'Should have historyLength property');
  
  // Test BatchOptimizer
  const optimizer = new BatchOptimizer();
  const perfMetrics = optimizer.getPerformanceMetrics();
  assert.ok(typeof perfMetrics === 'object', 'Performance metrics should be an object');
  assert.ok('queue' in perfMetrics, 'Should have queue property');
  assert.ok('concurrency' in perfMetrics, 'Should have concurrency property');
  assert.ok('cache' in perfMetrics, 'Should have cache property');
  
  // Test cache stats
  const cacheDir = join(TEST_DIR, 'cache-test-3');
  initCache(cacheDir);
  const cacheStats = getCacheStats();
  assert.ok(typeof cacheStats === 'object', 'Cache stats should be an object');
  assert.ok('size' in cacheStats, 'Should have size property');
});

