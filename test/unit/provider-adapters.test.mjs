import test from 'node:test';
import assert from 'node:assert/strict';

import { getProviderAdapter } from '#provider-adapters';
import { ProviderError } from '../../src/errors.mjs';

const SCHEMA = { type: 'object' };

test('provider capability negotiation is model-aware and explicit', () => {
  const cases = [
    ['gemini', 'gemini-2.5-flash', 'json-schema', null, undefined],
    ['openai', 'gpt-4o', 'json-schema', null, true],
    ['openai', 'custom/vision', 'json-object', 'model_schema_support_unknown', undefined],
    ['groq', 'openai/gpt-oss-20b', 'json-schema', null, true],
    ['groq', 'qwen/qwen3.6-27b', 'json-object', 'model_schema_support_unknown', undefined],
    ['groq', 'meta-llama/vision', 'json-schema', 'best_effort_json_schema', false],
    ['openrouter', 'google/gemini-2.5-flash', 'json-object', 'model_schema_support_unknown', undefined],
    ['claude', 'claude-sonnet-4', 'prompt-only', 'native_schema_unavailable', undefined],
  ];

  for (const [provider, model, mode, diagnostic, strict] of cases) {
    const result = getProviderAdapter(provider).resolveStructuredOutput({
      model, taskName: 'visual_review', enabled: true, schema: SCHEMA,
    });
    assert.equal(result.mode, mode, `${provider}/${model}`);
    assert.equal(result.name, 'visual_review', `${provider}/${model}`);
    assert.equal(result.diagnostic, diagnostic, `${provider}/${model}`);
    assert.equal(result.strict, strict, `${provider}/${model}`);
  }

  const disabled = getProviderAdapter('openai').resolveStructuredOutput({
    model: 'gpt-4o', taskName: 'visual_comparison', enabled: false, schema: SCHEMA,
  });
  assert.equal(disabled.mode, 'prompt-only');
  assert.equal(disabled.name, 'visual_comparison');
  assert.equal(disabled.diagnostic, 'structured_output_disabled');
});

test('native structured output carries arbitrary task names and schemas', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const requests = [];
  globalThis.fetch = async (_url, init) => {
    requests.push(JSON.parse(init.body));
    return new Response('{}', { headers: { 'content-type': 'application/json' } });
  };
  const schema = { type: 'object', properties: { action: { type: 'string' } } };
  const common = {
    images: [], prompt: 'choose', signal: new AbortController().signal, apiKey: 'test-key',
  };
  const openai = getProviderAdapter('openai').resolveStructuredOutput({
    model: 'gpt-4o', taskName: 'game_action', enabled: true, schema,
  });
  await getProviderAdapter('openai').call({
    ...common, config: { apiUrl: 'https://provider.invalid/v1', model: 'gpt-4o' }, structuredOutput: openai,
  });
  const gemini = getProviderAdapter('gemini').resolveStructuredOutput({
    model: 'gemini-2.5-flash', taskName: 'game_action', enabled: true, schema,
  });
  await getProviderAdapter('gemini').call({
    ...common, config: { apiUrl: 'https://provider.invalid/v1', model: 'gemini-2.5-flash' }, structuredOutput: gemini,
  });
  assert.equal(requests[0].response_format.json_schema.name, 'game_action');
  assert.deepEqual(requests[0].response_format.json_schema.schema, schema);
  assert.deepEqual(requests[1].generationConfig.responseJsonSchema, schema);
});

test('wire adapters preserve image order, signal, and header-only credentials', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return new Response('{}', { headers: { 'content-type': 'application/json' } });
  };
  const signal = new AbortController().signal;
  const common = {
    images: [
      { data: 'first', mime: 'image/jpeg' },
      { data: 'second', mime: 'image/webp' },
    ], prompt: 'review', signal, apiKey: 'test-key',
    config: { apiUrl: 'https://provider.invalid/v1', model: 'model' },
  };

  await getProviderAdapter('gemini').call(common);
  await getProviderAdapter('openai').call(common);
  await getProviderAdapter('claude').call(common);

  for (const call of calls) {
    assert.equal(call.init.signal, signal);
    assert.doesNotMatch(call.url, /test-key/);
  }
  assert.deepEqual(calls[0].body.contents[0].parts.slice(1).map(part => part.inline_data), [
    { data: 'first', mime_type: 'image/jpeg' },
    { data: 'second', mime_type: 'image/webp' },
  ]);
  assert.equal(calls[0].init.headers['x-goog-api-key'], 'test-key');
  assert.deepEqual(calls[1].body.messages[0].content.slice(1).map(part => part.image_url.url.split(',')[1]), ['first', 'second']);
  assert.deepEqual(calls[1].body.messages[0].content.slice(1).map(part => part.image_url.url.split(';')[0]), ['data:image/jpeg', 'data:image/webp']);
  assert.equal(calls[1].init.headers.Authorization, 'Bearer test-key');
  assert.deepEqual(calls[2].body.messages[0].content.slice(1).map(part => part.source.data), ['first', 'second']);
  assert.deepEqual(calls[2].body.messages[0].content.slice(1).map(part => part.source.media_type), ['image/jpeg', 'image/webp']);
  assert.equal(calls[2].init.headers['x-api-key'], 'test-key');
});

test('provider envelopes and usage normalize through one contract', async () => {
  const cases = [
    ['gemini', {
      candidates: [{ content: { parts: [{ text: 'one' }, { thought: true }, { text: 'two' }] } }],
      usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 4 },
    }, 'one\ntwo', { inputTokens: 3, outputTokens: 4 }],
    ['openai', {
      choices: [{ message: { content: 'answer' }, logprobs: { content: [] } }],
      usage: { prompt_tokens: 5, completion_tokens: 6 },
    }, 'answer', { inputTokens: 5, outputTokens: 6 }],
    ['groq', {
      choices: [{ message: { content: 'answer' } }], usage: { prompt_tokens: 7, completion_tokens: 8 },
    }, 'answer', { inputTokens: 7, outputTokens: 8 }],
    ['openrouter', {
      choices: [{ message: { content: 'answer' } }], usage: { prompt_tokens: 9, completion_tokens: 10 },
    }, 'answer', { inputTokens: 9, outputTokens: 10 }],
    ['claude', {
      content: [{ type: 'thinking', text: 'ignore' }, { type: 'text', text: 'one' }, { type: 'text', text: 'two' }],
      usage: { input_tokens: 11, output_tokens: 12 },
    }, 'one\ntwo', { inputTokens: 11, outputTokens: 12 }],
  ];

  for (const [provider, envelope, judgment, usage] of cases) {
    const adapter = getProviderAdapter(provider);
    const parsed = await adapter.parseResponse(new Response(JSON.stringify(envelope), {
      headers: { 'content-type': 'application/json' },
    }));
    assert.equal(parsed.judgment, judgment, provider);
    assert.deepEqual(adapter.extractUsage(parsed.data), usage, provider);
  }
});

test('Groq Qwen request leaves room for image and prompt tokens', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let body;
  globalThis.fetch = async (_url, init) => {
    body = JSON.parse(init.body);
    return new Response('{}', { headers: { 'content-type': 'application/json' } });
  };
  await getProviderAdapter('groq').call({
    images: [{ data: 'image', mime: 'image/png' }],
    prompt: 'review', signal: new AbortController().signal, apiKey: 'test-key',
    config: { apiUrl: 'https://provider.invalid/v1', model: 'qwen/qwen3.6-27b' },
  });
  assert.equal(body.max_tokens, 1024);
  assert.equal(body.reasoning_effort, 'none');
});

test('provider envelope failures retain status and retry semantics', async () => {
  for (const [status, retryable] of [[401, false], [429, true], [503, true]]) {
    await assert.rejects(
      getProviderAdapter('openrouter').parseResponse(new Response(JSON.stringify({ detail: 'unavailable' }), {
        status, headers: { 'content-type': 'application/json' },
      })),
      error => error instanceof ProviderError
        && error.provider === 'openrouter'
        && error.details.statusCode === status
        && error.details.retryable === retryable,
    );
  }

  await assert.rejects(
    getProviderAdapter('gemini').parseResponse(new Response('x'.repeat(500), {
      status: 502, headers: { 'content-type': 'text/plain' },
    })),
    error => error instanceof ProviderError
      && error.details.responsePreview.length === 200
      && error.details.retryable === false,
  );

  await assert.rejects(
    getProviderAdapter('claude').parseResponse(new Response(JSON.stringify({ content: [] }), {
      headers: { 'content-type': 'application/json' },
    })),
    error => error instanceof ProviderError && error.details.failureKind === 'response_envelope',
  );
});
