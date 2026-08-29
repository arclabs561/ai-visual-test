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

import { aggregateTemporalNotes } from '#temporal-core';
import { log, warn } from './logger.mjs';
import { BatchOptimizer } from './batch-optimizer.mjs';

// ============================================================================
// TEMPORAL ERROR TYPES (from temporal-errors.mjs)
// ============================================================================

/**
 * Base error class for temporal components
 */
export class TemporalError extends Error {
  constructor(message, code, context = {}) {
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
  constructor(message, context = {}) {
    super(message, 'PERCEPTION_TIME_ERROR', context);
    this.name = 'PerceptionTimeError';
  }
}

/**
 * Error for sequential decision context
 */
export class SequentialContextError extends TemporalError {
  constructor(message, context = {}) {
    super(message, 'SEQUENTIAL_CONTEXT_ERROR', context);
    this.name = 'SequentialContextError';
  }
}

/**
 * Error for multi-scale aggregation
 */
export class MultiScaleError extends TemporalError {
  constructor(message, context = {}) {
    super(message, 'MULTI_SCALE_ERROR', context);
    this.name = 'MultiScaleError';
  }
}

/**
 * Error for temporal batch optimization
 */
export class TemporalBatchError extends TemporalError {
  constructor(message, context = {}) {
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
export function validateNotes(notes) {
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

    validNotes.push(note);
  }

  if (invalidNotes.length > 0) {
    warn(`[Temporal] ${invalidNotes.length} invalid notes filtered out:`, invalidNotes);
  }

  return validNotes;
}

/**
 * Validate and sort notes
 */
export function validateAndSortNotes(notes) {
  const validNotes = validateNotes(notes);
  return validNotes.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
}

/**
 * Validate time scales
 */
export function validateTimeScales(timeScales) {
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
export function validateAction(action) {
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
export function validatePerceptionContext(context) {
  if (context === null || typeof context !== 'object') {
    throw new PerceptionTimeError('Context must be an object', { received: typeof context });
  }

  if (context.attentionLevel && !['focused', 'normal', 'distracted'].includes(context.attentionLevel)) {
    throw new PerceptionTimeError(`Invalid attentionLevel: ${context.attentionLevel}`, {
      attentionLevel: context.attentionLevel,
      validLevels: ['focused', 'normal', 'distracted']
    });
  }

  if (context.actionComplexity && !['simple', 'normal', 'complex'].includes(context.actionComplexity)) {
    throw new PerceptionTimeError(`Invalid actionComplexity: ${context.actionComplexity}`, {
      actionComplexity: context.actionComplexity,
      validComplexities: ['simple', 'normal', 'complex']
    });
  }

  if (context.contentLength !== undefined && (typeof context.contentLength !== 'number' || context.contentLength < 0)) {
    throw new PerceptionTimeError('contentLength must be a non-negative number', {
      contentLength: context.contentLength
    });
  }

  return true;
}

/**
 * Validate sequential decision context options
 */
export function validateSequentialContextOptions(options) {
  if (options === null || options === undefined) {
    return true;
  }

  if (typeof options !== 'object') {
    throw new SequentialContextError('Options must be an object', { received: typeof options });
  }

  if (options.maxHistory !== undefined && options.maxHistory !== null) {
    if (typeof options.maxHistory !== 'number' || options.maxHistory < 1) {
      throw new SequentialContextError('maxHistory must be a positive number', {
        maxHistory: options.maxHistory
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
  constructor(options = {}) {
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

  async shouldPrompt(currentState, previousState, temporalNotes, context = {}) {
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
      const decision = {
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
              const { warn: w } = await import('./logger.mjs');
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
      const decision = {
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
              const { warn: w } = await import('./logger.mjs');
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

  calculateStateChange(currentState, previousState) {
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

  calculateGameStateChange(current, previous) {
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

  hasRecentUserAction(temporalNotes, context) {
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

  isDecisionPoint(currentState, context) {
    if (context.stage === 'decision' || context.stage === 'evaluation') return true;
    if (context.testType === 'critical' || context.critical) return true;
    if (context.goal && context.goalCompleted) return true;

    return false;
  }

  async detectCoherenceDrop(temporalNotes, currentAggregated) {
    if (temporalNotes.length < 4) return false;

    const previousNotes = temporalNotes.slice(0, -1);
    const previousAggregated = await aggregateTemporalNotes(previousNotes);
    const previousCoherence = previousAggregated.coherence || 1.0;
    const currentCoherence = currentAggregated.coherence || 1.0;

    const drop = previousCoherence - currentCoherence;
    return drop > this.urgencyThreshold;
  }

  calculatePromptUrgency(temporalContext, decision) {
    if (decision.urgency === 'high') return 1.0;
    if (decision.urgency === 'medium') return 0.6;

    const coherence = temporalContext.coherence || 0;
    const timeSinceLastPrompt = temporalContext.timeSinceLastPrompt || 0;

    if (coherence > 0.7 && timeSinceLastPrompt > 5000) {
      return 0.4;
    }

    return 0.2;
  }

  async selectOptimalTiming(requests, temporalContext) {
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

    const stable = temporalContext.coherence > 0.7;
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
export function createTemporalDecisionManager(options = {}) {
  return new TemporalDecisionManager(options);
}

// ============================================================================
// TEMPORAL PREPROCESSING MANAGER (from temporal-preprocessor.mjs)
// ============================================================================

// Lazy imports to avoid circular dependency (these depend on temporal-multi-scale
// which depends on this file for validation/errors)
let _aggregateMultiScale = null;
let _pruneTemporalNotes = null;
let _selectTopWeightedNotes = null;

async function getMultiScaleImports() {
  if (!_aggregateMultiScale) {
    const mod = await import('./temporal-multi-scale.mjs');
    _aggregateMultiScale = mod.aggregateMultiScale;
  }
  return _aggregateMultiScale;
}

async function getPrunerImports() {
  if (!_pruneTemporalNotes) {
    const mod = await import('./temporal-prompt-formatting.mjs');
    _pruneTemporalNotes = mod.pruneTemporalNotes;
    _selectTopWeightedNotes = mod.selectTopWeightedNotes;
  }
  return { pruneTemporalNotes: _pruneTemporalNotes, selectTopWeightedNotes: _selectTopWeightedNotes };
}

/**
 * Activity Detector
 */
class ActivityDetector {
  detectActivityLevel(notes, recentWindow = 5000) {
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
    const oldestTime = oldestRecent.timestamp || oldestRecent.elapsed || now;
    const newestTime = newestRecent.timestamp || newestRecent.elapsed || now;
    const timeSpan = Math.max(100, newestTime - oldestTime);
    const noteRate = recent.length / (timeSpan / 1000);

    if (noteRate > 10) return 'high';
    if (noteRate > 1) return 'medium';
    return 'low';
  }

  hasUserInteraction(notes, recentWindow = 2000) {
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

  isStableState(notes, window = 2000) {
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
  constructor(options = {}) {
    this.activityDetector = new ActivityDetector();
    this.preprocessedCache = {
      aggregated: null,
      multiScale: null,
      coherence: null,
      prunedNotes: null,
      patterns: null,
      lastPreprocessTime: 0,
      noteCount: 0
    };
    this.preprocessInterval = options.preprocessInterval || 2000;
    this.cacheMaxAge = options.cacheMaxAge || 5000;
    this.preprocessingInProgress = false;
    this.preprocessQueue = [];
  }

  async getFastAggregation(notes, options = {}) {
    const activity = this.activityDetector.detectActivityLevel(notes);

    if (activity === 'high' && this.isCacheValid(notes)) {
      log('[Preprocessor] Using cached aggregation (high activity)');
      return this.preprocessedCache.aggregated;
    }

    return await aggregateTemporalNotes(notes, options);
  }

  async preprocessInBackground(notes, options = {}) {
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

      const topWeighted = selectTopWeightedNotes(notes, {
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
        noteCount: notes.length
      };

      log(`[Preprocessor] Background preprocessing complete (${notes.length} notes, activity: ${activity})`);
    } catch (error) {
      warn(`[Preprocessor] Background preprocessing failed: ${error.message}`);
    } finally {
      this.preprocessingInProgress = false;
    }
  }

  isCacheValid(notes) {
    if (!this.preprocessedCache.aggregated) return false;

    const age = Date.now() - this.preprocessedCache.lastPreprocessTime;
    if (age > this.cacheMaxAge) return false;

    const noteCountDiff = Math.abs(notes.length - this.preprocessedCache.noteCount);
    if (noteCountDiff > notes.length * 0.2) return false;

    return true;
  }

  _identifyPatterns(notes) {
    if (notes.length < 3) {
      return { trends: [], conflicts: [] };
    }

    const trends = [];
    const conflicts = [];

    const scores = notes.map(n => n.score ?? n.gameState?.score ?? 0);
    if (scores.length >= 3) {
      const first = scores[0];
      const last = scores[scores.length - 1];
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

  getFastMultiScale(notes) {
    if (this.isCacheValid(notes) && this.preprocessedCache.multiScale) {
      return this.preprocessedCache.multiScale;
    }

    // Synchronous fallback - use lazy import cache
    if (_aggregateMultiScale) {
      return _aggregateMultiScale(notes, { attentionWeights: true });
    }

    // If not yet imported, return empty result (caller should use async path)
    return { scales: {}, summary: 'Not yet loaded', coherence: {} };
  }

  getFastPrunedNotes(notes, options = {}) {
    if (this.isCacheValid(notes) && this.preprocessedCache.prunedNotes) {
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
      noteCount: 0
    };
  }
}

/**
 * Adaptive Temporal Processor
 */
export class AdaptiveTemporalProcessor {
  constructor(options = {}) {
    this.preprocessor = new TemporalPreprocessingManager(options);
    this.activityDetector = new ActivityDetector();
  }

  async processNotes(notes, options = {}) {
    const aggregateMultiScale = await getMultiScaleImports();
    const { pruneTemporalNotes } = await getPrunerImports();
    const activity = this.activityDetector.detectActivityLevel(notes);
    const hasInteraction = this.activityDetector.hasUserInteraction(notes);
    const isStable = this.activityDetector.isStableState(notes);

    if (activity === 'high' && hasInteraction) {
      const aggregated = await this.preprocessor.getFastAggregation(notes, options);
      return {
        aggregated,
        multiScale: this.preprocessor.getFastMultiScale(notes),
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

    if (this.preprocessor.isCacheValid(notes)) {
      return {
        aggregated: await this.preprocessor.getFastAggregation(notes, options),
        multiScale: this.preprocessor.getFastMultiScale(notes),
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
export function createTemporalPreprocessingManager(options = {}) {
  return new TemporalPreprocessingManager(options);
}

/**
 * Create an adaptive temporal processor with default options
 */
export function createAdaptiveTemporalProcessor(options = {}) {
  return new AdaptiveTemporalProcessor(options);
}

// ============================================================================
// TEMPORAL BATCH OPTIMIZER (from temporal-batch-optimizer.mjs)
// ============================================================================

/**
 * Temporal Batch Optimizer
 * Extends BatchOptimizer with temporal awareness
 */
export class TemporalBatchOptimizer extends BatchOptimizer {
  constructor(options = {}) {
    super(options);
    this.temporalDependencies = new Map();
    this.sequentialContext = options.sequentialContext || null;
    this.adaptiveBatching = options.adaptiveBatching !== false;
  }

  async addTemporalRequest(imagePath, prompt, context, dependencies = []) {
    this.temporalDependencies.set(imagePath, {
      dependencies,
      timestamp: Date.now(),
      priority: this.calculatePriority(dependencies, context)
    });

    return this._queueRequest(imagePath, prompt, context);
  }

  calculatePriority(dependencies, context) {
    let priority = 0;

    if (dependencies.length === 0) {
      priority += 100;
    } else {
      priority -= dependencies.length * 10;
    }

    if (context.timestamp) {
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

  async _processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    try {
      const sortedQueue = this.sortByTemporalDependencies([...this.queue]);

      while (sortedQueue.length > 0 && this.activeRequests < this.maxConcurrency) {
        const batch = this.selectTemporalBatch(sortedQueue);

        batch.forEach(item => {
          const index = this.queue.findIndex(q => q.imagePath === item.imagePath);
          if (index >= 0) this.queue.splice(index, 1);
        });

        const promises = batch.map(async ({ imagePath, prompt, context, validateFn, resolve, reject }) => {
          try {
            if (this.cache) {
              const cacheKey = this._getCacheKey(imagePath, prompt, context);
              if (this.cache.has(cacheKey)) {
                resolve(this.cache.get(cacheKey));
                return;
              }
            }

            if (this.sequentialContext) {
              context = {
                ...context,
                sequentialContext: this.sequentialContext.getContext()
              };
            }

            const result = await this._processRequest(imagePath, prompt, context, validateFn);

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
            reject(error);
          }
        });

        await Promise.allSettled(promises);
      }
    } finally {
      this.processing = false;
    }
  }

  sortByTemporalDependencies(queue) {
    return queue.sort((a, b) => {
      const depsA = this.temporalDependencies.get(a.imagePath);
      const depsB = this.temporalDependencies.get(b.imagePath);

      if (!depsA && depsB) return -1;
      if (depsA && !depsB) return 1;
      if (!depsA && !depsB) return 0;

      return depsB.priority - depsA.priority;
    });
  }

  selectTemporalBatch(sortedQueue) {
    if (!this.adaptiveBatching) {
      return sortedQueue.splice(0, this.batchSize);
    }

    const batch = [];
    const processed = new Set();

    for (const item of sortedQueue) {
      if (batch.length >= this.batchSize) break;
      if (processed.has(item.imagePath)) continue;

      const deps = this.temporalDependencies.get(item.imagePath);

      if (!deps || deps.dependencies.every(dep => processed.has(dep))) {
        batch.push(item);
        processed.add(item.imagePath);
      }
    }

    return batch;
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
