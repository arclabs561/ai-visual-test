import { OpaqueClass } from './shared.js';
import type { OpaqueFunction } from './shared.js';

export class AdaptiveTemporalProcessor extends OpaqueClass {}
export class MultiScaleError extends Error {}
export class PerceptionTimeError extends Error {}
export class SequentialContextError extends Error {}
export class SequentialDecisionContext extends OpaqueClass {}
export class TemporalBatchError extends Error {}
export class TemporalBatchOptimizer extends OpaqueClass {}
export class TemporalDecisionManager extends OpaqueClass {}
export class TemporalError extends Error {}
export class TemporalPreprocessingManager extends OpaqueClass {}

export const ATTENTION_MULTIPLIERS: Readonly<Record<string, number>>;
export const COMPLEXITY_MULTIPLIERS: Readonly<Record<string, number>>;
export const CONFIDENCE_THRESHOLDS: Readonly<Record<string, number>>;
export const CONTENT_THRESHOLDS: Readonly<Record<string, number>>;
export const MULTI_SCALE_WINDOWS: readonly unknown[];
export const READING_SPEEDS: Readonly<Record<string, number>>;
export const TIME_BOUNDS: Readonly<Record<string, number>>;
export const TIME_SCALES: Readonly<Record<string, number>>;

export const aggregateMultiScale: OpaqueFunction;
export const aggregateTemporalNotes: OpaqueFunction;
export const aggregateTemporalNotesAdaptive: OpaqueFunction;
export const buildTemporalGraph: OpaqueFunction;
export const calculateAttentionWeight: OpaqueFunction;
export const calculateCoherence: OpaqueFunction;
export const calculateOptimalWindowSize: OpaqueFunction;
export {
  captureTemporalScreenshots,
  type Page,
  type ScreenshotOptions,
  type TemporalCaptureOptions,
  type TemporalScreenshot,
} from '#temporal-capture';
export const createAdaptiveTemporalProcessor: OpaqueFunction;
export const createTemporalContext: OpaqueFunction;
export const createTemporalDecisionManager: OpaqueFunction;
export const createTemporalPreprocessingManager: OpaqueFunction;
export const detectActivityPattern: OpaqueFunction;
export const evaluateTemporalDecision: OpaqueFunction;
export const extractTemporalContext: OpaqueFunction;
export const formatMultiScaleForPrompt: OpaqueFunction;
export const formatNotesForPrompt: OpaqueFunction;
export const formatSingleScaleForPrompt: OpaqueFunction;
export const formatTemporalContext: OpaqueFunction;
export const formatTemporalForPrompt: OpaqueFunction;
export const humanPerceptionTime: OpaqueFunction;
export const mergeTemporalContext: OpaqueFunction;
export const propagateNotes: OpaqueFunction;
export const pruneTemporalNotes: OpaqueFunction;
export const selectRepresentativeScreenshots: OpaqueFunction;
export const selectTopWeightedNotes: OpaqueFunction;
export const validateAction: OpaqueFunction;
export const validateAndSortNotes: OpaqueFunction;
export const validateNotes: OpaqueFunction;
export const validatePerceptionContext: OpaqueFunction;
export const validateSequentialContextOptions: OpaqueFunction;
export const validateTimeScales: OpaqueFunction;
