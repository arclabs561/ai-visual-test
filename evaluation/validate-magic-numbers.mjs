/**
 * Validation: Magic Numbers and Hardcoded Values
 * 
 * Tests that our hardcoded constants (window sizes, decay factors, weights)
 * produce expected results and identifies areas needing research validation.
 */

import { aggregateTemporalNotes } from '../src/temporal.mjs';
import { writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Test Case: Window Size Impact
 * Tests different window sizes to see impact on coherence
 */
function testWindowSizeImpact() {
  const notes = Array.from({ length: 20 }, (_, i) => ({
    timestamp: i * 1000, // 1 second apart
    gameState: { score: i * 10 },
    observation: `Frame ${i}`
  }));
  
  const results = {};
  const windowSizes = [5000, 10000, 20000, 30000]; // 5s, 10s, 20s, 30s
  
  for (const windowSize of windowSizes) {
    const aggregated = aggregateTemporalNotes(notes, { windowSize });
    results[`${windowSize}ms`] = {
      windows: aggregated.windows.length,
      coherence: aggregated.coherence,
      summary: aggregated.summary.substring(0, 100)
    };
  }
  
  return {
    name: 'Window Size Impact',
    hypothesis: 'Different window sizes produce different coherence scores',
    actual: results,
    analysis: {
      windowCountVariation: new Set(Object.values(results).map(r => r.windows)).size > 1,
      coherenceVariation: new Set(Object.values(results).map(r => r.coherence.toFixed(2))).size > 1
    },
    passed: true, // Informational test
    notes: 'Window size should affect window count and potentially coherence'
  };
}

/**
 * Test Case: Decay Factor Impact
 * Tests different decay factors to see impact on weighted scores
 */
function testDecayFactorImpact() {
  const notes = Array.from({ length: 10 }, (_, i) => ({
    timestamp: i * 2000, // 2 seconds apart
    gameState: { score: 10 }, // Constant score
    observation: `Frame ${i}`
  }));
  
  const results = {};
  const decayFactors = [0.5, 0.7, 0.9, 0.95, 1.0]; // No decay to strong decay
  
  for (const decayFactor of decayFactors) {
    const aggregated = aggregateTemporalNotes(notes, { 
      windowSize: 10000,
      decayFactor 
    });
    
    // Check if later windows have lower weights (if decay is working)
    // Note: windows may not have notes array with weights, so handle gracefully
    const weights = aggregated.windows
      .filter(w => w.notes && Array.isArray(w.notes) && w.notes.length > 0)
      .map(w => {
        const totalWeight = w.notes.reduce((sum, n) => sum + (n.weight || 0), 0);
        return totalWeight / w.notes.length;
      });
    
    results[`decay-${decayFactor}`] = {
      coherence: aggregated.coherence,
      avgWeightFirst: weights[0] || 0,
      avgWeightLast: weights[weights.length - 1] || 0,
      weightDecay: weights.length > 1 ? weights[0] - weights[weights.length - 1] : 0
    };
  }
  
  return {
    name: 'Decay Factor Impact',
    hypothesis: 'Lower decay factors reduce weight of older notes',
    actual: results,
    analysis: {
      hasDecay: Object.values(results).some(r => r.weightDecay > 0),
      decayIncreases: Object.keys(results).sort().every((key, i, arr) => {
        if (i === 0) return true;
        const prev = results[arr[i - 1]].weightDecay;
        const curr = results[key].weightDecay;
        return curr >= prev; // Decay should increase as decayFactor decreases
      })
    },
    passed: true, // Informational test
    notes: 'Decay factor should affect weight distribution over time'
  };
}

/**
 * Test Case: Coherence Weight Sensitivity
 * Tests if changing weights (0.4, 0.3, 0.3) significantly affects results
 */
function testCoherenceWeightSensitivity() {
  // Create scenario with mixed signals
  const notes = [
    { timestamp: 0, gameState: { score: 0 }, observation: 'start' },
    { timestamp: 1000, gameState: { score: 10 }, observation: 'different words' },
    { timestamp: 2000, gameState: { score: 5 }, observation: 'different words' },
    { timestamp: 3000, gameState: { score: 15 }, observation: 'different words' }
  ];
  
  // We can't directly test weights, but we can test if coherence is sensitive to input changes
  const baseResult = aggregateTemporalNotes(notes);
  
  // Test with more consistent observations
  const consistentNotes = notes.map((n, i) => ({
    ...n,
    observation: `consistent observation ${i}`
  }));
  const consistentResult = aggregateTemporalNotes(consistentNotes);
  
  // Test with more consistent scores
  const consistentScoreNotes = [
    { timestamp: 0, gameState: { score: 0 }, observation: 'start' },
    { timestamp: 1000, gameState: { score: 5 }, observation: 'different' },
    { timestamp: 2000, gameState: { score: 10 }, observation: 'different' },
    { timestamp: 3000, gameState: { score: 15 }, observation: 'different' }
  ];
  const consistentScoreResult = aggregateTemporalNotes(consistentScoreNotes);
  
  return {
    name: 'Coherence Weight Sensitivity',
    hypothesis: 'Coherence should be sensitive to input consistency',
    actual: {
      baseCoherence: baseResult.coherence,
      consistentObservationCoherence: consistentResult.coherence,
      consistentScoreCoherence: consistentScoreResult.coherence,
      differences: {
        observation: Math.abs(baseResult.coherence - consistentResult.coherence),
        score: Math.abs(baseResult.coherence - consistentScoreResult.coherence)
      }
    },
    analysis: {
      sensitiveToObservations: Math.abs(baseResult.coherence - consistentResult.coherence) > 0.1,
      sensitiveToScores: Math.abs(baseResult.coherence - consistentScoreResult.coherence) > 0.1
    },
    passed: true, // Informational test
    notes: 'Coherence should respond to changes in observation and score consistency'
  };
}

/**
 * Test Case: Default Values Validation
 * Validates that default values (windowSize=10000, decayFactor=0.9) are reasonable
 */
function testDefaultValues() {
  const notes = Array.from({ length: 30 }, (_, i) => ({
    timestamp: i * 500, // 0.5 seconds apart = 15 seconds total
    gameState: { score: i * 5 },
    observation: `Frame ${i}`
  }));
  
  // Test with defaults
  const defaultResult = aggregateTemporalNotes(notes);
  
  // Test with custom values
  const customResult = aggregateTemporalNotes(notes, {
    windowSize: 5000,
    decayFactor: 0.7
  });
  
  return {
    name: 'Default Values Validation',
    hypothesis: 'Default values produce reasonable results',
    actual: {
      default: {
        windows: defaultResult.windows.length,
        coherence: defaultResult.coherence,
        conflicts: defaultResult.conflicts.length
      },
      custom: {
        windows: customResult.windows.length,
        coherence: customResult.coherence,
        conflicts: customResult.conflicts.length
      }
    },
    analysis: {
      defaultWindowsReasonable: defaultResult.windows.length >= 1 && defaultResult.windows.length <= 5,
      defaultCoherenceReasonable: defaultResult.coherence >= 0 && defaultResult.coherence <= 1,
      customProducesDifferentResults: defaultResult.windows.length !== customResult.windows.length
    },
    passed: true, // Informational test
    notes: 'Default values should produce reasonable, non-extreme results'
  };
}

/**
 * Test Case: Edge Case Handling
 * Tests that magic numbers don't cause crashes or extreme values
 */
function testEdgeCases() {
  const results = {};
  
  // Empty notes
  try {
    const empty = aggregateTemporalNotes([]);
    results.empty = { coherence: empty.coherence, windows: empty.windows.length };
  } catch (e) {
    results.empty = { error: e.message };
  }
  
  // Single note
  try {
    const single = aggregateTemporalNotes([{ timestamp: 0, gameState: { score: 0 } }]);
    results.single = { coherence: single.coherence, windows: single.windows.length };
  } catch (e) {
    results.single = { error: e.message };
  }
  
  // Very large window size
  try {
    const large = aggregateTemporalNotes(
      Array.from({ length: 10 }, (_, i) => ({ timestamp: i * 1000, gameState: { score: i } })),
      { windowSize: 100000 }
    );
    results.largeWindow = { coherence: large.coherence, windows: large.windows.length };
  } catch (e) {
    results.largeWindow = { error: e.message };
  }
  
  // Very small window size
  try {
    const small = aggregateTemporalNotes(
      Array.from({ length: 10 }, (_, i) => ({ timestamp: i * 1000, gameState: { score: i } })),
      { windowSize: 100 }
    );
    results.smallWindow = { coherence: small.coherence, windows: small.windows.length };
  } catch (e) {
    results.smallWindow = { error: e.message };
  }
  
  // Zero decay factor
  try {
    const zeroDecay = aggregateTemporalNotes(
      Array.from({ length: 10 }, (_, i) => ({ timestamp: i * 1000, gameState: { score: i } })),
      { decayFactor: 0 }
    );
    results.zeroDecay = { coherence: zeroDecay.coherence, windows: zeroDecay.windows.length };
  } catch (e) {
    results.zeroDecay = { error: e.message };
  }
  
  return {
    name: 'Edge Case Handling',
    hypothesis: 'Magic numbers handle edge cases gracefully',
    actual: results,
    analysis: {
      noCrashes: !Object.values(results).some(r => r.error),
      reasonableValues: Object.values(results)
        .filter(r => !r.error)
        .every(r => r.coherence >= 0 && r.coherence <= 1)
    },
    passed: !Object.values(results).some(r => r.error),
    notes: 'Edge cases should not crash and should produce reasonable values'
  };
}

/**
 * Run all validation tests
 */
async function runValidation() {
  console.log('🔬 Validating Magic Numbers and Hardcoded Values\n');
  
  const tests = [
    testWindowSizeImpact(),
    testDecayFactorImpact(),
    testCoherenceWeightSensitivity(),
    testDefaultValues(),
    testEdgeCases()
  ];
  
  const results = {
    timestamp: new Date().toISOString(),
    tests,
    summary: {
      total: tests.length,
      passed: tests.filter(t => t.passed).length,
      failed: tests.filter(t => !t.passed).length,
      informational: tests.filter(t => t.passed && t.notes?.includes('Informational')).length
    },
    recommendations: []
  };
  
  // Generate recommendations based on results
  if (tests.find(t => t.name === 'Window Size Impact')?.analysis?.coherenceVariation === false) {
    results.recommendations.push({
      issue: 'Window size does not significantly affect coherence',
      recommendation: 'Consider if window size is actually meaningful or if it should be adaptive'
    });
  }
  
  if (tests.find(t => t.name === 'Decay Factor Impact')?.analysis?.hasDecay === false) {
    results.recommendations.push({
      issue: 'Decay factor may not be working as expected',
      recommendation: 'Review decay factor implementation'
    });
  }
  
  // Print results
  console.log('Results:');
  tests.forEach(test => {
    const status = test.passed ? '✅' : '❌';
    console.log(`${status} ${test.name}`);
    console.log(`   Hypothesis: ${test.hypothesis}`);
    if (test.analysis) {
      console.log(`   Analysis: ${JSON.stringify(test.analysis, null, 2)}`);
    }
    console.log();
  });
  
  console.log(`\nSummary: ${results.summary.passed}/${results.summary.total} tests passed`);
  
  if (results.recommendations.length > 0) {
    console.log('\n⚠️  Recommendations:');
    results.recommendations.forEach(rec => {
      console.log(`   - ${rec.issue}`);
      console.log(`     → ${rec.recommendation}`);
    });
  }
  
  // Save results
  const outputPath = join(process.cwd(), 'evaluation', 'results', `magic-numbers-validation-${Date.now()}.json`);
  writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to: ${outputPath}`);
  
  return results;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runValidation().catch(console.error);
}

export { runValidation };

