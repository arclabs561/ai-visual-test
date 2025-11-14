# ai-visual-test

Validate screenshots with AI instead of pixel-diffing. Understands what your UI actually means, not just whether pixels changed.

[![GitHub](https://img.shields.io/github/license/arclabs561/ai-visual-test)](https://github.com/arclabs561/ai-visual-test)
[![Node.js](https://img.shields.io/node/v/ai-visual-test)](https://nodejs.org/)

## Why this exists

Pixel-based visual testing breaks when content changes, timezones shift, or layouts adjust slightly. This tool uses vision language models to understand what your screenshots actually mean.

Instead of asking "did pixels change?", it asks "does this payment screen look correct?" The AI understands context, accessibility, and design principles.

## Quick example

```javascript
import { validateScreenshot } from 'ai-visual-test';

const result = await validateScreenshot(
  'payment-screen.png',
  'Check if this payment form is accessible and usable'
);

console.log(result.score); // 0-10
console.log(result.issues); // ['Missing error messages', 'Low contrast on submit button']
```

## Installation

```bash
npm install ai-visual-test
```

Set `GEMINI_API_KEY` or `OPENAI_API_KEY` in your environment. Works with Gemini (cheapest), OpenAI, or Claude. Auto-picks the cheapest available provider.

## What it's good for

- **Semantic validation** - Understands UI meaning, not just pixels (VLLM-based)
- **Dynamic content** - Handles feeds, timestamps, user data gracefully
- **Accessibility checks** - Fast programmatic checks (<100ms) or VLLM semantic evaluation
- **Design principles** - Validates brutalist, minimal, or other design styles (VLLM)
- **Temporal testing** - Analyzes animations and gameplay over time
- **State validation** - Fast programmatic validation or VLLM extraction from screenshots
- **Rubric-based evaluation** - Uses explicit rubrics for consistent, reliable scoring
- **Smart validation** - Automatically chooses the right validator (programmatic vs VLLM vs hybrid)
- **Game testing** - Validate gameplay screenshots with variable goals (inspired by [queeraoke](https://queeraoke.fyi))
- **Game playing** (optional) - Actually play games using validation + decision-making + action execution
- **Natural language specs** - Write tests in plain English, LLM-parses and executes them (not formal specs)

## What it's not good for

- **Pixel-perfect brand consistency** - Use Percy/Chromatic for that
- **Very fast feedback loops** - AI calls take 1-3 seconds
- **Offline testing** - Requires API access

## Basic usage

```javascript
import { validateScreenshot } from 'ai-visual-test';

const result = await validateScreenshot(
  'screenshot.png',
  'Evaluate this payment screen for usability and accessibility',
  {
    testType: 'payment-screen',
    viewport: { width: 1280, height: 720 }
  }
);

if (result.score < 7) {
  console.warn('Issues found:', result.issues);
}
```

## With Playwright

```javascript
import { test } from '@playwright/test';
import { validateScreenshot } from 'ai-visual-test';

test('payment screen is accessible', async ({ page }) => {
  await page.goto('/checkout');
  await page.screenshot({ path: 'checkout.png' });
  
  const result = await validateScreenshot(
    'checkout.png',
    'Check accessibility: keyboard navigation, contrast, labels'
  );
  
  expect(result.score).toBeGreaterThan(7);
});
```

## Natural Language Specifications

Write tests in plain English (not formal specs like TLA+ or Alloy). Auto-extracts context from spec text:

```javascript
import { executeSpec, testGameplay, validateScreenshot } from 'ai-visual-test';

// Pattern 1: Direct natural language prompt (most common)
const result = await validateScreenshot(
  screenshotPath,
  `CRITICAL VALIDATION: Payment screen must be perfect. Check:
  - Payment code is clearly visible
  - QR codes are properly rendered and scannable
  - Payment links are accessible`,
  {
    testType: 'payment-critical',
    viewport: { width: 1280, height: 720 }
  }
);

// Pattern 2: testGameplay with goals (game testing)
const gameplayResult = await testGameplay(page, {
  url: 'https://game.example.com',
  goals: ['fun', 'accessibility', 'visual-consistency'],
  gameActivationKey: 'g',
  gameSelector: '#game-element',
  captureTemporal: true,
  fps: 2,
  duration: 10000,
  captureCode: true, // Multi-modal: screenshot + code + state
  checkConsistency: true
});

// Pattern 3: Natural language spec with auto-extracted context
const spec = `
  Given I visit game.example.com
  When I activate the game (press 'g')
  Then the game should be playable
  And the score should update
  Context: viewport=1280x720, fps: 2, duration: 10 seconds
`;

// Context auto-extracted - no need to pass URL, viewport, FPS, duration
const specResult = await executeSpec(page, spec, {
  gameSelector: '#game-element' // Only pass what's not in spec
});
```

**Use Cases:**
- Interactive web games (easter eggs, flash games, canvas games)
- News pages and articles
- GitHub PR pages and code reviews
- E-commerce checkout flows
- Form validation and accessibility
- Websites in development
- Any web experience requiring validation

**See:** `docs/NATURAL_LANGUAGE_SPECS_QUEERAOKE_EXAMPLES.md` for real-world examples and patterns.
- Any web experience

**Property-Based Testing:**
```javascript
import { generatePropertyTests } from 'ai-visual-test';

const properties = [
  'Screenshots should always have a score between 0 and 10',
  'Game state should always match visual representation'
];

const tests = await generatePropertyTests(properties);
await tests.run();
```

## Game Use Cases

This package was originally motivated by [queeraoke](https://queeraoke.fyi), an interactive karaoke game that requires:
- Real-time gameplay validation (60Hz frame-by-frame)
- Variable goals (fun, accessibility, visual clarity)
- Temporal sequences (understanding gameplay over time)
- State validation (score, level, position)

### Game Testing

```javascript
import { testGameplay } from 'ai-visual-test';

// Test if game is fun and accessible
const result = await testGameplay(page, {
  url: 'https://game.example.com',
  goals: ['fun', 'accessibility', 'performance'],
  gameActivationKey: 'g', // For games that activate from keyboard
  gameSelector: '#game-paddle' // Wait for game element
});
```

### Game Playing (Optional)

```javascript
import { playGame, GameGym } from 'ai-visual-test';

// Simple API - internal loop (for most users)
const result = await playGame(page, {
  goal: 'Maximize score',
  maxSteps: 50,
  fps: 2 // 2 decisions per second (not 60 FPS - AI needs time to think)
});

// Advanced API - external iterator (for power users, RL integration)
const gym = new GameGym(page, {
  goal: 'Maximize score',
  maxSteps: 100
});

let obs = await gym.reset();
while (!gym.done) {
  const action = await decideAction(obs); // Your decision logic
  const result = await gym.step(action);
  obs = result.observation;
}
```

## Validators

Generic validators for common testing patterns:

### State Validator (VLLM-based)

**⚠️ Note:** `StateValidator` uses VLLM to extract state from screenshots. If you have page access, use `validateStateProgrammatic` instead (faster, free, deterministic).

Validate that visual state matches expected state using VLLM (when you only have screenshots):

```javascript
import { StateValidator } from 'ai-visual-test';

// VLLM-based: Extracts state from screenshot using AI
const validator = new StateValidator({ tolerance: 5 });
const result = await validator.validateState(
  'screenshot.png',  // Screenshot path (required)
  { ball: { x: 100, y: 200 }, paddle: { x: 150 } }
);

if (!result.matches) {
  console.log('State mismatches:', result.validation.discrepancies);
}
```

**When to use:**
- ✅ Only have screenshots (no page access)
- ✅ Need semantic state extraction from images
- ❌ Don't use if you have page access (use `validateStateProgrammatic` instead)

### Accessibility Validator

Configurable accessibility validation with WCAG standards:

```javascript
import { AccessibilityValidator } from 'ai-visual-test';

const a11y = new AccessibilityValidator({
  minContrast: 4.5, // WCAG-AA
  standards: ['WCAG-AA'],
  zeroTolerance: false
});

const result = await a11y.validateAccessibility('screenshot.png');
if (!result.passes) {
  console.log('Violations:', result.violations);
}
```

### Prompt Builder

Template-based prompt construction with rubric integration:

```javascript
import { PromptBuilder } from 'ai-visual-test';

const builder = new PromptBuilder({
  templates: {
    accessibility: (vars) => `Check ${vars.element} for ${vars.standard} compliance`
  }
});

const prompt = builder.buildFromTemplate('accessibility', {
  element: 'buttons',
  standard: 'WCAG-AA'
});
```

### Rubric Validation

Validate with explicit rubrics for consistent scoring:

```javascript
import { validateWithRubric } from 'ai-visual-test';

const rubric = {
  score: {
    criteria: {
      10: 'Perfect',
      8: 'Good',
      5: 'Acceptable'
    }
  },
  criteria: [
    { id: 'ZT-1', rule: 'Contrast <4.5:1 = FAIL', zeroTolerance: true }
  ]
};

const result = await validateWithRubric('screenshot.png', 'Check accessibility', rubric);
```

### Batch Validator

Batch validation with cost tracking and statistics:

```javascript
import { BatchValidator } from 'ai-visual-test';

const validator = new BatchValidator({
  trackCosts: true,
  trackStats: true
});

const { results, stats } = await validator.batchValidate(
  ['screenshot1.png', 'screenshot2.png'],
  'Evaluate UI quality'
);

console.log('Cost:', stats.costStats);
console.log('Performance:', stats.performance);
```

## Smart Validators (Recommended)

**NEW:** Smart validators automatically select the best validator type based on available context. Use these to avoid common mistakes.

```javascript
import { validateSmart, validateAccessibilitySmart, validateStateSmart } from 'ai-visual-test';

// Automatically uses programmatic if page available, VLLM if only screenshot
const result = await validateAccessibilitySmart({
  page: page,              // If available, uses programmatic (fast, free)
  screenshotPath: 'screenshot.png',  // If only this, uses VLLM (semantic)
  minContrast: 21.0,
  needSemantic: false      // Set true to use hybrid (best of both)
});

// Smart state validation
const stateResult = await validateStateSmart({
  page: page,              // If available, uses programmatic
  screenshotPath: 'screenshot.png',  // If only this, uses VLLM
  expectedState: { ball: { x: 100, y: 200 } },
  selectors: { ball: '#game-ball' },
  needSemantic: false      // Set true to use hybrid
});

// Universal smart validator
const result = await validateSmart({
  type: 'accessibility',   // or 'state', 'element', 'visual'
  page: page,
  screenshotPath: 'screenshot.png',
  // ... other options based on type
});
```

**Why use smart validators?**
- ✅ Automatically chooses the right tool (programmatic vs VLLM vs hybrid)
- ✅ Prevents common mistakes (using VLLM for measurable things)
- ✅ Guides users to faster, more reliable validators when available
- ✅ Still allows manual override when needed

## Programmatic Validators

Fast, deterministic validators for when you have Playwright page access. Use these for fast feedback (<100ms) instead of VLLM when possible.

### Accessibility (Programmatic)

Fast contrast and keyboard navigation checks:

```javascript
import { checkElementContrast, checkAllTextContrast, checkKeyboardNavigation } from 'ai-visual-test';

// Check single element contrast
const result = await checkElementContrast(page, '#my-button', 4.5);
if (!result.passes) {
  console.log(`Contrast ratio: ${result.ratio}:1 (required: 4.5:1)`);
}

// Check all text elements
const allText = await checkAllTextContrast(page, 21.0); // Brutalist 21:1 requirement
console.log(`${allText.failing} elements fail contrast`);

// Check keyboard navigation
const keyboard = await checkKeyboardNavigation(page);
console.log(`${keyboard.focusableElements} focusable elements`);
```

### State Validation (Programmatic)

**✅ Recommended:** Use this when you have page access (fast, free, deterministic).

Fast state validation using direct state access:

```javascript
import { validateStateProgrammatic, validateElementPosition } from 'ai-visual-test';

// Validate game state matches visual representation (programmatic - no VLLM)
const result = await validateStateProgrammatic(page, {
  ball: { x: 100, y: 200 },
  paddle: { x: 150 }
}, {
  selectors: {
    ball: '#game-ball',
    paddle: '#game-paddle'
  },
  tolerance: 5
});

if (!result.matches) {
  console.log('Discrepancies:', result.discrepancies);
}
```

**Key Difference:**
- `validateStateProgrammatic` = Programmatic (uses page access, fast, free)
- `StateValidator` = VLLM-based (uses screenshots, slower, costs API calls)
- **Use programmatic when you have page access!**

// Validate element position
const position = await validateElementPosition(
  page,
  '#my-element',
  { x: 100, y: 200 },
  5 // tolerance
);
```

**When to use programmatic vs VLLM validators:**

- **Programmatic**: Fast (<100ms), deterministic, works offline, use when you have page access
- **VLLM-based**: Semantic understanding, works with screenshots only, use for design principles, context-aware checks
- **Hybrid**: Best of both - programmatic data provides ground truth, VLLM evaluates semantically

### Hybrid Validators

Combine programmatic validation with VLLM evaluation for the best results:

```javascript
import { validateAccessibilityHybrid, validateStateHybrid } from 'ai-visual-test';

// Hybrid accessibility: programmatic contrast + VLLM semantic evaluation
const a11yResult = await validateAccessibilityHybrid(
  page,
  'screenshot.png',
  21.0, // minContrast
  { testType: 'accessibility' }
);
// Result includes both programmatic data and VLLM evaluation

// Hybrid state: programmatic state + VLLM visual consistency
const stateResult = await validateStateHybrid(
  page,
  'screenshot.png',
  { ball: { x: 100, y: 200 } },
  {
    selectors: { ball: '#game-ball' },
    tolerance: 5
  }
);
// Result includes both programmatic state and VLLM evaluation
```

**Why hybrid?**
- Programmatic data provides **ground truth** (avoids hallucinations)
- VLLM provides **semantic reasoning** (context, criticality, usability)
- Combined: More reliable than pure VLLM, more nuanced than pure programmatic
```

## Persona-based testing

Test from different user perspectives:

```javascript
import { experiencePageAsPersona } from 'ai-visual-test';

const experience = await experiencePageAsPersona(page, {
  name: 'Accessibility Advocate',
  goals: ['Check keyboard navigation', 'Verify screen reader compatibility'],
  device: 'desktop'
});

console.log(`Experience score: ${experience.score}`);
```

## Cost management

- Results cached by default (7 day TTL)
- Each result includes cost estimate
- Auto-selects cheapest provider (Gemini → OpenAI → Claude)
- Run `npm publish --dry-run` to see what gets published

## API

### `validateScreenshot(imagePath, prompt, context)`

Validates a screenshot using vision language models.

**Parameters:**
- `imagePath` (string): Path to screenshot file
- `prompt` (string): What to evaluate (e.g., "Check accessibility")
- `context` (object, optional):
  - `testType` (string): Type of test
  - `viewport` (object): Viewport size
  - `useCache` (boolean): Enable caching (default: true)

**Returns:**
- `score` (number|null): 0-10 score
- `issues` (array): List of issues found
- `reasoning` (string): Why this score
- `provider` (string): Which AI provider was used
- `estimatedCost` (object): Cost estimate

See [docs/api/API_ESSENTIALS.md](docs/api/API_ESSENTIALS.md) for API essentials and [docs/api/API_REVIEW_AND_ALIGNMENT.md](docs/api/API_REVIEW_AND_ALIGNMENT.md) for detailed API reference.

## Configuration

Set environment variables:

```bash
# At least one API key required
GEMINI_API_KEY=your-key-here
# OR
OPENAI_API_KEY=your-key-here
# OR
ANTHROPIC_API_KEY=your-key-here

# Optional: force provider
VLM_PROVIDER=gemini  # or 'openai', 'claude'
```

## Examples

- [Basic validation](example.test.mjs)
- [Playwright integration](test/integration-v0.3-features.test.mjs)
- [Persona testing](test/persona-experience.test.mjs)
- [Temporal analysis](test/temporal-evaluation.test.mjs)

## Documentation

Comprehensive documentation is available in the [`docs/`](./docs/) directory:

- **[Documentation Index](./docs/README.md)** - Complete guide to all documentation with summaries and connections
- **[API Essentials](./docs/api/API_ESSENTIALS.md)** - Quick start and API essentials
- **[Research Integration](./docs/research/RESEARCH_INTEGRATION.md)** - Research papers and implementation status
- **[Standalone Usage](./docs/STANDALONE_USAGE.md)** - How to use the library
- **[Human Validation](./docs/HUMAN_VALIDATION_INTEGRATION.md)** - Human feedback and calibration system

See [docs/README.md](./docs/README.md) for the complete documentation index.

## Research

This package implements research-backed practices:

- **Explicit rubrics** - Research suggests explicit rubrics improve reliability (implementation integrated, validation pending)
- **Bias detection** - Detects position bias, verbosity bias
- **Ensemble judging** - Multiple providers for consensus
- **Temporal aggregation** - Coherence checking over time

Note: Some research citations are conceptual inspirations rather than exact implementations. See [docs/research/RESEARCH_INTEGRATION.md](docs/research/RESEARCH_INTEGRATION.md) for detailed implementation status and [docs/research/RESEARCH_UPDATE_2025.md](docs/research/RESEARCH_UPDATE_2025.md) for research papers and citations.

## Comparison

**vs Pixel-based tools (Percy, Chromatic):**
- ✅ Understands meaning, not just pixels
- ✅ Handles dynamic content gracefully
- ❌ Not pixel-perfect (use Percy for that)

**vs Traditional testing:**
- ✅ Validates accessibility automatically
- ✅ Understands design principles
- ✅ Provides human-readable feedback

See [docs/RESEARCH_INTEGRATION.md](docs/RESEARCH_INTEGRATION.md) for research comparison and integration details.

## Dependencies

- `@playwright/test` (optional) - For Playwright integration
- `@arclabs561/llm-utils` (optional) - For advanced data extraction

Pure ES Modules, no build step required.

## License

MIT

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.
