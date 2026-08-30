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

Dataset pixels, normalized rows, results, and upload confirmations are
intentionally not committed; `evaluation/` is ignored. Acquisition never
imports provider code, and live evaluation consumes a prior local receipt.
See [`fixtures/pairwise/README.md`](fixtures/pairwise/README.md) for the
offline pairwise protocol.

```bash
npm run evaluate:diffspot -- --fetch-only --limit 4
npm run evaluate:uicrit -- --fetch-only --limit 5
# requires HF_TOKEN in the environment
npm run evaluate:vibe -- --dataset design --fetch-only --limit 5
```

UICrit's public annotations alone do not authorize RICO pixel upload: live
evaluation needs separately authorized local pixels and a private confirmation
of the exact provider/model. Both Vibe datasets are gated; current local access
is unavailable (401), and the runner never accepts terms automatically. See
[`../docs/design/dataset-evaluation-protocol.md`](../docs/design/dataset-evaluation-protocol.md)
for the split acquisition/evaluation commands and dataset restrictions.
