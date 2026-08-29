import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DIFFSPOT_GROUPING_NOTE,
  DiffSpotSchemaError,
  normalizeDiffSpotRow,
  normalizeDiffSpotRows,
  selectDiffSpotExamples,
} from '../../../src/dataset-adapters/diffspot.js';

const provenance = {
  dataset: 'tencent/DiffSpot',
  sourceUrl: 'https://huggingface.co/datasets/tencent/DiffSpot',
  revision: 'c6dd79d5e1c0cbb4e7ca234c9f53c418a75e30ce',
  license: 'MIT',
  redistribution: 'allowed',
};

function mutation(property = 'text-content') {
  return JSON.stringify({
    type: 'text', element: 'the heading', property, direction: '', old_value: 'old', new_value: 'new',
    template: 'The heading changed',
  });
}

function row(id, {
  taskType = 'visual_diff', difficulty = 'easy', mutationType = 'mutate_text', property = 'text-content',
  noDiffWithObservedBbox = false, domain = 'travel',
} = {}) {
  const noDiff = taskType === 'no_diff';
  return {
    id,
    image_before: { src: `https://example.invalid/${id}/before.jpg`, width: 1280, height: 800 },
    image_after: { src: `https://example.invalid/${id}/after.jpg`, width: 1280, height: 800 },
    user_query: 'Can you spot what changed?',
    ground_truth_diff: noDiff ? 'No perceptible change.' : 'The heading changed.',
    mutations_text: noDiff ? [] : ['The heading changed'],
    mutation_types: noDiff ? [] : [mutationType],
    mutation_dicts_json: noDiff ? [] : [mutation(property)],
    task_type: taskType,
    difficulty,
    domain,
    pixel_diff: noDiff ? 0 : 0.005,
    target_diff: noDiff && !noDiffWithObservedBbox ? 0 : 50,
    outside_diff: 0,
    target_bbox_x: noDiff && !noDiffWithObservedBbox ? -1 : 0,
    target_bbox_y: noDiff && !noDiffWithObservedBbox ? -1 : 52,
    target_bbox_w: noDiff && !noDiffWithObservedBbox ? -1 : 1280,
    target_bbox_h: noDiff && !noDiffWithObservedBbox ? -1 : 400,
  };
}

test('normalizes an actual DiffSpot visual_diff row and preserves raw images', () => {
  const input = row('8f5bb196-f17b-445d-8d66-d573f666d84d', { difficulty: 'hard', property: 'line-height' });
  const actual = normalizeDiffSpotRow(input, provenance);
  assert.equal(actual.track, 'regression');
  assert.equal(actual.id, input.id);
  assert.equal(actual.groupId, input.id);
  assert.equal(actual.before, input.image_before);
  assert.equal(actual.after, input.image_after);
  assert.equal(actual.taskType, 'visual_diff');
  assert.equal(actual.difficulty, 'hard');
  assert.equal(actual.domain, 'travel');
  assert.deepEqual(actual.groundTruth, {
    description: 'The heading changed.',
    mutations: [{
      text: 'The heading changed', mutationType: 'mutate_text', detail: {
        type: 'text', element: 'the heading', property: 'line-height', direction: '', oldValue: 'old',
        newValue: 'new', template: 'The heading changed',
      },
    }],
    pixelDiff: 0.005, targetDiff: 50, outsideDiff: 0,
    targetBbox: { x: 0, y: 52, width: 1280, height: 400 },
  });
  assert.deepEqual(actual.provenance, provenance);
});

test('accepts observed no_diff controls with either unavailable or recorded bbox statistics', () => {
  const unavailable = normalizeDiffSpotRow(row('nodiff-empty', { taskType: 'no_diff', difficulty: 'no_diff' }), provenance);
  const observed = normalizeDiffSpotRow(row('nodiff-bbox', {
    taskType: 'no_diff', difficulty: 'no_diff', noDiffWithObservedBbox: true,
  }), provenance);
  assert.equal(unavailable.taskType, 'no_diff');
  assert.equal(unavailable.groundTruth.targetBbox, null);
  assert.equal(observed.groundTruth.targetDiff, 50);
  assert.deepEqual(observed.groundTruth.targetBbox, { x: 0, y: 52, width: 1280, height: 400 });
});

test('fails closed for unknown row fields, malformed JSON, and violated upstream invariants', () => {
  assert.throws(() => normalizeDiffSpotRow({ ...row('unknown'), extra: true }, provenance), DiffSpotSchemaError);
  assert.throws(() => normalizeDiffSpotRow({ ...row('bad-json'), mutation_dicts_json: ['nope'] }, provenance), /valid JSON/);
  assert.throws(() => normalizeDiffSpotRow({ ...row('wrong-difficulty'), task_type: 'no_diff', difficulty: 'easy' }, provenance), /difficulty no_diff/);
  assert.throws(() => normalizeDiffSpotRow({ ...row('nonempty-control', { taskType: 'no_diff', difficulty: 'no_diff' }), mutations_text: ['not allowed'] }, provenance), /equal lengths|empty mutations/);
  assert.throws(() => normalizeDiffSpotRow({ ...row('mixed-bbox'), target_bbox_x: -1 }, provenance), /all -1 or a complete/);
  assert.throws(() => normalizeDiffSpotRow(row('un-pinned'), { ...provenance, revision: '' }), /revision/);
});

test('rejects mutable, abbreviated, and noncanonical provenance at the adapter boundary', () => {
  assert.throws(() => normalizeDiffSpotRow(row('main-ref'), { ...provenance, revision: 'main' }), /revision is not canonical/);
  assert.throws(() => normalizeDiffSpotRow(row('short-sha'), { ...provenance, revision: 'c6dd79d' }), /revision is not canonical/);
  assert.throws(() => normalizeDiffSpotRow(row('wrong-source'), { ...provenance, sourceUrl: 'https://example.invalid/DiffSpot' }), /sourceUrl must match/);
  assert.throws(() => normalizeDiffSpotRow(row('wrong-license'), { ...provenance, license: 'CC-BY-4.0' }), /license must match/);
  assert.throws(() => normalizeDiffSpotRow(row('wrong-policy'), { ...provenance, redistribution: 'unknown' }), /redistribution must match/);
});

test('does not invent source grouping and deterministically balances native fields', () => {
  const rows = normalizeDiffSpotRows([
    row('easy-text', { difficulty: 'easy', mutationType: 'mutate_text' }),
    row('medium-color', { difficulty: 'medium', mutationType: 'mutate_color' }),
    row('hard-spacing', { difficulty: 'hard', mutationType: 'mutate_line_height' }),
    row('control-a', { taskType: 'no_diff', difficulty: 'no_diff' }),
    row('control-b', { taskType: 'no_diff', difficulty: 'no_diff', noDiffWithObservedBbox: true }),
  ], provenance);
  const first = selectDiffSpotExamples(rows, { limit: 4, seed: 'stable-seed' });
  const second = selectDiffSpotExamples([...rows].reverse(), { limit: 4, seed: 'stable-seed' });
  assert.deepEqual(first.map(entry => entry.id), second.map(entry => entry.id));
  assert.equal(new Set(first.map(entry => entry.id)).size, first.length);
  assert.ok(first.some(entry => entry.taskType === 'no_diff'));
  assert.ok(first.some(entry => entry.taskType === 'visual_diff'));
  assert.match(DIFFSPOT_GROUPING_NOTE, /no stable source-page field/i);
});
