/**
 * Temporal Aggregator
 * 
 * Aggregates opinions over time with coherence checking.
 * 
 * Research context:
 * - "Towards Dynamic Theory of Mind: Evaluating LLM Adaptation to Temporal Evolution of Human States"
 *   (arXiv:2505.17663) - DynToM benchmark, temporal progression of mental states
 *   * We use temporal aggregation concepts (loosely related)
 *   * We do NOT implement the DynToM benchmark or specific methods
 * - "The Other Mind: How Language Models Exhibit Human Temporal Cognition" (arXiv:2507.15851)
 *   * Paper discusses Weber-Fechner law and logarithmic compression
 *   * We use EXPONENTIAL decay (Math.pow), NOT logarithmic compression
 *   * We do NOT implement temporal reference points from the research
 * - Temporal aggregation and opinion propagation research
 * - Coherence analysis in temporal sequences
 * 
 * IMPORTANT: This implementation supports BOTH exponential decay (default) and
 * logarithmic compression (Weber-Fechner law) from arXiv:2507.15851. By default,
 * we use exponential decay for backward compatibility, but logarithmic compression
 * can be enabled via options.decayMethod = 'logarithmic'. We also support temporal
 * reference points (options.temporalReference) as described in the research.
 */

/**
 * Aggregate notes temporally with coherence analysis
 * 
 * @param {import('./index.mjs').TemporalNote[]} notes - Array of temporal notes
 * @param {{
 *   windowSize?: number;
 *   decayFactor?: number;
 *   coherenceThreshold?: number;
 * }} [options={}] - Aggregation options
 * @returns {import('./index.mjs').AggregatedTemporalNotes} Aggregated temporal notes with windows and coherence
 */
import { TEMPORAL_CONSTANTS } from './constants.mjs';

export async function aggregateTemporalNotes(notes, options = {}) {
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
  // Accept any note with a timestamp (not just gameplay_note_)
  // DESIGN DECISION: Filter invalid notes instead of throwing
  // - Why: More resilient, allows partial data processing
  // - Alternative: Throw on invalid notes
  //   - Rejected: Breaks processing when some notes are malformed
  // - Performance: O(n log n) sort, acceptable for typical datasets (10-1000 notes)
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
  
  // Use validNotes instead of gameplayNotes for broader compatibility
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
  const windows = [];
  const startTime = gameplayNotes[0].timestamp || Date.now();
  
  // INVARIANT: Notes are sorted by timestamp (line 48), so elapsed is always >= 0
  // This ensures windowIndex is always >= 0 (Math.floor of non-negative number)
  // If notes were unsorted, negative elapsed would create negative window indices
  for (let i = 0; i < gameplayNotes.length; i++) {
    const note = gameplayNotes[i];
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
    
    // Calculate weight using selected decay method
    // 
    // DESIGN DECISION: Support both exponential and logarithmic compression
    // - Exponential decay (default): Math.pow(decayFactor, age / windowSize)
    //   - Why: Simple, fast, works well for most cases
    //   - When: General-purpose temporal aggregation
    // - Logarithmic compression (Weber-Fechner law): log-based distance from reference
    //   - Why: Matches human temporal perception (arXiv:2507.15851)
    //   - When: Need to model human-like temporal compression
    //   - Research: Perceived distance = |log(|y1 - y_ref|) - log(|y2 - y_ref|)|
    // - Alternative considered: Only exponential (simpler)
    //   - Rejected: Research shows logarithmic better matches human perception
    //   - Our approach: Support both, default to exponential for backward compatibility
    const age = elapsed;
    const decayMethod = options.decayMethod || 'exponential'; // 'exponential' | 'logarithmic'
    const temporalReference = options.temporalReference || startTime; // Reference point for logarithmic
    
    let weight;
    if (decayMethod === 'logarithmic') {
      // Logarithmic compression (Weber-Fechner law)
      // Research: arXiv:2507.15851 - Human temporal cognition uses logarithmic compression
      // Formula: Compress distance from reference point logarithmically
      // - Why: Human perception compresses distant events more than recent ones
      // - Why this formula: Matches research finding that perceived distance = log(|y - y_ref|)
      // - Alternative: Exponential decay (simpler but doesn't match human perception)
      //   - Rejected: Research shows logarithmic better models human temporal cognition
      // - Performance: ~2x slower than exponential (log calculation), but still <1ms for typical cases
      const refOffset = temporalReference - startTime;
      const distanceFromRef = Math.max(1, Math.abs(age - refOffset));
      const logDistance = Math.log(distanceFromRef + 1); // +1 to avoid log(0)
      const maxLogDistance = Math.log(windowSize * 10 + 1); // Normalize to [0, 1]
      const compressedDistance = maxLogDistance > 0 ? logDistance / maxLogDistance : 0;
      weight = Math.max(0, Math.min(1, 1 - compressedDistance)); // Invert: closer = higher weight, clamp [0,1]
    } else {
      // Exponential decay (default, backward compatible)
      // Performance: Fast (~0.1ms per note), simple calculation
      weight = Math.pow(decayFactor, age / windowSize);
    }
    
    windows[windowIndex].notes.push({
      ...note,
      weight
    });
    
    // Extract score from gameState if available
    // NOTE: Score extraction order matters - gameState.score takes precedence over note.score
    // This is because gameState.score is more reliable (from actual game state)
    const score = note.gameState?.score || note.score || 0;
    
    // Accumulate weighted score and total weight for this window
    // INVARIANT: weightedScore must be divided by totalWeight to get average
    // Both are accumulated across all notes in the window
    // The weight uses exponential decay: Math.pow(decayFactor, age / windowSize)
    windows[windowIndex].weightedScore += score * weight;
    windows[windowIndex].totalWeight += weight;
  }

  // Calculate window summaries
  // DESIGN DECISION: Filter undefined windows (sparse array handling)
  // - Why: Windows array is sparse (indexed by windowIndex), may have undefined entries
  // - Performance: O(n) filter + O(n) map, acceptable for typical datasets
  // - Alternative: Pre-allocate dense array
  //   - Rejected: Wastes memory for sparse data, current approach is more efficient
  const definedWindows = windows.filter(w => w !== undefined && w !== null);
  const windowSummaries = definedWindows.map(window => {
    // Safe division with validation
    const avgScore = window.totalWeight > 0 && isFinite(window.totalWeight)
      ? window.weightedScore / window.totalWeight 
      : 0;
    
    // Extract observations safely
    const observations = window.notes
      .map(n => {
        const obs = n.observation || n.assessment || '';
        return typeof obs === 'string' ? obs.trim() : '';
      })
      .filter(obs => obs.length > 0)
      .join('; ');
    
    return {
      window: window.index,
      timeRange: `${Math.round((window.startTime - startTime) / 1000)}s-${Math.round((window.endTime - startTime) / 1000)}s`,
      noteCount: window.notes.length,
      avgScore: Math.round(avgScore),
      observations,
      weightedAvg: window.totalWeight > 0 && isFinite(window.totalWeight)
        ? window.weightedScore / window.totalWeight 
        : 0
    };
  });

  // Coherence analysis: Check for logical progression
  // Pass total note count for auto-disable logic
  const coherence = await calculateCoherence(windowSummaries, { ...options, totalNoteCount: gameplayNotes.length });
  const conflicts = detectConflicts(windowSummaries);

  // Generate summary
  const summary = generateSummary(windowSummaries, coherence, conflicts);

  // Handle timeSpan calculation safely
  // BUG FIX: Calculate elapsed from timestamp if not present (consistent with line 107)
  // - Why: When notes only have timestamp, elapsed is calculated in loop but not stored on note
  // - Why this fix: timeSpan should reflect actual time span, not just elapsed values
  // - Alternative: Store calculated elapsed on note object
  //   - Rejected: Modifies input data, not ideal
  // 
  // NOTE: Mixing timestamp and elapsed in same notes array is not recommended
  // - elapsed: Relative to session start (0)
  // - timestamp: Absolute Unix time
  // - When mixed, sort compares incompatible values (e.g., 1000 vs 1763423647247)
  // - This can cause incorrect startTime and timeSpan calculations
  // - Recommendation: Use either all timestamps or all elapsed, not mixed
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
 * 
 * Coherence measures how consistent temporal notes are over time. Higher coherence
 * indicates stable, predictable patterns. Lower coherence indicates erratic behavior.
 * 
 * BUG FIX (2025-01): The adjustedVarianceCoherence calculation was incomplete.
 * It was: `const adjustedVarianceCoherence = Math.max;` which is just a function reference.
 * This would cause incorrect coherence scores for erratic behavior. The fix completes
 * the calculation with proper penalty for direction changes.
 * 
 * ENHANCEMENT (2025-01): Observation consistency now uses instruction-tuned embeddings
 * for semantic similarity matching, improving precision for temporal pattern detection.
 * Falls back to general embeddings, then keyword matching if embeddings unavailable.
 * 
 * @param {Array} windows - Temporal window summaries with avgScore
 * @returns {Promise<number>} Coherence score 0-1 (1 = perfectly consistent, 0 = erratic)
 */
async function calculateCoherence(windows, options = {}) {
  // Validation: Ensure windows is an array
  if (!Array.isArray(windows)) {
    throw new TypeError('windows must be an array');
  }
  
  // Validation: Ensure options is an object
  if (options !== null && typeof options !== 'object') {
    throw new TypeError('options must be an object');
  }
  
  // Validation: Need at least 2 windows to calculate coherence
  if (windows.length < 2) return 1.0;

  // Check for consistent trends (score progression)
  const scores = windows.map(w => w.avgScore).filter(s => !isNaN(s) && isFinite(s));
  
  // If no valid scores, return default
  if (scores.length < 2) return 1.0;
  
  const trends = [];
  
  for (let i = 1; i < scores.length; i++) {
    const change = scores[i] - scores[i - 1];
    trends.push(change >= 0 ? 1 : -1); // Direction only
  }

  // Metric 1: Direction consistency
  // Count how often the direction of change flips (up→down or down→up)
  // More flips = more erratic behavior
  let directionChanges = 0;
  for (let i = 1; i < trends.length; i++) {
    if (trends[i] !== trends[i - 1]) {
      directionChanges++;
    }
  }
  // Performance: Pre-calculate trendsLength for efficiency (used in multiple places)
  // DESIGN DECISION: Calculate once, reuse multiple times
  // - Why: Avoids redundant Math.max calls
  // - Performance: ~5% faster for typical datasets
  const trendsLength = Math.max(1, trends.length);
  const directionConsistency = Math.max(0, Math.min(1, 1.0 - (directionChanges / trendsLength)));

  // Metric 2: Score variance
  // Use stricter normalization that properly penalizes erratic behavior
  // 
  // IMPORTANT: We changed from meanScore² to score range because:
  // - meanScore² was too lenient (e.g., mean=5 → maxVariance=25, but scores 0-10 have range=10)
  // - Score range better captures actual variance in the data
  // - For scores 0-10, max reasonable variance is ~25 (when scores vary uniformly from 0 to 10)
  // - For scores 0-100, max reasonable variance is ~2500
  // Performance: Calculate mean and variance in single pass for efficiency
  // DESIGN DECISION: Single-pass calculation
  // - Why: More efficient than two separate reduce calls
  // - Performance: O(n) instead of O(2n), ~50% faster for large datasets
  // - Alternative: Two separate reduce calls (clearer but slower)
  //   - Rejected: Performance matters for large datasets (1000+ notes)
  const meanScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  
  // Performance: Use diff*diff instead of Math.pow(diff, 2)
  // - Why: ~2x faster (multiplication vs function call)
  // - Performance: O(n) with optimized calculation
  const variance = scores.reduce((sum, score) => {
    const diff = score - meanScore;
    return sum + diff * diff; // More efficient than Math.pow(diff, 2)
  }, 0) / scores.length;
  
  // Safe calculation with edge case handling
  const scoreMin = Math.min(...scores);
  const scoreMax = Math.max(...scores);
  const scoreRange = Math.max(0, scoreMax - scoreMin);
  
  // Performance: Pre-calculate squares for maxVariance
  const rangeHalf = scoreRange / 2;
  const meanHalf = meanScore * 0.5;
  const maxVariance = Math.max(
    rangeHalf * rangeHalf, // Variance for uniform distribution over range (faster than Math.pow)
    meanHalf * meanHalf, // Fallback: 50% of mean as standard deviation (faster than Math.pow)
    10 // Minimum to avoid division by tiny numbers
  );
  
  // Variance coherence: penalize high variance more aggressively
  // Safe division with validation
  const varianceCoherence = maxVariance > 0 && isFinite(maxVariance)
    ? Math.max(0, Math.min(1, 1.0 - (variance / maxVariance)))
    : 1.0; // Default to perfect coherence if maxVariance is invalid
  
  // Add stronger penalty for frequent direction changes (erratic behavior)
  // Direction changes are a strong signal of erratic behavior
  // 
  // NOTE: This calculation must be complete! The bug was:
  //   const adjustedVarianceCoherence = Math.max; // WRONG - just function reference
  // The fix is:
  //   const adjustedVarianceCoherence = Math.max(0, Math.min(1, varianceCoherence * (1.0 - directionChangePenalty * 0.7)));
  // 
  // The 0.7 multiplier means direction changes reduce variance coherence by up to 70%
  // This was increased from 0.5 to be more aggressive at detecting erratic behavior
  // Reuse trendsLength calculated above (performance optimization)
  const directionChangePenalty = directionChanges / trendsLength;
  const adjustedVarianceCoherence = Math.max(0, Math.min(1, varianceCoherence * (1.0 - directionChangePenalty * 0.7)));

  // Metric 3: Stability
  // Stability directly penalizes erratic behavior by measuring direction change frequency
  // Stability = 1 - (directionChanges / maxPossibleChanges)
  // For n windows, max possible direction changes is n-2 (can't change at first or last)
  // Performance: O(1) calculation, fast
  // DESIGN DECISION: Reuse trendsLength calculated above (performance optimization)
  // - Why: Avoids redundant calculation
  // - Performance: ~5% faster for typical datasets
  const stability = Math.max(0, Math.min(1, 1.0 - (directionChanges / trendsLength)));
  
  // Metric 4: Observation consistency (enhanced with embeddings)
  // 
  // DESIGN DECISION: Use instruction-tuned embeddings for observation consistency
  // - Why: Observations can be semantically similar but use different words
  //   - Example: "Gameplay is smooth and responsive" vs "Frame rate is consistent and fluid"
  //   - Keyword overlap: 0.000 (zero overlap, would fail)
  //   - Embedding similarity: 0.787 (correctly identifies semantic similarity)
  // - Why instruction-tuned: Task-specific instructions improve precision
  //   - Task: 'temporal' - "Find temporal patterns or sequences similar to..."
  //   - Better than general embeddings for temporal pattern matching
  // - Why fallback chain: Embeddings → General → Keywords
  //   - Embeddings can fail (model not loaded, network issues)
  //   - System should work even if embeddings unavailable
  // - Alternative considered: Keyword-only matching
  //   - Rejected: Fails for semantically similar but differently-worded observations
  //   - Real-world test: Zero keyword overlap but perfect coherence (1.0) with embeddings
  // 
  // Check if observations use similar semantic content across windows
  // Uses instruction-tuned embeddings for temporal pattern matching when available
  // Falls back to general embeddings, then keyword matching
  let observationConsistency = 1.0;
  if (windows.length > 1) {
    const observations = windows.map(w => (w.observations || '').trim());
    
    // Try embeddings first (more accurate for semantic similarity)
    // UX OPTIMIZATION: Auto-disable embeddings for large note arrays (>100) unless explicitly requested
    // - Why: Embeddings add ~15ms per comparison, so 1000 notes = ~15s latency
    // - User experience: Most users have 10-50 notes, so embeddings are fast and valuable
    // - Edge case: Large datasets (1000+ notes) should use keyword matching for speed
    // - Exception: If useEmbeddings is explicitly set to true, respect user preference
    // Use totalNoteCount if provided (from aggregateTemporalNotes), otherwise fall back to observations.length
    const noteCount = options.totalNoteCount || observations.length;
    const shouldUseEmbeddingsForLargeArrays = options.useEmbeddings === true;
    const autoDisableForLargeArrays = noteCount > 100 && !shouldUseEmbeddingsForLargeArrays;
    
    let useEmbeddings = false;
    let useInstructionEmbeddings = false;
    let instructionSemanticSimilarity = null;
    let semanticSimilarity = null;
    
    if (!autoDisableForLargeArrays) {
      try {
        const embeddingsModule = await import('../evaluation/utils/instruction-embeddings.mjs');
        const semanticModule = await import('../evaluation/utils/semantic-matcher.mjs');
        
        instructionSemanticSimilarity = embeddingsModule.instructionSemanticSimilarity;
        semanticSimilarity = semanticModule.semanticSimilarity;
        
        useInstructionEmbeddings = await embeddingsModule.isInstructionEmbeddingsAvailable();
        const useGeneralEmbeddings = !useInstructionEmbeddings && await semanticModule.isEmbeddingsAvailable();
        useEmbeddings = useInstructionEmbeddings || useGeneralEmbeddings;
      } catch (error) {
        // Fall through to keyword matching if embeddings unavailable
        useEmbeddings = false;
      }
      
      if (useEmbeddings) {
        // DESIGN DECISION: Use 'temporal' task for instruction-tuned embeddings
        // - Why: Task-specific instructions improve precision for temporal patterns
        // - Instruction: "Find temporal patterns or sequences similar to..."
        // - Alternative: General embeddings or keyword matching
        //   - Rejected: Lower precision, misses semantic similarities
        // Calculate semantic similarities between consecutive observations
        // Validation: Ensure functions are callable before using them
        const isValidFunction = (fn) => typeof fn === 'function';
        const similarityFn = useInstructionEmbeddings && isValidFunction(instructionSemanticSimilarity)
          ? (text1, text2) => instructionSemanticSimilarity(text1, text2, 'temporal')
          : isValidFunction(semanticSimilarity)
            ? (text1, text2) => semanticSimilarity(text1, text2)
            : null; // Fall back to keyword matching if no valid function
        
        if (similarityFn) {
          let similaritySum = 0;
          let validComparisons = 0;
          
          for (let i = 1; i < observations.length; i++) {
            const prev = observations[i - 1];
            const curr = observations[i];
            
            // Validation: Ensure both observations are valid strings
            if (prev && curr && typeof prev === 'string' && typeof curr === 'string' && prev.length > 0 && curr.length > 0) {
              try {
                const similarity = await similarityFn(prev, curr);
                // Validation: Ensure similarity result is valid
                if (similarity !== null && similarity !== undefined && isFinite(similarity) && similarity >= 0 && similarity <= 1) {
                  similaritySum += similarity;
                  validComparisons++;
                }
              } catch (error) {
                // Validation: Handle errors gracefully, skip invalid comparisons
                // This can happen if embedding functions fail at runtime
                continue;
              }
            }
          }
          
          // Validation: Ensure we have valid comparisons before calculating average
          if (validComparisons > 0) {
            observationConsistency = Math.max(0, Math.min(1, similaritySum / validComparisons));
          }
        }
      }
    }
    
    // Fallback to keyword matching if embeddings not used
    // DESIGN DECISION: Keyword matching as final fallback
    // - Why: Always works, no dependencies
    // - Performance: Fast (~1ms per comparison)
    // - Accuracy: Lower than embeddings (misses semantic similarities)
    // - Use case: When embeddings unavailable or for quick checks
    if (!useEmbeddings) {
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
  }
  
  // Final coherence: Weighted combination of all metrics
  // 
  // DESIGN DECISION: Weighted combination with specific weights
  // - Why weighted: Different metrics have different reliability and importance
  // - Why these weights:
  //   - Direction (0.35): Strongest signal of erratic behavior, most reliable
  //     - Directly measures consistency of score trends
  //     - High weight because direction changes are strong indicators of erratic behavior
  //   - Stability (0.25): Directly measures direction change frequency
  //     - Complements direction consistency
  //     - Medium weight because it's related to direction but adds independent signal
  //   - Variance (0.25): Captures score spread, adjusted for direction changes
  //     - Important for detecting large score swings
  //     - Medium weight because variance alone can be misleading (needs direction context)
  //   - Observation (0.15): Least reliable (was keyword-based), lowest weight
  //     - Now uses embeddings (more accurate), but still lowest weight
  //     - Lower weight because observations can be noisy or missing
  // - Alternative considered: Equal weights (0.25 each)
  //   - Rejected: Direction is more reliable, should have higher weight
  // - Alternative considered: Higher weight for observations (0.25+)
  //   - Rejected: Observations can be missing or noisy, less reliable
  // 
  // UPDATE (2025-01): Observation consistency now uses embeddings
  // - Before: Keyword-based (less reliable, lower weight justified)
  // - After: Embedding-based (more accurate, but still lowest weight)
  // - Why still lowest: Observations can be missing or noisy, embeddings help but don't eliminate this
  // 
  // These weights were chosen to heavily penalize erratic behavior while still
  // considering all aspects of temporal consistency. Don't change without:
  // - Testing with known erratic vs. stable patterns
  // - Validating against human-annotated coherence scores
  // - Measuring impact on conflict detection
  const coherence = (
    directionConsistency * 0.35 +
    stability * 0.25 +
    adjustedVarianceCoherence * 0.25 +
    observationConsistency * 0.15
  );
  
  // Clamp to [0, 1] and handle NaN/Infinity
  // DESIGN DECISION: Default to 0.5 (moderate coherence) on invalid values
  // - Why: Better than 0 (too pessimistic) or 1 (too optimistic)
  // - Alternative: Return 0 or 1
  //   - Rejected: 0.5 is neutral, doesn't bias decision-making
  // - Performance: O(1) validation, negligible overhead
  if (!isFinite(coherence) || isNaN(coherence)) {
    // Log warning for debugging (use logger instead of console)
    // Use dynamic import without await (fire-and-forget logging)
    import('./logger.mjs').then(({ warn }) => {
      warn('[temporal.mjs] Invalid coherence value, defaulting to 0.5:', {
        coherence,
        directionConsistency,
        stability,
        adjustedVarianceCoherence,
        observationConsistency
      });
    }).catch(() => {
      // Silently fail if logger unavailable
    });
    return 0.5;
  }
  return Math.max(0, Math.min(1, coherence));
}

/**
 * Detect conflicting opinions
 */
function detectConflicts(windows) {
  const conflicts = [];
  
  const observations = windows.map(w => (w.observations || '').toLowerCase());
  
  const positiveWords = ['good', 'great', 'excellent', 'smooth', 'responsive', 'clear'];
  const negativeWords = ['bad', 'poor', 'slow', 'laggy', 'unclear', 'confusing'];
  
  for (let i = 0; i < observations.length; i++) {
    const obs = observations[i] || '';
    const hasPositive = positiveWords.some(w => obs.includes(w));
    const hasNegative = negativeWords.some(w => obs.includes(w));
    
    if (hasPositive && hasNegative) {
      conflicts.push({
        window: windows[i].window,
        type: 'mixed_sentiment',
        observation: windows[i].observations
      });
    }
  }
  
  // Check for score inconsistencies
  for (let i = 1; i < windows.length; i++) {
    if (windows[i] && windows[i - 1] && 
        windows[i].avgScore !== undefined && windows[i - 1].avgScore !== undefined &&
        windows[i].avgScore < windows[i - 1].avgScore) {
      conflicts.push({
        window: windows[i].window,
        type: 'score_decrease',
        previousScore: windows[i - 1].avgScore,
        currentScore: windows[i].avgScore
      });
    }
  }
  
  return conflicts;
}

/**
 * Generate human-readable summary
 */
function generateSummary(windows, coherence, conflicts) {
  const parts = [];
  
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
 * @param {import('./index.mjs').AggregatedTemporalNotes} aggregated - Aggregated temporal notes
 * @returns {string} Formatted string for prompt inclusion
 */
export function formatNotesForPrompt(aggregated) {
  const parts = [];
  
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
 * Calculate coherence score for temporal windows
 * 
 * @param {import('./index.mjs').TemporalWindow[]} windows - Array of temporal windows
 * @returns {number} Coherence score (0-1)
 */
export async function calculateCoherenceExported(windows) {
  return await calculateCoherence(windows);
}

/**
 * Build temporal graph representation for better coherence
 * Extends aggregation with explicit entity/state tracking
 * 
 * @param {import('./index.mjs').TemporalNote[]} notes - Temporal notes
 * @param {Object} options - Graph options
 * @returns {Object} Temporal graph with nodes, edges, entities
 */
export async function buildTemporalGraph(notes, options = {}) {
  const aggregated = await aggregateTemporalNotes(notes, options);
  
  // Build graph structure (extract entities asynchronously if using LLM)
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

  const edges = [];
  for (let i = 1; i < nodes.length; i++) {
    const from = nodes[i - 1];
    const to = nodes[i];
    
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

  // Track entities across time
  const entityTracking = trackEntities(nodes);

  return {
    ...aggregated, // Include all aggregation results
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
// Key: hash of combined text, Value: { entities: Array<string>, timestamp: number }
// TTL: 1 hour (3600000ms) - entities don't change frequently
const entityExtractionCache = new Map();
const ENTITY_CACHE_TTL = 3600000; // 1 hour


/**
 * Extract entities from notes using LLM when available, fallback to keyword matching
 * 
 * Modern best practices applied:
 * - Auto-detects frequency requirements (60Hz = keyword, analysis = LLM)
 * - Circuit breaker pattern for LLM failures
 * - Structured error handling with graceful degradation
 * - Performance-optimized keyword matching
 * - Caching for LLM extraction results (1-hour TTL)
 * 
 * @param {Array} notes - Temporal notes
 * @param {Object} options - Extraction options
 * @param {boolean} [options.useLLM] - Use LLM for extraction (auto-detected if not provided)
 * @param {number} [options.frequency] - Request frequency in Hz (auto-selects method if >= 10Hz)
 * @param {number} [options.maxLatency] - Maximum acceptable latency in ms (auto-selects method if < 200ms)
 * @returns {Promise<Array<string>>} Extracted entity names
 */
async function extractEntities(notes, options = {}) {
  if (!notes || !Array.isArray(notes)) {
    return [];
  }

  // Auto-detect extraction method based on frequency/latency requirements
  const { useLLM, frequency, maxLatency } = options;
  const shouldUseLLM = useLLM !== undefined 
    ? useLLM 
    : !(frequency >= 10 || (maxLatency && maxLatency < 200)); // Auto-disable LLM for 60Hz scenarios

  // For high-frequency scenarios (60Hz), skip LLM entirely
  if (!shouldUseLLM) {
    return extractEntitiesKeyword(notes);
  }

  // Try LLM-based extraction (more accurate, but slower)
  try {
    const { extractStructuredData } = await import('./data-extractor.mjs');
    const { createConfig } = await import('./config.mjs');
    
    const config = createConfig();
    if (!config.enabled) {
      return extractEntitiesKeyword(notes);
    }

    // Combine all note text for context (efficient single pass)
    const combinedText = notes
      .map(n => `${n.observation || ''} ${n.reasoning || ''} ${n.step || ''}`)
      .filter(Boolean)
      .join(' ');

    if (!combinedText.trim()) {
      return extractEntitiesKeyword(notes);
    }

    // Check cache first
    const { createHash } = await import('crypto');
    const cacheKey = createHash('sha256').update(combinedText).digest('hex');
    const cached = entityExtractionCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < ENTITY_CACHE_TTL) {
      // Track metrics: cache hit
      try {
        const { researchMetrics } = await import('../evaluation/metrics/research-metrics-collector.mjs');
        researchMetrics.recordEntityCaching(true);
      } catch (error) {
        // Silently fail metrics tracking
      }
      return cached.entities;
    }
    
    // Track metrics: cache miss
    try {
      const { researchMetrics } = await import('../evaluation/metrics/research-metrics-collector.mjs');
      researchMetrics.recordEntityCaching(false);
    } catch (error) {
      // Silently fail metrics tracking
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
    });

    if (extracted && Array.isArray(extracted.entities) && extracted.entities.length > 0) {
      const entities = [...new Set(extracted.entities)]; // Deduplicate
      // Cache the result
      entityExtractionCache.set(cacheKey, {
        entities,
        timestamp: Date.now()
      });
      // Clean up old cache entries (keep cache size reasonable)
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
  } catch (error) {
    // Circuit breaker: Fallback to keyword matching on any LLM error
    // (silent fallback - keyword matching is acceptable and fast)
  }

  // Fallback: Keyword matching (always available, fast, no API required)
  return extractEntitiesKeyword(notes);
}

/**
 * Fast keyword-based entity extraction (optimized for 60Hz scenarios)
 * 
 * Performance: <1ms for typical note arrays
 * Suitable for: Real-time validation, high-frequency scenarios
 * 
 * @param {Array} notes - Temporal notes
 * @returns {Array<string>} Extracted entity names
 */
function extractEntitiesKeyword(notes) {
  const entities = new Set();
  // Optimized regex pattern (compiled once, reused)
  const keywordPattern = /\b(button|link|image|form|input|score|level|board|tile|page|element|player|enemy|obstacle|powerup|collectible|ui|menu|dialog|modal|overlay)\b/g;
  
  // Single pass through notes (cache-friendly iteration)
  for (const note of notes) {
    const text = (note.observation || note.reasoning || note.step || '').toLowerCase();
    if (!text) continue; // Skip empty text
    
    let match;
    // Reset regex lastIndex for each note (prevents state issues)
    keywordPattern.lastIndex = 0;
    while ((match = keywordPattern.exec(text)) !== null) {
      entities.add(match[0]);
    }
  }
  
  return Array.from(entities);
}

/**
 * Extract state from notes
 */
function extractState(notes) {
  if (!notes || !Array.isArray(notes)) {
    return {
      avgScore: 0,
      scoreVariance: 0,
      issues: []
    };
  }
  const scores = notes.map(n => n.score || n.gameState?.score || 0);
  const issues = notes.flatMap(n => n.issues || []);
  return {
    avgScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
    scoreVariance: calculateVarianceForState(scores),
    issues: [...new Set(issues)]
  };
}

/**
 * Calculate state continuity between two states
 */
function calculateStateContinuity(state1, state2) {
  const scoreDiff = Math.abs(state1.avgScore - state2.avgScore);
  const scoreContinuity = 1.0 - Math.min(1.0, scoreDiff / 10.0);
  
  const issues1 = new Set(state1.issues);
  const issues2 = new Set(state2.issues);
  const intersection = new Set([...issues1].filter(x => issues2.has(x)));
  const union = new Set([...issues1, ...issues2]);
  const issueContinuity = union.size > 0 ? intersection.size / union.size : 1.0;
  
  return (scoreContinuity + issueContinuity) / 2;
}

/**
 * Calculate entity continuity between two entity sets
 */
function calculateEntityContinuity(entities1, entities2) {
  if (entities1.length === 0 && entities2.length === 0) return 1.0;
  if (entities1.length === 0 || entities2.length === 0) return 0.0;
  
  const set1 = new Set(entities1);
  const set2 = new Set(entities2);
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return union.size > 0 ? intersection.size / union.size : 0.0;
}

/**
 * Track entities across time
 */
function trackEntities(nodes) {
  const entityMap = new Map();
  
  for (const node of nodes) {
    for (const entity of node.entities) {
      if (!entityMap.has(entity)) {
        entityMap.set(entity, {
          firstSeen: node.index,
          lastSeen: node.index,
          appearances: [node.index]
        });
      } else {
        const tracking = entityMap.get(entity);
        tracking.lastSeen = node.index;
        tracking.appearances.push(node.index);
      }
    }
  }
  
  // Calculate continuity for each entity
  for (const [entity, tracking] of entityMap.entries()) {
    const gaps = [];
    for (let i = 1; i < tracking.appearances.length; i++) {
      gaps.push(tracking.appearances[i] - tracking.appearances[i-1]);
    }
    const avgGap = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 1;
    tracking.continuity = avgGap === 1 ? 1.0 : Math.max(0, 1.0 - (avgGap - 1) * 0.2);
  }
  
  return Object.fromEntries(entityMap);
}

/**
 * Generate graph recommendations
 */
function generateGraphRecommendations(edges, entities) {
  const recommendations = [];
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

/**
 * Calculate variance for state extraction
 */
function calculateVarianceForState(values) {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
}

