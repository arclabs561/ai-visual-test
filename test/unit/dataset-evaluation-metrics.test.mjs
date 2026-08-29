import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DatasetEvaluationMetricsError,
  computeCritiqueMetrics,
  computePreferenceMetrics,
  computeRegressionMetrics,
} from '../../src/dataset-evaluation-metrics.js';

test('preference metrics preserve vote distributions, abstentions, and dimensions', () => {
  const metrics = computePreferenceMetrics([
    { id: 'layout-clear', votes: { A: 30, B: 0 }, dimension: 'layout' },
    { id: 'layout-close', votes: { A: 16, B: 14 }, dimension: 'layout' },
    { id: 'type-tie', votes: { A: 10, B: 10, tie: 2 }, dimension: 'typography' },
    { id: 'abstain', votes: { A: 1, B: 4 }, dimension: 'typography' },
    { id: 'missing', votes: { A: 4, B: 1 } },
  ], [
    { id: 'layout-clear', prediction: 'A' },
    { id: 'layout-close', prediction: 'B' },
    { id: 'type-tie', prediction: 'tie' },
    { id: 'abstain', prediction: 'indeterminate' },
  ]);

  assert.deepEqual(metrics.majorityExactAgreement, { matches: 2, compared: 3, rate: 2 / 3 });
  assert.deepEqual(metrics.voteWeightedAgreement, { supportingVotes: 46, totalVotes: 82, rate: 46 / 82 });
  assert.equal(metrics.abstained, 1);
  assert.equal(metrics.excludedVoteDistribution, 0);
  assert.equal(metrics.abstentionRate, 1 / 4);
  assert.deepEqual(metrics.missingResults, ['missing']);
  assert.deepEqual(metrics.perDimension.layout.majorityExactAgreement, { matches: 1, compared: 2, rate: 0.5 });
  assert.deepEqual(metrics.perDimension.typography.voteWeightedAgreement, {
    supportingVotes: 2, totalVotes: 22, rate: 2 / 22,
  });
  assert.equal(metrics.perDimension.typography.abstentionRate, 0.5);
});

test('preference excludes derived labels from vote-weighted agreement', () => {
  const metrics = computePreferenceMetrics([
    {
      id: 'derived', votes: { A: 1, B: 0 },
      evidence: { voteDistribution: 'unavailable' },
    },
  ], [{ id: 'derived', prediction: 'A' }]);
  assert.deepEqual(metrics.majorityExactAgreement, { matches: 1, compared: 1, rate: 1 });
  assert.deepEqual(metrics.voteWeightedAgreement, { supportingVotes: 0, totalVotes: 0, rate: null });
  assert.equal(metrics.excludedVoteDistribution, 1);
});

test('preference rejects duplicate and unknown ids', () => {
  assert.throws(
    () => computePreferenceMetrics([{ id: 'same', votes: { A: 1, B: 0 } }, { id: 'same', votes: { A: 0, B: 1 } }], []),
    DatasetEvaluationMetricsError,
  );
  assert.throws(
    () => computePreferenceMetrics([{ id: 'known', votes: { A: 1, B: 0 } }], [{ id: 'unknown', prediction: 'A' }]),
    DatasetEvaluationMetricsError,
  );
  assert.throws(
    () => computePreferenceMetrics([{ id: 'unlabeled', votes: { A: 0, B: 0 } }], []),
    DatasetEvaluationMetricsError,
  );
});

test('regression metrics report changed/no-change confusion and difficulty slices only', () => {
  const metrics = computeRegressionMetrics([
    { id: 'easy-change', taskType: 'visual_diff', difficulty: 'easy' },
    { id: 'easy-control', taskType: 'no_diff', difficulty: 'easy' },
    { id: 'hard-change', taskType: 'visual_diff', difficulty: 'hard' },
    { id: 'hard-control', taskType: 'no_diff', difficulty: 'hard' },
    { id: 'missing', taskType: 'visual_diff' },
  ], [
    { id: 'easy-change', changed: true },
    { id: 'easy-control', changed: false },
    { id: 'hard-change', changed: false },
    { id: 'hard-control', changed: true },
  ]);

  assert.deepEqual(metrics.confusion, { truePositive: 1, falseNegative: 1, falsePositive: 1, trueNegative: 1 });
  assert.equal(metrics.recall, 0.5);
  assert.equal(metrics.specificity, 0.5);
  assert.equal(metrics.accuracy, 0.5);
  assert.equal(metrics.perDifficulty.easy.accuracy, 1);
  assert.equal(metrics.perDifficulty.hard.accuracy, 0);
  assert.deepEqual(metrics.missingResults, ['missing']);
});

test('critique metrics use matched numeric dimensions and nonzero human gaps only', () => {
  const metrics = computeCritiqueMetrics([
    { id: 'one', ratings: { aesthetics: 8, usability: 4 } },
    { id: 'two', ratings: { aesthetics: 6, usability: 4 } },
    { id: 'three', ratings: { aesthetics: 2, usability: 9 } },
    { id: 'missing', ratings: { aesthetics: 5 } },
  ], [
    { id: 'one', scores: { aesthetics: 7, usability: 7, extra: 1 } },
    { id: 'two', scores: { aesthetics: 5, usability: 3 } },
    { id: 'three', scores: { aesthetics: 3 } },
  ]);

  assert.deepEqual(metrics.missingResults, ['missing']);
  assert.deepEqual(metrics.perDimension.aesthetics, {
    matched: 3,
    absoluteError: 3,
    mae: 1,
    pairwiseConcordance: { concordant: 3, compared: 3, rate: 1 },
  });
  assert.deepEqual(metrics.perDimension.usability, {
    matched: 2,
    absoluteError: 4,
    mae: 2,
    pairwiseConcordance: { concordant: 0, compared: 0, rate: null },
  });
  assert.deepEqual(metrics.coverage, {
    matchedExamples: 3,
    referenceDimensions: 7,
    matchedDimensions: 5,
    rate: 5 / 7,
  });
  assert.deepEqual(metrics.unmatchedScores, [
    { id: 'one', missingScoreDimensions: [], unexpectedScoreDimensions: ['extra'] },
    { id: 'three', missingScoreDimensions: ['usability'], unexpectedScoreDimensions: [] },
  ]);
  assert.equal('extra' in metrics.perDimension, false);
});

test('preference reconciles AB/BA orders before scoring and reports conflicts', () => {
  const metrics = computePreferenceMetrics([
    { id: 'agree', votes: { A: 0, B: 3 } },
    { id: 'conflict', votes: { A: 3, B: 0 } },
    { id: 'incomplete', votes: { A: 0, B: 3 } },
  ], [
    { id: 'agree', orders: [{ order: 'AB', prediction: 'B' }, { order: 'BA', prediction: 'A' }] },
    { id: 'conflict', orders: [{ order: 'AB', prediction: 'A' }, { order: 'BA', prediction: 'A' }] },
    { id: 'incomplete', orders: [{ order: 'AB', prediction: 'B' }] },
  ]);
  assert.deepEqual(metrics.orderReconciliation, { single: 0, agree: 1, conflict: 1, incomplete: 1 });
  assert.deepEqual(metrics.majorityExactAgreement, { matches: 1, compared: 1, rate: 1 });
  assert.equal(metrics.abstained, 2);
});

test('empty or wholly mismatched critique scores are coverage gaps, not observations', () => {
  const metrics = computeCritiqueMetrics([
    { id: 'empty', ratings: { aesthetics: 3 } },
    { id: 'mismatch', ratings: { usability: 5 } },
  ], [
    { id: 'empty', scores: {} },
    { id: 'mismatch', scores: { aesthetics: 8 } },
  ]);
  assert.equal(metrics.observed, 0);
  assert.deepEqual(metrics.coverage, {
    matchedExamples: 0,
    referenceDimensions: 2,
    matchedDimensions: 0,
    rate: 0,
  });
  assert.deepEqual(metrics.unmatchedScores, [
    { id: 'empty', missingScoreDimensions: ['aesthetics'], unexpectedScoreDimensions: [] },
    { id: 'mismatch', missingScoreDimensions: ['usability'], unexpectedScoreDimensions: ['aesthetics'] },
  ]);
});

test('critique rejects malformed scores and duplicate or unknown result ids', () => {
  assert.throws(
    () => computeCritiqueMetrics([{ id: 'one', ratings: { aesthetic: 1 } }], [{ id: 'one', scores: { aesthetic: Number.NaN } }]),
    DatasetEvaluationMetricsError,
  );
  assert.throws(
    () => computeRegressionMetrics([{ id: 'one', taskType: 'visual_diff' }], [{ id: 'one', changed: true }, { id: 'one', changed: false }]),
    DatasetEvaluationMetricsError,
  );
});
