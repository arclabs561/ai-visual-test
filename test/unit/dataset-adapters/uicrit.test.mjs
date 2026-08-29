import test from 'node:test';
import assert from 'node:assert/strict';

// This path resolves to the staged TypeScript output when run via npm test.
import { adaptUICritRows, UICritEvidenceError } from '../../../src/dataset-adapters/uicrit.js';

const provenance = {
  dataset: 'google-research-datasets/uicrit',
  sourceUrl: 'https://github.com/google-research-datasets/uicrit',
  revision: 'adc92136cdaecf6a5c8bb85af08594dd9271eb00',
  license: 'CC-BY-4.0 annotations; RICO pixels separately licensed',
  redistribution: 'allowed',
};

function liveRow(task, ratings, commentsSource, comments, overrides = {}) {
  return {
    rico_id: '123',
    task,
    aesthetics_rating: String(ratings.aesthetics),
    learnability: String(ratings.learnability),
    efficency: String(ratings.efficiency),
    usability_rating: String(ratings.usability),
    design_quality_rating: String(ratings.designQuality),
    comments_source: commentsSource,
    comments,
    ...overrides,
  };
}

test('adapts the live UICrit row shape and aggregates exactly three annotators', () => {
  const result = adaptUICritRows([
    liveRow('visual design', { aesthetics: 9, learnability: 4, efficiency: 5, usability: 8, designQuality: 9 }, "['human', 'model']", "['Strong hierarchy bbox: [0.1, 0.2, 0.3, 0.4]', 'generated note']"),
    liveRow('visual design', { aesthetics: 8, learnability: 5, efficiency: 4, usability: 7, designQuality: 8 }, '["both"]', "['Useful navigation']"),
    liveRow('visual design', { aesthetics: 7, learnability: 3, efficiency: 3, usability: 6, designQuality: 7 }, '[]', '[]'),
  ], provenance);

  assert.deepEqual(result.rejectedRows, []);
  assert.deepEqual(result.rejectedScreens, []);
  assert.equal(result.records.length, 1);
  const [screen] = result.records;
  assert.equal(screen.id, 'uicrit:123');
  assert.equal(screen.groupId, 'rico:123');
  assert.deepEqual(screen.screenshotRef, { system: 'rico', id: '123' });
  assert.deepEqual(screen.annotators.map(record => record.annotatorId), [
    'uicrit:123:annotator-1', 'uicrit:123:annotator-2', 'uicrit:123:annotator-3',
  ]);
  assert.equal(screen.comments.length, 2);
  assert.deepEqual(screen.comments[0], {
    task: 'visual design', text: 'Strong hierarchy', evidence: 'human',
    box: { x: 0.1, y: 0.2, width: 0.2, height: 0.2 },
  });
  assert.deepEqual(screen.comments[1], { task: 'visual design', text: 'Useful navigation', evidence: 'both' });
  assert.deepEqual(screen.aggregatedRatings.aesthetics, {
    values: [9, 8, 7], mean: 8, min: 7, max: 9, range: 2,
    standardDeviation: Math.sqrt(2 / 3),
  });
  assert.deepEqual(screen.ratings, {
    aesthetics: 8, learnability: 4, efficiency: 4, usability: 7, 'design-quality': 8,
  });
  assert.deepEqual(screen.disagreement.efficiency, { range: 2, standardDeviation: Math.sqrt(2 / 3) });
});

test('fails closed on malformed paired lists and does not emit their incomplete screen', () => {
  const result = adaptUICritRows([
    liveRow('visual design', { aesthetics: 9, learnability: 4, efficiency: 5, usability: 8, designQuality: 9 }, "['human']", "['one']"),
    liveRow('visual design', { aesthetics: 8, learnability: 5, efficiency: 4, usability: 7, designQuality: 8 }, "['human', 'both']", "['only one']"),
    liveRow('visual design', { aesthetics: 7, learnability: 3, efficiency: 3, usability: 6, designQuality: 7 }, "['human']", "['unterminated]"),
  ], provenance);

  assert.deepEqual(result.records, []);
  assert.equal(result.rejectedRows.length, 2);
  assert.match(result.rejectedRows[0].reason, /equal lengths/);
  assert.match(result.rejectedRows[1].reason, /unterminated string/);
  assert.deepEqual(result.rejectedScreens, [{
    ricoId: '123', reason: 'requires exactly three valid UICrit rows; found 1 valid of 3',
  }]);
});

test('rejects invalid provenance before treating decoded rows as a dataset', () => {
  assert.throws(
    () => adaptUICritRows([], { ...provenance, revision: '  ' }),
    UICritEvidenceError,
  );
  assert.throws(
    () => adaptUICritRows([], { ...provenance, revision: 'main' }),
    /canonical immutable registry revision/,
  );
  assert.throws(
    () => adaptUICritRows([], { ...provenance, revision: 'abc123' }),
    /canonical immutable registry revision/,
  );
});
