import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

import { assertOfficialRicoArchivePin, evaluateExistingUICritRun, evaluateLocalModelUICritRun, evaluateUICritRecords, parseBoundedCsv, UICritEvaluationError } from '../../scripts/evaluate-uicrit.mjs';

const record = Object.freeze({ id: 'uicrit:123', screenshotRef: { id: '123' } });
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const evaluator = resolve(repositoryRoot, 'scripts/evaluate-uicrit.mjs');

function tarEntry(name, bytes, type = '0') {
  const header = Buffer.alloc(512);
  header.write(name, 0, 'utf8');
  header.write('0000644\0', 100, 'ascii');
  header.write('0000000\0', 108, 'ascii'); header.write('0000000\0', 116, 'ascii');
  header.write(`${bytes.length.toString(8).padStart(11, '0')}\0`, 124, 'ascii');
  header.write('00000000000\0', 136, 'ascii'); header.fill(32, 148, 156); header[156] = type.charCodeAt(0);
  header.write('ustar\0', 257, 'ascii'); header.write('00', 263, 'ascii');
  const checksum = header.reduce((sum, value) => sum + value, 0);
  header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148, 'ascii');
  const padding = Buffer.alloc((512 - (bytes.length % 512)) % 512);
  return Buffer.concat([header, bytes, padding]);
}

function ricoArchive(entries) { return gzipSync(Buffer.concat([...entries, Buffer.alloc(1024)])); }
function jsonHash(value) { return createHash('sha256').update(`${JSON.stringify(value, null, 2)}\n`).digest('hex'); }

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

test('requires explicit local pixels and upload confirmation outside fetch-only mode', () => {
  const help = spawnSync(process.execPath, [evaluator, '--help'], { cwd: repositoryRoot, encoding: 'utf8' });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /--fetch-only/);
  const result = spawnSync(process.execPath, [evaluator], { cwd: repositoryRoot, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /choose exactly one/);
});

test('parses quoted UICrit CSV fields without evaluating annotation content', () => {
  const rows = parseBoundedCsv(Buffer.from([
    'rico_id,comments,score',
    '123,"[""human text, still data""]",6',
  ].join('\r\n')));
  assert.deepEqual(rows, [{ rico_id: '123', comments: '["human text, still data"]', score: '6' }]);
  assert.throws(() => parseBoundedCsv(Buffer.from('a,b\n1,"unterminated')), UICritEvaluationError);
});

test('rejects a RICO archive whose locally observed acquisition pin does not match', () => {
  assert.throws(
    () => assertOfficialRicoArchivePin({ path: 'source/rico-unique_uis.tar.gz', bytes: 1, sha256: '0'.repeat(64) }),
    /independently observed acquisition pin/,
  );
});

test('fetch-only accepts only the test loopback CSV and records annotation-only evidence', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'uicrit-cli-'));
  const rows = [
    'rico_id,task,aesthetics_rating,learnability,efficency,usability_rating,design_quality_rating,comments_source,comments',
    ...[1, 2, 3].map(index => `123,Checkout,6,3,3,6,6,"['human']","[""comment ${index}""]"`),
  ].join('\r\n');
  // Mirrors the real RICO layout: a trailing-slash directory plus JPEGs below it.
  const archive = ricoArchive([
    tarEntry('combined/', Buffer.alloc(0), '5'),
    tarEntry('combined/123.jpg', Buffer.from('ffd8ff', 'hex')),
  ]);
  const server = createServer((request, response) => {
    if (request.url === '/uicrit_public.csv') { response.setHeader('content-type', 'text/csv'); response.end(rows); return; }
    assert.equal(request.url, '/unique_uis.tar.gz');
    response.setHeader('content-type', 'application/gzip'); response.setHeader('content-length', archive.length); response.end(archive);
  });
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  try {
    const completed = await run(['--fetch-only', '--limit', '1', '--cache-dir', join(directory, 'cache'), '--output-dir', join(directory, 'out')], {
      AI_VISUAL_TEST_UICRIT_CSV_URL: `http://127.0.0.1:${server.address().port}/uicrit_public.csv`,
    });
    assert.equal(completed.status, 0, completed.stderr);
    const receipt = JSON.parse(completed.stdout);
    assert.deepEqual({ ...receipt, outputDirectory: undefined }, {
      version: 2, mode: 'fetch-only', selected: 1, artifacts: 1,
      revision: 'adc92136cdaecf6a5c8bb85af08594dd9271eb00', pixels: 'not-acquired', outputDirectory: undefined,
    });
    const acquisition = JSON.parse(readFileSync(join(receipt.outputDirectory, 'uicrit-acquisition-v1.json'), 'utf8'));
    assert.equal(acquisition.annotationOnly, true);
    assert.equal(acquisition.artifacts.length, 1);
    const examples = JSON.parse(readFileSync(join(receipt.outputDirectory, 'uicrit-examples-v2.json'), 'utf8'));
    assert.equal(examples.splits[0].examples[0].id, 'uicrit:123');
    assert.equal(JSON.stringify(examples).includes('comment 1'), false);
    const pixels = JSON.parse(readFileSync(join(receipt.outputDirectory, 'uicrit-pixels-v1.json'), 'utf8'));
    assert.deepEqual(pixels.pixels, []);
    const confirmation = join(directory, 'confirmation.json');
    writeFileSync(confirmation, JSON.stringify({
      provider: 'openrouter', model: 'fixture-model', confirmedBy: 'test operator', confirmedAt: '2026-08-30T00:00:00Z',
      acknowledgements: ['local-pixel-rights-manifest-reviewed', 'provider-upload-permitted'], localPixelManifest: 'private/rights.json',
    }));
    chmodSync(confirmation, 0o600);
    const refused = await run(['--evaluate-existing', receipt.outputDirectory, '--cache-dir', join(directory, 'cache'), '--output-dir', join(directory, 'live'), '--upload-confirmation', confirmation], {
      AI_VISUAL_TEST_LIVE: '1',
    });
    assert.equal(refused.status, 1);
    assert.match(refused.stderr, /does not include cached pixels/);

    const rico = join(directory, 'rico');
    mkdirSync(rico);
    writeFileSync(join(rico, '123.png'), Buffer.from('89504e470d0a1a0a', 'hex'));
    const pixelReceipt = await run(['--fetch-only', '--limit', '1', '--rico-root', rico, '--cache-dir', join(directory, 'pixel-cache'), '--output-dir', join(directory, 'pixel-out')], {
      AI_VISUAL_TEST_UICRIT_CSV_URL: `http://127.0.0.1:${server.address().port}/uicrit_public.csv`,
    });
    assert.equal(pixelReceipt.status, 0, pixelReceipt.stderr);
    const pixelAcquisition = JSON.parse(pixelReceipt.stdout);
    assert.equal(pixelAcquisition.pixels, 'cached');
    const pixelMap = JSON.parse(readFileSync(join(pixelAcquisition.outputDirectory, 'uicrit-pixels-v1.json'), 'utf8'));
    assert.deepEqual(pixelMap.pixels.map(pixel => pixel.artifact.path), ['rico/123.png']);
    const completedEvaluation = await evaluateExistingUICritRun({
      existingOutputDirectory: pixelAcquisition.outputDirectory,
      cacheDirectory: join(directory, 'pixel-cache'),
      outputParentDirectory: join(directory, 'evaluated'),
      confirmation: JSON.parse(readFileSync(confirmation, 'utf8')),
      validate: async (_path, prompt) => ({
        enabled: true, provider: 'openrouter', model: 'fixture-model', score: /1 through 5/.test(prompt) ? 5 : 10,
      }),
    });
    assert.equal(completedEvaluation.selected, 1);
    const results = JSON.parse(readFileSync(join(completedEvaluation.outputDirectory, 'uicrit-results-v2.json'), 'utf8'));
    assert.equal(results.results[0].scores.efficiency, 5);
    assert.equal(results.run.provider.model, 'fixture-model');
    let preflightCalls = 0;
    await assert.rejects(evaluateExistingUICritRun({
      existingOutputDirectory: pixelAcquisition.outputDirectory,
      cacheDirectory: join(directory, 'pixel-cache'),
      outputParentDirectory: join(directory, 'alias-provider'),
      confirmation: { ...JSON.parse(readFileSync(confirmation, 'utf8')), provider: 'anthropic' },
      validate: async () => { preflightCalls += 1; return { enabled: true, provider: 'claude', model: 'fixture-model', score: 10 }; },
    }), /canonical selected provider name/);
    assert.equal(preflightCalls, 0);
    const tamperedExamplesPath = join(pixelAcquisition.outputDirectory, 'uicrit-examples-v2.json');
    const tamperedExamples = JSON.parse(readFileSync(tamperedExamplesPath, 'utf8'));
    tamperedExamples.selection.normalizedRows[0].ratings.aesthetics = 1;
    writeFileSync(tamperedExamplesPath, `${JSON.stringify(tamperedExamples)}\n`, { mode: 0o600 });
    let tamperedCalls = 0;
    await assert.rejects(evaluateExistingUICritRun({
      existingOutputDirectory: pixelAcquisition.outputDirectory,
      cacheDirectory: join(directory, 'pixel-cache'),
      outputParentDirectory: join(directory, 'tampered'),
      confirmation: JSON.parse(readFileSync(confirmation, 'utf8')),
      validate: async () => { tamperedCalls += 1; return { enabled: true, provider: 'openrouter', model: 'fixture-model', score: 10 }; },
    }), /normalized selection was altered/);
    assert.equal(tamperedCalls, 0);

    const missingPixelsOutput = join(directory, 'missing-pixels-out');
    const missingPixels = await run(['--fetch-only', '--limit', '1', '--rico-root', join(directory, 'missing-rico'), '--cache-dir', join(directory, 'missing-pixels-cache'), '--output-dir', missingPixelsOutput], {
      AI_VISUAL_TEST_UICRIT_CSV_URL: `http://127.0.0.1:${server.address().port}/uicrit_public.csv`,
    });
    assert.equal(missingPixels.status, 1);
    const [blockedRun] = readdirSync(missingPixelsOutput);
    const blocked = JSON.parse(readFileSync(join(missingPixelsOutput, blockedRun, 'uicrit-acquisition-v1.json'), 'utf8'));
    assert.deepEqual({ status: blocked.status, artifacts: blocked.artifacts, blockedReason: blocked.blockedReason }, {
      status: 'blocked', artifacts: [], blockedReason: 'unavailable: UICrit local RICO pixels could not be acquired',
    });
    const invalidRico = join(directory, 'invalid-rico');
    mkdirSync(invalidRico);
    writeFileSync(join(invalidRico, '123.png'), 'not a PNG');
    const invalidPixelsOutput = join(directory, 'invalid-pixels-out');
    const invalidPixels = await run(['--fetch-only', '--limit', '1', '--rico-root', invalidRico, '--cache-dir', join(directory, 'invalid-pixels-cache'), '--output-dir', invalidPixelsOutput], {
      AI_VISUAL_TEST_UICRIT_CSV_URL: `http://127.0.0.1:${server.address().port}/uicrit_public.csv`,
    });
    assert.equal(invalidPixels.status, 1);
    const [invalidRun] = readdirSync(invalidPixelsOutput);
    const invalidBlocked = JSON.parse(readFileSync(join(invalidPixelsOutput, invalidRun, 'uicrit-acquisition-v1.json'), 'utf8'));
    assert.equal(invalidBlocked.status, 'blocked');
    assert.equal(invalidBlocked.blockedReason, 'unavailable: UICrit local RICO pixels could not be acquired');

    const downloaded = await run(['--fetch-only', '--limit', '1', '--download-rico', '--cache-dir', join(directory, 'download-cache'), '--output-dir', join(directory, 'download-out')], {
      AI_VISUAL_TEST_UICRIT_CSV_URL: `http://127.0.0.1:${server.address().port}/uicrit_public.csv`,
      AI_VISUAL_TEST_RICO_ARCHIVE_URL: `http://127.0.0.1:${server.address().port}/unique_uis.tar.gz`,
    });
    assert.equal(downloaded.status, 0, downloaded.stderr);
    const downloadedReceipt = JSON.parse(downloaded.stdout);
    assert.equal(downloadedReceipt.pixels, 'cached');
    const downloadedAcquisition = JSON.parse(readFileSync(join(downloadedReceipt.outputDirectory, 'uicrit-acquisition-v1.json'), 'utf8'));
    assert.equal(downloadedAcquisition.ricoArchive.sourceUrl, `http://127.0.0.1:${server.address().port}/unique_uis.tar.gz`);
    assert.equal(downloadedAcquisition.ricoArchive.cacheArtifact.bytes, archive.length);
    assert.ok(readFileSync(join(directory, 'download-cache', 'rico', '123.jpg')).subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex')));
    const localResults = join(directory, 'local-results.json');
    writeFileSync(localResults, JSON.stringify({ results: [{ id: 'uicrit:123', scores: { aesthetics: 10, learnability: 5, efficiency: 5, usability: 10, 'design-quality': 10 } }] }), { mode: 0o600 });
    const localEvaluation = await run(['--evaluate-local', downloadedReceipt.outputDirectory, '--local-results', localResults, '--cache-dir', join(directory, 'download-cache'), '--output-dir', join(directory, 'local-eval')]);
    assert.equal(localEvaluation.status, 0, localEvaluation.stderr);
    assert.equal(JSON.parse(localEvaluation.stdout).mode, 'local-evaluated');
    const localCalls = [];
    const localModelEvaluation = await evaluateLocalModelUICritRun({
      existingOutputDirectory: downloadedReceipt.outputDirectory, cacheDirectory: join(directory, 'download-cache'), outputParentDirectory: join(directory, 'local-model-eval'), model: 'fixture-local-model',
      evaluate: async request => {
        localCalls.push(request);
        return { kind: 'scalar', score: /1 through 5/.test(request.prompt) ? 5 : 10 };
      },
    });
    assert.equal(localModelEvaluation.selected, 1);
    assert.equal(localCalls.length, 5);
    assert.ok(localCalls.every(call => call.imagePaths.length === 1 && call.responseKind === 'scalar' && call.model === 'fixture-local-model'));
    assert.ok(localCalls.every(call => call.prompt.includes('Respond exactly as JSON')));

    // A coordinated receipt edit must not be able to replace the human scores:
    // restore all self-hashes, then prove the cached source CSV still wins.
    const examplesPath = join(downloadedReceipt.outputDirectory, 'uicrit-examples-v2.json');
    const baselineExamples = JSON.parse(readFileSync(examplesPath, 'utf8'));
    const changedRatings = structuredClone(baselineExamples);
    changedRatings.selection.normalizedRows[0].ratings.aesthetics = 1;
    changedRatings.splits[0].examples[0].ratings.aesthetics = 1;
    changedRatings.selection.normalizedRowsSha256 = jsonHash(changedRatings.selection.normalizedRows);
    writeFileSync(examplesPath, `${JSON.stringify(changedRatings)}\n`, { mode: 0o600 });
    let coordinatedRatingCalls = 0;
    await assert.rejects(evaluateExistingUICritRun({
      existingOutputDirectory: downloadedReceipt.outputDirectory, cacheDirectory: join(directory, 'download-cache'), outputParentDirectory: join(directory, 'coordinated-ratings'), confirmation: JSON.parse(readFileSync(confirmation, 'utf8')),
      validate: async () => { coordinatedRatingCalls += 1; return { enabled: true, provider: 'openrouter', model: 'fixture-model', score: 10 }; },
    }), /does not match the verified source CSV/);
    assert.equal(coordinatedRatingCalls, 0);
    writeFileSync(examplesPath, `${JSON.stringify(baselineExamples)}\n`, { mode: 0o600 });

    // Valid but wrong cached pixels must not be swappable between numeric RICO IDs.
    const acquisitionPath = join(downloadedReceipt.outputDirectory, 'uicrit-acquisition-v1.json');
    const pixelsPath = join(downloadedReceipt.outputDirectory, 'uicrit-pixels-v1.json');
    const alteredAcquisition = JSON.parse(readFileSync(acquisitionPath, 'utf8'));
    const alteredExamples = JSON.parse(readFileSync(examplesPath, 'utf8'));
    const alteredPixels = JSON.parse(readFileSync(pixelsPath, 'utf8'));
    const wrongPixel = Buffer.from('ffd8ff', 'hex');
    writeFileSync(join(directory, 'download-cache', 'rico', '999.jpg'), wrongPixel, { mode: 0o600 });
    const wrongArtifact = { path: 'rico/999.jpg', bytes: wrongPixel.length, sha256: createHash('sha256').update(wrongPixel).digest('hex') };
    alteredAcquisition.artifacts = alteredAcquisition.artifacts.map(artifact => artifact.path === 'rico/123.jpg' ? wrongArtifact : artifact);
    alteredExamples.acquisition = alteredAcquisition;
    alteredExamples.selection.acquisitionSha256 = jsonHash(alteredAcquisition);
    alteredPixels.acquisitionSha256 = alteredExamples.selection.acquisitionSha256;
    alteredPixels.pixels[0].artifact = wrongArtifact;
    writeFileSync(acquisitionPath, `${JSON.stringify(alteredAcquisition)}\n`, { mode: 0o600 });
    writeFileSync(examplesPath, `${JSON.stringify(alteredExamples)}\n`, { mode: 0o600 });
    writeFileSync(pixelsPath, `${JSON.stringify(alteredPixels)}\n`, { mode: 0o600 });
    let swappedPixelCalls = 0;
    await assert.rejects(evaluateExistingUICritRun({
      existingOutputDirectory: downloadedReceipt.outputDirectory, cacheDirectory: join(directory, 'download-cache'), outputParentDirectory: join(directory, 'swapped-pixel'), confirmation: JSON.parse(readFileSync(confirmation, 'utf8')),
      validate: async () => { swappedPixelCalls += 1; return { enabled: true, provider: 'openrouter', model: 'fixture-model', score: 10 }; },
    }), /did not bind the record RICO ID/);
    assert.equal(swappedPixelCalls, 0);
  } finally {
    await new Promise(resolveClose => server.close(resolveClose));
    rmSync(directory, { recursive: true, force: true });
  }
});

test('scores every fixed UICrit dimension and never passes comments to the provider', async () => {
  const calls = [];
  const outcome = await evaluateUICritRecords([{ record, path: '/private/rico/123.png' }], {
    expectedProvider: 'fixture-provider',
    expectedModel: 'fixture-model',
    validate: async (image, prompt, context) => {
      calls.push({ image, prompt, context });
      const maximum = /1 through 5/.test(prompt) ? 5 : 10;
      return { enabled: true, provider: 'fixture-provider', model: 'fixture-model', score: maximum };
    },
  });
  assert.deepEqual(outcome.results, [{
    id: 'uicrit:123',
    scores: { aesthetics: 10, learnability: 5, efficiency: 5, usability: 10, 'design-quality': 10 },
  }]);
  assert.equal(calls.length, 5);
  assert.ok(calls.every(call => call.image === '/private/rico/123.png'));
  assert.ok(calls.every(call => call.context.testType.startsWith('uicrit-')));
  assert.ok(calls.every(call => call.context.provider === 'fixture-provider' && call.context.model === 'fixture-model'));
  assert.ok(calls.every(call => !call.prompt.includes('human text')));
});

test('rejects absent, non-finite, or scale-invalid UICrit provider scores', async () => {
  for (const score of [null, Number.NaN, Infinity, 0, 6.5, 11]) {
    await assert.rejects(
      evaluateUICritRecords([{ record, path: '/private/rico/123.png' }], {
        expectedProvider: 'fixture-provider',
        validate: async () => ({ enabled: true, provider: 'fixture-provider', model: 'fixture-model', score }),
      }),
      /score must be a finite integer/,
    );
  }
  await assert.rejects(
    evaluateUICritRecords([{ record, path: '/private/rico/123.png' }], {
      expectedProvider: 'fixture-provider',
      validate: async () => ({ enabled: true, provider: 'other-provider', model: 'fixture-model', score: 5 }),
    }),
    /did not match the operator upload confirmation/,
  );
  let calls = 0;
  await assert.rejects(
    evaluateUICritRecords([{ record, path: '/private/rico/123.png' }], {
      expectedProvider: 'fixture-provider', expectedModel: ' ', validate: async () => { calls += 1; return {}; },
    }),
    /model configuration must be a non-empty string/,
  );
  assert.equal(calls, 0);
});
