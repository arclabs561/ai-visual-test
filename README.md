# ai-visual-test

AI-powered visual testing. Uses vision language models to understand screenshots instead of pixel-diffing.

## Why This Package

Pixel-based testing breaks when content changes or layouts shift. This tool asks "does this look correct?" instead of "did pixels change?"

**Value proposition**: Understand UI meaning, not just pixels. Validate accessibility, design quality, and user experience with AI-powered semantic analysis.

## Installation

```bash
npm install @arclabs561/ai-visual-test
```

## Configuration

Set an API key in a `.env` file:

```bash
# .env file
GEMINI_API_KEY=your-key-here
# or
OPENAI_API_KEY=your-key-here
# or
ANTHROPIC_API_KEY=your-key-here
```

## Basic Usage

```javascript
import { validateScreenshot } from '@arclabs561/ai-visual-test';

const result = await validateScreenshot(
  'screenshot.png',
  'Check if this payment form is accessible and usable'
);

// Expected output:
console.log(result.score);  // 7 (0-10 scale)
console.log(result.issues); // ['Missing error messages', 'Low contrast']
```

## Use Cases

- **High-frequency validation** - Real-time validation for interactive games (10-60Hz) with <100ms latency
- **Accessibility** - Fast programmatic checks or VLLM semantic evaluation
- **Design principles** - Validates brutalist, minimal, or other styles
- **Temporal testing** - Analyzes animations and gameplay over time
- **State validation** - Fast programmatic or VLLM extraction
- **Game testing** - Validate gameplay with variable goals
- **Natural language specs** - Write tests in plain English

## When to Use Other Tools

For specific use cases, other tools may be more appropriate:

- **Pixel-perfect layout testing**: Use pixel-diffing tools like Percy or Chromatic. This tool focuses on semantic understanding.
- **Exact color matching**: Use design tools like Figma or Sketch. This tool evaluates visual quality, not exact colors.
- **Performance testing**: Use Lighthouse or Playwright's built-in performance APIs. This tool validates visual quality, not performance metrics.
- **Unit testing**: Use Jest or Vitest. This tool validates visual output, not code logic.

## API

### Core Function

```javascript
import { validateScreenshot, createConfig } from '@arclabs561/ai-visual-test';

// Configure (optional - auto-detects from env)
const config = createConfig({
  provider: 'gemini',
  apiKey: process.env.GEMINI_API_KEY
});

// Validate
const result = await validateScreenshot(
  'screenshot.png',
  'Evaluate this screenshot',
  { testType: 'payment-screen' }
);

// Expected output:
console.log(result.score);      // 8.5
console.log(result.issues);     // ['Low contrast', 'Missing label']
console.log(result.reasoning);  // "The form is mostly accessible..."
```

### Sub-modules (Better Tree-Shaking)

```javascript
// Validators
import { StateValidator } from '@arclabs561/ai-visual-test/validators';

// Temporal
import { aggregateTemporalNotes } from '@arclabs561/ai-visual-test/temporal';

// Multi-modal
import { multiModalValidation } from '@arclabs561/ai-visual-test/multi-modal';

// Ensemble
import { EnsembleJudge } from '@arclabs561/ai-visual-test/ensemble';

// Persona
import { experiencePageAsPersona } from '@arclabs561/ai-visual-test/persona';

// Specs
import { parseSpec } from '@arclabs561/ai-visual-test/specs';

// Utils
import { getCacheStats } from '@arclabs561/ai-visual-test/utils';
```

### High-Frequency Validation (60Hz Games)

```javascript
import { test } from '@playwright/test';
import { LatencyAwareBatchOptimizer, selectModelTier, selectProvider } from '@arclabs561/ai-visual-test';

test('real-time game validation', async ({ page }) => {
  // Auto-select fast tier for 60Hz validation
  const tier = selectModelTier({ frequency: 60 });
  const provider = selectProvider({ speed: 'ultra-fast', env: process.env });
  
  // Use latency-aware optimizer for <100ms requirements
  const optimizer = new LatencyAwareBatchOptimizer();
  
  // Capture at 60fps and validate with <100ms latency
  for (let i = 0; i < 60; i++) {
    await page.screenshot({ path: `frame-${i}.png` });
    const result = await optimizer.addRequest(
      `frame-${i}.png`,
      'Is the game playable?',
      { frequency: 60 },
      50 // 50ms max latency for 60Hz
    );
    
    // Expected output:
    console.log(result.score); // 8.5 (if game is playable)
    // Process result...
  }
});
```

### With Playwright

```javascript
import { test } from '@playwright/test';
import { validateScreenshot } from '@arclabs561/ai-visual-test';

test('payment screen', async ({ page }) => {
  await page.goto('https://example.com/checkout');
  await page.screenshot({ path: 'checkout.png' });
  
  const result = await validateScreenshot(
    'checkout.png',
    'Check if payment form is accessible'
  );
  
  // Expected output:
  console.log(result.score); // 8.2
  assert(result.score >= 8, 'Payment form should score at least 8');
});
```

## Features

- **High-frequency support** - Optimized for 60Hz real-time validation with latency-aware batching
- **Auto-optimization** - Automatically selects fast model tiers and providers for high-frequency decisions
- **Multi-provider** - Gemini, OpenAI, Claude, Groq
- **Cost-effective** - Auto-selects cheapest provider, includes caching
- **Multi-modal** - Screenshots + rendered code + context
- **Temporal** - Time-series validation for animations
- **Multi-perspective** - Multiple personas evaluate same state
- **Research-backed** - Features based on peer-reviewed research that improve accuracy, reduce costs, and optimize performance
- **Zero dependencies** - Pure ES Modules

## Examples

See `examples/` directory for complete examples.

## Documentation

- [`docs/GETTING_STARTED.md`](./docs/GETTING_STARTED.md) - Quick start guide
- [`docs/api/API_ESSENTIALS.md`](./docs/api/API_ESSENTIALS.md) - Detailed API reference
- [`docs/research/HOW_AND_WHY_RESEARCH_WORKS.md`](./docs/research/HOW_AND_WHY_RESEARCH_WORKS.md) - Research integration guide
- [`docs/features/`](./docs/features/) - Use case guides

## License

MIT
