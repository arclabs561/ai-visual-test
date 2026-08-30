import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  DEFAULT_OPENROUTER_ENDPOINT,
  DEFAULT_OPENROUTER_MAXIMUM_OUTPUT_TOKENS,
  OpenRouterVisionEvaluatorError,
  aggregateOpenRouterUsage,
  evaluateOpenRouterVision,
  openRouterEndpoint,
  parseOpenRouterVisionOutcome,
  resolveOpenRouterApiKey,
} from '../../src/openrouter-vision-evaluator.js';

function imageDirectory() {
  const directory = mkdtempSync(join(tmpdir(), 'openrouter-vision-evaluator-'));
  const png = join(directory, 'screen.png');
  const comparison = join(directory, 'comparison.jpg');
  writeFileSync(png, Buffer.from('89504e470d0a1a0a0000000d494844520000000100000001', 'hex'));
  writeFileSync(comparison, Buffer.from('ffd8ffc00008080001000101', 'hex'));
  return { directory, png, comparison };
}

function completion(content, { model = 'google/gemini-3-flash-preview', provider, nativeModel, usage, finishReason = 'stop' } = {}) {
  return new Response(JSON.stringify({
    choices: [{ finish_reason: finishReason, message: { content } }],
    model,
    ...(provider === undefined ? {} : { provider }),
    ...(nativeModel === undefined ? {} : { native_model: nativeModel }),
    usage: usage ?? { prompt_tokens: 17, completion_tokens: 3, total_tokens: 20, cost: 0.00012 },
  }), { headers: { 'content-type': 'application/json' } });
}

test('uses only the canonical OpenRouter HTTPS chat endpoint', () => {
  assert.equal(openRouterEndpoint().toString(), DEFAULT_OPENROUTER_ENDPOINT);
  for (const candidate of [
    'http://openrouter.ai/api/v1/chat/completions',
    'https://api.openrouter.ai/api/v1/chat/completions',
    'https://openrouter.ai/api/v1/chat/completions?redirect=elsewhere',
    'https://openrouter.ai/api/v1/models',
    'https://user:pass@openrouter.ai/api/v1/chat/completions',
  ]) {
    assert.throws(() => openRouterEndpoint(candidate), OpenRouterVisionEvaluatorError);
  }
});

test('resolves an explicit or environment API key without exposing its value in errors', () => {
  assert.equal(resolveOpenRouterApiKey('direct-key', {}), 'direct-key');
  assert.equal(resolveOpenRouterApiKey(undefined, { OPENROUTER_API_KEY: 'environment-key' }), 'environment-key');
  const secret = 'do-not-echo-this-secret';
  assert.throws(
    () => resolveOpenRouterApiKey(`${secret}\0`, {}),
    error => error instanceof OpenRouterVisionEvaluatorError && !error.message.includes(secret),
  );
});

test('submits bounded scalar evaluation with structured JSON, captures cost/usage, and returns no raw content', async () => {
  const { directory, png } = imageDirectory();
  try {
    const requests = [];
    const result = await evaluateOpenRouterVision({
      imagePaths: [png], prompt: 'Return the visual-quality score.', model: 'google/gemini-3-flash-preview', responseKind: 'scalar',
      apiKey: 'test-key', providerSlug: 'google-vertex/us-central1', maximumOutputTokens: 72, minimumScore: 1, maximumScore: 5,
      fetchImplementation: async (url, init) => {
        requests.push({ url: String(url), init });
        return completion('{"score":4}', { provider: 'Google', nativeModel: 'gemini-3-flash', usage: { prompt_tokens: 17, completion_tokens: 3, total_tokens: 20, cost: 0.00012 } });
      },
    });
    assert.deepEqual(result, {
      outcome: { kind: 'scalar', score: 4 }, model: 'google/gemini-3-flash-preview', provider: 'Google', nativeModel: 'gemini-3-flash',
      usage: { promptTokens: 17, completionTokens: 3, totalTokens: 20, cost: 0.00012 },
      requestConfig: {
        maximumOutputTokens: 72, reasoning: { effort: 'minimal', exclude: true },
        providerRouting: { only: ['google-vertex/us-central1'], allow_fallbacks: false, require_parameters: true, data_collection: 'deny' },
      },
    });
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, DEFAULT_OPENROUTER_ENDPOINT);
    assert.equal(new Headers(requests[0].init.headers).get('authorization'), 'Bearer test-key');
    const body = JSON.parse(requests[0].init.body);
    assert.equal(body.model, 'google/gemini-3-flash-preview');
    assert.equal(body.max_tokens, 72);
    assert.deepEqual(body.reasoning, { effort: 'minimal', exclude: true });
    assert.deepEqual(body.provider, { only: ['google-vertex/us-central1'], allow_fallbacks: false, require_parameters: true, data_collection: 'deny' });
    assert.equal(body.temperature, 0);
    assert.equal(body.stream, false);
    assert.deepEqual(body.usage, { include: true });
    assert.equal(body.response_format.type, 'json_schema');
    assert.equal(body.response_format.json_schema.strict, true);
    assert.deepEqual(body.messages[0].content[1], {
      type: 'image_url', image_url: { url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB' },
    });
    assert.equal(JSON.stringify(result).includes('test-key'), false);
    assert.equal(JSON.stringify(result).includes('Return the visual-quality score.'), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('requests and enforces integer scalar scores only when requested', async () => {
  const { directory, png } = imageDirectory();
  try {
    let requestBody;
    const result = await evaluateOpenRouterVision({
      imagePaths: [png], prompt: 'Return a whole rubric score.', model: 'google/gemini-3.6-flash', responseKind: 'scalar', integerScore: true, apiKey: 'test-key',
      fetchImplementation: async (_url, init) => {
        requestBody = JSON.parse(init.body);
        return completion('{"score":4}', { model: 'google/gemini-3.6-flash' });
      },
    });
    assert.equal(result.outcome.score, 4);
    assert.equal(result.requestConfig.integerScore, true);
    assert.equal(requestBody.response_format.json_schema.schema.properties.score.type, 'integer');
    assert.deepEqual(parseOpenRouterVisionOutcome('scalar', '{"score":4.5}'), { kind: 'scalar', score: 4.5 });
    assert.throws(() => parseOpenRouterVisionOutcome('scalar', '{"score":4.5}', true), /finite-integer/);
    await assert.rejects(
      evaluateOpenRouterVision({ imagePaths: [png], prompt: 'Return a whole rubric score.', model: 'google/gemini-3.6-flash', responseKind: 'scalar', integerScore: true, apiKey: 'test-key', fetchImplementation: async () => completion('{"score":4.5}', { model: 'google/gemini-3.6-flash' }) }),
      /finite-integer/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('requires two images for pairwise and binary regression outcomes', async () => {
  const { directory, png, comparison } = imageDirectory();
  try {
    let requestBody;
    const pairwise = await evaluateOpenRouterVision({
      imagePaths: [png, comparison], prompt: 'Choose A or B.', model: 'model/a', responseKind: 'pairwise', apiKey: 'test-key',
      fetchImplementation: async (_url, init) => {
        requestBody = JSON.parse(init.body);
        return completion('```json\n{"winner":"B"}\n```', { model: 'model/a' });
      },
    });
    assert.deepEqual(pairwise.outcome, { kind: 'pairwise', winner: 'B', point: 0 });
    assert.deepEqual(requestBody.response_format.json_schema.schema.properties, { winner: { type: 'string', enum: ['A', 'B'] } });
    assert.deepEqual(requestBody.response_format.json_schema.schema.required, ['winner']);
    const binary = await evaluateOpenRouterVision({
      imagePaths: [png, comparison], prompt: 'Are there visible differences?', model: 'model/a', responseKind: 'binary', apiKey: 'test-key',
      fetchImplementation: async () => completion('{"value":true}', { model: 'model/a' }),
    });
    assert.deepEqual(binary.outcome, { kind: 'binary', value: true });
    await assert.rejects(
      evaluateOpenRouterVision({ imagePaths: [png], prompt: 'Regression?', model: 'model/a', responseKind: 'binary', apiKey: 'test-key', fetchImplementation: async () => completion('{"value":true}') }),
      /binary evaluation requires exactly two images/,
    );
    assert.throws(() => parseOpenRouterVisionOutcome('pairwise', '{"winner":"A","point":1}'), /exactly/);
    assert.throws(() => parseOpenRouterVisionOutcome('pairwise', '{"winner":"A","unexpected":true}'), /exactly/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('parses normalized 0 through 1000 grounding coordinates and rejects malformed provider data', async () => {
  const { directory, png } = imageDirectory();
  try {
    let requestBody;
    const result = await evaluateOpenRouterVision({
      imagePaths: [png], prompt: 'Return normalized coordinates.', model: 'model/a', responseKind: 'grounding', apiKey: 'test-key',
      fetchImplementation: async (_url, init) => {
        requestBody = JSON.parse(init.body);
        return completion('{"x":23.5,"y":0}', { model: 'model/a', usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 } });
      },
    });
    assert.equal(requestBody.max_tokens, DEFAULT_OPENROUTER_MAXIMUM_OUTPUT_TOKENS);
    assert.deepEqual(requestBody.reasoning, { effort: 'minimal', exclude: true });
    assert.deepEqual(result, {
      outcome: { kind: 'grounding', x: 23.5, y: 0 }, model: 'model/a',
      usage: { promptTokens: 5, completionTokens: 2, totalTokens: 7 },
      requestConfig: { maximumOutputTokens: DEFAULT_OPENROUTER_MAXIMUM_OUTPUT_TOKENS, reasoning: { effort: 'minimal', exclude: true } },
    });
    assert.throws(() => parseOpenRouterVisionOutcome('grounding', '{"x":-1,"y":2}'), /0 through 1000/);
    assert.throws(() => parseOpenRouterVisionOutcome('grounding', '{"x":1000.1,"y":2}'), /0 through 1000/);
    assert.throws(() => parseOpenRouterVisionOutcome('binary', '{"value":"true"}'), /exactly/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('rejects a length-truncated completion before attempting JSON parsing', async () => {
  const { directory, png } = imageDirectory();
  try {
    await assert.rejects(
      evaluateOpenRouterVision({
        imagePaths: [png], prompt: 'Score.', model: 'google/gemini-3.6-flash', responseKind: 'scalar', apiKey: 'test-key',
        fetchImplementation: async () => completion('reasoning output without a JSON verdict', { model: 'google/gemini-3.6-flash', finishReason: 'length' }),
      }),
      /truncated by the maximum output token limit/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('does not call fetch for missing credentials or unsafe bounds and does not leak provider error bodies', async () => {
  const { directory, png } = imageDirectory();
  try {
    let calls = 0;
    await assert.rejects(
      evaluateOpenRouterVision({
        imagePaths: [png], prompt: 'Score.', model: 'model/a', responseKind: 'scalar', environment: {},
        fetchImplementation: async () => { calls += 1; return completion('{"score":1}'); },
      }),
      /API key must be supplied/,
    );
    assert.equal(calls, 0);
    await assert.rejects(
      evaluateOpenRouterVision({
        imagePaths: [png], prompt: 'Score.', model: 'model/a', responseKind: 'scalar', apiKey: 'test-key', providerSlug: 'Google Vertex',
        fetchImplementation: async () => { calls += 1; return completion('{"score":1}'); },
      }),
      /provider slug must be a lowercase endpoint slug/,
    );
    assert.equal(calls, 0);
    await assert.rejects(
      evaluateOpenRouterVision({
        imagePaths: [png], prompt: 'Score.', model: 'model/a', responseKind: 'scalar', apiKey: 'test-key', maximumOutputTokens: 4_097,
        fetchImplementation: async () => { calls += 1; return completion('{"score":1}'); },
      }),
      /must not exceed 4096/,
    );
    assert.equal(calls, 0);
    await assert.rejects(
      evaluateOpenRouterVision({
        imagePaths: [png], prompt: 'Score.', model: 'model/a', responseKind: 'scalar', apiKey: 'test-key',
        fetchImplementation: async () => new Response('provider-body-secret', { status: 401 }),
      }),
      error => error instanceof OpenRouterVisionEvaluatorError && error.message === 'OpenRouter request failed with HTTP 401' && !error.message.includes('provider-body-secret'),
    );
    await assert.rejects(
      evaluateOpenRouterVision({
        imagePaths: [png], prompt: 'Score.', model: 'model/a', responseKind: 'scalar', apiKey: 'test-key', maximumResponseBytes: 10,
        fetchImplementation: async () => completion('{"score":1}', { model: 'model/a', usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }),
      }),
      /exceeds the 10-byte limit/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('rejects inconsistent usage before returning an outcome', async () => {
  const { directory, png } = imageDirectory();
  try {
    await assert.rejects(
      evaluateOpenRouterVision({
        imagePaths: [png], prompt: 'Score.', model: 'model/a', responseKind: 'scalar', apiKey: 'test-key',
        fetchImplementation: async () => completion('{"score":1}', { model: 'model/a', usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 9, cost: -1 } }),
      }),
      /total_tokens must equal/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('rejects a routed response whose model differs from the explicit request model', async () => {
  const { directory, png } = imageDirectory();
  try {
    await assert.rejects(
      evaluateOpenRouterVision({
        imagePaths: [png], prompt: 'Score.', model: 'google/gemini-3.6-flash', responseKind: 'scalar', apiKey: 'test-key',
        fetchImplementation: async () => completion('{"score":4}', { model: 'google/gemini-3.5-flash' }),
      }),
      /did not exactly match the requested model/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('aggregates usage with explicit complete, partial, unavailable, and empty cost states', () => {
  assert.deepEqual(aggregateOpenRouterUsage([]), {
    calls: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0,
    cost: { status: 'not-applicable', reportedCalls: 0, missingCalls: 0 },
  });
  assert.deepEqual(aggregateOpenRouterUsage([
    { promptTokens: 10, completionTokens: 2, totalTokens: 12, cost: 0 },
    { promptTokens: 20, completionTokens: 3, totalTokens: 23, cost: 0.0004 },
  ]), {
    calls: 2, promptTokens: 30, completionTokens: 5, totalTokens: 35,
    cost: { status: 'complete', reportedCalls: 2, missingCalls: 0, reportedCost: 0.0004 },
  });
  assert.deepEqual(aggregateOpenRouterUsage([
    { promptTokens: 1, completionTokens: 1, totalTokens: 2, cost: 0.001 },
    { promptTokens: 3, completionTokens: 4, totalTokens: 7 },
  ]), {
    calls: 2, promptTokens: 4, completionTokens: 5, totalTokens: 9,
    cost: { status: 'partial', reportedCalls: 1, missingCalls: 1, reportedCost: 0.001 },
  });
  assert.deepEqual(aggregateOpenRouterUsage([{ promptTokens: 1, completionTokens: 1, totalTokens: 2 }]), {
    calls: 1, promptTokens: 1, completionTokens: 1, totalTokens: 2,
    cost: { status: 'unavailable', reportedCalls: 0, missingCalls: 1 },
  });
});

test('rejects malformed usage records instead of guessing token or cost values', () => {
  assert.throws(
    () => aggregateOpenRouterUsage([{ promptTokens: 1, completionTokens: 2, totalTokens: 4 }]),
    /totalTokens must equal/,
  );
  assert.throws(
    () => aggregateOpenRouterUsage([{ promptTokens: 1, completionTokens: 2, totalTokens: 3, cost: Number.NaN }]),
    /cost must be a non-negative finite number/,
  );
});
