# API Critical Requirements: What Matters Most

## Executive Summary

Given our API design, here's what matters **most** to get right, in priority order:

1. **Non-blocking behavior** - Human validation must never slow down evaluations
2. **Data integrity** - Judgments must be saved correctly and completely
3. **Error resilience** - Failures must not break the main validation flow
4. **Backward compatibility** - Existing code must continue working
5. **Performance** - Core validation must remain fast
6. **API consistency** - Same interface regardless of human validation state

## 1. Non-Blocking Behavior ⭐ CRITICAL

### Why It Matters

**The core promise**: `validateScreenshot()` should be fast and reliable. Human validation is **optional enhancement**, not a requirement.

**What breaks if wrong**:
- Tests become slow
- Production systems block
- User experience degrades
- Adoption decreases

### Current Implementation ✅

```javascript
// In judge.mjs - Human validation is non-blocking
manager.collectVLLMJudgment(validationResult, imagePath, prompt, context)
  .catch(err => {
    // Silently fail - human validation is optional
  });
```

**Key Requirements**:
- ✅ Never await human validation in main flow
- ✅ All human validation calls are fire-and-forget
- ✅ Errors in human validation don't affect main result
- ✅ No blocking I/O operations

### What to Watch For

⚠️ **Danger Signs**:
- `await` on human validation calls
- Synchronous file operations
- Blocking network requests
- Throwing errors from human validation

✅ **Safe Patterns**:
- `.catch()` on all human validation promises
- Async file operations with error handling
- Queue-based storage (write later)
- Silent failures with optional logging

## 2. Data Integrity ⭐ CRITICAL

### Why It Matters

**The core promise**: When human validation is enabled, judgments must be saved correctly and completely. Lost data = lost calibration = broken system.

**What breaks if wrong**:
- Calibration fails (no data)
- Human feedback lost
- System can't learn
- Trust broken

### Current Implementation ✅

```javascript
// Auto-save periodically (every 10 judgments)
if (this.vllmJudgments.length % 10 === 0) {
  await this._saveVLLMJudgments();
}
```

**Key Requirements**:
- ✅ All VLLM judgments saved with complete context
- ✅ Human judgments linked to VLLM judgments by ID
- ✅ Temporal context preserved
- ✅ Screenshot paths remain valid
- ✅ Atomic writes (don't corrupt on failure)

### What to Watch For

⚠️ **Danger Signs**:
- Missing context fields
- Broken ID links
- Screenshot paths that become invalid
- Partial writes (corrupted data)
- Race conditions in concurrent saves

✅ **Safe Patterns**:
- Complete context object (testType, viewport, persona, stage, etc.)
- Unique, stable IDs
- Relative paths or absolute paths that persist
- Write to temp file, then rename (atomic)
- File locking or single-writer pattern

## 3. Error Resilience ⭐ CRITICAL

### Why It Matters

**The core promise**: Human validation is optional. If it fails, validation should still work.

**What breaks if wrong**:
- Tests fail when human validation breaks
- Production systems crash
- User experience degrades
- System becomes unreliable

### Current Implementation ✅

```javascript
try {
  const { getHumanValidationManager } = await import('./human-validation-manager.mjs');
  // ... human validation code ...
} catch (err) {
  // Silently fail if human validation manager not available
}
```

**Key Requirements**:
- ✅ All human validation wrapped in try/catch
- ✅ Errors don't propagate to main flow
- ✅ Graceful degradation (works without human validation)
- ✅ Optional features fail silently
- ✅ Logging for debugging (but not errors)

### What to Watch For

⚠️ **Danger Signs**:
- Uncaught exceptions from human validation
- Errors thrown to main validation flow
- Missing error handling
- Error messages that break user experience

✅ **Safe Patterns**:
- Try/catch around all human validation code
- Silent failures with optional debug logging
- Graceful degradation (feature off if broken)
- Error boundaries (catch at module level)

## 4. Backward Compatibility ⭐ HIGH

### Why It Matters

**The core promise**: Existing code using `validateScreenshot()` must continue working without changes.

**What breaks if wrong**:
- Breaking changes break user code
- Adoption decreases
- Trust broken
- Maintenance burden increases

### Current Implementation ✅

```javascript
// Human validation is opt-in via context
const result = await validateScreenshot(
  'screenshot.png',
  'Evaluate',
  {
    enableHumanValidation: true // Optional, defaults to true but doesn't break if disabled
  }
);
```

**Key Requirements**:
- ✅ Default behavior unchanged
- ✅ Optional features don't change API
- ✅ New parameters are optional
- ✅ Return types unchanged
- ✅ Error types unchanged

### What to Watch For

⚠️ **Danger Signs**:
- Required new parameters
- Changed return types
- Breaking changes to existing APIs
- Removed functionality
- Changed default behavior

✅ **Safe Patterns**:
- All new features opt-in
- Defaults preserve old behavior
- Additive changes only
- Deprecation warnings before removal
- Versioned APIs if needed

## 5. Performance ⭐ HIGH

### Why It Matters

**The core promise**: Core validation should be fast. Human validation overhead should be minimal.

**What breaks if wrong**:
- Slow tests
- Poor user experience
- High costs
- Adoption decreases

### Current Implementation ✅

```javascript
// Human validation is async and non-blocking
// No performance impact on main flow
manager.collectVLLMJudgment(...).catch(...); // Fire and forget
```

**Key Requirements**:
- ✅ No synchronous operations
- ✅ Minimal memory overhead
- ✅ Efficient data structures
- ✅ Batch operations where possible
- ✅ Caching to avoid redundant work

### What to Watch For

⚠️ **Danger Signs**:
- Synchronous file I/O
- Large in-memory data structures
- Redundant API calls
- No caching
- Blocking operations

✅ **Safe Patterns**:
- Async file operations
- Lazy loading
- Efficient data structures (Maps, Sets)
- Batch saves (every N judgments)
- Cache explanations and results

## 6. API Consistency ⭐ MEDIUM

### Why It Matters

**The core promise**: Same interface works whether human validation is enabled or not.

**What breaks if wrong**:
- Confusing API
- Hard to use
- Adoption decreases
- Maintenance burden

### Current Implementation ✅

```javascript
// Same API, optional feature
const result = await validateScreenshot(...);
// result.score, result.issues, etc. - always the same
// Human validation happens in background
```

**Key Requirements**:
- ✅ Same return type
- ✅ Same error types
- ✅ Same behavior (except human validation)
- ✅ Predictable interface
- ✅ Clear documentation

### What to Watch For

⚠️ **Danger Signs**:
- Different return types based on config
- Conditional behavior that's hard to predict
- Unclear when features are active
- Inconsistent error handling

✅ **Safe Patterns**:
- Consistent return types
- Predictable behavior
- Clear documentation
- Explicit feature flags
- Type-safe interfaces

## Critical API Functions

### 1. `validateScreenshot()` - Core Entry Point

**What Must Work**:
- ✅ Fast (1-3 seconds typical)
- ✅ Reliable (handles errors gracefully)
- ✅ Consistent return type
- ✅ Non-blocking (human validation doesn't slow it)

**What Breaks If Wrong**:
- Everything - this is the main API

### 2. `collectVLLMJudgment()` - Human Validation Collection

**What Must Work**:
- ✅ Non-blocking (never await in main flow)
- ✅ Complete data (all context saved)
- ✅ Error resilient (fails silently)
- ✅ Efficient (minimal overhead)

**What Breaks If Wrong**:
- Human validation system
- Calibration
- Data collection

### 3. `explainJudgment()` - Late Interaction

**What Must Work**:
- ✅ Fast (cached when possible)
- ✅ Accurate (uses original screenshot)
- ✅ Error resilient (fails gracefully)
- ✅ Optional (doesn't break if unavailable)

**What Breaks If Wrong**:
- User experience
- Trust in system
- Explanation quality

## Testing Priorities

### Must Test (Critical Path)

1. **Non-blocking behavior**
   - Verify human validation doesn't slow `validateScreenshot()`
   - Test with human validation enabled/disabled
   - Measure performance impact

2. **Data integrity**
   - Verify all judgments saved correctly
   - Test with concurrent saves
   - Test with failures (disk full, permissions)

3. **Error resilience**
   - Test with human validation broken
   - Test with missing dependencies
   - Test with network failures

4. **Backward compatibility**
   - Test existing code still works
   - Test without human validation
   - Test with old API patterns

### Should Test (Important)

5. **Performance**
   - Measure overhead of human validation
   - Test with many concurrent validations
   - Test memory usage

6. **API consistency**
   - Test return types are consistent
   - Test error types are consistent
   - Test behavior is predictable

## Implementation Checklist

When adding human validation features:

- [ ] Is it non-blocking? (No await in main flow)
- [ ] Does it fail gracefully? (Try/catch, silent failures)
- [ ] Is data complete? (All context saved)
- [ ] Is it backward compatible? (Doesn't break existing code)
- [ ] Is it performant? (Minimal overhead)
- [ ] Is it consistent? (Same API regardless of state)
- [ ] Is it tested? (Critical paths covered)
- [ ] Is it documented? (Clear usage examples)

## Anti-Patterns to Avoid

### ❌ Blocking Human Validation

```javascript
// BAD - Blocks main flow
const humanResult = await manager.collectVLLMJudgment(...);
```

### ❌ Throwing Errors

```javascript
// BAD - Breaks main flow
if (!humanValidation) {
  throw new Error('Human validation required');
}
```

### ❌ Incomplete Data

```javascript
// BAD - Missing context
const judgment = { score: result.score }; // Missing issues, reasoning, context
```

### ❌ Breaking Changes

```javascript
// BAD - Breaks existing code
function validateScreenshot(path, prompt, humanValidationRequired = true) {
  // Now required parameter breaks old code
}
```

### ❌ Synchronous Operations

```javascript
// BAD - Blocks event loop
const data = readFileSync(judgmentPath);
```

## Success Criteria

The API is "right" when:

1. ✅ `validateScreenshot()` is fast (<3s) regardless of human validation state
2. ✅ All judgments are saved correctly with complete context
3. ✅ Human validation failures don't break validation
4. ✅ Existing code works without changes
5. ✅ Performance overhead is <5% when human validation enabled
6. ✅ API is consistent and predictable

## Monitoring & Metrics

Track these to ensure API is "right":

- **Performance**: `validateScreenshot()` latency (p50, p95, p99)
- **Reliability**: Error rate (should be <1%)
- **Data Integrity**: Judgments saved successfully (should be 100%)
- **Compatibility**: Existing tests pass (should be 100%)
- **Adoption**: Usage of human validation features

