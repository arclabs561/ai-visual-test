/**
 * Temporal Orchestration
 *
 * Decision manager, preprocessing, batch optimization, validation, and error classes.
 *
 * Consolidated from: temporal-decision-manager.mjs, temporal-preprocessor.mjs,
 *                     temporal-batch-optimizer.mjs, temporal-validation.mjs, temporal-errors.mjs
 *
 * Depends on: temporal-core.mjs, temporal-multi-scale.mjs
 *
 * Note: temporal-multi-scale.mjs imports validation functions and error classes from here,
 * so those must be defined without importing from temporal-multi-scale.mjs.
 */

import { aggregateTemporalNotes, type AggregatedTemporalNotes, type TemporalAggregationOptions, type TemporalNote } from '#temporal-core';
import { log, warn } from './logger.js';
import { BatchOptimizer } from './batch-optimizer.mjs';

type TemporalRecord = TemporalNote & Record<string, unknown>;
type TemporalOptions = TemporalAggregationOptions & {
  minNotesForPrompt?: number; coherenceThreshold?: number; urgencyThreshold?: number;
  maxWaitTime?: number; stateChangeThreshold?: number; warmStartSteps?: number;
  adaptiveSampling?: boolean; preprocessInterval?: number; cacheMaxAge?: number;
  maxNotes?: number; minWeight?: number; sequentialContext?: SequentialContext | null;
  adaptiveBatching?: boolean; timestamp?: number; critical?: boolean; testType?: string;
  maxConcurrency?: number; batchSize?: number; cacheEnabled?: boolean; maxQueueSize?: number; requestTimeout?: number;
};
type TemporalStateInput = Record<string, unknown> & { score?: number; issues?: unknown[]; gameState?: Record<string, unknown> };
type TemporalDecision = { shouldPrompt: boolean; reason: string; urgency: 'low' | 'medium' | 'high' };
type TemporalContextInput = Record<string, unknown> & { recentAction?: unknown; stage?: string; testType?: string; critical?: unknown; goal?: unknown; goalCompleted?: unknown; coherence?: number; timeSinceLastPrompt?: number };
type Pattern = { type: string; metric?: string; magnitude?: number; count?: number };
type PreprocessCache = { aggregated: AggregatedTemporalNotes | null; multiScale: unknown; coherence: number | null; prunedNotes: TemporalRecord[] | null; topWeighted?: TemporalRecord[]; patterns: { trends: Pattern[]; conflicts: Pattern[] } | null; lastPreprocessTime: number; noteCount: number; notesFingerprint: string | null; optionsFingerprint: string | null };
type SequentialContext = { getContext(): unknown; addDecision(decision: { score: unknown; issues: unknown[]; assessment: unknown; reasoning: unknown }): void; history: unknown[]; identifyPatterns(): unknown };
type ValidationResult = { score: unknown; issues?: unknown[]; assessment?: unknown; reasoning?: unknown; [key: string]: unknown };
type ValidateFn = ((imagePath: string, prompt: string, context: Record<string, unknown>) => Promise<ValidationResult>) | null;
type QueueRequest = { imagePath: string; prompt: string; context: Record<string, unknown>; validateFn: ValidateFn; resolve: (value: ValidationResult) => void; reject: (error: unknown) => void; temporalRequestId?: number };
type Dependency = { dependencies: string[]; timestamp: number; priority: number; requestId: number };
type BatchOptimizerRuntime = {
  queue: QueueRequest[];
  processing: boolean;
  cache: Map<string, ValidationResult> | null;
  batchSize: number;
  maxConcurrency: number;
  activeRequests: number;
  _queueRequest(imagePath: string, prompt: string, context: Record<string, unknown>, validateFn: ValidateFn): Promise<ValidationResult>;
  _processRequest(imagePath: string, prompt: string, context: Record<string, unknown>, validateFn: ValidateFn): Promise<ValidationResult>;
  _getCacheKey(imagePath: string, prompt: string, context: Record<string, unknown>): string;
  getCacheStats(): Record<string, unknown>;
};
type BatchOptimizerConstructor = new (options: TemporalOptions) => BatchOptimizerRuntime;
// Keep the JS parent at runtime while emitting a narrow, self-contained
// declaration contract for this typed module.
const BatchOptimizerBase = BatchOptimizer as unknown as BatchOptimizerConstructor;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function serializeTemporalCacheValue(value: unknown, seen = new WeakSet<object>()): string {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) return `number:${value}`;
    if (typeof value === 'undefined') return 'undefined';
    if (typeof value === 'bigint') return `bigint:${value}`;
    return JSON.stringify(value);
  }

  if (seen.has(value)) {
    throw new TypeError('Temporal notes must not contain circular data when cached');
  }
  seen.add(value);

  if (Array.isArray(value)) {
    const serialized = `[${value.map(item => serializeTemporalCacheValue(item, seen)).join(',')}]`;
    seen.delete(value);
    return serialized;
  }

  const record = value as Record<string, unknown>;
  const serialized = `{${Object.keys(record).sort().map(key =>
    `${JSON.stringify(key)}:${serializeTemporalCacheValue(record[key], seen)}`
  ).join(',')}}`;
  seen.delete(value);
  return serialized;
}

// ============================================================================
// TEMPORAL ERROR TYPES (from temporal-errors.mjs)
// ============================================================================

/**
 * Base error class for temporal components
 */
export class TemporalError extends Error {
  readonly code: string;
  readonly context: Record<string, unknown>;

  constructor(message: string, code: string, context: Record<string, unknown> = {}) {
    super(message);
    this.name = 'TemporalError';
    this.code = code;
    this.context = context;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error for human perception time calculations
 */
export class PerceptionTimeError extends TemporalError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, 'PERCEPTION_TIME_ERROR', context);
    this.name = 'PerceptionTimeError';
  }
}

/**
 * Error for sequential decision context
 */
export class SequentialContextError extends TemporalError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, 'SEQUENTIAL_CONTEXT_ERROR', context);
    this.name = 'SequentialContextError';
  }
}

/**
 * Error for multi-scale aggregation
 */
export class MultiScaleError extends TemporalError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, 'MULTI_SCALE_ERROR', context);
    this.name = 'MultiScaleError';
  }
}

/**
 * Error for temporal batch optimization
 */
export class TemporalBatchError extends TemporalError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, 'TEMPORAL_BATCH_ERROR', context);
    this.name = 'TemporalBatchError';
  }
}

// ============================================================================
// TEMPORAL VALIDATION (from temporal-validation.mjs)
// ============================================================================

/**
 * Validate temporal notes
 */
export function validateNotes(notes: unknown): TemporalRecord[] {
  if (!Array.isArray(notes)) {
    throw new MultiScaleError('Notes must be an array', { received: typeof notes });
  }

  const validNotes = [];
  const invalidNotes = [];

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];

    if (!note || typeof note !== 'object') {
      invalidNotes.push({ index: i, reason: 'Not an object' });
      continue;
    }

    if (!note.timestamp && note.elapsed === undefined) {
      invalidNotes.push({ index: i, reason: 'Missing timestamp or elapsed' });
      continue;
    }

    if (note.timestamp && typeof note.timestamp !== 'number') {
      invalidNotes.push({ index: i, reason: 'Invalid timestamp type' });
      continue;
    }

    if (note.elapsed !== undefined && typeof note.elapsed !== 'number') {
      invalidNotes.push({ index: i, reason: 'Invalid elapsed type' });
      continue;
    }

    validNotes.push(note as TemporalRecord);
  }

  if (invalidNotes.length > 0) {
    warn(`[Temporal] ${invalidNotes.length} invalid notes filtered out:`, invalidNotes);
  }

  return validNotes;
}

/**
 * Validate and sort notes
 */
export function validateAndSortNotes(notes: unknown): TemporalRecord[] {
  const validNotes = validateNotes(notes);
  return validNotes.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
}

/**
 * Validate time scales
 */
export function validateTimeScales(timeScales: unknown): true {
  if (typeof timeScales !== 'object' || timeScales === null) {
    throw new MultiScaleError('Time scales must be an object', { received: typeof timeScales });
  }

  for (const [name, value] of Object.entries(timeScales)) {
    if (typeof value !== 'number' || value <= 0) {
      throw new MultiScaleError(`Invalid time scale ${name}: ${value}`, {
        scaleName: name,
        value,
        type: typeof value
      });
    }
  }

  return true;
}

/**
 * Validate action for human perception time
 */
export function validateAction(action: unknown): true {
  const validActions = ['page-load', 'reading', 'interaction', 'evaluation', 'scanning', 'visual-appeal'];

  if (typeof action !== 'string') {
    throw new PerceptionTimeError('Action must be a string', { received: typeof action });
  }

  if (!validActions.includes(action)) {
    throw new PerceptionTimeError(`Invalid action: ${action}`, {
      action,
      validActions
    });
  }

  return true;
}

/**
 * Validate context for human perception time
 */
export function validatePerceptionContext(context: unknown): true {
  if (context === null || typeof context !== 'object') {
    throw new PerceptionTimeError('Context must be an object', { received: typeof context });
  }

  const perceptionContext = context as Record<string, unknown>;
  if (perceptionContext.attentionLevel && !['focused', 'normal', 'distracted'].includes(String(perceptionContext.attentionLevel))) {
    throw new PerceptionTimeError(`Invalid attentionLevel: ${perceptionContext.attentionLevel}`, {
      attentionLevel: perceptionContext.attentionLevel,
      validLevels: ['focused', 'normal', 'distracted']
    });
  }

  if (perceptionContext.actionComplexity && !['simple', 'normal', 'complex'].includes(String(perceptionContext.actionComplexity))) {
    throw new PerceptionTimeError(`Invalid actionComplexity: ${perceptionContext.actionComplexity}`, {
      actionComplexity: perceptionContext.actionComplexity,
      validComplexities: ['simple', 'normal', 'complex']
    });
  }

  if (perceptionContext.contentLength !== undefined && (typeof perceptionContext.contentLength !== 'number' || perceptionContext.contentLength < 0)) {
    throw new PerceptionTimeError('contentLength must be a non-negative number', {
      contentLength: perceptionContext.contentLength
    });
  }

  return true;
}

/**
 * Validate sequential decision context options
 */
export function validateSequentialContextOptions(options: unknown): true {
  if (options === null || options === undefined) {
    return true;
  }

  if (typeof options !== 'object') {
    throw new SequentialContextError('Options must be an object', { received: typeof options });
  }

  const sequentialOptions = options as Record<string, unknown>;
  if (sequentialOptions.maxHistory !== undefined && sequentialOptions.maxHistory !== null) {
    if (typeof sequentialOptions.maxHistory !== 'number' || sequentialOptions.maxHistory < 1) {
      throw new SequentialContextError('maxHistory must be a positive number', {
        maxHistory: sequentialOptions.maxHistory
      });
    }
  }

  return true;
}

// ============================================================================
// TEMPORAL DECISION MANAGER (from temporal-decision-manager.mjs)
// ============================================================================

/**
 * Temporal Decision Manager
 *
 * Decides when to call LLM vs. reuse previous result.
 */
export class TemporalDecisionManager {
  minNotesForPrompt: number;
  coherenceThreshold: number;
  urgencyThreshold: number;
  maxWaitTime: number;
  stateChangeThreshold: number;
  warmStartSteps: number;
  adaptiveSampling: boolean;
  stepCount: number;
  lastPromptTime: number | null;
  _lastPromptProbability?: number;
  preprocessor?: TemporalPreprocessingManager;

  constructor(options: TemporalOptions = {}) {
    const minNotes = options.minNotesForPrompt ?? 3;
    const coherenceThresh = options.coherenceThreshold ?? 0.5;
    const urgencyThresh = options.urgencyThreshold ?? 0.3;
    const maxWait = options.maxWaitTime ?? 10000;
    const stateChangeThresh = options.stateChangeThreshold ?? 0.2;

    if (minNotes < 1 || !Number.isInteger(minNotes)) {
      throw new RangeError(`minNotesForPrompt must be a positive integer, got: ${minNotes}`);
    }
    if (coherenceThresh < 0 || coherenceThresh > 1) {
      throw new RangeError(`coherenceThreshold must be in [0, 1], got: ${coherenceThresh}`);
    }
    if (urgencyThresh < 0 || urgencyThresh > 1) {
      throw new RangeError(`urgencyThreshold must be in [0, 1], got: ${urgencyThresh}`);
    }
    if (maxWait <= 0 || !isFinite(maxWait)) {
      throw new RangeError(`maxWaitTime must be a positive finite number, got: ${maxWait}`);
    }
    if (stateChangeThresh < 0 || stateChangeThresh > 1) {
      throw new RangeError(`stateChangeThreshold must be in [0, 1], got: ${stateChangeThresh}`);
    }

    this.minNotesForPrompt = minNotes;
    this.coherenceThreshold = coherenceThresh;
    this.urgencyThreshold = urgencyThresh;
    this.maxWaitTime = maxWait;
    this.stateChangeThreshold = stateChangeThresh;

    this.warmStartSteps = options.warmStartSteps || 10;
    this.adaptiveSampling = options.adaptiveSampling !== false;
    this.stepCount = 0;
    this.lastPromptTime = null;
  }

  async shouldPrompt(currentState: TemporalStateInput, previousState: TemporalStateInput | null | undefined, temporalNotes: TemporalRecord[], context: TemporalContextInput = {}): Promise<TemporalDecision> {
    if (!Array.isArray(temporalNotes)) {
      throw new TypeError('temporalNotes must be an array');
    }
    if (currentState === null || currentState === undefined) {
      throw new TypeError('currentState is required');
    }

    this.stepCount++;

    if (this.adaptiveSampling && this.stepCount <= this.warmStartSteps) {
      return {
        shouldPrompt: true,
        reason: `Warm-start step ${this.stepCount}/${this.warmStartSteps} (research: LLMs good early)`,
        urgency: 'medium'
      };
    }

    if (this.adaptiveSampling && this.lastPromptTime) {
      const decayRate = 0.1;
      const pMax = 1.0;
      const pMin = 0.1;
      const stepsSinceWarmStart = Math.max(0, this.stepCount - this.warmStartSteps);
      const promptProbability = Math.min(pMax, Math.max(pMin, Math.exp(-decayRate * stepsSinceWarmStart)));
      this._lastPromptProbability = promptProbability;
    }

    if (temporalNotes.length < this.minNotesForPrompt) {
      return {
        shouldPrompt: false,
        reason: `Insufficient notes (${temporalNotes.length} < ${this.minNotesForPrompt})`,
        urgency: 'low'
      };
    }

    let aggregated;
    if (this.preprocessor) {
      aggregated = await this.preprocessor.getFastAggregation(temporalNotes);
    } else {
      aggregated = await aggregateTemporalNotes(temporalNotes);
    }
    const coherence = aggregated.coherence || 0;

    const stateChange = this.calculateStateChange(currentState, previousState);
    const hasUserAction = this.hasRecentUserAction(temporalNotes, context);
    const isDecisionPoint = this.isDecisionPoint(currentState, context);
    const coherenceDrop = await this.detectCoherenceDrop(temporalNotes, aggregated);

    if (isDecisionPoint) {
      this.lastPromptTime = Date.now();
      const decision: TemporalDecision = {
        shouldPrompt: true,
        reason: 'Decision point reached',
        urgency: 'high'
      };

      import('./utils/performance-logger.mjs')
        .then(({ logTemporalDecision }) => {
          logTemporalDecision({
            shouldPrompt: decision.shouldPrompt,
            reason: decision.reason,
            urgency: decision.urgency,
            coherence,
            stateChange,
            noteCount: temporalNotes.length,
            isDecisionPoint: true,
            hasUserAction
          });
        })
        .catch(async (importError) => {
          if (process.env.DEBUG_TEMPORAL) {
            try {
              const { warn: w } = await import('./logger.js');
              w(`[TemporalDecision] Performance logger unavailable: ${importError.message}`);
            } catch {
              console.warn(`[TemporalDecision] Performance logger unavailable: ${importError.message}`);
            }
          }
        });

      return decision;
    }

    if (coherenceDrop) {
      this.lastPromptTime = Date.now();
      const decision: TemporalDecision = {
        shouldPrompt: true,
        reason: 'Coherence drop detected (quality issue)',
        urgency: 'high'
      };

      import('./utils/performance-logger.mjs')
        .then(({ logTemporalDecision }) => {
          logTemporalDecision({
            shouldPrompt: decision.shouldPrompt,
            reason: decision.reason,
            urgency: decision.urgency,
            coherence,
            stateChange,
            noteCount: temporalNotes.length,
            isDecisionPoint: false,
            hasUserAction
          });
        })
        .catch(async (importError) => {
          if (process.env.DEBUG_TEMPORAL) {
            try {
              const { warn: w } = await import('./logger.js');
              w(`[TemporalDecision] Performance logger unavailable: ${importError.message}`);
            } catch {
              console.warn(`[TemporalDecision] Performance logger unavailable: ${importError.message}`);
            }
          }
        });

      return decision;
    }

    if (hasUserAction && stateChange > this.stateChangeThreshold) {
      this.lastPromptTime = Date.now();
      return {
        shouldPrompt: true,
        reason: 'User action with significant state change',
        urgency: 'medium'
      };
    }

    if (coherence >= this.coherenceThreshold && stateChange > this.stateChangeThreshold) {
      this.lastPromptTime = Date.now();
      return {
        shouldPrompt: true,
        reason: 'Stable context with significant state change',
        urgency: 'medium'
      };
    }

    return {
      shouldPrompt: false,
      reason: `Context not sufficient (coherence: ${coherence.toFixed(2)}, stateChange: ${stateChange.toFixed(2)})`,
      urgency: 'low'
    };
  }

  reset() {
    this.stepCount = 0;
    this.lastPromptTime = null;
  }

  calculateStateChange(currentState: TemporalStateInput, previousState: TemporalStateInput | null | undefined): number {
    if (!currentState || typeof currentState !== 'object') {
      throw new TypeError('currentState must be an object');
    }

    if (!previousState) return 1.0;

    let change = 0.0;
    let comparisons = 0;

    if (currentState.score !== undefined && previousState.score !== undefined) {
      const score1 = typeof currentState.score === 'number' ? currentState.score : 0;
      const score2 = typeof previousState.score === 'number' ? previousState.score : 0;
      const scoreChange = Math.abs(score1 - score2) / 10;
      if (isFinite(scoreChange)) {
        change += scoreChange;
        comparisons++;
      }
    }

    if (currentState.issues && previousState.issues) {
      if (Array.isArray(currentState.issues) && Array.isArray(previousState.issues)) {
        const currentIssues = new Set(currentState.issues.map(i => String(i).toLowerCase().trim()));
        const previousIssues = new Set(previousState.issues.map(i => String(i).toLowerCase().trim()));
        const added = [...currentIssues].filter(i => !previousIssues.has(i)).length;
        const removed = [...previousIssues].filter(i => !currentIssues.has(i)).length;
        const unionSize = currentIssues.size + previousIssues.size;
        const issueChange = unionSize > 0 ? (added + removed) / unionSize : 0;
        if (isFinite(issueChange)) {
          change += issueChange;
          comparisons++;
        }
      }
    }

    if (currentState.gameState && previousState.gameState) {
      const gameStateChange = this.calculateGameStateChange(currentState.gameState, previousState.gameState);
      if (isFinite(gameStateChange)) {
        change += gameStateChange;
        comparisons++;
      }
    }

    const avgChange = comparisons > 0 ? change / comparisons : 0.0;
    return Math.max(0, Math.min(1, avgChange));
  }

  calculateGameStateChange(current: Record<string, unknown>, previous: Record<string, unknown>): number {
    const currentKeys = Object.keys(current || {});
    const previousKeys = Object.keys(previous || {});

    const added = currentKeys.filter(k => !previousKeys.includes(k)).length;
    const removed = previousKeys.filter(k => !currentKeys.includes(k)).length;
    const changed = currentKeys.filter(k =>
      previousKeys.includes(k) &&
      JSON.stringify(current[k]) !== JSON.stringify(previous[k])
    ).length;

    const totalKeys = new Set([...currentKeys, ...previousKeys]).size;
    return totalKeys > 0 ? (added + removed + changed) / totalKeys : 0.0;
  }

  hasRecentUserAction(temporalNotes: TemporalRecord[], context: TemporalContextInput): boolean {
    if (context.recentAction) return true;

    const recentNotes = temporalNotes.slice(-3);
    return recentNotes.some(note => {
      const stepStr = String(note.step || '');
      const observationStr = String(note.observation || '');
      return stepStr.includes('interaction') ||
        stepStr.includes('click') ||
        stepStr.includes('action') ||
        observationStr.includes('user') ||
        observationStr.includes('clicked');
    });
  }

  isDecisionPoint(currentState: TemporalStateInput, context: TemporalContextInput): boolean {
    if (context.stage === 'decision' || context.stage === 'evaluation') return true;
    if (context.testType === 'critical' || context.critical) return true;
    if (context.goal && context.goalCompleted) return true;

    return false;
  }

  async detectCoherenceDrop(temporalNotes: TemporalRecord[], currentAggregated: AggregatedTemporalNotes): Promise<boolean> {
    if (temporalNotes.length < 4) return false;

    const previousNotes = temporalNotes.slice(0, -1);
    const previousAggregated = await aggregateTemporalNotes(previousNotes);
    const previousCoherence = previousAggregated.coherence || 1.0;
    const currentCoherence = currentAggregated.coherence || 1.0;

    const drop = previousCoherence - currentCoherence;
    return drop > this.urgencyThreshold;
  }

  calculatePromptUrgency(temporalContext: TemporalContextInput, decision: TemporalDecision): number {
    if (decision.urgency === 'high') return 1.0;
    if (decision.urgency === 'medium') return 0.6;

    const coherence = temporalContext.coherence || 0;
    const timeSinceLastPrompt = temporalContext.timeSinceLastPrompt || 0;

    if (coherence > 0.7 && timeSinceLastPrompt > 5000) {
      return 0.4;
    }

    return 0.2;
  }

  async selectOptimalTiming(requests: Array<{ currentState: TemporalStateInput; previousState?: TemporalStateInput | null; temporalNotes?: TemporalRecord[]; context?: TemporalContextInput }>, temporalContext: TemporalContextInput) {
    const decisions = await Promise.all(requests.map(async req => ({
      request: req,
      decision: await this.shouldPrompt(
        req.currentState,
        req.previousState,
        req.temporalNotes || [],
        req.context || {}
      )
    })));

    const urgent = decisions.filter(d => d.decision.urgency === 'high');
    const medium = decisions.filter(d => d.decision.urgency === 'medium');
    const low = decisions.filter(d => d.decision.urgency === 'low');

    const stable = (temporalContext.coherence ?? 0) > 0.7;
    const shouldBatch = stable && medium.length + low.length > 1;

    return {
      promptNow: urgent.map(d => d.request),
      batch: shouldBatch ? [...medium, ...low].map(d => d.request) : medium.map(d => d.request),
      wait: shouldBatch ? [] : low.map(d => d.request),
      decisions
    };
  }
}

/**
 * Create a temporal decision manager with default options
 */
export function createTemporalDecisionManager(options: TemporalOptions = {}): TemporalDecisionManager {
  return new TemporalDecisionManager(options);
}

// ============================================================================
// TEMPORAL PREPROCESSING MANAGER (from temporal-preprocessor.mjs)
// ============================================================================

// Lazy imports to avoid circular dependency (these depend on temporal-multi-scale
// which depends on this file for validation/errors)
type MultiScaleAggregate = (notes: TemporalRecord[], options: Record<string, unknown>) => unknown;
type NotePruner = (notes: TemporalRecord[], options: Record<string, unknown>) => TemporalRecord[];
let _aggregateMultiScale: MultiScaleAggregate | null = null;
let _pruneTemporalNotes: NotePruner | null = null;
let _selectTopWeightedNotes: NotePruner | null = null;

async function getMultiScaleImports() {
  if (!_aggregateMultiScale) {
    const mod = await import('#temporal-multi-scale');
    _aggregateMultiScale = mod.aggregateMultiScale as MultiScaleAggregate;
  }
  return _aggregateMultiScale;
}

async function getPrunerImports() {
  if (!_pruneTemporalNotes) {
    const mod = await import('#temporal-prompt-formatting');
    _pruneTemporalNotes = mod.pruneTemporalNotes as NotePruner;
    _selectTopWeightedNotes = mod.selectTopWeightedNotes as NotePruner;
  }
  return { pruneTemporalNotes: _pruneTemporalNotes, selectTopWeightedNotes: _selectTopWeightedNotes };
}

/**
 * Activity Detector
 */
class ActivityDetector {
  detectActivityLevel(notes: TemporalRecord[], recentWindow = 5000): 'low' | 'medium' | 'high' {
    if (notes.length === 0) return 'low';

    const now = Date.now();
    const recent = notes.filter(n => {
      const timestamp = n.timestamp || n.elapsed || 0;
      const noteTime = typeof timestamp === 'number' ? timestamp : now;
      return now - noteTime < recentWindow;
    });

    if (recent.length === 0) return 'low';

    const oldestRecent = recent[0];
    const newestRecent = recent[recent.length - 1];
    const oldestTime = oldestRecent?.timestamp || oldestRecent?.elapsed || now;
    const newestTime = newestRecent?.timestamp || newestRecent?.elapsed || now;
    const timeSpan = Math.max(100, newestTime - oldestTime);
    const noteRate = recent.length / (timeSpan / 1000);

    if (noteRate > 10) return 'high';
    if (noteRate > 1) return 'medium';
    return 'low';
  }

  hasUserInteraction(notes: TemporalRecord[], recentWindow = 2000): boolean {
    if (notes.length === 0) return false;

    const now = Date.now();
    const recent = notes.slice(-5).filter(n => {
      const timestamp = n.timestamp || n.elapsed || 0;
      const noteTime = typeof timestamp === 'number' ? timestamp : now;
      return now - noteTime < recentWindow;
    });

    return recent.some(note =>
      note.step?.includes('interaction') ||
      note.step?.includes('click') ||
      note.step?.includes('action') ||
      note.observation?.includes('user') ||
      note.observation?.includes('clicked') ||
      note.observation?.includes('interaction')
    );
  }

  isStableState(notes: TemporalRecord[], window = 2000): boolean {
    if (notes.length < 3) return true;

    const now = Date.now();
    const recent = notes.slice(-5).filter(n => {
      const timestamp = n.timestamp || n.elapsed || 0;
      const noteTime = typeof timestamp === 'number' ? timestamp : now;
      return now - noteTime < window;
    });

    if (recent.length < 3) return true;

    const scores = recent.map(n => {
      if (n.score !== undefined) return n.score;
      if (n.gameState?.score !== undefined) return n.gameState.score;
      return 0;
    });

    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);

    return stdDev < 0.5;
  }
}

/**
 * Temporal Preprocessing Manager
 */
export class TemporalPreprocessingManager {
  activityDetector: ActivityDetector;
  preprocessedCache: PreprocessCache;
  preprocessInterval: number;
  cacheMaxAge: number;
  preprocessingInProgress: boolean;
  preprocessQueue: TemporalRecord[][];

  constructor(options: TemporalOptions = {}) {
    this.activityDetector = new ActivityDetector();
    this.preprocessedCache = {
      aggregated: null,
      multiScale: null,
      coherence: null,
      prunedNotes: null,
      patterns: null,
      lastPreprocessTime: 0,
      noteCount: 0,
      notesFingerprint: null,
      optionsFingerprint: null
    };
    this.preprocessInterval = options.preprocessInterval || 2000;
    this.cacheMaxAge = options.cacheMaxAge || 5000;
    this.preprocessingInProgress = false;
    this.preprocessQueue = [];
  }

  async getFastAggregation(notes: TemporalRecord[], options: TemporalOptions = {}): Promise<AggregatedTemporalNotes> {
    const activity = this.activityDetector.detectActivityLevel(notes);

    if (activity === 'high' && this.isCacheValid(notes, options)) {
      log('[Preprocessor] Using cached aggregation (high activity)');
      return this.preprocessedCache.aggregated!;
    }

    return await aggregateTemporalNotes(notes, options);
  }

  async preprocessInBackground(notes: TemporalRecord[], options: TemporalOptions = {}): Promise<void> {
    if (this.preprocessingInProgress) {
      return;
    }

    const activity = this.activityDetector.detectActivityLevel(notes);
    const hasInteraction = this.activityDetector.hasUserInteraction(notes);
    const isStable = this.activityDetector.isStableState(notes);

    if (activity === 'high' || (hasInteraction && !isStable)) {
      return;
    }

    this.preprocessingInProgress = true;

    try {
      const aggregateMultiScale = await getMultiScaleImports();
      const { pruneTemporalNotes, selectTopWeightedNotes } = await getPrunerImports();

      const aggregated = await aggregateTemporalNotes(notes, {
        windowSize: options.windowSize || 10000,
        decayFactor: options.decayFactor || 0.9
      });

      const multiScale = aggregateMultiScale(notes, {
        attentionWeights: true
      });

      const prunedNotes = pruneTemporalNotes(notes, {
        maxNotes: options.maxNotes || 20,
        minWeight: options.minWeight || 0.1
      });

      const topWeighted = selectTopWeightedNotes!(notes, {
        maxNotes: options.maxNotes || 20
      });

      const patterns = this._identifyPatterns(notes);

      this.preprocessedCache = {
        aggregated,
        multiScale,
        coherence: aggregated.coherence || 0,
        prunedNotes,
        topWeighted,
        patterns,
        lastPreprocessTime: Date.now(),
      noteCount: notes.length,
      notesFingerprint: this._getNotesFingerprint(notes),
      optionsFingerprint: this._getOptionsFingerprint(options)
      };

      log(`[Preprocessor] Background preprocessing complete (${notes.length} notes, activity: ${activity})`);
    } catch (error) {
      warn(`[Preprocessor] Background preprocessing failed: ${errorMessage(error)}`);
    } finally {
      this.preprocessingInProgress = false;
    }
  }

  isCacheValid(notes: TemporalRecord[], options: TemporalOptions = {}): boolean {
    if (!this.preprocessedCache.aggregated) return false;

    const age = Date.now() - this.preprocessedCache.lastPreprocessTime;
    if (age > this.cacheMaxAge) return false;

    const noteCountDiff = Math.abs(notes.length - this.preprocessedCache.noteCount);
    if (noteCountDiff > notes.length * 0.2) return false;

    const notesFingerprint = this._getNotesFingerprint(notes);
    if (notesFingerprint === null || notesFingerprint !== this.preprocessedCache.notesFingerprint) return false;
    if (this._getOptionsFingerprint(options) !== this.preprocessedCache.optionsFingerprint) return false;

    return true;
  }

  _getNotesFingerprint(notes: TemporalRecord[]): string | null {
    try {
      return serializeTemporalCacheValue(notes);
    } catch (error) {
      warn(`[Preprocessor] Unable to fingerprint notes for cache reuse: ${errorMessage(error)}`);
      return null;
    }
  }

  _getOptionsFingerprint(options: TemporalOptions): string {
    return JSON.stringify({
      windowSize: options.windowSize || 10000,
      decayFactor: options.decayFactor || 0.9,
      maxNotes: options.maxNotes || 20,
      minWeight: options.minWeight || 0.1
    });
  }

  _identifyPatterns(notes: TemporalRecord[]): { trends: Pattern[]; conflicts: Pattern[] } {
    if (notes.length < 3) {
      return { trends: [], conflicts: [] };
    }

    const trends = [];
    const conflicts = [];

    const scores = notes.map(n => n.score ?? n.gameState?.score ?? 0);
    if (scores.length >= 3) {
      const first = scores[0]!;
      const last = scores[scores.length - 1]!;
      if (last > first * 1.1) {
        trends.push({ type: 'increasing', metric: 'score', magnitude: (last - first) / first });
      } else if (last < first * 0.9) {
        trends.push({ type: 'decreasing', metric: 'score', magnitude: (first - last) / first });
      }
    }

    const observations = notes.map(n => n.observation || '').filter(o => o.length > 0);
    if (observations.length >= 2) {
      const hasPositive = observations.some(o =>
        /good|great|excellent|improved|better/i.test(o)
      );
      const hasNegative = observations.some(o =>
        /bad|poor|worse|declined|problem/i.test(o)
      );
      if (hasPositive && hasNegative) {
        conflicts.push({ type: 'contradictory_observations', count: observations.length });
      }
    }

    return { trends, conflicts };
  }

  getFastMultiScale(notes: TemporalRecord[], options: TemporalOptions = {}): unknown {
    if (this.isCacheValid(notes, options) && this.preprocessedCache.multiScale) {
      return this.preprocessedCache.multiScale;
    }

    // Synchronous fallback - use lazy import cache
    if (_aggregateMultiScale) {
      return _aggregateMultiScale(notes, { attentionWeights: true });
    }

    // If not yet imported, return empty result (caller should use async path)
    return { scales: {}, summary: 'Not yet loaded', coherence: {} };
  }

  getFastPrunedNotes(notes: TemporalRecord[], options: TemporalOptions = {}): TemporalRecord[] {
    if (this.isCacheValid(notes, options) && this.preprocessedCache.prunedNotes) {
      return this.preprocessedCache.prunedNotes;
    }

    // Synchronous fallback
    if (_pruneTemporalNotes) {
      return _pruneTemporalNotes(notes, options);
    }

    return notes;
  }

  getCacheStats() {
    return {
      hasCache: !!this.preprocessedCache.aggregated,
      cacheAge: this.preprocessedCache.aggregated
        ? Date.now() - this.preprocessedCache.lastPreprocessTime
        : null,
      noteCount: this.preprocessedCache.noteCount,
      coherence: this.preprocessedCache.coherence,
      preprocessingInProgress: this.preprocessingInProgress
    };
  }

  clearCache() {
    this.preprocessedCache = {
      aggregated: null,
      multiScale: null,
      coherence: null,
      prunedNotes: null,
      patterns: null,
      lastPreprocessTime: 0,
      noteCount: 0,
      notesFingerprint: null,
      optionsFingerprint: null
    };
  }
}

/**
 * Adaptive Temporal Processor
 */
export class AdaptiveTemporalProcessor {
  preprocessor: TemporalPreprocessingManager;
  activityDetector: ActivityDetector;

  constructor(options: TemporalOptions = {}) {
    this.preprocessor = new TemporalPreprocessingManager(options);
    this.activityDetector = new ActivityDetector();
  }

  async processNotes(notes: TemporalRecord[], options: TemporalOptions = {}) {
    const aggregateMultiScale = await getMultiScaleImports();
    const { pruneTemporalNotes } = await getPrunerImports();
    const activity = this.activityDetector.detectActivityLevel(notes);
    const hasInteraction = this.activityDetector.hasUserInteraction(notes);
    const isStable = this.activityDetector.isStableState(notes);

    if (activity === 'high' && hasInteraction) {
      const aggregated = await this.preprocessor.getFastAggregation(notes, options);
      return {
        aggregated,
        multiScale: this.preprocessor.getFastMultiScale(notes, options),
        prunedNotes: this.preprocessor.getFastPrunedNotes(notes, options),
        source: 'cache',
        latency: '<10ms',
        activity,
        metadata: {
          noteCount: notes.length,
          cacheAge: this.preprocessor.preprocessedCache.lastPreprocessTime
            ? Date.now() - this.preprocessor.preprocessedCache.lastPreprocessTime
            : null
        }
      };
    }

    if (activity === 'low' && isStable) {
      await this.preprocessor.preprocessInBackground(notes, options);
      return {
        aggregated: this.preprocessor.preprocessedCache.aggregated,
        multiScale: this.preprocessor.preprocessedCache.multiScale,
        prunedNotes: this.preprocessor.preprocessedCache.prunedNotes,
        patterns: this.preprocessor.preprocessedCache.patterns,
        source: 'preprocessed',
        latency: '100-1000ms (background)',
        activity,
        metadata: {
          noteCount: notes.length,
          cacheAge: 0
        }
      };
    }

    if (this.preprocessor.isCacheValid(notes, options)) {
      return {
        aggregated: await this.preprocessor.getFastAggregation(notes, options),
        multiScale: this.preprocessor.getFastMultiScale(notes, options),
        prunedNotes: this.preprocessor.getFastPrunedNotes(notes, options),
        source: 'cache',
        latency: '<10ms',
        activity,
        metadata: {
          noteCount: notes.length,
          cacheAge: Date.now() - this.preprocessor.preprocessedCache.lastPreprocessTime
        }
      };
    } else {
      const aggregated = await aggregateTemporalNotes(notes, {
        windowSize: options.windowSize || 10000,
        decayFactor: options.decayFactor || 0.9
      });

      return {
        aggregated,
        multiScale: aggregateMultiScale(notes, { attentionWeights: true }),
        prunedNotes: pruneTemporalNotes(notes, { maxNotes: options.maxNotes || 20 }),
        source: 'computed',
        latency: '50-200ms',
        activity,
        metadata: {
          noteCount: notes.length,
          cacheAge: null
        }
      };
    }
  }
}

/**
 * Create a temporal preprocessing manager with default options
 */
export function createTemporalPreprocessingManager(options: TemporalOptions = {}): TemporalPreprocessingManager {
  return new TemporalPreprocessingManager(options);
}

/**
 * Create an adaptive temporal processor with default options
 */
export function createAdaptiveTemporalProcessor(options: TemporalOptions = {}): AdaptiveTemporalProcessor {
  return new AdaptiveTemporalProcessor(options);
}

// ============================================================================
// TEMPORAL BATCH OPTIMIZER (from temporal-batch-optimizer.mjs)
// ============================================================================

/**
 * Temporal Batch Optimizer
 * Extends BatchOptimizer with temporal awareness
 */
export class TemporalBatchOptimizer extends BatchOptimizerBase {
  temporalDependencies: Map<string, Dependency>;
  completedTemporalRequests: Map<string, number>;
  failedTemporalRequests: Map<string, { requestId: number; error: unknown }>;
  nextTemporalRequestId: number;
  sequentialContext: SequentialContext | null;
  adaptiveBatching: boolean;
  declare queue: QueueRequest[];
  declare cache: Map<string, ValidationResult> | null;

  constructor(options: TemporalOptions = {}) {
    super(options);
    this.temporalDependencies = new Map();
    this.completedTemporalRequests = new Map();
    this.failedTemporalRequests = new Map();
    this.nextTemporalRequestId = 0;
    this.sequentialContext = options.sequentialContext || null;
    this.adaptiveBatching = options.adaptiveBatching !== false;
  }

  async addTemporalRequest(imagePath: string, prompt: string, context: Record<string, unknown>, dependencies: string[] = []): Promise<ValidationResult> {
    const requestId = ++this.nextTemporalRequestId;
    this.temporalDependencies.set(imagePath, {
      dependencies,
      timestamp: Date.now(),
      priority: this.calculatePriority(dependencies, context),
      requestId
    });

    return this._queueTemporalRequest(imagePath, prompt, context, null, requestId);
  }

  _queueTemporalRequest(imagePath: string, prompt: string, context: Record<string, unknown>, validateFn: ValidateFn = null, requestId?: number): Promise<ValidationResult> {
    // Temporal requests must always traverse this scheduler: the inherited fast path
    // would otherwise execute a dependent request before its prerequisite completes.
    const activeRequests = this.activeRequests;
    const cache = this.cache;
    this.activeRequests = this.maxConcurrency;
    this.cache = null;
    let pending: Promise<ValidationResult>;
    try {
      const parentQueueRequest = BatchOptimizer.prototype._queueRequest as (imagePath: string, prompt: string, context: Record<string, unknown>, validateFn: ValidateFn) => Promise<ValidationResult>;
      pending = parentQueueRequest.call(this, imagePath, prompt, context, validateFn);
      const queuedRequest = this.queue[this.queue.length - 1];
      if (queuedRequest?.imagePath === imagePath) {
        if (requestId !== undefined) queuedRequest.temporalRequestId = requestId;
      }
    } finally {
      this.activeRequests = activeRequests;
      this.cache = cache;
    }
    this._processQueue();
    return pending;
  }

  calculatePriority(dependencies: string[], context: Record<string, unknown>): number {
    let priority = 0;

    if (dependencies.length === 0) {
      priority += 100;
    } else {
      priority -= dependencies.length * 10;
    }

    if (typeof context.timestamp === 'number') {
      const age = Date.now() - context.timestamp;
      if (age < 60000) {
        priority += Math.max(0, 30 - age / 1000);
      }
    }

    if (context.critical || context.testType === 'critical') {
      priority += 50;
    }

    return priority;
  }

  async _processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    try {
      while (this.queue.length > 0 && this.activeRequests < this.maxConcurrency) {
        const sortedQueue = this.sortByTemporalDependencies([...this.queue]);
        if (this._rejectUnsatisfiableRequests(sortedQueue) > 0) {
          continue;
        }

        const batch = this.selectTemporalBatch(sortedQueue);

        if (batch.length === 0) {
          break;
        }

        batch.forEach(item => {
          const index = this.queue.indexOf(item);
          if (index >= 0) this.queue.splice(index, 1);
        });

        const promises = batch.map(async ({ imagePath, prompt, context, validateFn, resolve, reject, temporalRequestId }: QueueRequest) => {
          try {
            if (this.cache) {
              const cacheKey = this._getCacheKey(imagePath, prompt, context);
              if (this.cache.has(cacheKey)) {
                this._markTemporalRequestCompleted(imagePath, temporalRequestId);
                resolve(this.cache.get(cacheKey)!);
                return;
              }
            }

            if (this.sequentialContext) {
              context = {
                ...context,
                sequentialContext: this.sequentialContext.getContext()
              };
            }

            const result = await this._processRequest(imagePath, prompt, context, validateFn) as ValidationResult;

            this._markTemporalRequestCompleted(imagePath, temporalRequestId);

            if (this.sequentialContext && result.score !== null) {
              this.sequentialContext.addDecision({
                score: result.score,
                issues: result.issues || [],
                assessment: result.assessment,
                reasoning: result.reasoning
              });
            }

            resolve(result);
          } catch (error) {
            this._markTemporalRequestFailed(imagePath, temporalRequestId, error);
            reject(error);
          }
        });

        await Promise.allSettled(promises);
      }
    } finally {
      this.processing = false;
    }
  }

  sortByTemporalDependencies(queue: QueueRequest[]): QueueRequest[] {
    return queue.sort((a, b) => {
      const depsA = this.temporalDependencies.get(a.imagePath);
      const depsB = this.temporalDependencies.get(b.imagePath);

      if (!depsA && depsB) return -1;
      if (depsA && !depsB) return 1;
      if (!depsA && !depsB) return 0;

      return depsB!.priority - depsA!.priority;
    });
  }

  selectTemporalBatch(sortedQueue: QueueRequest[]): QueueRequest[] {
    if (!this.adaptiveBatching) {
      return sortedQueue.splice(0, this.batchSize);
    }

    const batch = [];
    for (const item of sortedQueue) {
      if (batch.length >= this.batchSize) break;

      const deps = this.temporalDependencies.get(item.imagePath);

      if (!deps || deps.dependencies.every(dep => {
        const dependency = this.temporalDependencies.get(dep);
        return dependency && this.completedTemporalRequests.has(dep) &&
          this.completedTemporalRequests.get(dep) === dependency.requestId;
      })) {
        batch.push(item);
      }
    }

    return batch;
  }

  _markTemporalRequestCompleted(imagePath: string, requestId: number | undefined): void {
    const request = this.temporalDependencies.get(imagePath);
    if (request && request.requestId === requestId) {
      this.completedTemporalRequests.set(imagePath, requestId);
    }
  }

  _markTemporalRequestFailed(imagePath: string, requestId: number | undefined, error: unknown): void {
    const request = this.temporalDependencies.get(imagePath);
    if (request && request.requestId === requestId) {
      this.failedTemporalRequests.set(imagePath, { requestId, error });
    }
  }

  _rejectUnsatisfiableRequests(queue: QueueRequest[]): number {
    let rejected = 0;
    for (const item of queue) {
      const error = this._getDependencyError(item.imagePath);
      if (!error) continue;

      const index = this.queue.indexOf(item);
      if (index >= 0) this.queue.splice(index, 1);
      item.reject(error);
      rejected++;
    }
    return rejected;
  }

  _getDependencyError(imagePath: string, ancestry: Set<string> = new Set()): TemporalBatchError | null {
    const request = this.temporalDependencies.get(imagePath);
    if (!request) return null;

    const nextAncestry = new Set(ancestry);
    nextAncestry.add(imagePath);
    for (const dependencyPath of request.dependencies) {
      const dependency = this.temporalDependencies.get(dependencyPath);
      if (!dependency) {
        return new TemporalBatchError(`Unknown temporal dependency: ${dependencyPath}`, {
          imagePath,
          dependencyPath
        });
      }

      const failed = this.failedTemporalRequests.get(dependencyPath);
      if (failed && failed.requestId === dependency.requestId) {
        return new TemporalBatchError(`Temporal dependency failed: ${dependencyPath}`, {
          imagePath,
          dependencyPath,
          cause: errorMessage(failed.error)
        });
      }

      if (nextAncestry.has(dependencyPath)) {
        return new TemporalBatchError(`Cyclic temporal dependency: ${dependencyPath}`, {
          imagePath,
          dependencyPath
        });
      }

      if (!this.completedTemporalRequests.has(dependencyPath) ||
        this.completedTemporalRequests.get(dependencyPath) !== dependency.requestId) {
        const nestedError = this._getDependencyError(dependencyPath, nextAncestry);
        if (nestedError) return nestedError;
      }
    }
    return null;
  }

  getTemporalStats() {
    return {
      ...this.getCacheStats(),
      dependencies: this.temporalDependencies.size,
      sequentialContext: this.sequentialContext
        ? {
            historyLength: this.sequentialContext.history.length,
            patterns: this.sequentialContext.identifyPatterns()
          }
        : null
    };
  }
}
