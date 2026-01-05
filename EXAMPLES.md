# Essential Examples

Working examples for common use cases.

## Basic Validation

```javascript
import { validateScreenshot } from '@arclabs561/ai-visual-test';

const result = await validateScreenshot(
  'screenshot.png',
  'Check if this payment form is accessible and usable'
);

console.log('Score:', result.score);      // 7 (0-10 scale)
console.log('Issues:', result.issues);     // ['Missing error messages', 'Low contrast']
console.log('Reasoning:', result.reasoning); // "The form is mostly accessible, but..."
```

## With Playwright (Recommended)

### Using `validatePage()` - Simplest Approach

```javascript
import { validatePage } from '@arclabs561/ai-visual-test';
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('https://example.com/checkout');

// validatePage() handles screenshotting automatically
const result = await validatePage(page, 'Check if payment form is accessible');

console.log('Score:', result.score); // 8.2
console.log('Issues:', result.issues);
```

### Using Custom Matchers

**Requires `@playwright/test` to be installed** (already in devDependencies for this project).

```javascript
import { test, expect } from '@playwright/test';
import { createMatchers } from '@arclabs561/ai-visual-test/playwright';

// Extend expect with custom matchers (call once in your test setup file)
createMatchers(expect);

test('payment screen', async ({ page }) => {
  await page.goto('https://example.com/checkout');
  
  // Custom matcher for visual score
  await expect(page).toHaveVisualScore(7, 'Check visual quality');
  
  // Custom matcher for accessibility (hybrid: programmatic + AI)
  // Note: May fail if AI finds semantic issues, but programmatic checks should pass
  await expect(page).toBeAccessibleHybrid(4.5);
});
```

**Setup in your project:**
```bash
npm install --save-dev @playwright/test
npx playwright install chromium
```

See `examples/playwright-setup.mjs` for a complete working example.

### Manual Screenshot Approach (Legacy)

```javascript
import { test } from '@playwright/test';
import { validateScreenshot } from '@arclabs561/ai-visual-test';

test('payment screen', async ({ page }) => {
  await page.goto('https://example.com/checkout');
  await page.screenshot({ path: 'checkout.png' });
  
  const result = await validateScreenshot(
    'checkout.png',
    'Check if payment form is accessible'
  );
  
  console.log('Score:', result.score); // 8.2
});
```

## Hybrid Accessibility Validation

Combines fast programmatic checks (contrast, keyboard navigation) with AI semantic evaluation.

```javascript
import { validateAccessibilityHybrid } from '@arclabs561/ai-visual-test/validators';
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('https://example.com');

const screenshotPath = 'page.png';
await page.screenshot({ path: screenshotPath });

// Hybrid validation: programmatic + AI
const result = await validateAccessibilityHybrid(page, screenshotPath, 4.5);

console.log('Passed:', result.passed); // true/false
console.log('Programmatic issues:', result.programmaticData.contrast.violations.length);
console.log('Visual issues:', result.issues.length);
console.log('Unique issues:', result.uniqueIssues);
```

## Game Playing (Agentic)

The library can play games or interactive apps using an AI agent that "sees" the screen and plans actions.

```javascript
import { playGame } from '@arclabs561/ai-visual-test';

// Play a game for 100 steps or until "Game Over"
const result = await playGame(page, {
  goal: 'Maximize score and avoid obstacles',
  maxSteps: 100,
  fps: 2, // Decision frequency (AI thinks at 2Hz)
  gameActivationKey: 'Space', // Key to start game
  tempDir: './game-debug' // Save screenshots of gameplay
});

console.log('Final Score:', result.finalState.evaluation.score);
console.log('History:', result.history.map(h => h.action.type));
```

## Hybrid Accessibility (Gold Standard)

Combines programmatic checks (axe-like contrast/aria) with AI visual verification (layout/context).

```javascript
import { validateAccessibilityHybrid } from '@arclabs561/ai-visual-test/validators';

// Requires Playwright page object
const result = await validateAccessibilityHybrid(
  page,
  'screenshot.png',
  4.5, // Min contrast ratio
  {
    testType: 'accessibility-hybrid'
  }
);

console.log('Passes:', result.passed); // true/false
console.log('Programmatic Issues:', result.programmatic.violations); // Exact rule failures
console.log('Visual Issues:', result.semantic.issues); // AI-detected layout/context issues
```

## Cost Optimization

```javascript
import { validateScreenshot } from '@arclabs561/ai-visual-test';

const result = await validateScreenshot(
  'screenshot.png',
  'Evaluate accessibility',
  {
    autoSelectTier: true,      // Auto-select tier (fast/balanced/best)
    autoSelectProvider: true,  // Auto-select cheapest provider
    includeCostComparison: true // Show cost savings
  }
);

console.log(`Provider: ${result.provider}`);
console.log(`Cost: $${result.estimatedCost?.totalCost}`);
console.log(`Savings: ${result.costComparison?.savings.fast?.percent}%`);
```

## Error Handling

```javascript
import { validateScreenshot, ValidationError } from '@arclabs561/ai-visual-test';

try {
  const result = await validateScreenshot('screenshot.png', 'Evaluate');
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Validation error:', error.message);
    console.error('Details:', error.details);
  } else {
    console.error('Unexpected error:', error);
  }
}
```
