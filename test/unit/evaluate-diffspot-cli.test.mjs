import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const evaluator = join(repositoryRoot, 'scripts/evaluate-diffspot.mjs');
const revision = 'c6dd79d5e1c0cbb4e7ca234c9f53c418a75e30ce';
const png = Buffer.from('89504e470d0a1a0a', 'hex');

function mutation() {
  return JSON.stringify({
    type: 'text', element: 'heading', property: 'text-content', direction: '', old_value: 'before', new_value: 'after', template: 'Heading changed',
  });
}

function row(port, id, noDiff = false) {
  return {
    id,
    image_before: { src: `http://127.0.0.1:${port}/${revision}/${id}-before.png` },
    image_after: { src: `http://127.0.0.1:${port}/${revision}/${id}-after.png` },
    user_query: 'Spot changes',
    ground_truth_diff: noDiff ? 'No change' : 'Heading changed',
    mutations_text: noDiff ? [] : ['Heading changed'],
    mutation_types: noDiff ? [] : ['mutate_text'],
    mutation_dicts_json: noDiff ? [] : [mutation()],
    task_type: noDiff ? 'no_diff' : 'visual_diff',
    difficulty: noDiff ? 'no_diff' : 'easy',
    domain: 'fixture',
    pixel_diff: noDiff ? 0 : 1,
    target_diff: noDiff ? 0 : 1,
    outside_diff: 0,
    target_bbox_x: noDiff ? -1 : 0,
    target_bbox_y: noDiff ? -1 : 0,
    target_bbox_w: noDiff ? -1 : 1,
    target_bbox_h: noDiff ? -1 : 1,
  };
}

function run(argumentsList, environment = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, [evaluator, ...argumentsList], {
      cwd: repositoryRoot,
      env: { ...process.env, ...environment },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', value => { stdout += value; });
    child.stderr.on('data', value => { stderr += value; });
    child.on('error', reject);
    child.on('close', status => resolveRun({ status, stdout, stderr }));
  });
}

test('prints bounded DiffSpot CLI help and rejects invalid limits/cache locations', async () => {
  const help = await run(['--help']);
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /--fetch-only/);

  const invalidLimit = await run(['--limit', '21']);
  assert.equal(invalidLimit.status, 1);
  assert.match(invalidLimit.stderr, /1 to 20/);

  const invalidCache = await run(['--cache-dir', '.']);
  assert.equal(invalidCache.status, 1);
  assert.match(invalidCache.stderr, /repository root/);

  const invalidOutput = await run(['--output-dir', '.']);
  assert.equal(invalidOutput.status, 1);
  assert.match(invalidOutput.stderr, /repository root/);
});

test('fetch-only acquires revision-pinned fixture images without provider calls', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'diffspot-cli-'));
  const cache = join(directory, 'cache');
  const results = join(directory, 'results');
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname === '/rows') {
      assert.equal(url.searchParams.get('dataset'), 'tencent/DiffSpot');
      assert.equal(url.searchParams.get('revision'), revision);
      const offset = Number(url.searchParams.get('offset'));
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({
        rows: offset === 0
          ? [{ row: row(server.address().port, 'changed') }]
          : [{ row: row(server.address().port, 'same', true) }],
      }));
      return;
    }
    response.setHeader('content-type', 'image/png');
    response.end(png);
  });
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  const port = server.address().port;
  try {
    const completed = await run(['--fetch-only', '--limit', '2', '--cache-dir', cache, '--output-dir', results], {
      AI_VISUAL_TEST_DIFFSPOT_ROWS_URL: `http://127.0.0.1:${port}/rows`,
    });
    assert.equal(completed.status, 0, completed.stderr);
    assert.deepEqual(JSON.parse(completed.stdout), {
      version: 2, mode: 'fetch-only', selected: 2, artifacts: 4, revision,
    });
    const receipt = JSON.parse(readFileSync(join(results, 'diffspot-acquisition-v1.json'), 'utf8'));
    assert.equal(receipt.status, 'available');
    assert.equal(receipt.artifacts.length, 4);
    assert.ok(receipt.artifacts.every(artifact => /^[a-f0-9]{64}$/.test(artifact.sha256)));
    assert.equal(readFileSync(join(cache, receipt.artifacts[0].path)).length, png.length);
    const examples = JSON.parse(readFileSync(join(results, 'diffspot-examples-v2.json'), 'utf8'));
    assert.equal(examples.selection.seed, `diffspot-${revision}`);
    assert.match(examples.selection.acquisitionSha256, /^[a-f0-9]{64}$/);
    assert.match(examples.selection.normalizedRowsSha256, /^[a-f0-9]{64}$/);
    assert.equal(examples.selection.normalizedRows.length, 2);
  } finally {
    await new Promise(resolveClose => server.close(resolveClose));
    rmSync(directory, { recursive: true, force: true });
  }
});

test('rejects oversized dataset rows and image bodies before provider evaluation', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'diffspot-size-'));
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname === '/oversized-rows') {
      response.setHeader('content-length', String(5 * 1024 * 1024 + 1));
      response.end();
      return;
    }
    if (url.pathname === '/rows') {
      const port = server.address().port;
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ rows: [{ row: row(port, `oversized-${url.searchParams.get('offset')}`) }] }));
      return;
    }
    response.setHeader('transfer-encoding', 'chunked');
    response.end(Buffer.alloc(20 * 1024 * 1024 + 1));
  });
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  const port = server.address().port;
  try {
    const oversizedRows = await run(['--fetch-only', '--limit', '1', '--cache-dir', join(directory, 'cache'), '--output-dir', join(directory, 'out')], {
      AI_VISUAL_TEST_DIFFSPOT_ROWS_URL: `http://127.0.0.1:${port}/oversized-rows`,
    });
    assert.equal(oversizedRows.status, 1);
    assert.match(oversizedRows.stderr, /dataset rows exceeded/);

    const oversizedImage = await run(['--fetch-only', '--limit', '1', '--cache-dir', join(directory, 'cache'), '--output-dir', join(directory, 'out')], {
      AI_VISUAL_TEST_DIFFSPOT_ROWS_URL: `http://127.0.0.1:${port}/rows`,
    });
    assert.equal(oversizedImage.status, 1);
    assert.match(oversizedImage.stderr, /selected DiffSpot image exceeded/);
  } finally {
    await new Promise(resolveClose => server.close(resolveClose));
    rmSync(directory, { recursive: true, force: true });
  }
});
