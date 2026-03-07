# ai-visual-test

[![npm](https://img.shields.io/npm/v/@arclabs561/ai-visual-test)](https://www.npmjs.com/package/@arclabs561/ai-visual-test)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Visual testing framework using Vision Language Models. Validates screenshots, checks accessibility, and can play games.

## Why This Package

Pixel-based testing breaks when content changes. This tool asks "does this look correct?" instead of "did pixels change?"

## Installation

```bash
npm install @arclabs561/ai-visual-test
```

## Configuration

Set an API key in a `.env` file:

```bash
# .env file
GEMINI_API_KEY=your-key-here
# or
OPENAI_API_KEY=your-key-here
# or
ANTHROPIC_API_KEY=your-key-here
```

## Quick Start

### With Playwright

```javascript
import { validatePage } from '@arclabs561/ai-visual-test';
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('https://example.com');

// validatePage() handles screenshotting
const result = await validatePage(page, 'Check for visual bugs and accessibility issues');

console.log(result.score);  // 7 (0-10 scale)
console.log(result.issues); // ['Missing error messages', 'Low contrast']
```

### With Screenshot Path

```javascript
import { validateScreenshot } from '@arclabs561/ai-visual-test';

const result = await validateScreenshot(
  'screenshot.png',
  'Check if this payment form is accessible and usable'
);

console.log(result.score);  // 7 (0-10 scale)
console.log(result.issues); // ['Missing error messages', 'Low contrast']
```

## Key Features

### 1. Hybrid Validation
Combines deterministic code checks (contrast ratios, aria-labels) with AI visual judgment.

```javascript
import { validateAccessibilityHybrid } from '@arclabs561/ai-visual-test/validators';
// Checks code AND pixels
const result = await validateAccessibilityHybrid(page, 'shot.png');
```

### 2. AI Game Agent
Plays Canvas/WebGL games by analyzing screenshots and planning actions. Includes Reflexion (learning from mistakes) and Chain of Thought.

```javascript
import { playGame } from '@arclabs561/ai-visual-test';
await playGame(page, { goal: 'Win the level', maxSteps: 50 });
```

### 3. Cost Optimization
Caching, model tiering, and provider selection. See `test/performance/optimization-claims-validation.test.mjs` for validation.

## Documentation

- [**EXAMPLES.md**](./EXAMPLES.md) - Code snippets for Game Playing, Hybrid Validation, Playwright integration.
- [**API_QUICK_REFERENCE.md**](./API_QUICK_REFERENCE.md) - Function signatures and options.
- [**examples/**](./examples/) - Runnable examples.
- **TypeScript**: Type definitions included.

## Playwright Integration

Custom matchers for Playwright tests. **Requires `@playwright/test` to be installed** (already in devDependencies for this project).

### Setup

```javascript
import { expect } from '@playwright/test';
import { createMatchers } from '@arclabs561/ai-visual-test/playwright';

// Extend expect with custom matchers (call once in your test setup)
createMatchers(expect);
```

### Usage in Tests

```javascript
test('visual quality', async ({ page }) => {
  await page.goto('https://example.com');
  
  // Visual quality check
  await expect(page).toHaveVisualScore(7, 'Check visual quality');
  
  // Hybrid accessibility check (programmatic + AI)
  await expect(page).toBeAccessibleHybrid(4.5);
});
```

### Installation

For development in this project, Playwright is already installed. For use in other projects:

```bash
npm install --save-dev @playwright/test
npx playwright install chromium
```

See `examples/playwright-setup.mjs` for setup example.

Documentation: [docs/PLAYWRIGHT_INTEGRATION.md](./docs/PLAYWRIGHT_INTEGRATION.md)

## License

MIT
