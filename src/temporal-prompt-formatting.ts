/**
 * Temporal Prompt Formatting
 *
 * Single/multi-scale prompt formatting, note selection, pruning,
 * representative screenshot selection, and temporal decision evaluation wrapper.
 *
 * Consolidated from: temporal-prompt-formatter.mjs, temporal-note-pruner.mjs, temporal-logic.mjs
 *
 * Depends on: temporal-core.mjs, temporal-multi-scale.mjs
 */

import {
  formatNotesForPrompt,
  type AggregatedTemporalNotes,
  type TemporalNote,
} from '#temporal-core';
import {
  calculateAttentionWeight,
  type MultiScaleAggregation,
} from '#temporal-multi-scale';
import { log } from './logger.mjs';
import { safeLogTemporalDecision } from './safe-logger.mjs';

export interface TemporalPromptFormattingOptions {
  includeMultiScale?: boolean;
  naturalLanguage?: boolean;
}

export interface TemporalPruningOptions {
  maxNotes?: number;
  minWeight?: number;
  currentTime?: number;
  windowSize?: number;
}

export interface TemporalPropagationOptions {
  currentTime?: number;
  relevanceThreshold?: number;
}

export interface TopWeightedNotesOptions {
  topN?: number;
}

export interface TemporalScreenshot {
  path: string;
  timestamp: number;
  elapsed?: number;
  [key: string]: unknown;
}

export interface ScreenshotEvaluation {
  score?: number;
  [key: string]: unknown;
}

export interface ScreenshotSelectionOptions {
  maxScreenshots?: number;
  strategy?: 'diversity' | 'keyframes' | 'uniform';
}

export interface PropagatedTemporalNote extends TemporalNote {
  weight: number;
  relevance: number;
  propagated: true;
}

export interface TemporalDecisionContext extends Record<string, unknown> {
  useTemporalDecision?: boolean;
  temporalNotes?: TemporalNote[];
  temporalDecisionOptions?: Record<string, unknown>;
  currentState?: Record<string, unknown>;
  previousState?: Record<string, unknown> | null;
  previousResult?: Record<string, unknown>;
}

export interface TemporalDecisionConfig {
  debug?: { verbose?: boolean };
}

type TemporalDecisionManagerRuntime = {
  shouldPrompt(
    currentState: Record<string, unknown>,
    previousState: Record<string, unknown> | null,
    notes: TemporalNote[],
    context: TemporalDecisionContext,
  ): Promise<{ shouldPrompt: boolean; reason: string; urgency: 'low' | 'medium' | 'high' }>;
  calculateStateChange(currentState: Record<string, unknown>, previousState: Record<string, unknown> | null): unknown;
  isDecisionPoint(currentState: Record<string, unknown>, context: TemporalDecisionContext): unknown;
  hasRecentUserAction(notes: TemporalNote[], context: TemporalDecisionContext): unknown;
};

type TemporalDecisionManagerConstructor = new (
  options: Record<string, unknown>,
) => TemporalDecisionManagerRuntime;

function isMultiScaleAggregation(value: object): value is MultiScaleAggregation {
  return 'scales' in value && !('windows' in value);
}

function isAggregatedTemporalNotes(value: object): value is AggregatedTemporalNotes {
  return 'windows' in value;
}

export interface SkippedTemporalDecisionResult extends Record<string, unknown> {
  skipped: true;
  skipReason: string;
  urgency: 'low' | 'medium' | 'high';
}

// ============================================================================
// TEMPORAL PROMPT FORMATTER (from temporal-prompt-formatter.mjs)
// ============================================================================

/**
 * Format temporal notes for prompt inclusion
 *
 * Handles both single-scale (AggregatedTemporalNotes) and multi-scale (MultiScaleAggregation)
 * temporal notes, formatting them optimally for VLM understanding.
 *
 * @param {AggregatedTemporalNotes | MultiScaleAggregation | Array} temporalNotes
 * @param {Object} options - Formatting options
 * @param {boolean} [options.includeMultiScale=true] - Include multi-scale insights if available
 * @param {boolean} [options.naturalLanguage=true] - Use natural language formatting
 * @returns {string} Formatted temporal context for prompt
 */
export function formatTemporalForPrompt(
  temporalNotes: AggregatedTemporalNotes | MultiScaleAggregation | readonly unknown[] | null | undefined,
  options: TemporalPromptFormattingOptions = {},
): string {
  const {
    includeMultiScale = true,
    naturalLanguage = true
  } = options;

  if (!temporalNotes) {
    return '';
  }

  if (Array.isArray(temporalNotes)) {
    return '';
  }

  if (typeof temporalNotes === 'object' && isMultiScaleAggregation(temporalNotes)) {
    if (!includeMultiScale) {
      return '';
    }
    return formatMultiScaleForPrompt(temporalNotes, { naturalLanguage });
  }

  if (typeof temporalNotes === 'object' && isAggregatedTemporalNotes(temporalNotes)) {
    return formatSingleScaleForPrompt(temporalNotes, { naturalLanguage });
  }

  return '';
}

/**
 * Format single-scale aggregated notes for prompt
 */
export function formatSingleScaleForPrompt(
  aggregated: AggregatedTemporalNotes,
  options: TemporalPromptFormattingOptions = {},
): string {
  const { naturalLanguage = true } = options;

  if (naturalLanguage) {
    const parts = [];

    parts.push('TEMPORAL CONTEXT:');
    parts.push(aggregated.summary || 'Previous observations over time.');

    if (aggregated.windows && aggregated.windows.length > 0) {
      parts.push('\nTime Windows:');
      aggregated.windows.slice(-5).forEach((window, i) => {
        const timeRange = window.timeRange || `window ${window.window || i + 1}`;
        const score = window.avgScore !== null && window.avgScore !== undefined
          ? `${window.avgScore.toFixed(1)}/10`
          : 'N/A';
        parts.push(`  ${timeRange}: Score ${score}, ${window.noteCount || 0} observations`);
        if (window.observations) {
          parts.push(`    Notes: ${window.observations.substring(0, 150)}${window.observations.length > 150 ? '...' : ''}`);
        }
      });
    }

    if (aggregated.coherence !== null && aggregated.coherence !== undefined) {
      const coherenceDesc = aggregated.coherence > 0.7 ? 'high' : aggregated.coherence > 0.4 ? 'moderate' : 'low';
      parts.push(`\nTemporal Coherence: ${(aggregated.coherence * 100).toFixed(0)}% (${coherenceDesc})`);
    }

    if (aggregated.conflicts && aggregated.conflicts.length > 0) {
      parts.push(`\nCoherence Issues: ${aggregated.conflicts.length} potential conflicts detected`);
    }

    parts.push('\nWhen evaluating, consider how the current state relates to these temporal patterns and trends.');

    return parts.join('\n');
  } else {
    return formatNotesForPrompt(aggregated);
  }
}

/**
 * Format multi-scale aggregation for prompt
 */
export function formatMultiScaleForPrompt(
  multiScale: MultiScaleAggregation,
  options: TemporalPromptFormattingOptions = {},
): string {
  const { naturalLanguage = true } = options;

  if (!multiScale.scales || Object.keys(multiScale.scales).length === 0) {
    return '';
  }

  const parts = [];

  if (naturalLanguage) {
    parts.push('TEMPORAL CONTEXT (Multi-Scale Analysis):');
    parts.push('The experience has been analyzed across multiple time scales:');
    parts.push('');

    const scaleOrder = ['immediate', 'short', 'medium', 'long'];
    const orderedScales: Array<[string, NonNullable<MultiScaleAggregation['scales'][string]>]> = scaleOrder
      .filter(scale => multiScale.scales[scale])
      .map(scale => [scale, multiScale.scales[scale]!]);

    orderedScales.forEach(([scaleName, scaleData]) => {
    const scaleDescriptions: Record<string, string> = {
        immediate: 'Instant perception (0.1s) - visual feedback, animations',
        short: 'Quick interaction (1s) - button responses, immediate feedback',
        medium: 'Short task (5s) - form filling, quick actions',
        long: 'Longer session (30s) - overall experience, engagement'
      };

      parts.push(`${scaleName.toUpperCase()} Scale (${scaleDescriptions[scaleName] || scaleName}):`);

      if (scaleData.windows && scaleData.windows.length > 0) {
        const recentWindows = scaleData.windows.slice(-3);
        recentWindows.forEach((window, i) => {
          const timeRange = window.timeRange || `window ${window.window || i + 1}`;
          const score = window.avgScore !== null && window.avgScore !== undefined
            ? `${window.avgScore.toFixed(1)}/10`
            : 'N/A';
          parts.push(`  ${timeRange}: Score ${score}`);
        });

        if (scaleData.coherence !== null && scaleData.coherence !== undefined) {
          const coherenceDesc = scaleData.coherence > 0.7 ? 'high' : scaleData.coherence > 0.4 ? 'moderate' : 'low';
          parts.push(`  Coherence: ${(scaleData.coherence * 100).toFixed(0)}% (${coherenceDesc})`);
        }
      } else {
        parts.push(`  No windows in this scale`);
      }
      parts.push('');
    });

    if (multiScale.summary) {
      parts.push(`Overall: ${multiScale.summary}`);
    }

    parts.push('\nWhen evaluating, consider patterns at different time scales:');
    parts.push('- Immediate: Visual feedback and animation quality');
    parts.push('- Short: Interaction responsiveness and quick feedback');
    parts.push('- Medium: Task completion flow and user journey');
    parts.push('- Long: Overall experience quality and engagement');

    return parts.join('\n');
  } else {
    parts.push('TEMPORAL CONTEXT (Multi-Scale):');
    parts.push(multiScale.summary || 'Multi-scale temporal analysis');
    parts.push('');

    Object.entries(multiScale.scales).forEach(([scaleName, scaleData]) => {
      parts.push(`${scaleName.toUpperCase()} Scale:`);
      parts.push(`  Windows: ${scaleData.windows?.length || 0}`);
      parts.push(`  Coherence: ${scaleData.coherence ? (scaleData.coherence * 100).toFixed(0) : 'N/A'}%`);
      if (scaleData.windows && scaleData.windows.length > 0) {
        scaleData.windows.slice(-3).forEach(window => {
          const timeRange = window.timeRange || `window ${window.window}`;
          const score = window.avgScore !== null && window.avgScore !== undefined
            ? `${window.avgScore.toFixed(1)}/10`
            : 'N/A';
          parts.push(`  ${timeRange}: ${score}`);
        });
      }
      parts.push('');
    });

    return parts.join('\n');
  }
}

/**
 * Format temporal notes with optimal strategy
 *
 * @param {any} temporalNotes - Temporal notes (any format)
 * @param {Object} options - Formatting options
 * @returns {string} Formatted temporal context
 */
export function formatTemporalContext(
  temporalNotes: AggregatedTemporalNotes | MultiScaleAggregation | readonly unknown[] | null | undefined,
  options: TemporalPromptFormattingOptions = {},
): string {
  const { includeMultiScale = true } = options;

  if (!temporalNotes) {
    return '';
  }

  if (Array.isArray(temporalNotes)) {
    return '';
  }

  if (typeof temporalNotes === 'object' && isMultiScaleAggregation(temporalNotes)) {
    if (!includeMultiScale) {
      return '';
    }
    return formatMultiScaleForPrompt(temporalNotes, options);
  }

  if (typeof temporalNotes === 'object' && isAggregatedTemporalNotes(temporalNotes)) {
    return formatSingleScaleForPrompt(temporalNotes, options);
  }

  return '';
}

// ============================================================================
// TEMPORAL NOTE PRUNER (from temporal-note-pruner.mjs)
// ============================================================================

/**
 * Prune temporal notes based on relevance and weight
 *
 * @param {TemporalNote[]} notes - Temporal notes
 * @param {Object} options - Pruning options
 * @param {number} [options.maxNotes=10] - Maximum notes to keep
 * @param {number} [options.minWeight=0.1] - Minimum weight threshold
 * @param {number} [options.currentTime] - Current time (default: Date.now())
 * @param {number} [options.windowSize=10000] - Window size for weight calculation
 * @returns {TemporalNote[]} Pruned notes
 */
export function pruneTemporalNotes(
  notes: TemporalNote[],
  options: TemporalPruningOptions = {},
): TemporalNote[] {
  const {
    maxNotes = 10,
    minWeight = 0.1,
    currentTime = Date.now(),
    windowSize = 10000
  } = options;

  if (notes.length === 0) return [];

  const startTime = notes[0]!.timestamp ?? currentTime;

  const weightedNotes = notes.map(note => {
    const elapsed = note.elapsed ?? ((note.timestamp ?? startTime) - startTime);
    const weight = calculateAttentionWeight(note, {
      elapsed,
      windowSize,
      scaleName: 'medium'
    });

    return {
      note,
      weight,
      relevance: calculateRelevance(note, currentTime, startTime)
    };
  });

  const aboveThreshold = weightedNotes.filter(w => w.weight >= minWeight);
  const sorted = aboveThreshold.sort((a, b) => b.weight - a.weight);
  const pruned = sorted.slice(0, maxNotes).map(w => w.note);

  return pruned;
}

/**
 * Calculate relevance score for a note
 */
function calculateRelevance(note: TemporalNote, currentTime: number, startTime: number): number {
  let relevance = 1.0;

  const age = currentTime - (note.timestamp ?? startTime);
  const recency = Math.pow(0.9, age / 10000);
  relevance *= recency;

  const score = note.score ?? note.gameState?.score ?? 5;
  if (score >= 8 || score <= 2) {
    relevance *= 1.5;
  }

  if (note.issues && note.issues.length > 0) {
    relevance *= 1.2;
  }

  if (note.step?.includes('interaction') || note.step?.includes('click')) {
    relevance *= 1.3;
  }

  if (note.observation?.includes('change') || note.observation?.includes('new')) {
    relevance *= 1.2;
  }

  return relevance;
}

/**
 * Propagate notes forward with decay
 *
 * @param {TemporalNote[]} notes - Temporal notes
 * @param {Object} options - Propagation options
 * @param {number} [options.currentTime] - Current time
 * @param {number} [options.relevanceThreshold=0.2] - Minimum relevance to keep
 * @returns {TemporalNote[]} Propagated notes with updated weights
 */
export function propagateNotes(
  notes: TemporalNote[],
  options: TemporalPropagationOptions = {},
): PropagatedTemporalNote[] {
  const {
    currentTime = Date.now(),
    relevanceThreshold = 0.2
  } = options;

  if (notes.length === 0) return [];

  const startTime = notes[0]!.timestamp ?? currentTime;

  return notes
    .map(note => {
      const relevance = calculateRelevance(note, currentTime, startTime);
      const weight = Math.pow(0.9, (currentTime - (note.timestamp ?? startTime)) / 10000);

      return {
        ...note,
        weight,
        relevance,
      propagated: true as const
      };
    })
    .filter(note => note.relevance >= relevanceThreshold)
    .sort((a, b) => b.relevance - a.relevance);
}

/**
 * Select top-weighted notes for prompt inclusion
 *
 * @param {TemporalNote[]} notes - Temporal notes
 * @param {Object} options - Selection options
 * @param {number} [options.topN=5] - Number of top notes to select
 * @returns {TemporalNote[]} Top-weighted notes
 */
export function selectTopWeightedNotes(
  notes: TemporalNote[],
  options: TopWeightedNotesOptions = {},
): TemporalNote[] {
  const { topN = 5 } = options;

  if (notes.length === 0) return [];

  const currentTime = Date.now();
  const startTime = notes[0]!.timestamp ?? currentTime;

  const weighted = notes.map(note => {
    const elapsed = note.elapsed ?? ((note.timestamp ?? startTime) - startTime);
    const weight = calculateAttentionWeight(note, {
      elapsed,
      windowSize: 10000,
      scaleName: 'medium'
    });

    return { note, weight };
  });

  return weighted
    .sort((a, b) => b.weight - a.weight)
    .slice(0, topN)
    .map(w => w.note);
}

/**
 * Select representative screenshots from sequence for context window management
 *
 * @param {Array<{path: string, timestamp: number, elapsed?: number}>} screenshots
 * @param {Array<Object>} evaluations - Corresponding evaluation results
 * @param {Object} options - Selection options
 * @param {number} [options.maxScreenshots=10] - Maximum screenshots to select
 * @param {string} [options.strategy='diversity'] - 'diversity', 'keyframes', 'uniform'
 * @returns {Array} Selected screenshots
 */
export function selectRepresentativeScreenshots(
  screenshots: TemporalScreenshot[],
  evaluations: ScreenshotEvaluation[] = [],
  options: ScreenshotSelectionOptions = {},
): TemporalScreenshot[] {
  const {
    maxScreenshots = 10,
    strategy = 'diversity'
  } = options;

  validateScreenshotSelectionInputs(evaluations, maxScreenshots);

  if (screenshots.length <= maxScreenshots) {
    return screenshots;
  }

  switch (strategy) {
    case 'keyframes':
      return selectKeyframes(screenshots, evaluations, maxScreenshots);
    case 'uniform':
      return selectUniform(screenshots, maxScreenshots);
    case 'diversity':
    default:
      return selectByDiversity(screenshots, evaluations, maxScreenshots);
  }
}

function validateScreenshotSelectionInputs(evaluations: ScreenshotEvaluation[], maxScreenshots: number): void {
  if (!Number.isInteger(maxScreenshots) || maxScreenshots < 1) {
    throw new RangeError(`maxScreenshots must be a positive integer, got: ${maxScreenshots}`);
  }

  evaluations.forEach((evaluation, index) => {
    const score = evaluation?.score;
    if (typeof score === 'number' && !Number.isFinite(score)) {
      throw new RangeError(`evaluations[${index}].score must be a finite number, got: ${score}`);
    }
  });
}

function selectKeyframes(
  screenshots: TemporalScreenshot[],
  evaluations: ScreenshotEvaluation[],
  maxScreenshots: number,
): TemporalScreenshot[] {
  const keyframes = [screenshots[0]!];

  for (let i = 1; i < evaluations.length; i++) {
    const prevScore = evaluations[i-1]?.score ?? 0;
    const currScore = evaluations[i]?.score ?? 0;
    const scoreChange = Math.abs(currScore - prevScore);

    if (scoreChange > 2.0) {
      const screenshot = screenshots[i];
      if (screenshot) keyframes.push(screenshot);
    }
  }

  keyframes.push(screenshots[screenshots.length - 1]!);

  if (keyframes.length > maxScreenshots) {
    return sampleUniform(keyframes, maxScreenshots);
  }

  return keyframes;
}

function selectByDiversity(
  screenshots: TemporalScreenshot[],
  evaluations: ScreenshotEvaluation[],
  maxScreenshots: number,
): TemporalScreenshot[] {
  const selected = [screenshots[0]!];
  const last = screenshots[screenshots.length - 1]!;

  const evaluatedInterior = [];
  const lastInteriorIndex = Math.min(evaluations.length, screenshots.length - 1);
  for (let index = 1; index < lastInteriorIndex; index++) {
    const score = evaluations[index]?.score;
    if (typeof score === 'number') {
      evaluatedInterior.push({ index, score });
    }
  }

  if (evaluatedInterior.length === 0) {
    return selectUniform(screenshots, maxScreenshots);
  }

  const scores = evaluatedInterior.map(({ score }) => score);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const indexed = evaluatedInterior.map(({ index, score }) => ({
    index,
    variance: Math.abs(score - mean)
  }));
  indexed.sort((a, b) => b.variance - a.variance);

  const diverseIndices = indexed.slice(0, maxScreenshots - 2).map(item => item.index);
  selected.push(...diverseIndices.map(index => screenshots[index]).filter(
    (screenshot): screenshot is TemporalScreenshot => screenshot !== undefined,
  ));
  selected.push(last);

  return selected.slice(0, maxScreenshots);
}

function selectUniform(screenshots: TemporalScreenshot[], maxScreenshots: number): TemporalScreenshot[] {
  const step = Math.floor(screenshots.length / maxScreenshots);
  const selected = [];

  for (let i = 0; i < screenshots.length; i += step) {
    const screenshot = screenshots[i];
    if (screenshot) selected.push(screenshot);
    if (selected.length >= maxScreenshots) break;
  }

  if (selected[selected.length - 1] !== screenshots[screenshots.length - 1]) {
    selected[selected.length - 1] = screenshots[screenshots.length - 1]!;
  }

  return selected;
}

function sampleUniform<T>(array: T[], count: number): T[] {
  const step = Math.floor(array.length / count);
  const sampled = [];
  for (let i = 0; i < array.length; i += step) {
    const item = array[i];
    if (item !== undefined) sampled.push(item);
    if (sampled.length >= count) break;
  }
  return sampled;
}

// ============================================================================
// TEMPORAL DECISION LOGIC (from temporal-logic.mjs)
// ============================================================================

/**
 * Evaluate temporal decision and handle logging/metrics
 *
 * @param {Object} context - Validation context
 * @param {Object} config - Judge configuration
 * @returns {Promise<Object|null>} Result if decision is to skip, null if we should proceed
 */
export async function evaluateTemporalDecision(
  context: TemporalDecisionContext,
  config: TemporalDecisionConfig,
): Promise<SkippedTemporalDecisionResult | null> {
  if (!context.useTemporalDecision || !context.temporalNotes || context.temporalNotes.length === 0) {
    return null;
  }

  try {
    const { TemporalDecisionManager } = await import('#temporal-orchestration');
    const { aggregateTemporalNotes } = await import('#temporal-core');

    const TemporalDecisionManagerRuntime = TemporalDecisionManager as unknown as TemporalDecisionManagerConstructor;
    const decisionManager = new TemporalDecisionManagerRuntime(context.temporalDecisionOptions || {});
    const currentState = { score: null, issues: [], ...context.currentState };
    const previousState = context.previousState || null;

    const decision = await decisionManager.shouldPrompt(
      currentState,
      previousState,
      context.temporalNotes,
      context
    );

    try {
      const aggregated = await aggregateTemporalNotes(context.temporalNotes).catch(() => ({ coherence: null }));
      safeLogTemporalDecision({
        shouldPrompt: decision.shouldPrompt,
        reason: decision.reason,
        urgency: decision.urgency,
        coherence: aggregated.coherence,
        stateChange: decisionManager.calculateStateChange(currentState, previousState),
        noteCount: context.temporalNotes.length,
        isDecisionPoint: decisionManager.isDecisionPoint(currentState, context),
        hasUserAction: decisionManager.hasRecentUserAction(context.temporalNotes, context)
      });
    } catch {
      // Ignore logging errors
    }

    if (!decision.shouldPrompt && decision.urgency !== 'high') {
      if (context.previousResult) {
        return {
          ...context.previousResult,
          skipped: true,
          skipReason: decision.reason,
          urgency: decision.urgency
        };
      }
    }

    return null;

  } catch (error) {
    if (config.debug?.verbose) {
      log(`[VLLM] TemporalDecisionManager error: ${error instanceof Error ? error.message : String(error)}`);
    }
    return null;
  }
}
