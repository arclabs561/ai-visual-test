/**
 * Temporal Preprocessing Manager
 * 
 * Implements preprocessing patterns from high-stakes, low-latency domains (driving, aviation)
 * for browser temporal note-taking. The key insight: preprocess expensive operations during
 * low-Hz periods (idle, reading, stable) and use preprocessed data during high-Hz periods
 * (rapid interactions, fast state changes).
 * 
 * Research context:
 * - arXiv:2406.12125 - Only 1.5% LLM calls needed through strategic selection
 * - arXiv:2505.13326 - "Short and right" thinking management, early stopping
 * - Human perception time scales (NN/g, PMC) - 0.1s threshold for direct manipulation
 * 
 * Pattern:
 * - High-Hz (10-60Hz): Fast note capture, use preprocessed aggregations
 * - Low-Hz (0.1-1Hz): Expensive preprocessing (multi-scale aggregation, coherence, pruning)
 */

import { aggregateTemporalNotes } from './temporal.mjs';
import { aggregateMultiScale } from './temporal-decision.mjs';
import { pruneTemporalNotes, selectTopWeightedNotes } from './temporal-note-pruner.mjs';
import { log, warn } from './logger.mjs';

/**
 * Activity Detector
 * 
 * Detects activity level based on note frequency and user interactions.
 */
class ActivityDetector {
  /**
   * Detect activity level from temporal notes
   * 
   * Activity detection is critical for preprocessing routing:
   * - High activity (>10 notes/sec): Use cache for speed
   * - Medium activity (1-10 notes/sec): Hybrid (cache if valid, else compute)
   * - Low activity (<1 note/sec): Background preprocessing (non-blocking)
   * 
   * Thresholds are based on human perception time scales:
   * - High-Hz (>10Hz): Rapid interactions, fast state changes (gaming, scrolling)
   * - Medium-Hz (1-10Hz): Normal browsing, moderate interactions
   * - Low-Hz (<1Hz): Idle, reading, stable state (can do expensive preprocessing)
   * 
   * DON'T CHANGE THRESHOLDS without:
   * - Testing with real browser interactions
   * - Validating cache hit rates
   * - Measuring latency impact
   * 
   * @param {import('./index.mjs').TemporalNote[]} notes - Temporal notes
   * @param {number} recentWindow - Time window in ms to analyze (default: 5000ms)
   * @returns {'high' | 'medium' | 'low'} Activity level
   */
  detectActivityLevel(notes, recentWindow = 5000) {
    if (notes.length === 0) return 'low';
    
    const now = Date.now();
    const recent = notes.filter(n => {
      const timestamp = n.timestamp || n.elapsed || 0;
      const noteTime = typeof timestamp === 'number' ? timestamp : now;
      return now - noteTime < recentWindow;
    });
    
    if (recent.length === 0) return 'low';
    
    // Calculate note rate (notes per second)
    const oldestRecent = recent[0];
    const newestRecent = recent[recent.length - 1];
    const oldestTime = oldestRecent.timestamp || oldestRecent.elapsed || now;
    const newestTime = newestRecent.timestamp || newestRecent.elapsed || now;
    const timeSpan = Math.max(100, newestTime - oldestTime); // At least 100ms
    const noteRate = recent.length / (timeSpan / 1000); // notes per second
    
    // Thresholds based on human perception and interaction rates
    // High: >10 notes/sec (rapid interactions, fast state changes)
    // Medium: 1-10 notes/sec (normal browsing, moderate interactions)
    // Low: <1 note/sec (idle, reading, stable state)
    if (noteRate > 10) return 'high';
    if (noteRate > 1) return 'medium';
    return 'low';
  }
  
  /**
   * Check if there are recent user interactions
   * 
   * @param {import('./index.mjs').TemporalNote[]} notes - Temporal notes
   * @param {number} recentWindow - Time window in ms (default: 2000ms)
   * @returns {boolean} True if user interaction detected
   */
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
  
  /**
   * Check if state is stable (low variance in scores/observations)
   * 
   * @param {import('./index.mjs').TemporalNote[]} notes - Temporal notes
   * @param {number} window - Time window in ms (default: 2000ms)
   * @returns {boolean} True if state is stable
   */
  isStableState(notes, window = 2000) {
    if (notes.length < 3) return true; // Not enough data
    
    const now = Date.now();
    const recent = notes.slice(-5).filter(n => {
      const timestamp = n.timestamp || n.elapsed || 0;
      const noteTime = typeof timestamp === 'number' ? timestamp : now;
      return now - noteTime < window;
    });
    
    if (recent.length < 3) return true; // Not enough recent data
    
    // Extract scores
    const scores = recent.map(n => {
      if (n.score !== undefined) return n.score;
      if (n.gameState?.score !== undefined) return n.gameState.score;
      return 0;
    });
    
    // Calculate variance
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);
    
    // Low variance = stable state
    return stdDev < 0.5; // Threshold: low variance
  }
}

/**
 * Temporal Preprocessing Manager
 * 
 * Manages preprocessing of temporal notes during low-activity periods
 * and provides fast access to preprocessed data during high-activity periods.
 * 
 * CACHE ARCHITECTURE NOTE:
 * - This is a THIRD cache system, completely separate from VLLM cache and BatchOptimizer cache
 * - In-memory object (not a Map), single cache entry (most recent preprocessing)
 * - No keys, no coordination with other caches
 * - Cache validity based on age (5s) and note count change (>20%)
 * - "Incremental aggregation" is currently a lie (does full recomputation)
 * - See CACHE_ARCHITECTURE_DEEP_DIVE.md for details
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
    this.preprocessInterval = options.preprocessInterval || 2000; // Preprocess every 2s during low activity
    this.cacheMaxAge = options.cacheMaxAge || 5000; // Cache valid for 5s
    this.preprocessingInProgress = false;
    this.preprocessQueue = [];
  }
  
  /**
   * Fast path: Get aggregation using preprocessed data if available
   * 
   * @param {import('./index.mjs').TemporalNote[]} notes - Temporal notes
   * @param {Object} options - Aggregation options
   * @returns {import('./index.mjs').AggregatedTemporalNotes} Aggregated notes
   */
  getFastAggregation(notes, options = {}) {
    const activity = this.activityDetector.detectActivityLevel(notes);
    
    // During high activity, use cache if valid
    if (activity === 'high' && this.isCacheValid(notes)) {
      log('[Preprocessor] Using cached aggregation (high activity)');
      return this.preprocessedCache.aggregated;
    }
    
    // During medium/low activity or invalid cache, compute synchronously
    // But use lighter computation if cache exists
    if (this.preprocessedCache.aggregated && this.isCachePartiallyValid(notes)) {
      // Cache is partially valid, do incremental update
      return this._incrementalAggregation(notes, options);
    }
    
    // Full synchronous computation
    return aggregateTemporalNotes(notes, options);
  }
  
  /**
   * Background preprocessing during low activity
   * 
   * @param {import('./index.mjs').TemporalNote[]} notes - Temporal notes
   * @param {Object} options - Preprocessing options
   * @returns {Promise<void>}
   */
  async preprocessInBackground(notes, options = {}) {
    // Skip if already preprocessing
    if (this.preprocessingInProgress) {
      return;
    }
    
    const activity = this.activityDetector.detectActivityLevel(notes);
    const hasInteraction = this.activityDetector.hasUserInteraction(notes);
    const isStable = this.activityDetector.isStableState(notes);
    
    // Only preprocess during low/medium activity and stable state
    if (activity === 'high' || (hasInteraction && !isStable)) {
      return; // Skip preprocessing, use cache or compute synchronously
    }
    
    this.preprocessingInProgress = true;
    
    try {
      // Do expensive operations
      const aggregated = aggregateTemporalNotes(notes, {
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
      
      // Identify patterns (lightweight)
      const patterns = this._identifyPatterns(notes);
      
      // Update cache
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
  
  /**
   * Check if cache is valid for current notes
   * 
   * NOTE: This only checks note COUNT, not note CONTENT!
   * 
   * The problem:
   * - Validates cache if note count changed <20%
   * - But doesn't check if notes actually changed
   * - Example: 10 notes, replace 2 with different notes = same count = cache valid (WRONG!)
   * 
   * Why this exists:
   * - Checking note content would require hashing/comparing all notes (expensive)
   * - Count-based check is fast but imprecise
   * - 20% threshold is arbitrary (why 20%? why not 10% or 30%?)
   * 
   * What should happen:
   * - Hash note content to detect actual changes
   * - Or use more sophisticated diff
   * - Or accept that cache might be stale (document the risk)
   * 
   * Current impact:
   * - Cache might be used when notes changed but count didn't
   * - Stale aggregations returned
   * - Coherence scores might be wrong
   * 
   * @param {import('./index.mjs').TemporalNote[]} notes - Current notes
   * @returns {boolean} True if cache is valid
   */
  isCacheValid(notes) {
    if (!this.preprocessedCache.aggregated) return false;
    
    // Age-based invalidation: cache expires after cacheMaxAge (default: 5s)
    const age = Date.now() - this.preprocessedCache.lastPreprocessTime;
    if (age > this.cacheMaxAge) return false;
    
    // Count-based invalidation: cache invalid if note count changed >20%
    // NOTE: Cache invalidation is based on note count, not content comparison
    // This is a performance optimization - full content comparison would be expensive
    // Trade-off: May miss cases where notes changed but count stayed same (rare)
    // Same count but different notes = cache considered valid (might be stale)
    const noteCountDiff = Math.abs(notes.length - this.preprocessedCache.noteCount);
    if (noteCountDiff > notes.length * 0.2) return false; // >20% change
    
    return true;
  }
  
  /**
   * Check if cache is partially valid (can do incremental update)
   * 
   * @param {import('./index.mjs').TemporalNote[]} notes - Current notes
   * @returns {boolean} True if cache is partially valid
   */
  isCachePartiallyValid(notes) {
    if (!this.preprocessedCache.aggregated) return false;
    
    const age = Date.now() - this.preprocessedCache.lastPreprocessTime;
    if (age > this.cacheMaxAge * 2) return false; // Too old even for incremental
    
    return true;
  }
  
  /**
   * Incremental aggregation (faster than full recomputation)
   * 
   * NOTE: This currently does full recomputation, not incremental (TODO: implement true incremental)
   * 
   * The problem:
   * - Function name says "incremental"
   * - Comment says "faster than full recomputation"
   * - But implementation just calls `aggregateTemporalNotes()` = full recomputation
   * 
   * Why this exists:
   * - Planned feature (TODO comment)
   * - Called from `getFastAggregation()` when cache is "partially valid"
   * - The idea: if cache is old but not too old, do incremental update instead of full recompute
   * 
   * What should happen:
   * - Take cached aggregation
   * - Add only new notes since cache was created
   * - Update windows, coherence, etc. incrementally
   * - Much faster than full recomputation
   * 
   * Current impact:
   * - "Partially valid" cache path has no performance benefit
   * - Might as well always do full recomputation
   * - The "incremental" path is misleading
   * 
   * TODO: Implement true incremental aggregation OR remove this path
   * 
   * @param {import('./index.mjs').TemporalNote[]} notes - Current notes
   * @param {Object} options - Aggregation options
   * @returns {import('./index.mjs').AggregatedTemporalNotes} Aggregated notes
   */
  _incrementalAggregation(notes, options) {
    // NOTE: This currently does full recomputation, not true incremental aggregation
    // This is a known limitation documented in the function comment above
    // 
    // Future enhancement: Implement true incremental aggregation that:
    //   1. Takes cached aggregation
    //   2. Identifies new notes since cache
    //   3. Updates only affected windows
    //   4. Recomputes coherence for changed windows only
    // OR: Remove this function and always do full recomputation
    return aggregateTemporalNotes(notes, options);
  }
  
  /**
   * Identify patterns in notes (lightweight)
   * 
   * @param {import('./index.mjs').TemporalNote[]} notes - Temporal notes
   * @returns {Object} Pattern information
   */
  _identifyPatterns(notes) {
    if (notes.length < 3) {
      return { trends: [], conflicts: [] };
    }
    
    const trends = [];
    const conflicts = [];
    
    // Simple trend detection: score progression
    const scores = notes.map(n => n.score || n.gameState?.score || 0);
    if (scores.length >= 3) {
      const first = scores[0];
      const last = scores[scores.length - 1];
      if (last > first * 1.1) {
        trends.push({ type: 'increasing', metric: 'score', magnitude: (last - first) / first });
      } else if (last < first * 0.9) {
        trends.push({ type: 'decreasing', metric: 'score', magnitude: (first - last) / first });
      }
    }
    
    // Simple conflict detection: contradictory observations
    const observations = notes.map(n => n.observation || '').filter(o => o.length > 0);
    if (observations.length >= 2) {
      // Check for contradictory keywords (simplified)
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
  
  /**
   * Get preprocessed multi-scale aggregation
   * 
   * @param {import('./index.mjs').TemporalNote[]} notes - Temporal notes
   * @returns {Object} Multi-scale aggregation
   */
  getFastMultiScale(notes) {
    if (this.isCacheValid(notes) && this.preprocessedCache.multiScale) {
      return this.preprocessedCache.multiScale;
    }
    
    // Fallback to synchronous computation
    return aggregateMultiScale(notes, { attentionWeights: true });
  }
  
  /**
   * Get preprocessed pruned notes
   * 
   * @param {import('./index.mjs').TemporalNote[]} notes - Temporal notes
   * @param {Object} options - Pruning options
   * @returns {import('./index.mjs').TemporalNote[]} Pruned notes
   */
  getFastPrunedNotes(notes, options = {}) {
    if (this.isCacheValid(notes) && this.preprocessedCache.prunedNotes) {
      return this.preprocessedCache.prunedNotes;
    }
    
    // Fallback to synchronous computation
    return pruneTemporalNotes(notes, options);
  }
  
  /**
   * Get cache statistics
   * 
   * @returns {Object} Cache statistics
   */
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
  
  /**
   * Clear cache
   */
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
 * 
 * Routes processing to fast or expensive path based on activity level.
 */
export class AdaptiveTemporalProcessor {
  constructor(options = {}) {
    this.preprocessor = new TemporalPreprocessingManager(options);
    this.activityDetector = new ActivityDetector();
  }
  
  /**
   * Smart processing: route to fast or expensive path based on activity
   * 
   * @param {import('./index.mjs').TemporalNote[]} notes - Temporal notes
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Processing result with metadata
   */
  async processNotes(notes, options = {}) {
    const activity = this.activityDetector.detectActivityLevel(notes);
    const hasInteraction = this.activityDetector.hasUserInteraction(notes);
    const isStable = this.activityDetector.isStableState(notes);
    
    // High activity + interaction = use cache, fast path only
    if (activity === 'high' && hasInteraction) {
      const aggregated = this.preprocessor.getFastAggregation(notes, options);
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
    
    // Low activity + stable = do expensive preprocessing
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
    
    // Medium activity = hybrid: use cache if valid, else compute
    if (this.preprocessor.isCacheValid(notes)) {
      return {
        aggregated: this.preprocessor.getFastAggregation(notes, options),
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
      // Compute synchronously but lighter version
      const aggregated = aggregateTemporalNotes(notes, {
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

