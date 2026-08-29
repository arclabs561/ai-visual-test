// Internal declaration-emission contract. The public /temporal subpath remains
// on its established handwritten declaration until its full barrel is typed.
import {
  aggregateMultiScale,
  aggregateTemporalNotesAdaptive,
  calculateAttentionWeight,
  calculateOptimalWindowSize,
  detectActivityPattern,
  humanPerceptionTime,
  SequentialDecisionContext,
  type MultiScaleAggregation,
  type TemporalRecord,
} from '../../build/src/temporal-multi-scale.js';

const notes: TemporalRecord[] = [
  { timestamp: 1_700_000_000_000, score: 8, observation: 'control changed' },
  { timestamp: 1_700_000_001_000, score: 9, observation: 'new content visible' },
];

export const multiScale: MultiScaleAggregation = aggregateMultiScale(notes);
export const attention: number = calculateAttentionWeight(notes[0]!, {
  elapsed: 0,
  windowSize: 1_000,
  scaleName: 'short',
});
export const windowSize: number = calculateOptimalWindowSize(notes);
export const pattern = detectActivityPattern(notes);
export const perception: number = humanPerceptionTime('reading', { contentLength: 100 });
export const adaptive = aggregateTemporalNotesAdaptive(notes);

const context = new SequentialDecisionContext({ adaptationEnabled: true });
context.addDecision({ score: 8, issues: ['layout'] });
context.addDecision({ score: 7, issues: ['layout'] });
export const patterns = context.identifyPatterns();
