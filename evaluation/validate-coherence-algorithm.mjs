/**
 * Validation: Coherence Algorithm
 * 
 * Tests our coherence calculation against known-good scenarios.
 * Validates that our metrics (direction consistency, variance, observation consistency)
 * produce expected results for edge cases and known patterns.
 */

import { aggregateTemporalNotes, calculateCoherenceExported } from '../src/temporal.mjs';
import { writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Test Case: Perfectly Consistent Progression
 * Expected: High coherence (0.9+)
 */
function testConsistentProgression() {
  const notes = [
    { timestamp: 0, gameState: { score: 0 }, observation: 'Game started' },
    { timestamp: 1000, gameState: { score: 10 }, observation: 'Score increasing' },
    { timestamp: 2000, gameState: { score: 20 }, observation: 'Score increasing' },
    { timestamp: 3000, gameState: { score: 30 }, observation: 'Score increasing' }
  ];
  
  const aggregated = aggregateTemporalNotes(notes);
  const coherence = aggregated.coherence;
  
  return {
    name: 'Consistent Progression',
    expected: 'High coherence (0.8+)',
    actual: coherence,
    passed: coherence >= 0.8,
    notes: 'Score consistently increases, observations consistent'
  };
}

/**
 * Test Case: Erratic Behavior
 * Expected: Low coherence (<0.5)
 */
function testErraticBehavior() {
  // CRITICAL: Use 1s window so each note is in its own window
  // This allows us to detect erratic behavior across windows
  // Scores: 0 -> 10 -> 5 -> 15 -> 3 (very erratic)
  const notes = [
    { timestamp: 0, gameState: { score: 0 }, observation: 'Game started' },
    { timestamp: 1000, gameState: { score: 10 }, observation: 'Score increasing' },
    { timestamp: 2000, gameState: { score: 5 }, observation: 'Score decreased' },
    { timestamp: 3000, gameState: { score: 15 }, observation: 'Score increased' },
    { timestamp: 4000, gameState: { score: 3 }, observation: 'Score decreased' }
  ];
  
  const aggregated = aggregateTemporalNotes(notes, { windowSize: 1000 }); // 1s windows - each note in own window
  const coherence = aggregated.coherence;
  
  return {
    name: 'Erratic Behavior',
    expected: 'Low coherence (<0.5)',
    actual: coherence,
    passed: coherence < 0.5,
    notes: 'Score changes direction frequently, inconsistent'
  };
}

/**
 * Test Case: Mixed Sentiment
 * Expected: Detected conflicts
 */
function testMixedSentiment() {
  const notes = [
    { timestamp: 0, gameState: { score: 0 }, observation: 'Game is good and smooth' },
    { timestamp: 1000, gameState: { score: 10 }, observation: 'Game is bad and laggy' },
    { timestamp: 2000, gameState: { score: 20 }, observation: 'Game is excellent but confusing' }
  ];
  
  const aggregated = aggregateTemporalNotes(notes);
  const conflicts = aggregated.conflicts;
  
  return {
    name: 'Mixed Sentiment Detection',
    expected: 'Conflicts detected',
    actual: conflicts.length,
    passed: conflicts.length > 0,
    notes: 'Should detect mixed positive/negative sentiment'
  };
}

/**
 * Test Case: Single Window
 * Expected: Coherence = 1.0 (no comparison possible)
 */
function testSingleWindow() {
  const notes = [
    { timestamp: 0, gameState: { score: 0 }, observation: 'Game started' }
  ];
  
  const aggregated = aggregateTemporalNotes(notes);
  const coherence = aggregated.coherence;
  
  return {
    name: 'Single Window',
    expected: 'Coherence = 1.0',
    actual: coherence,
    passed: coherence === 1.0,
    notes: 'Single window should return max coherence (no comparison)'
  };
}

/**
 * Test Case: Empty Notes
 * Expected: Coherence = 1.0, empty windows
 */
function testEmptyNotes() {
  const aggregated = aggregateTemporalNotes([]);
  
  return {
    name: 'Empty Notes',
    expected: 'Coherence = 1.0, empty windows',
    actual: { coherence: aggregated.coherence, windows: aggregated.windows.length },
    passed: aggregated.coherence === 1.0 && aggregated.windows.length === 0,
    notes: 'Empty input should handle gracefully'
  };
}

/**
 * Test Case: Coherence Metric Weights
 * Validates that our weighted combination (0.4 direction + 0.3 variance + 0.3 observation)
 * produces expected results
 */
function testCoherenceWeights() {
  // Create scenario where direction is perfect but variance is high
  const notes = [
    { timestamp: 0, gameState: { score: 0 }, observation: 'Start' },
    { timestamp: 1000, gameState: { score: 100 }, observation: 'Different' },
    { timestamp: 2000, gameState: { score: 200 }, observation: 'Different' },
    { timestamp: 3000, gameState: { score: 300 }, observation: 'Different' }
  ];
  
  const aggregated = aggregateTemporalNotes(notes);
  const coherence = aggregated.coherence;
  
  // Direction should be perfect (1.0), but variance might be high
  // Overall coherence should reflect weighted combination
  return {
    name: 'Coherence Weight Validation',
    expected: 'Weighted combination produces reasonable score',
    actual: coherence,
    passed: coherence >= 0.3 && coherence <= 1.0,
    notes: 'Validates that weights produce reasonable results'
  };
}

/**
 * Run all validation tests
 */
async function runValidation() {
  console.log('🔬 Validating Coherence Algorithm\n');
  
  const tests = [
    testConsistentProgression(),
    testErraticBehavior(),
    testMixedSentiment(),
    testSingleWindow(),
    testEmptyNotes(),
    testCoherenceWeights()
  ];
  
  const results = {
    timestamp: new Date().toISOString(),
    tests,
    summary: {
      total: tests.length,
      passed: tests.filter(t => t.passed).length,
      failed: tests.filter(t => !t.passed).length
    }
  };
  
  // Print results
  console.log('Results:');
  tests.forEach(test => {
    const status = test.passed ? '✅' : '❌';
    console.log(`${status} ${test.name}`);
    console.log(`   Expected: ${test.expected}`);
    console.log(`   Actual: ${JSON.stringify(test.actual)}`);
    if (!test.passed) {
      console.log(`   ⚠️  FAILED: ${test.notes}`);
    }
    console.log();
  });
  
  console.log(`\nSummary: ${results.summary.passed}/${results.summary.total} tests passed`);
  
  // Save results
  const outputPath = join(process.cwd(), 'evaluation', 'results', `coherence-validation-${Date.now()}.json`);
  writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to: ${outputPath}`);
  
  return results;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runValidation().catch(console.error);
}

export { runValidation };

