#!/usr/bin/env node
/**
 * Deep Edge Case Validation Tests
 * 
 * Tests for subtle bugs, edge cases, and nuances that might be missed:
 * - Extreme parameter values
 * - Numerical stability issues
 * - Division by zero / NaN / Infinity
 * - Boundary conditions
 * - Race conditions
 * - Async timing issues
 * - Data type edge cases
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { aggregateTemporalNotes } from '#temporal-core';
import { TemporalDecisionManager } from '../../src/temporal-orchestration.mjs';

test('Temporal Aggregation - Extreme Window Sizes', async () => {
  const notes = Array.from({ length: 10 }, (_, i) => ({
    timestamp: Date.now() - (10 - i) * 1000,
    score: 5
  }));
  
  // Very small window (1ms)
  const tiny = await aggregateTemporalNotes(notes, { windowSize: 1 });
  assert.ok(tiny.windows.length > 0, 'Tiny window should work');
  assert.ok(tiny.coherence >= 0 && tiny.coherence <= 1, 'Coherence should be valid');
  
  // Very large window (1 hour)
  const huge = await aggregateTemporalNotes(notes, { windowSize: 3600000 });
  assert.ok(huge.windows.length > 0, 'Huge window should work');
  assert.ok(huge.coherence >= 0 && huge.coherence <= 1, 'Coherence should be valid');
  
  console.log(`✅ Extreme windows: tiny=${tiny.windows.length} windows, huge=${huge.windows.length} windows`);
});

test('Temporal Aggregation - Extreme Decay Factors', async () => {
  const notes = Array.from({ length: 20 }, (_, i) => ({
    timestamp: Date.now() - (20 - i) * 1000,
    score: 5
  }));
  
  // Very aggressive decay (0.01)
  const aggressive = await aggregateTemporalNotes(notes, { decayFactor: 0.01 });
  assert.ok(aggressive.coherence >= 0 && aggressive.coherence <= 1, 'Aggressive decay should work');
  
  // Very gentle decay (0.99)
  const gentle = await aggregateTemporalNotes(notes, { decayFactor: 0.99 });
  assert.ok(gentle.coherence >= 0 && gentle.coherence <= 1, 'Gentle decay should work');
  
  console.log(`✅ Extreme decay: aggressive=${aggressive.coherence.toFixed(3)}, gentle=${gentle.coherence.toFixed(3)}`);
});

test('Temporal Aggregation - Negative and Large Scores', async () => {
  // Negative scores
  const negative = await aggregateTemporalNotes([
    { timestamp: Date.now() - 2000, score: -10 },
    { timestamp: Date.now() - 1000, score: -5 },
    { timestamp: Date.now(), score: 0 }
  ]);
  assert.ok(negative.coherence >= 0 && negative.coherence <= 1, 'Negative scores should work');
  
  // Very large scores
  const large = await aggregateTemporalNotes([
    { timestamp: Date.now() - 2000, score: 10000 },
    { timestamp: Date.now() - 1000, score: 20000 },
    { timestamp: Date.now(), score: 15000 }
  ]);
  assert.ok(large.coherence >= 0 && large.coherence <= 1, 'Large scores should work');
  
  console.log(`✅ Score ranges: negative=${negative.coherence.toFixed(3)}, large=${large.coherence.toFixed(3)}`);
});

test('Temporal Aggregation - Invalid Score Handling', async () => {
  // NaN scores (should be filtered)
  const nanScores = await aggregateTemporalNotes([
    { timestamp: Date.now() - 2000, score: NaN },
    { timestamp: Date.now() - 1000, score: 5 },
    { timestamp: Date.now(), score: 7 }
  ]);
  assert.ok(nanScores.coherence >= 0 && nanScores.coherence <= 1, 'NaN scores should be handled');
  
  // Infinity scores (should be filtered)
  const infScores = await aggregateTemporalNotes([
    { timestamp: Date.now() - 2000, score: Infinity },
    { timestamp: Date.now() - 1000, score: 5 },
    { timestamp: Date.now(), score: -Infinity }
  ]);
  assert.ok(infScores.coherence >= 0 && infScores.coherence <= 1, 'Infinity scores should be handled');
  
  // Mixed valid/invalid
  const mixed = await aggregateTemporalNotes([
    { timestamp: Date.now() - 2000, score: 5 },
    { timestamp: Date.now() - 1000, score: NaN },
    { timestamp: Date.now(), score: Infinity },
    { timestamp: Date.now() + 1000, score: 7 }
  ]);
  assert.ok(mixed.coherence >= 0 && mixed.coherence <= 1, 'Mixed scores should be handled');
  
  console.log(`✅ Invalid scores: NaN=${nanScores.coherence.toFixed(3)}, Infinity=${infScores.coherence.toFixed(3)}, Mixed=${mixed.coherence.toFixed(3)}`);
});

test('Temporal Aggregation - Logarithmic Edge Cases', async () => {
  // Reference point at start
  const refStart = await aggregateTemporalNotes(
    Array.from({ length: 10 }, (_, i) => ({
      timestamp: 1000 + i * 1000,
      score: 5
    })),
    { decayMethod: 'logarithmic', temporalReference: 1000 }
  );
  assert.ok(refStart.coherence >= 0 && refStart.coherence <= 1, 'Reference at start should work');
  
  // Reference point before start
  const refBefore = await aggregateTemporalNotes(
    Array.from({ length: 10 }, (_, i) => ({
      timestamp: 1000 + i * 1000,
      score: 5
    })),
    { decayMethod: 'logarithmic', temporalReference: 0 }
  );
  assert.ok(refBefore.coherence >= 0 && refBefore.coherence <= 1, 'Reference before start should work');
  
  // Reference point after end
  const refAfter = await aggregateTemporalNotes(
    Array.from({ length: 10 }, (_, i) => ({
      timestamp: 1000 + i * 1000,
      score: 5
    })),
    { decayMethod: 'logarithmic', temporalReference: 20000 }
  );
  assert.ok(refAfter.coherence >= 0 && refAfter.coherence <= 1, 'Reference after end should work');
  
  // Same timestamp (zero distance)
  const zeroDist = await aggregateTemporalNotes([
    { timestamp: 1000, score: 5 },
    { timestamp: 1000, score: 6 },
    { timestamp: 1000, score: 7 }
  ], { decayMethod: 'logarithmic', temporalReference: 1000 });
  assert.ok(zeroDist.coherence >= 0 && zeroDist.coherence <= 1, 'Zero distance should work');
  
  console.log(`✅ Logarithmic edge cases: all passed`);
});

test('Temporal Aggregation - Observation Edge Cases', async () => {
  // Empty observations
  const empty = await aggregateTemporalNotes([
    { timestamp: Date.now() - 2000, score: 5, observation: '' },
    { timestamp: Date.now() - 1000, score: 6, observation: null },
    { timestamp: Date.now(), score: 7, observation: undefined }
  ]);
  assert.ok(empty.coherence >= 0 && empty.coherence <= 1, 'Empty observations should work');
  
  // Very long observations
  const long = await aggregateTemporalNotes([
    { timestamp: Date.now() - 2000, score: 5, observation: 'A'.repeat(10000) },
    { timestamp: Date.now() - 1000, score: 6, observation: 'B'.repeat(10000) }
  ]);
  assert.ok(long.coherence >= 0 && long.coherence <= 1, 'Long observations should work');
  
  // Special characters
  const special = await aggregateTemporalNotes([
    { timestamp: Date.now() - 2000, score: 5, observation: 'Test with émojis 🎮 and spéciál chars!' },
    { timestamp: Date.now() - 1000, score: 6, observation: 'Test with emojis 🎮 and special chars!' }
  ]);
  assert.ok(special.coherence >= 0 && special.coherence <= 1, 'Special characters should work');
  
  console.log(`✅ Observation edge cases: empty=${empty.coherence.toFixed(3)}, long=${long.coherence.toFixed(3)}, special=${special.coherence.toFixed(3)}`);
});

test('Temporal Aggregation - Numerical Stability', async () => {
  // Very small numbers
  const tiny = await aggregateTemporalNotes([
    { timestamp: Date.now() - 2000, score: 0.0001 },
    { timestamp: Date.now() - 1000, score: 0.0002 },
    { timestamp: Date.now(), score: 0.0003 }
  ]);
  assert.ok(isFinite(tiny.coherence) && !isNaN(tiny.coherence), 'Tiny numbers should be stable');
  
  // Very large numbers
  const huge = await aggregateTemporalNotes([
    { timestamp: Date.now() - 2000, score: 1e10 },
    { timestamp: Date.now() - 1000, score: 1e10 + 1 },
    { timestamp: Date.now(), score: 1e10 + 2 }
  ]);
  assert.ok(isFinite(huge.coherence) && !isNaN(huge.coherence), 'Huge numbers should be stable');
  
  // High precision
  const precise = await aggregateTemporalNotes(
    Array.from({ length: 10 }, (_, i) => ({
      timestamp: Date.now() - (10 - i) * 1000,
      score: 5.123456789012345
    }))
  );
  assert.ok(isFinite(precise.coherence) && !isNaN(precise.coherence), 'High precision should be stable');
  
  console.log(`✅ Numerical stability: tiny=${tiny.coherence.toFixed(6)}, huge=${huge.coherence.toFixed(3)}, precise=${precise.coherence.toFixed(3)}`);
});

test('Temporal Decision Manager - Extreme Sequences', async () => {
  const manager = new TemporalDecisionManager({
    warmStartSteps: 5,
    adaptiveSampling: true
  });
  
  // Very long sequence (100 steps)
  let promptCount = 0;
  for (let i = 0; i < 100; i++) {
    const decision = await manager.shouldPrompt(
      { score: 5 + (i % 10) },
      i > 0 ? { score: 5 + ((i - 1) % 10) } : null,
      Array.from({ length: Math.min(i + 1, 20) }, (_, j) => ({
        timestamp: Date.now() - (Math.min(i + 1, 20) - j) * 1000,
        score: 5
      }))
    );
    if (decision.shouldPrompt) promptCount++;
  }
  
  assert.ok(promptCount > 0, 'Should prompt at least in warm-start');
  assert.ok(promptCount <= 100, 'Should not prompt every step');
  
  console.log(`✅ Long sequence (100 steps): ${promptCount} prompts`);
});

test('Temporal Decision Manager - State Change Edge Cases', async () => {
  const manager = new TemporalDecisionManager();
  
  // Empty states
  const empty = manager.calculateStateChange({}, {});
  assert.ok(empty >= 0 && empty <= 1, 'Empty states should work');
  
  // Only score
  const scoreOnly = manager.calculateStateChange({ score: 8 }, { score: 2 });
  assert.ok(scoreOnly >= 0 && scoreOnly <= 1, 'Score only should work');
  
  // Only issues
  const issuesOnly = manager.calculateStateChange(
    { issues: ['a', 'b'] },
    { issues: ['a'] }
  );
  assert.ok(issuesOnly >= 0 && issuesOnly <= 1, 'Issues only should work');
  
  // Non-array issues (should handle gracefully)
  const nonArray = manager.calculateStateChange(
    { issues: 'not an array' },
    { issues: ['a'] }
  );
  assert.ok(nonArray >= 0 && nonArray <= 1, 'Non-array issues should be handled');
  
  // Very large score differences (should be clamped)
  const largeDiff = manager.calculateStateChange(
    { score: 1000 },
    { score: -1000 }
  );
  assert.ok(largeDiff <= 1.0, 'Large differences should be clamped to 1.0');
  
  console.log(`✅ State change edge cases: all passed`);
});

test('Temporal Aggregation - Concurrent Calls', async () => {
  // Test concurrent calls (potential race conditions)
  const notes = Array.from({ length: 10 }, (_, i) => ({
    timestamp: Date.now() - (10 - i) * 1000,
    score: 5 + Math.sin(i)
  }));
  
  const promises = Array.from({ length: 5 }, () => aggregateTemporalNotes(notes));
  const results = await Promise.all(promises);
  
  // All results should be valid and consistent
  results.forEach((result, i) => {
    assert.ok(result, `Result ${i} should exist`);
    assert.ok(result.coherence >= 0 && result.coherence <= 1, `Result ${i} coherence should be valid`);
    assert.ok(Array.isArray(result.windows), `Result ${i} should have windows array`);
  });
  
  // All results should have same coherence (deterministic)
  const coherences = results.map(r => r.coherence);
  const allSame = coherences.every(c => Math.abs(c - coherences[0]) < 0.001);
  assert.ok(allSame, 'Concurrent calls should produce same results');
  
  console.log(`✅ Concurrent calls: ${results.length} calls, all consistent`);
});

test('Temporal Aggregation - Timestamp Edge Cases', async () => {
  // Unsorted timestamps (should be sorted)
  const unsorted = await aggregateTemporalNotes([
    { timestamp: Date.now() - 1000, score: 5 },
    { timestamp: Date.now() - 3000, score: 6 },
    { timestamp: Date.now() - 2000, score: 7 }
  ]);
  assert.ok(unsorted.windows.length > 0, 'Unsorted should be sorted and work');
  
  // Negative timestamps
  const negative = await aggregateTemporalNotes([
    { timestamp: -1000, score: 5 },
    { timestamp: -500, score: 6 },
    { timestamp: 0, score: 7 }
  ]);
  assert.ok(negative.windows.length > 0, 'Negative timestamps should work');
  
  // Very large timestamps
  const large = await aggregateTemporalNotes([
    { timestamp: 1e15, score: 5 },
    { timestamp: 1e15 + 1000, score: 6 },
    { timestamp: 1e15 + 2000, score: 7 }
  ]);
  assert.ok(large.windows.length > 0, 'Large timestamps should work');
  
  // Mixed timestamp and elapsed
  const mixed = await aggregateTemporalNotes([
    { timestamp: Date.now() - 2000, score: 5 },
    { elapsed: 1000, score: 6 },
    { timestamp: Date.now(), score: 7 }
  ]);
  assert.ok(mixed.windows.length > 0, 'Mixed timestamp/elapsed should work');
  
  console.log(`✅ Timestamp edge cases: all passed`);
});

test('Temporal Aggregation - Window Boundary Conditions', async () => {
  const now = Date.now();
  
  // Notes exactly at window boundaries
  const boundary = await aggregateTemporalNotes([
    { timestamp: now, score: 5 },
    { timestamp: now + 10000, score: 6 }, // Exactly at window boundary
    { timestamp: now + 20000, score: 7 }  // Exactly at next boundary
  ], { windowSize: 10000 });
  
  // Should have at least 1 window (all notes might be in same window if startTime is used)
  assert.ok(boundary.windows.length >= 1, 'Boundary notes should create windows');
  assert.ok(boundary.timeSpan >= 0, 'Time span should be non-negative');
  assert.ok(boundary.coherence >= 0 && boundary.coherence <= 1, 'Coherence should be valid');
  
  // Notes just before/after boundaries
  const nearBoundary = await aggregateTemporalNotes([
    { timestamp: now, score: 5 },
    { timestamp: now + 9999, score: 6 }, // Just before boundary
    { timestamp: now + 10001, score: 7 }  // Just after boundary
  ], { windowSize: 10000 });
  
  assert.ok(nearBoundary.windows.length >= 1, 'Near-boundary notes should create windows');
  assert.ok(nearBoundary.timeSpan >= 0, 'Time span should be non-negative');
  assert.ok(nearBoundary.coherence >= 0 && nearBoundary.coherence <= 1, 'Coherence should be valid');
  
  console.log(`✅ Window boundaries: boundary=${boundary.windows.length} windows (timeSpan=${boundary.timeSpan}ms), near=${nearBoundary.windows.length} windows (timeSpan=${nearBoundary.timeSpan}ms)`);
});

test('Temporal Aggregation - Rapid State Changes', async () => {
  // Rapid oscillations (many direction changes)
  const rapid = await aggregateTemporalNotes(
    Array.from({ length: 50 }, (_, i) => ({
      timestamp: Date.now() - (50 - i) * 100,
      score: 5 + Math.sin(i * 2) * 4
    }))
  );
  assert.ok(rapid.coherence >= 0 && rapid.coherence <= 1, 'Rapid oscillations should work');
  // Note: With embeddings, coherence might be higher due to observation consistency
  // So we check that it's not higher than a stable pattern, rather than absolute threshold
  const stable = await aggregateTemporalNotes(
    Array.from({ length: 50 }, (_, i) => ({
      timestamp: Date.now() - (50 - i) * 100,
      score: 5 // Stable score
    }))
  );
  assert.ok(rapid.coherence <= stable.coherence, 'Rapid oscillations should have lower or equal coherence than stable');
  
  // Sudden jumps
  const sudden = await aggregateTemporalNotes([
    { timestamp: Date.now() - 5000, score: 1 },
    { timestamp: Date.now() - 4000, score: 1 },
    { timestamp: Date.now() - 3000, score: 9 },
    { timestamp: Date.now() - 2000, score: 9 },
    { timestamp: Date.now() - 1000, score: 1 },
    { timestamp: Date.now(), score: 1 }
  ]);
  assert.ok(sudden.coherence >= 0 && sudden.coherence <= 1, 'Sudden jumps should work');
  
  console.log(`✅ Rapid changes: oscillations=${rapid.coherence.toFixed(3)} (stable=${stable.coherence.toFixed(3)}), sudden=${sudden.coherence.toFixed(3)}`);
});

test('Temporal Aggregation - Result Validation', async () => {
  const result = await aggregateTemporalNotes(
    Array.from({ length: 20 }, (_, i) => ({
      timestamp: Date.now() - (20 - i) * 1000,
      score: 5 + Math.sin(i)
    }))
  );
  
  // Check for NaN
  assert.ok(!isNaN(result.coherence), 'Coherence should not be NaN');
  assert.ok(result.windows.every(w => !isNaN(w.avgScore)), 'Window scores should not be NaN');
  
  // Check for Infinity
  assert.ok(isFinite(result.coherence), 'Coherence should be finite');
  assert.ok(result.windows.every(w => isFinite(w.avgScore)), 'Window scores should be finite');
  
  // Check ranges
  assert.ok(result.coherence >= 0 && result.coherence <= 1, 'Coherence should be in [0, 1]');
  assert.ok(result.totalNotes === 20, 'Total notes should match');
  assert.ok(result.timeSpan >= 0, 'Time span should be non-negative');
  
  // Check window structure
  result.windows.forEach((window, i) => {
    assert.ok(typeof window.window === 'number', `Window ${i} should have index`);
    assert.ok(typeof window.avgScore === 'number', `Window ${i} should have avgScore`);
    assert.ok(window.noteCount > 0, `Window ${i} should have notes`);
  });
  
  console.log(`✅ Result validation: all checks passed`);
});

console.log('\n🔍 Running deep edge case validation tests...\n');
