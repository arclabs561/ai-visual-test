# ai-visual-test

[![npm](https://img.shields.io/npm/v/@arclabs561/ai-visual-test)](https://www.npmjs.com/package/@arclabs561/ai-visual-test)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Validate screenshots against natural-language expectations using vision LLMs. Scores pages 0-10, lists issues, and returns structured results you can assert on in tests.

## Install

```bash
npm install @arclabs561/ai-visual-test
```

## Configure

Set one API key. The package auto-detects the provider from whichever key is present (checked in order: Groq, Gemini, OpenAI, Claude, OpenRouter -- cheapest first).

```bash
# .env (loaded automatically)
GEMINI_API_KEY=your-key-here
# or OPENAI_API_KEY, ANTHROPIC_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY
```

Validate configuration early in your test setup to catch missing keys before tests run:

```javascript
import { validateStartup } from '@arclabs561/ai-visual-test';

validateStartup(); // throws ConfigError if no API key found
```

Override provider, model, or caching per-call or globally:

```javascript
import { createConfig } from '@arclabs561/ai-visual-test';

const config = createConfig({
  provider: 'openai',         // override auto-detection
  model: 'gpt-4o',            // override default model for provider
  modelTier: 'fast',          // or 'balanced', 'best' (tier-based selection)
  cacheEnabled: true,          // default: true (disable with DISABLE_LLM_CACHE=true)
  timeout: 30000,             // ms, default: 30000
  verbose: false,
});
```

## Usage

### Validate a screenshot

```javascript
import { validateScreenshot } from '@arclabs561/ai-visual-test';

const result = await validateScreenshot(
  'screenshot.png',
  'Is this payment form accessible and usable?'
);

// result.score    -- 0-10 (null if provider disabled)
// result.issues   -- ['Low contrast on helper text', 'No error states shown']
// result.recommendations -- ['Increase contrast ratio to 4.5:1', ...]
// result.reasoning -- LLM's explanation
// result.provider  -- 'gemini'
// result.model     -- 'gemini-2.0-flash'
```

Per-call overrides:

```javascript
const result = await validateScreenshot('screenshot.png', 'Check layout', {
  provider: 'openai',
  model: 'gpt-4o',
  modelTier: 'best',
});
```

### Validate a Playwright page

```javascript
import { validatePage } from '@arclabs561/ai-visual-test';

// Takes a screenshot internally, sends it to the LLM
const result = await validatePage(page, 'Check for visual bugs', {
  fullPage: true,        // full-page screenshot (default: false)
  captureCode: true,     // extract HTML/CSS for context (default: true)
});
```

### Compare before/after screenshots

```javascript
import { validateComparison } from '@arclabs561/ai-visual-test';

const result = await validateComparison(
  'before.png',
  'after.png',
  'Did the redesign fix the contrast issues?'
);
```

### Estimate cost before calling

```javascript
import { estimateCost } from '@arclabs561/ai-visual-test';

const estimate = estimateCost('gemini', { imageCount: 2, promptLength: 200 });
// estimate.estimatedCost   -- '0.000350' (USD)
// estimate.estimatedInputTokens  -- 3100
// estimate.estimatedOutputTokens -- 500
```

## Test Framework Integration

### Vitest / Jest

```javascript
// vitest.setup.js (or jest.setup.js)
import { expect } from 'vitest'; // or from '@jest/globals'
import { createMatchers } from '@arclabs561/ai-visual-test/vitest';

createMatchers(expect);
```

```javascript
// your-component.test.js
test('login page passes visual check', async () => {
  await expect('screenshot.png').toPassVisualCheck(
    'Login form is complete and accessible'
  );
});

test('score meets threshold', async () => {
  await expect('screenshot.png').toHaveVisualScore(
    7,                                    // minimum score
    'Check visual quality'                // prompt
  );
});

test('redesign preserved layout', async () => {
  await expect('before.png').toMatchVisually(
    'after.png',
    'Layout and content should be equivalent'
  );
});
```

### Playwright

```bash
npm install --save-dev @playwright/test
npx playwright install chromium
```

```javascript
// playwright.config.js or test setup
import { expect } from '@playwright/test';
import { createMatchers } from '@arclabs561/ai-visual-test/playwright';

createMatchers(expect);
```

```javascript
test('visual quality', async ({ page }) => {
  await page.goto('https://example.com');

  // Visual quality check (0-10, fails if below threshold)
  await expect(page).toHaveVisualScore(7, 'Check visual quality');

  // Hybrid accessibility (programmatic contrast + AI semantic check)
  await expect(page).toBeAccessibleHybrid(4.5);
});
```

## CLI

Validate screenshots from the command line:

```bash
npx ai-visual-test check screenshot.png "Is this accessible?"
```

Options:

```
--provider <name>    LLM provider (groq, gemini, openai, claude, openrouter)
--model <name>       Model name (provider-specific)
--min-score <n>      Minimum passing score, 0-10 (default: 7)
--json               Machine-readable JSON output
--verbose            Show additional details
```

Exit code 0 if score >= min-score, 1 otherwise.

```bash
# CI usage: fail the build if score drops below 6
npx ai-visual-test check screenshot.png "Check accessibility" --min-score 6

# JSON output for scripting
npx ai-visual-test check screenshot.png "Check layout" --json | jq '.score'
```

## Advanced Features

These are available as subpath imports:

| Subpath | What it provides |
|---------|-----------------|
| `@arclabs561/ai-visual-test/validators` | Hybrid accessibility validation, programmatic contrast/keyboard checks, rubric-based validation, batch validation |
| `@arclabs561/ai-visual-test/temporal` | Temporal screenshot aggregation, multi-scale analysis, adaptive capture |
| `@arclabs561/ai-visual-test/ensemble` | Multi-provider ensemble judging, bias detection and mitigation, hallucination detection |
| `@arclabs561/ai-visual-test/persona` | Persona-based experience testing (test as different user types) |
| `@arclabs561/ai-visual-test/game` | AI game agent (plays Canvas/WebGL games via Playwright, analyzes screenshots, dispatches actions) |
| `@arclabs561/ai-visual-test/specs` | Natural-language spec parsing and execution |
| `@arclabs561/ai-visual-test/multi-modal` | Multi-modal validation (screenshot + HTML + CSS fusion) |
| `@arclabs561/ai-visual-test/utils` | Cost tracking, score calibration, model/provider selection, type guards |
| `@arclabs561/ai-visual-test/errors` | Error types (ValidationError, ConfigError, ProviderError, FileError) |

Example:

```javascript
import { validateAccessibilityHybrid } from '@arclabs561/ai-visual-test/validators';

// Runs programmatic contrast checks + AI semantic evaluation
const result = await validateAccessibilityHybrid(page, 'screenshot.png');
```

## Limitations

- Scores are non-deterministic: same image + prompt can return different scores across calls. Use caching or ensemble judging for stability.
- Groq's multi-image support is limited (llama-4-scout returns null scores for comparison).
- Game agent requires Playwright and works best with simple 2D games.
- No offline mode: requires an API key and network access.

## License

MIT
