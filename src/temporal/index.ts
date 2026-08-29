/**
 * Public temporal API.
 *
 * This barrel intentionally re-exports the established runtime surface while
 * making its declaration contract derive from the typed temporal modules.
 */

// Core aggregation, graph construction, context helpers, and constants.
export {
  aggregateTemporalNotes,
  formatNotesForPrompt,
  calculateCoherenceExported as calculateCoherence,
  buildTemporalGraph,
  TIME_SCALES,
  MULTI_SCALE_WINDOWS,
  READING_SPEEDS,
  ATTENTION_MULTIPLIERS,
  COMPLEXITY_MULTIPLIERS,
  CONFIDENCE_THRESHOLDS,
  TIME_BOUNDS,
  CONTENT_THRESHOLDS,
  createTemporalContext,
  mergeTemporalContext,
  extractTemporalContext,
} from '#temporal-core';
export type {
  AggregatedTemporalNotes,
  EntityTracking,
  ExtractedTemporalContext,
  TemporalAggregationOptions,
  TemporalConflict,
  TemporalContext,
  TemporalContextOptions,
  TemporalGraph,
  TemporalGraphEdge,
  TemporalGraphNode,
  TemporalGraphOptions,
  TemporalGraphResult,
  TemporalNote,
  TemporalState,
  TemporalWindowSummary,
  WeightedTemporalNote,
} from '#temporal-core';

// Multi-scale aggregation, perception, and sequential context.
export {
  aggregateMultiScale,
  SequentialDecisionContext,
  humanPerceptionTime,
  calculateAttentionWeight,
  aggregateTemporalNotesAdaptive,
  calculateOptimalWindowSize,
  detectActivityPattern,
} from '#temporal-multi-scale';
export type {
  AdaptiveAggregationOptions,
  AttentionContext,
  MultiScaleAggregation,
  MultiScaleOptions,
  MultiScaleScale,
  MultiScaleWindowSummary,
  PerceptionContext,
  SequentialContextOptions,
  SequentialDecision,
  SequentialPatterns,
  TemporalRecord,
  VarianceIncreaseEvent,
  WindowSizeOptions,
} from '#temporal-multi-scale';

// Prompt formatting, selection, and temporal decision helpers.
export {
  formatTemporalContext,
  formatTemporalForPrompt,
  formatSingleScaleForPrompt,
  formatMultiScaleForPrompt,
  pruneTemporalNotes,
  propagateNotes,
  selectTopWeightedNotes,
  selectRepresentativeScreenshots,
  evaluateTemporalDecision,
} from '#temporal-prompt-formatting';
export type {
  PropagatedTemporalNote,
  ScreenshotEvaluation,
  ScreenshotSelectionOptions,
  SkippedTemporalDecisionResult,
  TemporalDecisionConfig,
  TemporalDecisionContext,
  TemporalPromptFormattingOptions,
  TemporalPropagationOptions,
  TemporalPruningOptions,
  TemporalScreenshot as TemporalPromptScreenshot,
  TopWeightedNotesOptions,
} from '#temporal-prompt-formatting';

// Decision management, preprocessing, batching, validation, and errors.
export {
  TemporalDecisionManager,
  createTemporalDecisionManager,
  TemporalPreprocessingManager,
  AdaptiveTemporalProcessor,
  createTemporalPreprocessingManager,
  createAdaptiveTemporalProcessor,
  TemporalBatchOptimizer,
  validateNotes,
  validateAndSortNotes,
  validateTimeScales,
  validateAction,
  validatePerceptionContext,
  validateSequentialContextOptions,
  TemporalError,
  PerceptionTimeError,
  SequentialContextError,
  MultiScaleError,
  TemporalBatchError,
} from '#temporal-orchestration';

// Temporal capture is shared with the multi-modal entry point by identity.
export { captureTemporalScreenshots } from '#temporal-capture';
export type {
  Page,
  ScreenshotOptions,
  TemporalCaptureOptions,
  TemporalScreenshot,
} from '#temporal-capture';
