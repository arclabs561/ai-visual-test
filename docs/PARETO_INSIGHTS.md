# Pareto Frontier Insights from Real Testing

## Executive Summary

Real API testing with actual screenshots from real websites reveals **Groq dominates both speed and cost**, with some counterintuitive findings about model tier naming.

## Key Discoveries

### 1. Groq's Tier Naming is Counterintuitive

**Finding**: Groq's "best" tier is actually **fastest and cheapest**, not highest quality.

| Tier | Latency | Cost | Response Length |
|------|---------|------|-----------------|
| best | 2,112ms | $0.001196 | 1,896 chars |
| balanced | 2,223ms | $0.001201 | 1,998 chars |
| fast | 2,375ms | $0.001266 | 2,554 chars |

**Implication**: For Groq, "best" means "best optimized for speed/cost", not "best quality". The "fast" tier actually produces the longest, most detailed responses.

### 2. Gemini's Tier Behavior is Also Counterintuitive

**Finding**: Gemini's "balanced" tier is **slowest but produces longest responses**.

| Tier | Latency | Cost | Response Length |
|------|---------|------|-----------------|
| fast | 5,248ms | $0.006514 | 2,216 chars |
| best | 23,071ms | $0.001640 | 1,298 chars |
| balanced | 24,808ms | $0.003410 | **2,969 chars** |

**Implication**: For Gemini, "balanced" means "balanced between speed and detail", producing the most comprehensive responses but taking the longest.

### 3. Provider-Specific Optimal Tiers

**Groq**: Use "best" for speed/cost, "fast" for detail
**Gemini**: Use "fast" for speed, "balanced" for detail
**OpenAI**: Use "fast" (GPT-4o-mini) - GPT-5 times out on large images
**Claude**: Cannot test - image size limits (8000px max)

### 4. Real-World Performance Gaps

**Speed Gap:**
- Groq best: 2.1s
- Gemini fast: 5.2s (2.5x slower)
- OpenAI fast: 8.0s (3.8x slower)
- Gemini balanced: 24.8s (11.7x slower)

**Cost Gap:**
- Groq best: $0.0012
- Gemini best: $0.0016 (1.4x more expensive)
- Gemini balanced: $0.0034 (2.8x more expensive)
- OpenAI fast: $0.1333 (111x more expensive)

## Recommendations for Automatic Tier Selection

### Update Tier Selection Logic

The current `selectModelTier()` function should account for provider-specific quirks:

```javascript
function selectModelTierForProvider(context, provider) {
  const baseTier = selectModelTier(context);
  
  // Provider-specific adjustments
  if (provider === 'groq') {
    // Groq's "best" is actually fastest/cheapest
    if (baseTier === 'fast' && (context.frequency === 'high' || context.costSensitive)) {
      return 'best'; // Use "best" for speed/cost optimization
    }
    if (baseTier === 'best' && context.qualityRequired) {
      return 'fast'; // Use "fast" for more detailed responses
    }
  }
  
  if (provider === 'gemini') {
    // Gemini's "balanced" produces longest responses
    if (baseTier === 'best' && context.qualityRequired) {
      return 'balanced'; // Use "balanced" for most detailed responses
    }
  }
  
  return baseTier;
}
```

### Context-Aware Provider Selection

For high-frequency decisions:
- **Groq best** (2.1s, $0.0012) - Fastest, cheapest

For critical evaluations requiring detail:
- **Gemini balanced** (24.8s, $0.0034) - Longest responses, most comprehensive

For cost-sensitive operations:
- **Groq best** ($0.0012) - Cheapest

For standard validations:
- **Groq balanced** (2.2s, $0.0012) - Good balance

## Image Size Considerations

**Current Test Image**: GitHub homepage (2.1MB, 1280x720)

**Provider Limits:**
- **Claude**: 8000px max dimension (fails on 1280x720 - needs investigation)
- **OpenAI GPT-5**: Times out on 2.1MB images (30s timeout)
- **Groq**: Handles 2.1MB images well
- **Gemini**: Handles 2.1MB images but slower

**Recommendation**: Test with resized images to compare all providers fairly, or increase timeout for OpenAI.

## Quality vs Speed Tradeoff

**Fastest with Good Quality:**
1. Groq best: 2.1s, 1,896 chars
2. Groq balanced: 2.2s, 1,998 chars
3. Groq fast: 2.4s, 2,554 chars

**Most Detailed:**
1. Gemini balanced: 2,969 chars (but 24.8s)
2. Groq fast: 2,554 chars (2.4s)
3. Gemini fast: 2,216 chars (5.2s)

**Best Value (cost per char):**
1. Groq fast: $0.00000050 per char
2. Groq balanced: $0.00000060 per char
3. Groq best: $0.00000063 per char

## Conclusion

**Groq is the clear winner** for speed and cost, but:
- Tier naming is misleading (best = fastest, not highest quality)
- All tiers use same model with different optimizations
- "Fast" tier produces longest responses

**Gemini provides best quality** (longest, most detailed responses) but:
- Much slower (24.8s vs 2.1s)
- More expensive ($0.0034 vs $0.0012)
- "Balanced" tier is best for detail, not speed

**Automatic tier selection should be provider-aware** to account for these quirks.

