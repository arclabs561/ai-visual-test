import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const evaluator = join(repositoryRoot, 'scripts/evaluate-apple-rldf.mjs');
const ranking = 'rldf_suppl_new/rldf_dataset/ranking_training_dataset_hf/data-00000-of-00001.arrow';
const revision = 'rldf_suppl_new/rldf_dataset/revision_training_dataset_hf/data-00000-of-00001.arrow';

function zip(entries) {
  const locals = []; const central = []; let offset = 0;
  for (const [name, body] of entries) {
    const file = Buffer.from(body); const path = Buffer.from(name); const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt32LE(0, 14); local.writeUInt32LE(file.length, 18); local.writeUInt32LE(file.length, 22); local.writeUInt16LE(path.length, 26);
    locals.push(local, path, file);
    const entry = Buffer.alloc(46); entry.writeUInt32LE(0x02014b50, 0); entry.writeUInt16LE(20, 4); entry.writeUInt16LE(20, 6); entry.writeUInt32LE(0, 16); entry.writeUInt32LE(file.length, 20); entry.writeUInt32LE(file.length, 24); entry.writeUInt16LE(path.length, 28); entry.writeUInt32LE(offset, 42);
    central.push(entry, path); offset += local.length + path.length + file.length;
  }
  const directory = Buffer.concat(central); const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

function run(args, env = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, [evaluator, ...args], { cwd: repositoryRoot, env: { ...process.env, NODE_ENV: 'test', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = ''; child.stdout.on('data', data => { stdout += data; }); child.stderr.on('data', data => { stderr += data; });
    child.on('error', reject); child.on('close', status => resolveRun({ status, stdout, stderr }));
  });
}

test('Apple ML-RLDF fetch-only verifies a pinned archive, extracts only Arrow files, and keeps output private', async () => {
  const fixture = zip([[ranking, Buffer.from('ranking-arrow')], [revision, Buffer.from('revision-arrow')]]);
  const directory = mkdtempSync(join(tmpdir(), 'apple-rldf-cli-')); const cache = join(directory, 'cache'); const output = join(directory, 'output');
  const server = createServer((request, response) => {
    assert.equal(request.url, '/rldf.zip'); response.setHeader('content-type', 'application/zip'); response.end(fixture);
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  try {
    const completed = await run(['--fetch-only', '--cache-dir', cache, '--output-dir', output], {
      AI_VISUAL_TEST_APPLE_RLDF_ZIP_URL: `http://127.0.0.1:${server.address().port}/rldf.zip`,
      AI_VISUAL_TEST_APPLE_RLDF_ZIP_SHA256: createHash('sha256').update(fixture).digest('hex'),
    });
    assert.equal(completed.status, 0, completed.stderr);
    assert.deepEqual(JSON.parse(completed.stdout), { version: 2, mode: 'fetch-only', artifacts: 3, revision: 'be0d7f816ded6fa5111035f34f69b077072ba9a3' });
    const runDirectory = join(output, readdirSync(output).find(name => name.startsWith('apple-rldf-acquisition-')));
    const receipt = JSON.parse(readFileSync(join(runDirectory, 'apple-rldf-acquisition-v1.json'), 'utf8'));
    assert.equal(receipt.status, 'available'); assert.equal(receipt.artifacts.length, 3);
    assert.equal(readFileSync(join(cache, 'arrow/ranking_training_dataset_hf.arrow'), 'utf8'), 'ranking-arrow');
    assert.equal(readFileSync(join(cache, 'arrow/revision_training_dataset_hf.arrow'), 'utf8'), 'revision-arrow');
  } finally { await new Promise(done => server.close(done)); rmSync(directory, { recursive: true, force: true }); }
});

test('Apple ML-RLDF rejects invalid archive hashes and local evaluation counterbalances injected results', async () => {
  const { evaluateAppleRldfExamples, extractAppleRldfArrow } = await import('../../scripts/evaluate-apple-rldf.mjs');
  assert.throws(() => extractAppleRldfArrow(Buffer.from('not a zip')), /safety limit|end-of-central-directory/);
  const examples = [{ id: 'fixture', imageA: 'a.png', imageB: 'b.png', description: 'a fixture', votes: { A: 1, B: 0 } }];
  const results = await evaluateAppleRldfExamples(examples, async (_a, _b, _description, context) => ({ prediction: context.order === 'AB' ? 'A' : 'B' }));
  assert.deepEqual(results, [{ id: 'fixture', prediction: 'A', orders: [{ order: 'AB', prediction: 'A' }, { order: 'BA', prediction: 'B' }] }]);
  const bad = await run(['--fetch-only'], { AI_VISUAL_TEST_APPLE_RLDF_ZIP_URL: 'http://127.0.0.1:1/rldf.zip', AI_VISUAL_TEST_APPLE_RLDF_ZIP_SHA256: 'not-a-hash' });
  assert.equal(bad.status, 1); assert.match(bad.stderr, /test SHA-256/);
});

test('Apple ML-RLDF writes a private metadata-only receipt when a hash-verified archive is malformed', async () => {
  const fixture = Buffer.from('not a ZIP archive'); const directory = mkdtempSync(join(tmpdir(), 'apple-rldf-failure-')); const output = join(directory, 'output');
  const server = createServer((_request, response) => { response.setHeader('content-type', 'application/zip'); response.end(fixture); });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  try {
    const completed = await run(['--fetch-only', '--cache-dir', join(directory, 'cache'), '--output-dir', output], {
      AI_VISUAL_TEST_APPLE_RLDF_ZIP_URL: `http://127.0.0.1:${server.address().port}/rldf.zip`,
      AI_VISUAL_TEST_APPLE_RLDF_ZIP_SHA256: createHash('sha256').update(fixture).digest('hex'),
    });
    assert.equal(completed.status, 1); assert.match(completed.stderr, /safety limit|end-of-central-directory/);
    const acquisitionDirectory = join(output, readdirSync(output).find(name => name.startsWith('apple-rldf-acquisition-')));
    const receipt = JSON.parse(readFileSync(join(acquisitionDirectory, 'apple-rldf-acquisition-v1.json'), 'utf8'));
    assert.deepEqual({ status: receipt.status, artifacts: receipt.artifacts }, { status: 'metadata-only', artifacts: [] });
    assert.match(receipt.blockedReason, /safety limit|end-of-central-directory/);
  } finally { await new Promise(done => server.close(done)); rmSync(directory, { recursive: true, force: true }); }
});

test('Apple ML-RLDF rejects tampered normalized records before any local evaluator can be reached', async () => {
  const { verifyAppleRldfPreparedRecords } = await import('../../scripts/evaluate-apple-rldf.mjs');
  const directory = mkdtempSync(join(tmpdir(), 'apple-rldf-bindings-')); const cache = join(directory, 'cache'); const prepared = join(directory, 'prepared');
  mkdirSync(join(cache, 'arrow'), { recursive: true, mode: 0o700 }); mkdirSync(join(cache, 'images'), { recursive: true, mode: 0o700 }); mkdirSync(prepared, { mode: 0o700 });
  const writePrivate = (path, value) => { writeFileSync(path, value, { mode: 0o600 }); chmodSync(path, 0o600); };
  const arrowA = join(cache, 'arrow/ranking_training_dataset_hf.arrow'); const arrowB = join(cache, 'arrow/revision_training_dataset_hf.arrow'); const image = join(cache, 'images/chosen.png'); const imageB = join(cache, 'images/rejected.png');
  writePrivate(arrowA, 'ranking'); writePrivate(arrowB, 'revision'); writePrivate(image, Buffer.from('89504e470d0a1a0a', 'hex')); writePrivate(imageB, Buffer.from('89504e470d0a1a0a00', 'hex'));
  const acquisition = join(directory, 'acquisition.json'); writePrivate(acquisition, '{}');
  const records = join(prepared, 'apple-rldf-records-v1.json'); writePrivate(records, JSON.stringify([{ kind: 'revision', chosen_image: { path: image }, rejected_image: { path: imageB } }]));
  const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
  const normalization = join(prepared, 'apple-rldf-normalization-v1.json');
  writePrivate(normalization, JSON.stringify({ version: 1, key: 'apple-rldf', revision: 'be0d7f816ded6fa5111035f34f69b077072ba9a3', acquisition: { sha256: hash(acquisition) }, records: { path: 'apple-rldf-records-v1.json', sha256: hash(records) }, arrowArtifacts: [{ path: 'arrow/ranking_training_dataset_hf.arrow', sha256: hash(arrowA) }, { path: 'arrow/revision_training_dataset_hf.arrow', sha256: hash(arrowB) }], images: [{ path: image, bytes: readFileSync(image).length, sha256: hash(image) }, { path: imageB, bytes: readFileSync(imageB).length, sha256: hash(imageB) }] }));
  try {
    assert.equal(verifyAppleRldfPreparedRecords({ acquisitionPath: acquisition, recordsPath: records, normalizationPath: normalization, cacheDirectory: cache }).length, 1);
    writePrivate(records, JSON.stringify([{ kind: 'revision', chosen_image: { path: image }, rejected_image: { path: imageB }, injected: true }]));
    assert.throws(() => verifyAppleRldfPreparedRecords({ acquisitionPath: acquisition, recordsPath: records, normalizationPath: normalization, cacheDirectory: cache }), /exact normalizer output/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
