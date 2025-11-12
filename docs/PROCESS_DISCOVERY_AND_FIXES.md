# Process: Discovery and Fixes

This document describes the process we used to discover nuanced issues and fix them. Future developers can use this process to identify similar issues.

## Discovery Process

### 1. Test-Driven Discovery

**What We Did**:
- Ran comprehensive test suite: `npm test`
- Identified failing tests
- Analyzed test failures for patterns

**Key Discovery**:
- Coherence algorithm test failed for erratic behavior
- Device viewport test failed for persona diversity
- Preprocessing system had no tests

**Process**:
1. Run all tests
2. Identify failures
3. Analyze root causes
4. Fix issues
5. Add tests to prevent regression

### 2. Harmonization Analysis

**What We Did**:
- Analyzed test coverage vs. implementation
- Identified untested features
- Found integration gaps

**Key Discovery**:
- Preprocessing system implemented but not tested
- Preprocessing not integrated into E2E tests
- Known algorithm issues (coherence, viewports)

**Process**:
1. List all source files
2. List all test files
3. Identify gaps (implemented but not tested)
4. Identify integration gaps (not used in practice)
5. Prioritize fixes

### 3. Code Review for Subtle Bugs

**What We Did**:
- Read critical algorithm code carefully
- Looked for incomplete calculations
- Checked for missing fallback logic

**Key Discovery**:
- `adjustedVarianceCoherence = Math.max;` was incomplete
- Device viewport only checked `persona.device`, not `options.device`

**Process**:
1. Read algorithm code line by line
2. Verify all calculations are complete
3. Check all conditional branches
4. Verify fallback logic
5. Test edge cases

### 4. Research Alignment Check

**What We Did**:
- Compared implementation with research claims
- Identified overclaims vs. reality
- Documented what's actually implemented

**Key Discovery**:
- We use exponential decay, not logarithmic compression
- Variance normalization changed from research formula (too lenient)
- Simplified metrics vs. exact research formulas

**Process**:
1. Read research papers cited in code
2. Compare claims with implementation
3. Document what's actually implemented
4. Document what's simplified vs. exact
5. Update documentation to be honest

## Fix Process

### 1. Fix Critical Bugs First

**Priority Order**:
1. **Runtime errors**: Incomplete calculations (coherence bug)
2. **Logic errors**: Missing fallback checks (viewport bug)
3. **Missing tests**: Untested features (preprocessing)
4. **Integration gaps**: Features not used (preprocessing in E2E)

**Process**:
1. Identify bug severity
2. Fix highest severity first
3. Add tests to prevent regression
4. Document the bug and fix

### 2. Add Comprehensive Tests

**What We Did**:
- Created `test/temporal-preprocessor.test.mjs` with 17 tests
- Tested all code paths
- Tested edge cases

**Process**:
1. Identify untested features
2. Write tests for all code paths
3. Test edge cases (empty, single, many)
4. Test realistic scenarios
5. Verify tests pass

### 3. Integrate Features

**What We Did**:
- Integrated preprocessing into E2E tests
- Updated all three test functions
- Maintained backward compatibility

**Process**:
1. Identify integration points
2. Update code to use new features
3. Maintain backward compatibility
4. Test integration
5. Document integration pattern

### 4. Document Nuances

**What We Did**:
- Added inline code comments
- Created `NUANCED_IMPLEMENTATION_DETAILS.md`
- Created this process document

**Process**:
1. Identify nuanced details
2. Add inline comments to code
3. Create documentation
4. Explain "why" not just "what"
5. Document what not to change

## Specific Fixes Applied

### Fix 1: Coherence Algorithm Bug

**Discovery**:
- Test failed: erratic behavior should have coherence <0.5, got 1.0
- Read code: found incomplete calculation

**Fix**:
```javascript
// Before (WRONG):
const adjustedVarianceCoherence = Math.max;

// After (CORRECT):
const adjustedVarianceCoherence = Math.max(0, Math.min(1, varianceCoherence * (1.0 - directionChangePenalty * 0.7)));
```

**Documentation**:
- Added inline comment explaining the bug
- Added JSDoc comment with bug history
- Documented in `NUANCED_IMPLEMENTATION_DETAILS.md`

### Fix 2: Device Viewport Bug

**Discovery**:
- Test failed: mobile persona got desktop viewport
- Read code: only checked `persona.device`, ignored `options.device`

**Fix**:
```javascript
// Before (WRONG):
if (persona.device) {
  // Only set if persona.device exists
}

// After (CORRECT):
const deviceToUse = persona.device || device;
if (deviceToUse) {
  // Check both persona.device and options.device
}
```

**Documentation**:
- Added inline comment explaining the bug
- Documented viewport sizes and rationale
- Documented in `NUANCED_IMPLEMENTATION_DETAILS.md`

### Fix 3: Preprocessing Tests

**Discovery**:
- Harmonization analysis: preprocessing implemented but not tested
- No test file for preprocessing system

**Fix**:
- Created `test/temporal-preprocessor.test.mjs`
- Added 17 tests covering all code paths
- Tested edge cases and realistic scenarios

**Documentation**:
- Test file includes comments explaining test expectations
- Documented why tests allow multiple valid outcomes
- Documented in `NUANCED_IMPLEMENTATION_DETAILS.md`

### Fix 4: Preprocessing Integration

**Discovery**:
- Harmonization analysis: preprocessing not used in E2E tests
- E2E tests used direct aggregation, not preprocessing

**Fix**:
- Updated all three E2E test functions
- Added `createAdaptiveTemporalProcessor` usage
- Maintained backward compatibility variables

**Documentation**:
- Added comments explaining integration pattern
- Documented processor reuse pattern
- Documented in `NUANCED_IMPLEMENTATION_DETAILS.md`

## Prevention Process

### How to Avoid Reintroducing Bugs

1. **Read inline comments**: Code comments explain why, not just what
2. **Check test expectations**: Tests document realistic behavior
3. **Read documentation**: `NUANCED_IMPLEMENTATION_DETAILS.md` has all critical details
4. **Run tests**: Always run tests before and after changes
5. **Review changes**: Check if changes affect nuanced logic

### How to Discover New Issues

1. **Run comprehensive tests**: `npm test` regularly
2. **Analyze test failures**: Don't just fix, understand why
3. **Review code carefully**: Read algorithm code line by line
4. **Check integration**: Verify features are actually used
5. **Compare with research**: Verify implementation matches claims

### How to Document New Nuances

1. **Add inline comments**: Explain "why" in code
2. **Update documentation**: Add to `NUANCED_IMPLEMENTATION_DETAILS.md`
3. **Update tests**: Add comments explaining test expectations
4. **Document process**: Update this document if process changes

## Key Lessons

1. **Test failures reveal bugs**: Don't ignore test failures, investigate root causes
2. **Harmonization analysis reveals gaps**: Compare implementation vs. tests vs. usage
3. **Code review catches subtle bugs**: Read code carefully, not just skim
4. **Documentation prevents regression**: Document "why" not just "what"
5. **Process matters**: Having a process helps discover and fix issues systematically

## Future Improvements

1. **Automated checks**: Add linting rules for common patterns
2. **Test coverage**: Aim for 100% coverage of critical paths
3. **Documentation reviews**: Review documentation when code changes
4. **Process refinement**: Improve process based on new discoveries
5. **Prevention**: Add checks to prevent common mistakes

