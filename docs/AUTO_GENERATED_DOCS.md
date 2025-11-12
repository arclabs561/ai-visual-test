# Auto-Generated Documentation

## Overview

Documentation is **auto-generated from TSDoc/JSDoc comments** in the source code using **TypeDoc**. TypeDoc is the modern standard for TypeScript/JavaScript ES modules (2025) and ensures docs stay in sync with code.

## Why TypeDoc?

- ✅ **Modern standard** (2025) for ES modules and TypeScript
- ✅ **Native ES module support** - Works with `.mjs` files
- ✅ **Type-aware** - Understands types even from JSDoc
- ✅ **TSDoc compatible** - Supports Microsoft's TSDoc standard
- ✅ **Backward compatible** - Works with existing JSDoc comments
- ✅ **Better output** - Modern HTML with search, navigation, type info

## Generating Documentation

```bash
# Generate docs from TSDoc/JSDoc comments
npm run docs

# Direct TypeDoc command
npm run docs:typedoc

# Watch mode (regenerate on file changes)
npm run docs:watch
```

## Generated Output

- **Full TypeDoc docs**: `docs-generated/` - Complete API reference with types
- **Simplified API ref**: `docs-site/api-reference.html` - Embedded in docs site

## Documentation Format

All public APIs should have TSDoc/JSDoc comments:

```javascript
/**
 * Validate a screenshot using Vision Language Models
 * 
 * @param {string | string[]} imagePath - Single image path or array for comparison
 * @param {string} prompt - Evaluation prompt
 * @param {import('./index.mjs').ValidationContext} [context={}] - Validation context
 * @returns {Promise<import('./index.mjs').ValidationResult>} Validation result
 * 
 * @example
 * ```javascript
 * const result = await validateScreenshot('screenshot.png', 'Evaluate this page');
 * console.log(result.score); // 0-10
 * ```
 */
export async function validateScreenshot(imagePath, prompt, context = {}) {
  // ...
}
```

### TSDoc Style (Recommended for TypeScript, also works with JS)

```typescript
/**
 * Validate a screenshot using Vision Language Models
 * 
 * @param imagePath - Single image path or array for comparison
 * @param prompt - Evaluation prompt
 * @param context - Validation context (optional)
 * @returns Validation result with score, issues, and reasoning
 * 
 * @example
 * ```typescript
 * const result = await validateScreenshot('screenshot.png', 'Evaluate this page');
 * console.log(result.score); // 0-10
 * ```
 */
```

## What Gets Documented

- **Public functions** - All exported functions
- **Classes** - All exported classes
- **Types** - Type definitions via `@typedef` or TypeScript
- **Examples** - Code examples via `@example`

## Manual Documentation

Some docs are still manually maintained (and should be):

- **Guides** (`docs/API_ESSENTIALS.md`) - How-to guides, best practices
- **Research** (`docs/RESEARCH_INTEGRATION.md`) - Research papers, citations
- **Plans** (`docs/ABLATION_STUDY_PLAN.md`) - Project plans, strategies

## Keeping Docs in Sync

1. **Write JSDoc comments** when adding new APIs
2. **Run `npm run docs`** before committing
3. **Review generated docs** to ensure they're clear
4. **Update examples** if API changes

## CI/CD Integration

Add to CI pipeline:

```yaml
- name: Generate docs
  run: npm run docs
  
- name: Check docs are up to date
  run: git diff --exit-code docs-generated/
```

This ensures docs are always generated and committed.

