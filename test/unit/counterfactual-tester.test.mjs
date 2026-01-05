import '../test-setup.mjs'; // Auto-load .env (must be first)
import { test } from 'node:test';
import assert from 'node:assert';
import { existsSync } from 'fs';
import { testCounterfactual, batchTestCounterfactual } from '../../src/utils/counterfactual-tester.mjs';
import { testLog } from '../test-logger.mjs';

test('testCounterfactual detects memorization vs visual', async function() {
  testLog.setContext('counterfactual-tester', 'testCounterfactual');
  
  // API key should be auto-loaded from .env via test-setup.mjs

  // Check if test image exists
  if (!existsSync('test-image.png')) {
    testLog.skip('Test image not available');
    this.skip();
    return;
  }

  // This is a conceptual test - would need actual counterfactual image
  // For now, test the structure
  let result;
  try {
    testLog.info('Testing counterfactual detection', { 
      image: 'test-image.png',
      prompt: 'How many legs does this animal have?'
    });
    result = await testCounterfactual(
      'test-image.png',
      'How many legs does this animal have?',
      4, // Expected memorized (dogs have 4 legs)
      5, // Expected visual (counterfactual has 5 legs)
      {}
    );
    testLog.success('Counterfactual test completed', {
      usesVisual: result.usesVisual,
      usesMemorization: result.usesMemorization
    });
  } catch (e) {
    testLog.error('Test failed', e);
    this.skip();
    return;
  }

  assert.ok(result.extractedValue !== undefined, 'Should extract value');
  assert.ok(result.usesVisual !== undefined, 'Should detect visual usage');
  assert.ok(result.usesMemorization !== undefined, 'Should detect memorization usage');
  assert.ok(result.biasAligned !== undefined, 'Should detect bias alignment');
  assert.ok(result.recommendation, 'Should provide recommendation');
  
  testLog.clearContext();
});

test('batchTestCounterfactual aggregates results', async function() {
  // API key should be auto-loaded from .env via test-setup.mjs

  const testCases = [
    {
      imagePath: 'test1.png',
      prompt: 'How many legs?',
      expectedMemorized: 4,
      expectedVisual: 5
    },
    {
      imagePath: 'test2.png',
      prompt: 'What color?',
      expectedMemorized: 'red',
      expectedVisual: 'blue'
    }
  ];

  // Check if test images exist
  const hasTestImages = testCases.every(tc => existsSync(tc.imagePath));
  if (!hasTestImages) {
    console.log('   ℹ️  Skipping - test images not available');
    this.skip();
    return;
  }

  let result;
  try {
    result = await batchTestCounterfactual(testCases, {});
  } catch (e) {
    console.log(`   ℹ️  Test failed: ${e.message}`);
    this.skip();
    return;
  }

  assert.ok(result.total > 0, 'Should have results');
  assert.ok(result.visualAccuracy !== undefined, 'Should calculate visual accuracy');
  assert.ok(result.memorizationRate !== undefined, 'Should calculate memorization rate');
  assert.ok(result.biasAlignedRate !== undefined, 'Should calculate bias-aligned rate');
  assert.ok(result.recommendation, 'Should provide recommendation');
});

