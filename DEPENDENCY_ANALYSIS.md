# Dependency & Setup Analysis

## Summary

Analysis of local npm package dependencies, API boundaries, .env setup, husky hooks, and GitHub workflows across:
- `llm-utils` (base layer)
- `ai-browser-test` (middle layer)  
- `queeraoke` (application layer)

## Issues Found

### 🔴 Critical: Version Mismatch

**queeraoke is using outdated npm registry version**

- **Current**: queeraoke uses `ai-browser-test@0.1.1` from npm registry
- **Expected**: Should use local `ai-browser-test@0.2.0` via npm link
- **Impact**: Missing features/fixes from 0.2.0
- **Fix**: 
  ```bash
  cd /Users/arc/Documents/dev/ai-browser-test
  npm link
  cd /Users/arc/Documents/dev/queeraoke
  npm uninstall ai-browser-test
  npm link ai-browser-test
  ```

### 🟡 Missing .env.example Files

**Documentation gap for required environment variables**

- **ai-browser-test**: Has `.env` but no `.env.example`
- **llm-utils**: No `.env` or `.env.example` (but needs API keys for LLM calls)
- **queeraoke**: ✅ Has both `.env` and `env.example`

**Required env vars:**
- `GEMINI_API_KEY` (or `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`)
- `VLM_PROVIDER` (optional, auto-detected)

### 🟡 Missing GitHub Workflows

**No CI/CD automation**

- None of the three repos have `.github/workflows/*.yml` files
- Should have:
  - Test runs on PR/push
  - Version bump validation
  - Dependency security checks

## What's Working Well ✅

### API Boundaries

**Correct separation of concerns:**

1. **llm-utils** (base)
   - Exports: `callLLM`, `detectProvider`, `extractJSON`, `LLMClient`
   - Used internally by: `ai-browser-test` only
   - ✅ Not exposed to queeraoke

2. **ai-browser-test** (middle)
   - Exports: `validateScreenshot`, `createConfig`, `BatchOptimizer`, etc.
   - Uses `@arclabs561/llm-utils` internally (optional peer dependency)
   - ✅ Public API used correctly by queeraoke

3. **queeraoke** (application)
   - ✅ Uses only public APIs from `ai-browser-test`
   - ✅ No direct access to `llm-utils`

### Local Dev Setup

**ai-browser-test → llm-utils:**
- ✅ Correctly linked via `npm link` to `../llm-utils`
- ✅ Symlink: `node_modules/@arclabs561/llm-utils` → `../../../llm-utils`

### Husky Hooks

**All three repos have husky configured:**

- **ai-browser-test**: pre-commit, pre-push, post-commit, post-merge, post-rewrite
- **llm-utils**: pre-commit, pre-push  
- **queeraoke**: pre-commit, pre-push

### GitHub Setup

**All repos have git remotes configured:**

- **ai-browser-test**: `https://github.com/arclabs561/ai-browser-test.git`
- **llm-utils**: `https://github.com/arclabs561/llm-utils.git`
- **queeraoke**: `https://github.com/henrywallace/queeraoke.git`

## Recommendations

### Immediate Actions

1. **Fix queeraoke dependency:**
   ```bash
   cd /Users/arc/Documents/dev/queeraoke
   npm uninstall ai-browser-test
   cd /Users/arc/Documents/dev/ai-browser-test
   npm link
   cd /Users/arc/Documents/dev/queeraoke
   npm link ai-browser-test
   ```

2. **Add .env.example files:**
   - `ai-browser-test/.env.example`: Document VLM provider keys
   - `llm-utils/.env.example`: Document LLM provider keys

3. **Add GitHub workflows:**
   - Basic CI: test on push/PR
   - Version validation: ensure version bumps on releases
   - Dependency audit: security checks

### Long-term Improvements

1. **Consider npm workspaces** for monorepo management (if all three should be versioned together)
2. **Add .env validation** scripts to check required vars before tests
3. **Document local dev setup** in README files
4. **Add pre-publish checks** to ensure local links are removed before npm publish

## Dependency Graph

```
queeraoke (application)
  └── ai-browser-test@0.1.1 ❌ (should be 0.2.0 local link)

ai-browser-test (middle)
  └── @arclabs561/llm-utils@0.1.0 ✅ (local link to ../llm-utils)

llm-utils (base)
  └── (no dependencies)
```

## API Usage Analysis

### queeraoke → ai-browser-test (54 imports across 38 files)

**Public APIs used (all correct):**
- `validateScreenshot`
- `createConfig`
- `captureTemporalScreenshots`
- `extractRenderedCode`
- `aggregateTemporalNotes`
- `formatNotesForPrompt`
- `BatchOptimizer`
- `ScoreTracker`
- `compressContext`
- `multiModalValidation`
- `loadEnv`
- `VLLMJudge`

**No internal APIs accessed** ✅

### ai-browser-test → llm-utils

**Internal usage (correct):**
- `src/data-extractor.mjs`: Uses `callLLM`, `extractJSON` (optional import)
- `scripts/check-docs-bloat.mjs`: Uses `detectProvider`, `callLLM`, `extractJSON`
- `scripts/validate-commit-msg.mjs`: Uses `detectProvider`, `callLLM`, `extractJSON`

**Not exposed to queeraoke** ✅

