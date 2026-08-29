import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { VLLMJudge } from '#judge';

describe('Provider response parsing', () => {
  let judge;

  before(() => {
    judge = new VLLMJudge({ provider: 'gemini', apiKey: null });
  });

  // -- extractScore --

  describe('extractScore', () => {
    it('extracts score from JSON format: "score": 7', () => {
      assert.equal(judge.extractScore('{"score": 7, "issues": []}'), 7);
    });

    it('extracts score from "Score: 8/10" text pattern', () => {
      assert.equal(judge.extractScore('The UI looks good. Score: 8/10'), 8);
    });

    it('extracts score from "7 out of 10" pattern', () => {
      assert.equal(judge.extractScore('Overall Score: 7 out of 10'), 7);
    });

    it('extracts score from markdown bold format', () => {
      assert.equal(judge.extractScore('**Score**: 6'), 6);
    });

    it('extracts score from standalone number', () => {
      assert.equal(judge.extractScore('9'), 9);
    });

    it('extracts score from rating pattern', () => {
      assert.equal(judge.extractScore('Rating: 5'), 5);
    });

    it('returns null for non-numeric text with no score keywords', () => {
      assert.equal(judge.extractScore('The page loaded successfully with no problems.'), null);
    });

    it('infers score from verdict language ("excellent")', () => {
      assert.equal(judge.extractScore('The design is excellent and well-structured.'), 9);
    });

    it('infers score from verdict language ("poor")', () => {
      assert.equal(judge.extractScore('The layout is poor and hard to navigate.'), 4);
    });

    it('returns null for null/undefined input', () => {
      assert.equal(judge.extractScore(null), null);
      assert.equal(judge.extractScore(undefined), null);
    });

    it('rejects scores outside 0-10 range', () => {
      // "Score: 15" -- 15 > 10, so the /score[:\s]*(\d+)/i match returns 15 which fails range check.
      // Falls through to other patterns or null.
      const result = judge.extractScore('Score: 15');
      // 15 is out of range for all patterns, should return null
      assert.equal(result, null);
    });
  });

  // -- extractIssues --

  describe('extractIssues', () => {
    it('extracts issues from embedded JSON', () => {
      const text = '{"score": 5, "issues": ["Low contrast", "Missing label"]}';
      const issues = judge.extractIssues(text);
      assert.deepStrictEqual(issues, ['Low contrast', 'Missing label']);
    });

    it('extracts issues from bullet-point lines', () => {
      const text = 'Problems found:\n- Button overlap\n- Text truncated\nOverall poor.';
      const issues = judge.extractIssues(text);
      assert.ok(issues.some(i => i.includes('Button overlap')));
      assert.ok(issues.some(i => i.includes('Text truncated')));
    });

    it('extracts issues from numbered list lines', () => {
      const text = 'Issues:\n1. Header misaligned\n2. Footer missing';
      const issues = judge.extractIssues(text);
      assert.ok(issues.some(i => i.includes('Header misaligned')));
      assert.ok(issues.some(i => i.includes('Footer missing')));
    });

    it('returns empty array when no issues found in JSON', () => {
      const text = '{"score": 10}';
      const issues = judge.extractIssues(text);
      assert.deepStrictEqual(issues, []);
    });
  });

  // -- extractAssessment --

  describe('extractAssessment', () => {
    it('extracts assessment from JSON', () => {
      const text = '{"assessment": "pass", "score": 8}';
      assert.equal(judge.extractAssessment(text), 'pass');
    });

    it('infers pass from text containing "pass"', () => {
      assert.equal(judge.extractAssessment('The screenshot passes all checks.'), 'pass');
    });

    it('infers fail from text containing "fail"', () => {
      assert.equal(judge.extractAssessment('The screenshot fails validation.'), 'fail');
    });

    it('returns null when no assessment signal present', () => {
      assert.equal(judge.extractAssessment('The layout looks acceptable.'), null);
    });
  });
});
