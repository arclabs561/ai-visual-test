import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PerceptionContractError,
  parseMergeClusters,
  parsePerceptionFinding,
  parseVerifierVerdict,
} from '../../src/perception/contracts.js';
import { mergeFindings } from '../../src/perception/aggregate.js';
import { aggregate } from '../../src/perception/aggregate.js';

test('perception contracts parse only the requested mode vocabulary', () => {
  const finding = parsePerceptionFinding('problem', {
    headline: 'The footer overlaps', category: 'major', target: 'weather footer',
    why: 'The badge collides with temperature text.', suggestion: 'Add vertical spacing.', confidence: 0.8,
  });
  assert.equal(finding.category, 'major');
  assert.throws(
    () => parsePerceptionFinding('problem', { ...finding, category: 'GAP' }),
    (error) => error instanceof PerceptionContractError && error.diagnostics.includes('invalid_finding'),
  );
});

test('perception contracts accept fenced JSON and reject incomplete verifier verdicts with stable diagnostics', () => {
  assert.deepEqual(parseVerifierVerdict('```json\n{"refuted":false,"reason":"The label is visibly clipped."}\n```'), {
    refuted: false,
    reason: 'The label is visibly clipped.',
  });
  assert.throws(
    () => parseVerifierVerdict({ refuted: 'false' }),
    (error) => error instanceof PerceptionContractError && error.diagnostics.includes('invalid_refuted') && error.diagnostics.includes('missing_reason'),
  );
});

test('merge cluster parser rejects empty, fractional, NaN, and non-covering plans', () => {
  for (const clusters of [[[0], []], [[0.5], [1]], [[Number.NaN], [1]], [[0]]]) {
    assert.throws(
      () => parseMergeClusters({ clusters }, 2),
      (error) => error instanceof PerceptionContractError,
    );
  }
});

test('mergeFindings treats unsafe cluster plans as identity fallbacks', async () => {
  const groups = [
    { mode: 'problem', category: 'major', target: 'footer', mass: 1, count: 1, heads: ['overlap'], sugg: ['space'], roles: new Set(['operator']), judges: new Set(['a']), score: 1 },
    { mode: 'problem', category: 'minor', target: 'clock', mass: 1, count: 1, heads: ['small'], sugg: ['size'], roles: new Set(['guest']), judges: new Set(['b']), score: 1 },
  ];
  for (const clusters of [[[0], []], [[0.5], [1]], [[Number.NaN], [1]]]) {
    const merged = await mergeFindings(groups, { complete: async () => ({ clusters }) });
    assert.equal(merged, groups, 'invalid model partition must preserve every original group by identity');
  }
});

test('aggregate rejects non-finite or out-of-range numeric evidence', () => {
  const base = { mode: 'problem', category: 'major', target: 'footer', headline: 'overlap', suggestion: 'space' };
  for (const sample of [
    { ...base, weight: Number.NaN },
    { ...base, weight: -1 },
    { ...base, confidence: Number.POSITIVE_INFINITY },
    { ...base, confidence: 1.1 },
  ]) {
    assert.throws(() => aggregate([sample], 'problem'), RangeError);
  }
});
