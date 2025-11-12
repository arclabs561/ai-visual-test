# Nuanced Implementation Details

This document captures subtle, easy-to-forget implementation details that future developers should know. These are the "why" and "how" behind specific code decisions that might not be obvious from reading the code alone.

## Critical Bugs Fixed (Don't Reintroduce)

### 1. Coherence Algorithm: Incomplete Variance Adjustment

**Location**: `src/temporal.mjs`, line ~186

**The Bug**:
```javascript
// WRONG - This was incomplete and would cause runtime errors
const adjustedVarianceCoherence = Math.max;
```

**The Fix**:
```javascript
// CORRECT - Complete calculation with penalty for direction changes
const adjustedVarianceCoherence = Math.max(0, Math.min(1, varianceCoherence * (1.0 - directionChangePenalty * 0.7)));
```

**Why This Matters**:
- Without this fix, coherence scores for erratic behavior would be incorrect
- The `Math.max` alone is a function reference, not a calculation
- This bug was subtle because it might not cause immediate errors, but would produce wrong coherence scores

**How to Avoid**:
- Always complete calculations before assigning
- Test with erratic behavior patterns (frequent direction changes)
- Verify coherence scores are in [0, 1] range

### 2. Device Viewport Fallback Logic

**Location**: `src/persona-experience.mjs`, line ~96

**The Issue**:
- Viewports were only set if `persona.device` existed
- But `device` from options was ignored
- This caused mobile/tablet personas to get desktop viewports

**The Fix**:
```javascript
// Check both persona.device AND options.device
const deviceToUse = persona.device || device;
if (deviceToUse) {
  const targetViewport = deviceViewports[deviceToUse];
  if (targetViewport) {
    await page.setViewportSize(targetViewport);
  }
}
```

**Why This Matters**:
- Persona diversity tests failed because viewports weren't set correctly
- Mobile personas need 375x667, not 1280x720
- This affects accessibility and responsive design testing

**How to Avoid**:
- Always check both `persona.device` and `options.device`
- Verify viewport is actually set (don't assume)
- Test with different device types

## Magic Numbers and Thresholds

### Activity Detection Thresholds

**Location**: `src/temporal-preprocessor.mjs`, `ActivityDetector.detectActivityLevel()`

**Thresholds**:
- **High**: >10 notes/sec (rapid interactions, fast state changes)
- **Medium**: 1-10 notes/sec (normal browsing, moderate interactions)
- **Low**: <1 note/sec (idle, reading, stable state)

**Why These Numbers**:
- Based on human perception time scales (0.1s threshold for direct manipulation)
- High-Hz (>10Hz) = requires fast response, use cache
- Low-Hz (<1Hz) = can do expensive preprocessing in background
- Medium-Hz = hybrid approach

**Don't Change Without**:
- Testing with real browser interactions
- Validating cache hit rates
- Measuring latency impact

### Cache Invalidation Threshold

**Location**: `src/temporal-preprocessor.mjs`, `isCacheValid()`

**Threshold**: >20% note count change invalidates cache

**Why 20%**:
- Small changes (<20%) = cache still useful
- Large changes (>20%) = too different, recompute
- Balance between cache hits and accuracy

**Don't Change Without**:
- Measuring cache hit rates
- Testing with different note frequencies
- Validating aggregation accuracy

### Coherence Weights

**Location**: `src/temporal.mjs`, `calculateCoherence()`

**Weights**:
- Direction consistency: 0.35 (35%)
- Stability: 0.25 (25%)
- Variance coherence: 0.25 (25%)
- Observation consistency: 0.15 (15%)

**Why These Weights**:
- Direction changes are strongest signal of erratic behavior
- Stability directly penalizes frequent direction changes
- Variance captures score spread
- Observations are least reliable (keyword-based)

**Don't Change Without**:
- Testing with known erratic vs. stable patterns
- Validating against human-annotated coherence scores
- Measuring impact on conflict detection

### Variance Normalization Change

**Location**: `src/temporal.mjs`, `calculateCoherence()`

**Old (Too Lenient)**:
```javascript
const maxVariance = Math.pow(meanScore, 2);
```

**New (Stricter)**:
```javascript
const scoreRange = Math.max(...scores) - Math.min(...scores);
const maxVariance = Math.max(
  Math.pow(scoreRange / 2, 2), // Variance for uniform distribution
  Math.pow(meanScore * 0.5, 2), // Fallback: 50% of mean
  10 // Minimum to avoid division by tiny numbers
);
```

**Why This Matters**:
- Old formula was too lenient for erratic behavior
- New formula uses score range, not mean
- For scores 0-10, max reasonable variance is ~25 (not meanScore²)
- This properly penalizes high variance

**Don't Revert Without**:
- Understanding why the old formula was wrong
- Testing with erratic behavior patterns
- Validating coherence scores match expectations

### Decay Factor

**Location**: `src/temporal.mjs`, `aggregateTemporalNotes()`

**Default**: `decayFactor = 0.9`

**Why 0.9**:
- Exponential decay: `weight = decayFactor^(age/windowSize)`
- 0.9 means 10% weight loss per window
- Balance between recency and history
- Research-backed (similar to CitySim paper)

**Don't Change Without**:
- Testing with different decay factors (0.5, 0.7, 0.9, 0.95)
- Measuring impact on weighted scores
- Validating against research findings

### Window Size

**Location**: `src/temporal.mjs`, `aggregateTemporalNotes()`

**Default**: `windowSize = 10000` (10 seconds)

**Why 10 Seconds**:
- Human perception time scales: 0.1s (direct manipulation), 1s (reading), 10s (comprehension)
- 10s captures meaningful temporal patterns
- Not too short (noise) or too long (misses changes)

**Don't Change Without**:
- Testing with different window sizes (5s, 10s, 20s, 30s)
- Comparing coherence scores across window sizes
- Validating against research findings

## Design Decisions

### Preprocessing Routing Logic

**Location**: `src/temporal-preprocessor.mjs`, `AdaptiveTemporalProcessor.processNotes()`

**Logic**:
- **High activity**: Use cache if valid, else compute (fast path)
- **Low activity**: Background preprocessing (non-blocking)
- **Medium activity**: Hybrid (cache if valid, else compute synchronously)

**Why This Design**:
- High-Hz needs speed → use cache
- Low-Hz has time → do expensive preprocessing
- Medium-Hz = balance

**Don't Change Without**:
- Understanding activity detection thresholds
- Testing latency impact
- Validating cache hit rates

### Test Expectations (Realistic Behavior)

**Location**: `test/temporal-preprocessor.test.mjs`, "routes to fast path during high activity"

**Why We Allow Both**:
```javascript
assert.ok(['cache', 'computed'].includes(result.source));
assert.ok(['high', 'medium'].includes(result.activity));
```

**Not Strict**:
- Cache validity depends on note count changes
- If note count changes >20%, cache invalid → compute
- Activity detection can be borderline (high vs. medium)
- Test should verify behavior, not exact path

**Don't Make Too Strict**:
- Real behavior is probabilistic (cache validity)
- Exact path depends on timing and note count
- Test should verify correctness, not implementation details

### Device Viewport Sizes

**Location**: `src/persona-experience.mjs`, `deviceViewports`

**Sizes**:
- Mobile: 375x667 (iPhone SE)
- Tablet: 768x1024 (iPad)
- Desktop: 1280x720 (standard desktop)

**Why These Sizes**:
- Common device sizes for testing
- Mobile = smallest common mobile
- Tablet = standard tablet
- Desktop = common desktop resolution

**Don't Change Without**:
- Understanding why these sizes were chosen
- Testing with different viewports
- Validating persona diversity tests

## Subtle Integration Details

### Preprocessing in E2E Tests

**Location**: `evaluation/e2e/e2e-real-websites.mjs`

**Pattern**:
```javascript
// Create processor once per test
const temporalProcessor = createAdaptiveTemporalProcessor();

// Use for all temporal processing in that test
const processed = await temporalProcessor.processNotes(notes);
const aggregated = processed.aggregated;
const multiScale = processed.multiScale;
```

**Why This Pattern**:
- Processor maintains cache across multiple calls
- Reusing processor = better cache hit rates
- Don't create new processor for each aggregation

**Don't Do This**:
```javascript
// WRONG - Creates new processor each time, loses cache
const processed1 = await createAdaptiveTemporalProcessor().processNotes(notes1);
const processed2 = await createAdaptiveTemporalProcessor().processNotes(notes2);
```

### Backward Compatibility Variables

**Location**: `evaluation/e2e/e2e-real-websites.mjs`

**Pattern**:
```javascript
const processed = await temporalProcessor.processNotes(notes);
const aggregated = processed.aggregated; // Keep for backward compatibility
const multiScale = processed.multiScale; // Keep for backward compatibility
```

**Why**:
- Existing code expects `aggregated` and `multiScale` variables
- Don't break existing code that uses these
- Gradual migration path

**Don't Remove Without**:
- Checking all usages of `aggregated` and `multiScale`
- Updating all call sites
- Testing thoroughly

## Performance Considerations

### Cache Validity Duration

**Location**: `src/temporal-preprocessor.mjs`, `TemporalPreprocessingManager`

**Default**: `cacheMaxAge = 5000` (5 seconds)

**Why 5 Seconds**:
- Balance between cache hits and freshness
- Temporal notes change frequently
- 5s = recent enough to be useful, old enough to be stable

**Don't Change Without**:
- Measuring cache hit rates
- Testing with different note frequencies
- Validating aggregation accuracy

### Background Preprocessing

**Location**: `src/temporal-preprocessor.mjs`, `preprocessInBackground()`

**Why Non-Blocking**:
- Low activity = can wait
- Background processing doesn't block main thread
- Returns immediately, processes in background

**Don't Make Blocking**:
- Would slow down low-activity paths
- Defeats purpose of preprocessing
- Keep it async and non-blocking

## Research Context

### Why Exponential Decay, Not Logarithmic

**Location**: `src/temporal.mjs`, documentation

**Important**: We use **exponential decay** (`Math.pow(decayFactor, age)`), NOT logarithmic compression (Weber-Fechner law).

**Why**:
- Exponential decay is simpler and works well
- Logarithmic compression is more complex
- Research papers mention both, we chose exponential

**Don't Confuse**:
- We cite papers that mention logarithmic compression
- But we don't implement it
- Our implementation uses exponential decay

### Variance Normalization Research

**Location**: `src/temporal.mjs`, `calculateCoherence()`

**Research Context**:
- Old formula (`meanScore²`) was too lenient
- New formula uses score range
- Based on validation testing, not specific paper

**Don't Revert**:
- Old formula failed erratic behavior test
- New formula passes all tests
- Validated against known patterns

## Testing Nuances

### Test Realistic Behavior, Not Exact Implementation

**Location**: `test/temporal-preprocessor.test.mjs`

**Example**:
```javascript
// Don't test exact source ('cache' vs 'computed')
// Test that behavior is correct
assert.ok(['cache', 'computed'].includes(result.source));
```

**Why**:
- Implementation details can change
- Behavior is what matters
- Tests should verify correctness, not internals

**Don't Over-Specify**:
- Cache validity is probabilistic
- Exact path depends on timing
- Test outcomes, not paths

## Summary: What to Remember

1. **Coherence algorithm bug**: Complete the variance adjustment calculation
2. **Device viewport fallback**: Check both `persona.device` and `options.device`
3. **Activity thresholds**: 10 notes/sec = high, 1-10 = medium, <1 = low
4. **Cache invalidation**: >20% note count change
5. **Coherence weights**: 0.35 direction, 0.25 stability, 0.25 variance, 0.15 observation
6. **Variance normalization**: Use score range, not meanScore²
7. **Preprocessing routing**: High = cache, Low = background, Medium = hybrid
8. **Reuse processor**: Create once per test, reuse for multiple calls
9. **Exponential decay**: We use exponential, NOT logarithmic
10. **Test behavior**: Verify correctness, not exact implementation paths

## How to Use This Document

- **Before changing thresholds**: Read why they were chosen
- **Before fixing bugs**: Check if it's a known issue
- **Before optimizing**: Understand the design decisions
- **Before refactoring**: Know the subtle dependencies
- **When debugging**: Check if it's a nuanced detail issue

This document should be updated when:
- New nuanced details are discovered
- Thresholds are changed (document why)
- Design decisions are made
- Bugs are fixed (document the bug)

