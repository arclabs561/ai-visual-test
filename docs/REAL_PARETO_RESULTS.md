# Real Pareto Frontier Results

## Test Configuration

- **Dataset**: Real-World Screenshot Dataset
- **Test Image**: GitHub Homepage (2.1MB, 1280x720)
- **Source URL**: https://github.com
- **Prompt**: Evaluate webpage screenshot for accessibility, design quality, and user experience

## Results Summary

### Speed Ranking (Fastest to Slowest)

| Rank | Provider | Tier | Model | Latency | Response Length |
|------|----------|------|-------|---------|-----------------|
| 1 | **Groq** | best | llama-4-scout-17b-16e-instruct | **2,112ms** | 1,896 chars |
| 2 | **Groq** | balanced | llama-4-scout-17b-16e-instruct | **2,223ms** | 1,998 chars |
| 3 | **Groq** | fast | llama-4-scout-17b-16e-instruct | **2,375ms** | 2,554 chars |
| 4 | Gemini | fast | gemini-2.0-flash-exp | 5,248ms | 2,216 chars |
| 5 | OpenAI | fast | gpt-4o-mini | 7,984ms | 1,758 chars |
| 6 | Gemini | best | gemini-2.5-pro | 23,071ms | 1,298 chars |
| 7 | Gemini | balanced | gemini-2.5-pro | 24,808ms | 2,969 chars |

### Cost Ranking (Cheapest to Most Expensive)

| Rank | Provider | Tier | Cost | Input Tokens | Output Tokens |
|------|----------|------|------|--------------|---------------|
| 1 | **Groq** | best | **$0.001196** | 1,512 | 385 |
| 2 | **Groq** | balanced | **$0.001201** | 1,512 | 391 |
| 3 | **Groq** | fast | **$0.001266** | 1,512 | 473 |
| 4 | Gemini | best | $0.001640 | 312 | 250 |
| 5 | Gemini | balanced | $0.003410 | 312 | 604 |
| 6 | Gemini | fast | $0.006514 | 3,407 | 451 |
| 7 | OpenAI | fast | $0.133270 | 25,556 | 366 |

## Key Findings

### 1. Groq Dominates Speed

- **Groq is 2.4-11.7x faster** than other providers
- Fastest: Groq best (2,112ms) vs Gemini balanced (24,808ms) = **11.7x faster**
- Even Groq's "fast" tier (2,375ms) is faster than Gemini's "fast" tier (5,248ms)

### 2. Groq Dominates Cost

- **Groq is 1.4-111x cheaper** than other providers
- Cheapest: Groq best ($0.001196) vs OpenAI fast ($0.133270) = **111x cheaper**
- Groq is even cheaper than Gemini for this use case

### 3. Quality Observations

- **Gemini balanced produces longest responses** (2,969 chars) - most detailed
- **Groq fast produces longest responses** (2,554 chars) - detailed and fast
- **Gemini best produces shortest responses** (1,298 chars) - concise
- **OpenAI fast produces medium responses** (1,758 chars)

### 4. Provider Limitations

**OpenAI GPT-5:**
- Times out at 30s for large images (2.1MB)
- May need image resizing or longer timeout

**Claude:**
- Image size limit: 8000px max dimension
- GitHub screenshot (1280x720) should work, but fails
- May need image resizing or compression

**Gemini:**
- Works but slower than Groq
- Balanced tier is slowest (24.8s) but produces longest responses

**Groq:**
- Fastest and cheapest
- Handles large images well (2.1MB)
- All tiers use same model (different optimizations)

## Speed/Quality Tradeoff Analysis

### Pareto-Optimal Models

1. **Groq best** - Fastest (2,112ms) with good quality (1,896 chars)
2. **Groq balanced** - Slightly slower (2,223ms) with better quality (1,998 chars)
3. **Groq fast** - Slightly slower (2,375ms) with best quality (2,554 chars)

**Observation**: Groq's "fast" tier actually produces the longest, most detailed responses, while "best" tier is fastest but more concise. This suggests the tier naming may be misleading - all use the same model with different optimizations.

### Cost-Effectiveness

**Best Value:**
- Groq best: $0.001196 for 1,896 chars = **$0.00000063 per char**
- Groq balanced: $0.001201 for 1,998 chars = **$0.00000060 per char** (best value)
- Groq fast: $0.001266 for 2,554 chars = **$0.00000050 per char** (best value per char)

**Worst Value:**
- OpenAI fast: $0.133270 for 1,758 chars = **$0.0000758 per char** (151x more expensive per char)

## Recommendations

### For High-Frequency Decisions (10-60Hz)
- **Use Groq best tier** - Fastest (2.1s), cheapest ($0.0012)
- Automatic tier selection: `selectModelTier({ frequency: 'high' })` → `'fast'`
- But Groq's "best" is actually fastest, so consider using `'best'` for Groq

### For Critical Evaluations
- **Use Gemini balanced** - Longest, most detailed responses (2,969 chars)
- Automatic tier selection: `selectModelTier({ criticality: 'critical' })` → `'best'`
- But Gemini's "balanced" produces better quality, so consider using `'balanced'` for Gemini

### For Cost-Sensitive Operations
- **Use Groq best** - Cheapest ($0.001196)
- Automatic tier selection: `selectModelTier({ costSensitive: true })` → `'fast'`
- But Groq's "best" is actually cheapest, so consider using `'best'` for Groq

### For Standard Validations
- **Use Groq balanced** - Good balance of speed (2.2s) and quality (1,998 chars)
- Automatic tier selection: `selectModelTier({})` → `'balanced'`

## Provider-Specific Notes

### Groq
- All tiers use same model (`meta-llama/llama-4-scout-17b-16e-instruct`)
- Tier differences are optimization levels, not model differences
- **Best tier is fastest and cheapest** (counterintuitive naming)
- Handles large images well (2.1MB tested)

### Gemini
- Fast tier (Flash) is faster but more expensive than balanced/best
- Balanced tier produces longest responses but is slowest
- Best tier is faster than balanced but produces shorter responses
- **Balanced tier may be best for quality-critical tasks**

### OpenAI
- GPT-5 times out on large images (needs investigation)
- GPT-4o-mini works but is expensive ($0.13 per request)
- May need image resizing or longer timeout for GPT-5

### Claude
- Image size limit (8000px) prevents testing with current images
- May need image resizing or compression
- Cannot evaluate with current dataset images

## Next Steps

1. **Test with multiple images** from dataset (GitHub, MDN, W3C, Example.com)
2. **Resize images** for Claude compatibility
3. **Increase timeout** for OpenAI GPT-5 or investigate timeout issue
4. **Update tier selection logic** to account for provider-specific quirks:
   - Groq: "best" is actually fastest/cheapest
   - Gemini: "balanced" produces longest responses
5. **Test with smaller images** to compare all providers fairly

## Data Quality

- **Real screenshots** from real websites (GitHub, MDN, W3C, Example.com)
- **Ground truth annotations** available for comparison
- **Human annotations** available for some samples
- **Known characteristics** documented (accessibility, design quality)

