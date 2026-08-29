// Internal declaration-emission contract. The public /temporal declaration
// remains handwritten until the complete temporal barrel can be generated.
import {
  createTemporalDecisionManager,
  createTemporalPreprocessingManager,
  TemporalBatchError,
  type TemporalDecisionManager,
} from '../../build/src/temporal-orchestration.js';

export const manager: TemporalDecisionManager = createTemporalDecisionManager({
  minNotesForPrompt: 2,
  coherenceThreshold: 0.5,
});

export const decision = manager.shouldPrompt(
  { score: 8 },
  { score: 7 },
  [{ timestamp: 1, score: 8, observation: 'stable' }],
);

export const cacheStats = createTemporalPreprocessingManager().getCacheStats();
export const dependencyError = new TemporalBatchError('missing predecessor');
