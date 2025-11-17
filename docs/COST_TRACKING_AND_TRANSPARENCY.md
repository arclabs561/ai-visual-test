# Cost Tracking and Transparency

## Overview

The system provides comprehensive cost tracking at multiple levels to ensure transparency and enable optimization of ML API usage.

## Cost Tracking Systems

### 1. Global Cost Tracker (`src/cost-tracker.mjs`)

Tracks all API costs across the entire application lifecycle.

**Features:**
- Persistent storage (localStorage or file-based)
- Cost breakdown by provider (Gemini, OpenAI, Claude, Groq)
- Cost breakdown by date
- Cost breakdown by test type
- Token usage tracking (input/output)
- Cost history with configurable retention

**Usage:**
```javascript
import { recordCost, getCostStats } from 'ai-visual-test';

// Costs are automatically recorded when using validateScreenshot
// But you can also manually record:
recordCost({
  provider: 'gemini',
  cost: 0.0002,
  inputTokens: 1000,
  outputTokens: 500,
  testName: 'my-test'
});

// Get statistics
const stats = getCostStats();
console.log(`Total cost: $${stats.total}`);
console.log(`By provider:`, stats.byProvider);
```

### 2. Session Cost Tracker (`src/session-cost-tracker.mjs`)

Tracks costs per test run/session with detailed breakdown and transparency. Provides "trap debug" hooks to show total ML API resources for usage tracking.

**Features:**
- Per-session cost tracking
- Cache hit/miss tracking
- Detailed breakdown by provider, test, and tokens
- Automatic report generation
- Session duration tracking
- Cost per second calculation

**Usage:**
```javascript
import { startSession, endSession, getSessionCosts } from 'ai-visual-test';

// Start a session
const sessionId = startSession('comprehensive-evaluation');

// Run tests with sessionId in context
await validateScreenshot('screenshot.png', 'Evaluate', {
  sessionId: sessionId  // Automatically tracks costs
});

// End session and get summary
const summary = endSession(sessionId, { verbose: true });
console.log(`Total cost: $${summary.costs.total.toFixed(4)}`);
console.log(`Cache hit rate: ${summary.costs.cacheHitRate}`);
```

**Session Summary Output:**
```
======================================================================
💰 Cost Report: comprehensive-evaluation
======================================================================
Session ID: session-1234567890-abc123
Duration: 45.23s

📊 API Usage:
   Total Cost: $0.0234
   API Calls: 15
   Average per Call: $0.001560
   Cost per Second: $0.000517/s

💾 Cache Performance:
   Cache Hits: 8
   Cache Misses: 7
   Hit Rate: 53.3%
   Estimated Savings: $0.0109 (from cache hits)

🔢 Token Usage:
   Input Tokens: 15,234
   Output Tokens: 3,456
   Total Tokens: 18,690

📦 By Provider:
   gemini:
      Cost: $0.0234
      Calls: 15
      Tokens: 15,234 in, 3,456 out

🧪 By Test (Top 10):
   ground-truth-validation: $0.0100 (5 calls)
   real-world-evaluation: $0.0134 (10 calls)
======================================================================
```

## Integration Points

### Automatic Cost Tracking

Costs are automatically tracked when using:
- `validateScreenshot()` - Records cost per validation
- `comparePair()` - Records cost per comparison
- `rankBatch()` - Records cost per batch ranking
- `validateWithGoals()` - Records cost per goal-based validation

### Cache Tracking

Cache hits and misses are automatically tracked when:
- Using `validateScreenshot()` with caching enabled
- Session ID is provided in context

### Manual Tracking

You can manually track costs for custom operations:

```javascript
import { recordSessionCost, recordSessionCacheHit } from 'ai-visual-test';

// Record a custom cost
recordSessionCost(sessionId, {
  provider: 'gemini',
  cost: 0.0001,
  inputTokens: 500,
  outputTokens: 200,
  testName: 'custom-operation'
});

// Record cache hit
recordSessionCacheHit(sessionId);
```

## Cost Optimization Strategies

### 1. Caching (7-day TTL)

The system uses persistent caching to avoid redundant API calls:

```javascript
// First call: Full cost
const result1 = await validateScreenshot('screenshot.png', 'Evaluate');

// Second call: $0.00 (cached)
const result2 = await validateScreenshot('screenshot.png', 'Evaluate');
```

**Impact:** Reduces cost by 80-95% for repeated validations

### 2. Temporal Decision Manager

Only prompts LLM when decision needed (98.5% reduction):

```javascript
const result = await validateScreenshot('screenshot.png', 'Evaluate', {
  useTemporalDecision: true,
  temporalNotes: notes
});
```

**Impact:** 98.5% fewer calls in high-frequency scenarios

### 3. Batch Optimization

Queue and batch requests to reduce overhead:

```javascript
import { BatchOptimizer } from 'ai-visual-test';

const optimizer = new BatchOptimizer({ maxConcurrency: 5 });
const results = await optimizer.batchValidate(screenshots, prompt);
```

**Impact:** Lower cost per request through batching

### 4. Smart Selection

Use programmatic validators when possible (free, fast):

```javascript
// Uses programmatic validation (free)
const result = await validateAccessibilitySmart({
  page: page
});

// Uses VLLM validation (costs money)
const result = await validateAccessibilitySmart({
  screenshotPath: 'screenshot.png'
});
```

**Impact:** Free validation when possible

## Cost Reports

Session cost reports are automatically saved to:
```
evaluation/results/cost-reports/cost-report-{sessionId}-{timestamp}.json
```

Each report contains:
- Session summary (costs, duration, cache performance)
- Detailed cost entries
- Token usage breakdown
- Provider-specific statistics
- Test-specific statistics

## Best Practices

1. **Always use session tracking for evaluations:**
   ```javascript
   const sessionId = startSession('my-evaluation');
   // ... run tests ...
   const summary = endSession(sessionId);
   ```

2. **Review cache hit rates:**
   - Low hit rates (<30%) indicate caching isn't effective
   - High hit rates (>70%) indicate good cache utilization

3. **Monitor cost per second:**
   - High cost per second may indicate inefficient batching
   - Consider using Temporal Decision Manager for high-frequency scenarios

4. **Track costs by test:**
   - Identify expensive tests
   - Optimize or cache expensive operations

5. **Use appropriate providers:**
   - Gemini: Most cost-effective ($0.30/$2.50 per 1M tokens)
   - OpenAI: Good balance ($0.60/$2.40 per 1M tokens)
   - Claude: Highest quality, most expensive ($1.00/$5.00 per 1M tokens)

## Debugging Cost Issues

### Check Global Costs
```javascript
import { getGlobalCostStats } from 'ai-visual-test';

const stats = getGlobalCostStats();
console.log('Total cost:', stats.total);
console.log('By provider:', stats.byProvider);
```

### Check Active Sessions
```javascript
import { getActiveSessions } from 'ai-visual-test';

const sessions = getActiveSessions();
console.log('Active sessions:', sessions);
```

### Check Session Costs
```javascript
import { getSessionCosts } from 'ai-visual-test';

const costs = getSessionCosts(sessionId);
console.log('Session costs:', costs);
```

## Cost Estimation

The system provides cost estimation before making API calls:

```javascript
const result = await validateScreenshot('screenshot.png', 'Evaluate');
console.log('Estimated cost:', result.estimatedCost);
// {
//   totalCost: 0.0002,
//   inputTokens: 1000,
//   outputTokens: 500,
//   provider: 'gemini'
// }
```

## Provider Pricing (as of 2024)

| Provider | Input (per 1M tokens) | Output (per 1M tokens) | Free Tier |
|----------|----------------------|------------------------|-----------|
| Gemini | $0.30 | $2.50 | ✅ Yes |
| OpenAI | $0.60 | $2.40 | ❌ No |
| Claude | $1.00 | $5.00 | ❌ No |
| Groq | Varies | Varies | ✅ Yes (limited) |

## Typical Costs

**Single Screenshot Validation:**
- Gemini: ~$0.0001 - $0.0003
- OpenAI: ~$0.0002 - $0.0005
- Claude: ~$0.0003 - $0.0008

**With Caching (7-day TTL):**
- First validation: Full cost
- Subsequent validations: $0.00 (cached)

**Batch Processing (5 screenshots):**
- Gemini: ~$0.0005 - $0.0015
- OpenAI: ~$0.001 - $0.0025
- Claude: ~$0.0015 - $0.004

## Summary

The cost tracking system provides:
- ✅ Comprehensive cost tracking at multiple levels
- ✅ Automatic cache hit/miss tracking
- ✅ Detailed breakdowns by provider, test, and date
- ✅ Session-level tracking for evaluations
- ✅ Cost optimization strategies
- ✅ Debug hooks for transparency
- ✅ Automatic report generation

Use session tracking for all evaluations to get detailed cost breakdowns and identify optimization opportunities.

