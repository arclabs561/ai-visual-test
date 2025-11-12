# Test Critique and Harmonization

## Overview

This document critiques whether our tests are actually doing what they're supposed to, identifies missing tests for critical bugs and edge cases, and documents the harmonization process.

## Critical Test Gaps

### 1. Cache Tests (`test/cache.test.mjs`)

#### Missing Tests for Critical Bug Fixes

**❌ Timestamp Preservation (Timestamp Reset Bug)**
- **Bug Fixed**: Timestamps were reset to `now` on every save, breaking 7-day expiration
- **Fix**: Preserve `_originalTimestamp` for expiration, use `_lastAccessed` for LRU
- **Missing Test**: No test verifies that:
  - Old entries maintain their original timestamp after save/load
  - Expiration works correctly based on `_originalTimestamp` (not `_lastAccessed`)
  - New entries get `timestamp: now`, old entries preserve `_originalTimestamp`

**❌ Full Content Hashing (Cache Key Truncation Bug)**
- **Bug Fixed**: Prompts and gameState were truncated, causing collisions
- **Fix**: Hash full content with SHA-256, no truncation
- **Missing Test**: No test verifies that:
  - Prompts longer than 1000 chars generate different keys
  - Game states longer than 500 chars generate different keys
  - Identical full content generates same key (even if truncated versions would differ)

**❌ LRU Eviction with `_lastAccessed`**
- **Behavior**: LRU eviction sorts by `_lastAccessed`, not `timestamp`
- **Missing Test**: No test verifies that:
  - Least recently accessed entries are evicted first
  - Accessing an entry updates `_lastAccessed` but not `_originalTimestamp`
  - LRU eviction works independently of expiration

**❌ Expiration Based on `_originalTimestamp`**
- **Behavior**: Expiration checks `_originalTimestamp`, not `_lastAccessed`
- **Missing Test**: No test verifies that:
  - Entry expires after 7 days based on creation time (`_originalTimestamp`)
  - Entry does NOT expire if recently accessed but old (`_lastAccessed` updated, `_originalTimestamp` old)
  - Entry expires even if never accessed (only `_originalTimestamp` matters)

#### Edge Cases Not Tested

- **Concurrent writes**: Cache write lock behavior
- **Cache size limits**: LRU eviction when exceeding MAX_CACHE_SIZE
- **Cache file size limits**: Eviction when exceeding MAX_CACHE_SIZE_BYTES
- **Corrupted cache file**: Recovery from invalid JSON
- **Empty cache file**: Handling of empty or missing cache
- **Very large prompts/gameState**: Performance with huge content

### 2. Temporal Tests (`test/temporal.test.mjs`)

#### Missing Tests for Critical Bug Fixes

**❌ Adjusted Variance Coherence Calculation**
- **Bug Fixed**: `adjustedVarianceCoherence` was incomplete (`Math.max` without arguments)
- **Fix**: Complete calculation with direction change penalty
- **Missing Test**: No test verifies that:
  - Direction changes reduce variance coherence
  - Erratic behavior (frequent direction changes) produces low coherence
  - The 0.7 multiplier for direction change penalty works correctly

**❌ Score Range vs Mean Score²**
- **Bug Fixed**: Changed from `meanScore²` to `scoreRange` for maxVariance calculation
- **Fix**: Use score range to better capture variance
- **Missing Test**: No test verifies that:
  - Score range properly normalizes variance
  - Erratic scores (wide range) produce lower coherence
  - The change from meanScore² to scoreRange produces different (more accurate) results

**❌ Direction Change Penalty**
- **Behavior**: Direction changes reduce coherence by up to 70%
- **Missing Test**: No test verifies that:
  - Up→down→up patterns produce lower coherence than consistent trends
  - The penalty is proportional to direction change frequency
  - The 0.7 multiplier is applied correctly

#### Edge Cases Not Tested

- **Empty windows**: Coherence calculation with no valid scores
- **NaN/Infinity scores**: Handling of invalid scores
- **Single window**: Coherence = 1.0 (tested, but could be more explicit)
- **Extreme variance**: Very high variance scores
- **All identical scores**: Perfect coherence (1.0)

### 3. Temporal Preprocessor Tests (`test/temporal-preprocessor.test.mjs`)

#### Missing Tests for Critical Limitations

**❌ Cache Validity Only Checks Count, Not Content**
- **Documented Bug**: `isCacheValid()` only checks note count, not note content
- **Impact**: Cache might be used when notes changed but count didn't
- **Missing Test**: No test verifies that:
  - Cache is considered valid when note count unchanged but content changed
  - This is a known limitation (not a bug, but should be tested)

**❌ "Incremental Aggregation" is a Lie**
- **Documented Bug**: `_incrementalAggregation()` does full recomputation, not incremental
- **Impact**: No performance benefit from "incremental" path
- **Missing Test**: No test verifies that:
  - `_incrementalAggregation()` produces same result as full recomputation
  - Performance is not improved (or documents that it's not actually incremental)

**❌ No Queue for Background Preprocessing**
- **Documented Limitation**: If preprocessing is in progress, new requests are skipped
- **Impact**: Important preprocessing might be missed
- **Missing Test**: No test verifies that:
  - Concurrent `preprocessInBackground()` calls result in skipped requests
  - No queue is maintained (requests are lost)

#### Edge Cases Not Tested

- **Borderline activity detection**: Notes at exactly 10 notes/sec (high vs medium threshold)
- **Empty notes array**: Activity detection with no notes
- **Very old notes**: Notes outside recent window
- **Cache age expiration**: Cache invalidates after `cacheMaxAge`
- **Note count change exactly 20%**: Borderline case for cache invalidation

### 4. Batch Optimizer Tests (`test/batch-optimizer.test.mjs`)

#### Missing Tests for Critical Issues

**❌ Cache Key Truncation Causes Collisions**
- **Documented Bug**: Cache key uses string concatenation with truncation
- **Impact**: Different prompts/states with same prefix = same cache key = wrong cache hit
- **Missing Test**: No test verifies that:
  - Prompts longer than 100 chars with same prefix generate same key (collision)
  - Context longer than 50 chars with same prefix generates same key (collision)
  - This is a known limitation (should be tested and documented)

**❌ Unbounded Cache Growth**
- **Documented Bug**: No size limits or eviction
- **Impact**: Memory leak in long-running processes
- **Missing Test**: No test verifies that:
  - Cache grows unbounded (no size limits)
  - No eviction occurs (even with many entries)
  - Memory usage increases linearly with cache size

#### Edge Cases Not Tested

- **Cache disabled**: Behavior when `cacheEnabled: false`
- **Very large batches**: Performance with many concurrent requests
- **Cache key collisions**: Actual collision scenarios

### 5. Temporal Decision Tests (`test/temporal-decision.test.mjs`)

#### Missing Tests for Critical Bug Fixes

**❌ Sparse Array Handling**
- **Bug Fixed**: `aggregateMultiScale()` could produce sparse arrays with `undefined` entries
- **Fix**: Filter out `undefined` entries before mapping
- **Missing Test**: No test verifies that:
  - Empty windows don't cause `undefined` entries
  - `avgScore` is never `undefined` in result windows
  - Sparse arrays are handled correctly

**❌ Empty Window Handling**
- **Bug Fixed**: `generateMultiScaleSummary()` could access `avgScore` on undefined windows
- **Fix**: Defensive checks for `firstWindow`, `lastWindow`, `avgScore`
- **Missing Test**: No test verifies that:
  - Empty windows don't cause errors
  - Summary generation handles missing `avgScore` gracefully

#### Edge Cases Not Tested

- **Very short time scales**: Immediate scale with <100ms windows
- **Very long time scales**: Long scale with >30s windows
- **No notes in time scale**: Empty scales in result
- **Attention weights**: How attention affects weighting (partially tested, could be more comprehensive)

## Test Quality Issues

### 1. Testing Implementation Details vs Behavior

**Good Examples**:
- `temporal-preprocessor.test.mjs` - `AdaptiveTemporalProcessor` test allows both 'cache' and 'computed' sources (tests behavior, not exact path)

**Bad Examples**:
- `cache.test.mjs` - Tests key generation but doesn't test the critical behavior (no truncation, full hashing)
- `temporal.test.mjs` - Tests coherence calculation but doesn't test the critical bug fixes (direction change penalty, score range)

### 2. Missing Edge Case Coverage

- **Boundary conditions**: Exactly at thresholds (10 notes/sec, 20% change, 7 days)
- **Error conditions**: Invalid input, corrupted data, missing fields
- **Performance**: Large inputs, many entries, concurrent operations

### 3. Missing Integration Tests

- **Cross-system**: How caches interact (or don't interact)
- **End-to-end**: Full workflows with all systems
- **Real-world scenarios**: Actual usage patterns

## Harmonization Plan

### Phase 1: Add Missing Critical Tests

1. **Cache Tests**:
   - Timestamp preservation test
   - Full content hashing test
   - LRU eviction test
   - Expiration test

2. **Temporal Tests**:
   - Adjusted variance coherence test
   - Score range test
   - Direction change penalty test

3. **Temporal Preprocessor Tests**:
   - Cache validity limitation test (count vs content)
   - Incremental aggregation lie test
   - Queue behavior test

4. **Batch Optimizer Tests**:
   - Cache key truncation collision test
   - Unbounded cache growth test

5. **Temporal Decision Tests**:
   - Sparse array handling test
   - Empty window handling test

### Phase 2: Add Edge Case Tests

- Boundary conditions
- Error conditions
- Performance tests

### Phase 3: Add Integration Tests

- Cross-system tests
- End-to-end workflows
- Real-world scenarios

## Test Philosophy

### What Tests Should Verify

1. **Behavior, not implementation**: Tests should verify what the code does, not how it does it
2. **Critical bugs**: All fixed bugs should have tests to prevent regression
3. **Edge cases**: Boundary conditions, error conditions, extreme inputs
4. **Documented limitations**: Known bugs/limitations should be tested and documented

### What Tests Should NOT Do

1. **Brittle assertions**: Don't test exact implementation paths if multiple paths are valid
2. **Implementation details**: Don't test internal variables, only public behavior
3. **Over-specific**: Don't test exact string formats unless critical

## Next Steps

1. Add missing critical tests (Phase 1)
2. Review and update existing tests for behavior vs implementation
3. Add edge case tests (Phase 2)
4. Add integration tests (Phase 3)
5. Document test philosophy and guidelines

