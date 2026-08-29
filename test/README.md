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

Dataset and pairwise evaluation inputs are intentionally not committed. See
[`fixtures/pairwise/README.md`](fixtures/pairwise/README.md) for the offline
pairwise protocol. `npm run evaluate:diffspot -- --fetch-only --limit 4`
downloads a bounded, revision-pinned sample into ignored storage.
