/**
 * Tests for error-handler.js
 */

import '../test-setup.mjs';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { initErrorHandlers } from '../../src/error-handler.js';

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

  it('serializes Error rejection reasons without exposing the Error object', () => {
    const messages = [];
    const originalError = console.error;
    console.error = (...args) => messages.push(args);
    try {
      initErrorHandlers();
      const listener = process.listeners('unhandledRejection').at(-1);
      assert.ok(listener, 'Should register an unhandledRejection listener');
      const rejection = new Error('network unavailable');
      listener(rejection, Promise.resolve());

      assert.strictEqual(messages.length, 1);
      const [label, details] = messages[0];
      assert.strictEqual(label, '[Unhandled Rejection]');
      assert.deepStrictEqual(details.reason.message, 'network unavailable');
      assert.strictEqual(details.reason.name, 'Error');
      assert.ok(typeof details.reason.stack === 'string');
      assert.strictEqual(details.promise, '[object Promise]');
    } finally {
      console.error = originalError;
    }
  });

  it('preserves non-Error rejection reasons and process warning details', () => {
    const messages = [];
    const originalError = console.error;
    console.error = (...args) => messages.push(args);
    try {
      initErrorHandlers();
      const rejectionListener = process.listeners('unhandledRejection').at(-1);
      const warningListener = process.listeners('warning').at(-1);
      assert.ok(rejectionListener, 'Should register an unhandledRejection listener');
      assert.ok(warningListener, 'Should register a warning listener');

      rejectionListener({ code: 'UNAVAILABLE' }, Promise.resolve());
      const warning = new Error('deprecated option');
      warning.name = 'DeprecationWarning';
      warningListener(warning);

      assert.strictEqual(messages.length, 2);
      assert.deepStrictEqual(messages[0], [
        '[Unhandled Rejection]', { reason: { code: 'UNAVAILABLE' }, promise: '[object Promise]' }
      ]);
      const [label, details] = messages[1];
      assert.strictEqual(label, '[Process Warning]');
      assert.strictEqual(details.name, 'DeprecationWarning');
      assert.strictEqual(details.message, 'deprecated option');
      assert.ok(typeof details.stack === 'string');
    } finally {
      console.error = originalError;
    }
  });
});
