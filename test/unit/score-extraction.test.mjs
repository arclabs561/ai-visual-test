import { test } from 'node:test';
import assert from 'node:assert';
import { extractSemanticInfo } from '../../src/index.js';

const score = (text) => extractSemanticInfo(text).score;

test('extractSemanticInfo keeps decimal scores', () => {
  assert.strictEqual(score('Score: 7.5/10'), 7.5);
  assert.strictEqual(score('Overall score: 6.5/10'), 6.5);
  assert.strictEqual(score('{"score": 8.25, "issues": []}'), 8.25);
  assert.strictEqual(score('7.5 out of 10, minor spacing issues'), 7.5);
});

test('extractSemanticInfo does not read the fraction of a decimal as the score', () => {
  // "9.5/10" used to match as "5/10".
  assert.strictEqual(score('Rating: 9.5/10'), 9.5);
  assert.strictEqual(score('I would give this 8.5/10 overall.'), 8.5);
});

test('extractSemanticInfo integer scores are unchanged', () => {
  assert.strictEqual(score('Score: 7'), 7);
  assert.strictEqual(score('Verdict: PASS (9/10)'), 9);
  assert.strictEqual(score('10'), 10);
  assert.strictEqual(score('10.'), 10);
  assert.strictEqual(score('Rated 3 for contrast'), 3);
  assert.strictEqual(score('**Score**: 6'), 6);
});

test('extractSemanticInfo ignores out-of-range numbers', () => {
  assert.strictEqual(score('Score: 75'), null);
  assert.strictEqual(score('Score: 100'), null);
});

test('extractSemanticInfo keyword fallback respects negation', () => {
  assert.strictEqual(score('The layout is good.'), 7);
  assert.notStrictEqual(score('This is not good.'), 7);
  assert.notStrictEqual(score("The contrast isn't great."), 8);
  assert.notStrictEqual(score('Not very good at all.'), 8);
  assert.strictEqual(score('Excellent work.'), 9);
});
