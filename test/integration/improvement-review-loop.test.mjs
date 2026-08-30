import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { createReplayIdentity, canonicalJsonSha256 } from '../../src/improvement-replay.js';
import { runImprovementReview } from '../../src/improvement-transaction.js';
import { captureWebImprovementObservation } from '../../src/web-improvement-observation.js';

const sha256 = value => createHash('sha256').update(value).digest('hex');

test('reviews a downstream-owned web change, rolls it back, and binds replay identity', async () => {
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
    digest: sha256('make the primary action visually dominant'),
    description: 'Make the primary action visually dominant',
  };
  const candidate = {
    id: 'increase-primary-action-contrast',
    digest: sha256('candidate:increase-primary-action-contrast:v1'),
    payload: { downstreamMutation: 'private to the consumer' },
  };
  const observer = {
    async capture(phase) {
      return captureWebImprovementObservation(page, {
        screenshotPath: `/ignored-evidence/${phase}.png`,
        captureCode: false,
        stability: { delayMs: 0 },
      });
    },
  };
  const adapter = {
    async prepare(received) {
      events.push(`prepare:${received.id}`);
      return { previous: visualState };
    },
    async apply(handle, received) {
      events.push(`apply:${received.id}`);
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
  const evaluator = {
    async compare({ baseline, candidate: candidateObservation }) {
      events.push('compare');
      assert.equal(Buffer.from(baseline.payload.screenshotBase64, 'base64').toString(), 'pixels:baseline');
      assert.equal(Buffer.from(candidateObservation.payload.screenshotBase64, 'base64').toString(), 'pixels:candidate');
      assert.notEqual(baseline.digest, candidateObservation.digest);
      return {
        original: 'candidate',
        reversed: 'candidate',
        metadata: { counterbalance: 'agree' },
      };
    },
  };

  const receipt = await runImprovementReview({ objective, candidate, adapter, observer, evaluator });

  assert.equal(receipt.status, 'review-required');
  assert.equal(receipt.reason, 'candidate-preferred');
  assert.equal(receipt.rollback.status, 'observed-restored');
  assert.equal(receipt.rollback.digest, receipt.baseline.digest);
  assert.equal(visualState, 'baseline');
  assert.deepEqual(events, [
    'screenshot:baseline',
    'screenshot:baseline',
    'prepare:increase-primary-action-contrast',
    'apply:increase-primary-action-contrast',
    'verify',
    'screenshot:candidate',
    'screenshot:candidate',
    'compare',
    'rollback',
    'screenshot:baseline',
    'screenshot:baseline',
  ]);

  const replay = createReplayIdentity({
    binding: {
      objectiveSha256: receipt.objective.digest,
      baselineObservationSha256: receipt.baseline.digest,
      candidateObservationSha256: receipt.candidateObservation.digest,
      evaluatorId: 'counterbalanced-visual-comparison-v1',
      evaluatorConfigSha256: canonicalJsonSha256({ route: 'fixed-test-double' }),
      responseKind: 'pairwise',
    },
    variant: {
      kind: 'direct',
      promptVersion: 'visual-improvement-v1',
      promptSha256: sha256('compare baseline and candidate against the objective'),
    },
  });

  assert.match(replay.sha256, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(receipt).includes('downstreamMutation'), false);
});
