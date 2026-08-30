# Examples

Examples use `@arclabs561/ai-visual-test` from this package. Set a provider
key in an untracked `.env` file or in your environment:

```bash
GEMINI_API_KEY=your-key
# or OPENAI_API_KEY, ANTHROPIC_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY
```

| Need | Example |
| --- | --- |
| Validate a page | `use-case-4-real-website.mjs` |
| Check accessibility | `use-case-1-enterprise-qa.mjs` |
| Test a game | `use-case-2-indie-game-dev.mjs` |
| Compare screenshots | `comparison.mjs` |
| Add Playwright matchers | `playwright-setup.mjs` or `use-case-3-playwright-integration.mjs` |
| Add Vitest/Jest matchers | `vitest-matchers.mjs` |
| Review a video | `video-critique.mjs path/to/video.webm` |
| Wire a reversible improvement review | `improvement-review.mjs` |

Run the examples other than the two optimization examples with Node:

```bash
node examples/comparison.mjs
node examples/video-critique.mjs path/to/video.webm
```

The Playwright examples also require the peer dependency and a browser:

```bash
npm install --save-dev @playwright/test
npx playwright install chromium
```

`cost-optimization.mjs` and `auto-optimization.mjs` are Playwright test files;
run them with `npx playwright test`.
