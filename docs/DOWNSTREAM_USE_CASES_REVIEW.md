# Downstream Use Cases Review: Concrete Motivating Examples

## Executive Summary

This document reviews downstream use cases for `@arclabs561/ai-visual-test` with concrete, motivating examples drawn from the codebase, tests, and documentation. Each use case includes specific scenarios, code examples, and real-world applications.

## Primary Use Cases

### 1. Interactive Game Testing (60Hz Real-Time Validation)

**Motivation**: Originally designed for interactive web games requiring real-time validation at high frequencies (10-60Hz) with <100ms latency requirements.

**Concrete Example: 2048 Game Testing**

```javascript
// From test/game-playing.test.mjs
import { playGame, GameGym } from 'ai-visual-test';
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto('https://play2048.co/');
await page.waitForLoadState('networkidle');

// Simple gameplay testing
const result = await playGame(page, {
  goal: 'Maximize score',
  maxSteps: 5,
  fps: 1 // Slow for testing, but supports up to 60Hz
});

// Verify game was actually played
assert.ok(result.totalSteps > 0);
assert.ok(result.history.length > 0);
```

**Real-World Scenario**: Testing a web-based game where:
- Game state changes rapidly (60 FPS)
- Need to validate gameplay quality in real-time
- Variable goals based on game state (fun, accessibility, performance)
- Temporal understanding of gameplay sequences

**Key Features Used**:
- `playGame()` - Actually plays the game
- `GameGym` - External iterator for RL algorithms
- `testGameplay()` - Complete workflow for game testing
- `LatencyAwareBatchOptimizer` - Bypasses batching for <100ms requests
- `selectModelTier()` - Auto-selects fast tier for high-frequency

**Production Use Case**: A game development team needs to validate that their game remains playable and accessible as they iterate. They run automated gameplay tests that:
1. Launch the game
2. Play for N steps
3. Validate gameplay quality at each step
4. Aggregate temporal notes to understand gameplay patterns
5. Detect issues like lag spikes, bugs, or accessibility problems

### 2. Payment Screen Validation (Critical UI Testing)

**Motivation**: Payment screens require zero-tolerance validation - any issue is critical. Needs semantic understanding, not pixel-perfect matching.

**Concrete Example: Payment Form Validation**

```javascript
// From example.test.mjs
import { validateScreenshot } from 'ai-visual-test';
import { test } from '@playwright/test';

test('payment screen validation', async ({ page }) => {
  await page.goto('https://example.com');
  
  // Fill form to generate payment code
  await page.fill('#name', 'Test User');
  await page.fill('#amount', '10');
  await page.click('button[type="submit"]');
  
  // Wait for payment screen
  await page.waitForSelector('#payment:not(.hidden)');
  
  // Capture screenshot
  const screenshotPath = `test-results/payment-${Date.now()}.png`;
  await page.screenshot({ path: screenshotPath, fullPage: true });
  
  // Validate with zero-tolerance criteria
  const result = await validateScreenshot(
    screenshotPath,
    `CRITICAL VALIDATION: Payment screen must be perfect. Check:

PAYMENT CODE:
- Is the payment code clearly visible?
- Is contrast ≥21:1 (brutalist requirement)?
- Is the code format correct (Q-XXXX)?

QR CODES:
- Are both Venmo and Cash App QR codes present?
- Are QR codes scannable with ≥21:1 contrast?
- Are QR codes properly sized and positioned?

BRUTALIST DESIGN:
- Is text direct and functional (no conversational language)?
- Is design minimal and uncluttered?
- Is contrast excellent throughout?

ZERO TOLERANCE VIOLATIONS:
- Contrast <21:1 = INSTANT FAIL
- QR codes not scannable = INSTANT FAIL
- Conversational language = INSTANT FAIL`,
    {
      testType: 'payment-screen',
      viewport: { width: 1280, height: 720 }
    }
  );
  
  // Assertions
  assert(result.score >= 7, 'Payment form should score at least 7');
  
  // Check for critical issues
  const criticalIssues = result.issues.filter(issue => 
    issue.toLowerCase().includes('contrast') || 
    issue.toLowerCase().includes('scannable') ||
    issue.toLowerCase().includes('fail')
  );
  
  assert(criticalIssues.length === 0, 'No critical issues allowed');
});
```

**Real-World Scenario**: A payment processing application needs to ensure:
- Payment codes are always visible and scannable
- QR codes meet accessibility standards
- Design principles (brutalist, minimal) are maintained
- Zero tolerance for critical issues

**Key Features Used**:
- `validateScreenshot()` - Core validation with detailed prompts
- Natural language specifications for complex criteria
- Design principle validation (brutalist, minimal)
- Accessibility validation (contrast ratios, scannability)

### 3. Accessibility Testing (WCAG Compliance)

**Motivation**: Fast programmatic checks combined with VLLM semantic evaluation for comprehensive accessibility testing.

**Concrete Example: Accessibility Validation**

```javascript
// From docs/NATURAL_LANGUAGE_SPECS.md
import { validateScreenshot, validateAccessibilitySmart } from 'ai-visual-test';

// Pattern 1: Direct accessibility validation
const result = await validateScreenshot(
  screenshotPath,
  'Evaluate this page for WCAG 2.1 AA compliance. Check: contrast ratios, keyboard navigation, alt text, semantic HTML structure.',
  {
    testType: 'accessibility-critical',
    enableUncertaintyReduction: true
  }
);

// Pattern 2: Natural language spec for accessibility
const spec = `
  Given I visit a news website
  When the page loads
  Then headlines should be readable
  And images should have alt text
  And the layout should be responsive
`;

await executeSpec(page, spec, {
  url: 'https://news.example.com',
  interfaces: ['validateScreenshot', 'validateAccessibilitySmart']
});
```

**Real-World Scenario**: A news website needs to ensure:
- All images have descriptive alt text
- Text meets contrast requirements (WCAG AA: 4.5:1, AAA: 7:1)
- Keyboard navigation works correctly
- Semantic HTML structure is correct

**Key Features Used**:
- `validateAccessibilitySmart()` - Fast programmatic checks
- VLLM semantic evaluation for complex accessibility issues
- Natural language specs for non-technical stakeholders
- WCAG compliance validation

**Production Use Case**: An accessibility audit tool that:
1. Screenshots a page
2. Runs programmatic checks (fast)
3. Uses VLLM for semantic evaluation (comprehensive)
4. Generates accessibility report with specific issues
5. Provides remediation suggestions

### 4. Design Principle Validation (Brutalist, Minimal, etc.)

**Motivation**: Validate that UI adheres to specific design principles, not just functional correctness.

**Concrete Example: Brutalist Design Validation**

```javascript
// From example.test.mjs and docs
const brutalistResult = await validateScreenshot(
  screenshotPath,
  `Evaluate this design for brutalist principles:
- Text is direct and functional (no conversational language)
- Design is minimal and uncluttered
- Contrast is excellent throughout (≥21:1)
- No unnecessary decorative elements
- Layout is grid-based and structured`,
  {
    testType: 'design-principle-brutalist',
    viewport: { width: 1280, height: 720 }
  }
);
```

**Real-World Scenario**: A design system needs to ensure:
- All components follow brutalist design principles
- No conversational language in UI text
- High contrast throughout (21:1 for brutalist)
- Minimal, functional design

**Key Features Used**:
- Natural language design principle specifications
- Semantic understanding of design aesthetics
- Contrast validation
- Text tone validation (conversational vs. functional)

### 5. Temporal Testing (Animations & Gameplay Sequences)

**Motivation**: Understand UI changes over time, not just static screenshots. Critical for animations, gameplay, and dynamic content.

**Concrete Example: Temporal Gameplay Analysis**

```javascript
// From test/validation-gameplay-temporal.test.mjs
import { 
  aggregateTemporalNotes, 
  aggregateMultiScale,
  captureTemporalScreenshots 
} from 'ai-visual-test';

// Capture gameplay sequence
const screenshots = await captureTemporalScreenshots(page, {
  fps: 2, // 2 frames per second
  duration: 10000, // 10 seconds
  gameSelector: '#game-element'
});

// Generate temporal notes
const temporalNotes = [];
for (const screenshot of screenshots) {
  const result = await validateScreenshot(
    screenshot.path,
    'Evaluate gameplay state',
    { testType: 'gameplay-temporal' }
  );
  
  temporalNotes.push({
    timestamp: screenshot.timestamp,
    elapsed: screenshot.elapsed,
    score: result.score,
    observation: result.reasoning,
    step: screenshot.step
  });
}

// Aggregate temporal notes
const aggregated = aggregateTemporalNotes(temporalNotes, {
  windowSize: 5000, // 5-second windows
  decayFactor: 0.9
});

// Multi-scale aggregation
const multiScale = aggregateMultiScale(temporalNotes, {
  timeScales: {
    immediate: 100,   // 0.1s - instant reactions
    short: 1000,       // 1s - quick assessments
    medium: 10000,     // 10s - detailed evaluation
    long: 60000       // 60s - comprehensive review
  }
});

// Validate temporal coherence
assert.ok(aggregated.coherence >= 0.7, 'Smooth gameplay should have high coherence');
```

**Real-World Scenario**: A game needs to validate:
- Gameplay remains smooth over time
- No lag spikes or performance issues
- Game state changes are coherent
- Temporal patterns are consistent

**Key Features Used**:
- `captureTemporalScreenshots()` - Temporal sequence capture
- `aggregateTemporalNotes()` - Standard temporal aggregation
- `aggregateMultiScale()` - Multi-scale temporal analysis
- Temporal coherence detection

**Production Use Case**: A game QA team that:
1. Captures gameplay sequences at 2-4 FPS
2. Validates each frame for gameplay quality
3. Aggregates temporal notes to understand patterns
4. Detects issues like lag spikes, bugs, or inconsistent gameplay

### 6. Persona-Based Testing (Multi-Perspective Evaluation)

**Motivation**: Different users experience UI differently. Test from multiple persona perspectives.

**Concrete Example: Persona Experience Testing**

```javascript
// From test/persona-experience.test.mjs and examples/marimo/comprehensive_apis.py
import { experiencePageAsPersona } from 'ai-visual-test';

const result = await experiencePageAsPersona(
  page,
  {
    name: 'New Developer',
    goals: ['understand the API quickly', 'find examples'],
    concerns: ['complexity', 'learning curve'],
    focus: ['quick-start', 'examples', 'simplicity']
  },
  {
    url: 'https://example.com',
    testType: 'meta-documentation-persona',
    captureCode: true,
    captureTemporal: true,
    duration: 5000 // 5 seconds
  }
);

// Result includes:
// - Screenshots at each stage
// - Temporal notes from persona perspective
// - Experience trace
// - Aggregated evaluation
```

**Real-World Scenario**: A documentation site needs to ensure:
- New developers can understand the API quickly
- Examples are easy to find
- Learning curve is reasonable
- Different personas have different experiences

**Key Features Used**:
- `experiencePageAsPersona()` - Persona-based testing
- Temporal notes from persona perspective
- Multi-perspective evaluation
- Experience trace capture

**Production Use Case**: A product team that:
1. Defines personas (new developer, experienced user, etc.)
2. Tests UI from each persona's perspective
3. Validates that each persona can achieve their goals
4. Identifies persona-specific issues

### 7. Natural Language Specifications (BDD-Style Testing)

**Motivation**: Non-technical stakeholders can write tests in plain English. LLMs parse and execute them.

**Concrete Example: Natural Language Specs**

```javascript
// From docs/NATURAL_LANGUAGE_SPECS.md
import { executeSpec, testBehavior } from 'ai-visual-test';

// Pattern 1: Flash website games
const spec = `
  Given I open a flash game website
  When the game loads
  Then the game should be playable
  And the controls should be visible
  And the score should be displayed
`;

await executeSpec(page, spec, {
  url: 'https://flash-game-site.com',
  interfaces: ['validateScreenshot', 'testGameplay']
});

// Pattern 2: News pages
const newsSpec = `
  Given I visit a news website
  When the page loads
  Then headlines should be readable
  And images should have alt text
  And the layout should be responsive
`;

await executeSpec(page, newsSpec, {
  url: 'https://news.example.com',
  interfaces: ['validateScreenshot', 'validateAccessibilitySmart']
});

// Pattern 3: GitHub PR pages
const prSpec = `
  Given I visit a GitHub PR page
  When the page loads
  Then the PR title should be visible
  And the diff should be readable
  And the review buttons should be accessible
`;
```

**Real-World Scenario**: A product manager needs to:
- Write tests in plain English
- Validate UI without writing code
- Share tests with non-technical stakeholders
- Maintain tests as requirements change

**Key Features Used**:
- `executeSpec()` - Natural language spec execution
- `testBehavior()` - Behavior-based testing
- LLM-based spec parsing
- Auto-context extraction (URL, viewport, etc.)

**Production Use Case**: A product team that:
1. Product manager writes specs in plain English
2. LLMs parse specs and map to validation interfaces
3. Tests run automatically
4. Results are shared with stakeholders

### 8. Multi-Modal Validation (Screenshot + HTML + CSS)

**Motivation**: Combine visual understanding (screenshot) with structural understanding (HTML/CSS) for complete UI comprehension.

**Concrete Example: Multi-Modal Validation**

```javascript
// From docs/features/BROWSER_EXPERIENCE_AND_GAMEPLAY.md
import { multiModalValidation, extractRenderedCode } from 'ai-visual-test';

// 1. See the page (screenshot)
const screenshot = await page.screenshot();

// 2. Understand the structure (HTML/CSS)
const renderedCode = await extractRenderedCode(page);

// 3. Evaluate with both (multi-modal)
const result = await validateScreenshot(screenshot, prompt, {
  renderedCode, // Structural understanding
  gameState     // Internal state
});
```

**Real-World Scenario**: A complex UI needs validation that considers:
- Visual appearance (screenshot)
- Structural semantics (HTML/CSS)
- Internal state (game state, form state, etc.)

**Key Features Used**:
- `extractRenderedCode()` - HTML/CSS extraction
- `multiModalValidation()` - Combined validation
- State extraction from screenshots

**Production Use Case**: A form validation system that:
1. Screenshots the form
2. Extracts HTML/CSS structure
3. Validates both visual and structural aspects
4. Ensures form state matches visual representation

### 9. Goals-Based Validation (Variable Evaluation Criteria)

**Motivation**: Different evaluation criteria based on context (game state, user type, etc.).

**Concrete Example: Variable Goals**

```javascript
// From test/integration-goals-cohesive.test.mjs
import { validateWithGoals, createGameGoal } from 'ai-visual-test';

// String goal
const result1 = await validateWithGoals(screenshotPath, {
  goal: 'accessibility'
});

// Object goal
const result2 = await validateWithGoals(screenshotPath, {
  goal: {
    description: 'Documentation clarity',
    criteria: ['Clear examples', 'Good navigation', 'Readable code blocks']
  }
});

// Game goal
const result3 = await validateWithGoals(screenshotPath, {
  goal: createGameGoal('usability'),
  gameState: { score: 100, level: 5 }
});

// Array of goals
const result4 = await validateWithGoals(screenshotPath, {
  goal: ['accessibility', 'usability', 'visual-consistency']
});
```

**Real-World Scenario**: A game needs different validation criteria:
- Early game: Focus on fun and accessibility
- Mid game: Focus on challenge and engagement
- Late game: Focus on performance and consistency

**Key Features Used**:
- `validateWithGoals()` - Variable goal specification
- `createGameGoal()` - Game-specific goals
- Context-aware evaluation

**Production Use Case**: A game testing system that:
1. Determines game state
2. Selects appropriate goals based on state
3. Validates with variable criteria
4. Adapts evaluation as game progresses

### 10. High-Frequency Validation (60Hz Real-Time)

**Motivation**: Real-time validation for interactive games requiring <100ms latency.

**Concrete Example: 60Hz Game Validation**

```javascript
// From test/high-frequency-features.test.mjs
import { 
  LatencyAwareBatchOptimizer, 
  selectModelTier, 
  selectProvider 
} from 'ai-visual-test';

// Auto-select fast tier for 60Hz
const tier = selectModelTier({ frequency: 60 });
const provider = selectProvider({ speed: 'ultra-fast', env: process.env });

// Use latency-aware optimizer
const optimizer = new LatencyAwareBatchOptimizer({
  adaptiveBatchSize: true
});

// Capture at 60fps and validate with <100ms latency
for (let i = 0; i < 60; i++) {
  await page.screenshot({ path: `frame-${i}.png` });
  
  const result = await optimizer.addRequest(
    `frame-${i}.png`,
    'Is the game playable?',
    { frequency: 60 },
    50 // 50ms max latency for 60Hz
  );
  
  // Process result immediately
  if (result.score < 5) {
    // Game is broken, stop
    break;
  }
}
```

**Real-World Scenario**: A 60 FPS game needs:
- Real-time validation at 60Hz
- <100ms latency for reactive gameplay
- Fast model tier selection
- Bypass batching for critical requests

**Key Features Used**:
- `LatencyAwareBatchOptimizer` - Bypasses batching for <100ms requests
- `selectModelTier()` - Auto-selects fast tier
- `selectProvider()` - Auto-selects Groq for speed
- Adaptive batch sizing

**Production Use Case**: A game development team that:
1. Runs real-time validation at 60Hz
2. Validates gameplay quality in real-time
3. Detects issues immediately (<100ms)
4. Adapts validation based on game state

## Secondary Use Cases

### 11. Property-Based Testing (Invariants)

**Motivation**: Test invariants that should always hold true, regardless of input.

**Concrete Example: Property Tests**

```javascript
// From docs/NATURAL_LANGUAGE_SPECS.md
import { generatePropertyTests } from 'ai-visual-test';

const properties = [
  'Score should always be non-negative',
  'State should always match visual representation',
  'Cleared elements should have visible indicators',
  'Active elements should have hidden indicators',
  'Visual state should match logical state'
];

const propertyTests = await generatePropertyTests(properties, {
  generator: 'fast-check',
  numRuns: 100
});

await propertyTests.run();
```

**Real-World Scenario**: A game needs to ensure:
- Score is always non-negative
- Visual state matches logical state
- UI invariants are maintained

### 12. Ensemble Validation (Multiple Judges)

**Motivation**: Use multiple VLLM judges for more reliable validation.

**Concrete Example: Ensemble Judging**

```javascript
// From test/ensemble-judge.test.mjs
import { EnsembleJudge } from 'ai-visual-test/ensemble';

const judge = new EnsembleJudge({
  judges: ['gemini', 'openai', 'claude'],
  weighting: 'optimal' // Optimal weighting based on judge performance
});

const result = await judge.validate(screenshotPath, prompt);

// Result includes:
// - Aggregated score
// - Individual judge scores
// - Confidence based on agreement
// - Weighted evaluation
```

**Real-World Scenario**: Critical validation needs:
- Multiple perspectives
- Higher confidence through agreement
- Optimal weighting based on judge performance

## Use Case Patterns

### Pattern 1: Simple Screenshot Validation

**When to use**: Single screenshot, simple validation

```javascript
const result = await validateScreenshot(
  'screenshot.png',
  'Check if this payment form is accessible and usable'
);
```

### Pattern 2: Gameplay Testing

**When to use**: Testing games with variable goals

```javascript
const result = await testGameplay(page, {
  url: 'https://game.example.com',
  goals: ['fun', 'accessibility', 'visual-consistency'],
  captureTemporal: true,
  fps: 2,
  duration: 10000
});
```

### Pattern 3: Persona Experience

**When to use**: Testing from user perspective

```javascript
const result = await experiencePageAsPersona(page, persona, {
  url: 'https://example.com',
  captureTemporal: true,
  duration: 5000
});
```

### Pattern 4: Natural Language Specs

**When to use**: Non-technical stakeholders writing tests

```javascript
const spec = `
  Given I visit game.example.com
  When I activate the game
  Then the game should be playable
`;

await executeSpec(page, spec);
```

### Pattern 5: High-Frequency Validation

**When to use**: Real-time validation at 60Hz

```javascript
const optimizer = new LatencyAwareBatchOptimizer();
const result = await optimizer.addRequest(
  screenshotPath,
  prompt,
  {},
  50 // 50ms max latency
);
```

## What This Module Is NOT Good For

1. **Pixel-perfect layout testing** - Use pixel-diffing tools (Percy, Chromatic)
2. **Exact color matching** - Use design tools
3. **Performance testing** - Use Lighthouse
4. **Unit testing** - Use Jest/Vitest
5. **Very fast feedback loops (<1s)** - AI calls take 1-3 seconds
6. **Offline testing** - Requires API access

## Summary

This module excels at:
- **Semantic validation** - Understanding UI meaning, not pixels
- **High-frequency validation** - 60Hz real-time validation
- **Accessibility testing** - WCAG compliance validation
- **Design principle validation** - Brutalist, minimal, etc.
- **Temporal testing** - Animations and gameplay sequences
- **Persona-based testing** - Multi-perspective evaluation
- **Natural language specs** - Plain English test writing
- **Multi-modal validation** - Screenshot + HTML + CSS
- **Goals-based validation** - Variable evaluation criteria

The primary motivation is **interactive game testing** requiring real-time validation at 60Hz, but the module has broad applicability to any visual testing scenario where semantic understanding is more valuable than pixel-perfect matching.

