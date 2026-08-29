import test from 'node:test';
import assert from 'node:assert/strict';

import {
  VibeDatasetAdapterError,
  normalizeVibeDesignArenaRow,
  normalizeVibeLandingPageArenaRow,
  preferenceMarginBand,
  selectStratifiedVibeExamples,
} from '../../../src/dataset-adapters/vibe.js';
import { createDatasetProvenance } from '../../../src/dataset-adapters/registry.js';

const landingProvenance = createDatasetProvenance('vibe-landing-page-arena', '94d584034e81336fe440dcb3f62fe8d53a65f7f0');
const designProvenance = createDatasetProvenance('vibe-design-arena', 'ee85ae467e14b1f454036544eb37eec0e2ab6368');

function landingRow(overrides = {}) {
  return {
    image_a: { bytes: new Uint8Array([1]) },
    image_b: { bytes: new Uint8Array([2]) },
    tool_a: 'claude-code',
    tool_b: 'cursor',
    prompt_id: 7,
    prompt: 'Design a calm invoicing landing page.',
    dimension: 'layout',
    votes_a: 11,
    votes_b: 4,
    winner: 'A',
    ...overrides,
  };
}

function designRow(overrides = {}) {
  return {
    image_a: { bytes: new Uint8Array([1]) },
    image_b: { bytes: new Uint8Array([2]) },
    app_a: 'alpha',
    app_b: 'beta',
    votes_a: 18,
    votes_b: 12,
    winner: 'app_a',
    ...overrides,
  };
}

test('normalizes both documented Vibe comparison schemas without transforming images', () => {
  const landingInput = landingRow();
  const landing = normalizeVibeLandingPageArenaRow(landingInput, landingProvenance);
  assert.deepEqual(landing, {
    track: 'preference',
    id: 'vibe-landing-page-arena:7:layout:claude-code:cursor',
    groupId: 'vibe-landing-page-arena:prompt:7',
    sourceGroups: ['prompt:7'],
    imageA: landingInput.image_a,
    imageB: landingInput.image_b,
    votes: { A: 11, B: 4 },
    winner: 'A',
    dimension: 'layout',
    prompt: 'Design a calm invoicing landing page.',
    provenance: landingProvenance,
  });

  const designInput = designRow();
  const design = normalizeVibeDesignArenaRow(designInput, designProvenance);
  assert.deepEqual(design, {
    track: 'preference',
    id: 'vibe-design-arena:alpha:beta',
    groupId: 'vibe-design-arena:apps:alpha:beta',
    sourceGroups: ['app:alpha', 'app:beta'],
    imageA: designInput.image_a,
    imageB: designInput.image_b,
    votes: { A: 18, B: 12 },
    winner: 'A',
    provenance: designProvenance,
  });
});

test('preserves a documented tie and rejects missing or contradictory human evidence', () => {
  const tied = normalizeVibeLandingPageArenaRow(landingRow({ votes_a: 8, votes_b: 8, winner: 'tie' }), landingProvenance);
  assert.equal(tied.winner, 'tie');
  assert.equal(preferenceMarginBand(tied), 'tie');
  assert.deepEqual(
    normalizeVibeLandingPageArenaRow(landingRow({ votes_a: 11, votes_b: 4, votes_tie: 2 }), landingProvenance).votes,
    { A: 11, B: 4, tie: 2 },
  );

  assert.throws(
    () => normalizeVibeLandingPageArenaRow(landingRow({ votes_a: 8, votes_b: 7, winner: 'tie' }), landingProvenance),
    VibeDatasetAdapterError,
  );
  assert.throws(
    () => normalizeVibeDesignArenaRow(designRow({ image_b: null }), designProvenance),
    /row\.image_b is missing/,
  );
  assert.throws(
    () => normalizeVibeDesignArenaRow(designRow(), { ...designProvenance, revision: '' }),
    /provenance\.revision must be a non-empty string/,
  );
  assert.throws(
    () => normalizeVibeDesignArenaRow(designRow(), { ...designProvenance, sourceUrl: 'https://example.test/data' }),
    /must match the canonical vibe-design-arena registry record/,
  );
  assert.throws(
    () => normalizeVibeLandingPageArenaRow(landingRow(), { ...landingProvenance, revision: 'main' }),
    /provenance\.revision is not an immutable dataset revision/,
  );
  assert.throws(
    () => normalizeVibeDesignArenaRow(designRow(), { ...designProvenance, revision: 'main' }),
    /provenance\.revision is not an immutable dataset revision/,
  );
  assert.throws(
    () => normalizeVibeLandingPageArenaRow(landingRow(), { ...landingProvenance, revision: 'abc123' }),
    /provenance\.revision is not an immutable dataset revision/,
  );
  assert.throws(
    () => normalizeVibeDesignArenaRow(designRow(), { ...designProvenance, revision: 'abc123' }),
    /provenance\.revision is not an immutable dataset revision/,
  );
});

test('selects deterministically and round-robins across dimension and vote-margin strata', () => {
  const examples = [
    normalizeVibeLandingPageArenaRow(landingRow({ prompt_id: 1, dimension: 'layout', votes_a: 8, votes_b: 7, winner: 'A' }), landingProvenance),
    normalizeVibeLandingPageArenaRow(landingRow({ prompt_id: 2, dimension: 'layout', votes_a: 13, votes_b: 2, winner: 'A' }), landingProvenance),
    normalizeVibeLandingPageArenaRow(landingRow({ prompt_id: 3, dimension: 'typography', votes_a: 8, votes_b: 7, winner: 'A' }), landingProvenance),
    normalizeVibeLandingPageArenaRow(landingRow({ prompt_id: 4, dimension: 'typography', votes_a: 13, votes_b: 2, winner: 'A' }), landingProvenance),
    normalizeVibeLandingPageArenaRow(landingRow({ prompt_id: 5, dimension: 'layout', votes_a: 8, votes_b: 7, winner: 'A' }), landingProvenance),
  ];
  const original = examples.map(example => example.id);
  const selected = selectStratifiedVibeExamples(examples, { limit: 4, seed: 'fixed' });
  assert.equal(selected.length, 4);
  assert.deepEqual(
    new Set(selected.map(example => `${example.dimension}:${preferenceMarginBand(example)}`)),
    new Set(['layout:close', 'layout:decisive', 'typography:close', 'typography:decisive']),
  );
  assert.deepEqual(examples.map(example => example.id), original, 'selection must not mutate its input');
  assert.deepEqual(
    selectStratifiedVibeExamples([...examples].reverse(), { limit: 4, seed: 'fixed' }).map(example => example.id),
    selected.map(example => example.id),
  );
  assert.throws(
    () => selectStratifiedVibeExamples([examples[0], examples[0]], { limit: 1 }),
    /duplicate id/,
  );
});
