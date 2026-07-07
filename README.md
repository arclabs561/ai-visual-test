# ai-visual-test

[![npm](https://img.shields.io/npm/v/@arclabs561/ai-visual-test)](https://www.npmjs.com/package/@arclabs561/ai-visual-test)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Visual testing with vision language models.

`ai-visual-test` sends screenshots to a configured vision model and returns a
score, issues, recommendations, and provider metadata. Use it from test code,
Playwright matchers, Vitest/Jest matchers, or the CLI.

## Install

```bash
npm install @arclabs561/ai-visual-test
```

Requires Node 18 or newer.

## Configure

Set at least one provider key. `.env` is loaded automatically.

```bash
GEMINI_API_KEY=your-key-here
# or OPENAI_API_KEY, ANTHROPIC_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY
```

Validate configuration in test setup:

```javascript
import { validateStartup } from '@arclabs561/ai-visual-test';

validateStartup();
```

## Screenshot Validation

```javascript
import { validateScreenshot } from '@arclabs561/ai-visual-test';

const result = await validateScreenshot(
  'screenshot.png',
  'Payment form is readable, complete, and usable'
);

console.log(result.score);           // 0-10, or null if validation is disabled
console.log(result.issues);          // detected issues
console.log(result.recommendations); // suggested fixes
console.log(result.provider);        // provider used for the call
console.log(result.model);           // model used for the call
```

Per-call overrides:

```javascript
const result = await validateScreenshot('screenshot.png', 'Check layout', {
  provider: 'openai',
  modelTier: 'best',
});
```

## Playwright

Validate a page directly:

```javascript
import { validatePage } from '@arclabs561/ai-visual-test';

const result = await validatePage(page, 'Check for visual bugs', {
  fullPage: true,
  captureCode: true,
});
```

Or install matchers:

```javascript
import { expect } from '@playwright/test';
import { createMatchers } from '@arclabs561/ai-visual-test/playwright';

createMatchers(expect);
```

```javascript
test('checkout page passes visual check', async ({ page }) => {
  await page.goto('https://example.com/checkout');
  await expect(page).toHaveVisualScore(7, 'Checkout is readable and usable');
  await expect(page).toBeAccessibleHybrid(4.5);
});
```

## Vitest and Jest

```javascript
import { expect } from 'vitest';
import { createMatchers } from '@arclabs561/ai-visual-test/vitest';

createMatchers(expect);
```

```javascript
test('login screenshot passes visual check', async () => {
  await expect('login.png').toPassVisualCheck('Login form is complete');
  await expect('login.png').toHaveVisualScore(7, 'Login form is readable');
});
```

## Compare Screenshots

```javascript
import { validateComparison } from '@arclabs561/ai-visual-test';

const result = await validateComparison(
  'before.png',
  'after.png',
  'The redesign preserves layout and fixes contrast'
);
```

## CLI

```bash
npx ai-visual-test check screenshot.png "Payment form is readable" --min-score 7
```

Options:

```text
--provider <name>    LLM provider (groq, gemini, openai, claude, openrouter)
--model <name>       Model name
--min-score <n>      Minimum passing score, 0-10 (default: 7)
--json               JSON output
--verbose            Extra diagnostics
```

Exit code is 0 when the score meets `--min-score`, and 1 otherwise.

## Cost Estimate

```javascript
import { estimateCost } from '@arclabs561/ai-visual-test';

const estimate = estimateCost('gemini', { imageCount: 2, promptLength: 200 });
console.log(estimate.estimatedCost);
```

## Subpath Modules

| Import | Purpose |
| --- | --- |
| `@arclabs561/ai-visual-test/playwright` | Playwright matchers |
| `@arclabs561/ai-visual-test/vitest` | Vitest/Jest matchers |
| `@arclabs561/ai-visual-test/validators` | Rubric, accessibility, and state validators |
| `@arclabs561/ai-visual-test/temporal` | Multi-screenshot or video-frame aggregation |
| `@arclabs561/ai-visual-test/ensemble` | Multi-provider judging |
| `@arclabs561/ai-visual-test/perception` | Open-ended perception sampling |
| `@arclabs561/ai-visual-test/game` | Playwright-backed game agent |
| `@arclabs561/ai-visual-test/utils` | Cache, cost, and calibration helpers |

The perception sampler is documented in [`docs/judge-graph.md`](docs/judge-graph.md).

## Limits

- Scores are non-deterministic. Use caching, fixed prompts, or ensemble judging
  when a test must be stable.
- Calls require a provider API key and network access.
- Model defaults can change; pin `provider` and `model` for reproducible tests.
- Multi-image support differs by provider.
- The game agent requires Playwright and is intended for simple browser games.

## License

MIT
