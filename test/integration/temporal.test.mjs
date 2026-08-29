/**
 * Tests for temporal.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert';
import {
  aggregateTemporalNotes,
  formatNotesForPrompt,
  calculateCoherenceExported as calculateCoherence
} from '#temporal-core';

test('aggregateTemporalNotes - empty notes', async () => {
  const result = await aggregateTemporalNotes([]);
  
  assert.ok(result);
  assert.deepStrictEqual(result.windows, []);
  assert.strictEqual(result.coherence, 1.0);
  assert.deepStrictEqual(result.conflicts, []);
});

test('aggregateTemporalNotes - single note', async () => {
  const notes = [
    {
      timestamp: Date.now(),
      elapsed: 0,
      score: 8,
      observation: 'Test observation',
      step: 'gameplay_note_start'
    }
  ];
  
  const result = await aggregateTemporalNotes(notes, { windowSize: 3000 });
  
  assert.ok(result);
  assert.strictEqual(result.windows.length, 1);
  assert.ok(result.coherence >= 0 && result.coherence <= 1);
  assert.strictEqual(result.windows[0].startTime, notes[0].timestamp);
  assert.strictEqual(result.windows[0].endTime, notes[0].timestamp + 3000);
  assert.strictEqual(result.windows[0].notes.length, 1);
  assert.strictEqual(result.windows[0].notes[0].weight, 1);
});

test('aggregateTemporalNotes preserves a timestamp at the Unix epoch', async () => {
  const result = await aggregateTemporalNotes([
    { timestamp: 0, elapsed: 0, score: 5, observation: 'initial frame' }
  ], { windowSize: 1000 });

  assert.strictEqual(result.windows[0].startTime, 0);
  assert.strictEqual(result.windows[0].endTime, 1000);
});

test('aggregateTemporalNotes - multiple notes', async () => {
  const now = Date.now();
  const notes = [
    { timestamp: now, elapsed: 0, score: 8, observation: 'Start', step: 'gameplay_note_start' },
    { timestamp: now + 5000, elapsed: 5000, score: 9, observation: 'Middle', step: 'gameplay_note_middle' },
    { timestamp: now + 10000, elapsed: 10000, score: 8, observation: 'End', step: 'gameplay_note_end' }
  ];
  
  const result = await aggregateTemporalNotes(notes);
  
  assert.ok(result);
  assert.ok(result.windows.length > 0);
  assert.ok(result.coherence >= 0 && result.coherence <= 1);
  assert.ok(result.summary);
});

test('aggregateTemporalNotes - custom window size', async () => {
  const now = Date.now();
  const notes = [
    { timestamp: now, elapsed: 0, score: 8, observation: 'Start', step: 'gameplay_note_start' },
    { timestamp: now + 20000, elapsed: 20000, score: 9, observation: 'End', step: 'gameplay_note_end' }
  ];
  
  const result = await aggregateTemporalNotes(notes, { windowSize: 5000 });
  
  assert.ok(result);
  assert.ok(result.windows.length > 0);
  assert.ok(result.coherence >= 0 && result.coherence <= 1);
});

test('formatNotesForPrompt - formats aggregated notes', async () => {
  const now = Date.now();
  const notes = [
    { timestamp: now, elapsed: 0, score: 8, observation: 'Start', step: 'gameplay_note_start' },
    { timestamp: now + 5000, elapsed: 5000, score: 9, observation: 'Middle', step: 'gameplay_note_middle' }
  ];
  
  const aggregated = await aggregateTemporalNotes(notes);
  const prompt = formatNotesForPrompt(aggregated);
  
  assert.ok(prompt);
  assert.strictEqual(typeof prompt, 'string');
  assert.ok(prompt.length > 0);
  assert.ok(prompt.includes('TEMPORAL AGGREGATION'));
});

test('formatNotesForPrompt - includes coherence score', async () => {
  const now = Date.now();
  const notes = [
    { timestamp: now, elapsed: 0, score: 8, step: 'gameplay_note_start' }
  ];
  
  const aggregated = await aggregateTemporalNotes(notes);
  const prompt = formatNotesForPrompt(aggregated);
  
  assert.ok(prompt.includes('Coherence'));
});

test('calculateCoherence - single window', async () => {
  const windows = [
    { avgScore: 8, observations: 'test' }
  ];
  
  const coherence = await calculateCoherence(windows);
  assert.strictEqual(coherence, 1.0);
});

test('calculateCoherence - consistent scores', async () => {
  const windows = [
    { avgScore: 8, observations: 'test' },
    { avgScore: 8, observations: 'test' },
    { avgScore: 8, observations: 'test' }
  ];
  
  const coherence = await calculateCoherence(windows);
  assert.ok(coherence >= 0.7); // High coherence for consistent scores
});

test('calculateCoherence - varying scores', async () => {
  const windows = [
    { avgScore: 8, observations: 'test' },
    { avgScore: 3, observations: 'different' },
    { avgScore: 9, observations: 'another' }
  ];
  
  const coherence = await calculateCoherence(windows);
  assert.ok(coherence >= 0 && coherence <= 1);
  assert.ok(coherence < 0.7); // Lower coherence for varying scores
});

test('aggregateTemporalNotes - detects conflicts', async () => {
  const now = Date.now();
  const notes = [
    { timestamp: now, elapsed: 0, score: 8, observation: 'good smooth', step: 'gameplay_note_start' },
    { timestamp: now + 5000, elapsed: 5000, score: 3, observation: 'bad slow laggy', step: 'gameplay_note_middle' }
  ];
  
  const result = await aggregateTemporalNotes(notes);
  
  assert.ok(result);
  assert.ok(Array.isArray(result.conflicts));
});

test('aggregateTemporalNotes - calculates trend', async () => {
  const now = Date.now();
  const notes = [
    { timestamp: now, elapsed: 0, score: 8, step: 'gameplay_note_start' },
    { timestamp: now + 5000, elapsed: 5000, score: 9, step: 'gameplay_note_middle' },
    { timestamp: now + 10000, elapsed: 10000, score: 10, step: 'gameplay_note_end' }
  ];
  
  const result = await aggregateTemporalNotes(notes);
  
  assert.ok(result);
  assert.ok(result.summary.includes('Score progression') || result.summary.includes('progression'));
});

// CRITICAL BUG FIX TESTS (2025-01)

test('calculateCoherence - direction change penalty reduces coherence', async () => {
  // CRITICAL BUG FIX: adjustedVarianceCoherence was incomplete (Math.max without arguments)
  // The fix: Complete calculation with direction change penalty (0.7 multiplier)
  // Erratic behavior (frequent direction changes) should produce low coherence
  
  // Erratic pattern: up→down→up→down (many direction changes)
  const erraticWindows = [
    { avgScore: 5, observations: 'start' },
    { avgScore: 8, observations: 'up' },      // up
    { avgScore: 3, observations: 'down' },   // down (change)
    { avgScore: 9, observations: 'up' },    // up (change)
    { avgScore: 2, observations: 'down' },  // down (change)
    { avgScore: 7, observations: 'up' }      // up (change)
  ];
  
  // Consistent pattern: steady improvement (no direction changes)
  const consistentWindows = [
    { avgScore: 5, observations: 'start' },
    { avgScore: 6, observations: 'up' },
    { avgScore: 7, observations: 'up' },
    { avgScore: 8, observations: 'up' },
    { avgScore: 9, observations: 'up' },
    { avgScore: 10, observations: 'up' }
  ];
  
  const erraticCoherence = await calculateCoherence(erraticWindows);
  const consistentCoherence = await calculateCoherence(consistentWindows);
  
  // Erratic pattern should have lower coherence due to direction change penalty
  assert.ok(erraticCoherence < consistentCoherence,
    'Erratic patterns (frequent direction changes) should have lower coherence');
  assert.ok(erraticCoherence < 0.7,
    'Erratic patterns should produce low coherence (<0.7)');
  assert.ok(consistentCoherence >= 0.7,
    'Consistent patterns should produce high coherence (>=0.7)');
});

test('calculateCoherence - score range properly normalizes variance', async () => {
  // CRITICAL BUG FIX: Changed from meanScore² to scoreRange for maxVariance calculation
  // The fix: Use score range to better capture variance
  // Wide score range should produce lower coherence than narrow range
  
  // Wide range: scores vary from 0 to 10 (range = 10)
  const wideRangeWindows = [
    { avgScore: 0, observations: 'low' },
    { avgScore: 5, observations: 'mid' },
    { avgScore: 10, observations: 'high' },
    { avgScore: 2, observations: 'low' },
    { avgScore: 8, observations: 'high' }
  ];
  
  // Narrow range: scores vary from 7 to 9 (range = 2)
  const narrowRangeWindows = [
    { avgScore: 7, observations: 'low' },
    { avgScore: 8, observations: 'mid' },
    { avgScore: 9, observations: 'high' },
    { avgScore: 7.5, observations: 'low' },
    { avgScore: 8.5, observations: 'high' }
  ];
  
  const wideRangeCoherence = await calculateCoherence(wideRangeWindows);
  const narrowRangeCoherence = await calculateCoherence(narrowRangeWindows);
  
  // Wide range should have lower coherence (more variance)
  assert.ok(wideRangeCoherence < narrowRangeCoherence,
    'Wide score range should produce lower coherence than narrow range');
});

test('calculateCoherence - direction change frequency affects penalty', async () => {
  // CRITICAL: Direction changes reduce coherence by up to 70% (0.7 multiplier)
  // More frequent direction changes = more penalty
  
  // Many direction changes (up→down→up→down→up)
  const manyChanges = [
    { avgScore: 5, observations: 'start' },
    { avgScore: 8, observations: 'up' },    // up
    { avgScore: 3, observations: 'down' },   // down (1)
    { avgScore: 9, observations: 'up' },     // up (2)
    { avgScore: 2, observations: 'down' },   // down (3)
    { avgScore: 7, observations: 'up' },      // up (4)
    { avgScore: 1, observations: 'down' }     // down (5)
  ];
  
  // Few direction changes (up→up→down→down)
  const fewChanges = [
    { avgScore: 5, observations: 'start' },
    { avgScore: 6, observations: 'up' },
    { avgScore: 7, observations: 'up' },
    { avgScore: 6, observations: 'down' },   // down (1)
    { avgScore: 5, observations: 'down' }
  ];
  
  const manyChangesCoherence = await calculateCoherence(manyChanges);
  const fewChangesCoherence = await calculateCoherence(fewChanges);
  
  // More direction changes should produce lower coherence
  assert.ok(manyChangesCoherence < fewChangesCoherence,
    'More frequent direction changes should produce lower coherence');
});

test('calculateCoherence - handles NaN and Infinity scores', async () => {
  // Edge case: Invalid scores should be handled gracefully
  const windowsWithInvalid = [
    { avgScore: 8, observations: 'valid' },
    { avgScore: NaN, observations: 'invalid' },
    { avgScore: Infinity, observations: 'invalid' },
    { avgScore: 9, observations: 'valid' }
  ];
  
  // Should not throw, should filter out invalid scores
  const coherence = await calculateCoherence(windowsWithInvalid);
  
  assert.ok(coherence >= 0 && coherence <= 1,
    'Coherence should handle NaN/Infinity scores gracefully');
  assert.ok(!isNaN(coherence) && isFinite(coherence),
    'Coherence result should be valid number');
});

// EDGE CASE TESTS

test('aggregateTemporalNotes - handles empty array', async () => {
  // Edge case: Empty notes array
  const result = await aggregateTemporalNotes([]);
  
  assert.ok(result);
  assert.deepStrictEqual(result.windows, []);
  assert.strictEqual(result.coherence, 1.0);
  assert.deepStrictEqual(result.conflicts, []);
  assert.ok(result.summary);
});

test('aggregateTemporalNotes - handles single note', async () => {
  // Edge case: Only one note
  const now = Date.now();
  const notes = [
    { timestamp: now, elapsed: 0, score: 8, observation: 'Single note' }
  ];
  
  const result = await aggregateTemporalNotes(notes);
  
  assert.ok(result);
  assert.strictEqual(result.windows.length, 1);
  assert.ok(result.coherence >= 0 && result.coherence <= 1);
});

test('aggregateTemporalNotes - handles notes with missing fields', async () => {
  // Edge case: Notes with missing optional fields
  const now = Date.now();
  const notes = [
    { timestamp: now, score: 8 }, // Missing elapsed, observation, step
    { elapsed: 1000, score: 9 }, // Missing timestamp
    { timestamp: now + 2000, observation: 'No score' } // Missing score
  ];
  
  // Should not throw, should handle gracefully
  const result = await aggregateTemporalNotes(notes);
  
  assert.ok(result);
  assert.ok(Array.isArray(result.windows));
});

test('aggregateTemporalNotes - handles very large note arrays', async () => {
  // Edge case: Performance test with many notes
  // UX FOCUS: Large arrays (>100) auto-disable embeddings for speed
  // This test verifies graceful handling of edge cases
  const now = Date.now();
  const notes = Array.from({ length: 1000 }, (_, i) => ({
    timestamp: now + i * 100,
    elapsed: i * 100,
    score: 7 + (i % 3),
    observation: `Note ${i}`
  }));
  
  const startTime = Date.now();
  // Large arrays auto-disable embeddings, so this should be fast (<3s)
  const result = await aggregateTemporalNotes(notes);
  const duration = Date.now() - startTime;
  
  assert.ok(result, 'Should handle large note arrays');
  assert.ok(result.windows.length > 0, 'Should produce windows');
  // Performance check: Large arrays auto-disable embeddings for UX, so should be fast
  // Keyword matching is <1ms per note, so 1000 notes should be <3s total
  assert.ok(duration < 3000, `Should complete quickly with auto-disabled embeddings (${duration}ms for 1000 notes)`);
});

test('aggregateTemporalNotes - realistic user scenario (10-50 notes)', async () => {
  // UX FOCUS: Most users have 10-50 notes, so this is the common case
  // This should use embeddings for better accuracy since it's fast enough
  const now = Date.now();
  const notes = Array.from({ length: 30 }, (_, i) => ({
    timestamp: now + i * 1000, // 1 second intervals (realistic)
    elapsed: i * 1000,
    score: 7 + Math.sin(i * 0.1) * 1.5,
    observation: `User interaction ${i}: button clicked, score updated`
  }));
  
  const startTime = Date.now();
  const result = await aggregateTemporalNotes(notes);
  const duration = Date.now() - startTime;
  
  assert.ok(result, 'Should handle realistic note arrays');
  assert.ok(result.windows.length > 0, 'Should produce windows');
  // Realistic scenarios (10-50 notes) use embeddings for accuracy
  // 30 notes with embeddings = ~450ms (15ms per comparison)
  // Allow up to 2s for network variability
  // Allow up to 5s for network variability in CI/slow machines
  assert.ok(duration < 5000, `Should complete in reasonable time with embeddings (${duration}ms for 30 notes)`);
});

test('calculateCoherence - boundary condition: exactly 2 windows', async () => {
  // Edge case: Minimum windows for coherence calculation (needs 2+)
  const windows = [
    { avgScore: 8, observations: 'first' },
    { avgScore: 9, observations: 'second' }
  ];
  
  const coherence = await calculateCoherence(windows);
  
  assert.ok(coherence >= 0 && coherence <= 1);
  assert.ok(!isNaN(coherence) && isFinite(coherence));
});

test('calculateCoherence - boundary condition: all identical scores', async () => {
  // Edge case: Perfect consistency (all scores identical)
  const windows = Array.from({ length: 10 }, () => ({
    avgScore: 8,
    observations: 'identical'
  }));
  
  const coherence = await calculateCoherence(windows);
  
  // Perfect consistency should produce high coherence
  assert.ok(coherence >= 0.9, 'Perfect consistency should produce high coherence');
});

test('calculateCoherence - boundary condition: maximum variance', async () => {
  // Edge case: Maximum possible variance (scores from 0 to 10)
  const windows = [
    { avgScore: 0, observations: 'min' },
    { avgScore: 10, observations: 'max' },
    { avgScore: 0, observations: 'min' },
    { avgScore: 10, observations: 'max' }
  ];
  
  const coherence = await calculateCoherence(windows);
  
  // Maximum variance should produce low coherence
  assert.ok(coherence < 0.5, 'Maximum variance should produce low coherence');
  assert.ok(coherence >= 0 && coherence <= 1);
});

test('formatNotesForPrompt - handles empty aggregated notes', () => {
  // Edge case: Empty aggregated notes
  const aggregated = {
    windows: [],
    coherence: 1.0,
    conflicts: [],
    summary: ''
  };
  
  const prompt = formatNotesForPrompt(aggregated);
  
  assert.ok(prompt);
  assert.strictEqual(typeof prompt, 'string');
  assert.ok(prompt.length > 0);
});
