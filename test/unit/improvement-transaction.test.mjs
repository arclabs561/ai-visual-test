import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ImprovementTransactionError, runImprovementReview } from '../../src/improvement-transaction.js';

const hash = digit => digit.repeat(64);
const objective = { id: 'hierarchy', digest: hash('0'), description: 'Make the primary action clearer' };
const candidate = {
  id: 'primary-action', digest: hash('1'), metadata: { source: 'test' }, payload: { privatePatch: 'never persist this' },
};

function createHarness(options = {}) {
  const events = [];
  const baseline = {
    digest: options.baselineDigest ?? hash('2'), metadata: options.baselineMetadata ?? { viewport: '1280x720' },
    payload: options.baselinePayload ?? { pixels: 'baseline-private' },
  };
  const after = {
    digest: options.candidateDigest ?? hash('3'), metadata: options.candidateMetadata ?? { viewport: '1280x720' },
    payload: { pixels: 'candidate-private' },
  };
  const handle = { revertToken: 'private-handle' };
  const observer = {
    async capture(phase) {
      events.push(`capture:${phase}`);
      if (phase === 'candidate' && options.captureError) throw options.captureError;
      if (phase === 'rollback' && options.rollbackCaptureError) throw options.rollbackCaptureError;
      if (phase === 'rollback') return options.rollbackObservation ?? baseline;
      return phase === 'baseline' ? baseline : after;
    },
  };
  const adapter = {
    async prepare(received) { events.push(`prepare:${received.id}`); return handle; },
    async apply(received, appliedCandidate) {
      events.push(`apply:${received.revertToken}:${appliedCandidate.id}`);
      if (options.mutateBaselineDuringApply) {
        baseline.payload.screenshotBase64 = 'mutated-base64';
        baseline.payload.renderedCode.css = 'mutated-css';
      }
      if (options.applyError) throw options.applyError;
    },
    async verify(received) {
      events.push(`verify:${received.revertToken}`);
      if (options.verifyError) throw options.verifyError;
      return options.gates ?? [{ id: 'tests', passed: true }];
    },
    async rollback(received) {
      events.push(`rollback:${received.revertToken}`);
      if (options.rollbackError) throw options.rollbackError;
    },
  };
  const evaluator = {
    async compare(received) {
      events.push(`evaluate:${received.baseline.digest}:${received.candidate.digest}`);
      if (options.assertNoMetadata) {
        assert.equal('metadata' in received.baseline, false);
        assert.equal('metadata' in received.candidate, false);
      }
      if (options.assertEvidenceSnapshot) options.assertEvidenceSnapshot(received);
      if (options.evaluateError) throw options.evaluateError;
      return options.comparison ?? { original: 'candidate', reversed: 'candidate', metadata: { confidence: 0.9 } };
    },
  };
  return { events, observer, adapter, evaluator, baseline, after, handle };
}

describe('runImprovementReview', () => {
  it('prepares, applies, gates, evaluates, rolls back, and proves restoration in order', async () => {
    const harness = createHarness({ assertNoMetadata: true });
    const receipt = await runImprovementReview({ objective, candidate, ...harness });
    assert.deepEqual(harness.events, [
      'capture:baseline', 'prepare:primary-action', 'apply:private-handle:primary-action', 'verify:private-handle',
      'capture:candidate', `evaluate:${hash('2')}:${hash('3')}`, 'rollback:private-handle', 'capture:rollback',
    ]);
    assert.equal(receipt.status, 'review-required');
    assert.deepEqual(receipt.rollback, { status: 'observed-restored', digest: hash('2') });
    assert.equal('capture' in harness.adapter, false);
  });

  it('rejects failed or malformed gates without evaluator access', async () => {
    for (const gates of [
      [{ id: 'tests', passed: false }],
      [],
      [{ id: 'tests', passed: true, metadata: { nested: { invalid: true } } }],
    ]) {
      const harness = createHarness({ gates });
      if (gates.length === 1 && gates[0].passed === false) {
        const receipt = await runImprovementReview({ objective, candidate, ...harness });
        assert.equal(receipt.reason, 'constraint-failed');
      } else {
        await assert.rejects(
          runImprovementReview({ objective, candidate, ...harness }),
          error => error instanceof ImprovementTransactionError && error.phase === 'validate-input',
        );
      }
      assert.equal(harness.events.some(event => event.startsWith('evaluate:')), false);
      assert.equal(harness.events.includes('capture:candidate'), false);
      assert.deepEqual(harness.events.slice(-2), ['rollback:private-handle', 'capture:rollback']);
    }
  });

  it('rejects invalid input and baseline identities before apply', async () => {
    const invalidCandidateHarness = createHarness();
    await assert.rejects(
      runImprovementReview({ objective, candidate: { ...candidate, digest: 'invalid' }, ...invalidCandidateHarness }),
      error => error instanceof ImprovementTransactionError && error.phase === 'validate-input',
    );
    assert.deepEqual(invalidCandidateHarness.events, []);

    const invalidBaselineHarness = createHarness({ baselineDigest: 'invalid' });
    await assert.rejects(
      runImprovementReview({ objective, candidate, ...invalidBaselineHarness }),
      error => error instanceof ImprovementTransactionError && error.phase === 'validate-input',
    );
    assert.deepEqual(invalidBaselineHarness.events, ['capture:baseline']);
  });

  it('snapshots observation JSON before apply-side mutation and rejects unsupported payloads before prepare', async () => {
    const harness = createHarness({
      baselinePayload: {
        screenshotBase64: 'original-base64',
        renderedCode: { css: 'original-css' },
      },
      mutateBaselineDuringApply: true,
      assertEvidenceSnapshot(received) {
        assert.equal(received.baseline.payload.screenshotBase64, 'original-base64');
        assert.equal(received.baseline.payload.renderedCode.css, 'original-css');
        assert.equal(Object.isFrozen(received.baseline.payload), true);
        assert.equal(Object.isFrozen(received.baseline.payload.renderedCode), true);
      },
    });
    await runImprovementReview({ objective, candidate, ...harness });

    const unsupported = createHarness({ baselinePayload: () => 'not JSON evidence' });
    await assert.rejects(
      runImprovementReview({ objective, candidate, ...unsupported }),
      error => error instanceof ImprovementTransactionError && error.phase === 'validate-input',
    );
    assert.deepEqual(unsupported.events, ['capture:baseline']);
  });

  it('maps only agreeing counterbalanced outcomes to recommendations and conflicts to indeterminate', async () => {
    for (const [comparison, status, reason] of [
      [{ original: 'baseline', reversed: 'baseline' }, 'rejected', 'baseline-preferred'],
      [{ original: 'tie', reversed: 'tie' }, 'rejected', 'tie'],
      [{ original: 'candidate', reversed: 'baseline' }, 'indeterminate', 'comparison-conflict'],
    ]) {
      const harness = createHarness({ comparison });
      const receipt = await runImprovementReview({ objective, candidate, ...harness });
      assert.equal(receipt.status, status);
      assert.equal(receipt.reason, reason);
    }
  });

  it('rejects a single-order evaluator result and never treats it as a recommendation', async () => {
    const harness = createHarness({ comparison: { original: 'candidate' } });
    await assert.rejects(
      runImprovementReview({ objective, candidate, ...harness }),
      error => error instanceof ImprovementTransactionError && error.phase === 'evaluate',
    );
    assert.deepEqual(harness.events.slice(-2), ['rollback:private-handle', 'capture:rollback']);
  });

  it('rolls back after partial apply, capture, and evaluator errors', async () => {
    for (const [options, phase] of [
      [{ applyError: new Error('partial apply') }, 'apply'],
      [{ captureError: new Error('capture') }, 'capture-candidate'],
      [{ evaluateError: new Error('evaluate') }, 'evaluate'],
    ]) {
      const harness = createHarness(options);
      await assert.rejects(
        runImprovementReview({ objective, candidate, ...harness }),
        error => error instanceof ImprovementTransactionError && error.phase === phase,
      );
      assert.deepEqual(harness.events.slice(-2), ['rollback:private-handle', 'capture:rollback']);
    }
  });

  it('surfaces failed rollback proof and retains the original failure phase and cause', async () => {
    const original = new Error('evaluator failed');
    const harness = createHarness({ evaluateError: original, rollbackError: new Error('rollback failed') });
    await assert.rejects(
      runImprovementReview({ objective, candidate, ...harness }),
      error => error instanceof ImprovementTransactionError
        && error.phase === 'rollback'
        && error.failedPhase === 'evaluate'
        && error.failedCause === original,
    );

    const mismatch = createHarness({ rollbackObservation: { digest: hash('4'), payload: {} } });
    await assert.rejects(
      runImprovementReview({ objective, candidate, ...mismatch }),
      error => error instanceof ImprovementTransactionError && error.phase === 'rollback',
    );
  });

  it('detaches and freezes all receipt-facing values without leaking opaque payloads', async () => {
    const gates = [{ id: 'tests', passed: true, metadata: { provider: 'before' } }];
    const comparison = { original: 'candidate', reversed: 'candidate', metadata: { confidence: 0.9 } };
    const mutableObjective = { ...objective, metadata: { project: 'before' } };
    const mutableCandidate = { ...candidate, metadata: { source: 'before' } };
    const harness = createHarness({ gates, comparison });
    const receipt = await runImprovementReview({ objective: mutableObjective, candidate: mutableCandidate, ...harness });
    gates[0].passed = false;
    gates[0].metadata.provider = 'after';
    comparison.metadata.confidence = 0;
    mutableObjective.metadata.project = 'after';
    mutableCandidate.metadata.source = 'after';
    harness.baseline.metadata.viewport = 'after';
    const encoded = JSON.stringify(receipt);
    assert.equal(encoded.includes('never persist this'), false);
    assert.equal(encoded.includes('baseline-private'), false);
    assert.equal(encoded.includes('candidate-private'), false);
    assert.equal(encoded.includes('private-handle'), false);
    assert.equal(encoded.includes(objective.description), false);
    assert.equal(receipt.gates[0].passed, true);
    assert.equal(receipt.gates[0].metadata.provider, 'before');
    assert.equal(receipt.comparison.metadata.confidence, 0.9);
    assert.equal(receipt.objective.metadata.project, 'before');
    assert.equal(receipt.candidate.metadata.source, 'before');
    assert.equal(receipt.baseline.metadata.viewport, '1280x720');
    assert.equal(Object.isFrozen(receipt.gates), true);
    assert.equal(Object.isFrozen(receipt.gates[0]), true);
    assert.equal(Object.isFrozen(receipt.gates[0].metadata), true);
  });
});
