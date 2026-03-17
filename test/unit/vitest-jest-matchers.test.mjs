/**
 * Tests for Vitest/Jest matcher integration.
 *
 * Verifies createMatchers, argument validation, and matcher registration.
 * Does NOT make real API calls.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Vitest/Jest Matchers', () => {
  let createMatchers;

  it('should load the integration module', async () => {
    const mod = await import('../../src/integrations/vitest-jest.mjs');
    createMatchers = mod.createMatchers;
    assert.strictEqual(typeof createMatchers, 'function');
  });

  it('should throw if expect is not provided', () => {
    assert.throws(() => createMatchers(null), /expect/);
  });

  it('should throw if expect.extend is missing', () => {
    assert.throws(() => createMatchers({}), /expect/);
  });

  it('should register matchers when given valid expect', () => {
    const registered = {};
    const mockExpect = {
      extend(matchers) {
        Object.assign(registered, matchers);
      }
    };
    createMatchers(mockExpect);

    assert.ok('toPassVisualCheck' in registered, 'Missing toPassVisualCheck');
    assert.ok('toHaveVisualScore' in registered, 'Missing toHaveVisualScore');
    assert.ok('toMatchVisually' in registered, 'Missing toMatchVisually');
  });

  it('toPassVisualCheck should reject non-string input', async () => {
    const registered = {};
    createMatchers({ extend(m) { Object.assign(registered, m); } });

    const result = await registered.toPassVisualCheck(123, 'test');
    assert.strictEqual(result.pass, false);
    assert.ok(result.message().includes('string'));
  });

  it('toHaveVisualScore should reject non-string input', async () => {
    const registered = {};
    createMatchers({ extend(m) { Object.assign(registered, m); } });

    const result = await registered.toHaveVisualScore(null, 7, 'test');
    assert.strictEqual(result.pass, false);
    assert.ok(result.message().includes('string'));
  });

  it('toMatchVisually should reject non-string input', async () => {
    const registered = {};
    createMatchers({ extend(m) { Object.assign(registered, m); } });

    const result = await registered.toMatchVisually(42, 'after.png', 'test');
    assert.strictEqual(result.pass, false);
    assert.ok(result.message().includes('string'));
  });

  it('toPassVisualCheck should handle validation errors gracefully', async () => {
    const registered = {};
    createMatchers({ extend(m) { Object.assign(registered, m); } });

    // Pass a path that doesn't exist -- should fail gracefully, not throw
    const result = await registered.toPassVisualCheck('/nonexistent/path.png', 'test');
    assert.strictEqual(result.pass, false);
    assert.ok(result.message().includes('failed'));
  });
});
