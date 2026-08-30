import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const evaluator = join(repositoryRoot, 'scripts/evaluate-vibe.mjs');
const designRevision = 'ee85ae467e14b1f454036544eb37eec0e2ab6368';
const png = Buffer.from('89504e470d0a1a0a', 'hex');

function designRow(port, id) {
  return {
    image_a: { src: `http://127.0.0.1:${port}/assets/${designRevision}/${id}-a.png` },
    image_b: { src: `http://127.0.0.1:${port}/assets/${designRevision}/${id}-b.png` },
    app_a: `${id}-a`, app_b: `${id}-b`, votes_a: 9, votes_b: 3, winner: 'app_a',
  };
}

function run(argumentsList, environment = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, [evaluator, ...argumentsList], {
      cwd: repositoryRoot, env: { ...process.env, NODE_ENV: 'test', ...environment }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', value => { stdout += value; }); child.stderr.on('data', value => { stderr += value; });
    child.on('error', reject); child.on('close', status => resolveRun({ status, stdout, stderr }));
  });
}

function acquisitionDirectory(parent) {
  const entries = readdirSync(parent).filter(name => name.startsWith('vibe-acquisition-'));
  assert.equal(entries.length, 1);
  return join(parent, entries[0]);
}

test('prints Vibe help, bounds limits, and requires a dataset', async () => {
  const help = await run(['--help']);
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /--dataset design\|landing/);
  const missing = await run(['--fetch-only']);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /--dataset is required/);
  const limit = await run(['--dataset', 'design', '--limit', '21']);
  assert.equal(limit.status, 1);
  assert.match(limit.stderr, /1 to 20/);
});

test('writes a private blocked receipt for absent credentials and denied gated rows', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'vibe-blocked-'));
  try {
    const missingParent = join(directory, 'missing');
    const missing = await run(['--dataset', 'design', '--fetch-only', '--cache-dir', join(directory, 'cache-a'), '--output-dir', missingParent], { HF_TOKEN: '', AI_VISUAL_TEST_VIBE_ROWS_URL: undefined });
    assert.equal(missing.status, 1); assert.match(missing.stderr, /blocked receipt:/);
    const absentReceipt = JSON.parse(readFileSync(join(acquisitionDirectory(missingParent), 'vibe-acquisition-v1.json'), 'utf8'));
    assert.deepEqual({ status: absentReceipt.status, artifacts: absentReceipt.artifacts }, { status: 'blocked', artifacts: [] });
    assert.match(absentReceipt.blockedReason, /HF_TOKEN was not provided/);

    const server = createServer((_request, response) => { response.statusCode = 401; response.end('denied'); });
    await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
    try {
      const deniedParent = join(directory, 'denied');
      const denied = await run(['--dataset', 'design', '--fetch-only', '--cache-dir', join(directory, 'cache-b'), '--output-dir', deniedParent], { AI_VISUAL_TEST_VIBE_ROWS_URL: `http://127.0.0.1:${server.address().port}/rows` });
      assert.equal(denied.status, 1); assert.match(denied.stderr, /gated Vibe dataset access was denied/);
      const deniedReceipt = JSON.parse(readFileSync(join(acquisitionDirectory(deniedParent), 'vibe-acquisition-v1.json'), 'utf8'));
      assert.equal(deniedReceipt.status, 'blocked'); assert.equal(deniedReceipt.blockedReason, 'gated dataset access was denied by the source');
    } finally { await new Promise(resolveClose => server.close(resolveClose)); }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('fetch-only uses the test-only loopback source, pins revision, and stores opaque digested artifacts', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'vibe-cli-'));
  const cache = join(directory, 'cache'); const output = join(directory, 'output');
  let requests = 0;
  const server = createServer((request, response) => {
    requests++;
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname === '/rows') {
      assert.equal(url.searchParams.get('dataset'), 'datapointai/vibe-design-arena');
      assert.equal(url.searchParams.get('config'), 'comparisons');
      assert.equal(url.searchParams.get('revision'), designRevision);
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ rows: [{ row: designRow(server.address().port, 'first') }, { row: designRow(server.address().port, 'second') }] }));
      return;
    }
    response.setHeader('content-type', 'image/png'); response.end(png);
  });
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  const port = server.address().port;
  try {
    const completed = await run(['--dataset', 'design', '--fetch-only', '--limit', '2', '--cache-dir', cache, '--output-dir', output], {
      AI_VISUAL_TEST_VIBE_ROWS_URL: `http://127.0.0.1:${port}/rows`,
    });
    assert.equal(completed.status, 0, completed.stderr);
    assert.deepEqual(JSON.parse(completed.stdout), { version: 2, mode: 'fetch-only', dataset: 'vibe-design-arena', selected: 2, artifacts: 5, revision: designRevision });
    const acquisitionOutput = acquisitionDirectory(output);
    const acquisition = JSON.parse(readFileSync(join(acquisitionOutput, 'vibe-acquisition-v1.json'), 'utf8'));
    assert.equal(acquisition.status, 'available');
    assert.equal(acquisition.artifacts.length, 5);
    assert.ok(acquisition.artifacts.some(artifact => /^rows\/[a-f0-9]{32}\.json$/.test(artifact.path)));
    assert.ok(acquisition.artifacts.filter(artifact => artifact.path.startsWith('images/')).every(artifact => /^images\/[a-f0-9]{32}\.png$/.test(artifact.path) && /^[a-f0-9]{64}$/.test(artifact.sha256) && artifact.contentType === 'image/png'));
    const examples = JSON.parse(readFileSync(join(acquisitionOutput, 'vibe-examples-v2.json'), 'utf8'));
    assert.equal(examples.selection.seed, `vibe-design-${designRevision}`);
    assert.equal(examples.selection.normalizedRows.length, 2);
    const acquiredRequests = requests;
    const evaluation = await run(['--dataset', 'design', '--evaluate-existing', acquisitionOutput, '--cache-dir', cache, '--output-dir', join(directory, 'evaluation')], {
      AI_VISUAL_TEST_VIBE_ROWS_URL: `http://127.0.0.1:${port}/rows`,
    });
    assert.equal(evaluation.status, 1);
    assert.match(evaluation.stderr, /AI_VISUAL_TEST_LIVE=1/);
    assert.equal(requests, acquiredRequests, 'evaluate-existing must not refetch rows or pixels');
    const { evaluateExistingRun } = await import('../../scripts/evaluate-vibe.mjs');
    const injectedOutput = join(directory, 'injected-output'); mkdirSync(injectedOutput, { mode: 0o700 });
    const uploadConfirmation = { dataset: 'vibe-design-arena', purpose: 'research-evaluation', provider: 'openrouter', model: 'fixture-model', confirmedBy: 'test', confirmedAt: '2026-01-01T00:00:00Z', acknowledgements: ['gated-dataset-terms-accepted', 'provider-upload-permitted'] };
    const injected = await evaluateExistingRun({
      dataset: { key: 'vibe-design-arena' }, inputDirectory: acquisitionOutput, cacheDirectory: cache, outputDirectory: injectedOutput, uploadConfirmation,
      evaluator: async (_a, _b, _prompt, context) => {
        assert.deepEqual({ provider: context.provider, model: context.model }, { provider: 'openrouter', model: 'fixture-model' });
        return { enabled: true, provider: 'openrouter', model: 'fixture-model', winner: 'A', counterBalance: { enabled: true, canonicalWinners: ['A', 'A'] } };
      },
    });
    assert.equal(injected.selected, 2);
    assert.equal(JSON.parse(readFileSync(join(injectedOutput, 'vibe-results-v2.json'), 'utf8')).run.provider.model, 'fixture-model');
  } finally {
    await new Promise(resolveClose => server.close(resolveClose));
    rmSync(directory, { recursive: true, force: true });
  }
});

test('rejects non-image bytes before writing an artifact', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'vibe-non-image-'));
  const cache = join(directory, 'cache'); const output = join(directory, 'output');
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname === '/rows') {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ rows: [{ row: designRow(server.address().port, 'bad') }] })); return;
    }
    response.setHeader('content-type', 'text/html'); response.end('<html>not an image</html>');
  });
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  try {
    const completed = await run(['--dataset', 'design', '--fetch-only', '--limit', '1', '--cache-dir', cache, '--output-dir', output], {
      AI_VISUAL_TEST_VIBE_ROWS_URL: `http://127.0.0.1:${server.address().port}/rows`,
    });
    assert.equal(completed.status, 1);
    assert.match(completed.stderr, /Vibe acquisition was unavailable or malformed/);
    const receipt = JSON.parse(readFileSync(join(acquisitionDirectory(output), 'vibe-acquisition-v1.json'), 'utf8'));
    assert.equal(receipt.status, 'metadata-only');
  } finally { await new Promise(resolveClose => server.close(resolveClose)); rmSync(directory, { recursive: true, force: true }); }
});

test('requires exactly two unambiguous counterbalanced predictions before scoring', async () => {
  const { assertRunMatchesUploadDecision, extractVibeOrderPredictions } = await import('../../scripts/evaluate-vibe.mjs');
  assert.deepEqual(extractVibeOrderPredictions({ counterBalance: { enabled: true, canonicalWinners: ['A', 'B'] } }), [
    { order: 'AB', prediction: 'A' }, { order: 'BA', prediction: 'A' },
  ]);
  assert.throws(() => extractVibeOrderPredictions({ counterBalance: { enabled: true, canonicalWinners: ['A'] } }), /exactly AB and BA/);
  assert.throws(() => extractVibeOrderPredictions({ counterBalance: { enabled: true, canonicalWinners: ['A', null] } }), /missing or ambiguous/);
  assert.throws(() => assertRunMatchesUploadDecision({ provider: { provider: 'one' } }, { provider: 'two' }), /does not match/);
});
