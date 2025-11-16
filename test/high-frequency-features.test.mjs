/**
 * Tests for high-frequency features (60Hz real-time validation)
 * 
 * Tests:
 * - LatencyAwareBatchOptimizer - Bypasses batching for <100ms requests
 * - selectModelTier() - Auto-selects fast tier for high-frequency
 * - selectProvider() - Auto-selects Groq for ultra-fast/cost-sensitive
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { LatencyAwareBatchOptimizer } from '../src/latency-aware-batch-optimizer.mjs';
import { selectModelTier, selectProvider } from '../src/model-tier-selector.mjs';

test('LatencyAwareBatchOptimizer should bypass batching for <100ms requests', async () => {
  const optimizer = new LatencyAwareBatchOptimizer({
    maxConcurrency: 1,
    batchSize: 5,
    cacheEnabled: false
  });

  // Mock the _processRequest method to track if it's called directly
  let directProcessCalled = false;
  const originalProcess = optimizer._processRequest.bind(optimizer);
  optimizer._processRequest = async (imagePath, prompt, context, validateFn) => {
    directProcessCalled = true;
    // Return a mock result
    return {
      score: 8,
      issues: [],
      reasoning: 'Mock result',
      critical: context.critical || false
    };
  };

  // Request with <100ms latency requirement should bypass batching
  const result = await optimizer.addRequest(
    'test.png',
    'Test prompt',
    {},
    50 // 50ms requirement - should bypass batching
  );

  assert.ok(directProcessCalled, 'Should call _processRequest directly for <100ms requests');
  assert.ok(result.critical, 'Should mark as critical');
  assert.strictEqual(result.score, 8, 'Should return mock result');
  
  // Restore original method
  optimizer._processRequest = originalProcess;
});

test('LatencyAwareBatchOptimizer should use adaptive batch size for 100-200ms requests', async () => {
  const optimizer = new LatencyAwareBatchOptimizer({
    maxConcurrency: 1,
    batchSize: 5,
    cacheEnabled: false,
    adaptiveBatchSize: true
  });

  // Track batch size changes
  const originalBatchSize = optimizer.batchSize;
  let batchSizeChanged = false;

  // Mock _queueRequest to check batch size
  const originalQueue = optimizer._queueRequest.bind(optimizer);
  optimizer._queueRequest = async (imagePath, prompt, context, validateFn) => {
    if (optimizer.batchSize === 1) {
      batchSizeChanged = true;
    }
    // Return a resolved promise with mock result
    return Promise.resolve({
      score: 8,
      issues: [],
      reasoning: 'Mock result'
    });
  };

  // Request with 150ms latency requirement should use batch size 1
  await optimizer.addRequest(
    'test.png',
    'Test prompt',
    {},
    150 // 150ms requirement - should use adaptive batch size
  );

  assert.ok(batchSizeChanged, 'Should change batch size to 1 for 100-200ms requests');
  assert.strictEqual(optimizer.batchSize, originalBatchSize, 'Should restore original batch size');
  
  // Restore original method
  optimizer._queueRequest = originalQueue;
});

test('selectModelTier should return "fast" for high-frequency decisions', () => {
  // High frequency (60Hz)
  const tier1 = selectModelTier({ frequency: 60 });
  assert.strictEqual(tier1, 'fast', 'Should select fast tier for 60Hz');

  // High frequency string
  const tier2 = selectModelTier({ frequency: 'high' });
  assert.strictEqual(tier2, 'fast', 'Should select fast tier for high frequency');

  // High frequency with temporal notes (10+ notes per second = high frequency)
  const now = Date.now();
  const tier3 = selectModelTier({
    temporalNotes: [
      { timestamp: now - 100 }, // 100ms ago
      { timestamp: now - 90 },  // 90ms ago
      { timestamp: now - 80 },  // 80ms ago
      { timestamp: now - 70 },  // 70ms ago
      { timestamp: now - 60 },  // 60ms ago
      { timestamp: now - 50 },  // 50ms ago
      { timestamp: now - 40 },  // 40ms ago
      { timestamp: now - 30 },  // 30ms ago
      { timestamp: now - 20 },  // 20ms ago
      { timestamp: now - 10 },  // 10ms ago
      { timestamp: now }        // now
    ]
  });
  assert.strictEqual(tier3, 'fast', 'Should detect high frequency from temporal notes (>10 notes/second)');
});

test('selectModelTier should return "best" for critical evaluations', () => {
  const tier1 = selectModelTier({ criticality: 'critical' });
  assert.strictEqual(tier1, 'best', 'Should select best tier for critical evaluations');

  const tier2 = selectModelTier({ testType: 'accessibility-critical' });
  assert.strictEqual(tier2, 'best', 'Should select best tier for critical test types');
});

test('selectModelTier should return "fast" for cost-sensitive operations', () => {
  const tier = selectModelTier({ costSensitive: true });
  assert.strictEqual(tier, 'fast', 'Should select fast tier for cost-sensitive operations');
});

test('selectModelTier should return "balanced" by default', () => {
  const tier = selectModelTier({});
  assert.strictEqual(tier, 'balanced', 'Should return balanced tier by default');
});

test('selectProvider should return "groq" for ultra-fast text-only requests', () => {
  const provider = selectProvider({
    speed: 'ultra-fast',
    vision: false,
    env: { GROQ_API_KEY: 'test-key' }
  });
  assert.strictEqual(provider, 'groq', 'Should select Groq for ultra-fast text-only');
});

test('selectProvider should return "gemini" for large context', () => {
  const provider = selectProvider({
    contextSize: 300000,
    env: { GEMINI_API_KEY: 'test-key' }
  });
  assert.strictEqual(provider, 'gemini', 'Should select Gemini for large context');
});

test('selectProvider should return "gemini" for best quality', () => {
  const provider = selectProvider({
    quality: 'best',
    env: { GEMINI_API_KEY: 'test-key' }
  });
  assert.strictEqual(provider, 'gemini', 'Should select Gemini for best quality');
});

test('selectProvider should return "groq" for cost-sensitive text-only', () => {
  const provider = selectProvider({
    costSensitive: true,
    vision: false,
    env: { GROQ_API_KEY: 'test-key' }
  });
  assert.strictEqual(provider, 'groq', 'Should select Groq for cost-sensitive text-only');
});

test('selectProvider should auto-detect from available API keys', () => {
  // Test with Groq available
  const provider1 = selectProvider({
    vision: true,
    env: { GROQ_API_KEY: 'test-key' }
  });
  assert.strictEqual(provider1, 'groq', 'Should select Groq when available');

  // Test with only Gemini available
  const provider2 = selectProvider({
    vision: true,
    env: { GEMINI_API_KEY: 'test-key' }
  });
  assert.strictEqual(provider2, 'gemini', 'Should select Gemini when Groq not available');
});

test('selectProvider should fallback to gemini if no keys available', () => {
  const provider = selectProvider({
    env: {}
  });
  assert.strictEqual(provider, 'gemini', 'Should fallback to gemini');
});

