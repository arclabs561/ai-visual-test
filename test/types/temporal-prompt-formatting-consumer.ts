// Internal declaration-emission contract. The public /temporal declaration
// remains handwritten until its entire barrel can be generated without an overlay.
import {
  evaluateTemporalDecision,
  formatMultiScaleForPrompt,
  formatSingleScaleForPrompt,
  formatTemporalContext,
  formatTemporalForPrompt,
  propagateNotes,
  pruneTemporalNotes,
  selectRepresentativeScreenshots,
  selectTopWeightedNotes,
  type TemporalScreenshot,
} from '../../build/src/temporal-prompt-formatting.js';
import { type AggregatedTemporalNotes, type TemporalNote } from '../../build/src/temporal-core.js';
import { type MultiScaleAggregation } from '../../build/src/temporal-multi-scale.js';

const notes: TemporalNote[] = [
  { timestamp: 1_700_000_000_000, elapsed: 0, score: 7, observation: 'first observation' },
  { timestamp: 1_700_000_001_000, elapsed: 1_000, score: 8, observation: 'second observation' },
];

const aggregated: AggregatedTemporalNotes = {
  windows: [], summary: 'summary', coherence: 1, conflicts: [], totalNotes: 0, timeSpan: 0,
};
const multiScale: MultiScaleAggregation = { scales: {}, summary: 'summary', coherence: {} };
const screenshots: TemporalScreenshot[] = [
  { path: 'first.png', timestamp: 0 },
  { path: 'second.png', timestamp: 1_000 },
];

export const single = formatSingleScaleForPrompt(aggregated);
export const multi = formatMultiScaleForPrompt(multiScale);
export const formatted = formatTemporalForPrompt(aggregated);
export const context = formatTemporalContext(multiScale, { includeMultiScale: true });
export const pruned: TemporalNote[] = pruneTemporalNotes(notes, { maxNotes: 1 });
export const propagated = propagateNotes(notes, { relevanceThreshold: 0.1 });
export const top: TemporalNote[] = selectTopWeightedNotes(notes, { topN: 1 });
export const selected: TemporalScreenshot[] = selectRepresentativeScreenshots(screenshots, [{ score: 7 }]);
export const decision = evaluateTemporalDecision({ useTemporalDecision: false }, {});
