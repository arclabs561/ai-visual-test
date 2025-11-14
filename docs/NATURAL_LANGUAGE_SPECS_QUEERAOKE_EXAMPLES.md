# Natural Language Specs: Queeraoke Real-World Examples

## Overview

This document shows **real examples** from queeraoke's test suite demonstrating how natural language specs are used in practice. These patterns have been validated through 200+ tests.

## Pattern 1: Direct Natural Language Prompts (Most Common)

**Queeraoke's most common pattern** - direct natural language prompts in `validateScreenshot()` calls:

```javascript
// From queeraoke/test/visual/vllm-comprehensive-journey.test.mjs
const result = await validateScreenshot(
  screenshotPath,
  `CRITICAL VALIDATION: Payment screen must be perfect. Check:
  - Payment code (Q-XXXX format) is clearly visible
  - QR codes are properly rendered and scannable
  - Payment links are accessible
  - Layout is clean and organized
  - No layout issues or overlapping elements`,
  {
    testType: 'payment-critical',
    viewport: { width: 1280, height: 720 },
    paymentCode: 'Q-ABCD'
  }
);
```

**Key Characteristics:**
- Detailed, context-rich prompts
- Explicit checklists
- Context passed in options (paymentCode, viewport, etc.)
- Multi-modal validation (screenshot + code + state)

## Pattern 2: testGameplay with Goals

**Queeraoke's game testing pattern** - uses `testGameplay()` with goals array:

```javascript
// From queeraoke/test/visual/vllm-interactive-game.test.mjs
const result = await testGameplay(page, {
  url: 'https://queeraoke.fyi',
  goals: ['fun', 'accessibility', 'visual-consistency'],
  gameActivationKey: 'g',
  gameSelector: '#game-paddle',
  captureTemporal: true,
  fps: 2,
  duration: 10000,
  captureCode: true, // Multi-modal: screenshot + code + state
  checkConsistency: true // Cross-modal consistency
});
```

**Key Characteristics:**
- Goals array: `['fun', 'accessibility', 'visual-consistency']`
- Game activation: `gameActivationKey: 'g'` (or Konami code)
- Temporal capture: `captureTemporal: true, fps: 2, duration: 10000`
- Multi-modal: `captureCode: true`
- Consistency checks: `checkConsistency: true`

## Pattern 3: Multi-Modal Validation

**Queeraoke's multi-modal pattern** - screenshot + rendered code + game state:

```javascript
// From queeraoke/test/visual/vllm-interactive-game.test.mjs
const [screenshot, gameState, renderedCode] = await Promise.all([
  page.screenshot({ path: screenshotPath }),
  page.evaluate(() => window.gameState || null),
  extractRenderedCode(page)
]);

const result = await validateScreenshot(screenshotPath, `
  MULTI-MODAL CONTEXT:
  - Screenshot: Visual representation
  - Rendered Code: ${JSON.stringify(renderedCode.domStructure, null, 2)}
  - Game State: ${JSON.stringify(gameState, null, 2)}
  
  Evaluate game visual consistency. Check:
  - Visual matches game state
  - Code structure matches visual
  - No inconsistencies
`, {
  testType: 'game-visual-consistency',
  gameState,
  renderedCode
});
```

**Key Characteristics:**
- Parallel capture: screenshot + code + state
- Context-rich prompts with all modalities
- Cross-modal consistency validation

## Pattern 4: Temporal Sequences

**Queeraoke's temporal pattern** - gameplay over time:

```javascript
// From queeraoke/test/visual/vllm-reactive-gameplay.test.mjs
const temporalFrames = await captureTemporalScreenshots(page, 4, 5000, {
  fullPage: false,
  type: 'png'
});

const notes = temporalFrames.map((frame, index) => ({
  timestamp: frame.timestamp,
  elapsed: frame.elapsed || index * 250,
  screenshotPath: frame.path,
  step: `gameplay_frame_${index}`,
  observation: `Frame ${index} of game animation`
}));

const aggregated = aggregateTemporalNotes(notes);
const formatted = formatNotesForPrompt(aggregated);

const validation = await validateScreenshot(
  lastFrame.path,
  `Evaluate game animation smoothness. Temporal analysis:
  ${formatted}
  
  Check: Animations are smooth, no jank or stuttering, ball movement is fluid, paddle movement is responsive.`,
  {
    testType: 'game-animation-temporal',
    temporal: aggregated
  }
);
```

**Key Characteristics:**
- Temporal capture: `captureTemporalScreenshots(page, fps, duration)`
- Note aggregation: `aggregateTemporalNotes(notes)`
- Temporal context in prompts: `formatNotesForPrompt(aggregated)`
- Temporal validation: `temporal: aggregated` in context

## Pattern 5: Property-Based Testing

**Queeraoke's property-based pattern** - game invariants:

```javascript
// From queeraoke/test/game/game-visual-consistency.test.mjs
const properties = [
  'Cleared bricks should have visible masks',
  'Active bricks should have hidden masks',
  'Flag row dimming should match brick clearing state',
  'Z-index hierarchy should be correct (masks above flag rows)',
  'Brick mask positions should match brick positions'
];

// Test each property
for (const property of properties) {
  const result = await testProperty(page, property, {
    gameState: await page.evaluate(() => window.gameState),
    screenshotPath: await page.screenshot({ path: `test-${property}.png` })
  });
  
  expect(result.passed).toBe(true);
}
```

**Key Characteristics:**
- Natural language property descriptions
- Game state extraction: `window.gameState`
- Visual consistency checks
- Programmatic + VLLM validation

## Pattern 6: Persona Testing

**Queeraoke's persona pattern** - multiple perspectives:

```javascript
// From queeraoke/test/visual/vllm-interactive-game.test.mjs
const PERSONAS = {
  casualGamer: {
    name: 'Casual Gamer',
    perspective: 'I play games occasionally for fun.',
    goals: ['Easy to understand', 'Quick to start', 'Satisfying feedback'],
    device: 'desktop'
  },
  accessibilityAdvocate: {
    name: 'Accessibility Advocate',
    perspective: 'I care deeply about making games accessible.',
    goals: ['Keyboard navigation', 'Screen reader support', 'High contrast'],
    device: 'desktop'
  }
};

for (const [key, persona] of Object.entries(PERSONAS)) {
  const result = await testGameplay(page, {
    url: 'https://queeraoke.fyi',
    goals: persona.goals,
    personas: [persona],
    gameActivationKey: 'g',
    captureTemporal: true
  });
}
```

**Key Characteristics:**
- Multiple personas with different perspectives
- Device-specific testing (desktop, mobile)
- Goal-based evaluation per persona
- Temporal capture per persona

## Pattern 7: Complete Journey Testing

**Queeraoke's journey pattern** - full user experience:

```javascript
// From queeraoke/test/visual/vllm-comprehensive-journey.test.mjs
const journey = await completeUserJourney(page, baseURL);

// Step 1: Initial page
await validateScreenshot(journey.screenshots[0], `
  Initial page load. Check:
  - Form is visible and accessible
  - Name input is present
  - Pronouns input is present
  - Amount input is present
  - Continue button is visible
`, { testType: 'initial-page' });

// Step 2: Payment screen
await validateScreenshot(journey.screenshots[1], `
  Payment screen. Check:
  - Payment code (Q-XXXX) is visible
  - QR codes are rendered
  - Payment links are accessible
`, { testType: 'payment-screen' });

// Step 3: Game activation
await validateScreenshot(journey.screenshots[2], `
  Game activated. Check:
  - Game elements are visible
  - Game state is accessible
  - Controls are responsive
`, { testType: 'game-active' });
```

**Key Characteristics:**
- Multi-stage journey
- Context-aware prompts per stage
- Screenshot capture per stage
- Holistic evaluation

## Integration with Natural Language Specs

These queeraoke patterns can be expressed as natural language specs:

```javascript
// Pattern 1 → Natural Language Spec
const spec1 = `
  Given I visit queeraoke.fyi
  When I reach the payment screen
  Then the payment code should be clearly visible
  And QR codes should be properly rendered
  And payment links should be accessible
`;

// Pattern 2 → Natural Language Spec
const spec2 = `
  Given I visit queeraoke.fyi
  When I activate the easter egg game (press 'g')
  Then the game should be fun
  And the game should be accessible
  And visual state should match game state
  And gameplay should be smooth over time
`;

// Pattern 3 → Natural Language Spec
const spec3 = `
  Given I play the game for 10 seconds
  When I capture screenshots at 2 FPS
  Then the score should increase over time
  And the game state should be consistent
  And visual representation should match game state
`;
```

## Key Insights from Queeraoke

1. **Direct prompts are most common** - Not always Given/When/Then, just natural language
2. **Context is critical** - Include game state, rendered code, viewport, etc.
3. **Multi-modal validation** - Screenshot + code + state together
4. **Temporal sequences** - Capture gameplay over time, aggregate notes
5. **Property-based testing** - Natural language invariants
6. **Persona testing** - Multiple perspectives with different goals
7. **Complete journeys** - Test full user experience, not just parts

## Recommendations

1. **Support direct prompts** - Don't require Given/When/Then structure
2. **Auto-extract context** - Automatically include game state, code, etc.
3. **Multi-modal by default** - Screenshot + code + state when available
4. **Temporal support** - Built-in temporal capture and aggregation
5. **Property testing** - Natural language properties → executable tests
6. **Persona support** - Multiple perspectives with different goals
7. **Journey testing** - Full user experience workflows


