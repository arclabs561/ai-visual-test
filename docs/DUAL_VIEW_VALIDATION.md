# Dual-View Validation: Source Code + Rendered Visuals

## Overview

This package supports **dual-view validation** by capturing both:
1. **Source Code** (text-encoded HTML/CSS) - the "source of truth"
2. **Rendered Visuals** (screenshots) - the "rendered output"

This enables validation against both what the code says and what the user actually sees.

## Why Dual-View?

### Problem: Code vs. Visual Mismatch

Traditional validation often only checks one view:
- **Code-only**: Can't see rendering issues, CSS bugs, layout problems
- **Visual-only**: Can't verify structural correctness, accessibility attributes, code quality

### Solution: Dual-View Validation

By capturing both, we can:
- **Detect CSS rendering issues**: Code says one thing, visual shows another
- **Validate structural correctness**: DOM matches expectations
- **Check computed styles vs. source styles**: What's in CSS vs. what actually applies
- **Identify layout bugs**: Positioning, z-index, visibility mismatches
- **Verify accessibility**: Attributes in code vs. visual rendering
- **Cross-modal consistency**: Ensure visual state matches code state

## How It Works

### 1. Source Code Extraction

```javascript
import { extractRenderedCode } from 'ai-visual-test';

const renderedCode = await extractRenderedCode(page, {
  selectors: ['#app', 'main', 'header', 'footer'], // Optional: custom selectors
  htmlLimit: 10000, // Max HTML chars (default: 10k)
  includeAllCSS: false // Include all computed styles (default: only critical)
});

// Returns:
// {
//   html: '<html>...</html>', // Source HTML (text-encoded)
//   stylesheets: [...], // Source CSS from stylesheets
//   criticalCSS: {...}, // Rendered CSS (computed styles)
//   domStructure: {...}, // DOM structure (text-encoded)
//   timestamp: 1234567890,
//   url: 'https://example.com',
//   viewport: { width: 1280, height: 720 }
// }
```

### 2. Visual Capture

```javascript
import { validateScreenshot } from 'ai-visual-test';

const screenshotPath = 'screenshot.png';
await page.screenshot({ path: screenshotPath });
```

### 3. Dual-View Validation

```javascript
import { validateScreenshot, extractRenderedCode } from 'ai-visual-test';

// Capture both views
const renderedCode = await extractRenderedCode(page);
await page.screenshot({ path: screenshotPath });

// Validate with dual-view context
const result = await validateScreenshot(
  screenshotPath,
  `Validate this page. Check:
  - Visual appearance matches code structure
  - CSS rendering is correct (computed styles match source)
  - Layout is consistent (DOM structure matches visual layout)
  - Accessibility attributes are present in code and visible`,
  {
    context: {
      renderedCode: renderedCode, // Pass source code for dual-view validation
      testType: 'dual-view-validation'
    }
  }
);
```

## Use Cases

### 1. CSS Rendering Issues

**Problem**: CSS says `position: fixed`, but element isn't fixed in visual.

**Dual-View Detection**:
```javascript
const renderedCode = await extractRenderedCode(page);
const screenshot = await page.screenshot();

// VLLM can compare:
// - Source CSS: `position: fixed`
// - Computed CSS: `position: fixed`
// - Visual: Element is not fixed (scrolling with page)
// → Detects mismatch
```

### 2. Layout Bugs

**Problem**: Elements overlap visually, but code structure looks correct.

**Dual-View Detection**:
```javascript
// VLLM analyzes:
// - DOM structure: Elements are siblings (shouldn't overlap)
// - Computed CSS: `z-index: 1` and `z-index: 2`
// - Visual: Elements overlap incorrectly
// → Detects z-index or positioning issue
```

### 3. Accessibility Validation

**Problem**: Accessibility attributes in code, but not visually apparent.

**Dual-View Detection**:
```javascript
// VLLM analyzes:
// - Source HTML: `<button aria-label="Close">X</button>`
// - Visual: Button shows "X" but no visible label
// - Computed CSS: `aria-label` is present in DOM
// → Validates accessibility attributes are present
```

### 4. State Consistency

**Problem**: Game state says "score: 10", but visual shows "score: 5".

**Dual-View Detection**:
```javascript
const gameState = await page.evaluate(() => window.gameState);
const renderedCode = await extractRenderedCode(page);
const screenshot = await page.screenshot();

// VLLM analyzes:
// - Game state: `{ score: 10 }`
// - DOM structure: `<div id="score">5</div>`
// - Visual: Shows "5"
// → Detects state mismatch
```

## Integration with Natural Language Specs

Dual-view validation is automatically enabled when using `captureCode: true`:

```javascript
import { executeSpec } from 'ai-visual-test';

const spec = `
  Given I visit example.com
  When the page loads
  Then the layout should match the code structure
  And CSS should render correctly
  And visual state should match DOM state
`;

await executeSpec(page, spec, {
  captureCode: true // Enables dual-view validation
});
```

## Benefits

1. **Comprehensive Validation**: Checks both code and visual, not just one
2. **Early Bug Detection**: Catches CSS rendering issues, layout bugs, state mismatches
3. **Accessibility**: Validates accessibility attributes in code vs. visual rendering
4. **Consistency**: Ensures visual state matches code state
5. **Debugging**: Provides both views for debugging (code + visual)

## Limitations

1. **Performance**: Extracting full HTML/CSS adds latency
2. **Size**: Large HTML/CSS can exceed token limits
3. **Complexity**: Dual-view validation is more complex than single-view
4. **LLM Dependency**: Requires VLLM to understand both code and visual

## Best Practices

1. **Selective Extraction**: Use `selectors` option to extract only relevant elements
2. **HTML Limits**: Use `htmlLimit` to cap HTML size (default: 10k chars)
3. **Critical CSS Only**: Use `includeAllCSS: false` for faster extraction
4. **Context-Aware**: Pass `renderedCode` in validation context for dual-view analysis
5. **State Validation**: Include `gameState` or `state` for state consistency checks

## Example: Complete Dual-View Validation

```javascript
import { validateScreenshot, extractRenderedCode } from 'ai-visual-test';
import { test } from '@playwright/test';

test('dual-view validation example', async ({ page }) => {
  await page.goto('https://example.com');
  
  // Capture both views
  const renderedCode = await extractRenderedCode(page, {
    selectors: ['#app', 'main', 'header', 'footer'],
    htmlLimit: 10000
  });
  
  const screenshotPath = 'screenshot.png';
  await page.screenshot({ path: screenshotPath });
  
  // Extract state (if applicable)
  const state = await page.evaluate(() => ({
    url: window.location.href,
    title: document.title,
    gameState: window.gameState || null
  }));
  
  // Dual-view validation
  const result = await validateScreenshot(
    screenshotPath,
    `Validate this page using dual-view analysis:
    
    SOURCE CODE (HTML/CSS):
    - HTML structure: ${renderedCode.domStructure.body.tagName}
    - CSS stylesheets: ${renderedCode.stylesheets.length} stylesheets
    - Computed styles: Check criticalCSS for rendered styles
    
    RENDERED VISUAL:
    - Screenshot shows the actual rendered output
    
    VALIDATION TASKS:
    1. Compare visual layout with DOM structure
    2. Verify CSS rendering (computed styles match source)
    3. Check accessibility attributes in code vs. visual
    4. Validate state consistency (if gameState provided)
    
    Report any mismatches between code and visual.`,
    {
      context: {
        renderedCode: renderedCode,
        state: state,
        testType: 'dual-view-validation'
      }
    }
  );
  
  expect(result.score).toBeGreaterThan(8);
  expect(result.issues).toHaveLength(0);
});
```

## Conclusion

Dual-view validation provides comprehensive validation by checking both source code and rendered visuals. This enables detection of CSS rendering issues, layout bugs, accessibility problems, and state inconsistencies that single-view validation would miss.


