/**
 * Tests for validateComparison convenience function
 */

import { test, mock } from 'node:test';
import assert from 'node:assert';
import { writeFileSync, mkdirSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createTestImage } from '../test-image-utils.mjs';

const TEST_DIR = join(tmpdir(), 'ai-visual-test-comparison-test');

// Create test images before tests run
async function setup() {
  mkdirSync(TEST_DIR, { recursive: true });
  await createTestImage(join(TEST_DIR, 'before.png'));
  await createTestImage(join(TEST_DIR, 'after.png'));
}

await setup();

// -- Input validation tests (no mocking needed, these throw before calling judge) --

test('validateComparison: throws on non-string beforePath', async () => {
  const { validateComparison } = await import('../../src/page-validation.js');
  await assert.rejects(
    () => validateComparison(123, join(TEST_DIR, 'after.png'), 'compare'),
    (err) => {
      assert.ok(err.message.includes('string'), `Expected string error, got: ${err.message}`);
      return true;
    }
  );
});

test('validateComparison: throws on non-string afterPath', async () => {
  const { validateComparison } = await import('../../src/page-validation.js');
  await assert.rejects(
    () => validateComparison(join(TEST_DIR, 'before.png'), null, 'compare'),
    (err) => {
      assert.ok(err.message.includes('string'), `Expected string error, got: ${err.message}`);
      return true;
    }
  );
});

test('validateComparison: throws on empty beforePath', async () => {
  const { validateComparison } = await import('../../src/page-validation.js');
  await assert.rejects(
    () => validateComparison('', join(TEST_DIR, 'after.png'), 'compare'),
    (err) => {
      assert.ok(err.message.includes('empty'), `Expected empty error, got: ${err.message}`);
      return true;
    }
  );
});

test('validateComparison: throws on empty afterPath', async () => {
  const { validateComparison } = await import('../../src/page-validation.js');
  await assert.rejects(
    () => validateComparison(join(TEST_DIR, 'before.png'), '', 'compare'),
    (err) => {
      assert.ok(err.message.includes('empty'), `Expected empty error, got: ${err.message}`);
      return true;
    }
  );
});

test('validateComparison: throws on empty prompt', async () => {
  const { validateComparison } = await import('../../src/page-validation.js');
  await assert.rejects(
    () => validateComparison(join(TEST_DIR, 'before.png'), join(TEST_DIR, 'after.png'), ''),
    (err) => {
      assert.ok(err.message.includes('empty'), `Expected empty error, got: ${err.message}`);
      return true;
    }
  );
});

test('validateComparison: throws on missing prompt (non-string)', async () => {
  const { validateComparison } = await import('../../src/page-validation.js');
  await assert.rejects(
    () => validateComparison(join(TEST_DIR, 'before.png'), join(TEST_DIR, 'after.png'), undefined),
    (err) => {
      assert.ok(err.message.includes('string'), `Expected string error, got: ${err.message}`);
      return true;
    }
  );
});

// -- Integration test: verify it calls validateScreenshot correctly --
// We mock VLLMJudge.prototype.judgeScreenshot to avoid real API calls
// while verifying the full call chain.

test('validateComparison: passes both images and wrapped prompt to judge', async () => {
  const { validateComparison } = await import('../../src/index.js');
  const { VLLMJudge } = await import('#judge');

  const originalJudge = VLLMJudge.prototype.judgeScreenshot;
  const capturedArgs = [];

  VLLMJudge.prototype.judgeScreenshot = async function (imagePath, prompt, context) {
    capturedArgs.push({ imagePath, prompt, context });
    return capturedArgs.length === 1
      ? {
          enabled: true, kind: 'comparison', winner: 'B', score: 8,
          scores: { A: 4, B: 8 }, comparisonConfidence: 0.9,
          differences: ['after fixes contrast'], issues: [], reasoning: 'B wins',
          recommendations: [],
        }
      : {
          enabled: true, kind: 'comparison', winner: 'A', score: 5,
          scores: { A: 9, B: 5 }, comparisonConfidence: 0.8,
          differences: ['first image fixes contrast'], issues: [], reasoning: 'A wins',
          recommendations: [],
        };
  };

  const beforePath = join(TEST_DIR, 'before.png');
  const afterPath = join(TEST_DIR, 'after.png');
  const userPrompt = 'Check the header alignment';

  try {
    const result = await validateComparison(beforePath, afterPath, userPrompt, {
      provider: 'gemini'
    });

    // Verify result passes through
    assert.strictEqual(result.score, 8.5);
    assert.strictEqual(result.winner, 'B');
    assert.strictEqual(result.counterBalance.status, 'agree');

    // Verify judge was called with array of both paths
    assert.strictEqual(capturedArgs.length, 2);
    assert.deepStrictEqual(capturedArgs.map(call => call.imagePath), [
      [beforePath, afterPath],
      [afterPath, beforePath],
    ]);

    // Verify prompt was wrapped with comparison instructions
    assert.ok(
      capturedArgs[0].prompt.includes('Compare these two screenshots'),
      'Prompt should include comparison prefix'
    );
    assert.ok(
      capturedArgs[0].prompt.includes(userPrompt),
      'Prompt should include user prompt'
    );
    assert.ok(
      capturedArgs[0].prompt.includes('improvements or regressions'),
      'Prompt should mention improvements/regressions'
    );

    // Verify context includes testType
    assert.strictEqual(capturedArgs[0].context.testType, 'comparison');
    assert.strictEqual(capturedArgs[0].context.comparisonOrder, 'AB');
    assert.strictEqual(capturedArgs[1].context.comparisonOrder, 'BA');
  } finally {
    VLLMJudge.prototype.judgeScreenshot = originalJudge;
  }
});

test('validateComparison: user context can override testType', async () => {
  const { validateComparison } = await import('../../src/page-validation.js');
  const { VLLMJudge } = await import('#judge');

  const originalJudge = VLLMJudge.prototype.judgeScreenshot;
  let capturedContext = null;

  VLLMJudge.prototype.judgeScreenshot = async function (_imagePath, _prompt, context) {
    capturedContext = context;
    return { score: 7, pass: true, issues: [], reasoning: '', assessment: 'pass' };
  };

  try {
    await validateComparison(
      join(TEST_DIR, 'before.png'),
      join(TEST_DIR, 'after.png'),
      'check layout',
      { testType: 'custom-type' }
    );

    // testType is set before ...context spread, so user context wins
    assert.strictEqual(capturedContext.testType, 'custom-type');
  } finally {
    VLLMJudge.prototype.judgeScreenshot = originalJudge;
  }
});

// Cleanup
for (const f of ['before.png', 'after.png']) {
  const p = join(TEST_DIR, f);
  if (existsSync(p)) unlinkSync(p);
}
