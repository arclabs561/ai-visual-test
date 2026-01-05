# API Quick Reference

API patterns for `@arclabs561/ai-visual-test`.

## Core Function

```javascript
import { validateScreenshot } from '@arclabs561/ai-visual-test';

const result = await validateScreenshot(
  'screenshot.png',
  'Evaluate this page for accessibility'
);

// Result structure:
// result.score: number | null (0-10 scale)
// result.issues: string[] (list of issues found)
// result.reasoning: string (explanation of score)
// result.provider: string (which LLM provider was used)
// result.estimatedCost: object (cost breakdown)
```

## Common Patterns

### Playwright Integration

```javascript
import { validatePage } from '@arclabs561/ai-visual-test';
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('https://example.com');

// Validate page directly (handles screenshotting)
const result = await validatePage(page, 'Check for visual bugs and accessibility issues');

console.log(`Score: ${result.score}/10`);
```

### Playwright Custom Matchers

```javascript
import { expect } from '@playwright/test';
import { createMatchers } from '@arclabs561/ai-visual-test/playwright';

createMatchers(expect);

test('visual quality', async ({ page }) => {
  await page.goto('https://example.com');
  
  // Custom matcher for visual score
  await expect(page).toHaveVisualScore(7, 'Check visual quality');
  
  // Custom matcher for accessibility
  await expect(page).toBeAccessibleHybrid(4.5);
});
```

### Accessibility Testing

```javascript
// With screenshot path
const result = await validateScreenshot(
  'payment-form.png',
  'Check if this form is accessible: contrast, labels, keyboard navigation'
);

// With Playwright page
const result = await validatePage(page, 'Check accessibility: contrast, labels, keyboard navigation');

if (result.score < 6) {
  console.error('Accessibility issues:', result.issues);
}
```

### Hybrid Accessibility Validation

```javascript
import { validateAccessibilityHybrid } from '@arclabs561/ai-visual-test/validators';

// Combines programmatic checks (contrast, keyboard) with AI semantic evaluation
const result = await validateAccessibilityHybrid(page, screenshotPath, 4.5);

console.log(`Passed: ${result.passed}`);
console.log(`Programmatic issues: ${result.programmaticData.contrast.violations.length}`);
console.log(`Visual issues: ${result.issues.length}`);
```

### High-Frequency Validation (60Hz)

```javascript
import { validateScreenshot } from '@arclabs561/ai-visual-test';

// Optimizes for high frequency
const result = await validateScreenshot(
  'frame.png',
  'Is the game playable?',
  {
    frequency: 60,
    autoSelectTier: true,
    autoSelectProvider: true
  }
);
```

### Cost Optimization

```javascript
const result = await validateScreenshot(
  'screenshot.png',
  'Evaluate this page',
  {
    autoSelectTier: true,      // Auto-select tier
    autoSelectProvider: true,  // Auto-select cheapest provider
    includeCostComparison: true // Show cost savings
  }
);

console.log(`Cost: $${result.estimatedCost?.totalCost}`);
console.log(`Savings: ${result.costComparison?.savings.fast?.percent}%`);
```

## Sub-Module Imports

```javascript
// Validators
import { StateValidator, AccessibilityValidator, validateAccessibilityHybrid } from '@arclabs561/ai-visual-test/validators';

// Temporal
import { aggregateTemporalNotes } from '@arclabs561/ai-visual-test/temporal';

// Ensemble
import { EnsembleJudge } from '@arclabs561/ai-visual-test/ensemble';

// Playwright Integration
import { createMatchers } from '@arclabs561/ai-visual-test/playwright';

// Convenience Functions
import { validatePage, testGameplay, validateWithGoals } from '@arclabs561/ai-visual-test';
```

## Configuration

Set API key in `.env`:
```bash
GEMINI_API_KEY=your-key-here
# or
OPENAI_API_KEY=your-key-here
# or
ANTHROPIC_API_KEY=your-key-here
```

## TypeScript Support

TypeScript definitions available. See `index.d.ts` for API reference.

