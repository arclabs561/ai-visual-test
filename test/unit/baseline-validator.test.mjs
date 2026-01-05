import '../test-setup.mjs'; // Auto-load .env (must be first)
import { test } from 'node:test';
import assert from 'node:assert';
import { testBaseline, batchTestBaseline } from '../../src/utils/baseline-validator.mjs';

test('testBaseline compares visual vs text-only', async () => {
  // API key should be auto-loaded from .env via test-setup.mjs

  // Skip if no test image available
  const { existsSync } = await import('node:fs');
  if (!existsSync('test-image.png')) {
    test.skip('Test image not available');
    return;
  }

  const result = await testBaseline('test-image.png', 'What is in this image?', {});

  assert.ok(result.visualResult !== undefined, 'Should have visual result');
  assert.ok(result.baselineResult !== undefined, 'Should have baseline result');
  assert.ok(result.accuracyDrop !== undefined, 'Should calculate accuracy drop');
  assert.ok(result.hasVisualDiscriminativePower !== undefined, 'Should detect visual discriminative power');
  assert.ok(result.recommendation, 'Should provide recommendation');
});

test('batchTestBaseline aggregates baseline tests', async () => {
  // API key should be auto-loaded from .env via test-setup.mjs

  // Skip if no test images available
  const { existsSync } = await import('node:fs');
  if (!existsSync('test1.png') || !existsSync('test2.png')) {
    test.skip('Test images not available');
    return;
  }

  const testCases = [
    { imagePath: 'test1.png', prompt: 'What is this?' },
    { imagePath: 'test2.png', prompt: 'Count objects' }
  ];

  const result = await batchTestBaseline(testCases, {});

  assert.ok(result.total > 0, 'Should have results');
  assert.ok(result.avgAccuracyDrop !== undefined, 'Should calculate average accuracy drop');
  assert.ok(result.visualDiscriminativePower !== undefined, 'Should calculate visual discriminative power');
  assert.ok(result.recommendation, 'Should provide recommendation');
});

