# Refined Implementation Plan: Building on Existing Code

## Executive Summary

After reviewing the codebase, this plan refines our solutions to **extend existing implementations** rather than create new ones. We build on:
- `temporal-note-pruner.mjs` (pruning, propagation)
- `human-validation-manager.mjs` (calibration)
- `temporal-preprocessor.mjs` (activity detection, caching)
- `prompt-composer.mjs` (already has `maxTemporalNotes`!)
- `SequentialDecisionContext` (sequential adaptation)

## Part 1: Calibration Degradation Tracking

### Current State
- ✅ `HumanValidationManager` has calibration cache and `applyCalibration()`
- ✅ Tracks calibration across judgments
- ❌ **Missing**: Sequence-level degradation detection

### Solution: Extend HumanValidationManager

**File**: `src/human-validation-manager.mjs`

**Add to existing class**:

```javascript
/**
 * Track calibration degradation over screenshot sequences
 * 
 * @param {number} sequenceIndex - Index in sequence
 * @param {Object} result - Validation result
 * @returns {Object} Degradation status
 */
trackSequenceCalibration(sequenceIndex, result) {
  if (!this.sequenceHistory) {
    this.sequenceHistory = [];
  }

  const entry = {
    index: sequenceIndex,
    timestamp: Date.now(),
    confidence: result.confidence || 0.5,
    uncertainty: result.uncertainty || 0.5,
    score: result.score,
    logprobs: result.logprobs
  };

  this.sequenceHistory.push(entry);

  // Detect degradation (compare recent vs early)
  if (this.sequenceHistory.length >= 5) {
    const recent = this.sequenceHistory.slice(-5);
    const early = this.sequenceHistory.slice(0, 5);
    
    const recentAvgConfidence = recent.reduce((sum, e) => sum + e.confidence, 0) / recent.length;
    const earlyAvgConfidence = early.reduce((sum, e) => sum + e.confidence, 0) / early.length;
    
    const degradation = earlyAvgConfidence - recentAvgConfidence;
    const degradationThreshold = 0.15; // 15% drop
    
    if (degradation > degradationThreshold) {
      return {
        degraded: true,
        degradation,
        recommendation: 'recalibrate_or_reduce_sequence',
        suggestedAction: 'Use temporal graph representation or reduce sequence length'
      };
    }
  }

  return { degraded: false };
}

/**
 * Get calibration quality metrics for sequence
 */
getSequenceCalibrationMetrics() {
  if (!this.sequenceHistory || this.sequenceHistory.length < 2) {
    return { quality: 'unknown', recommendation: 'insufficient_data' };
  }

  const confidences = this.sequenceHistory.map(e => e.confidence);
  const variance = this.calculateVariance(confidences);
  const trend = this.calculateTrend(confidences);

  if (variance > 0.1 && trend < -0.05) {
    return {
      quality: 'degrading',
      variance,
      trend,
      recommendation: 'recalibrate_or_reduce_sequence'
    };
  }

  return {
    quality: variance < 0.05 ? 'stable' : 'variable',
    variance,
    trend
  };
}

calculateVariance(values) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
}

calculateTrend(values) {
  if (values.length < 2) return 0;
  const firstHalf = values.slice(0, Math.floor(values.length / 2));
  const secondHalf = values.slice(Math.floor(values.length / 2));
  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  return (secondAvg - firstAvg) / firstAvg;
}
```

**Integration point**: In `judge.mjs` after collecting VLLM judgment (around line 360):

```javascript
// Track sequence calibration if in temporal context
if (context.temporalNotes || context.sequenceIndex !== undefined) {
  const degradation = manager.trackSequenceCalibration(
    context.sequenceIndex || 0,
    validationResult
  );
  
  if (degradation.degraded) {
    validationResult.calibrationDegraded = true;
    validationResult.calibrationDegradation = degradation.degradation;
    validationResult.calibrationRecommendation = degradation.recommendation;
  }
}
```

## Part 2: Temporal Graph Representation

### Current State
- ✅ `aggregateTemporalNotes()` creates windows with coherence
- ✅ `aggregateMultiScale()` aggregates at multiple scales
- ❌ **Missing**: Explicit graph structure for entity/state continuity

### Solution: Extend temporal.mjs

**File**: `src/temporal.mjs`

**Add new function** (don't modify existing):

```javascript
/**
 * Build temporal graph representation for better coherence
 * Extends aggregation with explicit entity/state tracking
 * 
 * @param {import('./index.mjs').TemporalNote[]} notes - Temporal notes
 * @param {Object} options - Graph options
 * @returns {Object} Temporal graph with nodes, edges, entities
 */
export function buildTemporalGraph(notes, options = {}) {
  const aggregated = aggregateTemporalNotes(notes, options);
  
  // Build graph structure
  const nodes = aggregated.windows.map((window, index) => ({
    id: `window_${index}`,
    index,
    startTime: window.startTime,
    endTime: window.endTime,
    avgScore: window.avgScore,
    notes: window.notes,
    entities: extractEntities(window.notes),
    state: extractState(window.notes)
  }));

  const edges = [];
  for (let i = 1; i < nodes.length; i++) {
    const from = nodes[i - 1];
    const to = nodes[i];
    
    const stateContinuity = calculateStateContinuity(from.state, to.state);
    const entityContinuity = calculateEntityContinuity(from.entities, to.entities);
    
    edges.push({
      from: from.id,
      to: to.id,
      timeDelta: to.startTime - from.startTime,
      stateContinuity,
      entityContinuity,
      coherence: (stateContinuity + entityContinuity) / 2
    });
  }

  // Track entities across time
  const entityTracking = trackEntities(nodes);

  return {
    ...aggregated, // Include all aggregation results
    graph: {
      nodes,
      edges,
      entities: entityTracking,
      averageCoherence: edges.reduce((sum, e) => sum + e.coherence, 0) / edges.length,
      lowCoherenceEdges: edges.filter(e => e.coherence < 0.5).length
    },
    recommendations: generateGraphRecommendations(edges, entityTracking)
  };
}

function extractEntities(notes) {
  // Simple extraction (could be enhanced with VLLM)
  const entities = new Set();
  for (const note of notes) {
    // Extract from observation/reasoning
    const text = (note.observation || note.reasoning || '').toLowerCase();
    const matches = text.match(/\b(button|link|image|form|input|score|level)\b/g);
    if (matches) {
      matches.forEach(m => entities.add(m));
    }
  }
  return Array.from(entities);
}

function extractState(notes) {
  const scores = notes.map(n => n.score || n.gameState?.score || 0);
  const issues = notes.flatMap(n => n.issues || []);
  return {
    avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
    scoreVariance: calculateVariance(scores),
    issues: [...new Set(issues)]
  };
}

function calculateStateContinuity(state1, state2) {
  const scoreDiff = Math.abs(state1.avgScore - state2.avgScore);
  const scoreContinuity = 1.0 - Math.min(1.0, scoreDiff / 10.0);
  
  const issues1 = new Set(state1.issues);
  const issues2 = new Set(state2.issues);
  const intersection = new Set([...issues1].filter(x => issues2.has(x)));
  const union = new Set([...issues1, ...issues2]);
  const issueContinuity = union.size > 0 ? intersection.size / union.size : 1.0;
  
  return (scoreContinuity + issueContinuity) / 2;
}

function calculateEntityContinuity(entities1, entities2) {
  if (entities1.length === 0 && entities2.length === 0) return 1.0;
  if (entities1.length === 0 || entities2.length === 0) return 0.0;
  
  const set1 = new Set(entities1);
  const set2 = new Set(entities2);
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return union.size > 0 ? intersection.size / union.size : 0.0;
}

function trackEntities(nodes) {
  const entityMap = new Map();
  
  for (const node of nodes) {
    for (const entity of node.entities) {
      if (!entityMap.has(entity)) {
        entityMap.set(entity, {
          firstSeen: node.index,
          lastSeen: node.index,
          appearances: [node.index]
        });
      } else {
        const tracking = entityMap.get(entity);
        tracking.lastSeen = node.index;
        tracking.appearances.push(node.index);
      }
    }
  }
  
  // Calculate continuity for each entity
  for (const [entity, tracking] of entityMap.entries()) {
    const gaps = [];
    for (let i = 1; i < tracking.appearances.length; i++) {
      gaps.push(tracking.appearances[i] - tracking.appearances[i-1]);
    }
    const avgGap = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 1;
    tracking.continuity = avgGap === 1 ? 1.0 : Math.max(0, 1.0 - (avgGap - 1) * 0.2);
  }
  
  return Object.fromEntries(entityMap);
}

function generateGraphRecommendations(edges, entities) {
  const recommendations = [];
  const avgCoherence = edges.reduce((sum, e) => sum + e.coherence, 0) / edges.length;
  
  if (avgCoherence < 0.6) {
    recommendations.push('Low temporal coherence detected. Consider reducing sequence length or increasing capture frequency.');
  }
  
  const lowCoherenceCount = edges.filter(e => e.coherence < 0.5).length;
  if (lowCoherenceCount > edges.length * 0.3) {
    recommendations.push('Many low-coherence transitions. Validate that screenshots represent continuous gameplay.');
  }
  
  return recommendations;
}

function calculateVariance(values) {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
}
```

**Integration**: Use in `testGameplay` when `captureTemporal` is true:

```javascript
// In convenience.mjs testGameplay function
if (captureTemporal && temporalScreenshots.length > 0) {
  // ... existing code ...
  
  // NEW: Build temporal graph for better coherence
  const { buildTemporalGraph } = await import('./temporal.mjs');
  const notes = temporalScreenshots.map((frame, index) => ({
    timestamp: frame.timestamp,
    elapsed: frame.elapsed || index * (1000 / fps),
    screenshotPath: frame.path,
    step: `gameplay_frame_${index}`
  }));
  
  const temporalGraph = buildTemporalGraph(notes, {
    windowSize: 5000,
    decayFactor: 0.9
  });
  
  result.temporalGraph = temporalGraph.graph;
  result.temporalRecommendations = temporalGraph.recommendations;
}
```

## Part 3: Screenshot Selection (Context Window Management)

### Current State
- ✅ `prompt-composer.mjs` has `maxTemporalNotes` option (line 110)
- ✅ `selectTopWeightedNotes()` in `temporal-note-pruner.mjs`
- ❌ **Missing**: Intelligent screenshot selection (not just note selection)

### Solution: Extend temporal-note-pruner.mjs

**File**: `src/temporal-note-pruner.mjs`

**Add new function**:

```javascript
/**
 * Select representative screenshots from sequence for context window management
 * 
 * @param {Array<{path: string, timestamp: number, elapsed?: number}>} screenshots - Screenshot array
 * @param {Array<Object>} evaluations - Corresponding evaluation results
 * @param {Object} options - Selection options
 * @param {number} [options.maxScreenshots=10] - Maximum screenshots to select
 * @param {string} [options.strategy='diversity'] - 'diversity', 'keyframes', 'uniform'
 * @returns {Array} Selected screenshots
 */
export function selectRepresentativeScreenshots(screenshots, evaluations = [], options = {}) {
  const {
    maxScreenshots = 10,
    strategy = 'diversity'
  } = options;

  if (screenshots.length <= maxScreenshots) {
    return screenshots;
  }

  switch (strategy) {
    case 'keyframes':
      return selectKeyframes(screenshots, evaluations, maxScreenshots);
    case 'uniform':
      return selectUniform(screenshots, maxScreenshots);
    case 'diversity':
    default:
      return selectByDiversity(screenshots, evaluations, maxScreenshots);
  }
}

function selectKeyframes(screenshots, evaluations, maxScreenshots) {
  const keyframes = [screenshots[0]]; // Always include first

  // Detect significant state changes
  for (let i = 1; i < evaluations.length; i++) {
    const prevScore = evaluations[i-1]?.score || 0;
    const currScore = evaluations[i]?.score || 0;
    const scoreChange = Math.abs(currScore - prevScore);

    if (scoreChange > 2.0) { // Significant change threshold
      keyframes.push(screenshots[i]);
    }
  }

  keyframes.push(screenshots[screenshots.length - 1]); // Always include last

  // If still too many, sample uniformly
  if (keyframes.length > maxScreenshots) {
    return sampleUniform(keyframes, maxScreenshots);
  }

  return keyframes;
}

function selectByDiversity(screenshots, evaluations, maxScreenshots) {
  const selected = [screenshots[0]]; // Always include first
  const remaining = screenshots.slice(1, -1);
  const last = screenshots[screenshots.length - 1];

  // Calculate score variance for diversity
  const scores = evaluations.map(e => e.score || 0).filter(s => s !== null);
  if (scores.length === 0) {
    return selectUniform(screenshots, maxScreenshots);
  }

  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.map(s => Math.abs(s - mean));

  // Select indices with highest variance (most different states)
  const indexed = variance.map((v, i) => ({ index: i, variance: v }));
  indexed.sort((a, b) => b.variance - a.variance);

  const diverseIndices = indexed.slice(0, maxScreenshots - 2).map(item => item.index);
  selected.push(...diverseIndices.map(i => remaining[i]));
  selected.push(last);

  return selected.slice(0, maxScreenshots);
}

function selectUniform(screenshots, maxScreenshots) {
  const step = Math.floor(screenshots.length / maxScreenshots);
  const selected = [];

  for (let i = 0; i < screenshots.length; i += step) {
    selected.push(screenshots[i]);
    if (selected.length >= maxScreenshots) break;
  }

  // Always include last
  if (selected[selected.length - 1] !== screenshots[screenshots.length - 1]) {
    selected[selected.length - 1] = screenshots[screenshots.length - 1];
  }

  return selected;
}

function sampleUniform(array, count) {
  const step = Math.floor(array.length / count);
  const sampled = [];
  for (let i = 0; i < array.length; i += step) {
    sampled.push(array[i]);
    if (sampled.length >= count) break;
  }
  return sampled;
}
```

**Integration**: In `testGameplay` before passing to prompt composer:

```javascript
// In convenience.mjs testGameplay function
if (captureTemporal && temporalScreenshots.length > 0) {
  // ... existing code ...
  
  // NEW: Select representative screenshots if sequence is long
  const { selectRepresentativeScreenshots } = await import('./temporal-note-pruner.mjs');
  
  // Evaluate all screenshots first
  const evaluations = [];
  for (const screenshot of temporalScreenshots) {
    const eval = await validateScreenshot(screenshot.path, prompt, {
      testType: 'gameplay-temporal',
      sequenceIndex: evaluations.length
    });
    evaluations.push(eval);
  }
  
  // Select representative subset
  const selectedScreenshots = selectRepresentativeScreenshots(
    temporalScreenshots,
    evaluations,
    { maxScreenshots: 10, strategy: 'keyframes' }
  );
  
  result.selectedScreenshots = selectedScreenshots;
  result.totalScreenshots = temporalScreenshots.length;
  result.selectedCount = selectedScreenshots.length;
}
```

## Part 4: Counterfactual Testing

### Current State
- ❌ **Missing**: No counterfactual testing framework

### Solution: New file (standalone utility)

**File**: `src/counterfactual-tester.mjs` (NEW)

```javascript
/**
 * Counterfactual Testing for Memorization Detection
 * 
 * Tests whether VLLMs use memorized knowledge vs. visual analysis
 */
import { validateScreenshot } from './index.mjs';

/**
 * Test if VLLM counts visible elements vs. retrieving memorized knowledge
 */
export async function testMemorization(imagePath, objectType, property, expectedMemorized, actualVisible, options = {}) {
  const prompt = `How many ${property} does this ${objectType} have? ` +
    `Count only the ${property} that are VISIBLE in the image. ` +
    `Do not use your knowledge about ${objectType}s - only count what you see.`;

  const result = await validateScreenshot(imagePath, prompt, {
    testType: 'counterfactual-memorization',
    enableUncertaintyReduction: true,
    ...options
  });

  const extractedCount = extractCount(result.reasoning);
  
  return {
    extractedCount,
    expectedMemorized,
    actualVisible,
    isMemorizing: extractedCount === expectedMemorized && extractedCount !== actualVisible,
    isAnalyzing: extractedCount === actualVisible,
    confidence: result.confidence,
    recommendation: extractedCount === expectedMemorized 
      ? 'Model appears to be using memorized knowledge. Use more explicit counting instructions.'
      : 'Model appears to be analyzing visual content.'
  };
}

function extractCount(reasoning) {
  const match = reasoning?.match(/(\d+)\s*(?:legs?|arms?|eyes?|items?|objects?)/i);
  return match ? parseInt(match[1]) : null;
}

/**
 * Generate counterfactual test suite
 */
export function generateCounterfactualTests() {
  return [
    {
      description: '5-legged dog (contradicts training: dogs have 4 legs)',
      objectType: 'dog',
      property: 'legs',
      expectedMemorized: 4,
      actualVisible: 5
    },
    {
      description: 'Touching circles that appear separate',
      objectType: 'circles',
      property: 'touching',
      expectedMemorized: false,
      actualVisible: true
    }
  ];
}
```

**Test file**: `test/counterfactual-memorization.test.mjs` (NEW)

```javascript
import { test } from 'node:test';
import assert from 'node:assert';
import { testMemorization } from '../src/counterfactual-tester.mjs';

test('detect memorization vs visual analysis', async () => {
  // Skip if no API key
  if (!process.env.GEMINI_API_KEY) {
    test.skip('No API key configured');
    return;
  }

  // This would require actual counterfactual test images
  // For now, test the function structure
  const result = await testMemorization(
    'test-images/5-legged-dog.png', // Would need to create
    'dog',
    'legs',
    4, // Expected memorized
    5  // Actual visible
  );

  assert.ok(!result.isMemorizing, 'Should analyze visual content, not use memorized knowledge');
  assert.strictEqual(result.extractedCount, 5, 'Should count 5 visible legs');
});
```

## Part 5: Stratified Capability Testing

### Current State
- ❌ **Missing**: No explicit stratified testing

### Solution: New utility function

**File**: `src/capability-stratifier.mjs` (NEW)

```javascript
/**
 * Stratified Capability Testing
 * 
 * Tests low/mid/high-level visual capabilities separately
 */
import { validateScreenshot } from './index.mjs';

const CAPABILITY_LEVELS = {
  low: [
    { task: 'counting', description: 'Count visible objects in the image' },
    { task: 'spatial', description: 'Determine spatial relationships between objects' },
    { task: 'orientation', description: 'Identify object orientation and direction' }
  ],
  mid: [
    { task: 'texture', description: 'Identify texture properties and patterns' },
    { task: 'continuity', description: 'Detect continuity in visual patterns' }
  ],
  high: [
    { task: 'object-recognition', description: 'Recognize and identify objects' },
    { task: 'scene-understanding', description: 'Understand scene context and meaning' }
  ]
};

/**
 * Test capabilities at each level
 */
export async function testCapabilities(screenshotPath, basePrompt, options = {}) {
  const results = {
    low: {},
    mid: {},
    high: {}
  };

  // Test each level
  for (const [level, capabilities] of Object.entries(CAPABILITY_LEVELS)) {
    for (const capability of capabilities) {
      const testPrompt = `${basePrompt}\n\nSpecifically test: ${capability.description}`;
      const result = await validateScreenshot(screenshotPath, testPrompt, {
        testType: `capability-${capability.task}-${level}`,
        ...options
      });
      results[level][capability.task] = result;
    }
  }

  // Calculate level-specific accuracies
  const accuracy = {
    low: calculateLevelAccuracy(results.low),
    mid: calculateLevelAccuracy(results.mid),
    high: calculateLevelAccuracy(results.high)
  };

  return {
    results,
    accuracy,
    recommendation: generateRecommendation(accuracy)
  };
}

function calculateLevelAccuracy(levelResults) {
  const scores = Object.values(levelResults)
    .map(r => r.score)
    .filter(s => s !== null);
  
  if (scores.length === 0) return 0;
  return scores.reduce((a, b) => a + b, 0) / scores.length / 10; // Normalize to 0-1
}

function generateRecommendation(accuracy) {
  const recommendations = [];

  if (accuracy.low < 0.7 && accuracy.high >= 0.9) {
    recommendations.push('WARNING: High-level performance does not predict low-level capabilities. Low-level tests are failing despite high-level success.');
  }

  if (accuracy.low < accuracy.mid && accuracy.mid < accuracy.high) {
    recommendations.push('Capability gap detected: Lower-level capabilities are weaker than higher-level. Consider specialized training for low-level tasks.');
  }

  return recommendations;
}
```

## Part 6: Baseline Validation

### Current State
- ❌ **Missing**: No baseline validation

### Solution: New utility function

**File**: `src/baseline-validator.mjs` (NEW)

```javascript
/**
 * Baseline Validation for Visual Discriminative Power
 * 
 * Ensures benchmarks require visual input (accuracy drops without images)
 */
import { validateScreenshot } from './index.mjs';

/**
 * Test visual discriminative power
 */
export async function testVisualDiscriminativePower(testCases, options = {}) {
  const results = [];

  for (const testCase of testCases) {
    // Test with normal image
    const normalResult = await validateScreenshot(testCase.imagePath, testCase.prompt, {
      testType: 'baseline-normal',
      ...options
    });

    // Test with corrupted image (placeholder - would need image processing)
    // For now, we'll test with a different prompt that doesn't require visual input
    const textOnlyPrompt = testCase.prompt + ' (Answer based on general knowledge only, ignore the image)';
    const textOnlyResult = await validateScreenshot(testCase.imagePath, textOnlyPrompt, {
      testType: 'baseline-text-only',
      ...options
    });

    const discriminativePower = {
      normalAccuracy: normalResult.score / 10,
      textOnlyAccuracy: textOnlyResult.score / 10,
      visualRequired: (normalResult.score - textOnlyResult.score) / 10 > 0.3, // 30% drop required
      drop: (normalResult.score - textOnlyResult.score) / 10
    };

    results.push({
      testCase: testCase.description || testCase.prompt,
      ...discriminativePower,
      recommendation: generateRecommendation(discriminativePower)
    });
  }

  return results;
}

function generateRecommendation(discriminativePower) {
  if (!discriminativePower.visualRequired) {
    return 'WARNING: Benchmark does not require visual input. Accuracy should drop >30% without visual analysis.';
  }

  return 'Benchmark has good visual discriminative power.';
}
```

## Part 7: Enhanced Accessibility (Hybrid)

### Current State
- ✅ `AccessibilityValidator` exists in `src/validators/accessibility-validator.mjs`
- ❌ **Missing**: Hybrid approach combining programmatic + VLLM

### Solution: Extend AccessibilityValidator

**File**: `src/validators/accessibility-validator.mjs`

**Add new method to existing class**:

```javascript
/**
 * Hybrid accessibility validation (programmatic + VLLM semantic)
 * 
 * @param {Page} page - Playwright page
 * @param {string} screenshotPath - Screenshot path
 * @param {Object} options - Validation options
 * @returns {Promise<Object>} Hybrid validation result
 */
async validateHybrid(page, screenshotPath, options = {}) {
  // Fast programmatic checks
  const programmatic = await this.validateSmart(page, {
    minContrast: options.minContrast || 4.5,
    checkAltText: true,
    checkKeyboardNav: true,
    checkSemanticHTML: true
  });

  // VLLM semantic evaluation
  const { validateScreenshot } = await import('../index.mjs');
  const semantic = await validateScreenshot(screenshotPath,
    `Evaluate WCAG 2.1 AA compliance. Check:
    - Contrast ratios meet requirements (4.5:1 for normal text, 3:1 for large text)
    - Keyboard navigation works correctly
    - Alt text meaningfully describes images (not just "image" or "photo")
    - Semantic HTML structure is correct
    - Form labels are clear and descriptive
    - Error messages are understandable
    - Focus indicators are visible`,
    {
      testType: 'accessibility-semantic',
      enableUncertaintyReduction: true,
      ...options
    }
  );

  // Combine results
  const allIssues = [...(programmatic.issues || [])];
  
  // Add semantic issues that programmatic checks missed
  for (const issue of semantic.issues || []) {
    if (!allIssues.some(i => i.toLowerCase().includes(issue.toLowerCase().substring(0, 10)))) {
      allIssues.push(`[Semantic] ${issue}`);
    }
  }

  return {
    programmatic,
    semantic,
    combined: {
      totalIssues: allIssues.length,
      issues: allIssues,
      score: semantic.score, // Use semantic score as primary
      confidence: semantic.confidence
    },
    recommendations: this.generateHybridRecommendations(programmatic, semantic)
  };
}

generateHybridRecommendations(programmatic, semantic) {
  const recommendations = [];

  if (programmatic.failed > 0 && semantic.score >= 8) {
    recommendations.push('Programmatic checks found issues that semantic evaluation missed. Review both results.');
  }

  if (programmatic.failed === 0 && semantic.score < 7) {
    recommendations.push('Semantic evaluation found issues that programmatic checks missed. This is expected - semantic evaluation catches contextual problems.');
  }

  if (semantic.confidence && semantic.confidence < 0.7) {
    recommendations.push('Low confidence in semantic evaluation. Consider manual review or self-consistency check.');
  }

  return recommendations;
}
```

## Success Criteria

**See `docs/SUCCESS_CRITERIA_FINAL.md` for research-informed browser automation agent success metrics.**

**Macro Purpose**: AI-powered browser automation agent that uses VLLM to understand screenshots and complete tasks in browsers via prompts/chat interface.

**Primary Success Criteria** (Research-Informed):
1. **Task Completion**: >80% task success rate, >85% intent recognition, <15% hallucination rate
2. **Real-Time Interaction**: Adaptive Hz (60Hz/<100ms for games, 1-10Hz/<1s for standard, 0.1-1Hz for validation)
3. **Decision-Making & Action Execution**: >75% decision accuracy, >90% action execution, >80% explainability
4. **Temporal Understanding**: >80% temporal validation, >75% wait-and-check, >80% context retention
5. **User Experience**: >70% deflection rate, <20% escalation, >4.0/5.0 CSAT, >60% reuse rate

**Improvement Success Criteria** (Browser Automation Context):
- **Calibration Degradation**: >80% detection in long automation sessions, <10% false positives
- **Temporal Graph**: >75% state transition coherence, >80% entity continuity
- **Screenshot Selection**: >80% keyframe detection (page loads, form submissions), >85% information retention, <50ms latency
- **Counterfactual Testing**: >80% accuracy in browser automation contexts
- **Capability Stratification**: >75% gap detection in browser automation contexts
- **Baseline Validation**: >30% accuracy drop without visual input
- **Hybrid Accessibility**: >20% more issues detected, >70% browser automation accessibility issues

## Implementation Priority

### Phase 1: High Priority (Calibration & Temporal)
1. ✅ **Extend HumanValidationManager** - Add `trackSequenceCalibration()` (1-2 hours)
2. ✅ **Extend temporal.mjs** - Add `buildTemporalGraph()` (2-3 hours)
3. ✅ **Extend temporal-note-pruner.mjs** - Add `selectRepresentativeScreenshots()` (1-2 hours)
4. ✅ **Integrate into testGameplay** - Add calibration tracking and graph building (1 hour)
5. ✅ **Create evaluation datasets** - Build test datasets for Phase 1 features (2-3 hours)
6. ✅ **Write test suites** - Create tests validating success criteria (2-3 hours)

### Phase 2: Medium Priority (Testing Frameworks)
7. ✅ **Create counterfactual-tester.mjs** - New file (2-3 hours)
8. ✅ **Create capability-stratifier.mjs** - New file (2-3 hours)
9. ✅ **Create baseline-validator.mjs** - New file (1-2 hours)
10. ✅ **Create evaluation datasets** - Build test datasets for Phase 2 features (2-3 hours)
11. ✅ **Write test suites** - Create tests validating success criteria (2-3 hours)

### Phase 3: Low Priority (Enhancements)
12. ✅ **Extend AccessibilityValidator** - Add `validateHybrid()` (2-3 hours)
13. ✅ **Create evaluation dataset** - Build hybrid accessibility test dataset (1-2 hours)
14. ✅ **Write test suite** - Create tests for hybrid accessibility (1-2 hours)
15. ✅ **Update documentation** - Document new features (1-2 hours)
16. ✅ **Run comprehensive evaluation** - Validate all improvements meet success criteria (3-4 hours)

## Integration Checklist

### For testGameplay (convenience.mjs)
- [ ] Import `buildTemporalGraph` from `temporal.mjs`
- [ ] Import `selectRepresentativeScreenshots` from `temporal-note-pruner.mjs`
- [ ] Track calibration degradation during sequence
- [ ] Build temporal graph when `captureTemporal` is true
- [ ] Select representative screenshots if sequence is long (>10)
- [ ] Include graph summary and recommendations in result

### For judge.mjs
- [ ] Track sequence calibration if `context.sequenceIndex` is provided
- [ ] Include calibration degradation warnings in result
- [ ] Log degradation when detected

### For Tests
- [ ] Add counterfactual memorization test
- [ ] Add stratified capability test
- [ ] Add baseline validation test
- [ ] Add calibration degradation test

## Key Insights from Code Review

1. **`prompt-composer.mjs` already handles `maxTemporalNotes`** - This is our screenshot selection mechanism! We just need to use it more intelligently.

2. **`SequentialDecisionContext` exists** - We can extend this for better temporal reasoning.

3. **Calibration infrastructure exists** - We just need to add sequence-level tracking.

4. **Temporal aggregation is comprehensive** - We just need to add graph structure on top.

5. **Activity detection exists** - We can use this to trigger calibration checks.

## Next Steps

1. **Start with Phase 1** - These are the most critical and build on existing code
2. **Test incrementally** - Add tests as we implement each feature
3. **Monitor in production** - Use calibration tracking to validate improvements
4. **Iterate based on data** - Adjust thresholds based on real-world performance

This refined plan builds on existing patterns and minimizes new code while addressing all identified nuances.

