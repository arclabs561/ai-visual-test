# Preprocessing and Latency Patterns: Driving/Airplane Intelligence Applied to Browser Temporal Note-Taking

## Executive Summary

This document explores how preprocessing patterns from high-stakes, low-latency domains (driving, aviation) can inform our browser temporal note-taking system. The key insight: **preprocess expensive operations during low-Hz periods (idle, reading, loading) and use preprocessed data during high-Hz periods (interactions, rapid changes)**.

## The Driving/Airplane Preprocessing Pattern

### Core Principle
In autonomous driving and aviation systems, you need **instantaneous intelligence** for critical decisions (braking, evasive maneuvers) but can afford **preprocessing** during non-critical moments (cruising, waiting at lights, holding patterns).

**Pattern**:
1. **High-Hz Periods** (critical, reactive): Use preprocessed data for fast decisions
2. **Low-Hz Periods** (idle, stable): Do expensive preprocessing (sensor fusion, path planning, threat assessment)

### Example: Autonomous Driving
- **High-Hz (100-200Hz)**: Object detection, collision avoidance, lane keeping
  - Uses: Preprocessed sensor fusion, precomputed path plans, cached threat assessments
  - Latency: <10ms per decision
- **Low-Hz (1-10Hz)**: Route planning, traffic prediction, weather analysis
  - Does: Expensive ML inference, map updates, traffic pattern analysis
  - Latency: 100-1000ms acceptable

### Example: Aviation
- **High-Hz (critical phases)**: Flight control, stall prevention, terrain avoidance
  - Uses: Preprocessed flight envelope, cached navigation data, precomputed emergency procedures
- **Low-Hz (cruise, holding)**: Weather analysis, route optimization, fuel calculations
  - Does: Expensive computations, data fusion, predictive modeling

## Mapping to Browser Temporal Note-Taking

### Current State: Synchronous Processing
Our current implementation processes temporal notes **synchronously** when needed:
- `aggregateTemporalNotes()` - called on-demand, blocks until complete
- `aggregateMultiScale()` - expensive multi-scale aggregation done synchronously
- `calculateCoherence()` - coherence calculation done synchronously
- `pruneTemporalNotes()` - pruning done synchronously

**Problem**: During high-activity periods (rapid user interactions, fast state changes), we're doing expensive operations synchronously, potentially causing latency.

### Proposed: Preprocessing Pattern

#### High-Hz Periods (Reactive, Critical)
**When**: User actively interacting, rapid state changes, immediate decisions needed
- **Frequency**: 10-60Hz (every 16-100ms)
- **Operations**: 
  - Fast note capture (timestamp, basic metadata)
  - Use preprocessed aggregations
  - Quick decisions using cached coherence scores
  - Lightweight weight calculations
- **Latency Budget**: <50ms per operation

#### Low-Hz Periods (Idle, Stable)
**When**: User reading, page loading, stable state, no interactions
- **Frequency**: 0.1-1Hz (every 1-10 seconds)
- **Operations**:
  - Expensive multi-scale aggregation
  - Coherence calculation across all windows
  - Note pruning and relevance scoring
  - Pattern identification (trends, conflicts)
  - Temporal decision context updates
- **Latency Budget**: 100-1000ms acceptable

## Implementation Strategy

### 1. Activity Detection

```javascript
class ActivityDetector {
  detectActivityLevel(temporalNotes, recentWindow = 5000) {
    const recent = temporalNotes.filter(n => 
      Date.now() - n.timestamp < recentWindow
    );
    
    const noteRate = recent.length / (recentWindow / 1000); // notes per second
    
    if (noteRate > 10) return 'high'; // >10 notes/sec = high activity
    if (noteRate > 1) return 'medium'; // 1-10 notes/sec = medium
    return 'low'; // <1 note/sec = low (idle)
  }
  
  hasUserInteraction(notes) {
    return notes.some(n => 
      n.step?.includes('click') || 
      n.step?.includes('interaction') ||
      n.observation?.includes('user action')
    );
  }
  
  isStableState(notes, window = 2000) {
    // Check if state hasn't changed significantly
    const recent = notes.slice(-5);
    const scores = recent.map(n => n.score || n.gameState?.score || 0);
    const variance = calculateVariance(scores);
    return variance < 0.5; // Low variance = stable
  }
}
```

### 2. Preprocessing Manager

```javascript
class TemporalPreprocessingManager {
  constructor() {
    this.preprocessedCache = {
      aggregated: null,
      multiScale: null,
      coherence: null,
      prunedNotes: null,
      patterns: null,
      lastPreprocessTime: 0
    };
    this.preprocessInterval = 2000; // Preprocess every 2s during low activity
    this.activityDetector = new ActivityDetector();
  }
  
  /**
   * Fast path: Use preprocessed data during high activity
   */
  getFastAggregation(notes) {
    // Return cached if recent and activity is high
    const activity = this.activityDetector.detectActivityLevel(notes);
    if (activity === 'high' && this.isCacheValid()) {
      return this.preprocessedCache.aggregated;
    }
    
    // Fallback to synchronous if cache invalid
    return aggregateTemporalNotes(notes);
  }
  
  /**
   * Background preprocessing during low activity
   */
  async preprocessInBackground(notes) {
    const activity = this.activityDetector.detectActivityLevel(notes);
    
    // Only preprocess during low/medium activity
    if (activity === 'high') {
      return; // Skip preprocessing, use cache
    }
    
    // Do expensive operations
    const aggregated = aggregateTemporalNotes(notes);
    const multiScale = aggregateMultiScale(notes);
    const coherence = aggregated.coherence;
    const prunedNotes = pruneTemporalNotes(notes, { maxNotes: 20 });
    const patterns = identifyPatterns(notes);
    
    // Update cache
    this.preprocessedCache = {
      aggregated,
      multiScale,
      coherence,
      prunedNotes,
      patterns,
      lastPreprocessTime: Date.now()
    };
  }
  
  isCacheValid(maxAge = 5000) {
    return Date.now() - this.preprocessedCache.lastPreprocessTime < maxAge;
  }
}
```

### 3. Adaptive Processing Strategy

```javascript
class AdaptiveTemporalProcessor {
  constructor() {
    this.preprocessor = new TemporalPreprocessingManager();
    this.activityDetector = new ActivityDetector();
  }
  
  /**
   * Smart processing: route to fast or expensive path based on activity
   */
  async processNotes(notes, options = {}) {
    const activity = this.activityDetector.detectActivityLevel(notes);
    const hasInteraction = this.activityDetector.hasUserInteraction(notes);
    const isStable = this.activityDetector.isStableState(notes);
    
    // High activity + interaction = use cache, fast path only
    if (activity === 'high' && hasInteraction) {
      return {
        aggregated: this.preprocessor.getFastAggregation(notes),
        source: 'cache',
        latency: '<10ms'
      };
    }
    
    // Low activity + stable = do expensive preprocessing
    if (activity === 'low' && isStable) {
      await this.preprocessor.preprocessInBackground(notes);
      return {
        aggregated: this.preprocessor.preprocessedCache.aggregated,
        source: 'preprocessed',
        latency: '100-1000ms (background)'
      };
    }
    
    // Medium activity = hybrid: use cache if valid, else compute
    if (this.preprocessor.isCacheValid()) {
      return {
        aggregated: this.preprocessor.getFastAggregation(notes),
        source: 'cache',
        latency: '<10ms'
      };
    } else {
      // Compute synchronously but lighter version
      return {
        aggregated: aggregateTemporalNotes(notes, { 
          windowSize: 10000, // Larger windows = faster
          skipCoherence: false // Still need coherence
        }),
        source: 'computed',
        latency: '50-200ms'
      };
    }
  }
}
```

## Hz-Based Processing Tiers

### Tier 1: Ultra-High Hz (100-200Hz) - Critical Reactions
**When**: Immediate danger, critical state changes
- **Operations**: Raw note capture only
- **Preprocessing**: None (use last known good state)
- **Latency**: <5ms

### Tier 2: High Hz (10-60Hz) - Active Interactions
**When**: User clicking, rapid state changes, active gameplay
- **Operations**: 
  - Fast note capture
  - Lightweight weight calculation
  - Use preprocessed aggregations
- **Preprocessing**: None (use cache from low-Hz period)
- **Latency**: <50ms

### Tier 3: Medium Hz (1-10Hz) - Normal Activity
**When**: Normal browsing, moderate interactions
- **Operations**:
  - Note capture
  - Single-scale aggregation (if cache invalid)
  - Pattern detection (lightweight)
- **Preprocessing**: Light preprocessing if cache stale
- **Latency**: 50-200ms

### Tier 4: Low Hz (0.1-1Hz) - Idle/Stable
**When**: User reading, page loading, stable state
- **Operations**:
  - Full multi-scale aggregation
  - Coherence calculation
  - Note pruning
  - Pattern identification
  - Temporal decision context updates
- **Preprocessing**: Full background preprocessing
- **Latency**: 100-1000ms (background, non-blocking)

## Integration with Temporal Decision Manager

The `TemporalDecisionManager` should be aware of preprocessing state:

```javascript
class EnhancedTemporalDecisionManager extends TemporalDecisionManager {
  constructor(options = {}) {
    super(options);
    this.preprocessor = new TemporalPreprocessingManager();
  }
  
  shouldPrompt(currentState, previousState, temporalNotes, context = {}) {
    // Check if we have preprocessed data
    const activity = this.preprocessor.activityDetector.detectActivityLevel(temporalNotes);
    
    // During high activity, use preprocessed coherence
    if (activity === 'high' && this.preprocessor.isCacheValid()) {
      const coherence = this.preprocessor.preprocessedCache.coherence;
      // Use cached coherence for decision
    } else {
      // Compute coherence synchronously (slower)
      const aggregated = aggregateTemporalNotes(temporalNotes);
      const coherence = aggregated.coherence;
    }
    
    // Rest of decision logic...
  }
}
```

## Research Alignment

### From Deep Research Findings

1. **arXiv:2406.12125 (Sequential Decision Making)**:
   - Research: Only 1.5% LLM calls needed through strategic selection
   - Application: Preprocess during low-Hz, use preprocessed data during high-Hz
   - Reduces expensive LLM calls by doing aggregation/preprocessing offline

2. **arXiv:2505.13326 (SART - Short and Right)**:
   - Research: Early stopping, redundant sampling with pruning
   - Application: During low-Hz, do full preprocessing. During high-Hz, use preprocessed summaries
   - Avoids expensive operations during critical moments

3. **Decision Logic Research**:
   - Research: Don't prompt on every state change, prompt when decision needed
   - Application: During high-Hz, use cached decisions. During low-Hz, update decision logic
   - Separates expensive decision updates from fast decision application

## Practical Implementation

### Step 1: Activity Monitoring
Add activity detection to note capture:

```javascript
// In note capture code
const activity = detectActivityLevel(recentNotes);
if (activity === 'low') {
  // Trigger background preprocessing
  scheduleBackgroundPreprocessing(notes);
}
```

### Step 2: Background Preprocessing Queue
Use `requestIdleCallback` or similar for background work:

```javascript
function scheduleBackgroundPreprocessing(notes) {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      preprocessor.preprocessInBackground(notes);
    }, { timeout: 2000 });
  } else {
    // Fallback: setTimeout with low priority
    setTimeout(() => {
      preprocessor.preprocessInBackground(notes);
    }, 100);
  }
}
```

### Step 3: Cache Invalidation Strategy
Invalidate cache when:
- New notes added (but only if significant change)
- State changes significantly
- Cache age exceeds threshold
- User interaction detected

### Step 4: Graceful Degradation
If preprocessing fails or cache invalid:
- Fall back to synchronous computation
- Use lighter algorithms (single-scale instead of multi-scale)
- Skip non-critical operations (pattern detection, conflict analysis)

## Metrics and Monitoring

Track:
- **Preprocessing hit rate**: % of requests served from cache
- **Latency by activity level**: Average latency for high/medium/low Hz
- **Cache freshness**: Time since last preprocessing
- **Preprocessing overhead**: CPU time spent in background preprocessing
- **Decision quality**: Compare cached vs. computed decisions

## Benefits

1. **Reduced Latency**: Fast path during high activity (<50ms vs. 200-1000ms)
2. **Better UX**: No blocking during user interactions
3. **Resource Efficiency**: Expensive operations only during idle periods
4. **Scalability**: Can handle higher note-taking frequencies
5. **Research Alignment**: Matches patterns from high-stakes domains

## Challenges

1. **Cache Coherence**: Ensuring cached data reflects current state
2. **Staleness**: Balancing cache freshness vs. preprocessing frequency
3. **Memory**: Caching preprocessed data increases memory usage
4. **Complexity**: Adds another layer of abstraction
5. **Testing**: Harder to test async preprocessing vs. synchronous

## Next Steps

1. Implement `ActivityDetector` class
2. Implement `TemporalPreprocessingManager` class
3. Integrate with existing `aggregateTemporalNotes` and `aggregateMultiScale`
4. Add background preprocessing scheduling
5. Add cache invalidation logic
6. Add metrics and monitoring
7. Test with high-Hz scenarios (rapid interactions)
8. Benchmark latency improvements

