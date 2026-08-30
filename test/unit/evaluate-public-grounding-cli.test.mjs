import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { createHash } from 'node:crypto';

import { computeGroundingMetrics, evaluateExistingPublicGroundingRun, evaluateLocalModelPublicGroundingRun, main, parseArguments } from '../../scripts/evaluate-public-grounding.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const json = value => `${JSON.stringify(value, null, 2)}\n`;
function fixture(directory) {
  const cache = join(directory, 'cache'); const input = join(directory, 'input'); const output = join(directory, 'output'); mkdirSync(cache); mkdirSync(input); mkdirSync(output); mkdirSync(join(cache, 'annotations')); mkdirSync(join(cache, 'images'));
  const record = { image_path: 'element_grounding/a.png', image_size: [100, 50], prompt_to_evaluate: 'target', bbox: [0, 0, 1, 1], platform: 'test' };
  const annotationBytes = Buffer.from(JSON.stringify([record])); const annotationPath = 'annotations/a.json'; writeFileSync(join(cache, annotationPath), annotationBytes);
  const id = `ui-vision:${hash(`${record.image_path}\0${record.prompt_to_evaluate}`).slice(0, 24)}`; const imagePath = `images/${hash(id).slice(0, 32)}.png`; const bytes = Buffer.from('89504e470d0a1a0a', 'hex'); writeFileSync(join(cache, imagePath), bytes);
  const acquisition = { version: 1, key: 'ui-vision', provenance: { revision: '766c66aeffef16608d4916525902d9fb2598d7ce' }, status: 'available', artifacts: [{ path: annotationPath, bytes: annotationBytes.length, sha256: hash(annotationBytes) }, { path: imagePath, bytes: bytes.length, sha256: hash(bytes) }] };
  const normalized = [{ id, imagePath: record.image_path, instruction: 'target', bbox: { left: 0, top: 0, right: 1, bottom: 1 }, imageSize: { width: 100, height: 50 }, groupId: 'test' }];
  const examples = [{ id, groupId: 'test', imageArtifact: imagePath, instruction: 'target', bbox: { left: 0, top: 0, right: 1, bottom: 1 }, imageSize: { width: 100, height: 50 } }];
  writeFileSync(join(input, 'grounding-acquisition-v1.json'), JSON.stringify(acquisition));
  writeFileSync(join(input, 'grounding-examples-v1.json'), JSON.stringify({ dataset: 'ui-vision', acquisitionSha256: hash(json(acquisition)), selection: { seed: 'ui-vision-766c66aeffef16608d4916525902d9fb2598d7ce', normalizedRecordsSha256: hash(json(normalized)), normalizedRecords: normalized }, examples }));
  return { cache, input, output, acquisition, examples };
}

test('parses only bounded public datasets and mutually exclusive modes', () => {
  assert.equal(parseArguments(['--dataset', 'ui-vision', '--fetch-only', '--limit', '20']).limit, 20);
  assert.throws(() => parseArguments(['--dataset', 'vibe', '--fetch-only']), /ui-vision or screenspot-pro/);
  assert.throws(() => parseArguments(['--dataset', 'ui-vision', '--fetch-only', '--evaluate-existing', 'x']), /choose exactly one/);
  assert.throws(() => parseArguments(['--dataset', 'ui-vision', '--evaluate-existing', 'x']), /requires --local-model/);
  assert.throws(() => parseArguments(['--dataset', 'ui-vision', '--fetch-only', '--limit', '21']), /1 to 20/);
});

test('local model runner uses the grounding-only local evaluator seam', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'public-grounding-')); const { cache, input, output, acquisition } = fixture(directory);
  const calls = [];
  try {
    const result = await evaluateLocalModelPublicGroundingRun({ dataset: { key: 'ui-vision', revision: acquisition.provenance.revision }, inputDirectory: input, cacheDirectory: cache, outputDirectory: output, model: 'local-test', evaluate: async request => { calls.push(request); return { kind: 'grounding', x: 0, y: 0 }; } });
    assert.equal(result.metrics.hits, 1); assert.equal(calls.length, 1); assert.equal(calls[0].responseKind, 'grounding'); assert.match(calls[0].prompt, /100 by 50/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('computes exact point-in-bbox metrics without a provider', () => {
  const examples = [{ id: 'one', bbox: { left: 1, top: 2, right: 3, bottom: 4 } }, { id: 'two', bbox: { left: 5, top: 5, right: 6, bottom: 6 } }];
  assert.deepEqual(computeGroundingMetrics(examples, [{ id: 'one', point: { x: 2, y: 3 } }, { id: 'two', point: { x: 7, y: 6 } }]), { totalExamples: 2, observed: 2, hits: 1, pointInBboxRate: 0.5, missingResults: [] });
});

test('rejects tampered cached pixels before calling an injected evaluator', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'public-grounding-')); const { cache, input, output, acquisition } = fixture(directory); acquisition.artifacts[1].sha256 = '0'.repeat(64); writeFileSync(join(input, 'grounding-acquisition-v1.json'), JSON.stringify(acquisition));
  let calls = 0;
  try {
    await assert.rejects(evaluateExistingPublicGroundingRun({ dataset: { key: 'ui-vision', revision: acquisition.provenance.revision }, inputDirectory: input, cacheDirectory: cache, outputDirectory: output, evaluator: async () => { calls += 1; return { x: 0, y: 0 }; } }), /SHA-256 does not match/);
    assert.equal(calls, 0);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('writes local evaluator results only after verified artifacts', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'public-grounding-')); const { cache, input, output, acquisition } = fixture(directory);
  try {
    const result = await evaluateExistingPublicGroundingRun({ dataset: { key: 'ui-vision', revision: acquisition.provenance.revision }, inputDirectory: input, cacheDirectory: cache, outputDirectory: output, evaluator: async () => ({ x: 0.5, y: 0.5 }) });
    const receipt = JSON.parse(readFileSync(join(output, 'grounding-results-v1.json'), 'utf8')); assert.equal(result.metrics.pointInBboxRate, 1); assert.equal(receipt.results.length, 1); assert.match(receipt.examplesSha256, /^[a-f0-9]{64}$/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('rejects a tampered instruction before the evaluator is called', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'public-grounding-')); const { cache, input, output, acquisition } = fixture(directory); const examplesPath = join(input, 'grounding-examples-v1.json'); const examples = JSON.parse(readFileSync(examplesPath, 'utf8')); examples.examples[0].instruction = 'tampered'; writeFileSync(examplesPath, JSON.stringify(examples)); let calls = 0;
  try { await assert.rejects(evaluateExistingPublicGroundingRun({ dataset: { key: 'ui-vision', revision: acquisition.provenance.revision }, inputDirectory: input, cacheDirectory: cache, outputDirectory: output, evaluator: async () => { calls += 1; return { x: 0, y: 0 }; } }), /split was modified/); assert.equal(calls, 0); } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('fetch-only failure writes a metadata-only receipt and never invokes an evaluator', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'public-grounding-')); const cache = join(directory, 'cache'); const output = join(directory, 'output'); const previousBase = process.env.AI_VISUAL_TEST_PUBLIC_GROUNDING_BASE_URL; const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test'; process.env.AI_VISUAL_TEST_PUBLIC_GROUNDING_BASE_URL = 'http://127.0.0.1:1';
  try {
    await assert.rejects(main(['--dataset', 'ui-vision', '--fetch-only', '--limit', '1', '--cache-dir', cache, '--output-dir', output]), /acquisition was unavailable; receipt/);
    const [run] = readdirSync(output); const receipt = JSON.parse(readFileSync(join(output, run, 'grounding-acquisition-v1.json'), 'utf8')); const error = JSON.parse(readFileSync(join(output, run, 'grounding-acquisition-error-v1.json'), 'utf8'));
    assert.deepEqual({ status: receipt.status, artifacts: receipt.artifacts, key: receipt.key }, { status: 'metadata-only', artifacts: [], key: 'ui-vision' }); assert.equal(error.status, 'unavailable'); assert.match(error.reason, /could not be acquired safely/);
  } finally { if (previousBase === undefined) delete process.env.AI_VISUAL_TEST_PUBLIC_GROUNDING_BASE_URL; else process.env.AI_VISUAL_TEST_PUBLIC_GROUNDING_BASE_URL = previousBase; if (previousNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousNodeEnv; rmSync(directory, { recursive: true, force: true }); }
});
