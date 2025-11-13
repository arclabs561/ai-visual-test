# Coherence Algorithm: Implementation Details and Invariants

## Overview

The coherence calculation in `src/temporal.mjs` measures how consistent temporal notes are over time. This document explains the complex reasoning behind the algorithm to prevent future breakage.

## Critical Invariants

### 1. Variance Calculation Must Divide by N

**Location**: `src/temporal.mjs:187`

```javascript
const variance = scores.reduce((sum, score) => sum + Math.pow(score - meanScore, 2), 0) / scores.length;
```

**Why**: Variance is the average of squared differences, not the sum. Without dividing by `scores.length`, the calculation would be incorrect and coherence would be wrong.

**What breaks if changed**: Coherence scores would be systematically wrong, making erratic behavior appear more coherent than it is.

### 2. MaxVariance Calculation Uses Score Range, Not Mean

**Location**: `src/temporal.mjs:190-194`

```javascript
const maxVariance = Math.max(
  Math.pow(scoreRange / 2, 2), // Variance for uniform distribution over range
  Math.pow(meanScore * 0.5, 2), // Fallback: 50% of mean as standard deviation
  10 // Minimum to avoid division by tiny numbers
);
```

**Why**: 
- Using `meanScore²` was too lenient (e.g., mean=5 → maxVariance=25, but scores 0-10 have range=10)
- Score range better captures actual variance in the data
- For scores 0-10, max reasonable variance is ~25 (when scores vary uniformly from 0 to 10)
- The minimum of 10 prevents division by tiny numbers when variance is very small

**What breaks if changed**: Coherence would be incorrectly normalized, making some patterns appear more or less coherent than they actually are.

### 3. Direction Change Penalty Multiplier (0.7)

**Location**: `src/temporal.mjs:210`

```javascript
const adjustedVarianceCoherence = Math.max(0, Math.min(1, varianceCoherence * (1.0 - directionChangePenalty * 0.7)));
```

**Why**: 
- The 0.7 multiplier means direction changes reduce variance coherence by up to 70%
- This was increased from 0.5 to be more aggressive at detecting erratic behavior
- Direction changes are a strong signal of erratic behavior

**What breaks if changed**: Erratic behavior (frequent direction changes) might not be properly penalized, leading to incorrect coherence scores.

**Historical bug**: The calculation was incomplete: `const adjustedVarianceCoherence = Math.max;` (just a function reference). This was fixed in 2025-01.

### 4. Coherence Weight Distribution

**Location**: `src/temporal.mjs:280-285`

```javascript
const coherence = (
  directionConsistency * 0.35 +
  stability * 0.25 +
  adjustedVarianceCoherence * 0.25 +
  observationConsistency * 0.15
);
```

**Rationale**:
- **Direction (0.35)**: Strongest signal of erratic behavior, most reliable
- **Stability (0.25)**: Directly measures direction change frequency
- **Variance (0.25)**: Captures score spread, adjusted for direction changes
- **Observation (0.15)**: Least reliable (keyword-based), lowest weight

**What breaks if changed**: 
- Changing weights without validation could make coherence scores incorrect
- Must test with known erratic vs. stable patterns
- Must validate against human-annotated coherence scores
- Must measure impact on conflict detection

### 5. Edge Cases and Boundary Conditions

**Early returns**:
- `if (windows.length < 2) return 1.0;` - Single window is always coherent
- `if (scores.length < 2) return 1.0;` - Need at least 2 scores to measure consistency

**NaN/Infinity handling**:
- `const clamped = Math.max(0, Math.min(1, isNaN(coherence) || !isFinite(coherence) ? 0.5 : coherence));`
- Returns 0.5 (neutral) for invalid calculations rather than crashing

**What breaks if changed**: Edge cases would cause crashes or incorrect coherence scores.

## Window Weight Calculation

**Location**: `src/temporal.mjs:84`

```javascript
const weight = Math.pow(decayFactor, age / windowSize);
```

**Why**: Exponential decay gives more weight to recent notes. The `age / windowSize` normalization ensures decay is consistent regardless of window size.

**What breaks if changed**: Temporal weighting would be incorrect, making older notes too important or too unimportant.

## Testing Requirements

Any changes to the coherence algorithm must:
1. Pass existing tests in `test/temporal.test.mjs` (especially `calculateCoherence` tests)
2. Test with known erratic patterns (should produce low coherence)
3. Test with known stable patterns (should produce high coherence)
4. Validate against human-annotated coherence scores if available
5. Measure impact on conflict detection

## Related Code

- `test/temporal.test.mjs` - Tests for coherence calculation
- `src/temporal.mjs:151-290` - Full coherence implementation
- `src/constants.mjs` - Default values (windowSize, decayFactor, coherenceThreshold)

