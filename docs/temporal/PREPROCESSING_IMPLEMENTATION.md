# Preprocessing Implementation: Driving/Aviation Patterns for Browser Temporal Note-Taking

## Overview

This document describes the implementation of preprocessing patterns from high-stakes, low-latency domains (autonomous driving, aviation) applied to browser temporal note-taking. The core insight: **preprocess expensive operations during low-Hz periods (idle, reading, stable) and use preprocessed data during high-Hz periods (rapid interactions, fast state changes)**.

## The Problem

Our current implementation processes temporal notes **synchronously** when needed:
- `aggregateTemporalNotes()` - blocks until complete
- `aggregateMultiScale()` - expensive multi-scale aggregation done synchronously
- `calculateCoherence()` - coherence calculation done synchronously
- `pruneTemporalNotes()` - pruning done synchronously

**Issue**: During high-activity periods (rapid user interactions, fast state changes), we're doing expensive operations synchronously, potentially causing latency.

## The Solution: Preprocessing Pattern

### Activity Detection

The system detects activity level based on note frequency:

- **High-Hz (10-60Hz)**: >10 notes/sec - rapid interactions, fast state changes
- **Medium-Hz (1-10Hz)**: 1-10 notes/sec - normal browsing, moderate interactions
- **Low-Hz (0.1-1Hz)**: <1 note/sec - idle, reading, stable state

### Processing Tiers

#### Tier 1: Ultra-High Hz (100-200Hz) - Critical Reactions
**When**: Immediate danger, critical state changes
- **Operations**: Raw note capture only
- **Preprocessing**: None (use last known good state)
- **Latency**: <5ms

#### Tier 2: High Hz (10-60Hz) - Active Interactions
**When**: User clicking, rapid state changes, active gameplay
- **Operations**: 
  - Fast note capture
  - Lightweight weight calculation
  - Use preprocessed aggregations from cache
- **Preprocessing**: None (use cache from low-Hz period)
- **Latency**: <50ms

#### Tier 3: Medium Hz (1-10Hz) - Normal Activity
**When**: Normal browsing, moderate interactions
- **Operations**:
  - Note capture
  - Single-scale aggregation (if cache invalid)
  - Pattern detection (lightweight)
- **Preprocessing**: Light preprocessing if cache stale
- **Latency**: 50-200ms

#### Tier 4: Low Hz (0.1-1Hz) - Idle/Stable
**When**: User reading, page loading, stable state
- **Operations**:
  - Full multi-scale aggregation
  - Coherence calculation
  - Note pruning
  - Pattern identification
  - Temporal decision context updates
- **Preprocessing**: Full background preprocessing
- **Latency**: 100-1000ms (background, non-blocking)

## Implementation

### Core Components

1. **`ActivityDetector`**: Detects activity level from temporal notes
   - `detectActivityLevel()` - calculates note rate (notes/sec)
   - `hasUserInteraction()` - checks for user actions
   - `isStableState()` - checks if state is stable (low variance)

2. **`TemporalPreprocessingManager`**: Manages preprocessing and caching
   - `preprocessInBackground()` - expensive operations during low activity
   - `getFastAggregation()` - fast path using cache
   - `isCacheValid()` - checks cache freshness
   - Cache includes: aggregated notes, multi-scale, coherence, pruned notes, patterns

3. **`AdaptiveTemporalProcessor`**: Routes processing based on activity
   - `processNotes()` - smart routing to fast or expensive path
   - Returns metadata: source (cache/preprocessed/computed), latency, activity level

### Usage Example

```javascript
import { createAdaptiveTemporalProcessor } from './temporal-preprocessor.mjs';

const processor = createAdaptiveTemporalProcessor({
  preprocessInterval: 2000, // Preprocess every 2s during low activity
  cacheMaxAge: 5000 // Cache valid for 5s
});

// During high activity (rapid interactions)
const result = await processor.processNotes(notes, {
  windowSize: 10000,
  decayFactor: 0.9
});

// Result includes:
// - aggregated: preprocessed aggregation (from cache if high activity)
// - multiScale: multi-scale aggregation
// - prunedNotes: pruned notes
// - source: 'cache' | 'preprocessed' | 'computed'
// - latency: '<10ms' | '100-1000ms (background)' | '50-200ms'
// - activity: 'high' | 'medium' | 'low'
// - metadata: cache age, note count, etc.
```

### Integration with Existing Code

The preprocessing manager can be integrated with existing temporal functions:

```javascript
import { createTemporalPreprocessingManager } from './temporal-preprocessor.mjs';
import { TemporalDecisionManager } from './temporal-decision-manager.mjs';

const preprocessor = createTemporalPreprocessingManager();
const decisionManager = new TemporalDecisionManager();

// Enhanced decision manager that uses preprocessing
class EnhancedTemporalDecisionManager extends TemporalDecisionManager {
  constructor(options = {}) {
    super(options);
    this.preprocessor = createTemporalPreprocessingManager(options);
  }
  
  shouldPrompt(currentState, previousState, temporalNotes, context = {}) {
    const activity = this.preprocessor.activityDetector.detectActivityLevel(temporalNotes);
    
    // During high activity, use preprocessed coherence
    if (activity === 'high' && this.preprocessor.isCacheValid(temporalNotes)) {
      const coherence = this.preprocessor.preprocessedCache.coherence;
      // Use cached coherence for decision
    } else {
      // Compute coherence synchronously (slower)
      const aggregated = aggregateTemporalNotes(temporalNotes);
      const coherence = aggregated.coherence;
    }
    
    // Rest of decision logic...
    return super.shouldPrompt(currentState, previousState, temporalNotes, context);
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

## Benefits

1. **Reduced Latency**: Fast path during high activity (<50ms vs. 200-1000ms)
2. **Better UX**: No blocking during user interactions
3. **Resource Efficiency**: Expensive operations only during idle periods
4. **Scalability**: Can handle higher note-taking frequencies
5. **Research Alignment**: Matches patterns from high-stakes domains

## Metrics and Monitoring

Track:
- **Preprocessing hit rate**: % of requests served from cache
- **Latency by activity level**: Average latency for high/medium/low Hz
- **Cache freshness**: Time since last preprocessing
- **Preprocessing overhead**: CPU time spent in background preprocessing
- **Decision quality**: Compare cached vs. computed decisions

## Next Steps

1. ✅ Implement `ActivityDetector` class
2. ✅ Implement `TemporalPreprocessingManager` class
3. ✅ Implement `AdaptiveTemporalProcessor` class
4. ⏳ Integrate with existing `aggregateTemporalNotes` and `aggregateMultiScale`
5. ⏳ Add background preprocessing scheduling (requestIdleCallback)
6. ⏳ Add cache invalidation logic
7. ⏳ Add metrics and monitoring
8. ⏳ Test with high-Hz scenarios (rapid interactions)
9. ⏳ Benchmark latency improvements

## Files

- **`src/temporal-preprocessor.mjs`**: Core preprocessing implementation
- **`docs/temporal/PREPROCESSING_LATENCY_PATTERNS.md`**: Detailed pattern documentation
- **`docs/temporal/PREPROCESSING_IMPLEMENTATION.md`**: This file

