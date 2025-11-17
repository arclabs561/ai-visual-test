# Success Criteria Refined: Aligned with Macro Purpose

## Macro Purpose Review

**Primary Goal**: AI-powered visual testing using Vision Language Models (VLLM) for screenshot validation. Semantic visual regression testing that understands UI meaning, not just pixels.

**Primary Use Case**: 60Hz real-time validation for interactive games (Queeraoke, 2048, Snake, etc.)

**Core Value Proposition**:
- Semantic understanding (not pixel-diffing)
- Handles dynamic content gracefully
- Fast feedback when possible (programmatic validators)
- Cost and latency optimized
- Research-backed quality

**What Success Looks Like**:
1. Can validate games at 60Hz with <100ms latency
2. Understands UI semantics correctly (not just pixels)
3. Handles temporal sequences well (gameplay over time)
4. Extracts game state accurately (score, level, position)
5. Validates accessibility effectively
6. Works in real-world game testing scenarios

## Refined Success Criteria

### Part 1: Calibration Degradation Tracking

**Why It Matters for Games**: Long gameplay sequences (100+ frames) can degrade VLLM calibration. We need to detect when confidence drops and adapt.

**Success Metrics (Game-Focused)**:
- **Detection in Real Gameplay**: Detects degradation during actual 60Hz gameplay sequences (>50 frames)
- **False Positive Rate**: <10% false positives during normal gameplay
- **Actionable Recommendations**: When degradation detected, recommendations actually help (reduce sequence length or recalibrate)

**Evaluation**: Test with real game sequences (2048, Snake) where we know degradation occurs (long sequences)

**Threshold**: 
- Detects degradation in >80% of long sequences (>50 frames) where degradation actually occurs
- <10% false positives during normal gameplay

### Part 2: Temporal Graph Representation

**Why It Matters for Games**: Games have state transitions (score changes, level progression, game over). We need to understand these transitions coherently.

**Success Metrics (Game-Focused)**:
- **Game State Coherence**: Correctly identifies coherent state transitions in gameplay (score increasing, level progressing)
- **Entity Continuity**: Tracks game entities (score, board, tiles) across frames correctly
- **Actionable Insights**: Graph recommendations help identify gameplay issues (e.g., "State transition at frame 23 is incoherent - possible bug")

**Evaluation**: Test with real game sequences where state transitions are known (2048 gameplay with score progression)

**Threshold**:
- >70% of known state transitions identified as coherent
- >80% of game entities tracked correctly across frames
- Recommendations identify actual gameplay issues >60% of the time

### Part 3: Screenshot Selection (Context Window Management)

**Why It Matters for Games**: 60Hz gameplay generates 60 screenshots/second. We can't send all to VLLM. Need intelligent selection.

**Success Metrics (Game-Focused)**:
- **Keyframe Detection**: Captures significant game events (score milestones, level changes, game over)
- **Latency Impact**: Selection completes in <50ms (doesn't add significant latency)
- **Information Retention**: Selected screenshots maintain >85% of evaluation accuracy vs. full sequence

**Evaluation**: Test with 60Hz gameplay sequences, measure:
- How many keyframes captured (score milestones, level changes)
- Evaluation accuracy with selected vs. full sequence
- Selection latency

**Threshold**:
- >80% of significant game events captured
- >85% evaluation accuracy with selected screenshots vs. full sequence
- Selection latency <50ms

### Part 4: Counterfactual Testing

**Why It Matters for Games**: Games have visual elements that might be misidentified (e.g., counting tiles, identifying game pieces). We need to ensure VLLM uses visual analysis, not memorized knowledge.

**Success Metrics (Game-Focused)**:
- **Game-Specific Detection**: Detects when VLLM uses memorized knowledge vs. visual analysis for game elements
- **Practical Impact**: Helps identify when game state extraction is unreliable

**Evaluation**: Test with game-specific counterfactuals:
- Game with unusual tile count (contradicts training)
- Game with non-standard visual elements

**Threshold**:
- >80% accuracy detecting memorization vs. visual analysis in game contexts
- Practical impact: Identifies unreliable state extraction >70% of the time

### Part 5: Stratified Capability Testing

**Why It Matters for Games**: Games require both low-level (counting tiles, spatial relationships) and high-level (game state understanding) capabilities. High-level success doesn't guarantee low-level accuracy.

**Success Metrics (Game-Focused)**:
- **Game Capability Gaps**: Identifies when high-level game understanding (score, level) doesn't predict low-level capabilities (tile counting, spatial relationships)
- **Actionable Warnings**: Warnings help identify when game state extraction might be unreliable

**Evaluation**: Test with games where low-level capabilities matter:
- 2048: Tile counting accuracy vs. overall game understanding
- Snake: Spatial relationship understanding vs. game state understanding

**Threshold**:
- >75% accuracy identifying capability gaps in game contexts
- Warnings identify unreliable state extraction >70% of the time

### Part 6: Baseline Validation

**Why It Matters for Games**: Game state extraction must rely on visual analysis, not text-only reasoning. We need to ensure benchmarks require visual input.

**Success Metrics (Game-Focused)**:
- **Visual Discriminative Power**: Game state extraction accuracy drops >30% when visual input is removed/corrupted
- **Game-Specific Validation**: Validates that game state extraction requires visual analysis

**Evaluation**: Test with game screenshots:
- Normal screenshot: Extract game state (score, level, board state)
- Corrupted screenshot: Attempt same extraction
- Measure accuracy drop

**Threshold**:
- >30% accuracy drop when visual input removed/corrupted
- Validates that game state extraction requires visual analysis

### Part 7: Enhanced Accessibility (Hybrid)

**Why It Matters for Games**: Games should be accessible. Hybrid approach (programmatic + VLLM) catches more issues than programmatic alone.

**Success Metrics (Game-Focused)**:
- **Game Accessibility Issues**: Detects game-specific accessibility issues (keyboard navigation, contrast in game UI, screen reader compatibility)
- **Practical Impact**: Finds real accessibility issues in games that programmatic checks miss

**Evaluation**: Test with game screenshots:
- Known accessibility issues in games
- Compare programmatic vs. hybrid detection

**Threshold**:
- >20% more accessibility issues detected than programmatic-only
- >70% of game-specific accessibility issues detected (keyboard nav, contrast, screen reader)

## Overall Success Criteria (Macro Purpose Alignment)

### 1. 60Hz Real-Time Validation Works

**Primary Goal**: Can validate games at 60Hz with <100ms latency

**Success Metrics**:
- **Latency**: <100ms per validation at 60Hz
- **Throughput**: Can handle 60 validations/second
- **Reliability**: >95% of validations complete within latency budget

**Evaluation**: 
- Run actual 60Hz gameplay validation
- Measure latency distribution
- Verify throughput

**Threshold**: 
- 95th percentile latency <100ms
- Can sustain 60 validations/second
- >95% success rate

### 2. Semantic Understanding Works

**Primary Goal**: Understands UI semantics correctly (not just pixels)

**Success Metrics**:
- **Game State Extraction**: Accurately extracts game state (score, level, board state) from screenshots
- **Semantic Validation**: Correctly validates game semantics (playability, accessibility, fun) not just visual appearance
- **Dynamic Content Handling**: Handles dynamic game content (scores, timers, user data) gracefully

**Evaluation**: 
- Test with real game screenshots
- Measure state extraction accuracy
- Measure semantic validation accuracy

**Threshold**:
- >85% accuracy extracting game state from screenshots
- >80% accuracy in semantic validation (playability, accessibility, fun)
- Handles dynamic content without false positives

### 3. Temporal Sequences Work

**Primary Goal**: Handles temporal sequences well (gameplay over time)

**Success Metrics**:
- **Temporal Coherence**: Correctly identifies coherent gameplay sequences
- **State Transitions**: Accurately tracks state transitions over time (score progression, level changes)
- **Temporal Validation**: Validates gameplay over time, not just single frames

**Evaluation**: 
- Test with real gameplay sequences
- Measure temporal coherence
- Measure state transition accuracy

**Threshold**:
- >70% of gameplay sequences identified as coherent
- >80% accuracy tracking state transitions
- Temporal validation provides actionable insights >60% of the time

### 4. Real-World Game Testing Works

**Primary Goal**: Works in real-world game testing scenarios

**Success Metrics**:
- **Game Compatibility**: Works with real games (2048, Snake, Queeraoke)
- **Integration**: Integrates well with Playwright test suites
- **Usability**: Easy to use for game testing workflows

**Evaluation**: 
- Test with real games
- Measure integration ease
- Measure usability

**Threshold**:
- Works with >90% of tested games
- Integration requires <10 lines of code
- Usability: Can set up game testing in <5 minutes

## Evaluation Datasets (Game-Focused)

### 1. Real Game Sequences

**File**: `evaluation/datasets/real-game-sequences.json`

```json
{
  "name": "Real Game Sequences",
  "description": "Actual gameplay sequences from real games",
  "games": [
    {
      "id": "2048",
      "name": "2048 Game",
      "screenshots": ["2048-frame-1.png", "2048-frame-2.png", ...],
      "groundTruth": {
        "scoreProgression": [0, 4, 8, 16, 32],
        "levelChanges": [10, 20, 30],
        "gameOver": 50,
        "stateTransitions": [
          { "frame": 10, "type": "score_milestone", "value": 100 },
          { "frame": 20, "type": "level_change", "value": 2 }
        ]
      }
    },
    {
      "id": "snake",
      "name": "Snake Game",
      "screenshots": ["snake-frame-1.png", "snake-frame-2.png", ...],
      "groundTruth": {
        "scoreProgression": [0, 10, 20, 30],
        "gameOver": 40,
        "spatialRelationships": [
          { "frame": 5, "snakePosition": [10, 10], "foodPosition": [20, 20] }
        ]
      }
    }
  ]
}
```

### 2. Game State Extraction Dataset

**File**: `evaluation/datasets/game-state-extraction.json`

```json
{
  "name": "Game State Extraction",
  "description": "Screenshots with known game state",
  "testCases": [
    {
      "id": "2048-score-100",
      "game": "2048",
      "screenshot": "2048-score-100.png",
      "groundTruth": {
        "score": 100,
        "level": 1,
        "boardState": [[2, 4], [4, 8], ...],
        "gameOver": false
      }
    }
  ]
}
```

### 3. Game Accessibility Dataset

**File**: `evaluation/datasets/game-accessibility.json`

```json
{
  "name": "Game Accessibility",
  "description": "Game screenshots with known accessibility issues",
  "testCases": [
    {
      "id": "low-contrast-game",
      "game": "custom",
      "screenshot": "low-contrast-game.png",
      "groundTruth": {
        "issues": ["low contrast", "keyboard navigation missing"],
        "programmaticIssues": ["contrast ratio 3.2:1"],
        "semanticIssues": ["text difficult to read in game context"]
      }
    }
  ]
}
```

## Test Suites (Game-Focused)

### 1. 60Hz Validation Test

**File**: `test/60hz-validation.test.mjs`

```javascript
import { test } from 'node:test';
import assert from 'node:assert';
import { LatencyAwareBatchOptimizer, selectModelTier, selectProvider } from '../src/index.mjs';

test('60Hz validation meets latency requirements', async () => {
  const tier = selectModelTier({ frequency: 60 });
  assert.strictEqual(tier, 'fast', 'Should select fast tier for 60Hz');
  
  const provider = selectProvider({ speed: 'ultra-fast', env: process.env });
  assert.ok(provider, 'Should select a provider');
  
  const optimizer = new LatencyAwareBatchOptimizer({
    maxConcurrency: 1,
    batchSize: 5
  });
  
  // Simulate 60Hz validation
  const latencies = [];
  for (let i = 0; i < 60; i++) {
    const start = Date.now();
    await optimizer.addRequest(
      `frame-${i}.png`,
      'Is the game playable?',
      { frequency: 60 },
      50 // 50ms max latency
    );
    const latency = Date.now() - start;
    latencies.push(latency);
  }
  
  const p95 = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];
  assert.ok(p95 < 100, `95th percentile latency should be <100ms, got ${p95}ms`);
});
```

### 2. Game State Extraction Test

**File**: `test/game-state-extraction.test.mjs`

```javascript
import { test } from 'node:test';
import assert from 'node:assert';
import { validateScreenshot } from '../src/index.mjs';

test('extract game state from screenshot', async () => {
  // Skip if no API key
  if (!process.env.GEMINI_API_KEY) {
    test.skip('No API key configured');
    return;
  }

  const result = await validateScreenshot(
    'evaluation/datasets/screenshots/2048-score-100.png',
    'Extract game state: score, level, board state, game over status',
    {
      testType: 'game-state-extraction'
    }
  );

  // Parse extracted state from reasoning
  const score = extractScore(result.reasoning);
  assert.ok(score === 100, `Should extract score 100, got ${score}`);
  
  const gameOver = extractGameOver(result.reasoning);
  assert.ok(gameOver === false, 'Should extract game over status');
});
```

### 3. Temporal Gameplay Test

**File**: `test/temporal-gameplay.test.mjs`

```javascript
import { test } from 'node:test';
import assert from 'node:assert';
import { buildTemporalGraph } from '../src/temporal.mjs';

test('temporal graph identifies game state transitions', async () => {
  // Create notes from gameplay sequence
  const notes = [
    { timestamp: 1000, score: 0, gameState: { score: 0, level: 1 } },
    { timestamp: 2000, score: 4, gameState: { score: 4, level: 1 } },
    { timestamp: 3000, score: 8, gameState: { score: 8, level: 1 } },
    { timestamp: 4000, score: 16, gameState: { score: 16, level: 2 } }, // Level change
    { timestamp: 5000, score: 32, gameState: { score: 32, level: 2 } }
  ];
  
  const graph = buildTemporalGraph(notes);
  
  // Should identify level change as significant transition
  const levelChangeEdge = graph.graph.edges.find(e => 
    e.stateContinuity < 0.7 // Lower continuity indicates state change
  );
  
  assert.ok(levelChangeEdge, 'Should identify level change as significant transition');
});
```

## Success Report Format (Game-Focused)

```json
{
  "timestamp": "2025-01-27T...",
  "primaryGoals": {
    "60hzValidation": {
      "p95Latency": 85,
      "throughput": 60,
      "successRate": 0.97,
      "status": "success"
    },
    "semanticUnderstanding": {
      "stateExtractionAccuracy": 0.87,
      "semanticValidationAccuracy": 0.82,
      "dynamicContentHandling": "pass",
      "status": "success"
    },
    "temporalSequences": {
      "coherenceAccuracy": 0.73,
      "stateTransitionAccuracy": 0.81,
      "actionableInsights": 0.65,
      "status": "success"
    },
    "realWorldGameTesting": {
      "gameCompatibility": 0.92,
      "integrationEase": "excellent",
      "usability": "excellent",
      "status": "success"
    }
  },
  "improvements": {
    "calibrationDegradation": {
      "detectionAccuracy": 0.82,
      "falsePositiveRate": 0.08,
      "status": "success"
    },
    "temporalGraph": {
      "gameStateCoherence": 0.75,
      "entityContinuity": 0.83,
      "status": "success"
    },
    "screenshotSelection": {
      "keyframeDetection": 0.85,
      "informationRetention": 0.88,
      "latencyImpact": 35,
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

1. **Game-Focused Metrics**: All metrics now relate to actual game testing scenarios
2. **60Hz Validation**: Primary success criterion is 60Hz validation with <100ms latency
3. **Real Game Sequences**: Evaluation uses actual game sequences, not abstract benchmarks
4. **Practical Impact**: Success measured by practical impact on game testing, not academic metrics
5. **Integration Focus**: Success includes integration ease and usability for real workflows

## Next Steps

1. **Create Real Game Datasets**: Capture actual gameplay sequences from 2048, Snake, etc.
2. **Implement 60Hz Tests**: Create tests that validate 60Hz capability
3. **Measure Real Performance**: Run actual 60Hz validation and measure latency
4. **Validate Game State Extraction**: Test with real game screenshots
5. **Test Real-World Integration**: Validate integration with Playwright test suites

This refined framework aligns success criteria with the actual macro purpose: enabling 60Hz real-time game validation with semantic understanding.

