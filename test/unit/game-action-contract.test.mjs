import test from 'node:test';
import assert from 'node:assert/strict';
import * as Value from 'typebox/value';

import {
  GAME_ACTION_SCHEMA,
  GameActionContractError,
  createGameActionTask,
  parseGameActionOutcome,
  parseLegacyGameAction,
} from '#game-action-contract';
import { executeStructuredTask } from '#structured-task';

const keyboard = { type: 'keyboard', key: 'ArrowRight' };
const click = { type: 'click', selector: '#play' };
const wait = { type: 'wait', duration: 100 };

function fakeAdapter(outputs, calls) {
  return {
    provider: 'openai',
    async call({ prompt, structuredOutput }) {
      calls.push({ prompt, structuredOutput });
      return new Response(outputs.shift());
    },
    async parseResponse(response) {
      return { judgment: await response.text(), data: { source: 'canned' }, logprobs: null };
    },
  };
}

function executionInput(adapter, task, maxRetries = 1) {
  return {
    adapter,
    call: {
      images: [], signal: new AbortController().signal, apiKey: 'test-key',
      config: { apiUrl: 'https://provider.invalid', model: 'gpt-4o' },
    },
    prompt: 'Choose exactly one action.',
    task,
    structuredOutput: {
      mode: 'json-schema', name: task.name, schema: task.schema, strict: true, diagnostic: null,
    },
    maxRetries, baseDelay: 0, maxDelay: 0,
  };
}

test('accepts each exact game action variant', () => {
  const keyboardActions = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Enter']
    .map(key => ({ type: 'keyboard', key }));
  for (const action of [...keyboardActions, click, wait]) {
    assert.equal(Value.Check(GAME_ACTION_SCHEMA, action), true);
    assert.deepEqual(parseGameActionOutcome(action).outcome, action);
  }
});

test('enforces keyboard, selector, and wait bounds', () => {
  for (const action of [
    { type: 'keyboard', key: 'KeyA' },
    { type: 'click', selector: '' },
    { type: 'click', selector: 'x'.repeat(513) },
    { type: 'click', selector: '#play\nbutton' },
    { type: 'wait', duration: 0 },
    { type: 'wait', duration: 10_001 },
    { type: 'wait', duration: 1.5 },
  ]) assert.equal(Value.Check(GAME_ACTION_SCHEMA, action), false);
});

test('rejects cross-variant fields and unknown properties with stable diagnostics', () => {
  const cases = [
    [{ ...keyboard, selector: '#play' }, 'invalid_key'],
    [{ ...keyboard, unexpected: true }, 'invalid_key'],
    [{ ...click, key: 'ArrowRight' }, 'invalid_selector'],
    [{ ...wait, selector: '#play' }, 'invalid_duration'],
    [{ type: 'jump', distance: 2 }, 'invalid_action_type'],
  ];
  for (const [input, diagnostic] of cases) {
    assert.throws(
      () => parseGameActionOutcome(input),
      error => error instanceof GameActionContractError
        && assert.deepEqual(error.diagnostics, [diagnostic]) === undefined,
    );
  }
});

test('strict mode rejects prose while bounded legacy mode accepts one fenced or embedded action', () => {
  const embedded = 'I will move now: {"type":"keyboard","key":"ArrowLeft"}.';
  assert.throws(
    () => parseGameActionOutcome(embedded, { allowLegacy: false }),
    error => error instanceof GameActionContractError
      && assert.deepEqual(error.diagnostics, ['invalid_json']) === undefined,
  );
  const parsed = parseGameActionOutcome(embedded);
  assert.deepEqual(parsed.outcome, { type: 'keyboard', key: 'ArrowLeft' });
  assert.equal(parsed.format, 'legacy-json');
  assert.deepEqual(parseLegacyGameAction('```json\n{"type":"wait","duration":1}\n```'), {
    type: 'wait', duration: 1,
  });
  assert.throws(() => parseLegacyGameAction('x'.repeat(2049)), GameActionContractError);
  assert.throws(
    () => parseLegacyGameAction('{"type":"wait","duration":1} {"type":"wait","duration":2}'),
    GameActionContractError,
  );
});

test('repairs malformed non-JSON action output without echoing raw content', async () => {
  const task = createGameActionTask(false);
  const calls = [];
  const rawMarker = 'raw game provider marker must not appear';
  const result = await executeStructuredTask(executionInput(fakeAdapter([
    rawMarker,
    JSON.stringify(click),
  ], calls), task));

  assert.deepEqual(result.outcome, click);
  assert.equal(result.attempts, 2);
  assert.match(calls[1].prompt, /invalid_json/);
  assert.doesNotMatch(calls[1].prompt, /raw game provider marker/);
  assert.equal(calls[0].structuredOutput.name, 'game_action');
  assert.equal(calls[1].structuredOutput.name, 'game_action');
  assert.equal(calls[0].structuredOutput.schema, GAME_ACTION_SCHEMA);
  assert.equal(calls[1].structuredOutput.schema, GAME_ACTION_SCHEMA);
});

test('returns stable game-action diagnostics after retry exhaustion', async () => {
  const task = createGameActionTask(false);
  const calls = [];
  await assert.rejects(
    executeStructuredTask(executionInput(fakeAdapter(['{}', '{}', '{}'], calls), task, 2)),
    error => error.details.failureKind === 'output_contract'
      && assert.deepEqual(error.details.diagnostics, ['invalid_action_type']) === undefined,
  );
  assert.equal(calls.length, 3);
});
