# Cost Optimization Guide

## Overview

ai-visual-test includes built-in cost optimization features. This guide shows how to use them effectively.

## Built-in Cost Optimization Features

### 0. Auto-Optimization (NEW)

**Simplest way to optimize costs - just add flags:**

```javascript
import { validateScreenshot } from '@arclabs561/ai-visual-test';

// Auto-select tier and provider
const result = await validateScreenshot('screenshot.png', 'Evaluate', {
  autoSelectTier: true,      // Automatically selects fast/balanced/best
  autoSelectProvider: true,  // Automatically selects cheapest provider
  includeCostComparison: true, // Shows cost savings
  costSensitive: true,
  frequency: 60
});

// Result includes:
console.log(result.costComparison.recommendation.reason);
// "Cost-sensitive operation, use fast tier"
```

**Or use the optimization helper:**

```javascript
import { optimizeCost } from '@arclabs561/ai-visual-test';

const optimization = optimizeCost({
  frequency: 60,
  costSensitive: true,
  budget: 0.01
});

// Returns optimal configuration
const result = await validateScreenshot('screenshot.png', 'Evaluate', {
  ...optimization.config
});
```

### 1. Model Tier Selection

**Use `selectModelTier()` to automatically choose the right model for your use case:**

```javascript
import { selectModelTier, createConfig, VLLMJudge } from '@arclabs561/ai-visual-test';

// Select tier based on context
const tier = selectModelTier({
  frequency: 60,        // 60Hz (high-frequency)
  criticality: 'low',  // Not critical
  costSensitive: true  // Cost-sensitive
});
// Returns: 'fast'

// Create config with selected tier
const config = createConfig({ modelTier: tier });
const judge = new VLLMJudge(config);

// Use for validation
const result = await judge.judgeScreenshot('screenshot.png', 'Evaluate accessibility');
```

**Tier Selection Logic:**
- **High-frequency (10-60Hz)** → `'fast'` (speed critical)
- **Critical evaluations** → `'best'` (quality critical)
- **Cost-sensitive** → `'fast'` (minimize cost)
- **Standard** → `'balanced'` (default)

### 2. Provider Selection

**Use `selectProvider()` to auto-select the cheapest available provider:**

```javascript
import { selectProvider, createConfig } from '@arclabs561/ai-visual-test';

const provider = selectProvider({
  speed: 'fast',
  quality: 'good',
  costSensitive: true,
  env: process.env
});
// Returns: 'gemini' (if GEMINI_API_KEY available, cheapest)

const config = createConfig({ provider });
```

### 3. Caching

**Caching is enabled by default and uses full SHA-256 hashing (no collisions):**

```javascript
import { validateScreenshot } from '@arclabs561/ai-visual-test';

// First call: API request
const result1 = await validateScreenshot('screenshot.png', 'Evaluate accessibility');
// Cost: ~$0.01

// Second call (same inputs): Cache hit
const result2 = await validateScreenshot('screenshot.png', 'Evaluate accessibility');
// Cost: $0 (cached)
```

**Cache Features:**
- 7-day TTL
- LRU eviction (1000 entries, 100MB max)
- Cross-process persistence
- Full content hashing (prevents collisions)

### 4. Temporal Decision Management

**Reduces LLM calls by 98.5% by only validating when needed:**

```javascript
import { validateScreenshot } from '@arclabs561/ai-visual-test';

const result = await validateScreenshot('screenshot.png', 'Evaluate', {
  useTemporalDecision: true,
  temporalNotes: [
    { timestamp: Date.now(), score: 8, observation: 'State stable' },
    // ... more notes
  ]
});
// Only prompts LLM when:
// - State change detected
// - User action occurred
// - High urgency situation
// - Decision point reached
```

### 5. Batch Optimization

**Batch multiple requests together:**

```javascript
import { BatchOptimizer } from '@arclabs561/ai-visual-test';

const optimizer = new BatchOptimizer();
const results = await Promise.all([
  optimizer.addRequest('screenshot1.png', 'Evaluate'),
  optimizer.addRequest('screenshot2.png', 'Evaluate'),
  optimizer.addRequest('screenshot3.png', 'Evaluate')
]);
// Batches requests together, reduces API calls
```

## Cost Optimization Strategies

### Strategy 1: Use Fast Tier for Routine Tests

```javascript
// For routine, non-critical tests
const tier = selectModelTier({
  costSensitive: true,
  testType: 'routine'
});
const config = createConfig({ modelTier: tier });
```

**Cost Savings:** 70-90% vs balanced tier

### Strategy 2: Use Best Tier Only for Critical Tests

```javascript
// For critical tests only
const tier = selectModelTier({
  criticality: 'critical',
  testType: 'payment-critical'
});
const config = createConfig({ modelTier: tier });
```

**Cost Savings:** Use expensive models only when needed

### Strategy 3: Enable Temporal Decision Management

```javascript
// For high-frequency validation (games, animations)
const result = await validateScreenshot('screenshot.png', 'Evaluate', {
  useTemporalDecision: true,
  temporalNotes: notes
});
```

**Cost Savings:** 98.5% reduction in LLM calls

### Strategy 4: Combine Strategies

```javascript
// Maximum cost optimization
const tier = selectModelTier({
  frequency: 60,
  costSensitive: true
});
const provider = selectProvider({
  costSensitive: true,
  env: process.env
});
const config = createConfig({ 
  modelTier: tier,
  provider 
});
const judge = new VLLMJudge(config);

const result = await judge.judgeScreenshot('screenshot.png', 'Evaluate', {
  useTemporalDecision: true,
  temporalNotes: notes
});
```

**Cost Savings:** 95%+ reduction for routine, high-frequency cases

## Cost Tracking

**Track costs over time:**

```javascript
import { CostTracker, getCostTracker } from '@arclabs561/ai-visual-test';

const tracker = getCostTracker();

// Costs are automatically tracked
const stats = tracker.getCostStats();
console.log(`Total cost: $${stats.totals.total}`);
console.log(`By provider:`, stats.byProvider);
```

## Best Practices

1. **Use auto-optimization flags** - Simplest way to optimize (NEW)
2. **Use fast tier for routine tests** - 70-90% cost savings
3. **Use best tier only for critical tests** - Quality when needed
4. **Enable temporal decision management** - 98.5% reduction for high-frequency
5. **Let provider auto-selection work** - Cheapest available provider
6. **Cache is automatic** - No configuration needed
7. **Track costs** - Monitor spending over time
8. **Use cost comparison** - See savings with `includeCostComparison: true` (NEW)

## Cost Comparison

| Strategy | Cost per Validation | Use Case |
|----------|---------------------|----------|
| Fast tier | ~$0.001 | Routine tests |
| Balanced tier | ~$0.01 | Standard tests |
| Best tier | ~$0.05 | Critical tests |
| With temporal decision | ~$0.0001 | High-frequency (98.5% reduction) |

## Examples

See `examples/` directory for complete examples showing cost optimization in practice.

