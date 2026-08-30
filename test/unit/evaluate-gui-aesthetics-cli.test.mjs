import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { characterizeExistingGuiAestheticsRun, characterizeGuiAestheticsRecords, evaluateExistingGuiAestheticsRun, evaluateGuiAestheticsRecords, parseGuiAestheticsLabels } from '../../scripts/evaluate-gui-aesthetics.mjs';

process.env.NODE_ENV = 'test';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const evaluator = join(repositoryRoot, 'scripts/evaluate-gui-aesthetics.mjs');
const png = Buffer.from('89504e470d0a1a0a', 'hex');
function imageBytes(id) { return Buffer.concat([png, Buffer.from(id)]); }

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

function fileId(index) { return `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`; }
function files(port) {
  return Array.from({ length: 36 }, (_, offset) => {
    const index = offset + 1; const id = fileId(index);
    const bytes = imageBytes(id);
    return { id, filename: `${String(index).padStart(2, '0')}.png`, content_details: {
      content_type: 'image/png', size: bytes.byteLength, sha256_hash: createHash('sha256').update(bytes).digest('hex'),
      download_url: `http://127.0.0.1:${port}/images/${id}`,
    } };
  });
}

function labels() {
  return { version: 1, dataset: 'dataset-interfaces-gui', revision: '1', labels: Array.from({ length: 36 }, (_, offset) => ({ filename: `${String(offset + 1).padStart(2, '0')}.png`, aestheticClass: 'low', rating: 1 })) };
}

test('uses the exact low/medium/high class and rating manifest schema', () => {
  assert.deepEqual(parseGuiAestheticsLabels(labels()), [
    ...Array.from({ length: 36 }, (_, offset) => ({ filename: `${String(offset + 1).padStart(2, '0')}.png`, aestheticClass: 'low', rating: 1 })),
  ]);
  assert.throws(() => parseGuiAestheticsLabels({ ...labels(), labels: [{ filename: '01.png', aestheticClass: 'high', rating: 1 }] }), /exact low=1/);
  assert.throws(() => parseGuiAestheticsLabels({ ...labels(), revision: 'latest' }), /version 1/);
});

test('fetch-only anonymously acquires bounded hashed public pixels and injected evaluation stays offline', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'gui-aesthetics-'));
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname === '/files') {
      assert.equal(url.searchParams.get('version'), '1');
      response.setHeader('content-type', 'application/json'); response.end(JSON.stringify(files(server.address().port))); return;
    }
    if (url.pathname.startsWith('/images/')) { response.setHeader('content-type', 'image/png'); response.end(imageBytes(url.pathname.slice('/images/'.length))); return; }
    response.statusCode = 404; response.end('not found');
  });
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  try {
    const cache = join(directory, 'cache'); const output = join(directory, 'output');
    const completed = await run(['--fetch-only', '--limit', '2', '--cache-dir', cache, '--output-dir', output], {
      AI_VISUAL_TEST_GUI_AESTHETICS_FILES_URL: `http://127.0.0.1:${server.address().port}/files?version=1`,
    });
    assert.equal(completed.status, 0, completed.stderr);
    const receipt = JSON.parse(completed.stdout);
    assert.deepEqual({ mode: receipt.mode, selected: receipt.selected, artifacts: receipt.artifacts, revision: receipt.revision, labels: receipt.labels }, { mode: 'fetch-only', selected: 2, artifacts: 3, revision: '1', labels: 'not-provided' });
    const acquisition = JSON.parse(readFileSync(join(receipt.outputDirectory, 'gui-aesthetics-acquisition-v1.json'), 'utf8'));
    assert.equal(acquisition.status, 'available'); assert.equal(acquisition.artifacts.length, 3);
    const images = JSON.parse(readFileSync(join(receipt.outputDirectory, 'gui-aesthetics-images-v1.json'), 'utf8'));
    assert.equal(images.images.length, 2);
    assert.ok(images.images.every(image => /^images\/[a-f0-9]{64}\.png$/.test(image.artifact.path)));

    const labelPath = join(directory, 'labels.json'); writeFileSync(labelPath, JSON.stringify(labels())); chmodSync(labelPath, 0o600);
    const evaluated = await evaluateExistingGuiAestheticsRun({
      existingOutputDirectory: receipt.outputDirectory, cacheDirectory: cache, outputParentDirectory: join(directory, 'evaluated'), labels: parseGuiAestheticsLabels(labels()), provider: 'openrouter', model: 'fixture-model',
      validate: async (_path, _prompt, context) => ({ enabled: true, provider: context.provider, model: context.model, score: 1 }),
    });
    assert.equal(evaluated.selected, 2); assert.equal(evaluated.metrics.total, 2); assert.equal(evaluated.metrics.correct, 2);
    const results = JSON.parse(readFileSync(join(evaluated.outputDirectory, 'gui-aesthetics-results-v1.json'), 'utf8'));
    assert.equal(results.run.uploadDecision.provider, 'openrouter');
    const characterized = await characterizeExistingGuiAestheticsRun({
      existingOutputDirectory: receipt.outputDirectory, cacheDirectory: cache, outputParentDirectory: join(directory, 'characterized'), localModel: 'fixture-local', limit: 2,
      localEvaluate: async () => ({ kind: 'scalar', score: 2 }),
    });
    assert.deepEqual(characterized.distribution, { low: 0, medium: 2, high: 0 });
    const characterization = JSON.parse(readFileSync(join(characterized.outputDirectory, 'gui-aesthetics-characterization-v1.json'), 'utf8'));
    assert.deepEqual(characterization.claims, { labelsUsed: false, evaluation: false, releaseGate: false, accuracy: 'not-computed' });

    const tampered = JSON.parse(readFileSync(join(receipt.outputDirectory, 'gui-aesthetics-images-v1.json'), 'utf8'));
    tampered.images[0].artifact = tampered.images[1].artifact;
    writeFileSync(join(receipt.outputDirectory, 'gui-aesthetics-images-v1.json'), JSON.stringify(tampered), { mode: 0o600 });
    let scoredCalls = 0;
    await assert.rejects(evaluateExistingGuiAestheticsRun({
      existingOutputDirectory: receipt.outputDirectory, cacheDirectory: cache, outputParentDirectory: join(directory, 'tampered-evaluated'), labels: parseGuiAestheticsLabels(labels()), provider: 'openrouter', model: 'fixture-model',
      validate: async () => { scoredCalls += 1; return { enabled: true, provider: 'openrouter', model: 'fixture-model', score: 1 }; },
    }), /filename, file id, or artifact did not match/);
    assert.equal(scoredCalls, 0);
    let characterizationCalls = 0;
    await assert.rejects(characterizeExistingGuiAestheticsRun({
      existingOutputDirectory: receipt.outputDirectory, cacheDirectory: cache, outputParentDirectory: join(directory, 'tampered-characterized'), localModel: 'fixture-local', limit: 2,
      localEvaluate: async () => { characterizationCalls += 1; return { kind: 'scalar', score: 2 }; },
    }), /filename, file id, or artifact did not match/);
    assert.equal(characterizationCalls, 0);
  } finally {
    await new Promise(resolveClose => server.close(resolveClose));
    rmSync(directory, { recursive: true, force: true });
  }
});

test('injectable evaluators reject invalid tiers without contacting a provider', async () => {
  await assert.rejects(evaluateGuiAestheticsRecords([{ id: 'x', path: '/private/x.png', label: { aestheticClass: 'medium', rating: 2 } }], {
    provider: 'openrouter', model: 'fixture-model', validate: async () => ({ enabled: true, provider: 'openrouter', model: 'fixture-model', score: 4 }),
  }), /integer score from 1 through 3/);
  const local = await evaluateGuiAestheticsRecords([{ id: 'x', path: '/private/x.png', label: { aestheticClass: 'medium', rating: 2 } }], {
    localModel: 'fixture-local', localEvaluate: async () => ({ kind: 'scalar', score: 2 }),
  });
  assert.deepEqual(local.metrics, { total: 1, correct: 1, accuracy: 1 });
  const characterization = await characterizeGuiAestheticsRecords([{ id: 'x', filename: '01.png', path: '/private/x.png' }], {
    localModel: 'fixture-local', localEvaluate: async () => ({ kind: 'scalar', score: 3 }),
  });
  assert.deepEqual(characterization.distribution, { low: 0, medium: 0, high: 1 });
});
