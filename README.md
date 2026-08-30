# ai-visual-test

Review screenshots against a natural-language expectation with a vision model.
It returns a score, issues, recommendations, and the provider/model used.

## Install

```bash
npm install @arclabs561/ai-visual-test
```

Node 18 or newer is required. The Playwright integration also needs
`@playwright/test` in your project.

## Configure

`.env` files are loaded automatically. Set a provider and its API key:

```bash
VLM_PROVIDER=gemini
GEMINI_API_KEY=your-key-here
```

Supported providers are `gemini`, `openai`, `claude`, `groq`, and `openrouter`.
Use `ANTHROPIC_API_KEY` for `claude`; the others use `<PROVIDER>_API_KEY`.
`VLM_MODEL` or a per-call `model` option pins a model.

Optionally fail early in test setup:

```js
import { validateStartup } from '@arclabs561/ai-visual-test';

validateStartup();
```

## Review a screenshot

```js
import { validateScreenshot } from '@arclabs561/ai-visual-test';

const result = await validateScreenshot(
  'checkout.png',
  'The payment form is readable, complete, and usable.',
  { provider: 'gemini' },
);

console.log(result.score);           // 0–10, or null when validation is disabled
console.log(result.issues);          // detected problems
console.log(result.recommendations); // suggested fixes
```

## Integrations

| Need | Import | API |
| --- | --- | --- |
| Review a Playwright page | `@arclabs561/ai-visual-test` | `validatePage(page, prompt, options)` |
| Add Playwright matchers | `@arclabs561/ai-visual-test/playwright` | `createMatchers(expect)` |
| Add Vitest/Jest matchers | `@arclabs561/ai-visual-test/vitest` or `/jest` | `createMatchers(expect)` |
| Compare before/after images | `@arclabs561/ai-visual-test` | `validateComparison(before, after, prompt)` |

For Playwright, call `createMatchers(expect)` once in test setup, then use
`expect(page).toHaveVisualScore(minimum, prompt)` or
`expect(page).toBeAccessibleHybrid(minContrast)`. For Vitest or Jest, use
`expect(imagePath).toPassVisualCheck(prompt)` or
`expect(imagePath).toHaveVisualScore(minimum, prompt)`.

`validatePage` captures a temporary screenshot; set `fullPage`, pass native
screenshot options through `screenshot`, or set `keepScreenshot: true` when
you need to inspect it.

## Improve a downstream UI

`@arclabs561/ai-visual-test/improvement` reviews one caller-owned candidate
against a captured baseline. Your project supplies the reversible adapter,
deterministic gates, evidence projection, and evaluator:

```js
import { runImprovementReview } from '@arclabs561/ai-visual-test/improvement';

const receipt = await runImprovementReview({
  objective, candidate, adapter, observer, projector, evaluator, evaluation,
});
```

After an apply attempt, the transaction invokes rollback and requires a fresh
observation matching the baseline. A rollback failure throws and may require
project-owned recovery. A preferred candidate returns `review-required`; the
kernel never accepts or reapplies it.

The adapter, observer, projector, and evaluator are trusted in-process
callbacks; this API does not sandbox them or choose a model provider. Replay
identities combine kernel-derived evidence hashes with caller-attested
candidate, projector, prompt-variant, and evaluator-configuration hashes. They
support controlled comparisons only when those attestations are trustworthy.
See the
[complete example](https://github.com/arclabs561/ai-visual-test/blob/main/examples/improvement-review.mjs)
for the full contract.

## CLI

```bash
npx ai-visual-test check checkout.png "The payment form is usable" --min-score 7
```

Use `--provider`, `--model`, `--json`, or `--verbose` as needed. The command
exits successfully only when the score meets `--min-score`.

## Limits

- Reviews require network access and a configured provider API key.
- Scores are non-deterministic. Pin the provider and model, and use a stable
  prompt and cache when repeatability matters.
- A score is a model judgment, not a replacement for functional or accessibility
  testing.
- Provider/model capabilities, including multi-image and structured output,
  differ. Pin them when reproducibility matters.

## License

[MIT](LICENSE)
