import '../test-setup.mjs'; // Auto-load .env (must be first)
import { test } from 'node:test';
import assert from 'node:assert';
import { recognizeIntent, batchRecognizeIntents, INTENT_TYPES } from '../../src/utils/intent-recognizer.mjs';

test('recognizeIntent handles keyword-based recognition', async () => {
  // Test navigate intent
  const intent1 = await recognizeIntent('Navigate to the checkout page', null, { useLLM: false });
  assert.ok(intent1.intent === INTENT_TYPES.NAVIGATE, 'Should recognize navigate intent');
  assert.ok(intent1.confidence >= 0.8, 'Should have high confidence');
  
  // Test fill form intent
  const intent2 = await recognizeIntent('Fill out the contact form', null, { useLLM: false });
  assert.ok(intent2.intent === INTENT_TYPES.FILL_FORM, 'Should recognize fill form intent');
  
  // Test validate intent
  const intent3 = await recognizeIntent('Check if the payment form is accessible', null, { useLLM: false });
  assert.ok(intent3.intent === INTENT_TYPES.VALIDATE, 'Should recognize validate intent');
  
  // Test explore intent
  const intent4 = await recognizeIntent('Try to find the pricing page', null, { useLLM: false });
  assert.ok(intent4.intent === INTENT_TYPES.EXPLORE, 'Should recognize explore intent');
  
  // Test play game intent
  const intent5 = await recognizeIntent('Play 2048 and get a score of 100', null, { useLLM: false });
  assert.ok(intent5.intent === INTENT_TYPES.PLAY_GAME, 'Should recognize play game intent');
  
  // Test click intent
  const intent6 = await recognizeIntent('Click the submit button', null, { useLLM: false });
  assert.ok(intent6.intent === INTENT_TYPES.CLICK, 'Should recognize click intent');
  
  // Test unknown intent
  const intent7 = await recognizeIntent('Random text that does not match any pattern', null, { useLLM: false });
  assert.ok(intent7.intent === INTENT_TYPES.UNKNOWN, 'Should recognize unknown intent');
  assert.ok(intent7.confidence < 0.8, 'Should have lower confidence for unknown');
});

test('recognizeIntent extracts target from task', async () => {
  const intent1 = await recognizeIntent('Navigate to "checkout page"', null, { useLLM: false });
  assert.ok(intent1.parameters.target === 'checkout page', 'Should extract quoted target');
  
  const intent2 = await recognizeIntent('Click the "Submit" button', null, { useLLM: false });
  assert.ok(intent2.parameters.target === 'Submit', 'Should extract quoted button name');
});

test('batchRecognizeIntents aggregates results', async () => {
  const tasks = [
    'Navigate to checkout',
    'Fill out the form',
    'Check if accessible',
    'Random unknown task'
  ];
  
  const result = await batchRecognizeIntents(tasks, [], { useLLM: false });
  
  assert.ok(result.total === 4, 'Should process all tasks');
  assert.ok(result.recognized === 3, 'Should recognize 3 out of 4 tasks');
  assert.ok(result.accuracy >= 0.75, 'Should have >75% accuracy');
  assert.ok(result.intentDistribution[INTENT_TYPES.NAVIGATE] === 1, 'Should have 1 navigate intent');
  assert.ok(result.intentDistribution[INTENT_TYPES.FILL_FORM] === 1, 'Should have 1 fill form intent');
  assert.ok(result.intentDistribution[INTENT_TYPES.VALIDATE] === 1, 'Should have 1 validate intent');
});

