/**
 * Temporal Multi-Scale
 *
 * Multi-scale aggregation, attention weighting, sequential context,
 * human perception time modeling, and adaptive window sizing.
 *
 * Consolidated from: temporal-decision.mjs, temporal-adaptive.mjs
 *
 * Depends on: temporal-core.mjs (constants, aggregation)
 */

import {
  TIME_SCALES,
  MULTI_SCALE_WINDOWS,
  READING_SPEEDS,
  ATTENTION_MULTIPLIERS,
  COMPLEXITY_MULTIPLIERS,
  CONFIDENCE_THRESHOLDS,
  TIME_BOUNDS,
  CONTENT_THRESHOLDS,
  aggregateTemporalNotes
} from '#temporal-core';
import { validateAndSortNotes, validateTimeScales, validateAction, validatePerceptionContext, validateSequentialContextOptions } from './temporal-orchestration.mjs';
import { MultiScaleError, PerceptionTimeError } from './temporal-orchestration.mjs';
import { warn, log } from './logger.mjs';

// ============================================================================
// MULTI-SCALE TEMPORAL AGGREGATION (from temporal-decision.mjs)
// ============================================================================

/**
 * Multi-scale temporal aggregation
 * Uses multiple time scales to capture different aspects of human perception
 */
export function aggregateMultiScale(notes, options = {}) {
  // Validate and sort inputs
  const sortedNotes = validateAndSortNotes(notes);

  const {
    timeScales = MULTI_SCALE_WINDOWS,
    attentionWeights = true
  } = options;

  // Validate time scales
  validateTimeScales(timeScales);

  if (sortedNotes.length === 0) {
    return {
      scales: {},
      summary: 'No notes available',
      coherence: {}
    };
  }

  const startTime = sortedNotes[0].timestamp || Date.now();
  const scales = {};

  // Aggregate at each time scale
  for (const [scaleName, windowSize] of Object.entries(timeScales)) {
    const windows = [];

    for (const note of sortedNotes) {
      const elapsed = note.elapsed || (note.timestamp - startTime);
      const windowIndex = Math.floor(elapsed / windowSize);

      if (!windows[windowIndex]) {
        windows[windowIndex] = {
          index: windowIndex,
          startTime: startTime + (windowIndex * windowSize),
          endTime: startTime + ((windowIndex + 1) * windowSize),
          notes: [],
          weightedScore: 0,
          totalWeight: 0
        };
      }

      // Attention-based weighting
      const weight = attentionWeights
        ? calculateAttentionWeight(note, { elapsed, windowSize, scaleName })
        : 1.0;

      windows[windowIndex].notes.push({ ...note, weight });

      const score = note.gameState?.score ?? note.score ?? 0;
      windows[windowIndex].weightedScore += score * weight;
      windows[windowIndex].totalWeight += weight;
    }

    const definedWindows = windows.filter(w => w !== undefined);

    scales[scaleName] = {
      windowSize,
      windows: definedWindows.map(w => ({
        window: w.index,
        timeRange: `${Math.round((w.startTime - startTime) / 1000)}s-${Math.round((w.endTime - startTime) / 1000)}s`,
        avgScore: w.totalWeight > 0 ? w.weightedScore / w.totalWeight : 0,
        noteCount: w.notes.length
      })),
      coherence: calculateCoherenceForScale(definedWindows)
    };
  }

  return {
    scales,
    summary: generateMultiScaleSummary(scales),
    coherence: Object.fromEntries(
      Object.entries(scales).map(([name, scale]) => [name, scale.coherence])
    )
  };
}

/**
 * Calculate attention-based weight
 * Models how human attention affects temporal perception
 *
 * @param {import('./index.mjs').TemporalNote} note - Temporal note
 * @param {Object} context - Context with elapsed, windowSize, scaleName
 * @returns {number} Attention weight
 */
export function calculateAttentionWeight(note, context) {
  const { elapsed, windowSize, scaleName } = context;

  // Base recency weight (exponential decay)
  const recencyWeight = Math.pow(0.9, elapsed / windowSize);

  // Salience weight (important events get more attention)
  const salienceWeight = calculateSalience(note);

  // Action weight (user actions focus attention)
  const actionWeight = note.step?.includes('interaction') || note.step?.includes('click')
    ? 1.5
    : 1.0;

  // Novelty weight (context changes attract attention)
  const noveltyWeight = note.observation?.includes('change') || note.observation?.includes('new')
    ? 1.3
    : 1.0;

  return recencyWeight * salienceWeight * actionWeight * noveltyWeight;
}

/**
 * Calculate salience (importance) of a note
 */
function calculateSalience(note) {
  let salience = 1.0;

  const score = note.score || note.gameState?.score || 5;
  if (score >= 8 || score <= 2) {
    salience *= 1.5;
  }

  if (note.issues && note.issues.length > 0) {
    salience *= 1.2;
  }

  const criticalKeywords = ['error', 'broken', 'fail', 'critical', 'important'];
  const observation = (note.observation || '').toLowerCase();
  if (criticalKeywords.some(kw => observation.includes(kw))) {
    salience *= 1.3;
  }

  return salience;
}

/**
 * Calculate coherence for a specific time scale
 */
function calculateCoherenceForScale(windows) {
  if (windows.length < 2) return 1.0;

  const scores = windows.map(w =>
    w.totalWeight > 0 ? w.weightedScore / w.totalWeight : 0
  ).filter(s => !isNaN(s) && isFinite(s));

  if (scores.length < 2) return 1.0;

  const trends = [];
  for (let i = 1; i < scores.length; i++) {
    const change = scores[i] - scores[i - 1];
    trends.push(change >= 0 ? 1 : -1);
  }

  let directionChanges = 0;
  for (let i = 1; i < trends.length; i++) {
    if (trends[i] !== trends[i - 1]) {
      directionChanges++;
    }
  }
  const directionConsistency = Math.max(0, Math.min(1, 1.0 - (directionChanges / Math.max(1, trends.length))));

  const meanScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((sum, s) => sum + Math.pow(s - meanScore, 2), 0) / scores.length;

  const scoreRange = Math.max(...scores) - Math.min(...scores);
  const maxVariance = Math.max(
    Math.pow(scoreRange / 2, 2),
    Math.pow(meanScore * 0.5, 2),
    10
  );
  const varianceCoherence = Math.max(0, Math.min(1, 1.0 - (variance / maxVariance)));

  const maxPossibleChanges = Math.max(1, scores.length - 2);
  const stability = Math.max(0, Math.min(1, 1.0 - (directionChanges / maxPossibleChanges)));

  const coherence = directionConsistency * 0.4 + stability * 0.3 + varianceCoherence * 0.3;

  const clamped = Math.max(0, Math.min(1, isNaN(coherence) || !isFinite(coherence) ? 0.5 : coherence));
  return clamped;
}

/**
 * Generate summary across multiple time scales
 */
function generateMultiScaleSummary(scales) {
  const parts = [];

  for (const [scaleName, scale] of Object.entries(scales)) {
    if (scale && scale.windows && scale.windows.length > 0) {
      const firstWindow = scale.windows[0];
      const lastWindow = scale.windows[scale.windows.length - 1];

      if (firstWindow && lastWindow &&
          firstWindow.avgScore !== undefined &&
          lastWindow.avgScore !== undefined) {
        const first = firstWindow.avgScore;
        const last = lastWindow.avgScore;
        const coherence = scale.coherence !== undefined ? scale.coherence : 0;
        parts.push(`${scaleName} scale (${scale.windowSize}ms): ${first.toFixed(1)} → ${last.toFixed(1)}, coherence: ${(coherence * 100).toFixed(0)}%`);
      }
    }
  }

  return parts.join('; ');
}

// ============================================================================
// SEQUENTIAL DECISION CONTEXT (from temporal-decision.mjs)
// ============================================================================

/**
 * Sequential Decision Context
 * Maintains context across LLM calls for better sequential decision-making
 */
export class SequentialDecisionContext {
  constructor(options = {}) {
    validateSequentialContextOptions(options);

    this.history = [];
    this.currentState = null;
    this.adaptations = {};
    this.maxHistory = options.maxHistory || 10;
    this.adaptationEnabled = options.adaptationEnabled === true;
    this.varianceTracking = options.varianceTracking !== false;
    this.baselineVariance = null;
  }

  addDecision(decision) {
    this.history.push({
      ...decision,
      timestamp: Date.now(),
      index: this.history.length
    });

    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    this.currentState = decision;

    if (this.varianceTracking && this.history.length >= 3 && this.baselineVariance === null) {
      const scores = this.history.map(d => d.score).filter(s => s !== null);
      if (scores.length >= 3) {
        this.baselineVariance = calculateVariance(scores);
      }
    }
  }

  adaptPrompt(basePrompt, currentContext) {
    if (!this.adaptationEnabled || this.history.length === 0) {
      return basePrompt;
    }

    const patterns = this.identifyPatterns();

    if (this.varianceTracking && this.baselineVariance !== null && patterns.scoreVariance) {
      const varianceChange = (patterns.scoreVariance - this.baselineVariance) / this.baselineVariance;
      if (varianceChange > 0.2) {
        warn(`[SequentialContext] Variance increased by ${(varianceChange * 100).toFixed(1)}% (${this.baselineVariance.toFixed(3)} → ${patterns.scoreVariance.toFixed(3)}). Disabling adaptation to prevent further degradation.`);
        if (!this.varianceIncreaseEvents) {
          this.varianceIncreaseEvents = [];
        }
        this.varianceIncreaseEvents.push({
          timestamp: Date.now(),
          baselineVariance: this.baselineVariance,
          currentVariance: patterns.scoreVariance,
          increasePercent: varianceChange * 100,
          historyLength: this.history.length
        });
        return basePrompt;
      }
      if (varianceChange < -0.1) {
        log(`[SequentialContext] Variance decreased by ${Math.abs(varianceChange * 100).toFixed(1)}% (${this.baselineVariance.toFixed(3)} → ${patterns.scoreVariance.toFixed(3)}). Model stability improved.`);
        if (!this.varianceIncreaseEvents) {
          this.varianceIncreaseEvents = [];
        }
        this.varianceIncreaseEvents.push({
          timestamp: Date.now(),
          baselineVariance: this.baselineVariance,
          currentVariance: patterns.scoreVariance,
          increasePercent: varianceChange * 100,
          historyLength: this.history.length,
          type: 'decrease'
        });
      }
    }

    const historyContext = this.buildHistoryContext(patterns);

    return `${basePrompt}

## Previous Evaluation Context:
${historyContext}

## Adaptation Instructions:
${this.buildAdaptationInstructions(patterns, currentContext)}`;
  }

  identifyPatterns() {
    if (this.history.length < 2) return {};

    const scores = this.history.map(d => d.score).filter(s => s !== null);
    const issues = this.history.flatMap(d => d.issues || []);

    const trend = scores.length >= 2
      ? scores[scores.length - 1] > scores[scores.length - 2] ? 'improving' : 'declining'
      : 'stable';

    const issueCounts = {};
    issues.forEach(issue => {
      issueCounts[issue] = (issueCounts[issue] || 0) + 1;
    });
    const commonIssues = Object.entries(issueCounts)
      .filter(([_, count]) => count >= 2)
      .map(([issue, _]) => issue);

    const scoreVariance = scores.length > 1
      ? calculateVariance(scores)
      : 0;
    const isConsistent = scoreVariance < 2.0;

    return {
      trend,
      commonIssues,
      isConsistent,
      scoreVariance,
      recentScores: scores.slice(-3)
    };
  }

  buildHistoryContext(patterns) {
    const parts = [];

    if (this.history.length > 0) {
      const recent = this.history.slice(-3);
      parts.push(`Recent evaluations (${this.history.length} total):`);
      recent.forEach((d, i) => {
        parts.push(`  ${i + 1}. Score: ${d.score?.toFixed(1) || 'N/A'}/10, Issues: ${(d.issues || []).length}`);
      });
    }

    if (patterns.trend) {
      parts.push(`Trend: ${patterns.trend}`);
    }

    if (patterns.commonIssues.length > 0) {
      parts.push(`Recurring issues: ${patterns.commonIssues.join(', ')}`);
    }

    if (!patterns.isConsistent) {
      parts.push(`Warning: Inconsistent scores detected (variance: ${patterns.scoreVariance.toFixed(2)})`);
    }

    return parts.join('\n');
  }

  buildAdaptationInstructions(patterns, currentContext) {
    const instructions = [];

    const variance = patterns.scoreVariance || 0;
    const hasStrongPatterns = patterns.commonIssues.length > 0;
    const confidence = variance < CONFIDENCE_THRESHOLDS.HIGH_VARIANCE && hasStrongPatterns ? 'high' :
                      variance < CONFIDENCE_THRESHOLDS.MEDIUM_VARIANCE || hasStrongPatterns ? 'medium' : 'low';

    if (patterns.trend === 'declining' && confidence === 'high') {
      instructions.push('Previous evaluations showed declining quality. Pay special attention to issues.');
    } else if (patterns.trend === 'declining' && confidence === 'medium') {
      instructions.push('Previous evaluations showed a slight decline. Consider checking for issues.');
    }

    if (patterns.commonIssues.length > 0) {
      if (confidence === 'high') {
        instructions.push(`Look for these recurring issues: ${patterns.commonIssues.join(', ')}`);
      } else if (confidence === 'medium') {
        instructions.push(`These issues appeared in previous evaluations: ${patterns.commonIssues.join(', ')}. Consider checking for them.`);
      }
    }

    if (!patterns.isConsistent) {
      instructions.push('Previous evaluations were inconsistent. Be especially careful and thorough.');
    }

    if (patterns.recentScores.length > 0) {
      const avgRecent = patterns.recentScores.reduce((a, b) => a + b, 0) / patterns.recentScores.length;
      if (confidence === 'high') {
        instructions.push(`Recent average score: ${avgRecent.toFixed(1)}/10. Use this as context but evaluate independently.`);
      } else {
        instructions.push(`Recent evaluations averaged ${avgRecent.toFixed(1)}/10. Evaluate independently based on current screenshot.`);
      }
    }

    return instructions.length > 0
      ? instructions.join('\n')
      : 'Evaluate independently, but consider previous context for consistency.';
  }

  getContext() {
    const patterns = this.identifyPatterns();
    return {
      historyLength: this.history.length,
      recentDecisions: this.history.slice(-3),
      patterns,
      varianceMetrics: this.varianceTracking ? {
        baselineVariance: this.baselineVariance,
        currentVariance: patterns.scoreVariance,
        varianceIncrease: this.baselineVariance !== null && patterns.scoreVariance
          ? ((patterns.scoreVariance - this.baselineVariance) / this.baselineVariance) * 100
          : null,
        varianceIncreaseEvents: this.varianceIncreaseEvents || [],
        adaptationEnabled: this.adaptationEnabled,
        adaptationDisabledDueToVariance: this.baselineVariance !== null && patterns.scoreVariance
          ? ((patterns.scoreVariance - this.baselineVariance) / this.baselineVariance) > 0.2
          : false
      } : null
    };
  }

  getVarianceStats() {
    if (!this.varianceTracking) {
      return { trackingEnabled: false };
    }

    const patterns = this.identifyPatterns();
    return {
      trackingEnabled: true,
      baselineVariance: this.baselineVariance,
      currentVariance: patterns.scoreVariance,
      varianceIncrease: this.baselineVariance !== null && patterns.scoreVariance
        ? ((patterns.scoreVariance - this.baselineVariance) / this.baselineVariance) * 100
        : null,
      varianceIncreaseEvents: this.varianceIncreaseEvents || [],
      adaptationEnabled: this.adaptationEnabled,
      historyLength: this.history.length,
      scores: this.history.map(d => d.score).filter(s => s !== null)
    };
  }
}

// ============================================================================
// HUMAN PERCEPTION TIME (from temporal-decision.mjs)
// ============================================================================

/**
 * Human Perception Time Modeling
 * Models human perception at different time scales
 */
export function humanPerceptionTime(action, context = {}) {
  validateAction(action);
  validatePerceptionContext(context);

  const {
    persona = null,
    attentionLevel = 'normal',
    actionComplexity = 'normal',
    contentLength = 0
  } = context;

  const baseTimes = {
    instant: TIME_SCALES.INSTANT,
    visualDecision: TIME_SCALES.VISUAL_DECISION,
    quick: TIME_SCALES.QUICK,
    normal: TIME_SCALES.NORMAL,
    extended: TIME_SCALES.EXTENDED
  };

  const actionTimes = {
    'page-load': baseTimes.normal,
    'reading': calculateReadingTime(contentLength),
    'interaction': baseTimes.quick,
    'evaluation': baseTimes.extended,
    'scanning': baseTimes.quick,
    'visual-appeal': baseTimes.visualDecision
  };

  if (action === 'visual-appeal') {
    let time = TIME_BOUNDS.MIN_PERCEPTION;
    if (attentionLevel === 'focused') time = 80;
    if (attentionLevel === 'distracted') time = 120;
    return Math.max(TIME_SCALES.VISUAL_DECISION, Math.min(200, time));
  }

  let time = actionTimes[action] || baseTimes.normal;

  time *= ATTENTION_MULTIPLIERS[attentionLevel] || 1.0;
  time *= COMPLEXITY_MULTIPLIERS[actionComplexity] || 1.0;

  if (persona) {
    if (persona.name?.toLowerCase().includes('power') ||
        persona.name?.toLowerCase().includes('expert')) {
      time *= 0.8;
    } else if (persona.name?.toLowerCase().includes('accessibility') ||
               persona.name?.toLowerCase().includes('careful')) {
      time *= 1.3;
    }
  }

  return Math.max(TIME_BOUNDS.MIN_PERCEPTION, Math.round(time));
}

function calculateReadingTime(contentLength) {
  const words = contentLength / 5;

  const readingSpeed = words < CONTENT_THRESHOLDS.SHORT / 5
    ? READING_SPEEDS.SCANNING
    : words < CONTENT_THRESHOLDS.MEDIUM / 5
    ? READING_SPEEDS.NORMAL
    : READING_SPEEDS.DEEP;

  const minutes = words / readingSpeed;
  const milliseconds = minutes * 60 * 1000;

  const minTime = contentLength < CONTENT_THRESHOLDS.SHORT
    ? TIME_BOUNDS.MIN_READING_SHORT
    : TIME_BOUNDS.MIN_READING_LONG;
  const maxTime = contentLength > CONTENT_THRESHOLDS.LONG
    ? TIME_BOUNDS.MAX_READING_LONG
    : TIME_BOUNDS.MAX_READING_SHORT;

  return Math.max(minTime, Math.min(maxTime, milliseconds));
}

function calculateVariance(values) {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return variance;
}

// ============================================================================
// ADAPTIVE TEMPORAL AGGREGATION (from temporal-adaptive.mjs)
// ============================================================================

/**
 * Calculate optimal window size based on note frequency
 *
 * @param {import('./index.mjs').TemporalNote[]} notes - Temporal notes
 * @param {{
 *   minWindow?: number;
 *   maxWindow?: number;
 *   defaultWindow?: number;
 * }} [options={}] - Options
 * @returns {number} Optimal window size in milliseconds
 */
export function calculateOptimalWindowSize(notes, options = {}) {
  const {
    minWindow = 5000,
    maxWindow = 30000,
    defaultWindow = 10000
  } = options;

  if (notes.length < 2) {
    return defaultWindow;
  }

  const timeSpan = notes[notes.length - 1].timestamp - notes[0].timestamp;
  if (timeSpan <= 0) {
    return defaultWindow;
  }

  const frequency = notes.length / (timeSpan / 1000);

  if (frequency > 2) {
    return Math.max(minWindow, defaultWindow * 0.5);
  } else if (frequency < 0.5) {
    return Math.min(maxWindow, defaultWindow * 2);
  } else {
    return defaultWindow;
  }
}

/**
 * Detect activity pattern from notes
 *
 * @param {import('./index.mjs').TemporalNote[]} notes - Temporal notes
 * @returns {'fastChange' | 'slowChange' | 'consistent' | 'erratic'} Activity pattern
 */
export function detectActivityPattern(notes) {
  if (notes.length < 3) {
    return 'consistent';
  }

  const timeSpan = notes[notes.length - 1].timestamp - notes[0].timestamp;
  const avgTimeBetween = timeSpan / (notes.length - 1);

  const scores = notes
    .map(n => n.gameState?.score ?? 0)
    .filter(s => typeof s === 'number');

  if (scores.length < 2) {
    return 'consistent';
  }

  const meanScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((sum, score) => sum + Math.pow(score - meanScore, 2), 0) / scores.length;

  let directionChanges = 0;
  for (let i = 1; i < scores.length; i++) {
    const prev = scores[i - 1];
    const curr = scores[i];
    if ((prev < curr && i > 1 && scores[i - 2] > prev) ||
        (prev > curr && i > 1 && scores[i - 2] < prev)) {
      directionChanges++;
    }
  }

  if (avgTimeBetween < 1000 && variance > meanScore * 0.5) {
    return 'fastChange';
  } else if (avgTimeBetween > 2000 && variance < meanScore * 0.2) {
    return 'slowChange';
  } else if (directionChanges > scores.length * 0.3) {
    return 'erratic';
  } else {
    return 'consistent';
  }
}

/**
 * Aggregate temporal notes with adaptive window sizing
 *
 * @param {import('./index.mjs').TemporalNote[]} notes - Temporal notes
 * @param {{
 *   adaptive?: boolean;
 *   windowSize?: number;
 *   decayFactor?: number;
 *   coherenceThreshold?: number;
 * }} [options={}] - Aggregation options
 * @returns {import('./index.mjs').AggregatedTemporalNotes} Aggregated temporal notes
 */
export async function aggregateTemporalNotesAdaptive(notes, options = {}) {
  const {
    adaptive = true,
    windowSize,
    decayFactor = 0.9,
    coherenceThreshold = 0.7
  } = options;

  let finalWindowSize = windowSize;

  if (adaptive && !windowSize) {
    finalWindowSize = calculateOptimalWindowSize(notes);

    const pattern = detectActivityPattern(notes);
    if (pattern === 'fastChange') {
      finalWindowSize = Math.min(finalWindowSize, 5000);
    } else if (pattern === 'slowChange') {
      finalWindowSize = Math.max(finalWindowSize, 20000);
    }
  } else if (!finalWindowSize) {
    finalWindowSize = 10000;
  }

  return await aggregateTemporalNotes(notes, {
    windowSize: finalWindowSize,
    decayFactor,
    coherenceThreshold
  });
}
