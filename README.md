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

## Perception (judge graph)

`validateScreenshot` is the GATE (score against fixed anchors). `./perception` is
the COMPASS: it samples what real viewers PERCEIVE and discovers the failures a
fixed rubric did not anticipate, using a diverse JURY of judge models that learns
which of its judges to trust over runs.

```js
import { makePanel, makeOpenRouterText, samplePerceptions, formatReport,
         calibrateJudges, selectForReview } from "@arclabs561/ai-visual-test/perception";

const imageBase64 = readFileSync("wall.png").toString("base64");
// Different labs decorrelate bias; one model's samples only repeat it.
const panel = makePanel({ apiKey, imageBase64, models: [
  "google/gemini-3.5-flash", "anthropic/claude-haiku-4.5", "openai/gpt-5-mini",
] });

const result = await samplePerceptions({
  panel,
  complete: makeOpenRouterText({ apiKey }),        // cross-judge merge (optional)
  personas: [{ id: "user", who: "a first-time visitor", weight: 1 }],
  contexts: [{ id: "glance", ctx: "glancing at the screen" }],
  principles: ["dense by design -- do not flag information density"], // override the generic UX heuristics
});
console.log(formatReport(result));

// Learn over runs (persist + feed back the returned state):
const weights = calibrateJudges({ prior: {}, sections: result.sections });
const toLabel = selectForReview(result.sections, { k: 3, panelSize: panel.length });
```

Mechanisms: diverse panel, generic Nielsen/Gestalt `UX_HEURISTICS` seeded into the
prompts (overridable by domain `principles`), diversity-weighted aggregation,
cross-judge `mergeFindings`, cross-model verification, and an online loop
(`calibrateJudges` / `decayDispositions` / `selectForReview`). Full design +
research grounding: [docs/judge-graph.md](docs/judge-graph.md).

## Advanced Features

Additional modules available as subpath imports: `perception` (judge-graph compass, above), `validators` (hybrid accessibility, rubric-based, batch), `temporal` (multi-scale analysis), `ensemble` (multi-provider judging, bias/hallucination detection), `persona` (test as different user types), `game` (AI game agent for Canvas/WebGL), `multi-modal` (screenshot + HTML + CSS fusion), `utils` (cost tracking, calibration), `errors`.

## Limitations

- Scores are non-deterministic: same image + prompt can return different scores across calls. Use caching or ensemble judging for stability.
- Groq's multi-image support is limited (llama-4-scout returns null scores for comparison).
- Game agent requires Playwright and works best with simple 2D games.
- No offline mode: requires an API key and network access.

## License

MIT
