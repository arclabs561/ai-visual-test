# Groq Integration for High-Frequency Decisions

## Overview

Groq has been integrated into `ai-visual-test` to support high-frequency temporal decisions (10-60Hz). Groq provides ~0.22s latency (10x faster than typical providers) and is cost-competitive, making it ideal for fast-tier decisions.

## Integration Status

### ✅ Completed in `ai-visual-test` (VLLM - Vision Language Models)

- **Configuration** (`src/config.mjs`):
  - Added Groq to `MODEL_TIERS` (fast, balanced, best all use `llama-3.3-70b-versatile`)
  - Added Groq to `PROVIDER_CONFIGS` with OpenAI-compatible endpoint
  - Priority: 0 (highest) for high-frequency decisions
  - Latency: ~220ms (10x faster than typical providers)
  - Throughput: ~200 tokens/sec

- **Judge Integration** (`src/judge.mjs`):
  - Added Groq case that uses OpenAI-compatible API
  - Routes to `callOpenAIAPI()` method
  - Supports logprobs (if available)
  - Cost estimation support

- **Environment Variables** (`src/load-env.mjs`):
  - Added `GROQ_API_KEY` to allowed environment variables
  - Added `groq` to valid providers list

### ⏳ Pending: `@arclabs561/llm-utils` (Text-Only LLM Calls)

Groq should also be added to `@arclabs561/llm-utils` for text-only LLM calls. This is a separate package that handles non-vision LLM operations.

**To add Groq to llm-utils:**
1. Add Groq provider configuration similar to OpenAI (since it's OpenAI-compatible)
2. Add Groq case to `callLLM()` function
3. Add `GROQ_API_KEY` to environment variable handling
4. Update provider detection logic

## Usage

### Environment Setup

```bash
export GROQ_API_KEY="your-groq-api-key"
export VLM_PROVIDER="groq"  # Optional: auto-detects if GROQ_API_KEY is set
```

### Code Usage

```javascript
import { validateScreenshot } from 'ai-visual-test';

// Groq will be auto-selected if GROQ_API_KEY is set (priority 0)
const result = await validateScreenshot('screenshot.png', 'Is the button visible?', {
  provider: 'groq',  // Optional: explicitly use Groq
  modelTier: 'fast'  // Use fast tier for high-frequency decisions
});
```

## Model Tiers

Groq uses the same model (`llama-3.3-70b-versatile`) across all tiers, optimized for speed:
- **Fast**: `llama-3.3-70b-versatile` (~0.22s latency)
- **Balanced**: `llama-3.3-70b-versatile` (same model)
- **Best**: `llama-3.3-70b-versatile` (same model)

## Performance Characteristics

- **Latency**: ~220ms (vs 1-3s for typical providers)
- **Throughput**: ~200 tokens/sec average
- **Cost**: Estimated $0.20 per 1M input/output tokens (verify with Groq pricing)
- **Free Tier**: Available for testing

## Best Use Cases

1. **High-Frequency Temporal Decisions** (10-60Hz)
   - Real-time UI state validation
   - Rapid sequential decision-making
   - Interactive applications requiring low latency

2. **Fast Tier Decisions**
   - Non-critical validations
   - High-volume, low-cost operations
   - When speed is more important than maximum accuracy

3. **Cost-Sensitive Applications**
   - High-volume testing scenarios
   - Development and staging environments
   - When cost optimization is a priority

## API Compatibility

Groq uses an OpenAI-compatible API endpoint:
- **Endpoint**: `https://api.groq.com/openai/v1`
- **Compatibility**: Works with OpenAI API format
- **Authentication**: Bearer token via `GROQ_API_KEY`

## Notes

- Groq specializes in speed, not necessarily the highest quality
- For critical decisions requiring maximum accuracy, consider using `balanced` or `best` tiers from other providers (Gemini, OpenAI, Claude)
- Groq is ideal for high-frequency decisions where speed and cost are priorities
- The same model is used across all tiers, with different optimizations

## Related Documentation

- `docs/temporal/PREPROCESSING_LATENCY_PATTERNS.md` - Temporal decision patterns
- `docs/misc/UNCERTAINTY_TIER_LOGIC.md` - Decision tier logic
- `src/config.mjs` - Provider configuration
- `src/judge.mjs` - VLLM judge implementation

