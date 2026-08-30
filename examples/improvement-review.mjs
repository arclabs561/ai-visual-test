import {
  canonicalJsonSha256,
  runImprovementReview,
} from '@arclabs561/ai-visual-test/improvement';

let layout = 'compact';

const candidate = {
  id: 'comfortable-spacing',
  payload: { layout: 'comfortable' },
};

const receipt = await runImprovementReview({
  objective: {
    id: 'primary-action-clarity',
    description: 'Make the primary action easier to identify without breaking layout.',
  },
  candidate,
  adapter: {
    async prepare(value) {
      return {
        handle: { before: layout, after: value.payload.layout },
        candidateSha256: canonicalJsonSha256(value.payload),
      };
    },
    async apply(handle) { layout = handle.after; },
    async verify() { return [{ id: 'layout-known', passed: layout === 'comfortable' }]; },
    async rollback(handle) { layout = handle.before; },
  },
  observer: {
    async capture() { return { payload: { layout } }; },
  },
  projector: {
    id: 'layout-evidence-v1',
    configSha256: canonicalJsonSha256({ fields: ['layout'] }),
    async project(observation) { return observation.payload; },
  },
  evaluator: {
    async compare({ a, b }) {
      const winner = a.payload.layout === 'comfortable' ? 'first'
        : b.payload.layout === 'comfortable' ? 'second'
          : 'tie';
      return { winner, execution: { id: crypto.randomUUID() } };
    },
  },
  evaluation: {
    id: 'example-pairwise-review',
    configSha256: canonicalJsonSha256({ evaluator: 'deterministic-example' }),
    variant: {
      kind: 'direct',
      promptVersion: 'example-v1',
      promptSha256: canonicalJsonSha256('Prefer comfortable spacing.'),
    },
  },
});

console.log({ status: receipt.status, reason: receipt.reason, restored: layout === 'compact' });
