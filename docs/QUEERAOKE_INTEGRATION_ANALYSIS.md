# Queeraoke Integration Analysis

## Overview

This document analyzes how `queeraoke` (https://queeraoke.fyi) uses `ai-visual-test` to understand the real-world usage patterns and requirements. Queeraoke is the original motivation for this package.

## Queeraoke Context

### What is Queeraoke?

**Queeraoke** is a karaoke donation system for the queer community:
- Users donate $1+ to access KaraFun session codes
- Has an **easter egg Brick Breaker game** (press 'G' key)
- Game: Break 7 colored stripes (one per pride flag)
- Frame-rate independent (60Hz-240Hz)
- Dark mode aware
- Exposes `window.gameState` for VLLM tests

### Game Details

**Activation:**
- Press `G` key (only when NOT typing in form field)
- Subtle hint appears after 8 seconds
- Mobile: Tap hint

**Controls:**
- Desktop: Mouse, WASD, or Arrow keys
- Mobile: Swipe left/right
- Quit: ESC key

**Game State:**
- Exposed via `window.gameState` for VLLM tests
- Contains: score, level, ball position, paddle position, bricks remaining, etc.

## How Queeraoke Uses ai-visual-test

### 1. Visual Regression Tests

**File:** `test/visual/visual-regression-vllm.test.mjs`

Tests visual consistency across different states:
- Initial page load
- Form filled
- Payment screen
- Game active
- Responsive (mobile, tablet, desktop)

**Pattern:**
```javascript
import { validateScreenshot } from 'ai-visual-test';

await validateScreenshot(screenshotPath, prompt, {
  testType: 'visual-regression',
  context: { stage: 'initial' }
});
```

### 2. Game Visual Consistency

**File:** `test/game/game-visual-consistency.test.mjs`

Tests that the game renders correctly:
- Game elements visible
- Ball and paddle positioned correctly
- Bricks visible
- Score displayed
- Dark mode adaptation

**Pattern:**
```javascript
// Activate game
await page.keyboard.press('g');
await page.waitForSelector('#game-paddle');

// Capture screenshot
const screenshot = await page.screenshot({ path: 'game.png' });

// Validate with VLLM
await validateScreenshot(screenshot, 'Evaluate game visual consistency', {
  gameState: await page.evaluate(() => window.gameState),
  testType: 'game-visual-consistency'
});
```

### 3. Reactive Gameplay Testing

**File:** `test/visual/vllm-reactive-gameplay.test.mjs`

Tests gameplay over time (temporal sequences):
- Captures screenshots at intervals during gameplay
- Validates game state consistency
- Checks for visual glitches
- Validates score progression

**Pattern:**
```javascript
import { testGameplay } from 'ai-visual-test';

await testGameplay(page, {
  url: 'https://queeraoke.fyi',
  gameActivationKey: 'g',
  gameSelector: '#game-paddle',
  goals: ['fun', 'accessibility', 'visual-consistency'],
  captureTemporal: true,
  fps: 2, // 2 FPS for temporal capture
  duration: 10000 // 10 seconds
});
```

### 4. Comprehensive Journey Testing

**File:** `test/visual/vllm-comprehensive-journey.test.mjs`

Tests the full user journey:
- Initial page load
- Form filling
- Payment screen
- Game activation
- Gameplay

**Pattern:**
```javascript
import { testBrowserExperience } from 'ai-visual-test';

await testBrowserExperience(page, {
  url: 'https://queeraoke.fyi',
  stages: ['initial', 'form', 'payment', 'gameplay']
});
```

### 5. Easter Egg Validation

**File:** `test/easter-egg-validation.test.mjs`

Validates the easter egg game:
- Game activation works
- Game renders correctly
- Controls work
- Game state is accessible

**Pattern:**
```javascript
// Activate game
await page.keyboard.press('g');
await page.waitForSelector('#game-paddle');

// Validate game state
const gameState = await page.evaluate(() => window.gameState);
test.expect(gameState).toBeDefined();
test.expect(gameState.score).toBeGreaterThanOrEqual(0);

// Validate visual
await validateScreenshot(screenshot, 'Evaluate easter egg game', {
  gameState,
  testType: 'easter-egg-validation'
});
```

## Key Requirements from Queeraoke

### 1. Game State Extraction

**Requirement:** Extract game state from `window.gameState`

**Implementation:**
- `testGameplay()` extracts `window.gameState` automatically
- `validateScreenshot()` accepts `gameState` in context
- `validateStateSmart()` can validate state programmatically or via VLLM

### 2. Game Activation

**Requirement:** Support games that activate via keyboard shortcuts

**Implementation:**
- `testGameplay()` supports `gameActivationKey` option
- `playGame()` supports `gameActivationKey` option
- `GameGym` supports `gameActivationKey` in constructor

### 3. Temporal Sequences

**Requirement:** Capture and validate gameplay over time

**Implementation:**
- `testGameplay()` supports `captureTemporal: true`
- `fps` option controls capture rate
- `duration` option controls capture duration
- Temporal preprocessing for better performance

### 4. Variable Goals

**Requirement:** Different evaluation criteria (fun, accessibility, visual consistency)

**Implementation:**
- `testGameplay()` accepts `goals` array
- `validateWithGoals()` supports string, object, array, function goals
- `game-goal-prompts.mjs` generates context-aware prompts

### 5. Dark Mode Awareness

**Requirement:** Game adapts to dark/light theme

**Implementation:**
- Visual tests capture screenshots in both themes
- `testGameplay()` can test both themes
- `validateScreenshot()` can validate theme adaptation

## Test Patterns Used

### Pattern 1: Simple Visual Validation

```javascript
import { validateScreenshot } from 'ai-visual-test';

const result = await validateScreenshot(screenshotPath, prompt);
test.expect(result.score).toBeGreaterThan(7);
```

### Pattern 2: Game Testing with State

```javascript
import { testGameplay } from 'ai-visual-test';

const result = await testGameplay(page, {
  url: 'https://queeraoke.fyi',
  gameActivationKey: 'g',
  gameSelector: '#game-paddle',
  goals: ['fun', 'accessibility']
});
```

### Pattern 3: Temporal Gameplay

```javascript
import { testGameplay } from 'ai-visual-test';

const result = await testGameplay(page, {
  url: 'https://queeraoke.fyi',
  gameActivationKey: 'g',
  captureTemporal: true,
  fps: 2,
  duration: 10000
});
```

### Pattern 4: Game Playing (NEW)

```javascript
import { playGame } from 'ai-visual-test';

const result = await playGame(page, {
  goal: 'Maximize score',
  maxSteps: 50,
  fps: 2,
  gameActivationKey: 'g',
  gameSelector: '#game-paddle'
});
```

## Integration Points

### 1. `window.gameState` Exposure

**Queeraoke:** Exposes `window.gameState` for tests
**ai-visual-test:** Reads `window.gameState` automatically in `testGameplay()`

### 2. Game Activation

**Queeraoke:** Game activates with 'g' key
**ai-visual-test:** Supports `gameActivationKey` option

### 3. Game Selector

**Queeraoke:** Game element is `#game-paddle`
**ai-visual-test:** Supports `gameSelector` option to wait for game activation

### 4. Temporal Capture

**Queeraoke:** Needs to validate gameplay over time
**ai-visual-test:** Supports `captureTemporal`, `fps`, `duration` options

### 5. Variable Goals

**Queeraoke:** Different goals (fun, accessibility, visual consistency)
**ai-visual-test:** Supports `goals` array with string, object, array, function

## Natural Language Specs Usage

### Potential Usage

Queeraoke could use natural language specs for:

```javascript
import { executeSpec } from 'ai-visual-test';

const spec = `
  Given I visit queeraoke.fyi
  When I activate the easter egg game (press 'g')
  Then the game should be playable
  And the score should update
  And the game should be accessible
`;

const result = await executeSpec(page, spec, {
  url: 'https://queeraoke.fyi',
  gameActivationKey: 'g'
});
```

### Property-Based Testing

```javascript
import { generatePropertyTests } from 'ai-visual-test';

const properties = [
  'Game score should always be non-negative',
  'Game state should always match visual representation',
  'Game should be playable in both light and dark mode'
];

const tests = await generatePropertyTests(properties);
await tests.run();
```

## Key Insights

### 1. Real-World Usage

- **Not just testing** - Queeraoke actually uses VLLM for visual regression
- **Temporal sequences** - Captures gameplay over time
- **State validation** - Extracts and validates `window.gameState`
- **Variable goals** - Different evaluation criteria

### 2. Requirements

- **Game activation** - Support keyboard shortcuts
- **Game state extraction** - Read `window.gameState`
- **Temporal capture** - Capture gameplay over time
- **Variable goals** - Different evaluation criteria
- **Dark mode** - Test both themes

### 3. Integration Patterns

- **Simple validation** - `validateScreenshot()` for single screenshots
- **Game testing** - `testGameplay()` for complete game testing workflow
- **Game playing** - `playGame()` for actually playing games (NEW)
- **Temporal sequences** - `captureTemporal: true` for gameplay over time

### 4. Natural Language Specs

- **Potential** - Could use `executeSpec()` for plain English tests
- **Property-based** - Could use `generatePropertyTests()` for invariants
- **Not yet used** - Queeraoke doesn't currently use natural language specs

## Recommendations

### 1. Document Queeraoke Usage

- Add examples from queeraoke to documentation
- Show real-world usage patterns
- Document `window.gameState` pattern

### 2. Enhance Natural Language Specs

- Add queeraoke-specific examples
- Support game activation in specs
- Support temporal sequences in specs

### 3. Property-Based Testing

- Add queeraoke-specific properties
- Document how to write game properties
- Show examples of game state invariants

### 4. Game Playing Integration

- Document how `playGame()` works with queeraoke
- Show examples of playing the easter egg game
- Document `GameGym` usage for queeraoke

## Conclusion

Queeraoke is a real-world example of how `ai-visual-test` is used:
- Visual regression testing
- Game testing with state validation
- Temporal sequences
- Variable goals
- Dark mode awareness

The package should continue to support these patterns and document them clearly. Natural language specs and property-based testing are potential enhancements that could make testing even easier.

