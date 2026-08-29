/**
 * Deterministic, track-specific metrics for externally sourced UI datasets.
 *
 * These functions intentionally do not construct a blended quality score.
 * Preference, regression, and critique data answer different questions and
 * must remain separately reportable.
 */

import { parseDatasetAcquisitionRecord, type DatasetAcquisitionRecord } from './dataset-adapters/acquisition.js';
import { DATASET_REGISTRY } from './dataset-adapters/registry.js';
import { assertGroupDisjointSplits, type DatasetSplit, type GroupedDatasetExample } from './dataset-adapters/splits.js';

export type PreferencePrediction = 'A' | 'B' | 'tie' | 'indeterminate';
export type PreferenceLabel = Exclude<PreferencePrediction, 'indeterminate'>;
export type PreferenceOrder = 'AB' | 'BA';

export interface PreferenceExample {
  id: string;
  votes: { A: number; B: number; tie?: number };
  dimension?: string;
  evidence?: { voteDistribution?: 'available' | 'unavailable' };
}

export interface PreferenceResult {
  id: string;
  /** A pre-reconciled canonical result, retained for compatibility. */
  prediction?: PreferencePrediction;
  /** Raw model choices in both rendered orders, reconciled before scoring. */
  orders?: readonly PreferenceOrderResult[];
}

export interface PreferenceOrderResult {
  order: PreferenceOrder;
  prediction: PreferencePrediction;
}

export type PreferenceReconciliationStatus = 'single' | 'agree' | 'conflict' | 'incomplete';

export interface ReconciledPreferenceResult {
  prediction: PreferencePrediction;
  status: PreferenceReconciliationStatus;
}

export interface PreferenceAgreement {
  matches: number;
  compared: number;
  rate: number | null;
}

export interface PreferenceMetrics {
  totalExamples: number;
  observed: number;
  abstained: number;
  majorityExactAgreement: PreferenceAgreement;
  voteWeightedAgreement: { supportingVotes: number; totalVotes: number; rate: number | null };
  excludedVoteDistribution: number;
  abstentionRate: number | null;
  orderReconciliation: Record<PreferenceReconciliationStatus, number>;
  perDimension: Record<string, PreferenceMetricsSlice>;
  missingResults: string[];
}

export interface PreferenceMetricsSlice {
  examples: number;
  observed: number;
  abstained: number;
  majorityExactAgreement: PreferenceAgreement;
  voteWeightedAgreement: { supportingVotes: number; totalVotes: number; rate: number | null };
  excludedVoteDistribution: number;
  abstentionRate: number | null;
}

export interface RegressionExample {
  id: string;
  taskType: 'visual_diff' | 'no_diff';
  difficulty?: string;
}

export interface RegressionResult {
  id: string;
  changed: boolean;
}

export interface RegressionMetrics {
  totalExamples: number;
  observed: number;
  confusion: { truePositive: number; falseNegative: number; falsePositive: number; trueNegative: number };
  recall: number | null;
  specificity: number | null;
  accuracy: number | null;
  perDifficulty: Record<string, RegressionMetricsSlice>;
  missingResults: string[];
}

export interface RegressionMetricsSlice {
  examples: number;
  observed: number;
  confusion: { truePositive: number; falseNegative: number; falsePositive: number; trueNegative: number };
  recall: number | null;
  specificity: number | null;
  accuracy: number | null;
}

export interface CritiqueExample {
  id: string;
  ratings: Readonly<Record<string, number>>;
}

export interface CritiqueResult {
  id: string;
  scores: Readonly<Record<string, number>>;
}

export interface CritiqueDimensionMetrics {
  matched: number;
  absoluteError: number;
  mae: number | null;
  pairwiseConcordance: { concordant: number; compared: number; rate: number | null };
}

export interface CritiqueMetrics {
  totalExamples: number;
  observed: number;
  coverage: {
    matchedExamples: number;
    referenceDimensions: number;
    matchedDimensions: number;
    rate: number | null;
  };
  perDimension: Record<string, CritiqueDimensionMetrics>;
  missingResults: string[];
  unmatchedScores: Array<{
    id: string;
    missingScoreDimensions: string[];
    unexpectedScoreDimensions: string[];
  }>;
}

export class DatasetEvaluationMetricsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatasetEvaluationMetricsError';
  }
}

export interface DatasetEvaluationDocument<T> {
  version: 2;
  track: 'preference' | 'regression' | 'critique';
  acquisition: DatasetAcquisitionRecord;
  splits: readonly DatasetSplit<T & GroupedDatasetExample>[];
}

export interface DatasetEvaluationResultsDocument<T> {
  version: 2;
  track: 'preference' | 'regression' | 'critique';
  acquisition: DatasetAcquisitionRecord;
  split: string;
  results: readonly T[];
}

export interface ValidatedDatasetEvaluation<TExample, TResult> {
  acquisition: DatasetAcquisitionRecord;
  split: string;
  examples: readonly TExample[];
  results: readonly TResult[];
}

function finiteNumber(value: unknown, subject: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new DatasetEvaluationMetricsError(`${subject} must be a finite number`);
  }
  return value;
}

function nonNegativeInteger(value: unknown, subject: string): number {
  const number = finiteNumber(value, subject);
  if (!Number.isInteger(number) || number < 0) {
    throw new DatasetEvaluationMetricsError(`${subject} must be a non-negative integer`);
  }
  return number;
}

function nonEmptyString(value: unknown, subject: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new DatasetEvaluationMetricsError(`${subject} must be a non-empty string`);
  }
  return value;
}

function rate(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

function unknownRecord(value: unknown, subject: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new DatasetEvaluationMetricsError(`${subject} must be an object`);
  }
  return value as Record<string, unknown>;
}

function acquisitionIdentity(acquisition: DatasetAcquisitionRecord): string {
  const artifacts = [...acquisition.artifacts]
    .map(artifact => `${artifact.path}\u0000${artifact.sha256}\u0000${artifact.bytes}`)
    .sort();
  return JSON.stringify({
    key: acquisition.key,
    provenance: acquisition.provenance,
    retrievedAt: acquisition.retrievedAt,
    normalizerVersion: acquisition.normalizerVersion,
    status: acquisition.status,
    blockedReason: acquisition.status === 'blocked' ? acquisition.blockedReason : null,
    artifacts,
  });
}

/**
 * Validate evaluator documents before a metric is computed. Both documents
 * must name the same immutable acquisition and the selected named split must
 * have source groups disjoint from every other supplied split.
 */
export function validateDatasetEvaluation<TExample, TResult>(
  examplesValue: unknown,
  resultsValue: unknown,
  expectedTrack: DatasetEvaluationDocument<TExample>['track'],
  requestedSplit?: string,
): ValidatedDatasetEvaluation<TExample, TResult> {
  const examplesDocument = unknownRecord(examplesValue, 'examples document');
  const resultsDocument = unknownRecord(resultsValue, 'results document');
  if (examplesDocument.version !== 2 || examplesDocument.track !== expectedTrack || !Array.isArray(examplesDocument.splits)) {
    throw new DatasetEvaluationMetricsError(
      `examples document must be { version: 2, track: ${JSON.stringify(expectedTrack)}, acquisition: {}, splits: [] }`,
    );
  }
  if (resultsDocument.version !== 2 || resultsDocument.track !== expectedTrack || !Array.isArray(resultsDocument.results)) {
    throw new DatasetEvaluationMetricsError(
      `results document must be { version: 2, track: ${JSON.stringify(expectedTrack)}, acquisition: {}, split: string, results: [] }`,
    );
  }
  const examplesAcquisition = parseDatasetAcquisitionRecord(examplesDocument.acquisition);
  const resultsAcquisition = parseDatasetAcquisitionRecord(resultsDocument.acquisition);
  if (examplesAcquisition.key !== resultsAcquisition.key || acquisitionIdentity(examplesAcquisition) !== acquisitionIdentity(resultsAcquisition)) {
    throw new DatasetEvaluationMetricsError('examples and results must retain the same immutable acquisition identity');
  }
  if (DATASET_REGISTRY[examplesAcquisition.key].track !== expectedTrack) {
    throw new DatasetEvaluationMetricsError(`acquisition ${examplesAcquisition.key} does not supply the ${expectedTrack} track`);
  }
  const split = nonEmptyString(requestedSplit ?? resultsDocument.split, 'evaluation split');
  if (requestedSplit !== undefined && resultsDocument.split !== split) {
    throw new DatasetEvaluationMetricsError(`results document split must be ${split}`);
  }
  const splits = examplesDocument.splits as DatasetSplit<TExample & GroupedDatasetExample>[];
  if (splits.length === 0) throw new DatasetEvaluationMetricsError('examples document.splits must not be empty');
  try {
    assertGroupDisjointSplits(splits);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new DatasetEvaluationMetricsError(`invalid group-disjoint splits: ${detail}`);
  }
  const selected = splits.find(candidate => candidate.name === split);
  if (!selected) throw new DatasetEvaluationMetricsError(`examples document has no ${split} split`);
  return {
    acquisition: examplesAcquisition,
    split,
    examples: selected.examples,
    results: resultsDocument.results as TResult[],
  };
}

function assertUniqueExamples<T extends { id: string }>(examples: readonly T[], track: string): Set<string> {
  const ids = new Set<string>();
  for (const [index, example] of examples.entries()) {
    const id = nonEmptyString(example.id, `${track} example ${index}.id`);
    if (ids.has(id)) throw new DatasetEvaluationMetricsError(`duplicate ${track} example id: ${id}`);
    ids.add(id);
  }
  return ids;
}

function assertKnownResults<T extends { id: string }>(
  results: readonly T[],
  ids: ReadonlySet<string>,
  track: string,
): Map<string, T> {
  const byId = new Map<string, T>();
  for (const [index, result] of results.entries()) {
    const id = nonEmptyString(result.id, `${track} result ${index}.id`);
    if (!ids.has(id)) throw new DatasetEvaluationMetricsError(`unknown ${track} result id: ${id}`);
    if (byId.has(id)) throw new DatasetEvaluationMetricsError(`duplicate ${track} result id: ${id}`);
    byId.set(id, result);
  }
  return byId;
}

function preferenceLabel(example: PreferenceExample): PreferenceLabel {
  const votes = [
    ['A', example.votes.A] as const,
    ['B', example.votes.B] as const,
    ['tie', example.votes.tie ?? 0] as const,
  ];
  const maximum = Math.max(...votes.map(([, count]) => count));
  const winners = votes.filter(([, count]) => count === maximum);
  return winners.length === 1 ? winners[0]![0] : 'tie';
}

function voteForPrediction(example: PreferenceExample, prediction: PreferenceLabel): number {
  if (prediction === 'A') return example.votes.A;
  if (prediction === 'B') return example.votes.B;
  return example.votes.tie ?? 0;
}

function preferenceSlice(): PreferenceMetricsSlice {
  return {
    examples: 0,
    observed: 0,
    abstained: 0,
    majorityExactAgreement: { matches: 0, compared: 0, rate: null },
    voteWeightedAgreement: { supportingVotes: 0, totalVotes: 0, rate: null },
    excludedVoteDistribution: 0,
    abstentionRate: null,
  };
}

function finishPreferenceSlice(slice: PreferenceMetricsSlice): void {
  slice.majorityExactAgreement.rate = rate(
    slice.majorityExactAgreement.matches,
    slice.majorityExactAgreement.compared,
  );
  slice.voteWeightedAgreement.rate = rate(
    slice.voteWeightedAgreement.supportingVotes,
    slice.voteWeightedAgreement.totalVotes,
  );
  slice.abstentionRate = rate(slice.abstained, slice.observed);
}

function preferencePrediction(value: unknown, subject: string): PreferencePrediction {
  if (value !== 'A' && value !== 'B' && value !== 'tie' && value !== 'indeterminate') {
    throw new DatasetEvaluationMetricsError(`${subject} must be A, B, tie, or indeterminate`);
  }
  return value;
}

function canonicalizeOrderPrediction(order: PreferenceOrder, prediction: PreferencePrediction): PreferencePrediction {
  if (order === 'AB' || prediction === 'tie' || prediction === 'indeterminate') return prediction;
  return prediction === 'A' ? 'B' : 'A';
}

/**
 * Reconcile recorded A/B and B/A model choices into the source row's canonical
 * A/B identity. Disagreement is indeterminate; a missing order is incomplete.
 */
export function reconcilePreferenceResult(result: PreferenceResult): ReconciledPreferenceResult {
  const hasPrediction = result.prediction !== undefined;
  const hasOrders = result.orders !== undefined;
  if (!hasPrediction && !hasOrders) {
    throw new DatasetEvaluationMetricsError(`preference result ${result.id} needs prediction or orders`);
  }
  if (!hasOrders) return { prediction: preferencePrediction(result.prediction, `preference result ${result.id}.prediction`), status: 'single' };
  if (!Array.isArray(result.orders)) {
    throw new DatasetEvaluationMetricsError(`preference result ${result.id}.orders must be an array`);
  }
  const canonical = new Map<PreferenceOrder, PreferencePrediction>();
  for (const [index, entry] of result.orders.entries()) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new DatasetEvaluationMetricsError(`preference result ${result.id}.orders[${index}] must be an object`);
    }
    if (entry.order !== 'AB' && entry.order !== 'BA') {
      throw new DatasetEvaluationMetricsError(`preference result ${result.id}.orders[${index}].order must be AB or BA`);
    }
    if (canonical.has(entry.order)) {
      throw new DatasetEvaluationMetricsError(`preference result ${result.id} has duplicate ${entry.order} order`);
    }
    canonical.set(entry.order, canonicalizeOrderPrediction(
      entry.order,
      preferencePrediction(entry.prediction, `preference result ${result.id}.orders[${index}].prediction`),
    ));
  }
  const ab = canonical.get('AB');
  const ba = canonical.get('BA');
  const reconciled: ReconciledPreferenceResult = ab === undefined || ba === undefined
    ? { prediction: 'indeterminate', status: 'incomplete' }
    : ab === ba
      ? { prediction: ab, status: 'agree' }
      : { prediction: 'indeterminate', status: 'conflict' };
  if (hasPrediction) {
    const declared = preferencePrediction(result.prediction, `preference result ${result.id}.prediction`);
    if (declared !== reconciled.prediction) {
      throw new DatasetEvaluationMetricsError(`preference result ${result.id}.prediction disagrees with its order records`);
    }
  }
  return reconciled;
}

/**
 * Measure model choices against recorded human vote distributions. A model
 * indeterminate result is an abstention, excluded from agreement denominators.
 */
export function computePreferenceMetrics(
  examples: readonly PreferenceExample[],
  results: readonly PreferenceResult[],
): PreferenceMetrics {
  const ids = assertUniqueExamples(examples, 'preference');
  const resultById = assertKnownResults(results, ids, 'preference');
  const overall = preferenceSlice();
  const perDimension: Record<string, PreferenceMetricsSlice> = {};
  const missingResults: string[] = [];
  const orderReconciliation: Record<PreferenceReconciliationStatus, number> = {
    single: 0, agree: 0, conflict: 0, incomplete: 0,
  };

  for (const [index, example] of examples.entries()) {
    if (example.votes === null || typeof example.votes !== 'object' || Array.isArray(example.votes)) {
      throw new DatasetEvaluationMetricsError(`preference example ${index}.votes must be an object`);
    }
    const votesA = nonNegativeInteger(example.votes.A, `preference example ${index}.votes.A`);
    const votesB = nonNegativeInteger(example.votes.B, `preference example ${index}.votes.B`);
    const votesTie = example.votes.tie === undefined
      ? 0
      : nonNegativeInteger(example.votes.tie, `preference example ${index}.votes.tie`);
    if (votesA + votesB + votesTie === 0) {
      throw new DatasetEvaluationMetricsError(`preference example ${index} must have at least one human vote`);
    }
    const normalized = { ...example, votes: { A: votesA, B: votesB, tie: votesTie } };
    const dimension = example.dimension === undefined
      ? 'unspecified'
      : nonEmptyString(example.dimension, `preference example ${index}.dimension`);
    const slice = perDimension[dimension] ?? (perDimension[dimension] = preferenceSlice());
    overall.examples++;
    slice.examples++;
    const result = resultById.get(example.id);
    if (!result) {
      missingResults.push(example.id);
      continue;
    }
    const reconciled = reconcilePreferenceResult(result);
    orderReconciliation[reconciled.status]++;
    overall.observed++;
    slice.observed++;
    if (reconciled.prediction === 'indeterminate') {
      overall.abstained++;
      slice.abstained++;
      continue;
    }
    const label = preferenceLabel(normalized);
    const totalVotes = votesA + votesB + votesTie;
    const supportingVotes = voteForPrediction(normalized, reconciled.prediction);
    for (const current of [overall, slice]) {
      current.majorityExactAgreement.compared++;
      if (example.evidence?.voteDistribution === 'unavailable') {
        current.excludedVoteDistribution++;
      } else {
        current.voteWeightedAgreement.supportingVotes += supportingVotes;
        current.voteWeightedAgreement.totalVotes += totalVotes;
      }
      if (reconciled.prediction === label) current.majorityExactAgreement.matches++;
    }
  }

  finishPreferenceSlice(overall);
  for (const slice of Object.values(perDimension)) finishPreferenceSlice(slice);
  return {
    totalExamples: overall.examples,
    observed: overall.observed,
    abstained: overall.abstained,
    majorityExactAgreement: overall.majorityExactAgreement,
    voteWeightedAgreement: overall.voteWeightedAgreement,
    excludedVoteDistribution: overall.excludedVoteDistribution,
    abstentionRate: overall.abstentionRate,
    orderReconciliation,
    perDimension,
    missingResults,
  };
}

function regressionSlice(): RegressionMetricsSlice {
  return {
    examples: 0,
    observed: 0,
    confusion: { truePositive: 0, falseNegative: 0, falsePositive: 0, trueNegative: 0 },
    recall: null,
    specificity: null,
    accuracy: null,
  };
}

function addRegressionOutcome(slice: RegressionMetricsSlice, actual: boolean, predicted: boolean): void {
  if (actual && predicted) slice.confusion.truePositive++;
  else if (actual) slice.confusion.falseNegative++;
  else if (predicted) slice.confusion.falsePositive++;
  else slice.confusion.trueNegative++;
}

function finishRegressionSlice(slice: RegressionMetricsSlice): void {
  const { truePositive, falseNegative, falsePositive, trueNegative } = slice.confusion;
  slice.recall = rate(truePositive, truePositive + falseNegative);
  slice.specificity = rate(trueNegative, trueNegative + falsePositive);
  slice.accuracy = rate(truePositive + trueNegative, slice.observed);
}

/** Measure changed/no-change detection only; descriptions and localizations are deliberately out of scope. */
export function computeRegressionMetrics(
  examples: readonly RegressionExample[],
  results: readonly RegressionResult[],
): RegressionMetrics {
  const ids = assertUniqueExamples(examples, 'regression');
  const resultById = assertKnownResults(results, ids, 'regression');
  const overall = regressionSlice();
  const perDifficulty: Record<string, RegressionMetricsSlice> = {};
  const missingResults: string[] = [];

  for (const [index, example] of examples.entries()) {
    if (example.taskType !== 'visual_diff' && example.taskType !== 'no_diff') {
      throw new DatasetEvaluationMetricsError(`regression example ${index}.taskType must be visual_diff or no_diff`);
    }
    const difficulty = example.difficulty === undefined
      ? 'unspecified'
      : nonEmptyString(example.difficulty, `regression example ${index}.difficulty`);
    const slice = perDifficulty[difficulty] ?? (perDifficulty[difficulty] = regressionSlice());
    overall.examples++;
    slice.examples++;
    const result = resultById.get(example.id);
    if (!result) {
      missingResults.push(example.id);
      continue;
    }
    if (typeof result.changed !== 'boolean') {
      throw new DatasetEvaluationMetricsError(`regression result ${example.id}.changed must be boolean`);
    }
    overall.observed++;
    slice.observed++;
    const actual = example.taskType === 'visual_diff';
    addRegressionOutcome(overall, actual, result.changed);
    addRegressionOutcome(slice, actual, result.changed);
  }

  finishRegressionSlice(overall);
  for (const slice of Object.values(perDifficulty)) finishRegressionSlice(slice);
  return {
    totalExamples: overall.examples,
    observed: overall.observed,
    confusion: overall.confusion,
    recall: overall.recall,
    specificity: overall.specificity,
    accuracy: overall.accuracy,
    perDifficulty,
    missingResults,
  };
}

interface CritiqueAccumulator {
  matched: Array<{ reference: number; predicted: number }>;
  absoluteError: number;
}

/**
 * Compare numeric screen-level ratings only. Natural-language critiques require
 * a separate human or reference evaluator and are intentionally not scored.
 */
export function computeCritiqueMetrics(
  examples: readonly CritiqueExample[],
  results: readonly CritiqueResult[],
): CritiqueMetrics {
  const ids = assertUniqueExamples(examples, 'critique');
  const resultById = assertKnownResults(results, ids, 'critique');
  const byDimension = new Map<string, CritiqueAccumulator>();
  const missingResults: string[] = [];
  const unmatchedScores: CritiqueMetrics['unmatchedScores'] = [];
  let observed = 0;
  let referenceDimensions = 0;
  let matchedDimensions = 0;

  for (const [index, example] of examples.entries()) {
    if (example.ratings === null || typeof example.ratings !== 'object' || Array.isArray(example.ratings)) {
      throw new DatasetEvaluationMetricsError(`critique example ${index}.ratings must be an object`);
    }
    const ratingEntries = Object.entries(example.ratings);
    if (ratingEntries.length === 0) {
      throw new DatasetEvaluationMetricsError(`critique example ${index}.ratings must not be empty`);
    }
    for (const [dimension, reference] of ratingEntries) {
      nonEmptyString(dimension, `critique example ${index}.ratings dimension`);
      finiteNumber(reference, `critique example ${index}.ratings.${dimension}`);
    }
    referenceDimensions += ratingEntries.length;
    const result = resultById.get(example.id);
    if (!result) {
      missingResults.push(example.id);
      continue;
    }
    if (result.scores === null || typeof result.scores !== 'object' || Array.isArray(result.scores)) {
      throw new DatasetEvaluationMetricsError(`critique result ${example.id}.scores must be an object`);
    }
    const scoreEntries = Object.entries(result.scores);
    for (const [dimension, value] of scoreEntries) {
      nonEmptyString(dimension, `critique result ${example.id}.scores dimension`);
      finiteNumber(value, `critique result ${example.id}.scores.${dimension}`);
    }
    const missingScoreDimensions = ratingEntries
      .map(([dimension]) => dimension)
      .filter(dimension => result.scores[dimension] === undefined);
    const unexpectedScoreDimensions = scoreEntries
      .map(([dimension]) => dimension)
      .filter(dimension => example.ratings[dimension] === undefined);
    let exampleMatched = 0;
    for (const [dimension, reference] of ratingEntries) {
      const referenceValue = reference as number;
      const predicted = result.scores[dimension];
      if (predicted === undefined) continue;
      const predictedValue = predicted as number;
      const accumulator = byDimension.get(dimension) ?? { matched: [], absoluteError: 0 };
      accumulator.matched.push({ reference: referenceValue, predicted: predictedValue });
      accumulator.absoluteError += Math.abs(referenceValue - predictedValue);
      byDimension.set(dimension, accumulator);
      exampleMatched++;
    }
    matchedDimensions += exampleMatched;
    if (exampleMatched > 0) observed++;
    if (missingScoreDimensions.length > 0 || unexpectedScoreDimensions.length > 0) {
      unmatchedScores.push({ id: example.id, missingScoreDimensions, unexpectedScoreDimensions });
    }
  }

  const perDimension: Record<string, CritiqueDimensionMetrics> = {};
  for (const [dimension, accumulator] of byDimension) {
    let compared = 0;
    let concordant = 0;
    for (let left = 0; left < accumulator.matched.length; left++) {
      for (let right = left + 1; right < accumulator.matched.length; right++) {
        const a = accumulator.matched[left]!;
        const b = accumulator.matched[right]!;
        const referenceGap = a.reference - b.reference;
        if (referenceGap === 0) continue;
        compared++;
        const predictedGap = a.predicted - b.predicted;
        if ((referenceGap > 0 && predictedGap > 0) || (referenceGap < 0 && predictedGap < 0)) {
          concordant++;
        }
      }
    }
    perDimension[dimension] = {
      matched: accumulator.matched.length,
      absoluteError: accumulator.absoluteError,
      mae: rate(accumulator.absoluteError, accumulator.matched.length),
      pairwiseConcordance: { concordant, compared, rate: rate(concordant, compared) },
    };
  }

  return {
    totalExamples: examples.length,
    observed,
    coverage: {
      matchedExamples: observed,
      referenceDimensions,
      matchedDimensions,
      rate: rate(matchedDimensions, referenceDimensions),
    },
    perDimension,
    missingResults,
    unmatchedScores,
  };
}
