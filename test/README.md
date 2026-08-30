# Tests

| Directory | Purpose | Command |
| --- | --- | --- |
| `test/unit/` | Fast, isolated behavior | `npm run test:unit` |
| `test/integration/` | Component interactions | `npm run test:integration` |
| `test/e2e/` | Browser and workflow coverage | `npm run test:e2e` |
| `test/security/` | Security regressions | `npm run test:security` |
| `test/types/` | Public TypeScript API | `npm run test:types` |

`npm test` runs the unit suite. Tests load `.env` through
`test/test-setup.mjs`; provider-backed checks skip unless explicitly enabled
and configured. The Playwright integration lane is separately opt-in:

```bash
AI_VISUAL_TEST_LIVE=1 npm run test:playwright-integration
```

Run one staged test file with Node after building:

```bash
npm run build:stage
node --test build/test/integration/judge.test.mjs
```

Dataset pixels, normalized rows, results, and confirmations are intentionally
not committed: `evaluation/` is ignored. Acquisition never imports provider
code, and evaluation consumes a prior local receipt. The public dataset command
surface is local-first. Pixel-bearing runners can use loopback Ollama, or an
explicit OpenRouter model and endpoint after live opt-in and dataset-bound
upload confirmation. BetterApp is license-unknown and Apple ML-RLDF is
non-commercial, so neither is a release-gate corpus.

Each local receipt binds its selected examples and source artifacts by hash.
Use a fixed-model direct call as the baseline, then replay that exact receipt
when testing prompt, evidence, or graph variants. This keeps a model-capability
measurement separate from gains caused by added context or orchestration.
Treat bounded runs as smoke checks; report corpus size and cost alongside any
result, and do not present them as benchmark metrics.

The recorded fixed baseline used `google/gemini-3.6-flash` on a pinned Google
AI Studio route with no fallback: 276 accepted calls, `$0.328296` receipt cost,
and hash-bound inputs. Its `n=20` results are documented in the protocol; the
`n=36` Dataset-interfaces-GUI run is characterization only, not accuracy.

```bash
# regression
npm run evaluate:diffspot -- --fetch-only --limit 4

# public critique annotations; add --download-rico for selected local images
npm run evaluate:uicrit -- --fetch-only --limit 5

# public images with label-free characterization
npm run evaluate:gui-aesthetics -- --fetch-only --limit 36

# anonymous public grounding data
npm run evaluate:grounding -- --dataset ui-vision --fetch-only --limit 20
npm run evaluate:grounding -- --dataset screenspot-pro --fetch-only --limit 20

# exploratory preference data; hosted use requires explicit confirmation
npm run evaluate:betterapp -- --fetch-only --limit 20
npm run evaluate:apple-rldf -- --fetch-only
```

Dataset-interfaces-GUI has no publisher-provided machine-readable
high/medium/low mapping, so it can be characterized locally but cannot produce
an accuracy claim without an operator-owned private label manifest. Gated Vibe
datasets are intentionally not exposed as runnable commands. See
[`../docs/design/dataset-evaluation-protocol.md`](../docs/design/dataset-evaluation-protocol.md)
for the complete acquire, normalize, and local-evaluation flows. Current local
runs are small smoke checks, not benchmark claims.
