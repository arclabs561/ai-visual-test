import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeValidationResult } from '../../src/validation-result-normalizer.mjs';

describe('Normalizer end-to-end', () => {

  it('normalizes a raw VLM-style response into standard shape', () => {
    const raw = {
      score: 7,
      issues: ['Low contrast text', 'Missing alt text'],
      judgment: 'Generally good with some accessibility gaps',
      provider: 'gemini'
    };
    const result = normalizeValidationResult(raw, 'test');

    assert.equal(result.score, 7);
    assert.equal(result.enabled, true);
    assert.deepStrictEqual(result.issues, ['Low contrast text', 'Missing alt text']);
    assert.equal(result.reasoning, 'Generally good with some accessibility gaps');
    assert.equal(result.assessment, null);
  });

  it('preserves score 0 (not coerced to null or false)', () => {
    const result = normalizeValidationResult({
      score: 0,
      issues: ['Completely broken layout']
    }, 'test');

    assert.strictEqual(result.score, 0);
    assert.equal(result.enabled, true);
  });

  it('keeps null score as null', () => {
    const result = normalizeValidationResult({
      score: null,
      issues: []
    }, 'test');

    assert.strictEqual(result.score, null);
  });

  it('converts undefined score to null', () => {
    const result = normalizeValidationResult({
      issues: []
    }, 'test');

    assert.strictEqual(result.score, null);
  });

  it('flattens object issues to strings via description field', () => {
    const result = normalizeValidationResult({
      score: 5,
      issues: [
        { description: 'Button too small', importance: 'high' },
        { description: 'Color mismatch', importance: 'low' }
      ]
    }, 'test');

    assert.deepStrictEqual(result.issues, ['Button too small', 'Color mismatch']);
  });

  it('produces richIssues alongside flat string issues', () => {
    const result = normalizeValidationResult({
      score: 5,
      issues: [
        { description: 'Overlap detected', importance: 'high', evidence: 'header region' }
      ]
    }, 'test');

    assert.equal(result.issues.length, 1);
    assert.equal(result.issues[0], 'Overlap detected');
    assert.equal(result.richIssues.length, 1);
    assert.equal(result.richIssues[0].description, 'Overlap detected');
    assert.equal(result.richIssues[0].importance, 'high');
    assert.equal(result.richIssues[0].evidence, 'header region');
  });

  it('returns empty array for missing or non-array issues', () => {
    const result = normalizeValidationResult({
      score: 9,
      issues: 'not an array'
    }, 'test');

    assert.deepStrictEqual(result.issues, []);
    assert.deepStrictEqual(result.richIssues, []);
  });

  it('returns fallback structure for null input', () => {
    const result = normalizeValidationResult(null, 'test');

    assert.equal(result.enabled, false);
    assert.strictEqual(result.score, null);
    assert.deepStrictEqual(result.issues, []);
    assert.equal(typeof result.reasoning, 'string');
  });

  it('uses judgment field as reasoning fallback', () => {
    const result = normalizeValidationResult({
      score: 7,
      issues: [],
      judgment: 'The page renders correctly'
    }, 'test');

    assert.equal(result.reasoning, 'The page renders correctly');
  });

  it('formats element/issue object pairs as strings', () => {
    const result = normalizeValidationResult({
      score: 4,
      issues: [
        { element: 'nav-bar', issue: 'overlaps content' }
      ]
    }, 'test');

    assert.equal(result.issues[0], 'nav-bar: overlaps content');
  });
});
