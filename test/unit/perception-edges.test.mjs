import test from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { makeOpenRouterText, makeOpenRouterVision, makePanel } from '../../src/perception/openrouter.js';
import { ledgerToDispositions, readLedger } from '../../src/perception/critiques.js';
import { samplePerceptions } from '../../src/perception/sample.js';

test('OpenRouter completion parses only the bounded content path from an unknown response envelope', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let request;
  globalThis.fetch = async (_url, init) => {
    request = JSON.parse(init.body);
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"finding":"overlap"}' } }] }), {
      headers: { 'content-type': 'application/json' },
    });
  };

  const complete = makeOpenRouterVision({ apiKey: 'test-key', imageBase64: 'image' });
  assert.deepEqual(await complete('system', 'user', 0.25), { finding: 'overlap' });
  assert.equal(request.response_format.type, 'json_object');
  assert.equal(request.messages[1].content[1].image_url.url, 'data:image/png;base64,image');
});

test('OpenRouter completion renders caller-owned native schema tasks without changing legacy calls', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const requests = [];
  globalThis.fetch = async (_url, init) => {
    requests.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }), {
      headers: { 'content-type': 'application/json' },
    });
  };

  const task = {
    name: 'perception_finding',
    schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
    strict: true,
  };
  assert.deepEqual(await makeOpenRouterVision({ apiKey: 'test-key', imageBase64: 'image' })('system', 'user', 0.2, task), { ok: true });
  assert.deepEqual(await makeOpenRouterText({ apiKey: 'test-key' })('system', 'user', 0.1, task), { ok: true });

  for (const request of requests) {
    assert.deepEqual(request.response_format, {
      type: 'json_schema',
      json_schema: { name: task.name, schema: task.schema, strict: true },
    });
  }
});

test('makePanel returns valid sampler judges and rejects malformed model specifications', () => {
  const panel = makePanel({
    apiKey: 'test-key',
    imageBase64: 'image',
    models: ['google/gemini-3.5-flash', { id: 'openai/gpt-5', weight: 0 }],
  });
  assert.deepEqual(panel.map(({ id, weight }) => ({ id, weight })), [
    { id: 'google/gemini-3.5-flash', weight: 1 },
    { id: 'openai/gpt-5', weight: 0 },
  ]);
  assert.throws(
    () => makePanel({ apiKey: 'test-key', imageBase64: 'image', models: [{ id: '   ' }] }),
    /nonempty string id/,
  );
  assert.throws(
    () => makePanel({ apiKey: 'test-key', imageBase64: 'image', models: [{ id: 'openai/gpt-5', weight: Number.NaN }] }),
    /finite and nonnegative/,
  );
  assert.throws(
    () => makePanel({ apiKey: 'test-key', imageBase64: 'image', models: [{ id: 'openai/gpt-5', weight: -1 }] }),
    /finite and nonnegative/,
  );
});

test('OpenRouter HTTP errors retain their status and bounded response preview', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => new Response('provider unavailable', { status: 503 });

  await assert.rejects(
    makeOpenRouterText({ apiKey: 'test-key' })('system', 'user', 0.1),
    error => error instanceof Error && error.message === '503 provider unavailable',
  );
});

test('OpenRouter malformed envelopes fail at JSON parsing rather than trusting arbitrary response fields', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => new Response(JSON.stringify({ choices: [null] }), {
    headers: { 'content-type': 'application/json' },
  });

  await assert.rejects(
    makeOpenRouterText({ apiKey: 'test-key' })('system', 'user', 0.1),
    SyntaxError,
  );
});

test('OpenRouter malformed model JSON enters the bounded diagnostic repair loop', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const requests = [];
  globalThis.fetch = async (_url, init) => {
    requests.push(JSON.parse(init.body));
    const content = requests.length === 1
      ? '{malformed'
      : JSON.stringify({
        headline: 'Readable heading', category: 'major',
        target: 'page heading', why: 'The heading is visible.', suggestion: 'Preserve it.', confidence: 0.9,
      });
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
      headers: { 'content-type': 'application/json' },
    });
  };

  const result = await samplePerceptions({
    vision: makeOpenRouterVision({ apiKey: 'test-key', imageBase64: 'image' }),
    modes: ['problem'],
    personas: [{ id: 'reader', who: 'a reader' }],
    contexts: [{ id: 'glance', ctx: 'during a glance' }],
    n: 1,
    verify: false,
  });

  assert.equal(result.samples.length, 1);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].response_format.type, 'json_schema');
  assert.match(requests[1].messages[1].content[0].text, /OUTPUT CONTRACT REPAIR.*invalid_json/s);
  assert.doesNotMatch(requests[1].messages[1].content[0].text, /\{malformed/);
});

test('ledger readers expose raw JSON values while the perception bridge ignores non-record entries', () => {
  const directory = mkdtempSync(join(tmpdir(), 'perception-edge-'));
  const ledgerPath = join(directory, 'ledger.jsonl');
  appendFileSync(ledgerPath, '{"version":"v1","critique":"header overlaps chart","status":"open"}\n');
  appendFileSync(ledgerPath, 'null\n');
  appendFileSync(ledgerPath, '["not","a","ledger","record"]\n');

  assert.equal(readLedger(ledgerPath).length, 3, 'the raw ledger API does not pretend to validate JSONL');
  assert.deepEqual(ledgerToDispositions(ledgerPath), [{
    target: 'header overlaps chart',
    disposition: 'operator-critique',
    reason: 'operator critique (build v1): header overlaps chart',
  }]);
  rmSync(directory, { recursive: true, force: true });
});
