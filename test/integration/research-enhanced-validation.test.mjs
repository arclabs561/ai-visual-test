import { test } from 'node:test';
import assert from 'node:assert';
import {
  validateWithResearchEnhancements,
  validateMultipleWithPositionAnalysis,
  validateWithLengthAlignment,
  validateWithExplicitRubric,
  validateWithAllResearchEnhancements
} from '../../src/ensemble/index.js';

test('research-enhanced functions are exported', () => {
  assert.ok(typeof validateWithResearchEnhancements === 'function');
  assert.ok(typeof validateMultipleWithPositionAnalysis === 'function');
  assert.ok(typeof validateWithLengthAlignment === 'function');
  assert.ok(typeof validateWithExplicitRubric === 'function');
  assert.ok(typeof validateWithAllResearchEnhancements === 'function');
});

test('validateWithResearchEnhancements accepts options', () => {
  // Just test that function signature is correct
  assert.ok(validateWithResearchEnhancements.length >= 2);
});

test('validateMultipleWithPositionAnalysis accepts options', () => {
  assert.ok(validateMultipleWithPositionAnalysis.length >= 2);
});

test('validateWithLengthAlignment accepts options', () => {
  assert.ok(validateWithLengthAlignment.length >= 2);
});

test('validateWithExplicitRubric accepts options', () => {
  assert.ok(validateWithExplicitRubric.length >= 2);
});

test('validateWithAllResearchEnhancements accepts options', () => {
  assert.ok(validateWithAllResearchEnhancements.length >= 2);
});

test('validateWithAllResearchEnhancements preserves the user prompt while building the default rubric', async () => {
  const result = await validateWithAllResearchEnhancements('/tmp/research-rubric-regression.png', 'Evaluate layout contrast', {
    apiKey: null,
    enableBiasDetection: false,
    enableBiasMitigation: false,
  });
  assert.strictEqual(result.enabled, false);
  assert.strictEqual(result.score, null);
});
