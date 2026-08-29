import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const evaluator = join(repositoryRoot, 'scripts/evaluate-dataset-results.mjs');

const acquisition = {
  version: 1,
  key: 'vibe-design-arena',
  provenance: {
    dataset: 'datapointai/vibe-design-arena',
    sourceUrl: 'https://huggingface.co/datasets/datapointai/vibe-design-arena',
    revision: 'ee85ae467e14b1f454036544eb37eec0e2ab6368',
    license: 'CC-BY-4.0',
    redistribution: 'allowed',
  },
  retrievedAt: '2026-08-28T12:00:00Z',
  normalizerVersion: 'v1',
  artifacts: [],
  status: 'metadata-only',
};

function run(track, examples, results) {
  const directory = mkdtempSync(join(tmpdir(), 'dataset-evaluator-'));
  const examplesPath = join(directory, 'examples.json');
  const resultsPath = join(directory, 'results.json');
  writeFileSync(examplesPath, JSON.stringify(examples));
  writeFileSync(resultsPath, JSON.stringify(results));
  const completed = spawnSync(process.execPath, [
    evaluator, '--track', track, '--examples', examplesPath, '--results', resultsPath,
  ], { cwd: repositoryRoot, encoding: 'utf8' });
  rmSync(directory, { recursive: true, force: true });
  return completed;
}

test('evaluates a preference document through the CLI boundary', () => {
  const completed = run(
    'preference',
    { version: 2, track: 'preference', acquisition, splits: [{ name: 'held-out', examples: [
      { id: 'clear', groupId: 'app:clear', sourceGroups: ['app:clear'], votes: { A: 15, B: 0 }, dimension: 'layout' },
      { id: 'uncertain', groupId: 'app:uncertain', sourceGroups: ['app:uncertain'], votes: { A: 8, B: 7 }, dimension: 'layout' },
    ] }] },
    { version: 2, track: 'preference', acquisition, split: 'held-out', results: [
      { id: 'clear', prediction: 'A' },
      { id: 'uncertain', prediction: 'indeterminate' },
    ] },
  );
  assert.equal(completed.status, 0, completed.stderr);
  const report = JSON.parse(completed.stdout);
  assert.equal(report.track, 'preference');
  assert.equal(report.split, 'held-out');
  assert.deepEqual(report.acquisition, acquisition);
  assert.deepEqual(report.metrics.majorityExactAgreement, { matches: 1, compared: 1, rate: 1 });
  assert.equal(report.metrics.abstentionRate, 0.5);
});

test('fails closed on a mismatched evidence track', () => {
  const completed = run(
    'regression',
    { version: 2, track: 'preference', acquisition, splits: [] },
    { version: 2, track: 'regression', acquisition, split: 'held-out', results: [] },
  );
  assert.equal(completed.status, 1);
  assert.match(completed.stderr, /examples document must be/);
});

test('fails closed for mixed acquisition revisions and source groups crossing splits', () => {
  const mixedRevision = run(
    'preference',
    { version: 2, track: 'preference', acquisition, splits: [{ name: 'held-out', examples: [] }] },
    {
      version: 2,
      track: 'preference',
      acquisition: { ...acquisition, provenance: { ...acquisition.provenance, revision: 'c6dd79d5e1c0cbb4e7ca234c9f53c418a75e30ce' } },
      split: 'held-out',
      results: [],
    },
  );
  assert.equal(mixedRevision.status, 1);
  assert.match(mixedRevision.stderr, /same immutable acquisition identity/);

  const crossingGroups = run(
    'preference',
    {
      version: 2,
      track: 'preference',
      acquisition,
      splits: [
        { name: 'development', examples: [{ id: 'dev', groupId: 'page', sourceGroups: ['page'] }] },
        { name: 'held-out', examples: [{ id: 'held', groupId: 'page', sourceGroups: ['page'] }] },
      ],
    },
    { version: 2, track: 'preference', acquisition, split: 'held-out', results: [] },
  );
  assert.equal(crossingGroups.status, 1);
  assert.match(crossingGroups.stderr, /group-disjoint splits/);
});
