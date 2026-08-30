import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BETTERAPP_DATASET,
  BetterAppDatasetAdapterError,
  normalizeBetterAppRow,
} from '../../../src/dataset-adapters/betterapp.js';

const provenance = {
  dataset: BETTERAPP_DATASET,
  sourceUrl: 'https://huggingface.co/datasets/biglab/uiclip_human_data-paired_hf',
  // Synthetic fixed-width pin for adapter validation; not an upstream revision.
  revision: '0123456789abcdef0123456789abcdef01234567',
  license: 'unknown',
  redistribution: 'unknown',
};

function row(overrides = {}) {
  return {
    img_good: { bytes: new Uint8Array([1]) },
    img_bad: { bytes: new Uint8Array([2]) },
    caption: 'A clear account overview.',
    caption_bad: 'A crowded account overview.',
    filename: 'screens/good.png',
    filename_bad: 'screens/bad.png',
    ...overrides,
  };
}

test('counterbalances the good image and captions without losing original source identities', () => {
  const input = row();
  const positionA = normalizeBetterAppRow(input, provenance, { chosenPosition: 'A' });
  const positionB = normalizeBetterAppRow(input, provenance, { chosenPosition: 'B' });

  assert.equal(positionA.track, 'preference');
  assert.equal(positionA.imageA, input.img_good);
  assert.equal(positionA.imageB, input.img_bad);
  assert.equal(positionA.captionA, input.caption);
  assert.equal(positionA.captionB, input.caption_bad);
  assert.deepEqual(positionA.votes, { A: 1, B: 0 });
  assert.equal(positionA.winner, 'A');

  assert.equal(positionB.imageA, input.img_bad);
  assert.equal(positionB.imageB, input.img_good);
  assert.equal(positionB.captionA, input.caption_bad);
  assert.equal(positionB.captionB, input.caption);
  assert.deepEqual(positionB.votes, { A: 0, B: 1 });
  assert.equal(positionB.winner, 'B');
  assert.notEqual(positionA.id, positionB.id);
  assert.equal(positionA.groupId, positionB.groupId);
  assert.deepEqual(positionA.sourceGroups, ['file:screens/good.png', 'file:screens/bad.png']);
  assert.deepEqual(positionB.sourceGroups, positionA.sourceGroups);
});

test('marks the one-human-designer label as external-only, non-release-gate evidence', () => {
  const example = normalizeBetterAppRow(row(), provenance, { chosenPosition: 'A' });
  assert.deepEqual(example.evidence, {
    strength: 'one-human-designer-label',
    voteDistribution: 'unavailable',
    releaseGateEligible: false,
  });
  assert.deepEqual(example.provenance, provenance);
});

test('fails closed for schema drift, missing orientation, invalid provenance, and degenerate image identities', () => {
  assert.throws(
    () => normalizeBetterAppRow(row({ unexpected: true }), provenance, { chosenPosition: 'A' }),
    /unknown fields: unexpected/,
  );
  assert.throws(
    () => normalizeBetterAppRow(row(), provenance, {}),
    /options is missing fields: chosenPosition/,
  );
  assert.throws(
    () => normalizeBetterAppRow(row(), { ...provenance, license: 'MIT' }, { chosenPosition: 'A' }),
    /provenance\.license must match canonical registry provenance/,
  );
  assert.throws(
    () => normalizeBetterAppRow(row(), { ...provenance, revision: 'main' }, { chosenPosition: 'A' }),
    /must be a 40-character hexadecimal Hugging Face commit SHA/,
  );
  assert.throws(
    () => normalizeBetterAppRow(row(), { ...provenance, revision: 'abc123' }, { chosenPosition: 'A' }),
    /must be a 40-character hexadecimal Hugging Face commit SHA/,
  );
  assert.throws(
    () => normalizeBetterAppRow(row({ filename_bad: 'screens/good.png' }), provenance, { chosenPosition: 'A' }),
    /two distinct source images/,
  );
  assert.throws(
    () => normalizeBetterAppRow(row({ img_good: null }), provenance, { chosenPosition: 'A' }),
    BetterAppDatasetAdapterError,
  );
});
