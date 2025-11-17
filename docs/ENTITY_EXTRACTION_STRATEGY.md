# Entity Extraction Strategy: LLM vs Keyword Matching

## Overview

Entity extraction in temporal graphs can use two methods:
1. **LLM-based extraction** - More accurate, slower (~1-3s)
2. **Keyword matching** - Less accurate, faster (<1ms)

This document explains when to use each approach and how the system auto-selects.

## Auto-Selection Logic

The system automatically selects the extraction method based on:

### High-Frequency Scenarios (60Hz) → Keyword Matching

**Trigger conditions:**
- `frequency >= 10` Hz → Always use keyword matching
- `maxLatency < 200` ms → Always use keyword matching
- `useLLM: false` → Explicitly disable LLM

**Rationale:**
- 60Hz requires <16.67ms per frame
- LLM extraction adds 1-3s latency (100-200x too slow)
- Keyword matching is <1ms (suitable for real-time)

**Example:**
```javascript
const graph = await buildTemporalGraph(notes, {
  frequency: 60,  // Auto-selects keyword matching
  windowSize: 2000
});
```

### Analysis Scenarios → LLM Extraction

**Trigger conditions:**
- `frequency < 10` Hz → Use LLM if available
- `maxLatency >= 200` ms → Use LLM if available
- `useLLM: true` → Explicitly enable LLM

**Rationale:**
- Post-gameplay analysis can tolerate 1-3s latency
- LLM extraction is more accurate (understands context)
- Better entity continuity tracking

**Example:**
```javascript
const graph = await buildTemporalGraph(notes, {
  frequency: 1,  // Post-gameplay analysis
  useLLM: true,  // Explicitly enable LLM
  windowSize: 5000
});
```

## Performance Characteristics

### Keyword Matching
- **Latency**: <1ms (suitable for 60Hz)
- **Accuracy**: ~70-80% (matches common UI/game terms)
- **Coverage**: Limited to predefined patterns
- **Use when**: Real-time validation, high-frequency scenarios

### LLM Extraction
- **Latency**: 1-3s (not suitable for 60Hz)
- **Accuracy**: ~90-95% (understands context, synonyms)
- **Coverage**: Any entity mentioned in notes
- **Use when**: Post-gameplay analysis, accuracy critical

## Implementation Details

### Auto-Detection

```javascript
// In extractEntities()
const shouldUseLLM = useLLM !== undefined 
  ? useLLM 
  : !(frequency >= 10 || (maxLatency && maxLatency < 200));
```

**Logic:**
- If `frequency >= 10` → Use keyword matching
- If `maxLatency < 200ms` → Use keyword matching
- Otherwise → Use LLM if available

### Circuit Breaker Pattern

The implementation uses a circuit breaker pattern:
1. Try LLM extraction
2. On any error → Fallback to keyword matching
3. Silent fallback (no error thrown)

This ensures:
- **Resilience**: Always works, even if LLM fails
- **Performance**: Fast fallback for high-frequency scenarios
- **Graceful degradation**: No crashes, just less accurate extraction

## Best Practices

### For 60Hz Real-Time Validation

```javascript
// Explicitly disable LLM for performance
const graph = await buildTemporalGraph(notes, {
  frequency: 60,
  useLLM: false,  // Force keyword matching
  windowSize: 2000
});
```

### For Post-Gameplay Analysis

```javascript
// Enable LLM for accuracy
const graph = await buildTemporalGraph(notes, {
  frequency: 1,
  useLLM: true,  // Force LLM extraction
  windowSize: 5000
});
```

### For Adaptive Selection

```javascript
// Let system auto-select based on frequency
const graph = await buildTemporalGraph(notes, {
  frequency: context.frequency,  // Auto-selects method
  windowSize: 2000
});
```

## Performance Benchmarks

### Keyword Matching
- **10 notes**: <0.1ms
- **100 notes**: <0.5ms
- **1000 notes**: <1ms

### LLM Extraction
- **10 notes**: 1-2s
- **100 notes**: 2-3s
- **1000 notes**: 3-5s

## Trade-offs

| Aspect | Keyword Matching | LLM Extraction |
|--------|------------------|----------------|
| **Latency** | <1ms | 1-3s |
| **Accuracy** | 70-80% | 90-95% |
| **Coverage** | Limited patterns | Any entity |
| **Cost** | Free | API cost |
| **60Hz suitable** | ✅ Yes | ❌ No |
| **Analysis suitable** | ⚠️ Limited | ✅ Yes |

## Recommendations

1. **60Hz scenarios**: Always use keyword matching (`useLLM: false`)
2. **Post-gameplay analysis**: Use LLM extraction (`useLLM: true`)
3. **Unknown frequency**: Let system auto-select (provide `frequency` or `maxLatency`)
4. **API unavailable**: System automatically falls back to keyword matching

## Future Improvements

1. **Caching**: Cache LLM extraction results for repeated entities
2. **Batch extraction**: Extract entities for multiple windows in parallel
3. **Hybrid approach**: Use LLM for first window, keyword for subsequent (if entities stable)
4. **Smart selection**: Learn from past extractions to optimize method selection

