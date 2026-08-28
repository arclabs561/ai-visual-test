import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  PairwiseFixtureManifestError,
  computePairwiseFixtureMetrics,
  validatePairwiseFixtureManifest,
  verifyPairwiseFixtureAssets,
} from '#pairwise-fixture-metrics';
import { evaluatePairwiseCounterBalance } from '../../src/position-counterbalance.mjs';

const sha256 = value => createHash('sha256').update(value).digest('hex');
const comparison = (winner, scores) => ({
  enabled: true, kind: 'comparison', winner, scores,
  comparisonConfidence: 0.8, differences: [], issues: [], reasoning: winner,
});

function fixture(id, reviews) {
  return {
    id,
    prompt: 'Choose the clearer interface.',
    rubricVersion: 'pairwise-v1',
    before: { path: `${id}-before.png`, sha256: sha256(`${id}-before`) },
    after: { path: `${id}-after.png`, sha256: sha256(`${id}-after`) },
    capture: {
      viewport: { width: 1280, height: 720 }, browser: 'chromium', deviceScaleFactor: 1,
      colorScheme: 'light', fullPage: false, stable: true, animations: 'disabled', caret: 'hide',
    },
    humanReviews: reviews.map(review => ({ rationale: `${review.winner} is clearer`, ...review })),
  };
}

test('measures consensus labels while abstaining and excluding non-consensus fixtures', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pairwise-fixtures-'));
  try {
    const manifest = {
      version: 1,
      fixtures: [
        fixture('a-wins', [{ reviewer: 'one', winner: 'A' }, { reviewer: 'two', winner: 'A' }]),
        fixture('b-wins', [{ reviewer: 'one', winner: 'B' }, { reviewer: 'two', winner: 'B' }]),
        fixture('tie', [{ reviewer: 'one', winner: 'tie' }, { reviewer: 'two', winner: 'tie' }]),
        fixture('model-conflict', [{ reviewer: 'one', winner: 'B' }, { reviewer: 'two', winner: 'B' }]),
        fixture('human-conflict', [{ reviewer: 'one', winner: 'A' }, { reviewer: 'two', winner: 'B' }]),
        fixture('too-few', [{ reviewer: 'one', winner: 'B' }]),
      ],
    };
    for (const entry of manifest.fixtures) {
      writeFileSync(join(dir, entry.before.path), `${entry.id}-before`);
      writeFileSync(join(dir, entry.after.path), `${entry.id}-after`);
    }
    const validated = validatePairwiseFixtureManifest(manifest);
    verifyPairwiseFixtureAssets(validated, dir);

    const runCounterBalance = async (id, ab, ba) => {
      const result = await evaluatePairwiseCounterBalance(
        async (_images, _prompt, context) => context.comparisonOrder === 'AB' ? ab : ba,
        'before.png', 'after.png', 'compare', {},
      );
      return { id, winner: result.winner, counterBalance: result.counterBalance };
    };
    const results = [
      await runCounterBalance('a-wins', comparison('A', { A: 8, B: 4 }), comparison('B', { A: 4, B: 8 })),
      await runCounterBalance('b-wins', comparison('B', { A: 4, B: 8 }), comparison('A', { A: 8, B: 4 })),
      await runCounterBalance('tie', comparison('tie', { A: 7, B: 7 }), comparison('tie', { A: 7, B: 7 })),
      await runCounterBalance('model-conflict', comparison('B', { A: 4, B: 8 }), comparison('B', { A: 4, B: 8 })),
    ];
    const metrics = computePairwiseFixtureMetrics(manifest, results);

    assert.equal(metrics.labeled, 4);
    assert.equal(metrics.decided, 3);
    assert.equal(metrics.abstained, 1);
    assert.deepEqual(metrics.exactAgreement, { matches: 3, compared: 3, rate: 1 });
    assert.equal(metrics.rates.abstention, 1 / 4);
    assert.equal(metrics.rates.conflict, 1 / 4);
    assert.equal(metrics.rates.incomplete, 0);
    assert.deepEqual(metrics.confusion, {
      A: { A: 1, B: 0, tie: 0 },
      B: { A: 0, B: 1, tie: 0 },
      tie: { A: 0, B: 0, tie: 1 },
    });
    assert.deepEqual(metrics.missingResults, []);
    assert.deepEqual(metrics.missingLabels, ['too-few']);
    assert.deepEqual(metrics.excludedNonConsensus, ['human-conflict']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('rejects unsafe fixture assets and reports missing recorded results', () => {
  assert.throws(() => validatePairwiseFixtureManifest({
    version: 1,
    fixtures: [{
      ...fixture('unsafe', []),
      before: { path: '../outside.png', sha256: sha256('outside') },
    }],
  }), PairwiseFixtureManifestError);

  const manifest = {
    version: 1,
    fixtures: [fixture('missing-result', [{ reviewer: 'one', winner: 'B' }, { reviewer: 'two', winner: 'B' }])],
  };
  const metrics = computePairwiseFixtureMetrics(manifest, []);
  assert.deepEqual(metrics.missingResults, ['missing-result']);
  assert.equal(metrics.exactAgreement.rate, null);
  assert.equal(metrics.rates.abstention, null);
});
