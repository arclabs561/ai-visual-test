# Current Goals and TODOs

## Primary Goals (From docs/GOALS_AND_INTERFACES.md)

**Primary Purpose**: AI-powered visual testing using Vision Language Models (VLLM) for screenshot validation. Semantic visual regression testing that understands UI meaning, not just pixels.

### Core Problems Solved

1. **Semantic validation** - Understands UI meaning, not just pixel differences
2. **High-frequency validation** (10-60Hz) for real-time gameplay ⚠️ **CRITICAL**
3. **Variable goals** - Different evaluation criteria based on game state
4. **Temporal sequences** - Understanding gameplay over time, not just single frames
5. **State extraction** - Extract game state (score, level, position) from screenshots
6. **Accessibility validation** - Fast programmatic checks or VLLM semantic evaluation

### Primary Use Case: 60Hz Real-Time Game Validation

**Requirements:**
- High-frequency validation (10-60Hz) for real-time gameplay
- Variable goals based on game state (fun, accessibility, performance)
- Temporal sequences to understand gameplay over time
- State extraction from screenshots (score, level, position)
- Fast latency (<100ms) for reactive games

**What this package provides:**
- `testGameplay()` - Complete workflow for game testing ✅ Tested
- `validateWithGoals()` - Variable goal specification ✅ Tested
- `captureTemporalScreenshots()` - Temporal sequence capture ✅ Tested
- `LatencyAwareBatchOptimizer` - Fast validation for 60Hz games ✅ Tested
- `selectModelTier()` - Automatic fast tier for high-frequency ✅ Tested
- `selectProvider()` - Auto-selects Groq for speed ✅ Tested

## Recent Improvements

### 1. Entity Extraction Enhancement ✅ COMPLETED

**Problem**: Entity extraction was using primitive keyword matching when we have LLM capabilities.

**Solution**: 
- Enhanced `extractEntities()` to use LLM when available (via `data-extractor.mjs`)
- Falls back to keyword matching for speed (no API required)
- Made `buildTemporalGraph()` async to support LLM extraction
- Added `useLLM` option (default: true if API available)

**Impact**: 
- More accurate entity extraction for temporal graphs
- Better entity continuity tracking
- Still fast when LLM unavailable (keyword fallback)

**Performance Consideration**: 
- LLM extraction adds latency (~1-3s per extraction)
- For 60Hz scenarios, use `useLLM: false` for keyword matching (<1ms)
- LLM extraction recommended for post-gameplay analysis, not real-time

### 2. Test Logging Refinement ✅ IN PROGRESS

**Problem**: Test logs were inconsistent and hard to debug.

**Solution**:
- Created `test/test-logger.mjs` with structured logging
- Added debug mode (only when `DEBUG_TESTS=1`)
- Clear prefixes (ℹ️, ✅, ❌, 🔍, ⚠️, ⏭️)
- JSON output for complex data
- Stack traces in debug mode

**Usage**:
```javascript
import { testLog } from './test-logger.mjs';

testLog.info('Test started', { noteCount: 5 });
testLog.debug('Entity extraction', { entities: ['button', 'score'] });
testLog.error('Test failed', error);
testLog.success('Test passed');
```

**Next Steps**:
- Migrate existing tests to use `test-logger.mjs`
- Add structured logging to dataset tests
- Add performance logging for high-frequency tests

## Current TODOs

### High Priority

1. **✅ Entity extraction uses LLM** - COMPLETED
   - Enhanced `extractEntities()` with LLM support
   - Falls back to keyword matching
   - Made `buildTemporalGraph()` async

2. **🔄 Refine test logging** - IN PROGRESS
   - Created `test-logger.mjs` utility
   - Updated `temporal-graph.test.mjs` with structured logging
   - Need to migrate other tests

3. **⏳ Ensure entity extraction works in high-frequency scenarios**
   - LLM extraction adds latency (~1-3s) - not suitable for 60Hz
   - Keyword matching is fast (<1ms) - suitable for 60Hz
   - Document when to use each approach
   - Add performance tests

### Medium Priority

4. **Review primary goals alignment**
   - ✅ 60Hz validation - Core features implemented and tested
   - ✅ Semantic understanding - VLLM-based validation
   - ✅ Temporal sequences - `captureTemporalScreenshots()` + `buildTemporalGraph()`
   - ✅ State extraction - `StateValidator` + VLLM extraction
   - ✅ Variable goals - `validateWithGoals()` + `testGameplay()`

5. **Add performance tests for LLM entity extraction vs keyword matching**
   - Measure latency difference
   - Document trade-offs
   - Add benchmarks

6. **Update all tests to use async buildTemporalGraph**
   - ✅ Updated `temporal-graph.test.mjs`
   - Check for other usages in codebase
   - Update documentation examples

### Low Priority

7. **Migrate all tests to use test-logger.mjs**
   - Replace `console.log('   ℹ️  ...')` with `testLog.info()`
   - Add debug logging where helpful
   - Improve error messages

8. **Document entity extraction strategy**
   - When to use LLM vs keyword matching
   - Performance implications
   - Best practices for 60Hz scenarios

## Wisdom: Iterative Improvements

### What We Learned

1. **Entity Extraction**: LLM is more accurate but slower. Use keyword matching for 60Hz, LLM for analysis.
2. **Test Logging**: Structured logging makes debugging much easier. Debug mode prevents log spam.
3. **Async Patterns**: Making functions async for optional LLM features maintains backward compatibility.

### Design Principles

1. **Performance First for 60Hz**: Always provide fast fallback (keyword matching) for real-time scenarios
2. **Quality When Possible**: Use LLM when latency is acceptable (post-gameplay analysis)
3. **Graceful Degradation**: Fallback to simpler methods when LLM unavailable
4. **Structured Logging**: Make debugging easier with consistent, debuggable output

### Next Iteration

1. **Performance Benchmarking**: Measure actual latency of LLM vs keyword extraction
2. **Smart Selection**: Auto-select extraction method based on frequency requirements
3. **Caching**: Cache LLM extraction results for repeated entities
4. **Batch Extraction**: Extract entities for multiple windows in parallel

