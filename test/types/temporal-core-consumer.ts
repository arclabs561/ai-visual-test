// Internal declaration-emission contract.  The public /temporal subpath
// deliberately remains on its established handwritten barrel declaration.
import {
  aggregateTemporalNotes,
  buildTemporalGraph,
  createTemporalContext,
  type AggregatedTemporalNotes,
  type TemporalGraphResult,
  type TemporalNote,
} from '../../build/src/temporal-core.js';

const notes: TemporalNote[] = [
  { timestamp: 1_700_000_000_000, elapsed: 0, score: 8, observation: 'button visible' },
  { timestamp: 1_700_000_001_000, elapsed: 1_000, score: 9, observation: 'button responds' },
];

export const normalizedContext = createTemporalContext({ attentionLevel: 'focused' });
export const aggregated: Promise<AggregatedTemporalNotes> = aggregateTemporalNotes(notes, {
  windowSize: 1_000,
  decayFactor: 1,
});
export const graph: Promise<TemporalGraphResult> = buildTemporalGraph(notes, {
  useLLM: false,
  windowSize: 1_000,
});
