import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { VLLMJudge } from '../../src/judge.mjs';
import { generateCacheKey } from '../../src/cache.mjs';
import { ProviderError } from '../../src/errors.mjs';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

function fixtureImage() {
  const dir = mkdtempSync(join(tmpdir(), 'ai-visual-contract-'));
  const path = join(dir, 'pixel.png');
  writeFileSync(path, PNG_1X1);
  return path;
}

function judge(provider = 'openai', model = 'gpt-4o') {
  return new VLLMJudge({ provider, model, apiKey: 'test-key', cacheEnabled: false, env: {} });
}

function scalarEnvelope(score = 8) {
  return {
    choices: [{ message: { content: JSON.stringify({
      kind: 'scalar', score, assessment: 'pass', reasoning: 'Clear hierarchy',
      issues: ['Low contrast'], recommendations: ['Raise contrast'], strengths: ['Strong CTA']
    }) } }]
  };
}

test('rejects a JSON non-2xx envelope even without an error field', async () => {
  const instance = judge();
  await assert.rejects(
    instance._parseProviderResponse(new Response(JSON.stringify({ detail: 'upstream unavailable' }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    })),
    error => error instanceof ProviderError && error.details.statusCode === 500 && error.details.retryable === true
  );
});

test('joins all textual Gemini response parts', async () => {
  const instance = judge('gemini', 'gemini-2.5-flash');
  const parsed = await instance._parseProviderResponse(new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ thought: true }, { text: '{"score":' }, { text: '8}' }] } }]
  }), { headers: { 'content-type': 'application/json' } }));
  assert.equal(parsed.judgment, '{"score":\n8}');
});

test('sends a native schema and returns a validated scalar result', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let request;
  globalThis.fetch = async (_url, init) => {
    request = JSON.parse(init.body);
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        kind: 'scalar', score: 8, assessment: 'pass', reasoning: 'Clear hierarchy',
        issues: ['Low contrast'], recommendations: ['Raise contrast'], strengths: ['Strong CTA']
      }) } }],
      usage: { prompt_tokens: 10, completion_tokens: 10 }
    }), { headers: { 'content-type': 'application/json' } });
  };

  const result = await judge().judgeScreenshot(fixtureImage(), 'Review this interface', {
    useCache: false,
    enableUncertaintyReduction: false
  });

  assert.equal(request.response_format.type, 'json_schema');
  assert.equal(request.response_format.json_schema.strict, true);
  assert.equal(result.kind, 'scalar');
  assert.equal(result.model, 'gpt-4o');
  assert.equal(result.score, 8);
  assert.deepEqual(result.issues, ['Low contrast']);
  assert.equal(result.outputFormat, 'structured');
});

test('preserves pairwise fields while keeping the candidate score compatible', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify({
      kind: 'comparison', winner: 'B', confidence: 0.9, reasoning: 'B fixes the footer',
      differences: ['CTA no longer overlaps'], scores: { A: 4, B: 9 }
    }) } }]
  }), { headers: { 'content-type': 'application/json' } });

  const image = fixtureImage();
  const result = await judge().judgeScreenshot([image, image], 'Compare before and after', {
    useCache: false,
    enableUncertaintyReduction: false
  });

  assert.equal(result.kind, 'comparison');
  assert.equal(result.score, 9);
  assert.equal(result.winner, 'B');
  assert.deepEqual(result.scores, { A: 4, B: 9 });
  assert.deepEqual(result.differences, ['CTA no longer overlaps']);
});

test('repairs malformed structured output using diagnostics and retries', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const prompts = [];
  let calls = 0;
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    prompts.push(body.messages[0].content[0].text);
    calls++;
    const content = calls === 1
      ? '{"score": 50}'
      : JSON.stringify({
          kind: 'scalar', score: 7, assessment: 'pass', reasoning: 'Repaired',
          issues: [], recommendations: [], strengths: []
        });
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
      headers: { 'content-type': 'application/json' }
    });
  };

  const result = await judge().judgeScreenshot(fixtureImage(), 'Review this interface', {
    useCache: false,
    maxRetries: 1,
    retryBaseDelay: 0,
    retryMaxDelay: 0,
    enableUncertaintyReduction: false
  });

  assert.equal(calls, 2);
  assert.match(prompts[1], /Diagnostic codes:/);
  assert.doesNotMatch(prompts[1], /"score": 50/);
  assert.equal(result.attempts, 2);
  assert.equal(result.score, 7);
});

test('cache identity changes with provider, model, structured mode, and anchors', () => {
  const image = fixtureImage();
  const base = generateCacheKey(image, 'effective prompt', {
    provider: 'openai', model: 'gpt-4o', reviewMode: 'scalar',
    structuredOutputMode: 'json-schema', anchorDigest: 'a'
  });
  for (const changed of [
    { provider: 'gemini' }, { model: 'gpt-5' }, { reviewMode: 'comparison' },
    { structuredOutputMode: 'json-object' }, { anchorDigest: 'b' }
  ]) {
    const candidate = generateCacheKey(image, 'effective prompt', {
      provider: 'openai', model: 'gpt-4o', reviewMode: 'scalar',
      structuredOutputMode: 'json-schema', anchorDigest: 'a', ...changed
    });
    assert.notEqual(candidate, base);
  }
});

test('cache hits return the same normalized public result as cold calls', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response(JSON.stringify(scalarEnvelope()), {
      headers: { 'content-type': 'application/json' }
    });
  };

  const cacheDir = mkdtempSync(join(tmpdir(), 'ai-visual-cache-'));
  const instance = new VLLMJudge({
    provider: 'openai', model: 'gpt-4o', apiKey: 'test-key', cacheEnabled: true, cacheDir, env: {}
  });
  const image = fixtureImage();
  const context = { enableUncertaintyReduction: false };
  const cold = await instance.judgeScreenshot(image, 'Review this interface', context);
  const hit = await instance.judgeScreenshot(image, 'Review this interface', context);

  assert.equal(calls, 1);
  assert.equal(hit.cached, true);
  assert.deepEqual(hit.issues, cold.issues);
  assert.equal(typeof hit.issues[0], 'string');
  assert.equal(hit.score, cold.score);
  assert.equal(hit.kind, cold.kind);
});
