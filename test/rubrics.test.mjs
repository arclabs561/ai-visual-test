import { test } from 'node:test';
import assert from 'node:assert';
import { DEFAULT_RUBRIC, buildRubricPrompt, getRubricForTestType } from '../src/rubrics.mjs';

test('DEFAULT_RUBRIC has required structure', () => {
  assert.ok(DEFAULT_RUBRIC.score);
  assert.ok(DEFAULT_RUBRIC.score.criteria);
  assert.ok(DEFAULT_RUBRIC.dimensions);
  assert.strictEqual(Object.keys(DEFAULT_RUBRIC.score.criteria).length, 11); // 0-10
});

test('buildRubricPrompt generates valid prompt', () => {
  const prompt = buildRubricPrompt();
  assert.ok(prompt.includes('EVALUATION RUBRIC'));
  assert.ok(prompt.includes('Scoring Scale'));
  assert.ok(prompt.includes('Evaluation Instructions'));
  assert.ok(prompt.includes('Output Format'));
});

test('buildRubricPrompt includes dimensions by default', () => {
  const prompt = buildRubricPrompt();
  // Check for dimension section headers (uppercase in markdown)
  assert.ok(prompt.includes('**VISUAL**') || prompt.includes('VISUAL'));
  assert.ok(prompt.includes('**FUNCTIONAL**') || prompt.includes('FUNCTIONAL'));
  assert.ok(prompt.includes('**USABILITY**') || prompt.includes('USABILITY'));
  assert.ok(prompt.includes('**ACCESSIBILITY**') || prompt.includes('ACCESSIBILITY'));
  assert.ok(prompt.includes('Evaluation Dimensions'));
});

test('buildRubricPrompt can exclude dimensions', () => {
  const prompt = buildRubricPrompt(DEFAULT_RUBRIC, false);
  // Check that dimension sections are not included (they contain "VISUAL", "FUNCTIONAL", etc.)
  assert.ok(!prompt.includes('**VISUAL**'));
  assert.ok(!prompt.includes('**FUNCTIONAL**'));
  assert.ok(!prompt.includes('Evaluation Dimensions'));
});

test('getRubricForTestType returns custom rubric for payment-screen', () => {
  const rubric = getRubricForTestType('payment-screen');
  assert.ok(rubric.dimensions.payment);
  assert.ok(rubric.dimensions.payment.criteria.length > 0);
});

test('getRubricForTestType returns default for unknown type', () => {
  const rubric = getRubricForTestType('unknown-type');
  assert.strictEqual(rubric, DEFAULT_RUBRIC);
});

