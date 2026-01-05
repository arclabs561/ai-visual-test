# Logging and Visibility: Strategic Transparency

## Overview

This document describes the comprehensive logging system added to provide visibility into critical system operations. Logging is **weighted** to focus on the most important areas while maintaining reasonable verbosity.

## Logging Philosophy

**Weighted Logging**: More detail for critical paths (API calls, errors, cache misses) and less detail for routine operations (cache hits, low-urgency decisions).

**Fire-and-Forget**: All logging is non-blocking and uses fire-and-forget patterns to avoid impacting performance.

**Structured Data**: Logs include structured metadata for easy parsing and analysis.

## Critical Areas with Full Visibility

### 1. API Call Performance ⭐ CRITICAL

**Location**: `src/judge.mjs`

**What's Logged**:
- Latency (response time in ms)
- Retry attempts and delays
- Success/failure status
- Cost estimates (tokens, dollar amount)
- Provider information
- Test context

**When Logged**:
- ✅ Always: Errors, retries, slow calls (>5s)
- ✅ Debug mode: All successful calls
- ✅ Always: High-latency calls (>5s)

**Example**:
```javascript
[API] gemini call {
  provider: 'gemini',
  latency: '1234ms',
  retries: 2,
  cost: '$0.000234',
  tokens: '1500 in, 500 out',
  testName: 'accessibility-validation',
  performance: 'normal'
}
```

### 2. Cache Operations ⭐ CRITICAL

**Location**: `src/cache.mjs`, `src/judge.mjs`

**What's Logged**:
- Cache hits (with latency)
- Cache misses (important for optimization)
- Cache evictions (LRU, size limits)
- Cache expirations (7-day TTL)
- Cache size and utilization

**When Logged**:
- ✅ Always: Evictions, expirations
- ✅ Debug mode: Misses, hits
- ✅ Always: High utilization (>80%)

**Example**:
```javascript
[Cache] evict {
  operation: 'evict',
  cacheSize: 1000,
  maxSize: 1000,
  reason: 'LRU eviction: 50 entries removed',
  utilization: '100.0%'
}
```

### 3. Temporal Decision Reasoning ⭐ CRITICAL

**Location**: `src/temporal-decision-manager.mjs`, `src/judge.mjs`

**What's Logged**:
- Decision outcome (shouldPrompt: true/false)
- Reason for decision
- Urgency level (low/medium/high)
- Coherence score
- State change magnitude
- Note count
- Decision point detection
- User action presence

**When Logged**:
- ✅ Always: High-urgency decisions
- ✅ Debug mode: Medium-urgency decisions
- ✅ Verbose debug: Low-urgency decisions

**Example**:
```javascript
[Temporal] Decision: PROMPT (high) {
  shouldPrompt: true,
  reason: 'Decision point reached',
  urgency: 'high',
  coherence: 0.85,
  stateChange: 0.6,
  noteCount: 25,
  isDecisionPoint: true,
  hasUserAction: false
}
```

### 4. Batch Optimizer Metrics ⭐ CRITICAL

**Location**: `src/batch-optimizer.mjs`

**What's Logged**:
- Queue depth and utilization
- Rejections (queue full)
- Timeouts (request wait exceeded)
- Active requests vs. max concurrency
- Wait times

**When Logged**:
- ✅ Always: Rejections, timeouts
- ✅ Always: High queue utilization (>80%)
- ✅ Debug mode: Processing events

**Example**:
```javascript
[BatchOptimizer] reject {
  event: 'reject',
  queueDepth: 100,
  maxQueueSize: 100,
  activeRequests: 5,
  maxConcurrency: 5,
  reason: 'Queue full - preventing memory leak',
  utilization: '100.0%'
}
```

### 5. Error Patterns ⭐ CRITICAL

**Location**: `src/judge.mjs`, `src/utils/performance-logger.mjs`

**What's Logged**:
- Error message and type
- Context where error occurred
- Recovery strategy attempted
- Whether recovery succeeded
- Retry count
- Stack traces (in debug mode)

**When Logged**:
- ✅ Always: All errors

**Example**:
```javascript
[Error] API call (gemini) {
  context: 'API call (gemini)',
  error: 'Rate limit exceeded',
  errorType: 'ProviderError',
  recovery: 'retry_with_backoff',
  retryCount: 2,
  recovered: false
}
```

## Performance Logger API

**Location**: `src/utils/performance-logger.mjs`

### Functions

1. **`logAPICallPerformance(params)`** - Log API call metrics
2. **`logCacheOperation(params)`** - Log cache operations
3. **`logTemporalDecision(params)`** - Log temporal decision reasoning
4. **`logBatchOptimizer(params)`** - Log batch optimizer events
5. **`logErrorPattern(params)`** - Log error patterns
6. **`logCacheStats(params)`** - Log cache statistics summary

## Logging Levels

### Always Logged (Critical Visibility)
- API call errors and retries
- Cache evictions and expirations
- High-urgency temporal decisions
- Batch optimizer rejections and timeouts
- All errors

### Debug Mode (Detailed Visibility)
- All API calls (successful)
- Cache hits and misses
- Medium-urgency temporal decisions
- Batch optimizer processing events

### Verbose Debug Mode (Full Visibility)
- Low-urgency temporal decisions
- All cache operations
- Detailed performance metrics

## Enabling Logging

### Enable Debug Mode
```javascript
import { enableDebug } from 'ai-visual-test';

enableDebug(); // Enables debug-level logging
```

### Environment Variable
```bash
DEBUG=1 npm test  # Enables debug logging
```

## Log Output Format

Logs use structured JSON format for easy parsing:

```javascript
[Category] Message {
  field1: value1,
  field2: value2,
  ...
}
```

## Performance Impact

**Minimal**: All logging is:
- Fire-and-forget (non-blocking)
- Conditional (only when needed)
- Structured (efficient serialization)
- Weighted (less verbose for routine operations)

**Estimated Overhead**: <1ms per operation (negligible compared to API calls which take 200ms-2500ms).

## Blind Spots Addressed

### Before (Blind Spots)
- ❌ No visibility into API call performance
- ❌ No cache effectiveness metrics
- ❌ No temporal decision reasoning
- ❌ No batch optimizer queue health
- ❌ Limited error pattern visibility

### After (Full Visibility)
- ✅ Complete API call performance tracking
- ✅ Cache hit/miss/eviction logging
- ✅ Temporal decision reasoning with context
- ✅ Batch optimizer queue metrics
- ✅ Comprehensive error pattern logging

## Integration Points

All logging integrates with existing systems:
- **Session Cost Tracker**: API costs and cache metrics
- **Research Metrics**: Temporal decision patterns
- **Error Handler**: Error pattern tracking
- **Debug Logger**: Conditional verbosity

## Future Enhancements

Potential improvements:
1. **Aggregated Metrics**: Periodic summaries (e.g., "Cache hit rate: 45% over last 1000 requests")
2. **Performance Alerts**: Warn when latency exceeds thresholds
3. **Cost Alerts**: Warn when costs exceed budgets
4. **Queue Health Dashboard**: Real-time queue depth visualization
5. **Decision Analytics**: Analyze temporal decision patterns over time

