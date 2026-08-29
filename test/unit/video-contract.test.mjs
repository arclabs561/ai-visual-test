import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { VideoJudge } from '../../src/video.js';
import { ProviderError, ValidationError } from '../../src/errors.mjs';

function fixture(bytes = Buffer.from('small-video')) {
  const directory = mkdtempSync(join(tmpdir(), 'aivt-video-contract-'));
  const path = join(directory, 'tour.mp4');
  writeFileSync(path, bytes);
  return { directory, path };
}

function scalar(score = 8) {
  return JSON.stringify({
    kind: 'scalar', score, assessment: 'pass', reasoning: 'The navigation remains clear.',
    issues: ['Contrast could improve'], recommendations: ['Raise contrast'], strengths: ['Clear hierarchy'],
  });
}

function judge(provider = 'gemini', model = 'gemini-2.5-flash') {
  return new VideoJudge({ provider, model, apiKey: 'test-key', cacheEnabled: false, env: {} });
}

test('Gemini video reviews use the shared native schema and typed inline video payload', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const { directory, path } = fixture();
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  let request;
  globalThis.fetch = async (_url, init) => {
    request = JSON.parse(init.body);
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: scalar() }] } }],
      usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 5 },
    }), { headers: { 'content-type': 'application/json' } });
  };

  const result = await judge().judgeVideo(path, 'Review this video', { enableUncertaintyReduction: false });

  assert.equal(request.generationConfig.responseMimeType, 'application/json');
  assert.equal(request.generationConfig.responseJsonSchema.properties.kind.const, 'scalar');
  assert.equal(request.generationConfig.maxOutputTokens, 16000);
  assert.equal(request.contents[0].parts[1].inline_data.mime_type, 'video/mp4');
  assert.equal(result.score, 8);
  assert.equal(result.outputFormat, 'structured');
});

test('OpenRouter video reviews serialize video_url through the provider adapter', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const { directory, path } = fixture();
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  let request;
  globalThis.fetch = async (_url, init) => {
    request = JSON.parse(init.body);
    return new Response(JSON.stringify({ choices: [{ message: { content: scalar() } }] }), {
      headers: { 'content-type': 'application/json' },
    });
  };

  await judge('openrouter', 'google/gemini-2.5-pro').judgeVideo(path, 'Review this video', { enableUncertaintyReduction: false });

  assert.equal(request.response_format.type, 'json_object');
  assert.match(request.messages[0].content[1].video_url.url, /^data:video\/mp4;base64,/);
});

test('video reviews repair only a malformed output with diagnostic-only context', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const { directory, path } = fixture();
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const prompts = [];
  let calls = 0;
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    prompts.push(body.contents[0].parts[0].text);
    calls++;
    const response = calls === 1 ? '{"score": 50}' : scalar(7);
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: response }] } }] }), {
      headers: { 'content-type': 'application/json' },
    });
  };

  const result = await judge().judgeVideo(path, 'Review this video', { maxRetries: 1, enableUncertaintyReduction: false });

  assert.equal(calls, 2);
  assert.match(prompts[1], /Diagnostic codes: .*invalid_score/);
  assert.doesNotMatch(prompts[1], /"score": 50/);
  assert.equal(result.attempts, 2);
  assert.equal(result.score, 7);
});

test('video transport failures are never relabeled as output contract failures', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const { directory, path } = fixture();
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response(JSON.stringify({ error: { message: 'unauthorized' } }), {
      status: 401, headers: { 'content-type': 'application/json' },
    });
  };

  await assert.rejects(
    judge().judgeVideo(path, 'Review this video', { maxRetries: 1 }),
    error => error instanceof ProviderError && error.details.failureKind !== 'output_contract',
  );
  assert.equal(calls, 1);
});

test('video inputs reject empty, invalid numeric, and unsupported MIME values before networking', async () => {
  await assert.rejects(judge().judgeVideo([], 'Review this video'), ValidationError);
  assert.throws(() => new VideoJudge({ provider: 'gemini', maxMB: Number.NaN }), ValidationError);
  const { directory, path } = fixture();
  try {
    await assert.rejects(judge().judgeVideo([{ path, mime: 'video/avi' }], 'Review this video'), ValidationError);
    await assert.rejects(judge().judgeVideo(path, 'Review this video', { maxTokens: Infinity }), ValidationError);
    await assert.rejects(judge().judgeVideo(path, 'Review this video', { attempts: 0 }), ValidationError);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('multi-video input is bounded before encoding an aggregate payload', async () => {
  const { directory, path } = fixture(Buffer.alloc(8));
  try {
    await assert.rejects(
      new VideoJudge({ provider: 'gemini', apiKey: 'test-key', maxMB: 0.00001, maxTotalMB: 0.00001, env: {} })
        .judgeVideo([path, path], 'Review this video'),
      error => error instanceof ProviderError || error.code === 'FILE_ERROR',
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('a retry delay never outlives the request deadline', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const { directory, path } = fixture();
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  globalThis.fetch = async () => new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: '{"score": 50}' }] } }],
  }), { headers: { 'content-type': 'application/json' } });
  const started = Date.now();
  await assert.rejects(
    judge().judgeVideo(path, 'Review this video', { timeout: 10, retryBaseDelay: 1000, retryMaxDelay: 1000 }),
    error => error.code === 'TIMEOUT_ERROR' || error instanceof ProviderError,
  );
  assert.ok(Date.now() - started < 250);
});

test('transcoded temporary video files are removed after a response without invoking ffmpeg in tests', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const { directory, path } = fixture(Buffer.alloc(32));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const instance = new VideoJudge({ provider: 'gemini', model: 'gemini-2.5-flash', apiKey: 'test-key', maxMB: 0.00001, env: {} });
  const transcoded = join(directory, 'transcoded.mp4');
  instance.transcodeVideo = () => {
    writeFileSync(transcoded, 'x');
    return { path: transcoded, mime: 'video/mp4' };
  };
  globalThis.fetch = async () => new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: scalar() }] } }],
  }), { headers: { 'content-type': 'application/json' } });

  await instance.judgeVideo(path, 'Review this video', { enableUncertaintyReduction: false });
  assert.equal(existsSync(transcoded), false);
});
