import assert from 'node:assert/strict';
import test from 'node:test';

import {
  APPLE_RLDF_DATASET,
  APPLE_RLDF_LICENSE,
  AppleRldfSchemaError,
  normalizeAppleRldfRankingRow,
  normalizeAppleRldfRevisionRow,
  validateAppleRldfProvenance,
} from '../../../src/dataset-adapters/apple-rldf.js';

const provenance = {
  dataset: 'apple/ml-rldf',
  sourceUrl: 'https://github.com/apple/ml-rldf',
  revision: 'f3a759c5f5b38f3ddfa12c5d8765432101234567',
  license: 'CC-BY-NC-ND-4.0',
  redistribution: 'external-only',
};

function rankingRow(overrides = {}) {
  return {
    userid: 'designer-19',
    screenid: 'screen-4',
    description: 'Increase contrast between the title and the background.',
    chosen_image: { path: 'chosen.png' },
    rejected_image: { path: 'rejected.png' },
    chosen_html: '<main>chosen</main>',
    rejected_html: '<main>rejected</main>',
    ...overrides,
  };
}

function revisionRow(overrides = {}) {
  return {
    userid: 'designer-19',
    description: 'The revised version restores a clear primary action.',
    chosen_image: { path: 'revision.png' },
    rejected_image: { path: 'original.png' },
    ...overrides,
  };
}

test('normalizes documented ranking rows and retains both semantic roles after placement', () => {
  const input = rankingRow();
  const example = normalizeAppleRldfRankingRow(input, provenance, { chosenPosition: 'B' });

  assert.equal(example.track, 'preference');
  assert.equal(example.rowKind, 'ranking');
  assert.match(example.id, /^apple-rldf:ranking:[a-f0-9]{20}$/);
  assert.equal(example.groupId, 'apple-rldf:screen:screen-4');
  assert.deepEqual(example.sourceGroups, ['apple-rldf:screen:screen-4', 'apple-rldf:user:designer-19']);
  assert.equal(example.imageA, input.rejected_image);
  assert.equal(example.imageB, input.chosen_image);
  assert.deepEqual(example.roles, { chosen: 'B', rejected: 'A' });
  assert.equal(example.winner, 'B');
  assert.deepEqual(example.votes, { A: 0, B: 1 });
  assert.deepEqual(example.evidence, {
    strength: 'single-professional-designer-choice',
    voteDistribution: 'available',
    releaseGateEligible: false,
  });
  assert.equal(example.chosenHtml, input.chosen_html);
  assert.equal(example.rejectedHtml, input.rejected_html);
  assert.deepEqual(example.provenance, provenance);
});

test('makes chosen placement explicit and maps A and B without a fixed position bias', () => {
  const input = revisionRow();
  const A = normalizeAppleRldfRevisionRow(input, provenance, { chosenPosition: 'A' });
  const B = normalizeAppleRldfRevisionRow(input, provenance, { chosenPosition: 'B' });

  assert.equal(A.id, B.id, 'placement changes presentation, not source identity');
  assert.equal(A.groupId, 'apple-rldf:user:designer-19');
  assert.deepEqual(A.sourceGroups, ['apple-rldf:user:designer-19']);
  assert.equal(A.imageA, input.chosen_image);
  assert.equal(A.imageB, input.rejected_image);
  assert.deepEqual(A.roles, { chosen: 'A', rejected: 'B' });
  assert.equal(A.winner, 'A');
  assert.deepEqual(A.votes, { A: 1, B: 0 });
  assert.equal(B.imageA, input.rejected_image);
  assert.equal(B.imageB, input.chosen_image);
  assert.deepEqual(B.roles, { chosen: 'B', rejected: 'A' });
  assert.equal(B.winner, 'B');
  assert.deepEqual(B.votes, { A: 0, B: 1 });
});

test('fails closed for schema drift, missing placement, and non-external-only provenance', () => {
  assert.throws(
    () => normalizeAppleRldfRankingRow({ ...rankingRow(), extra: true }, provenance, { chosenPosition: 'A' }),
    AppleRldfSchemaError,
  );
  assert.throws(
    () => normalizeAppleRldfRevisionRow(revisionRow(), provenance, /** @type {any} */ ({})),
    /chosenPosition must be A or B/,
  );
  assert.throws(
    () => normalizeAppleRldfRevisionRow(revisionRow({ chosen_image: null }), provenance, { chosenPosition: 'A' }),
    /chosen_image must retain a supplied image value/,
  );
  assert.throws(
    () => validateAppleRldfProvenance({ ...provenance, redistribution: 'allowed' }),
    /external-only/,
  );
  assert.throws(
    () => validateAppleRldfProvenance({ ...provenance, license: 'MIT' }),
    new RegExp(APPLE_RLDF_LICENSE),
  );
  assert.throws(
    () => validateAppleRldfProvenance({ ...provenance, dataset: 'other/data' }),
    new RegExp(APPLE_RLDF_DATASET),
  );
  assert.throws(
    () => validateAppleRldfProvenance({ ...provenance, revision: 'main' }),
    /40-character hexadecimal GitHub commit SHA/,
  );
  assert.throws(
    () => validateAppleRldfProvenance({ ...provenance, revision: 'abc123' }),
    /40-character hexadecimal GitHub commit SHA/,
  );
});
