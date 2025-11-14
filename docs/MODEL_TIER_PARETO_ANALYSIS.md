# Model Tier Speed/Quality Pareto Analysis

## Executive Summary

This document analyzes the speed/quality tradeoff across different model tiers and providers. **Key finding: Model tier selection is currently manual - there's no automatic selection based on context like high-frequency decisions or criticality.**

## Current State

### Model Tier Configuration

Each provider has three tiers:
- **fast**: Fastest, lower quality, lower cost
- **balanced**: Best balance (default)
- **best**: Highest quality, slower, higher cost

### Providers and Models

| Provider | Fast Tier | Balanced Tier | Best Tier |
|----------|-----------|---------------|-----------|
| Gemini | `gemini-2.0-flash-exp` | `gemini-2.5-pro` | `gemini-2.5-pro` |
| OpenAI | `gpt-4o-mini` | `gpt-5` | `gpt-5` |
| Claude | `claude-3-5-haiku-20241022` | `claude-sonnet-4-5` | `claude-sonnet-4-5` |
| Groq | `llama-3.3-70b-versatile` | `llama-3.3-70b-versatile` | `llama-3.3-70b-versatile` |

**⚠️ Critical Note on Groq:**
- `llama-3.3-70b-versatile` does **NOT support vision** (text-only)
- For vision, Groq requires `meta-llama/llama-4-scout-17b-16e-instruct` (preview only)
- Groq is **not suitable for VLLM (vision-language) tasks** with current model

## Speed/Quality Tradeoff (Based on Research)

### Expected Performance Characteristics

Based on 2025 benchmarks and research:

| Model | Latency | Quality | Cost (per 1M tokens) | Best For |
|-------|---------|---------|---------------------|----------|
| **Gemini Flash** | ~500ms | Good | $6.25 | Fast iterations, large context |
| **Gemini 2.5 Pro** | ~1500ms | Best | $6.25 | Production, high quality |
| **GPT-4o-mini** | ~800ms | Good | $20.00 | Fast, cost-effective |
| **GPT-5** | ~2000ms | Best | $20.00 | Critical evaluations |
| **Claude Haiku** | ~600ms | Good | $18.00 | Fast, coding tasks |
| **Claude Sonnet 4.5** | ~2000ms | Best | $18.00 | Complex reasoning |
| **Groq (text-only)** | ~220ms | Good | $1.38 | Text-only, ultra-fast |

### Pareto Frontier (Theoretical)

**Fastest for Quality Level:**
1. Groq (text-only) - 220ms, but no vision support
2. Gemini Flash - 500ms, good quality, large context
3. GPT-4o-mini - 800ms, good quality, higher cost
4. Claude Haiku - 600ms, good quality, coding-focused

**Highest Quality:**
1. Gemini 2.5 Pro - Best vision-language, 1M+ context
2. GPT-5 - State-of-the-art multimodal
3. Claude Sonnet 4.5 - Enhanced vision capabilities

**Cost-Effective:**
1. Groq - $1.38 per 1M tokens (text-only)
2. Gemini Flash - $6.25 per 1M tokens
3. Claude Haiku - $18.00 per 1M tokens
4. GPT-4o-mini - $20.00 per 1M tokens

## Current Implementation Gaps

### 1. No Automatic Tier Selection

**Problem:** Model tier selection is **manual** - users must specify `modelTier: 'fast'|'balanced'|'best'` in options.

**What's Missing:**
- No automatic selection based on:
  - High-frequency decisions (10-60Hz) → should use `fast`
  - Critical evaluations → should use `best`
  - Standard validations → should use `balanced`
  - Cost constraints → should use `fast`
  - Quality requirements → should use `best`

**Current Code:**
```javascript
// Manual selection only
const result = await validateScreenshot(path, prompt, {
  modelTier: 'fast' // User must specify
});
```

**What Should Exist:**
```javascript
// Automatic selection based on context
const result = await validateScreenshot(path, prompt, {
  // System automatically selects 'fast' for high-frequency
  frequency: 'high', // 10-60Hz
  // OR
  criticality: 'critical', // Automatically selects 'best'
  // OR
  costSensitive: true // Automatically selects 'fast'
});
```

### 2. No Context-Aware Provider Selection

**Problem:** Provider selection is based on API key availability, not context requirements.

**What's Missing:**
- No automatic provider selection based on:
  - Speed requirements → Groq (if vision not needed) or Gemini Flash
  - Quality requirements → Gemini 2.5 Pro or GPT-5
  - Cost constraints → Gemini Flash or Groq
  - Context size → Gemini (1M+ tokens)

### 3. Groq Vision Limitation Not Handled

**Problem:** Groq is configured but doesn't support vision with current model.

**What's Missing:**
- Automatic fallback when Groq selected for vision tasks
- Warning/error when trying to use Groq for vision
- Alternative model selection (`meta-llama/llama-4-scout-17b-16e-instruct`)

## Recommendations

### 1. Implement Automatic Tier Selection

Create a function that selects model tier based on context:

```javascript
function selectModelTier(context) {
  const { frequency, criticality, costSensitive, qualityRequired } = context;
  
  // High-frequency decisions (10-60Hz) → fast
  if (frequency === 'high' || frequency > 10) {
    return 'fast';
  }
  
  // Critical evaluations → best
  if (criticality === 'critical' || qualityRequired === true) {
    return 'best';
  }
  
  // Cost-sensitive → fast
  if (costSensitive === true) {
    return 'fast';
  }
  
  // Default → balanced
  return 'balanced';
}
```

### 2. Implement Context-Aware Provider Selection

Select provider based on requirements:

```javascript
function selectProvider(requirements) {
  const { speed, quality, cost, contextSize } = requirements;
  
  // Ultra-fast, text-only → Groq
  if (speed === 'ultra-fast' && !requirements.vision) {
    return 'groq';
  }
  
  // Large context → Gemini
  if (contextSize > 200000) {
    return 'gemini';
  }
  
  // Best quality → Gemini 2.5 Pro or GPT-5
  if (quality === 'best') {
    return 'gemini'; // Gemini 2.5 Pro is top vision-language model
  }
  
  // Fast + good quality → Gemini Flash
  if (speed === 'fast' && quality === 'good') {
    return 'gemini';
  }
  
  // Default → Gemini (free tier, good balance)
  return 'gemini';
}
```

### 3. Handle Groq Vision Limitation

```javascript
function validateGroqForVision(provider, modelTier) {
  if (provider === 'groq' && modelTier) {
    const model = MODEL_TIERS.groq[modelTier];
    if (model === 'llama-3.3-70b-versatile') {
      throw new Error(
        'Groq llama-3.3-70b-versatile does not support vision. ' +
        'Use meta-llama/llama-4-scout-17b-16e-instruct for vision (preview only).'
      );
    }
  }
}
```

### 4. Integrate with Existing Tier Logic

The `shouldUseSelfConsistency` function already implements tier logic for self-consistency. We should extend this pattern to model tier selection:

```javascript
function selectModelTierFromUncertainty(context, partialResult) {
  const selfConsistency = shouldUseSelfConsistency(context, partialResult);
  
  // Tier 1 (critical) → use 'best' model
  if (selfConsistency.n === 5) {
    return 'best';
  }
  
  // Tier 2 (edge cases) → use 'balanced' model
  if (selfConsistency.n === 3) {
    return 'balanced';
  }
  
  // Tier 3 (standard) → use 'fast' model
  return 'fast';
}
```

## Testing Requirements

To validate the Pareto frontier, we need:

1. **Real API Tests:**
   - Test each provider/tier combination with real screenshots
   - Measure actual latency (not theoretical)
   - Measure actual quality (response length, reasoning depth)
   - Measure actual cost (token usage)

2. **Pareto Analysis:**
   - Identify Pareto-optimal models (fastest for quality level)
   - Identify cost-effective models
   - Identify quality leaders

3. **Context-Based Selection:**
   - Test automatic tier selection based on context
   - Validate that high-frequency → fast tier
   - Validate that critical → best tier

## Next Steps

1. ✅ Document current state (this document)
2. ⏳ Implement automatic tier selection function
3. ⏳ Implement context-aware provider selection
4. ⏳ Add Groq vision validation/fallback
5. ⏳ Run real API tests to measure actual Pareto frontier
6. ⏳ Integrate with existing uncertainty tier logic

## Related Documentation

- `docs/misc/UNCERTAINTY_TIER_LOGIC.md` - Self-consistency tier logic (can be extended)
- `docs/temporal/PREPROCESSING_LATENCY_PATTERNS.md` - High-frequency decision patterns
- `src/config.mjs` - Model tier configuration
- `src/uncertainty-reducer.mjs` - Tier-based decision logic

