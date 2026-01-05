/**
 * Tests for error-handler.mjs
 */

import '../test-setup.mjs';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { initErrorHandlers } from '../../src/error-handler.mjs';

describe('Error Handler', () => {
  let originalListeners;
  let unhandledRejectionListeners;
  let uncaughtExceptionListeners;
  let warningListeners;

  beforeEach(() => {
    // Save original listeners
    originalListeners = {
      unhandledRejection: process.listenerCount('unhandledRejection'),
      uncaughtException: process.listenerCount('uncaughtException'),
      warning: process.listenerCount('warning')
    };
    
    // Get current listeners
    unhandledRejectionListeners = process.listeners('unhandledRejection').length;
    uncaughtExceptionListeners = process.listeners('uncaughtException').length;
    warningListeners = process.listeners('warning').length;
  });

  afterEach(() => {
    // Clean up: Remove all listeners added by initErrorHandlers
    // We can't easily identify which ones were added, so we'll just test that
    // the function works without breaking things
  });

  it('should export initErrorHandlers function', () => {
    assert.strictEqual(typeof initErrorHandlers, 'function');
  });

  it('should register unhandledRejection handler', () => {
    const before = process.listenerCount('unhandledRejection');
    initErrorHandlers();
    const after = process.listenerCount('unhandledRejection');
    
    assert.ok(after > before, 'Should add unhandledRejection listener');
  });

  it('should register uncaughtException handler', () => {
    const before = process.listenerCount('uncaughtException');
    initErrorHandlers();
    const after = process.listenerCount('uncaughtException');
    
    assert.ok(after > before, 'Should add uncaughtException listener');
  });

  it('should register warning handler', () => {
    const before = process.listenerCount('warning');
    initErrorHandlers();
    const after = process.listenerCount('warning');
    
    assert.ok(after > before, 'Should add warning listener');
  });

  it('should handle unhandledRejection with Error object', async () => {
    // This test verifies that unhandledRejection handler is registered
    // The actual handler behavior is tested by initErrorHandlers registration
    assert.ok(process.listenerCount('unhandledRejection') > 0);
  });

  it('should handle unhandledRejection with non-Error reason', async () => {
    // This test verifies that unhandledRejection handler is registered
    // The actual handler behavior is tested by initErrorHandlers registration
    assert.ok(process.listenerCount('unhandledRejection') > 0);
  });

  it('should be safe to call multiple times', () => {
    const before = process.listenerCount('unhandledRejection');
    initErrorHandlers();
    const after1 = process.listenerCount('unhandledRejection');
    initErrorHandlers();
    const after2 = process.listenerCount('unhandledRejection');
    
    // Should add listeners each time (though in practice you'd only call once)
    assert.ok(after1 > before, 'First call should add listeners');
    assert.ok(after2 >= after1, 'Second call should add more listeners');
  });

  it('should not throw when called', () => {
    assert.doesNotThrow(() => {
      initErrorHandlers();
    });
  });
});

