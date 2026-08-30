import assert from 'node:assert/strict';
import { mkdtempSync, lstatSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  DatasetAcquisitionBoundaryError,
  createAggregateByteBudget,
  createOperatorCacheDirectory,
  createPrivateRunDirectory,
  fetchBoundedArtifact,
  safeCacheRelativePath,
  verifyCachedArtifact,
  writeVerifiedCacheArtifact,
} from '../../src/dataset-acquisition.js';

const source = Object.freeze({
  origin: 'https://datasets.example.test',
  pathPrefix: '/pinned/revision/',
  acceptsSourceToken: true,
});

const pinnedRevision = 'c6dd79d5e1c0cbb4e7ca234c9f53c418a75e30ce';

function response(body, options = {}) {
  return new Response(body, options);
}

test('manually rejects a redirect to an unapproved host before requesting it', async () => {
  const requested = [];
  await assert.rejects(
    fetchBoundedArtifact({
      url: 'https://datasets.example.test/pinned/revision/rows.json',
      allowedSources: [source],
      maximumBytes: 100,
      timeoutMs: 1000,
      fetchImplementation: async (url, init) => {
        requested.push({ url: String(url), redirect: init?.redirect });
        return response(null, { status: 302, headers: { location: 'https://169.254.169.254/latest/meta-data/' } });
      },
    }),
    /not on an approved HTTPS source path/,
  );
  assert.deepEqual(requested, [{ url: 'https://datasets.example.test/pinned/revision/rows.json', redirect: 'manual' }]);
});

test('keeps a source token on its exact approved origin, not an approved redirect CDN', async () => {
  const requests = [];
  const artifact = await fetchBoundedArtifact({
    url: 'https://datasets.example.test/pinned/revision/rows.json',
    allowedSources: [source, { origin: 'https://cdn.example.test', pathPrefix: '/immutable/' }],
    maximumBytes: 100,
    timeoutMs: 1000,
    sourceToken: 'operator-token',
    fetchImplementation: async (url, init) => {
      requests.push({ url: String(url), authorization: new Headers(init?.headers).get('authorization') });
      if (String(url).includes('datasets.example.test')) {
        return response(null, { status: 302, headers: { location: 'https://cdn.example.test/immutable/rows.json' } });
      }
      return response('ok', { status: 200, headers: { 'content-length': '2', 'content-type': 'application/json' } });
    },
  });
  assert.equal(artifact.byteLength, 2);
  assert.equal(artifact.sourceUrl, 'https://cdn.example.test/immutable/rows.json');
  assert.deepEqual(requests, [
    { url: 'https://datasets.example.test/pinned/revision/rows.json', authorization: 'Bearer operator-token' },
    { url: 'https://cdn.example.test/immutable/rows.json', authorization: null },
  ]);
});

test('enforces advertised and streamed response byte limits', async () => {
  await assert.rejects(
    fetchBoundedArtifact({
      url: 'https://datasets.example.test/pinned/revision/large', allowedSources: [source], maximumBytes: 3, timeoutMs: 1000,
      fetchImplementation: async () => response('abcd', { headers: { 'content-length': '4' } }),
    }),
    /exceeds the 3-byte limit/,
  );
  await assert.rejects(
    fetchBoundedArtifact({
      url: 'https://datasets.example.test/pinned/revision/chunked', allowedSources: [source], maximumBytes: 3, timeoutMs: 1000,
      fetchImplementation: async () => response('abcd'),
    }),
    /exceeds the 3-byte limit/,
  );
});

test('requires the pinned revision in every initial and redirected source URL', async () => {
  const pinnedSource = { ...source, requiredRevision: pinnedRevision };
  await assert.rejects(
    fetchBoundedArtifact({
      url: 'https://datasets.example.test/pinned/revision/rows.json', allowedSources: [pinnedSource], maximumBytes: 100, timeoutMs: 1000,
      fetchImplementation: async () => response('not reached'),
    }),
    /does not bind the approved immutable revision/,
  );
  let requestCount = 0;
  await assert.rejects(
    fetchBoundedArtifact({
      url: `https://datasets.example.test/pinned/revision/${pinnedRevision}/rows.json`, allowedSources: [pinnedSource], maximumBytes: 100, timeoutMs: 1000,
      fetchImplementation: async () => {
        requestCount += 1;
        return response(null, { status: 302, headers: { location: 'https://datasets.example.test/pinned/revision/rows.json' } });
      },
    }),
    /does not bind the approved immutable revision/,
  );
  assert.equal(requestCount, 1);
});

test('enforces one aggregate byte budget across independent streamed fetches', async () => {
  const budget = createAggregateByteBudget(5);
  const options = {
    url: 'https://datasets.example.test/pinned/revision/rows.json', allowedSources: [source], maximumBytes: 10, timeoutMs: 1000,
    aggregateByteBudget: budget,
    fetchImplementation: async () => response('abc'),
  };
  await fetchBoundedArtifact(options);
  assert.equal(budget.consumedBytes, 3);
  assert.equal(budget.remainingBytes, 2);
  await assert.rejects(fetchBoundedArtifact(options), /aggregate limit/);
  assert.equal(budget.consumedBytes, 3);
});

test('rejects traversal and platform-specific artifact paths', () => {
  for (const candidate of ['../escape', 'nested/../escape', '/absolute', 'C:/windows', 'nested\\escape', '', './relative']) {
    assert.throws(() => safeCacheRelativePath(candidate), DatasetAcquisitionBoundaryError);
  }
  assert.equal(safeCacheRelativePath('images/row-01/before.png'), 'images/row-01/before.png');
});

test('uses a private ignored-evaluation cache and reuses only identical artifacts', () => {
  const root = mkdtempSync(join(tmpdir(), 'dataset-boundary-'));
  try {
    const cache = createOperatorCacheDirectory({ cacheDirectory: join(root, 'evaluation', 'cache', 'uicrit'), repositoryRoot: root });
    assert.equal(lstatSync(cache).mode & 0o777, 0o700);
    const receipt = writeVerifiedCacheArtifact(cache, 'rows/pinned.json', Buffer.from('pinned'));
    assert.equal(lstatSync(join(cache, 'rows', 'pinned.json')).mode & 0o777, 0o600);
    assert.equal(verifyCachedArtifact(cache, 'rows/pinned.json').sha256, receipt.sha256);
    assert.deepEqual(writeVerifiedCacheArtifact(cache, 'rows/pinned.json', Buffer.from('pinned')), receipt);
    assert.throws(() => writeVerifiedCacheArtifact(cache, 'rows/pinned.json', Buffer.from('changed')), /refusing to overwrite/);
    assert.throws(
      () => createOperatorCacheDirectory({ cacheDirectory: join(root, 'fixtures', 'uicrit'), repositoryRoot: root }),
      /below ignored evaluation/,
    );
    const firstRun = createPrivateRunDirectory({ parentDirectory: cache, prefix: 'uicrit' });
    const secondRun = createPrivateRunDirectory({ parentDirectory: cache, prefix: 'uicrit' });
    assert.notEqual(firstRun, secondRun);
    assert.equal(lstatSync(firstRun).mode & 0o777, 0o700);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('rejects symlinked cache directories and artifacts', () => {
  const root = mkdtempSync(join(tmpdir(), 'dataset-boundary-symlink-'));
  try {
    const external = mkdtempSync(join(tmpdir(), 'dataset-boundary-target-'));
    const link = join(root, 'evaluation', 'cache-link');
    mkdirSync(join(root, 'evaluation'), { recursive: true });
    symlinkSync(external, link);
    assert.throws(
      () => createOperatorCacheDirectory({ cacheDirectory: link, repositoryRoot: root }),
      /never symlinks/,
    );

    const cache = createOperatorCacheDirectory({ cacheDirectory: join(root, 'evaluation', 'cache'), repositoryRoot: root });
    assert.throws(() => verifyCachedArtifact(link, 'anything.txt'), /real directory/);
    symlinkSync(external, join(cache, 'outside.txt'));
    assert.throws(() => verifyCachedArtifact(cache, 'outside.txt'), /non-symlink/);
    rmSync(external, { recursive: true, force: true });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
