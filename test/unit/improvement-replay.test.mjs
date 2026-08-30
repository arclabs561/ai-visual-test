import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ReplayIdentityError,
  assertReplayCompatible,
  canonicalJson,
  canonicalJsonSha256,
  createReplayBinding,
  createReplayIdentity,
  createReplayVariant,
} from '../../src/improvement-replay.js';

const digest = char => char.repeat(64);
const bindingInput = () => ({
  objectiveSha256: digest('a'),
  candidateSha256: digest('b'),
  baselineObservationSha256: digest('b'),
  candidateObservationSha256: digest('c'),
  projectionId: 'web-evidence-v1',
  projectionConfigSha256: digest('d'),
  projectedBaselineSha256: digest('e'),
  projectedCandidateSha256: digest('f'),
  evaluatorId: 'comparison-judge-v1',
  evaluatorConfigSha256: digest('d'),
  responseKind: 'pairwise',
});

const promptVariant = () => ({ kind: 'prompt', promptVersion: 'v1', promptSha256: digest('e') });

test('canonical JSON and its digest are stable under object key order', () => {
  assert.equal(canonicalJson({ z: [true, { b: 2, a: 1 }], a: 'value' }), canonicalJson({ a: 'value', z: [true, { a: 1, b: 2 }] }));
  assert.equal(canonicalJsonSha256({ b: 2, a: 1 }), canonicalJsonSha256({ a: 1, b: 2 }));
});

test('binding is storage-safe and fixes every replay invariant', () => {
  const binding = createReplayBinding(bindingInput());
  assert.equal(binding.version, 1);
  assert.match(binding.sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(Object.keys(binding).sort(), [
    'baselineObservationSha256', 'candidateObservationSha256', 'candidateSha256',
    'evaluatorConfigSha256', 'evaluatorId', 'objectiveSha256', 'projectedBaselineSha256',
    'projectedCandidateSha256', 'projectionConfigSha256', 'projectionId', 'responseKind',
    'sha256', 'version',
  ]);
});

test('binding rejects missing or malformed candidate and projection invariants', () => {
  for (const [field, value] of [
    ['candidateSha256', undefined],
    ['candidateSha256', digest('B')],
    ['projectionId', undefined],
    ['projectionId', ''],
    ['projectionConfigSha256', undefined],
    ['projectionConfigSha256', digest('D')],
    ['projectedBaselineSha256', undefined],
    ['projectedBaselineSha256', digest('E')],
    ['projectedCandidateSha256', undefined],
    ['projectedCandidateSha256', digest('F')],
  ]) {
    const input = { ...bindingInput(), [field]: value };
    assert.throws(() => createReplayBinding(input), error => {
      assert.ok(error instanceof ReplayIdentityError);
      assert.equal(error.code, 'invalid_replay_binding');
      assert.equal(error.field, field);
      return true;
    });
  }
});

test('compatibility rejects each changed binding invariant', () => {
  const expected = createReplayBinding(bindingInput());
  for (const [field, value] of [
    ['objectiveSha256', digest('f')],
    ['candidateSha256', digest('f')],
    ['baselineObservationSha256', digest('f')],
    ['candidateObservationSha256', digest('f')],
    ['projectionId', 'web-evidence-v2'],
    ['projectionConfigSha256', digest('f')],
    ['projectedBaselineSha256', digest('0')],
    ['projectedCandidateSha256', digest('0')],
    ['evaluatorId', 'comparison-judge-v2'],
    ['evaluatorConfigSha256', digest('f')],
    ['responseKind', 'scalar'],
  ]) {
    const actual = createReplayBinding({ ...bindingInput(), [field]: value });
    assert.throws(() => assertReplayCompatible(expected, actual), error => {
      assert.ok(error instanceof ReplayIdentityError);
      assert.equal(error.code, 'incompatible_replay_binding');
      assert.equal(error.field, field);
      return true;
    });
  }
});

test('different frozen projector outputs are incompatible even with the same projector configuration', () => {
  const expected = createReplayBinding(bindingInput());
  const changedOutput = createReplayBinding({ ...bindingInput(), projectedCandidateSha256: digest('0') });
  assert.notEqual(expected.sha256, changedOutput.sha256);
  assert.throws(() => assertReplayCompatible(expected, changedOutput), error => {
    assert.ok(error instanceof ReplayIdentityError);
    assert.equal(error.code, 'incompatible_replay_binding');
    assert.equal(error.field, 'projectedCandidateSha256');
    return true;
  });
});

test('variant-only prompt changes remain compatible', () => {
  const first = createReplayIdentity({ binding: bindingInput(), variant: promptVariant() });
  const second = createReplayIdentity({
    binding: bindingInput(),
    variant: { kind: 'prompt', promptVersion: 'v2', promptSha256: digest('f') },
  });
  assert.notEqual(first.sha256, second.sha256);
  assert.doesNotThrow(() => assertReplayCompatible(first, second));
});

test('variant constructors require only hashes, never raw prompt, evidence, or graph bodies', () => {
  assert.equal(createReplayVariant({ kind: 'direct', promptVersion: 'v1', promptSha256: digest('e') }).kind, 'direct');
  assert.equal(createReplayVariant(promptVariant()).kind, 'prompt');
  assert.equal(createReplayVariant({ ...promptVariant(), kind: 'evidence', evidenceSha256: digest('f') }).kind, 'evidence');
  assert.equal(createReplayVariant({ ...promptVariant(), kind: 'graph', evidenceSha256: digest('f'), graphSha256: digest('0') }).kind, 'graph');

  assert.throws(() => createReplayVariant({ kind: 'direct', promptSha256: digest('e') }), /promptVersion/);
  assert.throws(() => createReplayVariant({ kind: 'direct', promptVersion: 'v1' }), /promptSha256/);
  assert.throws(() => createReplayVariant({ kind: 'prompt', promptVersion: 'v1' }), /promptSha256/);
  assert.throws(() => createReplayVariant({ ...promptVariant(), kind: 'evidence' }), /evidenceSha256/);
  assert.throws(() => createReplayVariant({ ...promptVariant(), kind: 'graph', evidenceSha256: digest('f') }), /graphSha256/);
  assert.throws(() => createReplayVariant({ ...promptVariant(), prompt: 'raw prompt' }), /unsupported shape/);
});
