/**
 * Tests for Vitest/Jest matcher integration.
 *
 * Verifies createMatchers, argument validation, and matcher registration.
 * Does NOT make real API calls.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

function registerMatchers(createMatchers) {
  const registered = {};
  createMatchers({ extend(matchers) { Object.assign(registered, matchers); } });
  return registered;
}

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
    const registered = registerMatchers(createMatchers);

    assert.ok('toPassVisualCheck' in registered, 'Missing toPassVisualCheck');
    assert.ok('toHaveVisualScore' in registered, 'Missing toHaveVisualScore');
    assert.ok('toMatchVisually' in registered, 'Missing toMatchVisually');
  });

  it('toPassVisualCheck should reject non-string input', async () => {
    const registered = registerMatchers(createMatchers);

    const result = await registered.toPassVisualCheck(123, 'test');
    assert.strictEqual(result.pass, false);
    assert.ok(result.message().includes('string'));
  });

  it('toHaveVisualScore should reject non-string input', async () => {
    const registered = registerMatchers(createMatchers);

    const result = await registered.toHaveVisualScore(null, 7, 'test');
    assert.strictEqual(result.pass, false);
    assert.ok(result.message().includes('string'));
  });

  it('toMatchVisually should reject non-string input', async () => {
    const registered = registerMatchers(createMatchers);

    const result = await registered.toMatchVisually(42, 'after.png', 'test');
    assert.strictEqual(result.pass, false);
    assert.ok(result.message().includes('string'));
  });

  it('toPassVisualCheck should handle validation errors gracefully', async () => {
    const registered = registerMatchers(createMatchers);

    // Pass a path that doesn't exist -- should fail gracefully, not throw.
    // In CI (no API keys), validateScreenshot returns enabled:false with score null.
    // Locally (with keys), it throws FileError caught by the matcher.
    // Either way: pass must be false.
    const result = await registered.toPassVisualCheck('/nonexistent/path.png', 'test');
    assert.strictEqual(result.pass, false);
  });

  it('toMatchVisually uses the counterbalanced candidate score', async (t) => {
    const { VLLMJudge } = await import('../../src/judge.mjs');
    const originalJudge = VLLMJudge.prototype.judgeScreenshot;
    t.after(() => { VLLMJudge.prototype.judgeScreenshot = originalJudge; });

    let callCount = 0;
    VLLMJudge.prototype.judgeScreenshot = async () => {
      callCount += 1;
      return callCount === 1
        ? {
            enabled: true, kind: 'comparison', winner: 'B', score: 8,
            scores: { A: 4, B: 8 }, comparisonConfidence: 0.9,
            differences: [], issues: [], reasoning: 'B wins', recommendations: [],
          }
        : {
            enabled: true, kind: 'comparison', winner: 'A', score: 5,
            scores: { A: 9, B: 5 }, comparisonConfidence: 0.8,
            differences: [], issues: [], reasoning: 'A wins', recommendations: [],
          };
    };

    const registered = registerMatchers(createMatchers);
    const result = await registered.toMatchVisually(
      'before.png',
      'after.png',
      'compare layout',
      { minScore: 8.5 },
    );

    assert.strictEqual(callCount, 2);
    assert.strictEqual(result.pass, true);
    assert.match(result.message(), /8\.5\/10/);
  });

  it('toMatchVisually fails when image order changes the winner', async (t) => {
    const { VLLMJudge } = await import('../../src/judge.mjs');
    const originalJudge = VLLMJudge.prototype.judgeScreenshot;
    t.after(() => { VLLMJudge.prototype.judgeScreenshot = originalJudge; });

    VLLMJudge.prototype.judgeScreenshot = async () => ({
      enabled: true, kind: 'comparison', winner: 'B', score: 9,
      scores: { A: 8, B: 9 }, comparisonConfidence: 0.95,
      differences: [], issues: [], reasoning: 'second position wins', recommendations: [],
    });

    const registered = registerMatchers(createMatchers);
    const result = await registered.toMatchVisually(
      'before.png',
      'after.png',
      'compare layout',
      { minScore: 7 },
    );

    assert.strictEqual(result.pass, false, 'a position-sensitive verdict must not pass on score alone');
    assert.match(result.message(), /indeterminate/);
    assert.match(result.message(), /image-order verdicts conflicted/);
  });
});
