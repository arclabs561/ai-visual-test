/**
 * Tests for constants module
 * 
 * Ensures all magic numbers are properly extracted to named constants
 * and that constants remain consistent across the codebase.
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { CACHE_CONSTANTS, TEMPORAL_CONSTANTS, API_CONSTANTS } from '../src/constants.mjs';

test('CACHE_CONSTANTS are defined and have correct types', () => {
  assert.strictEqual(typeof CACHE_CONSTANTS.MAX_CACHE_AGE_MS, 'number');
  assert.strictEqual(typeof CACHE_CONSTANTS.MAX_CACHE_SIZE, 'number');
  assert.strictEqual(typeof CACHE_CONSTANTS.MAX_CACHE_SIZE_BYTES, 'number');
  
  // Verify values are reasonable
  assert(CACHE_CONSTANTS.MAX_CACHE_AGE_MS > 0, 'MAX_CACHE_AGE_MS should be positive');
  assert(CACHE_CONSTANTS.MAX_CACHE_SIZE > 0, 'MAX_CACHE_SIZE should be positive');
  assert(CACHE_CONSTANTS.MAX_CACHE_SIZE_BYTES > 0, 'MAX_CACHE_SIZE_BYTES should be positive');
  
  // Verify 7 days = 7 * 24 * 60 * 60 * 1000 ms
  assert.strictEqual(CACHE_CONSTANTS.MAX_CACHE_AGE_MS, 7 * 24 * 60 * 60 * 1000);
  
  // Verify 100MB = 100 * 1024 * 1024 bytes
  assert.strictEqual(CACHE_CONSTANTS.MAX_CACHE_SIZE_BYTES, 100 * 1024 * 1024);
});

test('TEMPORAL_CONSTANTS are defined and have correct types', () => {
  assert.strictEqual(typeof TEMPORAL_CONSTANTS.DEFAULT_WINDOW_SIZE_MS, 'number');
  assert.strictEqual(typeof TEMPORAL_CONSTANTS.DEFAULT_DECAY_FACTOR, 'number');
  assert.strictEqual(typeof TEMPORAL_CONSTANTS.DEFAULT_COHERENCE_THRESHOLD, 'number');
  
  // Verify values are reasonable
  assert(TEMPORAL_CONSTANTS.DEFAULT_WINDOW_SIZE_MS > 0, 'DEFAULT_WINDOW_SIZE_MS should be positive');
  assert(TEMPORAL_CONSTANTS.DEFAULT_DECAY_FACTOR > 0 && TEMPORAL_CONSTANTS.DEFAULT_DECAY_FACTOR <= 1, 
    'DEFAULT_DECAY_FACTOR should be between 0 and 1');
  assert(TEMPORAL_CONSTANTS.DEFAULT_COHERENCE_THRESHOLD >= 0 && TEMPORAL_CONSTANTS.DEFAULT_COHERENCE_THRESHOLD <= 1,
    'DEFAULT_COHERENCE_THRESHOLD should be between 0 and 1');
  
  // Verify 10 seconds = 10000 ms
  assert.strictEqual(TEMPORAL_CONSTANTS.DEFAULT_WINDOW_SIZE_MS, 10000);
  
  // Verify decay factor is 0.9
  assert.strictEqual(TEMPORAL_CONSTANTS.DEFAULT_DECAY_FACTOR, 0.9);
});

test('API_CONSTANTS are defined and have correct types', () => {
  assert.strictEqual(typeof API_CONSTANTS.DEFAULT_TIMEOUT_MS, 'number');
  assert.strictEqual(typeof API_CONSTANTS.DEFAULT_MAX_CONCURRENCY, 'number');
  
  // Verify values are reasonable
  assert(API_CONSTANTS.DEFAULT_TIMEOUT_MS > 0, 'DEFAULT_TIMEOUT_MS should be positive');
  assert(API_CONSTANTS.DEFAULT_MAX_CONCURRENCY > 0, 'DEFAULT_MAX_CONCURRENCY should be positive');
  
  // Verify 30 seconds = 30000 ms
  assert.strictEqual(API_CONSTANTS.DEFAULT_TIMEOUT_MS, 30000);
});

test('Constants are exported from index.mjs', async () => {
  const { CACHE_CONSTANTS: IndexCache, TEMPORAL_CONSTANTS: IndexTemporal, API_CONSTANTS: IndexAPI } = await import('../src/index.mjs');
  
  assert(IndexCache, 'CACHE_CONSTANTS should be exported from index.mjs');
  assert(IndexTemporal, 'TEMPORAL_CONSTANTS should be exported from index.mjs');
  assert(IndexAPI, 'API_CONSTANTS should be exported from index.mjs');
  
  // Verify they're the same objects
  assert.strictEqual(IndexCache.MAX_CACHE_AGE_MS, CACHE_CONSTANTS.MAX_CACHE_AGE_MS);
  assert.strictEqual(IndexTemporal.DEFAULT_WINDOW_SIZE_MS, TEMPORAL_CONSTANTS.DEFAULT_WINDOW_SIZE_MS);
  assert.strictEqual(IndexAPI.DEFAULT_TIMEOUT_MS, API_CONSTANTS.DEFAULT_TIMEOUT_MS);
});

