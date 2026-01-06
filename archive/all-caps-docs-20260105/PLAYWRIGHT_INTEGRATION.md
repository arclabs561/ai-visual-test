# Playwright Integration Guide

Complete guide to using `@arclabs561/ai-visual-test` with Playwright.

## Installation

### For Development (This Project)

Playwright is already installed as a dev dependency. No setup needed.

### For Your Project

```bash
npm install --save-dev @playwright/test
npx playwright install chromium
```

## Quick Start

### 1. Setup Custom Matchers

Create a test setup file (e.g., `tests/setup.mjs` or in your `playwright.config.js`):

```javascript
import { expect } from '@playwright/test';
import { createMatchers } from '@arclabs561/ai-visual-test/playwright';

// Extend expect with custom matchers
createMatchers(expect);
```

### 2. Use in Tests

```javascript
import { test, expect } from '@playwright/test';

test('visual quality check', async ({ page }) => {
  await page.goto('https://example.com');
  
  // Visual quality matcher
  await expect(page).toHaveVisualScore(7, 'Check for visual bugs and accessibility');
  
  // Hybrid accessibility matcher
  await expect(page).toBeAccessibleHybrid(4.5);
});
```

## Available Matchers

### `toHaveVisualScore(minScore, prompt, options)`

Validates that a page or screenshot meets a minimum visual quality score.

**Parameters:**
- `target`: `Page` object or screenshot path (string)
- `minScore`: Minimum score (0-10)
- `prompt`: Evaluation prompt (optional, default: 'Evaluate visual quality')
- `options`: Validation options (optional)

**Example:**
```javascript
// With page object
await expect(page).toHaveVisualScore(7, 'Check for visual bugs');

// With screenshot path
await expect('screenshot.png').toHaveVisualScore(7, 'Check quality');
```

### `toBeAccessibleHybrid(minContrast, options)`

Validates accessibility using hybrid validation (programmatic + AI).

**Parameters:**
- `page`: Playwright `Page` object
- `minContrast`: Minimum contrast ratio (default: 4.5)
- `options`: Validation options (optional)

**Note:** This matcher may fail if AI finds semantic issues, even if programmatic checks pass. This is expected behavior - hybrid validation is stricter than programmatic alone.

**Example:**
```javascript
await expect(page).toBeAccessibleHybrid(4.5);
```

## Configuration

### API Keys

Set API keys in `.env`:
```bash
GEMINI_API_KEY=your-key-here
# or
OPENAI_API_KEY=your-key-here
# or
ANTHROPIC_API_KEY=your-key-here
```

### Playwright Config

Add to `playwright.config.js`:

```javascript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  // ... your config
  testDir: './tests',
  use: {
    // ... your settings
  },
  // Setup files run before each test file
  setupFiles: ['./tests/setup.mjs']
});
```

## Examples

### Complete Test Example

```javascript
import { test, expect } from '@playwright/test';
import { createMatchers } from '@arclabs561/ai-visual-test/playwright';

createMatchers(expect);

test.describe('My App', () => {
  test('homepage visual quality', async ({ page }) => {
    await page.goto('https://myapp.com');
    
    // Check visual quality
    await expect(page).toHaveVisualScore(8, 'Check homepage design quality');
  });
  
  test('checkout accessibility', async ({ page }) => {
    await page.goto('https://myapp.com/checkout');
    
    // Check accessibility (hybrid)
    await expect(page).toBeAccessibleHybrid(4.5);
  });
});
```

### Using validatePage() Directly

If you prefer not to use matchers:

```javascript
import { validatePage } from '@arclabs561/ai-visual-test';

test('custom validation', async ({ page }) => {
  await page.goto('https://example.com');
  
  const result = await validatePage(page, 'Check for visual bugs');
  
  if (result.score < 7) {
    console.error('Issues found:', result.issues);
  }
  
  expect(result.score).toBeGreaterThanOrEqual(7);
});
```

## Troubleshooting

### Matchers Not Found

**Error:** `expect(page).toHaveVisualScore is not a function`

**Solution:** Make sure you've called `createMatchers(expect)` before using the matchers.

```javascript
import { createMatchers } from '@arclabs561/ai-visual-test/playwright';
createMatchers(expect); // Call this first!
```

### API Key Missing

**Error:** `API validation disabled`

**Solution:** Set an API key in `.env`:
```bash
GEMINI_API_KEY=your-key-here
```

### Playwright Not Installed

**Error:** `Cannot find module '@playwright/test'`

**Solution:**
```bash
npm install --save-dev @playwright/test
npx playwright install chromium
```

## Best Practices

1. **Call `createMatchers()` once** in your test setup file, not in each test
2. **Use descriptive prompts** for better AI evaluation
3. **Set appropriate score thresholds** based on your quality standards
4. **Handle hybrid validation failures gracefully** - AI may find semantic issues even if programmatic checks pass
5. **Use `validatePage()` directly** for more control over validation options

## See Also

- [API_QUICK_REFERENCE.md](../API_QUICK_REFERENCE.md) - Complete API reference
- [EXAMPLES.md](../EXAMPLES.md) - More code examples
- [examples/playwright-setup.mjs](../examples/playwright-setup.mjs) - Working setup example

