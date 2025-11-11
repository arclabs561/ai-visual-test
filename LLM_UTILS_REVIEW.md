# llm-utils Package Review

## Current State

### What llm-utils Actually Is

`llm-utils` is a **general-purpose LLM utility library** for text-only LLM calls across multiple providers (OpenAI, Anthropic, Gemini). It is NOT a git hooks manager, though it happens to be used BY git hooks in `ai-browser-test`.

**Core Purpose**: Provide a unified, simple API for text-only LLM operations across providers.

### Package Structure

```
llm-utils/
├── src/
│   ├── index.mjs          # Main exports
│   ├── client.mjs         # callLLM, LLMClient, MODEL_TIERS
│   ├── detector.mjs       # detectProvider (env var detection)
│   ├── utils.mjs          # extractJSON, extractText
│   └── rate-limiter.mjs   # RateLimiter class
├── test/                  # 12 tests, all passing
├── package.json
└── index.d.ts            # TypeScript definitions
```

### Exports

1. **`detectProvider()`** - Auto-detect provider from env vars
2. **`callLLM(prompt, provider, apiKey, options)`** - Unified LLM API
3. **`LLMClient`** - Class-based client wrapper
4. **`extractJSON(response)`** - Extract JSON from LLM responses
5. **`extractText(response)`** - Clean text from responses
6. **`RateLimiter`** - Rate limiting utility
7. **`MODEL_TIERS`** - Model tier configurations (simple/advanced)
8. **`getModel(provider, tier)`** - Get model name for tier

## Usage in ai-browser-test

### 1. Data Extraction (`src/data-extractor.mjs`)

**Purpose**: Extract structured data from text using LLM

```javascript
// Uses: callLLM, extractJSON
const llmUtils = await import('@arclabs561/llm-utils');
const response = await llmUtils.callLLM(prompt, provider, apiKey, {
  tier: 'advanced',  // Uses better models for extraction
  temperature: 0.1,
  maxTokens: 1000,
});
const parsed = llmUtils.extractJSON(response);
```

**Status**: ✅ Working well, uses advanced tier appropriately

### 2. Documentation Bloat Checker (`scripts/check-docs-bloat.mjs`)

**Purpose**: Analyze documentation files for redundancy using LLM

```javascript
// Uses: detectProvider, callLLM, extractJSON
import { detectProvider, callLLM, extractJSON } from '@arclabs561/llm-utils';

const llmConfig = detectProvider();
const response = await callLLM(prompt, llmConfig.provider, llmConfig.apiKey, {
  tier: 'simple',  // Fast/cheap for analysis
  maxTokens: 2000,
});
const analysis = extractJSON(response);
```

**Status**: ✅ Working well, uses simple tier appropriately

**Git Hook**: Used by `.husky/pre-commit` (indirectly, as a script)

### 3. Commit Message Validator (`scripts/validate-commit-msg.mjs`)

**Purpose**: Validate commit messages using LLM for intelligent feedback

```javascript
// Uses: detectProvider, callLLM, extractJSON
import { detectProvider, callLLM, extractJSON } from '@arclabs561/llm-utils';

const llmConfig = detectProvider();
const response = await callLLM(prompt, llmConfig.provider, llmConfig.apiKey, {
  tier: 'simple',  // Fast/cheap for validation
  maxTokens: 1000,
});
const analysis = extractJSON(response);
```

**Status**: ✅ Working well, uses simple tier appropriately

**Git Hook**: Used by `.husky/commit-msg` directly

## Design Assessment

### ✅ What's Good

1. **General-purpose design is correct**
   - Reusable across contexts (not just git hooks)
   - Single responsibility: LLM utilities
   - Can be used in scripts, applications, hooks, etc.

2. **Clean API**
   - Simple, consistent interface
   - Good separation of concerns
   - TypeScript definitions included

3. **Tiered model selection**
   - `simple` tier for fast/cheap operations (hooks, validation)
   - `advanced` tier for quality-critical operations (data extraction)
   - Smart defaults

4. **Provider abstraction**
   - Unified API across OpenAI, Anthropic, Gemini
   - Auto-detection from env vars
   - Easy to switch providers

5. **Good test coverage**
   - 12 tests, all passing
   - Tests core functionality

### ⚠️ Potential Issues

1. **RateLimiter exported but unused**
   - Exported from package but not used in ai-browser-test
   - Could be useful for batch operations
   - Consider: Is it needed? Should it be used?

2. **No .env file loading**
   - Reads `process.env` directly
   - ai-browser-test has `load-env.mjs` to load .env files
   - This is actually fine - keeps llm-utils pure and simple
   - Consumers can load .env before importing

3. **Limited error handling documentation**
   - Errors are thrown, but retry logic exists
   - Could document error types better

4. **No usage examples in README**
   - README is basic
   - Could show more examples (git hooks, data extraction, etc.)

## Recommendations

### 1. Keep General-Purpose Design ✅

**Decision**: The general-purpose design is correct and should be kept.

**Reasoning**:
- More flexible and reusable
- Single responsibility principle
- Can be used in hooks, scripts, applications, etc.
- Better separation of concerns

**If you wanted git hooks focus**, you'd need a separate package like `git-hooks-llm` that uses `llm-utils` internally.

### 2. Consider Using RateLimiter

**Current**: RateLimiter is exported but not used in ai-browser-test

**Recommendation**: 
- If doing batch operations, consider using RateLimiter
- Or remove it if not needed
- Or document when to use it

### 3. Improve Documentation

**Add to README**:
- Usage examples for git hooks
- When to use simple vs advanced tier
- Error handling patterns
- Rate limiting usage

### 4. Consider Adding More Utilities

**Potential additions** (if needed):
- Prompt templates for common tasks
- Structured output helpers
- Streaming support (if needed)

## Quality Assessment

### ✅ Package Quality: Good

- ✅ Tests passing (12/12)
- ✅ TypeScript definitions
- ✅ Clean code structure
- ✅ Good separation of concerns
- ✅ Proper exports
- ✅ Environment variable handling
- ✅ Error handling with retries
- ✅ Tiered model selection

### ✅ Integration Quality: Good

- ✅ Properly linked via npm link
- ✅ Used appropriately in ai-browser-test
- ✅ Optional dependency (graceful fallback)
- ✅ Correct tier selection per use case

## Conclusion

**The general-purpose design is correct and working well.** 

`llm-utils` is a solid, reusable utility library that happens to be used by git hooks, but it's not a git hooks manager. This is the right design - it's more flexible and follows good software engineering principles.

**No major changes needed**, but consider:
1. Using RateLimiter if doing batch operations
2. Improving README with more examples
3. Documenting error handling patterns

