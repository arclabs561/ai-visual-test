import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  DEFAULT_LOCAL_OLLAMA_ENDPOINT,
  LocalVisionEvaluatorError,
  evaluateLocalVision,
  localOllamaEndpoint,
  parseLocalVisionResponse,
  readLocalVisionImage,
} from '../../src/local-vision-evaluator.js';

function imageDirectory() {
  const directory = mkdtempSync(join(tmpdir(), 'local-vision-evaluator-'));
  const png = join(directory, 'screen.png');
  writeFileSync(png, Buffer.from('89504e470d0a1a0a0000000d494844520000000100000001', 'hex'));
  return { directory, png };
}

function ollamaResponse(response) {
  return new Response(JSON.stringify({ response }), {
    headers: { 'content-type': 'application/json' },
  });
}

test('uses only a literal loopback Ollama generate endpoint', () => {
  assert.equal(localOllamaEndpoint().toString(), DEFAULT_LOCAL_OLLAMA_ENDPOINT);
  assert.equal(localOllamaEndpoint('http://[::1]:11434/api/generate').hostname, '[::1]');
  for (const candidate of [
    'https://127.0.0.1:11434/api/generate',
    'http://localhost:11434/api/generate',
    'http://127.0.0.1:11434/api/tags',
    'http://169.254.169.254/api/generate',
    'http://127.0.0.1:11434/api/generate?redirect=elsewhere',
  ]) {
    assert.throws(() => localOllamaEndpoint(candidate), LocalVisionEvaluatorError);
  }
});

test('reads bounded regular images only after checking their magic type', () => {
  const { directory, png } = imageDirectory();
  try {
    const image = readLocalVisionImage(png);
    assert.deepEqual(
      { mimeType: image.mimeType, byteLength: image.byteLength, width: image.width, height: image.height },
      { mimeType: 'image/png', byteLength: 24, width: 1, height: 1 },
    );
    assert.equal(image.base64, 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB');
    const link = join(directory, 'linked.png');
    symlinkSync(png, link);
    assert.throws(() => readLocalVisionImage(link), /non-symlink/);
    const text = join(directory, 'text.png');
    writeFileSync(text, 'not an image');
    assert.throws(() => readLocalVisionImage(text), /PNG, JPEG, WebP, or GIF/);
    assert.throws(() => readLocalVisionImage(png, 7), /no larger than 7 bytes/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('submits fixed scalar requests to loopback with bounded JSON format and parses the score', async () => {
  const { directory, png } = imageDirectory();
  try {
    const requests = [];
    const outcome = await evaluateLocalVision({
      imagePaths: [png], prompt: 'Return only the scalar visual-quality score.', model: 'llava:latest', responseKind: 'scalar',
      minimumScore: 1, maximumScore: 5,
      fetchImplementation: async (url, init) => {
        requests.push({ url: String(url), init });
        return ollamaResponse('{"score":4}');
      },
    });
    assert.deepEqual(outcome, { kind: 'scalar', score: 4 });
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, DEFAULT_LOCAL_OLLAMA_ENDPOINT);
    const body = JSON.parse(requests[0].init.body);
    assert.deepEqual(body.images, ['iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB']);
    assert.equal(body.stream, false);
    assert.deepEqual(body.format.required, ['score']);
    assert.equal(new Headers(requests[0].init.headers).get('authorization'), null);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('requests and enforces integer scalar scores only when requested', async () => {
  const { directory, png } = imageDirectory();
  try {
    let requestBody;
    const outcome = await evaluateLocalVision({
      imagePaths: [png], prompt: 'Return a whole rubric score.', model: 'llava:latest', responseKind: 'scalar', integerScore: true,
      fetchImplementation: async (_url, init) => {
        requestBody = JSON.parse(init.body);
        return ollamaResponse('{"score":4}');
      },
    });
    assert.deepEqual(outcome, { kind: 'scalar', score: 4 });
    assert.equal(requestBody.format.properties.score.type, 'integer');
    assert.deepEqual(parseLocalVisionResponse('scalar', { response: '{"score":4.5}' }), { kind: 'scalar', score: 4.5 });
    assert.throws(() => parseLocalVisionResponse('scalar', { response: '{"score":4.5}' }, true), /finite-integer/);
    await assert.rejects(
      evaluateLocalVision({ imagePaths: [png], prompt: 'Return a whole rubric score.', model: 'llava:latest', responseKind: 'scalar', integerScore: true, fetchImplementation: async () => ollamaResponse('{"score":4.5}') }),
      /finite-integer/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('requires two images for pairwise AB/BA judgments and reconciles winner points', async () => {
  const { directory, png } = imageDirectory();
  try {
    const second = join(directory, 'comparison.jpg');
    writeFileSync(second, Buffer.from('ffd8ffc00008080001000101', 'hex'));
    let requestBody;
    const outcome = await evaluateLocalVision({
      imagePaths: [png, second], prompt: 'Choose the better image. Return A or B.', model: 'qwen-vl', responseKind: 'pairwise',
      fetchImplementation: async (_url, init) => {
        requestBody = JSON.parse(init.body);
        return ollamaResponse('```json\n{"winner":"B"}\n```');
      },
    });
    assert.deepEqual(outcome, { kind: 'pairwise', winner: 'B', point: 0 });
    assert.deepEqual(requestBody.format.properties, { winner: { type: 'string', enum: ['A', 'B'] } });
    assert.deepEqual(requestBody.format.required, ['winner']);
    await assert.rejects(
      evaluateLocalVision({ imagePaths: [png], prompt: 'Choose.', model: 'qwen-vl', responseKind: 'pairwise', fetchImplementation: async () => ollamaResponse('{"winner":"A"}') }),
      /exactly two images/,
    );
    assert.throws(() => parseLocalVisionResponse('pairwise', { response: '{"winner":"A","point":1}' }), /exactly/);
    assert.throws(() => parseLocalVisionResponse('pairwise', { response: '{"winner":"A","unexpected":true}' }), /exactly/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('uses the shared two-image binary response contract for local regression replay', async () => {
  const { directory, png } = imageDirectory();
  try {
    const second = join(directory, 'after.jpg');
    writeFileSync(second, Buffer.from('ffd8ffc00008080001000101', 'hex'));
    const outcome = await evaluateLocalVision({
      imagePaths: [png, second], prompt: 'Report whether any visible difference exists.', model: 'qwen-vl', responseKind: 'binary',
      fetchImplementation: async () => ollamaResponse('{"value":true}'),
    });
    assert.deepEqual(outcome, { kind: 'binary', value: true });
    await assert.rejects(
      evaluateLocalVision({ imagePaths: [png], prompt: 'Report differences.', model: 'qwen-vl', responseKind: 'binary', fetchImplementation: async () => ollamaResponse('{"value":false}') }),
      /binary evaluation requires exactly two images/,
    );
    assert.throws(() => parseLocalVisionResponse('binary', { response: '{"value":"true"}' }), /exactly/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('rejects malformed and tiny compressed image headers with oversized raster dimensions before base64 encoding', () => {
  const { directory } = imageDirectory();
  try {
    const hugePng = join(directory, 'tiny-bomb.png');
    // Valid PNG signature and IHDR shape; only the declared 100k x 100k raster is unsafe.
    writeFileSync(hugePng, Buffer.from('89504e470d0a1a0a0000000d49484452000186a0000186a0', 'hex'));
    assert.throws(() => readLocalVisionImage(hugePng), /16000000-pixel limit/);
    const malformedPng = join(directory, 'malformed.png');
    writeFileSync(malformedPng, Buffer.from('89504e470d0a1a0a0000000d424144210000000100000001', 'hex'));
    assert.throws(() => readLocalVisionImage(malformedPng), /malformed IHDR/);
    const hugeWebp = join(directory, 'tiny-bomb.webp');
    writeFileSync(hugeWebp, Buffer.from('524946461600000057454250565038580a00000000000000ffffffffffff', 'hex'));
    assert.throws(() => readLocalVisionImage(hugeWebp), /16000000-pixel limit/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('parses finite normalized 0 through 1000 grounding coordinates', async () => {
  const { directory, png } = imageDirectory();
  try {
    const outcome = await evaluateLocalVision({
      imagePaths: [png], prompt: 'Locate the button and return normalized coordinates.', model: 'moondream', responseKind: 'grounding',
      fetchImplementation: async () => ollamaResponse('{"x":23.5,"y":0}'),
    });
    assert.deepEqual(outcome, { kind: 'grounding', x: 23.5, y: 0 });
    assert.throws(() => parseLocalVisionResponse('grounding', { response: '{"x":-1,"y":2}' }), /0 through 1000/);
    assert.throws(() => parseLocalVisionResponse('grounding', { response: '{"x":1000.1,"y":2}' }), /0 through 1000/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('does not call injected fetch when endpoint or response bounds are unsafe', async () => {
  const { directory, png } = imageDirectory();
  try {
    let calls = 0;
    await assert.rejects(
      evaluateLocalVision({
        imagePaths: [png], prompt: 'Return a score.', model: 'local', responseKind: 'scalar', endpoint: 'http://localhost:11434/api/generate',
        fetchImplementation: async () => { calls += 1; return ollamaResponse('{"score":1}'); },
      }),
      /literal loopback/,
    );
    assert.equal(calls, 0);
    await assert.rejects(
      evaluateLocalVision({
        imagePaths: [png], prompt: 'Return a score.', model: 'local', responseKind: 'scalar', maximumResponseBytes: 10,
        fetchImplementation: async () => new Response(JSON.stringify({ response: '{"score":1}' }), { headers: { 'content-length': '99' } }),
      }),
      /exceeds the 10-byte limit/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
