// The public temporal entry point is generated from the typed module barrel.
import {
  aggregateMultiScale,
  aggregateTemporalNotes,
  captureTemporalScreenshots,
  createTemporalContext,
  formatTemporalForPrompt,
  selectRepresentativeScreenshots,
  type AggregatedTemporalNotes,
  type MultiScaleAggregation,
  type Page,
  type TemporalCaptureOptions,
  type TemporalNote,
  type TemporalPromptScreenshot,
  type TemporalScreenshot,
} from '@arclabs561/ai-visual-test/temporal';

const notes: TemporalNote[] = [
  { timestamp: 0, score: 8, observation: 'Initial state' },
  { timestamp: 1_000, score: 9, observation: 'Improved state' },
];

export const aggregate: Promise<AggregatedTemporalNotes> = aggregateTemporalNotes(notes, {
  temporalReference: 0,
});

export const multiScale: MultiScaleAggregation = aggregateMultiScale(notes);
export const formatted: string = formatTemporalForPrompt(multiScale, { includeMultiScale: true });
export const context = createTemporalContext({ attentionLevel: 'focused' });

const page: Page = {
  async screenshot(_options) { return new Uint8Array(); },
};
const captureOptions: TemporalCaptureOptions = { fps: 2, duration: 1_000 };
export const captures: Promise<TemporalScreenshot[]> = captureTemporalScreenshots(page, captureOptions);

const screenshots: TemporalPromptScreenshot[] = [
  { path: 'first.png', timestamp: 0 },
  { path: 'second.png', timestamp: 1_000 },
];
export const selected: TemporalPromptScreenshot[] = selectRepresentativeScreenshots(screenshots, [], {
  strategy: 'uniform',
});
