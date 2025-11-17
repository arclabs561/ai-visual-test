# Success Criteria: Browser Automation Agent

## Macro Purpose (Refined)

**Primary Goal**: AI-powered browser automation agent that uses Vision Language Models (VLLM) to understand screenshots and complete tasks in browsers via prompts/chat interface.

**Core Vision**: Like Claude's browser mode - prompts/chat accomplish tasks in browser:
- **Sometimes it's a game** (60Hz real-time interaction)
- **Other times it's validating** that something happens on a webpage after some time
- **Other times it's clicking through** stuff, trying a few things - exploratory automation

**Key Characteristics**:
- **Semantic understanding** - Understands UI meaning, not just pixels
- **Real-time interaction** - Some Hz (1-10Hz for most tasks, 60Hz for games)
- **Task completion** - Completes browser tasks via natural language prompts
- **Temporal understanding** - Validates things over time, waits for changes
- **Exploratory automation** - Tries different approaches, clicks through interfaces
- **Decision-making** - Decides what to do next based on visual understanding

## Original Primary Goals (Recalled)

From `docs/GOALS_AND_INTERFACES.md`:
1. **Semantic validation** - Understands UI meaning, not just pixel differences
2. **High-frequency validation** (10-60Hz) for real-time interactions
3. **Variable goals** - Different evaluation criteria based on context
4. **Temporal sequences** - Understanding changes over time, not just single frames
5. **State validation** - Fast programmatic or VLLM extraction from screenshots
6. **Accessibility validation** - Fast programmatic checks or VLLM semantic evaluation

## Refined Success Criteria

### Part 1: Task Completion via Prompts/Chat

**Why It Matters**: The core value is completing browser tasks via natural language, not just validation.

**Success Metrics**:
- **Task Success Rate**: >80% of tasks completed successfully via prompts
- **Task Types**: Works for games, validation, navigation, form filling, exploration
- **Natural Language Understanding**: Correctly interprets task descriptions >85% of the time
- **Multi-Step Tasks**: Completes multi-step workflows >70% of the time

**Evaluation**: Test with diverse browser tasks:
- Game playing: "Play 2048 and get a score of 100"
- Validation: "Check if the payment form appears after clicking checkout"
- Navigation: "Navigate to the settings page and change the theme"
- Form filling: "Fill out the contact form with test data"
- Exploration: "Try to find the pricing page and see what plans are available"

**Threshold**:
- >80% task success rate across all task types
- >85% natural language understanding accuracy
- >70% multi-step task completion

### Part 2: Real-Time Interaction (Some Hz)

**Why It Matters**: Browser automation needs real-time interaction, but Hz varies by task type.

**Success Metrics**:
- **Game Interaction**: 60Hz for games (<100ms latency)
- **Standard Tasks**: 1-10Hz for most browser tasks (<1s latency)
- **Validation Tasks**: 0.1-1Hz for validation over time (<10s latency)
- **Adaptive Hz**: Automatically adjusts Hz based on task type

**Evaluation**: Test with different task types:
- Games: Measure 60Hz capability
- Standard tasks: Measure 1-10Hz capability
- Validation: Measure ability to wait and validate over time

**Threshold**:
- Games: 95th percentile latency <100ms, 60 validations/second
- Standard tasks: 95th percentile latency <1s, 1-10 validations/second
- Validation: Can wait and validate over time (0.1-1Hz)

### Part 3: Decision-Making and Action Execution

**Why It Matters**: Browser automation requires deciding what to do next and executing actions.

**Success Metrics**:
- **Decision Accuracy**: Correctly decides next action >75% of the time
- **Action Execution**: Successfully executes actions (click, type, navigate) >90% of the time
- **Exploratory Behavior**: Tries different approaches when stuck >60% of the time
- **Error Recovery**: Recovers from errors and tries alternatives >70% of the time

**Evaluation**: Test decision-making and action execution:
- Decision-making: "What should I click next?" - measure accuracy
- Action execution: Click buttons, type text, navigate - measure success rate
- Exploration: "Try to find the login button" - measure success with different approaches
- Error recovery: Handle errors gracefully and try alternatives

**Threshold**:
- >75% decision accuracy
- >90% action execution success rate
- >60% exploratory success rate
- >70% error recovery success rate

### Part 4: Temporal Understanding and Validation

**Why It Matters**: Many browser tasks require waiting for things to happen and validating over time.

**Success Metrics**:
- **Temporal Validation**: Correctly validates things that happen over time >80% of the time
- **Wait and Check**: Successfully waits for changes and validates >75% of the time
- **State Tracking**: Tracks state changes over time >70% of the time
- **Temporal Coherence**: Maintains coherent understanding of temporal sequences >75% of the time

**Evaluation**: Test temporal understanding:
- "Wait for the payment form to appear after clicking checkout" - measure success
- "Check if the score increases over time" - measure accuracy
- "Validate that the page loads completely" - measure success
- "Track state changes during gameplay" - measure accuracy

**Threshold**:
- >80% temporal validation accuracy
- >75% wait-and-check success rate
- >70% state tracking accuracy
- >75% temporal coherence

### Part 5: Exploratory Automation

**Why It Matters**: Browser automation often requires trying different approaches, clicking through interfaces.

**Success Metrics**:
- **Exploration Success**: Successfully explores interfaces >70% of the time
- **Multiple Approaches**: Tries different approaches when one fails >60% of the time
- **Click-Through Navigation**: Successfully navigates by clicking through >75% of the time
- **Discovery**: Discovers new pages/elements >65% of the time

**Evaluation**: Test exploratory automation:
- "Try to find the settings page" - measure success with exploration
- "Click through the navigation menu" - measure success
- "Try different approaches to login" - measure success
- "Discover what's available on this page" - measure success

**Threshold**:
- >70% exploration success rate
- >60% multiple approach success rate
- >75% click-through navigation success rate
- >65% discovery success rate

### Part 6: Calibration Degradation Tracking

**Why It Matters**: Long browser automation sessions can degrade VLLM calibration. Need to detect and adapt.

**Success Metrics (Browser Automation Context)**:
- **Detection in Long Sessions**: Detects degradation during long automation sessions (>50 actions)
- **False Positive Rate**: <10% false positives during normal automation
- **Actionable Recommendations**: Recommendations help maintain automation quality >80% of the time

**Evaluation**: Test with long browser automation sessions:
- Multi-step workflows (>50 actions)
- Extended exploration sessions
- Long validation tasks

**Threshold**:
- >80% detection in long sessions where degradation occurs
- <10% false positive rate
- >80% actionable recommendation accuracy

### Part 7: Temporal Graph Representation

**Why It Matters**: Browser automation involves state transitions (page changes, form submissions, navigation). Need coherent understanding.

**Success Metrics (Browser Automation Context)**:
- **State Transition Coherence**: Correctly identifies coherent state transitions >75% of the time
- **Entity Continuity**: Tracks UI elements across page transitions >80% of the time
- **Actionable Insights**: Graph recommendations help identify automation issues >70% of the time

**Evaluation**: Test with browser automation sequences:
- Page navigation sequences
- Form submission workflows
- Multi-step task completion

**Threshold**:
- >75% state transition coherence
- >80% entity continuity
- >70% actionable insight accuracy

### Part 8: Screenshot Selection (Context Window Management)

**Why It Matters**: Long browser automation sessions generate many screenshots. Need intelligent selection for context.

**Success Metrics (Browser Automation Context)**:
- **Keyframe Detection**: Captures significant automation events (page loads, form submissions, state changes) >80% of the time
- **Information Retention**: Selected screenshots maintain >85% of evaluation accuracy
- **Latency Impact**: Selection completes in <50ms (doesn't add significant latency)

**Evaluation**: Test with browser automation sequences:
- Multi-step workflows
- Extended exploration sessions
- Long validation tasks

**Threshold**:
- >80% keyframe detection
- >85% information retention
- <50ms selection latency

## Overall Success Criteria (Browser Automation Agent)

### 1. Task Completion Works

**Primary Goal**: Can complete browser tasks via prompts/chat

**Success Metrics**:
- **Task Success Rate**: >80% across all task types
- **Task Diversity**: Works for games, validation, navigation, form filling, exploration
- **Natural Language Understanding**: >85% accuracy interpreting task descriptions
- **Multi-Step Tasks**: >70% completion rate for multi-step workflows

**Evaluation**: 
- Test with diverse browser tasks
- Measure task success rate
- Measure natural language understanding

**Threshold**: 
- >80% task success rate
- Works for >90% of tested task types
- >85% natural language understanding accuracy

### 2. Real-Time Interaction Works

**Primary Goal**: Some Hz for real-time interaction (varies by task type)

**Success Metrics**:
- **Game Interaction**: 60Hz with <100ms latency
- **Standard Tasks**: 1-10Hz with <1s latency
- **Validation Tasks**: 0.1-1Hz with ability to wait and validate
- **Adaptive Hz**: Automatically adjusts based on task type

**Evaluation**: 
- Test with different task types
- Measure latency and throughput
- Measure adaptive Hz capability

**Threshold**:
- Games: 95th percentile latency <100ms, 60 validations/second
- Standard tasks: 95th percentile latency <1s, 1-10 validations/second
- Validation: Can wait and validate over time

### 3. Decision-Making and Action Execution Works

**Primary Goal**: Decides what to do next and executes actions

**Success Metrics**:
- **Decision Accuracy**: >75% correct decisions
- **Action Execution**: >90% successful action execution
- **Exploratory Behavior**: >60% success with exploration
- **Error Recovery**: >70% success recovering from errors

**Evaluation**: 
- Test decision-making accuracy
- Test action execution success rate
- Test exploratory behavior
- Test error recovery

**Threshold**:
- >75% decision accuracy
- >90% action execution success rate
- >60% exploratory success rate
- >70% error recovery success rate

### 4. Temporal Understanding Works

**Primary Goal**: Validates things over time, waits for changes

**Success Metrics**:
- **Temporal Validation**: >80% accuracy
- **Wait and Check**: >75% success rate
- **State Tracking**: >70% accuracy
- **Temporal Coherence**: >75% coherence

**Evaluation**: 
- Test temporal validation accuracy
- Test wait-and-check capability
- Test state tracking accuracy
- Test temporal coherence

**Threshold**:
- >80% temporal validation accuracy
- >75% wait-and-check success rate
- >70% state tracking accuracy
- >75% temporal coherence

### 5. Real-World Browser Automation Works

**Primary Goal**: Works in real-world browser automation scenarios

**Success Metrics**:
- **Task Compatibility**: Works with >90% of tested browser tasks
- **Integration Ease**: Easy integration with Playwright (<10 lines of code)
- **Usability**: Can set up browser automation in <5 minutes
- **Reliability**: >95% success rate for common tasks

**Evaluation**: 
- Test with real browser tasks
- Measure integration ease
- Measure usability
- Measure reliability

**Threshold**:
- Works with >90% of tested browser tasks
- Integration requires <10 lines of code
- Can set up in <5 minutes
- >95% success rate for common tasks

## Evaluation Datasets (Browser Automation)

### 1. Browser Task Completion Dataset

**File**: `evaluation/datasets/browser-task-completion.json`

```json
{
  "name": "Browser Task Completion",
  "description": "Diverse browser tasks for automation testing",
  "taskTypes": {
    "games": [
      {
        "id": "2048-play",
        "task": "Play 2048 and get a score of 100",
        "url": "https://play2048.co/",
        "groundTruth": {
          "successCriteria": "Score >= 100",
          "expectedActions": ["keyboard input", "wait for score"],
          "expectedDuration": "< 5 minutes"
        }
      }
    ],
    "validation": [
      {
        "id": "payment-form-validation",
        "task": "Check if the payment form appears after clicking checkout",
        "url": "https://example.com/checkout",
        "groundTruth": {
          "successCriteria": "Payment form visible after checkout click",
          "expectedActions": ["click checkout", "wait for form", "validate form"],
          "expectedDuration": "< 30 seconds"
        }
      }
    ],
    "navigation": [
      {
        "id": "settings-navigation",
        "task": "Navigate to the settings page and change the theme",
        "url": "https://example.com",
        "groundTruth": {
          "successCriteria": "Theme changed in settings",
          "expectedActions": ["navigate to settings", "find theme option", "change theme"],
          "expectedDuration": "< 1 minute"
        }
      }
    ],
    "formFilling": [
      {
        "id": "contact-form",
        "task": "Fill out the contact form with test data",
        "url": "https://example.com/contact",
        "groundTruth": {
          "successCriteria": "Form filled and submitted",
          "expectedActions": ["fill form fields", "submit form"],
          "expectedDuration": "< 1 minute"
        }
      }
    ],
    "exploration": [
      {
        "id": "pricing-exploration",
        "task": "Try to find the pricing page and see what plans are available",
        "url": "https://example.com",
        "groundTruth": {
          "successCriteria": "Pricing page found and plans identified",
          "expectedActions": ["explore navigation", "find pricing link", "read plans"],
          "expectedDuration": "< 2 minutes"
        }
      }
    ]
  }
}
```

### 2. Temporal Validation Dataset

**File**: `evaluation/datasets/temporal-validation.json`

```json
{
  "name": "Temporal Validation",
  "description": "Tasks requiring temporal understanding and validation",
  "testCases": [
    {
      "id": "wait-for-form",
      "task": "Wait for the payment form to appear after clicking checkout",
      "url": "https://example.com/checkout",
      "groundTruth": {
        "expectedWaitTime": "2-5 seconds",
        "validationCriteria": "Form visible and interactive",
        "successRate": "> 80%"
      }
    },
    {
      "id": "score-tracking",
      "task": "Check if the score increases over time during gameplay",
      "url": "https://play2048.co/",
      "groundTruth": {
        "expectedDuration": "30 seconds",
        "validationCriteria": "Score increases over time",
        "successRate": "> 75%"
      }
    }
  ]
}
```

### 3. Exploratory Automation Dataset

**File**: `evaluation/datasets/exploratory-automation.json`

```json
{
  "name": "Exploratory Automation",
  "description": "Tasks requiring exploration and trying different approaches",
  "testCases": [
    {
      "id": "find-settings",
      "task": "Try to find the settings page",
      "url": "https://example.com",
      "groundTruth": {
        "expectedApproaches": ["navigation menu", "user menu", "direct URL"],
        "successCriteria": "Settings page found",
        "successRate": "> 70%"
      }
    },
    {
      "id": "login-exploration",
      "task": "Try different approaches to login",
      "url": "https://example.com/login",
      "groundTruth": {
        "expectedApproaches": ["email/password", "social login", "forgot password"],
        "successCriteria": "Login successful",
        "successRate": "> 60%"
      }
    }
  ]
}
```

## Test Suites (Browser Automation)

### 1. Task Completion Test

**File**: `test/browser-task-completion.test.mjs`

```javascript
import { test } from 'node:test';
import assert from 'node:assert';
import { executeSpec } from '../src/natural-language-specs.mjs';

test('complete browser task via prompt', async () => {
  // Skip if no Playwright
  const playwrightAvailable = existsSync(join(process.cwd(), 'node_modules', '@playwright', 'test'));
  if (!playwrightAvailable) {
    test.skip('Playwright not available');
    return;
  }

  const page = await browser.newPage();
  
  // Test game task
  const gameResult = await executeSpec(page, {
    task: 'Play 2048 and get a score of 100',
    url: 'https://play2048.co/'
  });
  
  assert.ok(gameResult.success, 'Should complete game task');
  assert.ok(gameResult.score >= 100, 'Should achieve target score');
  
  // Test validation task
  const validationResult = await executeSpec(page, {
    task: 'Check if the payment form appears after clicking checkout',
    url: 'https://example.com/checkout'
  });
  
  assert.ok(validationResult.success, 'Should complete validation task');
  assert.ok(validationResult.formVisible, 'Should detect payment form');
});
```

### 2. Real-Time Interaction Test

**File**: `test/real-time-interaction.test.mjs`

```javascript
import { test } from 'node:test';
import assert from 'node:assert';
import { selectModelTier, LatencyAwareBatchOptimizer } from '../src/index.mjs';

test('adaptive Hz based on task type', async () => {
  // Game task: 60Hz
  const gameTier = selectModelTier({ frequency: 60, taskType: 'game' });
  assert.strictEqual(gameTier, 'fast', 'Should select fast tier for games');
  
  // Standard task: 1-10Hz
  const standardTier = selectModelTier({ frequency: 5, taskType: 'standard' });
  assert.ok(['fast', 'balanced'].includes(standardTier), 'Should select appropriate tier for standard tasks');
  
  // Validation task: 0.1-1Hz
  const validationTier = selectModelTier({ frequency: 0.5, taskType: 'validation' });
  assert.ok(['balanced', 'best'].includes(validationTier), 'Should select appropriate tier for validation');
});
```

### 3. Decision-Making and Action Execution Test

**File**: `test/decision-making-action-execution.test.mjs`

```javascript
import { test } from 'node:test';
import assert from 'node:assert';
import { decideGameAction, executeGameAction } from '../src/game-player.mjs';

test('decision-making and action execution', async () => {
  // Skip if no Playwright
  const playwrightAvailable = existsSync(join(process.cwd(), 'node_modules', '@playwright', 'test'));
  if (!playwrightAvailable) {
    test.skip('Playwright not available');
    return;
  }

  const page = await browser.newPage();
  await page.goto('https://play2048.co/');
  
  // Test decision-making
  const gameState = {
    screenshot: await page.screenshot(),
    score: 0
  };
  
  const action = await decideGameAction(gameState, 'maximize score', []);
  assert.ok(action, 'Should decide on an action');
  assert.ok(['keyboard', 'click', 'wait'].includes(action.type), 'Should decide valid action type');
  
  // Test action execution
  await executeGameAction(page, action);
  
  // Verify action executed (page state changed)
  const newScreenshot = await page.screenshot();
  assert.ok(newScreenshot !== gameState.screenshot, 'Action should change page state');
});
```

## Success Report Format (Browser Automation Agent)

```json
{
  "timestamp": "2025-01-27T...",
  "primaryGoals": {
    "taskCompletion": {
      "taskSuccessRate": 0.82,
      "taskDiversity": 0.92,
      "naturalLanguageUnderstanding": 0.87,
      "multiStepTaskCompletion": 0.73,
      "status": "success"
    },
    "realTimeInteraction": {
      "gameHz": 60,
      "gameLatency": 85,
      "standardHz": 5,
      "standardLatency": 800,
      "validationHz": 0.5,
      "status": "success"
    },
    "decisionMaking": {
      "decisionAccuracy": 0.78,
      "actionExecutionSuccess": 0.92,
      "exploratorySuccess": 0.65,
      "errorRecoverySuccess": 0.72,
      "status": "success"
    },
    "temporalUnderstanding": {
      "temporalValidationAccuracy": 0.83,
      "waitAndCheckSuccess": 0.77,
      "stateTrackingAccuracy": 0.74,
      "temporalCoherence": 0.76,
      "status": "success"
    },
    "realWorldBrowserAutomation": {
      "taskCompatibility": 0.91,
      "integrationEase": "excellent",
      "usability": "excellent",
      "reliability": 0.96,
      "status": "success"
    }
  },
  "improvements": {
    "calibrationDegradation": {
      "detectionAccuracy": 0.81,
      "falsePositiveRate": 0.09,
      "status": "success"
    },
    "temporalGraph": {
      "stateTransitionCoherence": 0.76,
      "entityContinuity": 0.82,
      "status": "success"
    },
    "screenshotSelection": {
      "keyframeDetection": 0.83,
      "informationRetention": 0.87,
      "latencyImpact": 42,
      "status": "success"
    }
  },
  "overall": {
    "status": "success",
    "primaryGoalsMet": true,
    "improvementsValidated": true,
    "readyForProduction": true
  }
}
```

## Key Changes from Previous Version

1. **Broader Vision**: Browser automation agent, not just game testing
2. **Task Completion Focus**: Success measured by task completion, not just validation
3. **Adaptive Hz**: Hz varies by task type (60Hz for games, 1-10Hz for standard, 0.1-1Hz for validation)
4. **Decision-Making**: Success includes decision-making and action execution
5. **Exploratory Automation**: Success includes exploration and trying different approaches
6. **Temporal Understanding**: Success includes waiting and validating over time

This refined framework aligns success criteria with the actual macro purpose: **enabling browser automation agents that use VLLM to understand screenshots and complete tasks via prompts/chat interface**.

