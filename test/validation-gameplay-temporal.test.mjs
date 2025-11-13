/**
 * Validation Tests: Gameplay Temporal Experience Accuracy
 * 
 * Tests whether our temporal gameplay experience modeling is correct.
 * Validates:
 * - Temporal note aggregation produces coherent results
 * - Gameplay frame capture timing is appropriate
 * - Temporal coherence detection works correctly
 * - Multi-scale aggregation captures gameplay patterns
 * 
 * These tests validate that our gameplay temporal experience is correct.
 */

import { test } from 'node:test';
import assert from 'node:assert';
import {
  aggregateTemporalNotes,
  formatNotesForPrompt,
  calculateCoherenceExported as calculateCoherence
} from '../src/temporal.mjs';
import {
  aggregateMultiScale,
  humanPerceptionTime
} from '../src/temporal-decision.mjs';
import { TIME_SCALES } from '../src/temporal-constants.mjs';

test.describe('Gameplay Temporal Experience Validation', () => {
  
  test('temporal notes aggregation produces coherent gameplay patterns', () => {
    // Simulate gameplay notes: smooth gameplay should have high coherence
    const now = Date.now();
    
    const smoothGameplay = [
      { timestamp: now, elapsed: 0, score: 8, observation: 'Game starts smoothly', step: 'start' },
      { timestamp: now + 2000, elapsed: 2000, score: 8.5, observation: 'Ball movement smooth', step: 'movement' },
      { timestamp: now + 4000, elapsed: 4000, score: 9, observation: 'Collision detection works', step: 'collision' },
      { timestamp: now + 6000, elapsed: 6000, score: 9, observation: 'Gameplay feels good', step: 'mid' },
      { timestamp: now + 8000, elapsed: 8000, score: 8.5, observation: 'Consistent experience', step: 'end' }
    ];
    
    const aggregated = aggregateTemporalNotes(smoothGameplay);
    
    // Smooth gameplay should have high coherence
    assert.ok(aggregated.coherence >= 0.7, 'Smooth gameplay should have high coherence (>=0.7)');
    assert.ok(aggregated.windows.length > 0, 'Should produce temporal windows');
    assert.ok(aggregated.summary.length > 0, 'Should generate summary');
  });
  
  test('erratic gameplay produces low coherence', () => {
    // Erratic gameplay (frequent direction changes) should have low coherence
    // Use smaller window size (5s) to ensure multiple windows
    const now = Date.now();
    
    const erraticGameplay = [
      { timestamp: now, elapsed: 0, score: 8, observation: 'Start', step: 'start' },
      { timestamp: now + 2000, elapsed: 2000, score: 3, observation: 'Lag spike', step: 'lag' },
      { timestamp: now + 4000, elapsed: 4000, score: 9, observation: 'Recovered', step: 'recover' },
      { timestamp: now + 6000, elapsed: 6000, score: 2, observation: 'Bug detected', step: 'bug' },
      { timestamp: now + 8000, elapsed: 8000, score: 8, observation: 'Working again', step: 'work' },
      { timestamp: now + 10000, elapsed: 10000, score: 1, observation: 'Crash', step: 'crash' },
      { timestamp: now + 12000, elapsed: 12000, score: 9, observation: 'Fixed', step: 'fixed' }
    ];
    
    // Use 5-second windows to ensure multiple windows
    const aggregated = aggregateTemporalNotes(erraticGameplay, { windowSize: 5000 });
    
    // Need at least 2 windows for coherence calculation
    assert.ok(aggregated.windows.length >= 2, 'Erratic gameplay should produce multiple windows');
    
    // Erratic gameplay should have lower coherence
    assert.ok(aggregated.coherence < 0.7, 'Erratic gameplay should have low coherence (<0.7)');
    // Conflicts may or may not be detected (depends on observation keywords)
    // So we don't assert on conflicts.length
  });
  
  test('gameplay frame timing aligns with human perception', () => {
    // Gameplay frames should be captured at rates that align with human perception
    // For 60 FPS games, we might capture at 2-4 FPS for evaluation (every 250-500ms)
    // This aligns with human perception time scales
    
    const gameplayFPS = 4; // 4 FPS = 250ms per frame
    const frameInterval = 1000 / gameplayFPS; // 250ms
    
    // This should align with quick perception time (1s) or faster
    assert.ok(frameInterval <= TIME_SCALES.QUICK, 'Gameplay frame interval should be <= 1s (quick perception)');
    assert.ok(frameInterval >= TIME_SCALES.INSTANT, 'Gameplay frame interval should be >= 100ms (instant threshold)');
    
    // For gameplay, we want to capture fast enough to see changes
    // But not so fast that we're capturing every frame (too expensive)
    // 2-4 FPS (250-500ms) is a good balance
    assert.ok(frameInterval >= 250 && frameInterval <= 500, 'Gameplay frame interval should be 250-500ms (2-4 FPS)');
  });
  
  test('temporal aggregation windows are appropriate for gameplay', () => {
    // Gameplay notes should be aggregated into windows that make sense
    // Short windows (5-10s) for fast gameplay, longer windows (20-30s) for slower gameplay
    
    const now = Date.now();
    const gameplayNotes = Array.from({ length: 20 }, (_, i) => ({
      timestamp: now + i * 1000, // 1 note per second
      elapsed: i * 1000,
      score: 7 + (i % 3), // Varying scores
      observation: `Frame ${i}`,
      step: `frame_${i}`
    }));
    
    // Default window size (10s) should work well for gameplay
    const aggregated = aggregateTemporalNotes(gameplayNotes, {
      windowSize: 10000 // 10 second windows
    });
    
    // With 20 notes at 1 note/second, we should get 2-3 windows (10s each)
    assert.ok(aggregated.windows.length >= 2, 'Should produce multiple windows for 20 notes');
    assert.ok(aggregated.windows.length <= 3, 'Should not produce too many windows');
    
    // Each window should have reasonable number of notes
    for (const window of aggregated.windows) {
      assert.ok(window.noteCount > 0, 'Each window should have notes (noteCount > 0)');
      assert.ok(typeof window.avgScore === 'number', 'Each window should have avgScore');
    }
  });
  
  test('multi-scale aggregation captures gameplay patterns', () => {
    // Multi-scale aggregation should capture patterns at different time scales
    // Short scale (0.1s): Frame-by-frame changes
    // Medium scale (1s): Second-by-second changes
    // Long scale (10s): Overall gameplay trends
    
    const now = Date.now();
    const gameplayNotes = Array.from({ length: 30 }, (_, i) => ({
      timestamp: now + i * 1000, // 1 note per second
      elapsed: i * 1000,
      score: 7 + Math.sin(i / 5) * 2, // Oscillating pattern
      observation: `Frame ${i}`,
      step: `frame_${i}`
    }));
    
    const multiScale = aggregateMultiScale(gameplayNotes, {
      timeScales: {
        immediate: TIME_SCALES.INSTANT, // 100ms
        short: TIME_SCALES.QUICK, // 1s
        medium: TIME_SCALES.EXTENDED // 10s
      }
    });
    
    // Should have multiple scales
    assert.ok(multiScale.scales, 'Should have scales object');
    assert.ok(Object.keys(multiScale.scales).length > 0, 'Should have at least one scale');
    
    // Each scale should have coherence
    assert.ok(multiScale.coherence, 'Should have coherence object');
    assert.ok(Object.keys(multiScale.coherence).length > 0, 'Should have coherence for each scale');
  });
  
  test('gameplay temporal coherence detects improvement trends', () => {
    // Gameplay that improves over time should show coherent improvement pattern
    
    const now = Date.now();
    const improvingGameplay = [
      { timestamp: now, elapsed: 0, score: 6, observation: 'Start', step: 'start' },
      { timestamp: now + 2000, elapsed: 2000, score: 7, observation: 'Getting better', step: 'improve1' },
      { timestamp: now + 4000, elapsed: 4000, score: 8, observation: 'Much better', step: 'improve2' },
      { timestamp: now + 6000, elapsed: 6000, score: 9, observation: 'Excellent', step: 'improve3' },
      { timestamp: now + 8000, elapsed: 8000, score: 9, observation: 'Consistent', step: 'consistent' }
    ];
    
    const aggregated = aggregateTemporalNotes(improvingGameplay);
    
    // Improving trend should have decent coherence (not perfect, but consistent direction)
    assert.ok(aggregated.coherence >= 0.5, 'Improving trend should have decent coherence (>=0.5)');
    assert.ok(aggregated.summary.includes('improve') || aggregated.summary.includes('trend') || aggregated.summary.includes('progression'), 
      'Summary should mention improvement or trend');
  });
  
  test('gameplay temporal coherence detects degradation trends', () => {
    // Gameplay that degrades over time should show coherent degradation pattern
    
    const now = Date.now();
    const degradingGameplay = [
      { timestamp: now, elapsed: 0, score: 9, observation: 'Start excellent', step: 'start' },
      { timestamp: now + 2000, elapsed: 2000, score: 8, observation: 'Slight issues', step: 'degrade1' },
      { timestamp: now + 4000, elapsed: 4000, score: 6, observation: 'More issues', step: 'degrade2' },
      { timestamp: now + 6000, elapsed: 6000, score: 4, observation: 'Significant problems', step: 'degrade3' },
      { timestamp: now + 8000, elapsed: 8000, score: 3, observation: 'Poor experience', step: 'poor' }
    ];
    
    const aggregated = aggregateTemporalNotes(degradingGameplay);
    
    // Degrading trend should have decent coherence (consistent direction, even if negative)
    assert.ok(aggregated.coherence >= 0.5, 'Degrading trend should have decent coherence (>=0.5)');
    assert.ok(aggregated.conflicts.length === 0 || aggregated.conflicts.length < 3, 
      'Degrading trend should have few conflicts (consistent direction)');
  });
  
  test('gameplay interaction times are appropriate', () => {
    // Gameplay interactions (paddle movement, ball tracking) should use quick perception time
    
    const interactionTime = humanPerceptionTime('interaction', {
      attentionLevel: 'focused',
      actionComplexity: 'simple',
      persona: { name: 'Gamer' }
    });
    
    // Gameplay interactions should be quick (not extended)
    assert.ok(interactionTime <= TIME_SCALES.QUICK, 'Gameplay interactions should be <= 1s (quick)');
    assert.ok(interactionTime >= TIME_SCALES.INSTANT, 'Gameplay interactions should be >= 100ms (instant threshold)');
    
    // Should be closer to quick (1s) than extended (10s)
    assert.ok(interactionTime < TIME_SCALES.EXTENDED / 2, 'Gameplay interactions should be much faster than extended focus');
  });
  
  test('temporal note formatting includes gameplay context', () => {
    // Formatted temporal notes should include gameplay-relevant information
    
    const now = Date.now();
    const gameplayNotes = [
      { timestamp: now, elapsed: 0, score: 8, observation: 'Game starts', step: 'start' },
      { timestamp: now + 2000, elapsed: 2000, score: 8.5, observation: 'Ball moving', step: 'movement' }
    ];
    
    const aggregated = aggregateTemporalNotes(gameplayNotes);
    const formatted = formatNotesForPrompt(aggregated);
    
    // Should include temporal context
    assert.ok(formatted.includes('TEMPORAL') || formatted.includes('temporal') || formatted.includes('Temporal'), 
      'Formatted notes should mention temporal context');
    assert.ok(formatted.includes('coherence') || formatted.includes('Coherence'), 
      'Formatted notes should include coherence information');
  });
  
  test('empty gameplay notes handled gracefully', () => {
    // Empty gameplay notes should not crash
    
    const aggregated = aggregateTemporalNotes([]);
    
    assert.ok(aggregated, 'Should return result for empty notes');
    assert.deepStrictEqual(aggregated.windows, [], 'Empty notes should produce empty windows');
    assert.strictEqual(aggregated.coherence, 1.0, 'Empty notes should have perfect coherence (no variance)');
    assert.deepStrictEqual(aggregated.conflicts, [], 'Empty notes should have no conflicts');
  });
  
  test('single gameplay note handled correctly', () => {
    // Single gameplay note should produce one window with perfect coherence
    
    const now = Date.now();
    const singleNote = [
      { timestamp: now, elapsed: 0, score: 8, observation: 'Single note', step: 'start' }
    ];
    
    const aggregated = aggregateTemporalNotes(singleNote);
    
    assert.strictEqual(aggregated.windows.length, 1, 'Single note should produce one window');
    assert.strictEqual(aggregated.coherence, 1.0, 'Single note should have perfect coherence');
  });
});

