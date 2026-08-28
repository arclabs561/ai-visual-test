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
  screenshot: { mask: [page.getByTestId('clock')] },
});
```

Static page validation waits for fonts and a bounded network-idle window, disables
animations by default, and captures until two consecutive frames match. Pass
Playwright screenshot options through `screenshot`; tune or disable convergence
through `stability`. Capture diagnostics are returned as `result.captureMetadata`.

Or install matchers:

```javascript
import { test, expect } from '@playwright/test';
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
import { test, expect } from 'vitest';
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

console.log(result.winner);               // A, B, tie, or indeterminate
console.log(result.scores);               // { A: 0-10, B: 0-10 }
console.log(result.differences);           // observed visual differences
console.log(result.comparisonConfidence); // 0-1
```

For compatibility with score-based matchers, `result.score` is the candidate
(`B`) score. Use `winner` for the pairwise verdict. Comparison runs in both
image orders by default; conflicting canonical winners return `indeterminate`
with `result.counterBalance.status === 'conflict'`. Set
`{ counterBalance: false }` to make a single comparison request.

## Structured Output

The judge negotiates the strongest output contract supported by the selected
provider and model: native JSON schema where known, JSON-object mode where
schema support is uncertain, and prompt-only JSON otherwise. Every response is
validated against one canonical result shape. Malformed output receives a
bounded retry containing validation diagnostics; legacy sectioned text remains
available as a scalar-review fallback.

Inspect `result.outputFormat` (`structured` or `legacy-text`) and
`result.structuredOutput` to diagnose which mode was used. Pairwise comparison
requires an unambiguous structured result.

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

## Selected Subpath Modules

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
- Native structured-output support varies by provider and model; unknown model
  overrides use a compatible weaker mode and report that choice in the result.
- The game agent requires Playwright and is intended for simple browser games.

## License

MIT
