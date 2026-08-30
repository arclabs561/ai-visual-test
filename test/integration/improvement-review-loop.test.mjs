import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { runImprovementReview } from '../../src/improvement-transaction.js';
import { captureWebImprovementObservation } from '../../src/web-improvement-observation.js';

const sha256 = value => createHash('sha256').update(value).digest('hex');
const canonicalJson = value => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
};

const evaluation = {
  id: 'counterbalanced-visual-comparison-v1',
  configSha256: sha256('route:fixed-test-double'),
  variant: {
    kind: 'direct',
    promptVersion: 'visual-improvement-v1',
    promptSha256: sha256('compare two anonymized observations against the objective'),
  },
};

test('reviews a downstream-owned web change through blinded descriptor evidence and rolls it back', async () => {
  let visualState = 'baseline';
  const events = [];
  const page = {
    async screenshot() {
      events.push(`screenshot:${visualState}`);
      return Buffer.from(`pixels:${visualState}`);
    },
  };

  const objective = {
    id: 'primary-action-hierarchy',
    description: 'Make the primary action visually dominant',
  };
  const candidate = {
    id: 'increase-primary-action-contrast',
    payload: { downstreamMutation: 'private to the consumer' },
  };
  const observer = {
    async capture(phase) {
      return captureWebImprovementObservation(page, {
        screenshotPath: `/caller-owned-evidence/${phase}.png`,
        captureCode: false,
        stability: { delayMs: 0 },
      });
    },
  };
  const adapter = {
    async prepare(received) {
      events.push(`prepare:${received.id}`);
      assert.equal(received.payload.downstreamMutation, 'private to the consumer');
      return {
        handle: { previous: visualState },
        candidateSha256: sha256('candidate:increase-primary-action-contrast:v1'),
      };
    },
    async apply(handle) {
      events.push('apply');
      assert.equal(handle.previous, 'baseline');
      visualState = 'candidate';
    },
    async verify() {
      events.push('verify');
      return [{ id: 'downstream-tests', passed: visualState === 'candidate' }];
    },
    async rollback(handle) {
      events.push('rollback');
      visualState = handle.previous;
    },
  };
  const projectedDigests = [];
  const projector = {
    id: 'screenshot-descriptor-only',
    configSha256: sha256('projection:screenshot-descriptor-only:v1'),
    async project({ payload }) {
      assert.equal(payload.screenshot.kind, 'sha256-artifact');
      assert.equal('screenshotBase64' in payload, false);
      const projected = { screenshot: payload.screenshot };
      projectedDigests.push(sha256(canonicalJson(projected)));
      return projected;
    },
  };
  const comparisons = [];
  const evaluator = {
    async compare({ objective: receivedObjective, a, b }) {
      events.push('compare');
      assert.equal(receivedObjective.id, objective.id);
      assert.deepEqual(Object.keys(a).sort(), ['payload']);
      assert.deepEqual(Object.keys(b).sort(), ['payload']);
      assert.equal('digest' in a, false);
      assert.equal('baseline' in a, false);
      assert.equal('candidate' in a, false);
      assert.equal('screenshotBase64' in a.payload, false);
      assert.equal('screenshotPath' in a.payload, false);
      assert.equal(a.payload.screenshot.kind, 'sha256-artifact');
      assert.equal(b.payload.screenshot.kind, 'sha256-artifact');
      comparisons.push({ a: a.payload.screenshot.sha256, b: b.payload.screenshot.sha256 });
      const firstIsBaseline = a.payload.screenshot.sha256 === sha256('pixels:baseline');
      const secondIsCandidate = b.payload.screenshot.sha256 === sha256('pixels:candidate');
      assert.notEqual(a.payload.screenshot.sha256, b.payload.screenshot.sha256);
      return firstIsBaseline && secondIsCandidate
        ? { winner: 'second', execution: { id: 'run-ab', metadata: { presentation: 'ab' } } }
        : { winner: 'first', execution: { id: 'run-ba', metadata: { presentation: 'ba' } } };
    },
  };

  const receipt = await runImprovementReview({ objective, candidate, adapter, observer, projector, evaluator, evaluation });

  assert.equal(receipt.status, 'review-required');
  assert.equal(receipt.reason, 'candidate-preferred');
  assert.equal(receipt.rollback.status, 'observed-restored');
  assert.equal(receipt.rollback.digest, receipt.baseline.digest);
  assert.equal(visualState, 'baseline');
  assert.deepEqual(comparisons, [
    { a: sha256('pixels:baseline'), b: sha256('pixels:candidate') },
    { a: sha256('pixels:candidate'), b: sha256('pixels:baseline') },
  ]);
  assert.deepEqual(receipt.comparison, {
    original: 'candidate',
    reversed: 'candidate',
    winner: 'candidate',
    originalExecution: { id: 'run-ab', metadata: { presentation: 'ab' } },
    reversedExecution: { id: 'run-ba', metadata: { presentation: 'ba' } },
  });
  assert.equal(receipt.evaluation.id, evaluation.id);
  assert.equal(receipt.evaluation.configSha256, evaluation.configSha256);
  assert.deepEqual(receipt.evaluation.projector, {
    id: projector.id,
    configSha256: projector.configSha256,
  });
  assert.equal(receipt.candidate.digest, sha256('candidate:increase-primary-action-contrast:v1'));
  assert.equal(receipt.evaluation.replay.binding.baselineObservationSha256, receipt.baseline.digest);
  assert.equal(receipt.evaluation.replay.binding.candidateObservationSha256, receipt.candidateObservation.digest);
  assert.equal(receipt.evaluation.replay.binding.candidateSha256, receipt.candidate.digest);
  assert.equal(receipt.evaluation.replay.binding.projectionId, projector.id);
  assert.equal(receipt.evaluation.replay.binding.projectionConfigSha256, projector.configSha256);
  assert.deepEqual([
    receipt.evaluation.replay.binding.projectedBaselineSha256,
    receipt.evaluation.replay.binding.projectedCandidateSha256,
  ], projectedDigests);
  assert.match(receipt.evaluation.replay.sha256, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(receipt).includes('downstreamMutation'), false);
  assert.equal(JSON.stringify(receipt).includes('caller-owned-evidence'), false);
  assert.ok(events.includes('rollback'));
});

test('derives rollback digest from payload instead of trusting a malicious observer digest', async () => {
  let visualState = 'baseline';
  const suppliedDigest = sha256('observer-controlled-and-reused');
  const observer = {
    async capture(phase) {
      return {
        digest: suppliedDigest,
        payload: { visual: phase === 'rollback' ? 'tampered' : visualState },
      };
    },
  };
  const adapter = {
    async prepare() { return { handle: { previous: visualState }, candidateSha256: sha256('candidate') }; },
    async apply() { visualState = 'candidate'; },
    async verify() { return [{ id: 'downstream-tests', passed: true }]; },
    async rollback(handle) { visualState = handle.previous; },
  };
  const projector = {
    id: 'identity-projection',
    configSha256: sha256('projection:identity'),
    async project({ payload }) { return payload; },
  };
  const evaluator = {
    async compare({ a, b }) {
      return a.payload.visual === 'baseline' && b.payload.visual === 'candidate'
        ? { winner: 'second', execution: { id: 'malicious-ab' } }
        : { winner: 'first', execution: { id: 'malicious-ba' } };
    },
  };

  await assert.rejects(
    runImprovementReview({
      objective: { id: 'rollback-integrity', description: 'Restore the target' },
      candidate: { id: 'candidate', payload: { opaque: true } },
      adapter,
      observer,
      projector,
      evaluator,
      evaluation,
    }),
    error => error?.phase === 'rollback' && /rollback capture digest does not match baseline/.test(error.cause?.message),
  );
  assert.equal(visualState, 'baseline');
});

test('rejects reused evaluator execution ids across blinded orders', async () => {
  let visualState = 'baseline';
  const observer = {
    async capture() { return { payload: { visual: visualState } }; },
  };
  const adapter = {
    async prepare() { return { handle: { previous: visualState }, candidateSha256: sha256('candidate') }; },
    async apply() { visualState = 'candidate'; },
    async verify() { return [{ id: 'downstream-tests', passed: true }]; },
    async rollback(handle) { visualState = handle.previous; },
  };
  const projector = {
    id: 'identity-projection',
    configSha256: sha256('projection:identity'),
    async project({ payload }) { return payload; },
  };
  const evaluator = {
    async compare() { return { winner: 'tie', execution: { id: 'reused-execution' } }; },
  };

  await assert.rejects(
    runImprovementReview({
      objective: { id: 'execution-integrity', description: 'Require independent evaluations' },
      candidate: { id: 'candidate', payload: { opaque: true } },
      adapter,
      observer,
      projector,
      evaluator,
      evaluation,
    }),
    error => error?.phase === 'evaluate' && /distinct execution ids/.test(error.cause?.message),
  );
  assert.equal(visualState, 'baseline');
});
