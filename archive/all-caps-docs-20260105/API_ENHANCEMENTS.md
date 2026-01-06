# API Enhancements: Auto-Optimization Features

## Overview

New optional enhancements to `validateScreenshot()` that make cost optimization easier and more transparent.

## New Features

### 1. Auto-Select Tier (`autoSelectTier`)

Automatically selects the optimal model tier based on context.

**Before (manual):**
```javascript
const tier = selectModelTier({ frequency: 60, costSensitive: true });
const config = createConfig({ modelTier: tier });
const judge = new VLLMJudge(config);
const result = await judge.judgeScreenshot(image, prompt);
```

**After (automatic):**
```javascript
const result = await validateScreenshot(image, prompt, {
  autoSelectTier: true,
  frequency: 60,
  costSensitive: true
});
```

**Benefits:**
- Simpler API - no manual tier selection
- Backward compatible - opt-in flag
- Uses existing `selectModelTier()` logic

### 2. Auto-Select Provider (`autoSelectProvider`)

Automatically selects the cheapest available provider.

**Before (manual):**
```javascript
const provider = selectProvider({ costSensitive: true, env: process.env });
const config = createConfig({ provider });
const judge = new VLLMJudge(config);
const result = await judge.judgeScreenshot(image, prompt);
```

**After (automatic):**
```javascript
const result = await validateScreenshot(image, prompt, {
  autoSelectProvider: true,
  costSensitive: true
});
```

**Benefits:**
- Automatic provider selection
- Uses existing `selectProvider()` logic
- Backward compatible

### 3. Cost Comparison (`includeCostComparison`)

Includes cost comparison across tiers in the result.

**Usage:**
```javascript
const result = await validateScreenshot(image, prompt, {
  includeCostComparison: true,
  modelTier: 'balanced'
});

// Result includes:
console.log(result.costComparison.current.tier); // 'balanced'
console.log(result.costComparison.savings.fast.percent); // '70%'
console.log(result.costComparison.recommendation.reason); // "Cost-sensitive operation, use fast tier"
```

**Benefits:**
- See cost savings at a glance
- Get recommendations for optimization
- Understand cost impact of tier selection

### 4. Optimization Helper (`optimizeCost`)

One-stop function to get optimal configuration.

**Usage:**
```javascript
import { optimizeCost } from '@arclabs561/ai-visual-test';

const optimization = optimizeCost({
  frequency: 60,
  costSensitive: true,
  budget: 0.01
});

// Returns:
// {
//   recommendedTier: 'fast',
//   recommendedProvider: 'gemini',
//   estimatedCost: 0.001,
//   savings: { vsBalanced: '70%', vsBest: '90%' },
//   config: { modelTier: 'fast', provider: 'gemini' },
//   recommendation: "Optimal configuration: gemini fast tier..."
// }

// Use the config
const result = await validateScreenshot(image, prompt, {
  ...optimization.config
});
```

**Benefits:**
- One function call for optimal configuration
- Includes cost estimates and savings
- Budget checking

## API Changes

### validateScreenshot() Context Options

**New optional flags:**
- `autoSelectTier: boolean` - Auto-select model tier
- `autoSelectProvider: boolean` - Auto-select provider
- `includeCostComparison: boolean` - Include cost comparison in result

**Enhanced result:**
- `result.costComparison` - Cost comparison object (if `includeCostComparison: true`)

### New Exports

```javascript
import {
  calculateCostComparison,  // Calculate cost comparison
  optimizeCost                // Get optimal configuration
} from '@arclabs561/ai-visual-test';
```

## Migration Guide

### From Manual to Auto-Optimization

**Old code:**
```javascript
const tier = selectModelTier({ costSensitive: true });
const config = createConfig({ modelTier: tier });
const judge = new VLLMJudge(config);
const result = await judge.judgeScreenshot(image, prompt);
```

**New code:**
```javascript
const result = await validateScreenshot(image, prompt, {
  autoSelectTier: true,
  costSensitive: true
});
```

**Benefits:**
- Less code
- Same optimization
- Backward compatible (old code still works)

## Examples

See `examples/auto-optimization.mjs` for complete examples.

## Implementation Details

### Auto-Select Tier

- Calls `selectModelTier(context)` internally
- Merges `modelTier` into context
- Uses existing tier selection logic
- Gracefully fails if selection fails (falls back to default)

### Auto-Select Provider

- Calls `selectProvider(requirements)` internally
- Merges `provider` into context
- Uses existing provider selection logic
- Gracefully fails if selection fails (falls back to default)

### Cost Comparison

- Calculates costs for all tiers (fast/balanced/best)
- Compares with current tier
- Provides savings percentages
- Includes optimization recommendations

### Optimization Helper

- Combines tier and provider selection
- Estimates costs
- Compares with other tiers
- Checks budget constraints
- Returns ready-to-use config

## Backward Compatibility

All new features are **opt-in** and **backward compatible**:

- Existing code continues to work unchanged
- New features only activate with explicit flags
- No breaking changes to existing APIs
- Graceful degradation if features fail

## Performance Impact

- **Auto-select tier**: ~1ms overhead (synchronous selection)
- **Auto-select provider**: ~1ms overhead (synchronous selection)
- **Cost comparison**: ~5ms overhead (synchronous calculation)
- **Optimization helper**: ~10ms overhead (synchronous calculation)

All overhead is minimal and synchronous (no API calls).

## Future Enhancements

Potential future improvements:
- Actual model pricing lookup (currently simplified)
- Historical cost analysis
- Budget alerts
- Cost projections

