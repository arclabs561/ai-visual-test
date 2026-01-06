# Model Tier Selector: Automatic Context-Based Selection

## Overview

The `model-tier-selector.mjs` module automatically selects the best model tier (`fast`, `balanced`, or `best`) based on context signals like frequency, criticality, and cost sensitivity. This follows the same pattern as `smart-validator.mjs` which auto-selects validator types.

## Design Philosophy

- **High-frequency decisions (10-60Hz)** → use `fast` tier (speed critical)
- **Critical evaluations** → use `best` tier (quality critical)
- **Cost-sensitive operations** → use `fast` tier (minimize cost)
- **Standard validations** → use `balanced` tier (default, best balance)

## Usage

### Automatic Tier Selection

```javascript
import { selectModelTier } from './src/model-tier-selector.mjs';

// High-frequency decision
const tier = selectModelTier({ frequency: 'high' });
// Returns: 'fast'

// Critical evaluation
const tier = selectModelTier({ criticality: 'critical' });
// Returns: 'best'

// Cost-sensitive
const tier = selectModelTier({ costSensitive: true });
// Returns: 'fast'

// Standard (default)
const tier = selectModelTier({});
// Returns: 'balanced'
```

### Frequency Detection from Temporal Notes

The selector can automatically detect frequency from temporal notes:

```javascript
const tier = selectModelTier({
  temporalNotes: [
    { timestamp: Date.now() - 100, ... },
    { timestamp: Date.now() - 50, ... },
    { timestamp: Date.now(), ... }
  ]
});
// Automatically detects high frequency (>10 notes/sec) → 'fast'
```

### Integration with validateScreenshot

```javascript
import { validateScreenshot } from './src/index.mjs';
import { selectModelTier } from './src/model-tier-selector.mjs';

// Automatic tier selection
const tier = selectModelTier({
  frequency: 'high',
  criticality: 'low'
});

const result = await validateScreenshot(path, prompt, {
  modelTier: tier // Automatically selected
});
```

## Decision Logic

### Tier 1: High-Frequency → Fast

**Conditions:**
- `frequency === 'high'` or `frequency >= 10` (Hz)
- Detected from temporal notes: >10 notes/sec

**Rationale:** Speed is critical for high-frequency decisions. Quality can be lower.

### Tier 2: Critical → Best

**Conditions:**
- `criticality === 'critical'`
- `qualityRequired === true`
- `testType === 'expert-evaluation' || 'medical' || 'accessibility-critical'`

**Rationale:** Quality is critical for high-stakes scenarios. Speed can be slower.

### Tier 3: Cost-Sensitive → Fast

**Conditions:**
- `costSensitive === true`

**Rationale:** Minimize cost. Acceptable quality.

### Tier 4: Standard → Balanced (Default)

**Default:** All other cases

**Rationale:** Best balance of speed and quality.

## Provider Selection

The module also provides `selectProvider()` for context-aware provider selection:

```javascript
import { selectProvider } from './src/model-tier-selector.mjs';

const provider = selectProvider({
  speed: 'ultra-fast',
  quality: 'good',
  costSensitive: false,
  contextSize: 50000,
  vision: true,
  env: process.env
});
```

### Provider Selection Logic

- **Ultra-fast, text-only** → Groq (if no vision needed)
- **Large context (>200K tokens)** → Gemini (1M+ context)
- **Best quality** → Gemini 2.5 Pro or GPT-5
- **Fast + good quality** → Gemini Flash
- **Cost-sensitive** → Gemini (free tier) or Groq (text-only)
- **Default** → Auto-detect from available API keys

## Research Basis

Based on 2025 research on intelligent LLM routing:
- Organizations can achieve **75% cost reduction** with intelligent routing
- Quality prediction enables pre-generation routing decisions
- Frequency-based optimization recognizes different patterns for high/low frequency queries
- Criticality-aware routing ensures quality for high-stakes scenarios

## Related

- `src/smart-validator.mjs` - Similar pattern for validator selection
- `src/uncertainty-reducer.mjs` - Tier-based self-consistency logic
- `docs/MODEL_TIER_PARETO_ANALYSIS.md` - Speed/quality tradeoff analysis

