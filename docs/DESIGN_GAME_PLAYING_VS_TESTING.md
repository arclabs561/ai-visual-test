# Design: Game Playing vs Game Testing

## Current State: Game Testing

**What we have:**
- `testGameplay()` - Validates game screenshots
- `validateWithGoals()` - Evaluates game state with variable goals
- `captureTemporalScreenshots()` - Captures gameplay sequences
- `validateStateSmart()` - Extracts game state from screenshots

**What we do:**
1. Take screenshots of games
2. Evaluate if the game is fun/accessible/working
3. Validate game state (score, level, position)
4. Test gameplay sequences over time

**What we DON'T do:**
- Make decisions about what action to take
- Execute actions (clicking, keyboard input)
- Actually play the game
- Learn from gameplay to improve

## Gap: Game Playing

**Question:** Could this package be used to actually PLAY games, not just test them?

**Answer:** Yes, but it requires additional capabilities:

### What's Needed for Game Playing

1. **Decision Making** (we have this partially)
   - ✅ Understand game state from screenshots
   - ✅ Evaluate game state (score, position, etc.)
   - ❌ Decide what action to take (move left, right, jump, etc.)
   - ❌ Strategy/planning (short-term and long-term goals)

2. **Action Execution** (we DON'T have this)
   - ❌ Click buttons/elements
   - ❌ Keyboard input (arrow keys, space, etc.)
   - ❌ Mouse movements
   - ❌ Touch gestures (for mobile)

3. **Learning/Adaptation** (we DON'T have this)
   - ❌ Learn from mistakes
   - ❌ Adapt strategy based on results
   - ❌ Improve over time

## Design Options

### Option 1: Keep Testing Only (Current)

**Pros:**
- Clear separation of concerns
- Package stays focused on validation
- No need for action execution

**Cons:**
- Misses opportunity for interactive gameplay
- Doesn't fully leverage temporal understanding
- Can't demonstrate "playing" capabilities

### Option 2: Add Game Playing Capabilities

**Pros:**
- More complete solution
- Demonstrates temporal understanding in action
- Could be used for automated gameplay
- Natural extension of current capabilities

**Cons:**
- Adds complexity
- Requires Playwright for action execution
- Blurs line between "testing" and "playing"
- May not be core use case

### Option 3: Hybrid Approach (Recommended)

**Design:**
- Keep core package focused on validation/testing
- Add optional "game playing" module that uses validation
- Make it clear that playing requires additional setup

**Architecture:**
```
ai-visual-test (core)
├── validateScreenshot() - Core validation
├── testGameplay() - Game testing
└── [NEW] playGame() - Game playing (optional, uses validation)
    ├── Uses validateScreenshot() to understand state
    ├── Uses decision-making to choose actions
    └── Uses Playwright to execute actions
```

## Recommended Design: Game Playing Module

### Core Principle

**Game playing is validation + decision-making + action execution**

1. **Validation** (we have this) - Understand game state
2. **Decision-making** (we need this) - Choose what action to take
3. **Action execution** (we need this) - Execute the action via Playwright

### Implementation Strategy

#### 1. Decision-Making Module

```javascript
// src/game-player.mjs (new)

/**
 * Decides what action to take based on game state
 * 
 * @param {Object} gameState - Current game state from screenshot
 * @param {Object} goal - Goal for gameplay (e.g., "maximize score", "survive")
 * @param {Array} history - Previous actions and results
 * @returns {Object} Action to take { type: 'keyboard', key: 'ArrowRight', ... }
 */
export async function decideGameAction(gameState, goal, history = []) {
  // Use VLLM to understand current state
  const stateEvaluation = await validateScreenshot(
    gameState.screenshot,
    `Evaluate current game state. Goal: ${goal}. History: ${JSON.stringify(history)}`
  );
  
  // Use VLLM to decide action
  const actionPrompt = `Based on the game state, decide what action to take.
    Goal: ${goal}
    Current state: ${stateEvaluation.reasoning}
    Previous actions: ${history.map(h => h.action).join(', ')}
    
    Return action as JSON: { "type": "keyboard", "key": "ArrowRight" }`;
  
  const actionResult = await validateScreenshot(
    gameState.screenshot,
    actionPrompt,
    { extractStructured: true }
  );
  
  return parseAction(actionResult);
}
```

#### 2. Action Execution Module

```javascript
// src/game-player.mjs (continued)

/**
 * Executes a game action via Playwright
 * 
 * @param {Page} page - Playwright page object
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
    case 'type':
      await page.type(action.selector, action.text);
      break;
    case 'wait':
      await page.waitForTimeout(action.duration);
      break;
    default:
      throw new Error(`Unknown action type: ${action.type}`);
  }
}
```

#### 3. Game Playing Function

```javascript
// src/game-player.mjs (continued)

/**
 * Plays a game by taking screenshots, making decisions, and executing actions
 * 
 * @param {Page} page - Playwright page object
 * @param {Object} options - Game playing options
 * @param {string} options.goal - Goal for gameplay (e.g., "maximize score")
 * @param {number} options.maxSteps - Maximum number of steps
 * @param {number} options.fps - Frames per second for gameplay
 * @returns {Object} Gameplay result with history, final state, etc.
 */
export async function playGame(page, options = {}) {
  const {
    goal = 'Play the game well',
    maxSteps = 100,
    fps = 2, // 2 FPS for decision-making (not 60 FPS)
    gameSelector = null,
    gameActivationKey = null
  } = options;
  
  // Activate game if needed
  if (gameActivationKey) {
    await page.keyboard.press(gameActivationKey);
    await page.waitForTimeout(500);
  }
  
  const history = [];
  let currentState = null;
  
  for (let step = 0; step < maxSteps; step++) {
    // 1. Capture current state (screenshot)
    const screenshot = await page.screenshot();
    const screenshotPath = `gameplay-step-${step}.png`;
    await writeFile(screenshotPath, screenshot);
    
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
          result: h.result
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
    if (stateEvaluation.score === 0 || stateEvaluation.issues?.includes('game over')) {
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

### Integration with Existing Code

#### Update `testGameplay()` to Support Playing

```javascript
// src/convenience.mjs

export async function testGameplay(page, options = {}) {
  const {
    play = false, // NEW: Option to actually play
    goal = 'Evaluate gameplay',
    // ... existing options
  } = options;
  
  if (play) {
    // Use new playGame() function
    return await playGame(page, { goal, ...options });
  } else {
    // Existing testing behavior
    // ... current implementation
  }
}
```

## Use Cases

### 1. Game Testing (Current)

```javascript
// Test if game is fun/accessible
const result = await testGameplay(page, {
  goal: 'Is the game fun and accessible?',
  play: false // Just validate, don't play
});
```

### 2. Game Playing (New)

```javascript
// Actually play the game
const result = await testGameplay(page, {
  goal: 'Maximize score',
  play: true, // Actually play
  maxSteps: 50,
  fps: 2 // 2 decisions per second
});
```

### 3. Automated Gameplay

```javascript
// Use for automated gameplay demonstrations
const result = await playGame(page, {
  goal: 'Survive as long as possible',
  maxSteps: 100,
  fps: 1 // 1 decision per second (slower, more thoughtful)
});
```

## Design Decisions

### 1. FPS for Decision-Making

**Question:** Should decision-making be 60 FPS like real gameplay?

**Answer:** No. Decision-making should be slower (1-5 FPS) because:
- VLLM calls take 1-3 seconds
- We need time to understand state and make decisions
- Real-time gameplay (60 FPS) is for human players, not AI

**Design:** Default to 2 FPS for decision-making, allow configuration.

### 2. Action Types

**Supported:**
- Keyboard input (arrow keys, space, etc.)
- Mouse clicks
- Text input
- Waiting

**Not Supported (initially):**
- Complex gestures
- Multi-touch
- Drag and drop (could add later)

### 3. Goal Specification

**Use existing `validateWithGoals()` system:**
- String goals: "maximize score", "survive"
- Object goals: { description: "maximize score", criteria: [...] }
- Function goals: Dynamic based on game state

### 4. Learning/Adaptation

**Not in initial design:**
- No learning from mistakes (would require reinforcement learning)
- No strategy adaptation (would require planning)
- Keep it simple: validate → decide → act → repeat

**Future enhancement:**
- Could add simple strategy (e.g., "if score < 100, be aggressive")
- Could add history-based decisions (avoid actions that led to failure)

## Implementation Plan

### Phase 1: Core Game Playing (Recommended)

1. **Add `playGame()` function** to `src/game-player.mjs`
2. **Add `decideGameAction()` function** for decision-making
3. **Add `executeGameAction()` function** for action execution
4. **Update `testGameplay()`** to support `play: true` option
5. **Add tests** for game playing functionality

### Phase 2: Integration

1. **Update documentation** to explain game playing vs testing
2. **Add examples** showing game playing in action
3. **Update evaluation scripts** to test game playing
4. **Add to README** as a feature

### Phase 3: Enhancement (Future)

1. **Add strategy/planning** for more sophisticated gameplay
2. **Add learning** from gameplay history
3. **Add multi-step planning** (think ahead)
4. **Add goal achievement tracking** (did we achieve the goal?)

## Questions to Answer

1. **Is game playing a core feature or optional?**
   - **Answer:** Optional module, core stays focused on validation

2. **Should it be in the main package or separate?**
   - **Answer:** In main package, but clearly documented as optional/advanced

3. **What's the performance expectation?**
   - **Answer:** 1-5 FPS for decision-making (not 60 FPS)

4. **What games can it play?**
   - **Answer:** Any game accessible via Playwright (web games, HTML5 games)

## Conclusion

**Game playing is a natural extension of game testing:**
- Uses existing validation capabilities
- Adds decision-making and action execution
- Demonstrates temporal understanding in action
- Makes the package more complete

**Design wisely:**
- Keep it optional (don't force users to use it)
- Make it clear it's for slower decision-making (1-5 FPS, not 60 FPS)
- Use existing validation infrastructure
- Keep it simple initially (no learning, no complex planning)

**Implementation:**
- Add `playGame()` function
- Integrate with existing `testGameplay()`
- Document clearly
- Add tests and examples

