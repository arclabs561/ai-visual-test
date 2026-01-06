# Playwright Integration - Quick Setup

**For development in this project**, Playwright is already installed and ready to use.

## Verify Installation

```bash
# Check if Playwright is installed
npm run playwright:check

# If not installed, install it
npm run playwright:install
```

## Run Integration Tests

```bash
# Run Playwright integration tests
npm run test:playwright-integration

# Or run all Playwright tests
npm run test:playwright
```

## Use in Your Tests

1. **Import and setup** (in your test file or setup file):
```javascript
import { expect } from '@playwright/test';
import { createMatchers } from '@arclabs561/ai-visual-test/playwright';

createMatchers(expect);
```

2. **Use in tests**:
```javascript
test('visual check', async ({ page }) => {
  await page.goto('https://example.com');
  await expect(page).toHaveVisualScore(7, 'Check visual quality');
});
```

## Examples

- `examples/playwright-setup.mjs` - Complete setup example
- `test/integration/playwright-integration.pwtest.mjs` - Integration tests (requires Playwright runner)
- `docs/PLAYWRIGHT_INTEGRATION.md` - Full documentation

## Status

✅ **Playwright is installed** (in devDependencies)  
✅ **Integration tests passing** (4/4 tests)  
✅ **Custom matchers working** (`toHaveVisualScore`, `toBeAccessibleHybrid`)  
✅ **Examples working** (`playwright-setup.mjs`)

