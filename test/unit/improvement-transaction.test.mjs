import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ImprovementTransactionError, runImprovementReview } from '../../src/improvement-transaction.js';

const hash = digit => digit.repeat(64);
const objective = { id: 'hierarchy', description: 'Make the primary action clearer' };
const candidate = {
  id: 'primary-action', metadata: { source: 'test' }, payload: { privatePatch: 'never persist this' },
};
const evaluation = {
  id: 'test-evaluator', configSha256: hash('4'),
  variant: { kind: 'direct', promptVersion: 'v1', promptSha256: hash('5') },
};

function createHarness(options = {}) {
  const events = [];
  const baseline = {
    digest: options.baselineDigest ?? hash('2'), metadata: options.baselineMetadata ?? { viewport: '1280x720' },
    payload: options.baselinePayload ?? { pixels: 'baseline-private' },
  };
  const after = {
    digest: options.candidateDigest ?? hash('3'), metadata: options.candidateMetadata ?? { viewport: '1280x720' },
    payload: options.candidatePayload ?? { pixels: 'candidate-private' },
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
    async prepare(received) {
      events.push(`prepare:${received.id}`);
      if (options.prepareError) throw options.prepareError;
      if (options.mutateCandidateAfterPrepare) received.payload.privatePatch = 'mutated-after-prepare';
      return { handle, candidateSha256: options.candidateFingerprint ?? hash('1') };
    },
    async apply(received) {
      events.push(`apply:${received.revertToken}:${arguments.length}`);
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
  const projector = {
    id: 'test-projector', configSha256: hash('6'),
    async project(received) {
      events.push(`project:${received.payload.pixels ?? 'structured'}`);
      if (options.projectError) throw options.projectError;
      return options.project ? options.project(received.payload) : received.payload;
    },
  };
  let comparisonIndex = 0;
  const evaluator = {
    async compare(received) {
      events.push(`evaluate:${received.a.payload.pixels}:${received.b.payload.pixels}`);
      if (options.assertNoMetadata) {
        assert.equal('metadata' in received.a, false);
        assert.equal('metadata' in received.b, false);
      }
      if (options.assertBlinded) {
        assert.deepEqual(Object.keys(received.a), ['payload']);
        assert.deepEqual(Object.keys(received.b), ['payload']);
        assert.equal('baseline' in received, false);
        assert.equal('candidate' in received, false);
        assert.equal('order' in received, false);
      }
      if (options.assertEvidenceSnapshot) options.assertEvidenceSnapshot(received);
      if (options.assertProjected) options.assertProjected(received);
      if (options.evaluateError) throw options.evaluateError;
      const comparisons = options.comparisons ?? [
        { winner: 'second', execution: { id: 'eval-original', metadata: { confidence: 0.9 } } },
        { winner: 'first', execution: { id: 'eval-reversed', metadata: { confidence: 0.9 } } },
      ];
      return comparisons[comparisonIndex++];
    },
  };
  return { events, observer, adapter, projector, evaluator, evaluation, baseline, after, handle };
}

describe('runImprovementReview', () => {
  it('prepares, applies, gates, evaluates, rolls back, and proves restoration in order', async () => {
    const harness = createHarness({ assertNoMetadata: true, assertBlinded: true });
    const receipt = await runImprovementReview({ objective, candidate, ...harness });
    assert.deepEqual(harness.events, [
      'capture:baseline', 'prepare:primary-action', 'apply:private-handle:1', 'verify:private-handle',
      'capture:candidate', 'project:baseline-private', 'project:candidate-private',
      'evaluate:baseline-private:candidate-private', 'evaluate:candidate-private:baseline-private',
      'rollback:private-handle', 'capture:rollback',
    ]);
    assert.equal(receipt.status, 'review-required');
    assert.equal(receipt.rollback.digest, receipt.baseline.digest);
    assert.notEqual(receipt.baseline.digest, hash('2'));
    assert.equal(receipt.evaluation.replay.binding.evaluatorId, 'test-evaluator');
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

  it('derives objective and candidate identities from kernel/adapter-owned sources', async () => {
    const invalidCandidateHarness = createHarness();
    await assert.rejects(
      runImprovementReview({ objective, candidate: { ...candidate, id: 'invalid id' }, ...invalidCandidateHarness }),
      error => error instanceof ImprovementTransactionError && error.phase === 'validate-input',
    );
    assert.deepEqual(invalidCandidateHarness.events, []);

    const invalidObjectiveHarness = createHarness();
    await assert.rejects(
      runImprovementReview({ objective: { ...objective, digest: hash('0') }, candidate, ...invalidObjectiveHarness }),
      error => error instanceof ImprovementTransactionError && error.phase === 'validate-input',
    );
    assert.deepEqual(invalidObjectiveHarness.events, []);

    const fingerprintHarness = createHarness({ candidateFingerprint: 'invalid' });
    await assert.rejects(
      runImprovementReview({ objective, candidate, ...fingerprintHarness }),
      error => error instanceof ImprovementTransactionError && error.phase === 'prepare',
    );
    assert.deepEqual(fingerprintHarness.events, ['capture:baseline', 'prepare:primary-action']);

    const invalidEvaluationHarness = createHarness();
    await assert.rejects(
      runImprovementReview({ objective, candidate, ...invalidEvaluationHarness, evaluation: { ...evaluation, configSha256: 'invalid' } }),
      error => error instanceof ImprovementTransactionError && error.phase === 'validate-input',
    );
    assert.deepEqual(invalidEvaluationHarness.events, []);

    const mismatchedKindHarness = createHarness();
    await assert.rejects(
      runImprovementReview({ objective, candidate, ...mismatchedKindHarness, evaluation: { ...evaluation, responseKind: 'scalar' } }),
      error => error instanceof ImprovementTransactionError && error.phase === 'validate-input',
    );
    assert.deepEqual(mismatchedKindHarness.events, []);
  });

  it('snapshots observation JSON before apply-side mutation and rejects unsupported payloads before prepare', async () => {
    const harness = createHarness({
      baselinePayload: {
        screenshotBase64: 'original-base64',
        renderedCode: { css: 'original-css' },
      },
      mutateBaselineDuringApply: true,
      rollbackObservation: {
        digest: 'untrusted-rollback-digest',
        payload: { screenshotBase64: 'original-base64', renderedCode: { css: 'original-css' } },
      },
      assertEvidenceSnapshot(received) {
        const baselineEvidence = received.a.payload.screenshotBase64 === 'original-base64' ? received.a : received.b;
        assert.equal(baselineEvidence.payload.screenshotBase64, 'original-base64');
        assert.equal(baselineEvidence.payload.renderedCode.css, 'original-css');
        assert.equal(Object.isFrozen(baselineEvidence.payload), true);
        assert.equal(Object.isFrozen(baselineEvidence.payload.renderedCode), true);
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

  it('projects each frozen observation once and exposes only projected evidence to the evaluator', async () => {
    const harness = createHarness({
      project(payload) { return { publicLabel: payload.pixels === 'baseline-private' ? 'A' : 'B' }; },
      assertProjected(received) {
        assert.deepEqual([received.a.payload.publicLabel, received.b.payload.publicLabel].sort(), ['A', 'B']);
        assert.equal('pixels' in received.a.payload, false);
        assert.equal(Object.isFrozen(received.a.payload), true);
      },
    });
    await runImprovementReview({ objective, candidate, ...harness });
    assert.deepEqual(harness.events.filter(event => event.startsWith('project:')), [
      'project:baseline-private', 'project:candidate-private',
    ]);
  });

  it('rejects unchanged observation or projected evidence without evaluator access', async () => {
    const unchangedObservation = createHarness({
      candidatePayload: { pixels: 'baseline-private' },
    });
    const observationReceipt = await runImprovementReview({ objective, candidate, ...unchangedObservation });
    assert.equal(observationReceipt.status, 'rejected');
    assert.equal(observationReceipt.reason, 'no-observable-change');
    assert.equal(unchangedObservation.events.some(event => event.startsWith('project:')), false);
    assert.equal(unchangedObservation.events.some(event => event.startsWith('evaluate:')), false);

    const unchangedProjection = createHarness({
      project() { return { same: true }; },
    });
    const projectionReceipt = await runImprovementReview({ objective, candidate, ...unchangedProjection });
    assert.equal(projectionReceipt.status, 'rejected');
    assert.equal(projectionReceipt.reason, 'no-observable-change');
    assert.equal(unchangedProjection.events.filter(event => event.startsWith('project:')).length, 2);
    assert.equal(unchangedProjection.events.some(event => event.startsWith('evaluate:')), false);
  });

  it('seals candidate identity during prepare so apply has no caller-payload channel', async () => {
    const mutableCandidate = {
      ...candidate,
      payload: { privatePatch: 'before-prepare' },
    };
    const harness = createHarness({ mutateCandidateAfterPrepare: true });
    const receipt = await runImprovementReview({ objective, candidate: mutableCandidate, ...harness });
    assert.equal(mutableCandidate.payload.privatePatch, 'mutated-after-prepare');
    assert.equal(receipt.candidate.digest, hash('1'));
    assert.equal(JSON.stringify(receipt).includes('mutated-after-prepare'), false);
    assert.equal(harness.events.includes('apply:private-handle:1'), true);
  });

  it('maps only agreeing counterbalanced outcomes to recommendations and conflicts to indeterminate', async () => {
    for (const [comparisons, status, reason] of [
      [[{ winner: 'first', execution: { id: 'one' } }, { winner: 'second', execution: { id: 'two' } }], 'rejected', 'baseline-preferred'],
      [[{ winner: 'tie', execution: { id: 'one' } }, { winner: 'tie', execution: { id: 'two' } }], 'rejected', 'tie'],
      [[{ winner: 'second', execution: { id: 'one' } }, { winner: 'second', execution: { id: 'two' } }], 'indeterminate', 'comparison-conflict'],
    ]) {
      const harness = createHarness({ comparisons });
      const receipt = await runImprovementReview({ objective, candidate, ...harness });
      assert.equal(receipt.status, status);
      assert.equal(receipt.reason, reason);
    }
  });

  it('rejects malformed blind evaluator results and never treats them as a recommendation', async () => {
    const harness = createHarness({ comparisons: [{ winner: 'second', execution: { id: 'one' } }, { winner: 'candidate', execution: { id: 'two' } }] });
    await assert.rejects(
      runImprovementReview({ objective, candidate, ...harness }),
      error => error instanceof ImprovementTransactionError && error.phase === 'evaluate',
    );
    assert.deepEqual(harness.events.slice(-2), ['rollback:private-handle', 'capture:rollback']);

    const duplicateExecution = createHarness({ comparisons: [
      { winner: 'second', execution: { id: 'same-run' } },
      { winner: 'first', execution: { id: 'same-run' } },
    ] });
    await assert.rejects(
      runImprovementReview({ objective, candidate, ...duplicateExecution }),
      error => error instanceof ImprovementTransactionError && error.phase === 'evaluate',
    );
    assert.deepEqual(duplicateExecution.events.slice(-2), ['rollback:private-handle', 'capture:rollback']);
  });

  it('rolls back after partial apply, capture, and evaluator errors', async () => {
    for (const [options, phase] of [
      [{ applyError: new Error('partial apply') }, 'apply'],
      [{ captureError: new Error('capture') }, 'capture-candidate'],
      [{ projectError: new Error('projection') }, 'project-evidence'],
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
    const comparisons = [
      { winner: 'second', execution: { id: 'original', metadata: { confidence: 0.9 } } },
      { winner: 'first', execution: { id: 'reversed', metadata: { confidence: 0.8 } } },
    ];
    const mutableObjective = { ...objective, metadata: { project: 'before' } };
    const mutableCandidate = { ...candidate, metadata: { source: 'before' } };
    const harness = createHarness({ gates, comparisons });
    const receipt = await runImprovementReview({ objective: mutableObjective, candidate: mutableCandidate, ...harness });
    gates[0].passed = false;
    gates[0].metadata.provider = 'after';
    comparisons[0].execution.metadata.confidence = 0;
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
    assert.equal(receipt.comparison.originalExecution.metadata.confidence, 0.9);
    assert.equal(receipt.comparison.reversedExecution.metadata.confidence, 0.8);
    assert.equal(receipt.objective.metadata.project, 'before');
    assert.equal(receipt.candidate.metadata.source, 'before');
    assert.equal(receipt.baseline.metadata.viewport, '1280x720');
    assert.equal(receipt.evaluation.replay.binding.evaluatorConfigSha256, hash('4'));
    assert.equal(receipt.evaluation.projector.id, 'test-projector');
    assert.equal(receipt.evaluation.replay.binding.candidateSha256, hash('1'));
    assert.equal(receipt.evaluation.replay.binding.projectionConfigSha256, hash('6'));
    assert.equal(Object.isFrozen(receipt.evaluation.replay), true);
    assert.equal(Object.isFrozen(receipt.gates), true);
    assert.equal(Object.isFrozen(receipt.gates[0]), true);
    assert.equal(Object.isFrozen(receipt.gates[0].metadata), true);
  });
});
