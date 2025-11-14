/**
 * Tests for BatchOptimizer queue size limits and timeouts
 * 
 * Property-based and behavior-driven tests for queue management
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { BatchOptimizer } from '../src/batch-optimizer.mjs';
import { TimeoutError } from '../src/errors.mjs';
import { BATCH_OPTIMIZER_CONSTANTS } from '../src/constants.mjs';

test('BatchOptimizer - rejects requests when queue is full', async () => {
  // Create optimizer with small queue size for testing
  const optimizer = new BatchOptimizer({
    maxConcurrency: 1,
    maxQueueSize: 5,
    requestTimeout: 1000
  });
  
  // Fill up the queue
  // With maxConcurrency=1, first request processes immediately (not in queue)
  // So we need: 1 processing + 5 queued = 6 requests total to fill queue
  const promises = [];
  for (let i = 0; i < 6; i++) {
    promises.push(
      optimizer._queueRequest(`test${i}.png`, 'prompt', {}, async () => {
        // Simulate slow request that blocks processing
        await new Promise(resolve => setTimeout(resolve, 2000));
        return { score: i };
      }).catch(() => {
        // Expected to timeout or fail
      })
    );
  }
  
  // Wait a bit to ensure queue fills up
  await new Promise(resolve => setTimeout(resolve, 50));
  
  // Verify queue is full (should have 5 items, with 1 processing)
  assert.strictEqual(optimizer.queue.length, 5, 'Queue should be full (5 items)');
  assert.strictEqual(optimizer.activeRequests, 1, 'One request should be processing');
  
  // This should be rejected (queue full)
  await assert.rejects(
    async () => {
      await optimizer._queueRequest('test7.png', 'prompt', {}, async () => ({ score: 7 }));
    },
    TimeoutError,
    'Should reject when queue is full'
  );
  
  // Clean up: wait for all requests to complete or timeout
  await Promise.allSettled(promises);
});

test('BatchOptimizer - times out queued requests', async () => {
  const optimizer = new BatchOptimizer({
    maxConcurrency: 1,
    maxQueueSize: 10,
    requestTimeout: 100 // Short timeout for testing
  });
  
  // CRITICAL FIX: Ensure first request actually blocks by processing it immediately
  // and making it slow enough that the second request will queue and timeout
  let firstRequestStarted = false;
  let firstRequestResolved = false;
  const blockingPromise = optimizer._queueRequest('blocking.png', 'prompt', {}, async () => {
    firstRequestStarted = true;
    // Make this slow enough that second request will timeout in queue
    // Timeout is 100ms, so we need to block for at least 200ms to ensure timeout fires
    await new Promise(resolve => setTimeout(resolve, 300));
    firstRequestResolved = true;
    return { score: 0 };
  });
  
  // Wait for first request to actually start processing (activeRequests should be 1)
  let waitCount = 0;
  while (!firstRequestStarted && optimizer.activeRequests === 0 && waitCount < 50) {
    await new Promise(resolve => setTimeout(resolve, 10));
    waitCount++;
  }
  
  // Verify first request is actually blocking
  assert.ok(optimizer.activeRequests === 1 || firstRequestStarted, 
    'First request should be processing (activeRequests=1)');
  
  // Small delay to ensure first request is definitely processing and won't complete soon
  await new Promise(resolve => setTimeout(resolve, 20));
  
  // Verify first request is still processing (hasn't completed yet)
  assert.ok(!firstRequestResolved, 'First request should still be processing');
  assert.ok(optimizer.activeRequests === 1, 'First request should still be active');
  assert.strictEqual(optimizer.queue.length, 0, 'Queue should be empty (first request is processing, not queued)');
  
  // This should timeout while waiting in queue (first request is still processing)
  // The timeout is 100ms, and first request takes 300ms, so this should definitely timeout
  // CRITICAL: Don't await immediately - let the timeout fire
  const timeoutPromise = optimizer._queueRequest('queued.png', 'prompt', {}, async () => ({ score: 1 }));
  
  // Verify the request was queued (not processed immediately)
  // Small delay to let it queue and ensure it's not processed
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.strictEqual(optimizer.queue.length, 1, 'Second request should be queued');
  assert.strictEqual(optimizer.activeRequests, 1, 'Still only one active request');
  assert.ok(!firstRequestResolved, 'First request should still be processing');
  
  // Wait for timeout to fire (100ms + small buffer)
  // The timeout should fire before the first request completes (300ms)
  // Use assert.rejects which properly handles async rejections
  await assert.rejects(
    async () => {
      // Wait a bit to ensure request is queued
      await new Promise(resolve => setTimeout(resolve, 5));
      // Verify it's still queued
      if (optimizer.queue.length === 0) {
        throw new Error('Request was processed immediately, not queued');
      }
      // Now wait for the timeout (should fire after 100ms)
      return await timeoutPromise;
    },
    TimeoutError,
    'Should timeout when request waits too long in queue'
  );
  
  // Clean up: wait for blocking request to complete
  await blockingPromise.catch(() => {
    // Expected - might timeout or complete
  });
});

test('BatchOptimizer - queue size limit prevents memory leaks', () => {
  const optimizer = new BatchOptimizer({
    maxConcurrency: 1,
    maxQueueSize: 10
  });
  
  // Verify default queue size
  assert.strictEqual(optimizer.maxQueueSize, 10);
  
  // Verify queue starts empty
  assert.strictEqual(optimizer.queue.length, 0);
  
  // Verify queue size is bounded
  assert.ok(optimizer.maxQueueSize <= BATCH_OPTIMIZER_CONSTANTS.MAX_QUEUE_SIZE);
});

test('BatchOptimizer - request timeout is configurable', () => {
  const optimizer1 = new BatchOptimizer({ requestTimeout: 5000 });
  const optimizer2 = new BatchOptimizer({ requestTimeout: 10000 });
  
  assert.strictEqual(optimizer1.requestTimeout, 5000);
  assert.strictEqual(optimizer2.requestTimeout, 10000);
});

test('BatchOptimizer - uses default constants when not specified', () => {
  const optimizer = new BatchOptimizer();
  
  assert.strictEqual(optimizer.maxQueueSize, BATCH_OPTIMIZER_CONSTANTS.MAX_QUEUE_SIZE);
  assert.strictEqual(optimizer.requestTimeout, BATCH_OPTIMIZER_CONSTANTS.REQUEST_TIMEOUT_MS);
});

