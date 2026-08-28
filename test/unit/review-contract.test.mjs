import test from 'node:test';
import assert from 'node:assert/strict';
import * as Value from 'typebox/value';

import {
  COMPARISON_REVIEW_SCHEMA,
  ReviewContractError,
  SCALAR_REVIEW_SCHEMA,
  buildRepairInstruction,
  parseReviewOutcome
} from '#review-contract';
import { openAIResponseFormat, resolveStructuredOutput } from '../../src/structured-output.mjs';

test('validates a canonical scalar review', () => {
  const parsed = parseReviewOutcome({
    kind: 'scalar', score: 8, assessment: 'pass', reasoning: 'Clear hierarchy',
    issues: ['Muted secondary text'], recommendations: ['Increase contrast'], strengths: ['Clear CTA']
  });
  assert.equal(parsed.format, 'structured');
  assert.equal(parsed.outcome.score, 8);
});

test('TypeBox schemas enforce canonical bounds and reject unknown keys', () => {
  const scalar = {
    kind: 'scalar', score: 8, assessment: 'pass', reasoning: 'Clear hierarchy',
    issues: [], recommendations: [], strengths: []
  };
  assert.equal(Value.Check(SCALAR_REVIEW_SCHEMA, scalar), true);
  assert.equal(Value.Check(SCALAR_REVIEW_SCHEMA, { ...scalar, unexpected: true }), false);
  assert.equal(Value.Check(COMPARISON_REVIEW_SCHEMA, {
    kind: 'comparison', winner: 'indeterminate', confidence: 0,
    reasoning: 'Orders conflict', differences: [], scores: { A: 8, B: 8 }
  }), true);
});

test('structured validation keeps stable scalar diagnostic codes', () => {
  assert.throws(
    () => parseReviewOutcome({
      score: 11, assessment: null, reasoning: 1,
      issues: ['valid', 2], recommendations: null, strengths: 'none'
    }, { allowLegacy: false }),
    error => {
      assert.ok(error instanceof ReviewContractError);
      assert.deepEqual(error.diagnostics, [
        'invalid_score', 'missing_assessment', 'missing_reasoning',
        'invalid_issues', 'invalid_recommendations', 'invalid_strengths'
      ]);
      return true;
    }
  );
});

test('parses realistic legacy sections without mixing their list items', () => {
  const parsed = parseReviewOutcome(`
## Overall Score
7/10
## Findings
1) **Contrast:** body text is too dim
2) **Layout:** CTA overlaps footer
## Recommendations
- Increase body-text contrast
## Strengths
- Clear visual hierarchy
Assessment: needs-improvement
## Reasoning
The primary action remains discoverable.
`);

  assert.equal(parsed.format, 'legacy-text');
  assert.deepEqual(parsed.outcome.issues, [
    'Contrast: body text is too dim',
    'Layout: CTA overlaps footer'
  ]);
  assert.deepEqual(parsed.outcome.recommendations, ['Increase body-text contrast']);
  assert.deepEqual(parsed.outcome.strengths, ['Clear visual hierarchy']);
  assert.equal(parsed.outcome.assessment, 'needs-improvement');
  assert.equal(parsed.outcome.reasoning, 'The primary action remains discoverable.');
});

test('comparison output is structured and lossless', () => {
  const parsed = parseReviewOutcome(JSON.stringify({
    kind: 'comparison', winner: 'B', confidence: 0.86,
    reasoning: 'B fixes the overlap', differences: ['Footer no longer overlaps CTA'],
    scores: { A: 5, B: 8 }
  }), { mode: 'comparison' });

  assert.deepEqual(parsed.outcome.scores, { A: 5, B: 8 });
  assert.equal(parsed.outcome.winner, 'B');
});

test('ambiguous comparison text is rejected for repair', () => {
  assert.throws(
    () => parseReviewOutcome('B looks better', { mode: 'comparison' }),
    ReviewContractError
  );
});

test('repair prompt contains diagnostics but never provider output', () => {
  const repair = buildRepairInstruction(['invalid_score', 'missing_reasoning']);
  assert.match(repair, /invalid_score/);
  assert.doesNotMatch(repair, /secret provider output/);
});

test('negotiates strict, best-effort, and compatibility output modes', () => {
  const openai = resolveStructuredOutput({ provider: 'openai', model: 'gpt-4o', reviewMode: 'scalar' });
  assert.equal(openAIResponseFormat(openai).json_schema.strict, true);

  const groq = resolveStructuredOutput({ provider: 'groq', model: 'meta-llama/llama-4-scout-17b-16e-instruct' });
  assert.equal(openAIResponseFormat(groq).json_schema.strict, false);
  assert.equal(groq.diagnostic, 'best_effort_json_schema');

  const override = resolveStructuredOutput({ provider: 'openai', model: 'custom-vision-model' });
  assert.deepEqual(openAIResponseFormat(override), { type: 'json_object' });

  const claude = resolveStructuredOutput({ provider: 'claude', model: 'claude-sonnet-4' });
  assert.equal(claude.mode, 'prompt-only');
});
