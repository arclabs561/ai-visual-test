/**
 * Temporal Core
 *
 * Foundation module for all temporal functionality:
 * - Constants (TIME_SCALES, MULTI_SCALE_WINDOWS, etc.)
 * - Context utilities (create, merge, extract)
 * - Core aggregation (aggregateTemporalNotes)
 * - Coherence analysis and conflict detection
 * - Temporal graph building
 * - Prompt formatting (formatNotesForPrompt)
 *
 * Consolidated from: temporal.mjs, temporal-constants.mjs, temporal-context.mjs
 *
 * Dependency direction: this is the foundation -- no imports from other temporal-* files.
 */

import { TEMPORAL_CONSTANTS } from './constants.mjs';

/** A timestamped observation used by aggregation and graph construction. */
export interface TemporalNote {
  timestamp?: number;
  elapsed?: number;
  score?: number;
  observation?: string;
  assessment?: string;
  reasoning?: string;
  step?: string;
  issues?: unknown[];
  gameState?: { score?: number; [key: string]: unknown } | null;
  [key: string]: unknown;
}

export interface WeightedTemporalNote extends TemporalNote {
  weight: number;
}

export interface TemporalWindowSummary {
  window: number;
  startTime: number;
  endTime: number;
  notes: WeightedTemporalNote[];
  timeRange: string;
  noteCount: number;
  avgScore: number;
  observations: string;
  weightedAvg: number;
}

export interface TemporalConflict {
  window: number;
  type: 'mixed_sentiment' | 'score_decrease';
  observation?: string;
  previousScore?: number;
  currentScore?: number;
}

export interface AggregatedTemporalNotes {
  windows: TemporalWindowSummary[];
  summary: string;
  coherence: number;
  conflicts: TemporalConflict[];
  totalNotes: number;
  timeSpan: number;
}

export interface TemporalAggregationOptions {
  windowSize?: number;
  decayFactor?: number;
  coherenceThreshold?: number;
  decayMethod?: 'exponential' | 'logarithmic';
  temporalReference?: number;
  totalNoteCount?: number;
  [key: string]: unknown;
}

export interface TemporalContextOptions {
  sequentialContext?: unknown;
  viewport?: unknown;
  testType?: unknown;
  enableBiasMitigation?: boolean;
  attentionLevel?: string;
  actionComplexity?: string;
  persona?: unknown;
  contentLength?: number;
  [key: string]: unknown;
}

/** The normalized shape created by createTemporalContext. */
export interface TemporalContext {
  [key: string]: unknown;
  sequentialContext: unknown | null | undefined;
  viewport: unknown | null | undefined;
  testType: unknown | null | undefined;
  enableBiasMitigation: boolean | undefined;
  attentionLevel: string | undefined;
  actionComplexity: string | undefined;
  persona: unknown | null | undefined;
  contentLength: number | undefined;
}

export interface ExtractedTemporalContext {
  sequentialContext: unknown | undefined;
  attentionLevel: string | undefined;
  actionComplexity: string | undefined;
  persona: unknown | undefined;
  contentLength: number | undefined;
}

export interface TemporalGraphOptions extends TemporalAggregationOptions {
  useLLM?: boolean;
  frequency?: number;
  maxLatency?: number;
}

export interface TemporalState {
  avgScore: number;
  scoreVariance: number;
  issues: unknown[];
}

export interface TemporalGraphNode {
  id: string;
  index: number;
  startTime: number;
  endTime: number;
  avgScore: number;
  notes: WeightedTemporalNote[];
  entities: string[];
  state: TemporalState;
}

export interface TemporalGraphEdge {
  from: string;
  to: string;
  timeDelta: number;
  stateContinuity: number;
  entityContinuity: number;
  coherence: number;
}

export interface EntityTracking {
  firstSeen: number;
  lastSeen: number;
  appearances: number[];
  continuity: number;
}

export interface TemporalGraph {
  nodes: TemporalGraphNode[];
  edges: TemporalGraphEdge[];
  entities: Record<string, EntityTracking>;
  averageCoherence: number;
  lowCoherenceEdges: number;
}

export interface TemporalGraphResult extends AggregatedTemporalNotes {
  graph: TemporalGraph;
  recommendations: string[];
}

// ============================================================================
// TEMPORAL CONSTANTS (from temporal-constants.mjs)
// ============================================================================

// Time Scales (based on research: NN/g, PMC, Lindgaard)
export const TIME_SCALES = {
  INSTANT: 100,           // 0.1s - perceived instant, direct manipulation threshold (NN/g)
  VISUAL_DECISION: 50,    // 50ms - visual appeal decision (Lindgaard research)
  QUICK: 1000,            // 1s - noticeable delay (NN/g)
  NORMAL: 3000,           // 3s - normal interaction
  EXTENDED: 10000,        // 10s - extended focus (NN/g)
  LONG: 60000             // 60s - deep evaluation
};

// Multi-Scale Windows
export const MULTI_SCALE_WINDOWS = {
  immediate: TIME_SCALES.INSTANT,
  short: TIME_SCALES.QUICK,
  medium: TIME_SCALES.EXTENDED,
  long: TIME_SCALES.LONG
};

// Reading Speeds (words per minute)
export const READING_SPEEDS = {
  SCANNING: 300,    // Fast scanning
  NORMAL: 250,      // Average reading
  DEEP: 200         // Deep reading
};

// Attention Multipliers
export const ATTENTION_MULTIPLIERS = {
  focused: 0.8,      // Faster when focused (reduced cognitive load)
  normal: 1.0,
  distracted: 1.5    // Slower when distracted (increased cognitive load)
};

// Complexity Multipliers
export const COMPLEXITY_MULTIPLIERS = {
  simple: 0.7,       // Simple actions are faster
  normal: 1.0,
  complex: 1.5        // Complex actions take longer
};

// Confidence Thresholds
export const CONFIDENCE_THRESHOLDS = {
  HIGH_VARIANCE: 1.0,    // Variance < 1.0 = high confidence
  MEDIUM_VARIANCE: 2.0,   // Variance < 2.0 = medium confidence
  LOW_VARIANCE: 2.0       // Variance >= 2.0 = low confidence
};

// Time Bounds
export const TIME_BOUNDS = {
  MIN_PERCEPTION: 100,        // Minimum perception time (0.1s)
  MIN_READING_SHORT: 1000,     // Minimum reading time for short content
  MIN_READING_LONG: 2000,      // Minimum reading time for long content
  MAX_READING_SHORT: 15000,    // Maximum reading time for short content
  MAX_READING_LONG: 30000      // Maximum reading time for long content
};

// Content Length Thresholds
export const CONTENT_THRESHOLDS = {
  SHORT: 100,      // Short content (< 100 chars)
  MEDIUM: 1000,    // Medium content (< 1000 chars)
  LONG: 1000       // Long content (>= 1000 chars)
};

// ============================================================================
// TEMPORAL CONTEXT UTILITIES (from temporal-context.mjs)
// ============================================================================

/**
 * Create standardized temporal context
 */
export function createTemporalContext(options: TemporalContextOptions = {}): TemporalContext {
  return {
    sequentialContext: options.sequentialContext || null,
    viewport: options.viewport || null,
    testType: options.testType || null,
    enableBiasMitigation: options.enableBiasMitigation !== false,
    attentionLevel: options.attentionLevel || 'normal',
    actionComplexity: options.actionComplexity || 'normal',
    persona: options.persona || null,
    contentLength: options.contentLength || 0,
    ...options
  };
}

/**
 * Merge temporal contexts
 */
export function mergeTemporalContext(
  base: TemporalContextOptions,
  additional: TemporalContextOptions,
): TemporalContextOptions {
  return {
    ...base,
    ...additional,
    sequentialContext: additional.sequentialContext || base.sequentialContext,
    // Preserve base values if additional doesn't override
    attentionLevel: additional.attentionLevel || base.attentionLevel || 'normal',
    actionComplexity: additional.actionComplexity || base.actionComplexity || 'normal'
  };
}

/**
 * Extract temporal context from options
 */
export function extractTemporalContext(options: TemporalContextOptions): ExtractedTemporalContext {
  return {
    sequentialContext: options.sequentialContext,
    attentionLevel: options.attentionLevel,
    actionComplexity: options.actionComplexity,
    persona: options.persona,
    contentLength: options.contentLength
  };
}

// ============================================================================
// CORE TEMPORAL AGGREGATION (from temporal.mjs)
// ============================================================================

/**
 * Aggregate notes temporally with coherence analysis
 *
 * @param {TemporalNote[]} notes - Array of temporal notes
 * @param {{
 *   windowSize?: number;
 *   decayFactor?: number;
 *   coherenceThreshold?: number;
 * }} [options={}] - Aggregation options
 * @returns {AggregatedTemporalNotes} Aggregated temporal notes with windows and coherence
 */
export async function aggregateTemporalNotes(
  notes: TemporalNote[],
  options: TemporalAggregationOptions = {},
): Promise<AggregatedTemporalNotes> {
  // Input validation
  if (!Array.isArray(notes)) {
    throw new TypeError('Notes must be an array');
  }

  // Validate options
  const {
    windowSize = TEMPORAL_CONSTANTS.DEFAULT_WINDOW_SIZE_MS,
    decayFactor = TEMPORAL_CONSTANTS.DEFAULT_DECAY_FACTOR,
    coherenceThreshold = TEMPORAL_CONSTANTS.DEFAULT_COHERENCE_THRESHOLD
  } = options;

  // Validate windowSize
  if (windowSize <= 0 || !isFinite(windowSize)) {
    throw new RangeError(`windowSize must be a positive finite number, got: ${windowSize}`);
  }

  // Validate decayFactor
  if (decayFactor <= 0 || decayFactor > 1 || !isFinite(decayFactor)) {
    throw new RangeError(`decayFactor must be in (0, 1], got: ${decayFactor}`);
  }

  // Validate coherenceThreshold
  if (coherenceThreshold < 0 || coherenceThreshold > 1 || !isFinite(coherenceThreshold)) {
    throw new RangeError(`coherenceThreshold must be in [0, 1], got: ${coherenceThreshold}`);
  }

  // Filter and sort notes by timestamp
  const validNotes = notes
    .filter(n => {
      if (!n || typeof n !== 'object') return false;
      const hasTimestamp = typeof n.timestamp === 'number' && isFinite(n.timestamp);
      const hasElapsed = typeof n.elapsed === 'number' && isFinite(n.elapsed);
      return hasTimestamp || hasElapsed;
    })
    .sort((a, b) => {
      const timeA = a.timestamp ?? a.elapsed ?? 0;
      const timeB = b.timestamp ?? b.elapsed ?? 0;
      return timeA - timeB;
    });

  const gameplayNotes = validNotes;

  if (gameplayNotes.length === 0) {
    return {
      windows: [],
      summary: 'No gameplay notes available',
      coherence: 1.0,
      conflicts: [],
      totalNotes: 0,
      timeSpan: 0
    };
  }

  // Group notes into temporal windows
  const windows: Array<{
    index: number;
    startTime: number;
    endTime: number;
    notes: WeightedTemporalNote[];
    weightedScore: number;
    totalWeight: number;
  } | undefined> = [];
  const startTime = gameplayNotes[0]!.timestamp ?? Date.now();

  for (let i = 0; i < gameplayNotes.length; i++) {
    const note = gameplayNotes[i]!;
    const elapsed = note.elapsed || (note.timestamp! - startTime);
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

    const age = elapsed;
    const decayMethod = options.decayMethod || 'exponential';
    const temporalReference = options.temporalReference || startTime;

    let weight;
    if (decayMethod === 'logarithmic') {
      const refOffset = temporalReference - startTime;
      const distanceFromRef = Math.max(1, Math.abs(age - refOffset));
      const logDistance = Math.log(distanceFromRef + 1);
      const maxLogDistance = Math.log(windowSize * 10 + 1);
      const compressedDistance = maxLogDistance > 0 ? logDistance / maxLogDistance : 0;
      weight = Math.max(0, Math.min(1, 1 - compressedDistance));
    } else {
      weight = Math.pow(decayFactor, age / windowSize);
    }

    const window = windows[windowIndex]!;

    window.notes.push({
      ...note,
      weight
    });

    const score = note.gameState?.score ?? note.score ?? 0;
    window.weightedScore += score * weight;
    window.totalWeight += weight;
  }

  // Calculate window summaries
  const definedWindows = windows.filter((window): window is NonNullable<typeof window> => window !== undefined);
  const windowSummaries = definedWindows.map(window => {
    const avgScore = window.totalWeight > 0 && isFinite(window.totalWeight)
      ? window.weightedScore / window.totalWeight
      : 0;

    const observations = window.notes
      .map(n => {
        const obs = n.observation || n.assessment || '';
        return typeof obs === 'string' ? obs.trim() : '';
      })
      .filter(obs => obs.length > 0)
      .join('; ');

    return {
      window: window.index,
      // Graph consumers need the absolute bounds and the weighted source notes,
      // not just their display-oriented summary.
      startTime: window.startTime,
      endTime: window.endTime,
      notes: window.notes,
      timeRange: `${Math.round((window.startTime - startTime) / 1000)}s-${Math.round((window.endTime - startTime) / 1000)}s`,
      noteCount: window.notes.length,
      avgScore: Math.round(avgScore),
      observations,
      weightedAvg: window.totalWeight > 0 && isFinite(window.totalWeight)
        ? window.weightedScore / window.totalWeight
        : 0
    };
  });

  // Coherence analysis
  const coherence = await calculateCoherence(windowSummaries, { ...options, totalNoteCount: gameplayNotes.length });
  const conflicts = detectConflicts(windowSummaries);

  // Generate summary
  const summary = generateSummary(windowSummaries, coherence, conflicts);

  const firstNote = gameplayNotes[0];
  const lastNote = gameplayNotes[gameplayNotes.length - 1];
  const firstElapsed = firstNote?.elapsed ?? (firstNote?.timestamp ? firstNote.timestamp - startTime : 0);
  const lastElapsed = lastNote?.elapsed ?? (lastNote?.timestamp ? lastNote.timestamp - startTime : 0);
  const timeSpan = lastElapsed - firstElapsed;

  return {
    windows: windowSummaries,
    summary,
    coherence,
    conflicts,
    totalNotes: gameplayNotes.length,
    timeSpan: Math.max(0, timeSpan)
  };
}

/**
 * Calculate coherence score (0-1)
 */
async function calculateCoherence(
  windows: Array<Pick<TemporalWindowSummary, 'avgScore' | 'observations'>>,
  options: Record<string, unknown> | null = {},
): Promise<number> {
  if (!Array.isArray(windows)) {
    throw new TypeError('windows must be an array');
  }

  if (options !== null && typeof options !== 'object') {
    throw new TypeError('options must be an object');
  }

  if (windows.length < 2) return 1.0;

  const scores = windows.map(w => w.avgScore).filter(s => !isNaN(s) && isFinite(s));
  if (scores.length < 2) return 1.0;

  const trends = [];
  for (let i = 1; i < scores.length; i++) {
    const change = scores[i]! - scores[i - 1]!;
    trends.push(change >= 0 ? 1 : -1);
  }

  let directionChanges = 0;
  for (let i = 1; i < trends.length; i++) {
    if (trends[i] !== trends[i - 1]) {
      directionChanges++;
    }
  }

  const trendsLength = Math.max(1, trends.length);
  const directionConsistency = Math.max(0, Math.min(1, 1.0 - (directionChanges / trendsLength)));

  const meanScore = scores.reduce((a, b) => a + b, 0) / scores.length;

  const variance = scores.reduce((sum, score) => {
    const diff = score - meanScore;
    return sum + diff * diff;
  }, 0) / scores.length;

  const scoreMin = Math.min(...scores);
  const scoreMax = Math.max(...scores);
  const scoreRange = Math.max(0, scoreMax - scoreMin);

  const rangeHalf = scoreRange / 2;
  const meanHalf = meanScore * 0.5;
  const maxVariance = Math.max(
    rangeHalf * rangeHalf,
    meanHalf * meanHalf,
    10
  );

  const varianceCoherence = maxVariance > 0 && isFinite(maxVariance)
    ? Math.max(0, Math.min(1, 1.0 - (variance / maxVariance)))
    : 1.0;

  const directionChangePenalty = directionChanges / trendsLength;
  const adjustedVarianceCoherence = Math.max(0, Math.min(1, varianceCoherence * (1.0 - directionChangePenalty * 0.7)));

  const stability = Math.max(0, Math.min(1, 1.0 - (directionChanges / trendsLength)));

  let observationConsistency = 1.0;
  if (windows.length > 1) {
    const observations = windows.map(w => (w.observations || '').trim());
    const keywords = observations.map(obs => {
      const words = obs.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      return new Set(words);
    });

    let overlapSum = 0;
    for (let i = 1; i < keywords.length; i++) {
      const prev = keywords[i - 1];
      const curr = keywords[i];
      if (prev && curr && prev.size > 0 && curr.size > 0) {
        const intersection = new Set([...prev].filter(x => curr.has(x)));
        const union = new Set([...prev, ...curr]);
        const overlap = union.size > 0 ? intersection.size / union.size : 0;
        overlapSum += overlap;
      }
    }
    observationConsistency = Math.max(0, Math.min(1, overlapSum / Math.max(1, keywords.length - 1)));
  }

  const coherence = (
    directionConsistency * 0.35 +
    stability * 0.25 +
    adjustedVarianceCoherence * 0.25 +
    observationConsistency * 0.15
  );

  if (!isFinite(coherence) || isNaN(coherence)) {
    import('./logger.mjs').then(({ warn }) => {
      warn('[temporal-core.mjs] Invalid coherence value, defaulting to 0.5:', {
        coherence,
        directionConsistency,
        stability,
        adjustedVarianceCoherence,
        observationConsistency
      });
    }).catch(() => {});
    return 0.5;
  }
  return Math.max(0, Math.min(1, coherence));
}

/**
 * Detect conflicting opinions
 */
function detectConflicts(windows: TemporalWindowSummary[]): TemporalConflict[] {
  const conflicts: TemporalConflict[] = [];

  const observations = windows.map(w => (w.observations || '').toLowerCase());

  const positiveWords = ['good', 'great', 'excellent', 'smooth', 'responsive', 'clear'];
  const negativeWords = ['bad', 'poor', 'slow', 'laggy', 'unclear', 'confusing'];

  for (let i = 0; i < observations.length; i++) {
    const obs = observations[i] || '';
    const hasPositive = positiveWords.some(w => obs.includes(w));
    const hasNegative = negativeWords.some(w => obs.includes(w));

    if (hasPositive && hasNegative) {
      const window = windows[i]!;
      conflicts.push({
        window: window.window,
        type: 'mixed_sentiment',
        observation: window.observations
      });
    }
  }

  for (let i = 1; i < windows.length; i++) {
    const current = windows[i]!;
    const previous = windows[i - 1]!;
    if (current.avgScore !== undefined && previous.avgScore !== undefined &&
        current.avgScore < previous.avgScore) {
      conflicts.push({
        window: current.window,
        type: 'score_decrease',
        previousScore: previous.avgScore,
        currentScore: current.avgScore
      });
    }
  }

  return conflicts;
}

/**
 * Generate human-readable summary
 */
function generateSummary(
  windows: TemporalWindowSummary[],
  coherence: number,
  conflicts: TemporalConflict[],
): string {
  const parts: string[] = [];

  parts.push(`Aggregated ${windows.length} temporal windows from gameplay notes.`);

  if (windows.length > 0) {
    const firstWindow = windows[0];
    const lastWindow = windows[windows.length - 1];
    const firstScore = firstWindow?.avgScore ?? 0;
    const lastScore = lastWindow?.avgScore ?? 0;
    parts.push(`Score progression: ${firstScore} → ${lastScore} (${lastScore - firstScore > 0 ? '+' : ''}${lastScore - firstScore}).`);
  }

  parts.push(`Temporal coherence: ${(coherence * 100).toFixed(0)}% ${coherence > 0.7 ? '(high)' : coherence > 0.4 ? '(moderate)' : '(low)'}.`);

  if (conflicts.length > 0) {
    parts.push(`Detected ${conflicts.length} potential conflict${conflicts.length > 1 ? 's' : ''}: ${conflicts.map(c => c.type).join(', ')}.`);
  }

  return parts.join(' ');
}

/**
 * Format aggregated temporal notes for prompt inclusion
 *
 * @param {AggregatedTemporalNotes} aggregated - Aggregated temporal notes
 * @returns {string} Formatted string for prompt inclusion
 */
export function formatNotesForPrompt(aggregated: AggregatedTemporalNotes): string {
  const parts: string[] = [];

  parts.push('TEMPORAL AGGREGATION ANALYSIS:');
  parts.push(aggregated.summary);
  parts.push('');

  if (aggregated.windows.length > 0) {
    parts.push('Temporal Windows:');
    aggregated.windows.forEach(window => {
      parts.push(`  [${window.timeRange}] Score: ${window.avgScore}, Notes: ${window.noteCount}`);
      if (window.observations) {
        parts.push(`    Observations: ${window.observations.substring(0, 100)}${window.observations.length > 100 ? '...' : ''}`);
      }
    });
    parts.push('');
  }

  if (aggregated.conflicts.length > 0) {
    parts.push('Coherence Issues:');
    aggregated.conflicts.forEach(conflict => {
      parts.push(`  - ${conflict.type}: ${JSON.stringify(conflict)}`);
    });
    parts.push('');
  }

  parts.push(`Overall Coherence: ${(aggregated.coherence * 100).toFixed(0)}%`);

  return parts.join('\n');
}

/**
 * Calculate coherence score for temporal windows (exported wrapper)
 *
 * @param {TemporalWindowSummary[]} windows - Array of temporal windows
 * @returns {number} Coherence score (0-1)
 */
export async function calculateCoherenceExported(
  windows: Array<Pick<TemporalWindowSummary, 'avgScore' | 'observations'>>,
): Promise<number> {
  return await calculateCoherence(windows);
}

// ============================================================================
// TEMPORAL GRAPH (from temporal.mjs)
// ============================================================================

/**
 * Build temporal graph representation for better coherence
 *
 * @param {TemporalNote[]} notes - Temporal notes
 * @param {Object} options - Graph options
 * @returns {Object} Temporal graph with nodes, edges, entities
 */
export async function buildTemporalGraph(
  notes: TemporalNote[],
  options: TemporalGraphOptions = {},
): Promise<TemporalGraphResult> {
  const aggregated = await aggregateTemporalNotes(notes, options);

  const nodes = await Promise.all(aggregated.windows.map(async (window, index) => ({
    id: `window_${index}`,
    index,
    startTime: window.startTime,
    endTime: window.endTime,
    avgScore: window.avgScore,
    notes: window.notes,
    entities: await extractEntities(window.notes, options),
    state: extractState(window.notes)
  })));

  const edges: TemporalGraphEdge[] = [];
  for (let i = 1; i < nodes.length; i++) {
    const from = nodes[i - 1]!;
    const to = nodes[i]!;

    const stateContinuity = calculateStateContinuity(from.state, to.state);
    const entityContinuity = calculateEntityContinuity(from.entities, to.entities);

    edges.push({
      from: from.id,
      to: to.id,
      timeDelta: to.startTime - from.startTime,
      stateContinuity,
      entityContinuity,
      coherence: (stateContinuity + entityContinuity) / 2
    });
  }

  const entityTracking = trackEntities(nodes);

  return {
    ...aggregated,
    graph: {
      nodes,
      edges,
      entities: entityTracking,
      averageCoherence: edges.length > 0
        ? edges.reduce((sum, e) => sum + e.coherence, 0) / edges.length
        : 1.0,
      lowCoherenceEdges: edges.filter(e => e.coherence < 0.5).length
    },
    recommendations: generateGraphRecommendations(edges, entityTracking)
  };
}

// Simple in-memory cache for LLM entity extraction results
const entityExtractionCache = new Map<string, { entities: string[]; timestamp: number }>();
const ENTITY_CACHE_TTL = 3600000; // 1 hour

async function extractEntities(notes: WeightedTemporalNote[], options: TemporalGraphOptions = {}): Promise<string[]> {
  if (!notes || !Array.isArray(notes)) {
    return [];
  }

  const { useLLM, frequency, maxLatency } = options;
  const shouldUseLLM = useLLM !== undefined
    ? useLLM
    : !((frequency ?? 0) >= 10 || (maxLatency && maxLatency < 200));

  if (!shouldUseLLM) {
    return extractEntitiesKeyword(notes);
  }

  try {
    const { extractStructuredData } = await import('./data-extractor.mjs');
    const { createConfig } = await import('./config.mjs');

    const config = createConfig();
    if (!config.enabled) {
      return extractEntitiesKeyword(notes);
    }

    const combinedText = notes
      .map(n => `${n.observation || ''} ${n.reasoning || ''} ${n.step || ''}`)
      .filter(Boolean)
      .join(' ');

    if (!combinedText.trim()) {
      return extractEntitiesKeyword(notes);
    }

    const { createHash } = await import('crypto');
    const cacheKey = createHash('sha256').update(combinedText).digest('hex');
    const cached = entityExtractionCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < ENTITY_CACHE_TTL) {
      return cached.entities;
    }

    const schema = {
      entities: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of UI entities, game elements, or interactive components mentioned in the notes (e.g., "button", "score", "level", "board", "player", "enemy")'
      }
    };

    const extracted = await extractStructuredData(combinedText, schema, {
      fallback: 'auto',
      provider: config.provider
    }) as { entities?: unknown[] } | null;

    if (extracted && Array.isArray(extracted.entities) && extracted.entities.length > 0) {
      const entities = [...new Set(extracted.entities.filter((entity): entity is string => typeof entity === 'string'))];
      if (entities.length > 0) {
        entityExtractionCache.set(cacheKey, {
          entities,
          timestamp: Date.now()
        });
        if (entityExtractionCache.size > 1000) {
          const now = Date.now();
          for (const [key, value] of entityExtractionCache.entries()) {
            if (now - value.timestamp > ENTITY_CACHE_TTL) {
              entityExtractionCache.delete(key);
            }
          }
        }
        return entities;
      }
    }
  } catch {
    // Circuit breaker: Fallback to keyword matching on any LLM error
  }

  return extractEntitiesKeyword(notes);
}

function extractEntitiesKeyword(notes: WeightedTemporalNote[]): string[] {
  const entities = new Set<string>();
  const keywordPattern = /\b(button|link|image|form|input|score|level|board|tile|page|element|player|enemy|obstacle|powerup|collectible|ui|menu|dialog|modal|overlay)\b/g;

  for (const note of notes) {
    const text = (note.observation || note.reasoning || note.step || '').toLowerCase();
    if (!text) continue;
    keywordPattern.lastIndex = 0;
    let match;
    while ((match = keywordPattern.exec(text)) !== null) {
      entities.add(match[0]!);
    }
  }

  return Array.from(entities);
}

function extractState(notes: WeightedTemporalNote[]): TemporalState {
  if (!notes || !Array.isArray(notes)) {
    return {
      avgScore: 0,
      scoreVariance: 0,
      issues: []
    };
  }
  const scores = notes.map(n => n.score ?? n.gameState?.score ?? 0);
  const issues = notes.flatMap(n => n.issues || []);
  return {
    avgScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
    scoreVariance: calculateVarianceForState(scores),
    issues: [...new Set(issues)]
  };
}

function calculateStateContinuity(state1: TemporalState, state2: TemporalState): number {
  const scoreDiff = Math.abs(state1.avgScore - state2.avgScore);
  const scoreContinuity = 1.0 - Math.min(1.0, scoreDiff / 10.0);

  const issues1 = new Set(state1.issues);
  const issues2 = new Set(state2.issues);
  const intersection = new Set([...issues1].filter(x => issues2.has(x)));
  const union = new Set([...issues1, ...issues2]);
  const issueContinuity = union.size > 0 ? intersection.size / union.size : 1.0;

  return (scoreContinuity + issueContinuity) / 2;
}

function calculateEntityContinuity(entities1: string[], entities2: string[]): number {
  if (entities1.length === 0 && entities2.length === 0) return 1.0;
  if (entities1.length === 0 || entities2.length === 0) return 0.0;

  const set1 = new Set(entities1);
  const set2 = new Set(entities2);
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return union.size > 0 ? intersection.size / union.size : 0.0;
}

function trackEntities(nodes: TemporalGraphNode[]): Record<string, EntityTracking> {
  const entityMap = new Map<string, EntityTracking>();

  for (const node of nodes) {
    for (const entity of node.entities) {
      if (!entityMap.has(entity)) {
        entityMap.set(entity, {
          firstSeen: node.index,
          lastSeen: node.index,
          appearances: [node.index],
          continuity: 1.0,
        });
      } else {
        const tracking = entityMap.get(entity);
        if (!tracking) continue;
        tracking.lastSeen = node.index;
        tracking.appearances.push(node.index);
      }
    }
  }

  for (const [entity, tracking] of entityMap.entries()) {
    const gaps = [];
    for (let i = 1; i < tracking.appearances.length; i++) {
      gaps.push(tracking.appearances[i]! - tracking.appearances[i - 1]!);
    }
    const avgGap = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 1;
    tracking.continuity = avgGap === 1 ? 1.0 : Math.max(0, 1.0 - (avgGap - 1) * 0.2);
  }

  return Object.fromEntries(entityMap);
}

function generateGraphRecommendations(
  edges: TemporalGraphEdge[],
  _entities: Record<string, EntityTracking>,
): string[] {
  const recommendations: string[] = [];
  const avgCoherence = edges.length > 0
    ? edges.reduce((sum, e) => sum + e.coherence, 0) / edges.length
    : 1.0;

  if (avgCoherence < 0.6) {
    recommendations.push('Low temporal coherence detected. Consider reducing sequence length or increasing capture frequency.');
  }

  const lowCoherenceCount = edges.filter(e => e.coherence < 0.5).length;
  if (lowCoherenceCount > edges.length * 0.3) {
    recommendations.push('Many low-coherence transitions. Validate that screenshots represent continuous browser automation.');
  }

  return recommendations;
}

function calculateVarianceForState(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
}
