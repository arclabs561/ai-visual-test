/**
 * Temporal Sub-Module
 *
 * All temporal aggregation and decision-making functionality.
 *
 * Import from 'ai-visual-test/temporal'
 */

// Core temporal aggregation and constants
export {
  aggregateTemporalNotes,
  formatNotesForPrompt,
  calculateCoherenceExported as calculateCoherence,
  buildTemporalGraph,
  // Constants
  TIME_SCALES,
  MULTI_SCALE_WINDOWS,
  READING_SPEEDS,
  ATTENTION_MULTIPLIERS,
  COMPLEXITY_MULTIPLIERS,
  CONFIDENCE_THRESHOLDS,
  TIME_BOUNDS,
  CONTENT_THRESHOLDS,
  // Context utilities
  createTemporalContext,
  mergeTemporalContext,
  extractTemporalContext
} from '#temporal-core';

// Multi-scale aggregation, attention, perception, adaptive
export {
  aggregateMultiScale,
  SequentialDecisionContext,
  humanPerceptionTime,
  calculateAttentionWeight,
  aggregateTemporalNotesAdaptive,
  calculateOptimalWindowSize,
  detectActivityPattern
} from '../temporal-multi-scale.mjs';

// Temporal formatting, pruning, logic
export {
  formatTemporalContext,
  formatTemporalForPrompt,
  formatSingleScaleForPrompt,
  formatMultiScaleForPrompt,
  pruneTemporalNotes,
  propagateNotes,
  selectTopWeightedNotes,
  selectRepresentativeScreenshots,
  evaluateTemporalDecision
} from '../temporal-prompt-formatting.mjs';

// Orchestration: decision manager, preprocessing, batch optimizer, validation, errors
export {
  TemporalDecisionManager,
  createTemporalDecisionManager,
  TemporalPreprocessingManager,
  AdaptiveTemporalProcessor,
  createTemporalPreprocessingManager,
  createAdaptiveTemporalProcessor,
  TemporalBatchOptimizer,
  // Validation
  validateNotes,
  validateAndSortNotes,
  validateTimeScales,
  validateAction,
  validatePerceptionContext,
  validateSequentialContextOptions,
  // Errors
  TemporalError,
  PerceptionTimeError,
  SequentialContextError,
  MultiScaleError,
  TemporalBatchError
} from '../temporal-orchestration.mjs';

// Temporal screenshots (from multi-modal)
export { captureTemporalScreenshots } from '../multi-modal.mjs';
