/**
 * Temporal Note Pruner
 * 
 * Prunes irrelevant or low-weight notes to keep prompt context manageable.
 * 
 * Research context:
 * - Temporal aggregation research shows older notes should decay
 * - Attention-based weighting shows some notes are more relevant than others
 * - Context compression research shows pruning improves efficiency
 * 
 * This implements note pruning based on:
 * - Recency (exponential decay)
 * - Relevance (salience, action, novelty)
 * - Weight thresholds
 */

// Import calculateAttentionWeight directly (now exported from temporal-decision.mjs)
import { calculateAttentionWeight } from './temporal-decision.mjs';

/**
 * Prune temporal notes based on relevance and weight
 * 
 * @param {import('./index.mjs').TemporalNote[]} notes - Temporal notes
 * @param {Object} options - Pruning options
 * @param {number} [options.maxNotes=10] - Maximum notes to keep
 * @param {number} [options.minWeight=0.1] - Minimum weight threshold
 * @param {number} [options.currentTime] - Current time (default: Date.now())
 * @param {number} [options.windowSize=10000] - Window size for weight calculation
 * @returns {import('./index.mjs').TemporalNote[]} Pruned notes
 */
export function pruneTemporalNotes(notes, options = {}) {
  const {
    maxNotes = 10,
    minWeight = 0.1,
    currentTime = Date.now(),
    windowSize = 10000
  } = options;

  if (notes.length === 0) return [];

  const startTime = notes[0].timestamp || currentTime;

  // Calculate weights for all notes
  const weightedNotes = notes.map(note => {
    const elapsed = note.elapsed || (note.timestamp - startTime);
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

  // Filter by minimum weight
  const aboveThreshold = weightedNotes.filter(w => w.weight >= minWeight);

  // Sort by weight (descending)
  const sorted = aboveThreshold.sort((a, b) => b.weight - a.weight);

  // Take top N
  const pruned = sorted.slice(0, maxNotes).map(w => w.note);

  return pruned;
}

/**
 * Calculate relevance score for a note
 */
function calculateRelevance(note, currentTime, startTime) {
  let relevance = 1.0;

  // Recency (exponential decay)
  const age = currentTime - (note.timestamp || startTime);
  const recency = Math.pow(0.9, age / 10000); // Decay over 10s
  relevance *= recency;

  // Salience (importance)
  const score = note.score || note.gameState?.score || 5;
  if (score >= 8 || score <= 2) {
    relevance *= 1.5; // High/low scores are more relevant
  }

  // Issues increase relevance
  if (note.issues && note.issues.length > 0) {
    relevance *= 1.2;
  }

  // User actions increase relevance
  if (note.step?.includes('interaction') || note.step?.includes('click')) {
    relevance *= 1.3;
  }

  // Context changes increase relevance
  if (note.observation?.includes('change') || note.observation?.includes('new')) {
    relevance *= 1.2;
  }

  return relevance;
}

/**
 * Propagate notes forward with decay
 * 
 * @param {import('./index.mjs').TemporalNote[]} notes - Temporal notes
 * @param {Object} options - Propagation options
 * @param {number} [options.currentTime] - Current time
 * @param {number} [options.relevanceThreshold=0.2] - Minimum relevance to keep
 * @returns {import('./index.mjs').TemporalNote[]} Propagated notes with updated weights
 */
export function propagateNotes(notes, options = {}) {
  const {
    currentTime = Date.now(),
    relevanceThreshold = 0.2
  } = options;

  if (notes.length === 0) return [];

  const startTime = notes[0].timestamp || currentTime;

  return notes
    .map(note => {
      const relevance = calculateRelevance(note, currentTime, startTime);
      const weight = Math.pow(0.9, (currentTime - (note.timestamp || startTime)) / 10000);

      return {
        ...note,
        weight,
        relevance,
        propagated: true
      };
    })
    .filter(note => note.relevance >= relevanceThreshold)
    .sort((a, b) => b.relevance - a.relevance);
}

/**
 * Select top-weighted notes for prompt inclusion
 * 
 * @param {import('./index.mjs').TemporalNote[]} notes - Temporal notes
 * @param {Object} options - Selection options
 * @param {number} [options.topN=5] - Number of top notes to select
 * @returns {import('./index.mjs').TemporalNote[]} Top-weighted notes
 */
export function selectTopWeightedNotes(notes, options = {}) {
  const { topN = 5 } = options;

  if (notes.length === 0) return [];

  const currentTime = Date.now();
  const startTime = notes[0].timestamp || currentTime;

  const weighted = notes.map(note => {
    const elapsed = note.elapsed || (note.timestamp - startTime);
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
 * @param {Array<{path: string, timestamp: number, elapsed?: number}>} screenshots - Screenshot array
 * @param {Array<Object>} evaluations - Corresponding evaluation results
 * @param {Object} options - Selection options
 * @param {number} [options.maxScreenshots=10] - Maximum screenshots to select
 * @param {string} [options.strategy='diversity'] - 'diversity', 'keyframes', 'uniform'
 * @returns {Array} Selected screenshots
 */
export function selectRepresentativeScreenshots(screenshots, evaluations = [], options = {}) {
  const {
    maxScreenshots = 10,
    strategy = 'diversity'
  } = options;

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

/**
 * Select keyframes (significant state changes)
 */
function selectKeyframes(screenshots, evaluations, maxScreenshots) {
  const keyframes = [screenshots[0]]; // Always include first

  // Detect significant state changes
  for (let i = 1; i < evaluations.length; i++) {
    const prevScore = evaluations[i-1]?.score ?? 0;
    const currScore = evaluations[i]?.score ?? 0;
    const scoreChange = Math.abs(currScore - prevScore);

    if (scoreChange > 2.0) { // Significant change threshold
      keyframes.push(screenshots[i]);
    }
  }

  keyframes.push(screenshots[screenshots.length - 1]); // Always include last

  // If still too many, sample uniformly
  if (keyframes.length > maxScreenshots) {
    return sampleUniform(keyframes, maxScreenshots);
  }

  return keyframes;
}

/**
 * Select by diversity (maximize visual difference)
 */
function selectByDiversity(screenshots, evaluations, maxScreenshots) {
  const selected = [screenshots[0]]; // Always include first
  const remaining = screenshots.slice(1, -1);
  const last = screenshots[screenshots.length - 1];

  // Calculate score variance for diversity
  const scores = evaluations.map(e => e.score ?? 0).filter(s => s !== null);
  if (scores.length === 0) {
    return selectUniform(screenshots, maxScreenshots);
  }

  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.map(s => Math.abs(s - mean));

  // Select indices with highest variance (most different states)
  const indexed = variance.map((v, i) => ({ index: i, variance: v }));
  indexed.sort((a, b) => b.variance - a.variance);

  const diverseIndices = indexed.slice(0, maxScreenshots - 2).map(item => item.index);
  selected.push(...diverseIndices.map(i => remaining[i]).filter(Boolean));
  selected.push(last);

  return selected.slice(0, maxScreenshots);
}

/**
 * Select uniformly spaced screenshots
 */
function selectUniform(screenshots, maxScreenshots) {
  const step = Math.floor(screenshots.length / maxScreenshots);
  const selected = [];

  for (let i = 0; i < screenshots.length; i += step) {
    selected.push(screenshots[i]);
    if (selected.length >= maxScreenshots) break;
  }

  // Always include last
  if (selected[selected.length - 1] !== screenshots[screenshots.length - 1]) {
    selected[selected.length - 1] = screenshots[screenshots.length - 1];
  }

  return selected;
}

/**
 * Sample uniformly from array
 */
function sampleUniform(array, count) {
  const step = Math.floor(array.length / count);
  const sampled = [];
  for (let i = 0; i < array.length; i += step) {
    sampled.push(array[i]);
    if (sampled.length >= count) break;
  }
  return sampled;
}

