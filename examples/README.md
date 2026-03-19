# Examples

Runnable examples for `@arclabs561/ai-visual-test`.

## Prerequisites

Set one API key in `.env` at the repo root:

```bash
GEMINI_API_KEY=your-key
# or OPENAI_API_KEY, ANTHROPIC_API_KEY, GROQ_API_KEY
```

Examples using Playwright also need:

```bash
npm install --save-dev @playwright/test
npx playwright install chromium
```

## Quick Reference

| I want to... | Start with |
|---|---|
| Validate a page for visual bugs | `use-case-4-real-website.mjs` |
| Test accessibility (programmatic + AI) | `use-case-1-enterprise-qa.mjs` |
| Test a game with AI agent | `use-case-2-indie-game-dev.mjs` |
| Set up Playwright matchers | `playwright-setup.mjs` |
| Use matchers in Playwright tests | `use-case-3-playwright-integration.mjs` |
| Reduce API costs with tier/provider selection | `cost-optimization.mjs` |
| Use auto-optimization flags | `auto-optimization.mjs` |
| Set up Vitest/Jest matchers | `vitest-matchers.mjs` |
| Compare before/after screenshots | `comparison.mjs` |

## Standalone Examples (run with node)

```bash
node examples/playwright-setup.mjs
node examples/use-case-1-enterprise-qa.mjs
node examples/use-case-2-indie-game-dev.mjs
node examples/use-case-3-playwright-integration.mjs
node examples/use-case-4-real-website.mjs
node examples/vitest-matchers.mjs
node examples/comparison.mjs
```

## Playwright Test Examples (run with npx playwright test)

`cost-optimization.mjs` and `auto-optimization.mjs` use `@playwright/test` and should be run via the Playwright test runner, not `node`.
