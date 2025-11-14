# Integration Plan: Game Motivation Throughout Codebase

## Design Decision

**Answer to "Could this be used to play a game?":**

**Yes, but it's a natural extension, not the core purpose.**

- **Core purpose**: Validate screenshots (testing)
- **Extension**: Play games (uses validation + decision-making + action execution)
- **Design**: Add optional `playGame()` function that uses existing validation

## Integration Strategy

### Phase 1: Update Documentation (No Code Changes)

1. **Update README** - Add game use cases prominently
2. **Update API docs** - Reference queeraoke/game motivation
3. **Update code comments** - Add motivation context
4. **Create examples** - Show game testing/playing examples

### Phase 2: Add Game Playing (Optional Feature)

1. **Add `playGame()` function** - Optional game playing capability
2. **Add `decideGameAction()`** - Decision-making based on validation
3. **Add `executeGameAction()`** - Action execution via Playwright
4. **Update `testGameplay()`** - Support `play: true` option

### Phase 3: Update Tests

1. **Add game playing tests** - Test the new functionality
2. **Update existing tests** - Reference game motivation
3. **Add queeraoke examples** - Show real-world usage

## Implementation Details

### 1. Update README

**Add to "What it's good for":**
- **Game testing** - Validate gameplay screenshots with variable goals (inspired by queeraoke)
- **Game playing** (optional) - Actually play games using validation + decision-making

**Add new section "Game Use Cases":**
```markdown
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
import { playGame } from 'ai-visual-test';

// Actually play the game
const result = await playGame(page, {
  goal: 'Maximize score',
  maxSteps: 50,
  fps: 2 // 2 decisions per second (not 60 FPS - AI needs time to think)
});
```
```

### 2. Update Code Comments

**In `src/convenience.mjs` - `testGameplay()`:**
```javascript
/**
 * Test gameplay with variable goals
 * 
 * Complete workflow for testing games with variable goals/prompts.
 * Originally motivated by queeraoke (https://queeraoke.fyi), an interactive
 * karaoke game that requires real-time validation, variable goals, and
 * temporal understanding.
 * 
 * Handles persona experience, temporal capture, goal evaluation, and consistency checks.
 * 
 * Supports queeraoke-style games:
 * - Games that activate from payment screens (not just standalone games)
 * - Game activation via keyboard shortcuts (e.g., 'g' key)
 * - Game state extraction (window.gameState)
 * - Temporal preprocessing for better performance
 * 
 * @param {import('playwright').Page} page - Playwright page object
 * @param {Object} options - Test options
 * @param {string} options.url - Game URL (or page URL if game activates from page)
 * @param {string | Object | Array | Function} [options.goals] - Variable goals
 * @param {string} [options.gameActivationKey] - Keyboard key to activate game (e.g., 'g' for queeraoke)
 * @param {string} [options.gameSelector] - Selector to wait for game activation (e.g., '#game-paddle')
 * @param {boolean} [options.play] - If true, actually play the game (uses playGame() internally)
 * @returns {Promise<Object>} Test results
 */
```

### 3. Add Game Playing Module

**Create `src/game-player.mjs`:**
```javascript
/**
 * Game Playing Module
 * 
 * Optional module for actually playing games (not just testing them).
 * Uses validation to understand game state, then makes decisions and executes actions.
 * 
 * Originally motivated by queeraoke (https://queeraoke.fyi), but works for any web game.
 * 
 * Design: Game playing = validation + decision-making + action execution
 * - Validation: Understand game state from screenshots (we have this)
 * - Decision-making: Choose what action to take (we add this)
 * - Action execution: Execute actions via Playwright (we add this)
 */

import { validateScreenshot } from './index.mjs';
import { writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Decides what action to take based on game state
 * 
 * Uses VLLM to understand current state and decide next action.
 * 
 * @param {Object} gameState - Current game state from screenshot
 * @param {string} goal - Goal for gameplay (e.g., "maximize score", "survive")
 * @param {Array} history - Previous actions and results
 * @returns {Promise<Object>} Action to take { type: 'keyboard', key: 'ArrowRight', ... }
 */
export async function decideGameAction(gameState, goal, history = []) {
  // Use VLLM to understand current state
  const stateEvaluation = await validateScreenshot(
    gameState.screenshot,
    `Evaluate current game state. Goal: ${goal}. History: ${JSON.stringify(history.slice(-5))}`
  );
  
  // Use VLLM to decide action
  const actionPrompt = `Based on the game state, decide what action to take.
    Goal: ${goal}
    Current state: ${stateEvaluation.reasoning}
    Previous actions: ${history.slice(-3).map(h => h.action).join(', ')}
    
    Return action as JSON: { "type": "keyboard", "key": "ArrowRight" }
    Available actions: keyboard (ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Space), click (selector), wait (duration)`;
  
  const actionResult = await validateScreenshot(
    gameState.screenshot,
    actionPrompt,
    { extractStructured: true, testType: 'gameplay-decision' }
  );
  
  // Parse action from reasoning (VLLM returns reasoning, we extract JSON)
  const actionMatch = actionResult.reasoning.match(/\{[\s\S]*"type"[\s\S]*\}/);
  if (actionMatch) {
    try {
      return JSON.parse(actionMatch[0]);
    } catch (e) {
      // Fallback: simple heuristic
      return { type: 'keyboard', key: 'ArrowRight' };
    }
  }
  
  return { type: 'keyboard', key: 'ArrowRight' }; // Default
}

/**
 * Executes a game action via Playwright
 * 
 * @param {import('playwright').Page} page - Playwright page object
 * @param {Object} action - Action to execute
 */
export async function executeGameAction(page, action) {
  switch (action.type) {
    case 'keyboard':
      await page.keyboard.press(action.key);
      break;
    case 'click':
      await page.click(action.selector);
      break;
    case 'wait':
      await page.waitForTimeout(action.duration || 100);
      break;
    default:
      throw new Error(`Unknown action type: ${action.type}`);
  }
}

/**
 * Plays a game by taking screenshots, making decisions, and executing actions
 * 
 * Uses validation to understand game state, then makes decisions and executes actions.
 * This is slower than human gameplay (1-5 FPS for decision-making, not 60 FPS)
 * because VLLM calls take 1-3 seconds.
 * 
 * Originally motivated by queeraoke (https://queeraoke.fyi), but works for any web game.
 * 
 * @param {import('playwright').Page} page - Playwright page object
 * @param {Object} options - Game playing options
 * @param {string} options.goal - Goal for gameplay (e.g., "maximize score")
 * @param {number} options.maxSteps - Maximum number of steps
 * @param {number} options.fps - Frames per second for decision-making (default: 2, not 60)
 * @param {string} [options.gameActivationKey] - Keyboard key to activate game
 * @param {string} [options.gameSelector] - Selector to wait for game activation
 * @returns {Promise<Object>} Gameplay result with history, final state, etc.
 */
export async function playGame(page, options = {}) {
  const {
    goal = 'Play the game well',
    maxSteps = 100,
    fps = 2, // 2 FPS for decision-making (not 60 FPS - AI needs time to think)
    gameSelector = null,
    gameActivationKey = null
  } = options;
  
  // Activate game if needed
  if (gameActivationKey) {
    await page.keyboard.press(gameActivationKey);
    await page.waitForTimeout(500);
    
    if (gameSelector) {
      await page.waitForSelector(gameSelector, { timeout: 5000 });
    }
  }
  
  const history = [];
  let currentState = null;
  const tempDir = join(process.cwd(), 'temp-gameplay');
  
  for (let step = 0; step < maxSteps; step++) {
    // 1. Capture current state (screenshot)
    const screenshot = await page.screenshot();
    const screenshotPath = join(tempDir, `gameplay-step-${step}.png`);
    writeFileSync(screenshotPath, screenshot);
    
    // 2. Understand current state (validation)
    currentState = {
      screenshot: screenshotPath,
      step,
      timestamp: Date.now()
    };
    
    const stateEvaluation = await validateScreenshot(
      screenshotPath,
      `Evaluate current game state. Goal: ${goal}`,
      {
        testType: 'gameplay',
        temporalNotes: history.map(h => ({
          step: h.step,
          action: h.action,
          result: h.result?.score
        }))
      }
    );
    
    currentState.evaluation = stateEvaluation;
    
    // 3. Decide what action to take (decision-making)
    const action = await decideGameAction(
      currentState,
      goal,
      history
    );
    
    // 4. Execute action (Playwright)
    await executeGameAction(page, action);
    
    // 5. Wait for next frame
    await page.waitForTimeout(1000 / fps);
    
    // 6. Record history
    history.push({
      step,
      state: currentState,
      action,
      evaluation: stateEvaluation
    });
    
    // 7. Check if game is over (optional)
    if (stateEvaluation.score === 0 || stateEvaluation.issues?.some(i => i.includes('game over'))) {
      break;
    }
  }
  
  return {
    history,
    finalState: currentState,
    totalSteps: history.length,
    goal
  };
}
```

### 4. Update `testGameplay()` to Support Playing

**In `src/convenience.mjs`:**
```javascript
export async function testGameplay(page, options = {}) {
  const {
    play = false, // NEW: Option to actually play
    // ... existing options
  } = options;
  
  if (play) {
    // Use new playGame() function
    const { playGame } = await import('./game-player.mjs');
    return await playGame(page, { goal: options.goals?.[0] || 'Play well', ...options });
  } else {
    // Existing testing behavior
    // ... current implementation
  }
}
```

### 5. Update Tests

**Add `test/game-playing.test.mjs`:**
```javascript
import { test } from '@playwright/test';
import { playGame, testGameplay } from '../src/index.mjs';

test('can play a simple game', async ({ page }) => {
  await page.goto('https://play2048.co/');
  
  const result = await playGame(page, {
    goal: 'Maximize score',
    maxSteps: 10,
    fps: 1 // Slow for testing
  });
  
  expect(result.totalSteps).toBeGreaterThan(0);
  expect(result.history.length).toBeGreaterThan(0);
});

test('testGameplay with play option', async ({ page }) => {
  await page.goto('https://play2048.co/');
  
  const result = await testGameplay(page, {
    url: 'https://play2048.co/',
    play: true, // Actually play
    goal: 'Maximize score',
    maxSteps: 5
  });
  
  expect(result.totalSteps).toBeGreaterThan(0);
});
```

## Summary

**Design Decision:**
- Core package: Testing/validation (current)
- Optional extension: Game playing (new)
- Integration: Add `playGame()` as optional feature

**Implementation:**
1. Update docs to highlight game motivation
2. Add `playGame()` function (optional)
3. Update `testGameplay()` to support `play: true`
4. Add tests and examples

**Key Points:**
- Game playing is slower (1-5 FPS, not 60 FPS) because VLLM needs time
- Uses existing validation infrastructure
- Optional feature - doesn't change core behavior
- Clearly documented as inspired by queeraoke

