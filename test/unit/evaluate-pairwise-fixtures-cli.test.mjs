import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const evaluator = join(repositoryRoot, 'scripts/evaluate-pairwise-fixtures.mjs');
const sha256 = value => createHash('sha256').update(value).digest('hex');

function comparison(winner, scores) {
  return {
    enabled: true,
    kind: 'comparison',
    winner,
    scores,
    comparisonConfidence: 0.8,
    differences: [],
    issues: [],
    reasoning: `winner ${winner}`,
  };
}

function run({ corruptHash = false } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'pairwise-cli-'));
  const before = 'before-image';
  const after = 'after-image';
  writeFileSync(join(directory, 'before.png'), before);
  writeFileSync(join(directory, 'after.png'), after);
  const manifestPath = join(directory, 'manifest.json');
  const resultsPath = join(directory, 'results.json');
  writeFileSync(manifestPath, JSON.stringify({ version: 2, fixtures: [{
    id: 'real-boundary',
    prompt: 'Which state is clearer?',
    rubricVersion: 'pairwise-v1',
    before: { path: 'before.png', sha256: corruptHash ? sha256('wrong') : sha256(before) },
    after: { path: 'after.png', sha256: sha256(after) },
    capture: {
      viewport: { width: 1280, height: 720 }, browser: 'chromium', deviceScaleFactor: 1,
      colorScheme: 'light', fullPage: false, stable: true, animations: 'disabled', caret: 'hide',
    },
    provenance: {
      dataset: 'first-party', revision: 'fixture-v1', sourceRecordId: 'real-boundary',
      sourceUrl: 'https://example.invalid/visual-fixtures', license: 'private',
      redistribution: 'external-only', lane: 'first-party', split: 'test', groupId: 'page-one',
    },
    humanReviews: [
      { reviewer: 'r1', winner: 'B', rationale: 'The candidate is clearer.' },
      { reviewer: 'r2', winner: 'B', rationale: 'The candidate is clearer.' },
    ],
  }] }));
  writeFileSync(resultsPath, JSON.stringify({ version: 1, outcomes: [{
    id: 'real-boundary',
    orders: {
      AB: comparison('B', { A: 4, B: 8 }),
      BA: comparison('A', { A: 8, B: 4 }),
    },
  }] }));
  const completed = spawnSync(process.execPath, [
    evaluator, '--manifest', manifestPath, '--results', resultsPath,
  ], { cwd: repositoryRoot, encoding: 'utf8' });
  rmSync(directory, { recursive: true, force: true });
  return completed;
}

test('replays recorded orders and emits provenance-aware fixture metrics', () => {
  const completed = run();
  assert.equal(completed.status, 0, completed.stderr);
  const report = JSON.parse(completed.stdout);
  assert.deepEqual(report.exactAgreement, { matches: 1, compared: 1, rate: 1 });
  assert.equal(report.coverage, 1);
  assert.equal(report.humanLabels.reviewerAgreement.rate, 1);
});

test('rejects an asset whose bytes do not match its recorded digest', () => {
  const completed = run({ corruptHash: true });
  assert.equal(completed.status, 1);
  assert.match(completed.stderr, /SHA-256 does not match manifest/);
});
