# Natural Language Specifications for Visual Testing

## Overview

This package supports **natural language specifications** (plain English) that describe what should be tested, rather than formal specification languages. These specs are parsed by LLMs and executed against our validation interfaces.

**Key Principle**: Write tests in plain English, let LLMs parse and execute them.

## Design Philosophy

### Not Formal Specs

We're **not** using formal specification languages like:
- TLA+ (Temporal Logic of Actions)
- Alloy
- Z notation
- B method
- Formal verification languages

### Natural Language (LLM-Parseable)

Instead, we use **natural language** that LLMs can understand:
- Plain English descriptions
- Given/When/Then patterns (BDD-style, but LLM-parsed)
- Property descriptions (what should always be true)
- Behavior descriptions (what should happen)

**Why?**
- More accessible to non-technical stakeholders
- Easier to write and maintain
- LLMs excel at parsing natural language
- Can leverage existing validation infrastructure

## Use Cases

### 1. Flash Website Games

```javascript
// Natural language spec
const spec = `
  Given I open a flash game website
  When the game loads
  Then the game should be playable
  And the controls should be visible
  And the score should be displayed
`;

// Execute against our interfaces
await executeSpec(page, spec, {
  url: 'https://flash-game-site.com',
  interfaces: ['validateScreenshot', 'testGameplay']
});
```

### 2. News Pages

```javascript
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

### 3. GitHub PR Pages

```javascript
const spec = `
  Given I open a GitHub pull request
  When the PR page loads
  Then the diff should be visible
  And comments should be readable
  And the merge button should be accessible
`;

await executeSpec(page, spec, {
  url: 'https://github.com/owner/repo/pull/123',
  interfaces: ['validateScreenshot', 'testBrowserExperience']
});
```

### 4. Interactive Web Games (Easter Eggs, Flash Games, etc.)

**Example: Game with keyboard activation**

```javascript
// Pattern 1: Direct natural language prompt (most common pattern)
const result = await validateScreenshot(
  screenshotPath,
  `CRITICAL VALIDATION: Payment screen must be perfect. Check:
  - Payment code is clearly visible
  - QR codes are properly rendered and scannable
  - Payment links are accessible
  - Layout is clean and organized`,
  {
    testType: 'payment-critical',
    viewport: { width: 1280, height: 720 }
  }
);

// Pattern 2: testGameplay with goals (game testing pattern)
const gameplayResult = await testGameplay(page, {
  url: 'https://game.example.com',
  goals: ['fun', 'accessibility', 'visual-consistency'],
  gameActivationKey: 'g', // Or Konami code, or other activation
  gameSelector: '#game-element',
  captureTemporal: true,
  fps: 2,
  duration: 10000,
  captureCode: true, // Multi-modal: screenshot + code + state
  checkConsistency: true // Cross-modal consistency
});

// Pattern 3: Natural language spec with auto-extracted context
const spec = `
  Given I visit game.example.com
  When I activate the game (press 'g')
  Then the game should be playable
  And the score should update
  And the game should be accessible
  Context: viewport=1280x720, fps: 2, duration: 10 seconds
`;

// Context auto-extracted from spec - no need to pass URL, viewport, etc.
await executeSpec(page, spec, {
  gameSelector: '#game-element' // Only pass what's not in spec
});
```

### 5. Websites in Development

```javascript
const spec = `
  Given I visit a website in development
  When the page loads
  Then it should not have broken images
  And links should work
  And the layout should not be completely broken
  And accessibility should be reasonable
`;

await executeSpec(page, spec, {
  url: 'http://localhost:3000',
  interfaces: ['validateScreenshot', 'validateAccessibilitySmart']
});
```

## Property-Based Testing with Natural Language

### Property Descriptions

Properties are described in natural language as invariants that should always hold:

```javascript
const properties = [
  'Screenshots should always have a score between 0 and 10',
  'Validation results should always include an issues array',
  'Cache keys should be unique for different inputs',
  'Game state should always be consistent with visual representation'
];

// Generate property tests
await generatePropertyTests(properties, {
  generator: 'fast-check', // or custom generator
  numRuns: 100
});
```

### Behavior Descriptions

Behaviors are described as sequences of actions and expected outcomes:

```javascript
const behavior = `
  Given a payment form
  When I fill in valid credit card information
  Then the form should accept the input
  And the submit button should be enabled
  And no errors should be displayed
`;

await testBehavior(page, behavior, {
  interfaces: ['validateScreenshot', 'validateStateSmart']
});
```

## Integration with Existing Interfaces

### Mapping Natural Language to Interfaces

The system maps natural language specs to our existing interfaces, based on queeraoke's real-world patterns:

```javascript
// Natural language spec
const spec = 'The payment form should be accessible';

// Maps to:
await validateAccessibilitySmart({
  page: page,
  screenshotPath: screenshot,
  minContrast: 4.5
});

// Natural language spec (game testing pattern)
const spec = `
  Given I visit game.example.com
  When I activate the game
  Then the game should be fun to play
  And the game should be accessible
`;

// Maps to:
await testGameplay(page, {
  url: 'https://game.example.com',
  goals: ['fun', 'accessibility'],
  gameActivationKey: 'g', // Auto-extracted if in spec
  gameSelector: '#game-element', // Auto-extracted if in spec
  captureTemporal: true,
  fps: 2,
  duration: 10000,
  captureCode: true, // Multi-modal validation
  checkConsistency: true
});

// Direct natural language prompt (most common pattern)
const prompt = `CRITICAL VALIDATION: Payment screen must be perfect. Check:
- Payment code is clearly visible
- QR codes are properly rendered and scannable
- Payment links are accessible`;

// Maps to:
await validateScreenshot(screenshotPath, prompt, {
  testType: 'payment-critical',
  viewport: { width: 1280, height: 720 }
});
```

### Interface Selection

The system automatically selects the best interface based on:
1. **Keywords in spec** - "accessible" → `validateAccessibilitySmart`
2. **Context** - Has `page` object? → Use programmatic validators
3. **Goals** - "fun", "game" → Use `testGameplay`
4. **State** - "state", "position" → Use `validateStateSmart`

## Research Context

### Temporal Decision-Making

**Reference**: arXiv:2406.12125 - "Efficient Sequential Decision Making"
- **What we use**: Temporal dependency concepts, sequential decision context
- **What we don't implement**: The paper's core online model selection algorithm
- **Our approach**: Natural language specs can describe temporal sequences

```javascript
const temporalSpec = `
  Given I play a game for 10 seconds
  When I capture screenshots at 2 FPS
  Then the score should increase over time
  And the game state should be consistent
`;
```

### Human Perception Time

**Reference**: NN/g, PMC - Human Time Perception
- **What we use**: 0.1s threshold for direct manipulation, attention affects perception
- **Our approach**: Natural language specs can describe human-perceived time scales

```javascript
const perceptionSpec = `
  Given a user interacts with a button
  When the button is clicked
  Then feedback should appear within 0.1 seconds
  And the user should perceive the interaction as immediate
`;
```

### Property-Based Testing

**Reference**: fast-check, Hypothesis, QuickCheck patterns
- **What we use**: Property descriptions as invariants
- **Our approach**: Natural language properties → executable tests

```javascript
const propertySpec = `
  For all screenshots, the validation score should be between 0 and 10
  For all game states, the visual representation should match the internal state
  For all cached results, the cache key should be unique
`;
```

## Implementation Strategy

### Phase 1: Simple Parsing

Parse natural language specs into structured test descriptions:

```javascript
function parseSpec(spec) {
  // Use LLM to parse natural language
  // Extract: Given/When/Then, properties, behaviors
  // Map to: interface calls, parameters
}
```

### Phase 2: Interface Mapping

Map parsed specs to existing interfaces:

```javascript
function mapToInterface(parsedSpec) {
  // Select best interface based on spec content
  // Generate interface calls with parameters
  // Return executable test code
}
```

### Phase 3: Property Generation

Generate property-based tests from natural language properties:

```javascript
function generatePropertyTests(properties) {
  // Parse property descriptions
  // Generate input generators
  // Create property check functions
  // Return executable property tests
}
```

## Auto-Context Extraction (LLM-Based)

**NEW**: The system automatically extracts context from spec text using LLMs, reducing manual options passing. Falls back to regex heuristics for code assist when LLM is unavailable.

```javascript
// Spec includes context - auto-extracted!
const spec = `
  Given I visit queeraoke.fyi
  When I activate the easter egg game (press 'g', selector: #game-paddle)
  Then the game should be playable
  Context: viewport=1280x720, device=desktop, fps: 2, duration: 10 seconds
`;

// No need to pass URL, viewport, etc. - extracted from spec!
const result = await executeSpec(page, spec, {
  // Only pass what's not in spec
  gameSelector: '#game-paddle' // Can supplement or override
});
```

**Extracted Context (via LLM):**
- URLs: `visit example.com`, `open https://...`, `navigate to ...`
- Viewports: `viewport=1280x720`, `1280x720`, `viewport: 1280x720`
- Devices: `device=desktop`, `on mobile`, `mobile device`
- Personas: `persona=Casual Gamer`, `as Casual Gamer`
- Activation keys: `press 'g'`, `key: g`, `Konami code`
- Selectors: `selector: #element`, `#element`
- FPS: `fps: 2`, `2 fps`
- Duration: `10 seconds`, `duration: 10`
- Temporal: `temporal`, `over time`, `sequence`

**How It Works:**
1. **LLM Extraction** (primary): Uses `extractStructuredData` with LLM to parse natural language
2. **Regex Fallback** (code assist): Falls back to regex heuristics if LLM unavailable

**Priority**: Extracted context takes precedence, but options can override.

## Spec Validation

**NEW**: Validate spec structure before execution:

```javascript
import { validateSpec } from 'ai-visual-test';

const validation = validateSpec(spec);
if (!validation.valid) {
  console.error('Errors:', validation.errors);
}
if (validation.warnings.length > 0) {
  console.warn('Warnings:', validation.warnings);
}
if (validation.suggestions.length > 0) {
  console.log('Suggestions:', validation.suggestions);
}
```

**Checks:**
- Basic structure (Given/When/Then)
- Common mistakes ("I should" vs "Then")
- Missing URL detection
- Missing validation keywords

## Example: Complete Workflow (Based on Queeraoke Patterns)

```javascript
import { executeSpec, testBehavior, generatePropertyTests, testGameplay, validateScreenshot } from 'ai-visual-test';

// Pattern 1: Direct natural language prompt (most common pattern)
const paymentResult = await validateScreenshot(
  screenshotPath,
  `CRITICAL VALIDATION: Payment screen must be perfect. Check:
  - Payment code is clearly visible
  - QR codes are properly rendered and scannable
  - Payment links are accessible
  - Layout is clean and organized`,
  {
    testType: 'payment-critical',
    viewport: { width: 1280, height: 720 }
  }
);

// Pattern 2: testGameplay with goals (game testing pattern)
const gameplayResult = await testGameplay(page, {
  url: 'https://game.example.com',
  goals: ['fun', 'accessibility', 'visual-consistency'],
  gameActivationKey: 'g',
  gameSelector: '#game-element',
  captureTemporal: true,
  fps: 2,
  duration: 10000,
  captureCode: true, // Multi-modal validation
  checkConsistency: true
});

// Pattern 3: Natural language spec with auto-extracted context
const spec = `
  Given I visit game.example.com
  When I activate the game (press 'g')
  Then the game should be playable
  And the score should update
  And the game should be accessible
  Context: viewport=1280x720, fps: 2, duration: 10 seconds
`;

// Context auto-extracted - URL, viewport, FPS, duration from spec
const specResult = await executeSpec(page, spec, {
  gameSelector: '#game-element' // Only pass what's not in spec
});

// Pattern 4: Property-based testing (invariants for any application)
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

// Run property tests
await propertyTests.run();
```

## Benefits

1. **Accessibility**: Non-technical stakeholders can write specs in plain English
2. **Maintainability**: Easier to update than code - change specs without code changes
3. **Flexibility**: Can describe complex behaviors naturally (games, forms, workflows)
4. **Integration**: Works with existing validation infrastructure (testGameplay, validateScreenshot, etc.)
5. **Property Testing**: Natural language properties → executable tests
6. **Dual-View Validation**: Supports screenshot (rendered) + HTML/CSS (source) validation - see `docs/DUAL_VIEW_VALIDATION.md`
7. **Temporal**: Supports sequences over time (animations, gameplay, user flows)
8. **LLM-Based Context Extraction**: Uses LLMs to extract context from spec text (with regex fallback)
9. **Real-World Proven**: Based on actual usage patterns (validated with 200+ tests)

## Limitations

1. **LLM Dependency**: Requires LLM for parsing (adds latency)
2. **Ambiguity**: Natural language can be ambiguous
3. **Precision**: Less precise than formal specs
4. **Coverage**: May miss edge cases that formal specs catch

## Future Work

1. **Spec Templates**: Pre-defined templates for common patterns
2. **Spec Validation**: Validate specs before execution
3. **Spec Optimization**: Optimize spec execution (batching, caching)
4. **Spec Documentation**: Auto-generate documentation from specs
5. **Spec Testing**: Test the specs themselves (meta-testing)

