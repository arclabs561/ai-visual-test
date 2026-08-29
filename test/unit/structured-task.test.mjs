import test from 'node:test';
import assert from 'node:assert/strict';

import { StructuredTaskContractError, executeStructuredTask } from '#structured-task';

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

function strictTask({ alwaysInvalid = false } = {}) {
  const schema = { type: 'object', properties: { action: { type: 'string' } }, required: ['action'] };
  const repairs = [];
  return {
    task: {
      name: 'game_action', schema, invalidOutputDescription: 'game action',
      parse(input) {
        const parsed = JSON.parse(input);
        if (alwaysInvalid || typeof parsed.action !== 'string') {
          throw new StructuredTaskContractError('Invalid action', [
            'missing_action', 'missing_action', 'invalid_payload'
          ]);
        }
        return { outcome: parsed, format: 'structured', diagnostics: [] };
      },
      buildRepairInstruction(diagnostics) {
        repairs.push(diagnostics);
        return `repair ${diagnostics.join(',')}`;
      },
    },
    repairs,
    schema,
  };
}

function input(adapter, task, maxRetries = 1) {
  return {
    adapter,
    call: { images: [], signal: new AbortController().signal, apiKey: 'test-key', config: { apiUrl: 'https://provider.invalid', model: 'gpt-4o' } },
    prompt: 'Choose one action.', task,
    structuredOutput: { mode: 'json-schema', name: task.name, schema: task.schema, strict: true, diagnostic: null },
    maxRetries, baseDelay: 0, maxDelay: 0,
  };
}

test('executes a valid canned non-review task without changing its schema', async () => {
  const calls = [];
  const { task, schema } = strictTask();
  const result = await executeStructuredTask(input(fakeAdapter(['{"action":"click"}'], calls), task));
  assert.deepEqual(result.outcome, { action: 'click' });
  assert.equal(result.attempts, 1);
  assert.equal(calls[0].structuredOutput.name, 'game_action');
  assert.equal(calls[0].structuredOutput.schema, schema);
});

test('repairs malformed task output using diagnostics only and retains schema/name', async () => {
  const calls = [];
  const { task, repairs, schema } = strictTask();
  const rawOutput = '{"note":"unique raw provider marker"}';
  const result = await executeStructuredTask(input(fakeAdapter([rawOutput, '{"action":"jump"}'], calls), task));
  assert.equal(result.outcome.action, 'jump');
  assert.equal(result.attempts, 2);
  assert.deepEqual(repairs, [['missing_action', 'invalid_payload']]);
  assert.match(calls[1].prompt, /missing_action,invalid_payload/);
  assert.doesNotMatch(calls[1].prompt, /unique raw provider marker/);
  assert.equal(calls[0].structuredOutput.name, calls[1].structuredOutput.name);
  assert.equal(calls[0].structuredOutput.schema, schema);
  assert.equal(calls[1].structuredOutput.schema, schema);
});

test('returns output-contract diagnostics after maxRetries plus one attempts', async () => {
  const calls = [];
  const { task } = strictTask({ alwaysInvalid: true });
  await assert.rejects(
    executeStructuredTask(input(fakeAdapter(['{}', '{}', '{}'], calls), task, 2)),
    error => error.details.failureKind === 'output_contract'
      && error.details.retryable === true
      && assert.deepEqual(error.details.diagnostics, ['missing_action', 'invalid_payload']) === undefined,
  );
  assert.equal(calls.length, 3);
});

test('propagates parser defects without sending a repair request', async () => {
  const calls = [];
  const { task } = strictTask();
  task.parse = () => { throw new TypeError('parser defect'); };
  await assert.rejects(
    executeStructuredTask(input(fakeAdapter(['{}'], calls), task)),
    error => error instanceof TypeError && error.message === 'parser defect',
  );
  assert.equal(calls.length, 1);
});

test('rejects a mismatched negotiated task contract before provider work', async () => {
  const calls = [];
  const { task } = strictTask();
  const request = input(fakeAdapter(['{}'], calls), task);
  request.structuredOutput = { ...request.structuredOutput, name: 'visual_review' };
  await assert.rejects(executeStructuredTask(request), TypeError);
  assert.equal(calls.length, 0);
});
