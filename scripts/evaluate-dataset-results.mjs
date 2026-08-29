#!/usr/bin/env node

import { readFileSync } from 'node:fs';

import {
  DatasetEvaluationMetricsError,
  computeCritiqueMetrics,
  computePreferenceMetrics,
  computeRegressionMetrics,
  validateDatasetEvaluation,
} from '#dataset-evaluation-metrics';

function usage() {
  return 'Usage: npm run evaluate:dataset -- --track <preference|regression|critique> --examples <examples.json> --results <results.json> [--split <name>]';
}

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

function readJson(path, subject) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new DatasetEvaluationMetricsError(`could not read ${subject}: ${detail}`);
  }
}

const track = option('--track');
const examplesPath = option('--examples');
const resultsPath = option('--results');
const split = option('--split');
const help = process.argv.includes('--help');
if (help || !track || !examplesPath || !resultsPath) {
  process.stderr.write(`${usage()}\n`);
  process.exit(help ? 0 : 2);
}

try {
  if (track !== 'preference' && track !== 'regression' && track !== 'critique') {
    throw new DatasetEvaluationMetricsError(`unsupported dataset track: ${track}`);
  }
  const evaluation = validateDatasetEvaluation(
    readJson(examplesPath, 'examples'),
    readJson(resultsPath, 'results'),
    track,
    split ?? undefined,
  );
  const metrics = track === 'preference'
    ? computePreferenceMetrics(evaluation.examples, evaluation.results)
    : track === 'regression'
      ? computeRegressionMetrics(evaluation.examples, evaluation.results)
      : computeCritiqueMetrics(evaluation.examples, evaluation.results);
  process.stdout.write(`${JSON.stringify({
    version: 2,
    track,
    split: evaluation.split,
    acquisition: evaluation.acquisition,
    metrics,
  }, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
