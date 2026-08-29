import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { judgeGameAction } from '../../src/judge.mjs';
import { ProviderError, TimeoutError } from '../../src/errors.mjs';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

function fixtureImage() {
  const dir = mkdtempSync(join(tmpdir(), 'ai-visual-game-action-'));
  const path = join(dir, 'pixel.png');
  writeFileSync(path, PNG_1X1);
  return path;
}

function actionContext(options = {}) {
  return {
    provider: 'openai', model: 'gpt-4o', apiKey: 'test-key', cacheEnabled: false, env: {}, ...options,
  };
}

function actionEnvelope(action) {
  return new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify(action) } }],
  }), { headers: { 'content-type': 'application/json' } });
}

test('game action uses the native schema task and returns only the action seam result', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let request;
  globalThis.fetch = async (_url, init) => {
    request = JSON.parse(init.body);
    return actionEnvelope({ type: 'keyboard', key: 'ArrowRight' });
  };

  const result = await judgeGameAction(fixtureImage(), 'Choose the next move.', {
    provider: 'openai', model: 'gpt-4o', apiKey: 'test-key', cacheEnabled: false, env: {},
    enableRateLimit: false,
  });

  assert.equal(request.response_format.type, 'json_schema');
  assert.equal(request.response_format.json_schema.name, 'game_action');
  assert.deepEqual(result.action, { type: 'keyboard', key: 'ArrowRight' });
  assert.equal(result.outputFormat, 'structured');
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.attempts, 1);
  assert.deepEqual(result.structuredOutput, { mode: 'json-schema', diagnostic: null });
  assert.equal('score' in result, false);
});

test('game action repairs malformed output with diagnostics but never raw provider output', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const prompts = [];
  let calls = 0;
  globalThis.fetch = async (_url, init) => {
    prompts.push(JSON.parse(init.body).messages[0].content[0].text);
    calls++;
    return calls === 1
      ? actionEnvelope({ type: 'keyboard', key: 'NotARealKey', marker: 'unique raw provider marker' })
      : actionEnvelope({ type: 'wait', duration: 10 });
  };

  const result = await judgeGameAction(fixtureImage(), 'Choose the next move.', actionContext({
    enableRateLimit: false, maxRetries: 1, retryBaseDelay: 0, retryMaxDelay: 0,
  }));

  assert.equal(calls, 2);
  assert.equal(result.action.type, 'wait');
  assert.match(prompts[1], /invalid_key/);
  assert.doesNotMatch(prompts[1], /unique raw provider marker/);
});

test('game actions bypass the review cache even when it is enabled', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return actionEnvelope({ type: 'keyboard', key: 'ArrowLeft' });
  };

  const image = fixtureImage();
  const context = actionContext({ cacheEnabled: true, cacheDir: mkdtempSync(join(tmpdir(), 'ai-visual-game-cache-')), enableRateLimit: false });
  await judgeGameAction(image, 'Choose the next move.', context);
  await judgeGameAction(image, 'Choose the next move.', context);
  assert.equal(calls, 2);
});

test('disabled game actions fail explicitly and never call a provider', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let calls = 0;
  globalThis.fetch = async () => { calls++; return actionEnvelope({ type: 'wait', duration: 1 }); };

  await assert.rejects(
    judgeGameAction(fixtureImage(), 'Choose the next move.', actionContext({ enabled: false, apiKey: null })),
    error => error instanceof ProviderError
      && error.details.failureKind === 'disabled'
      && error.details.retryable === false,
  );
  assert.equal(calls, 0);
});

test('transport authentication failures and timeouts are not output-contract repairs', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response(JSON.stringify({ detail: 'unauthorized' }), {
      status: 401, headers: { 'content-type': 'application/json' },
    });
  };
  await assert.rejects(
    judgeGameAction(fixtureImage(), 'Choose the next move.', actionContext({
      enableRateLimit: false, maxRetries: 2, retryBaseDelay: 0, retryMaxDelay: 0,
    })),
    error => error instanceof ProviderError && error.details.failureKind !== 'output_contract',
  );
  assert.equal(calls, 1);

  globalThis.fetch = async (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
  });
  await assert.rejects(
    judgeGameAction(fixtureImage(), 'Choose the next move.', actionContext({
      enableRateLimit: false, maxRetries: 0, timeout: 5,
    })),
    error => error instanceof TimeoutError && error.details.failureKind !== 'output_contract',
  );
});
