#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  PairwiseFixtureManifestError,
  computePairwiseFixtureMetrics,
  validatePairwiseFixtureManifest,
  verifyPairwiseFixtureAssets,
} from '#pairwise-fixture-metrics';
import { evaluatePairwiseCounterBalance } from '#position-counterbalance';

function usage() {
  return 'Usage: npm run evaluate:pairwise-fixtures -- --manifest <manifest.json> --results <recorded-orders.json>';
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
    throw new PairwiseFixtureManifestError(`could not read ${subject}: ${detail}`);
  }
}

function outcomes(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || value.version !== 1 || !Array.isArray(value.outcomes)) {
    throw new PairwiseFixtureManifestError('recorded orders must be { version: 1, outcomes: [] }');
  }
  return value.outcomes.map((outcome, index) => {
    if (outcome === null || typeof outcome !== 'object' || Array.isArray(outcome) ||
      typeof outcome.id !== 'string' || outcome.orders === null || typeof outcome.orders !== 'object' || Array.isArray(outcome.orders) ||
      !Object.hasOwn(outcome.orders, 'AB') || !Object.hasOwn(outcome.orders, 'BA')) {
      throw new PairwiseFixtureManifestError(`recorded orders outcome ${index} must have id and orders.AB/orders.BA`);
    }
    return outcome;
  });
}

const manifestPath = option('--manifest');
const resultsPath = option('--results');
if (!manifestPath || !resultsPath || process.argv.includes('--help')) {
  process.stderr.write(`${usage()}\n`);
  process.exit(process.argv.includes('--help') ? 0 : 2);
}

try {
  const manifest = validatePairwiseFixtureManifest(readJson(manifestPath, 'manifest'));
  verifyPairwiseFixtureAssets(manifest, dirname(resolve(manifestPath)));
  const recorded = outcomes(readJson(resultsPath, 'recorded orders'));
  const results = await Promise.all(recorded.map(async outcome => {
    const result = await evaluatePairwiseCounterBalance(
      async (_images, _prompt, context) => outcome.orders[context.comparisonOrder],
      'before', 'after', 'Recorded fixture outcome', {},
    );
    return { id: outcome.id, winner: result.winner, counterBalance: result.counterBalance };
  }));
  process.stdout.write(`${JSON.stringify(computePairwiseFixtureMetrics(manifest, results), null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
