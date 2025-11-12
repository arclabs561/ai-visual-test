/**
 * Tests for temporal-decision.mjs
 * 
 * Tests sequential decision context, multi-scale aggregation, and human perception time modeling
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  aggregateMultiScale,
  SequentialDecisionContext,
  humanPerceptionTime
} from '../src/temporal-decision.mjs';

describe('SequentialDecisionContext', () => {
  test('constructor with default options', () => {
    const context = new SequentialDecisionContext();
    
    assert.ok(context);
    assert.strictEqual(context.history.length, 0);
    assert.strictEqual(context.maxHistory, 10);
    assert.strictEqual(context.adaptationEnabled, true);
  });
  
  test('constructor with custom options', () => {
    const context = new SequentialDecisionContext({
      maxHistory: 5,
      adaptationEnabled: false
    });
    
    assert.strictEqual(context.maxHistory, 5);
    assert.strictEqual(context.adaptationEnabled, false);
  });
  
  test('addDecision - adds to history', () => {
    const context = new SequentialDecisionContext();
    
    context.addDecision({ score: 8, issues: ['issue1'] });
    
    assert.strictEqual(context.history.length, 1);
    assert.strictEqual(context.history[0].score, 8);
    assert.deepStrictEqual(context.history[0].issues, ['issue1']);
    assert.ok(context.history[0].timestamp);
    assert.strictEqual(context.history[0].index, 0);
  });
  
  test('addDecision - respects maxHistory', () => {
    const context = new SequentialDecisionContext({ maxHistory: 3 });
    
    context.addDecision({ score: 1 });
    context.addDecision({ score: 2 });
    context.addDecision({ score: 3 });
    context.addDecision({ score: 4 });
    
    assert.strictEqual(context.history.length, 3);
    assert.strictEqual(context.history[0].score, 2); // First one removed
    assert.strictEqual(context.history[2].score, 4);
  });
  
  test('identifyPatterns - detects trends', () => {
    const context = new SequentialDecisionContext();
    
    context.addDecision({ score: 5 });
    context.addDecision({ score: 6 });
    context.addDecision({ score: 7 });
    
    const patterns = context.identifyPatterns();
    
    assert.strictEqual(patterns.trend, 'improving');
    assert.ok(patterns.isConsistent);
  });
  
  test('identifyPatterns - detects declining trend', () => {
    const context = new SequentialDecisionContext();
    
    context.addDecision({ score: 8 });
    context.addDecision({ score: 7 });
    context.addDecision({ score: 6 });
    
    const patterns = context.identifyPatterns();
    
    assert.strictEqual(patterns.trend, 'declining');
  });
  
  test('identifyPatterns - detects common issues', () => {
    const context = new SequentialDecisionContext();
    
    context.addDecision({ score: 5, issues: ['contrast', 'navigation'] });
    context.addDecision({ score: 6, issues: ['contrast', 'spacing'] });
    context.addDecision({ score: 7, issues: ['contrast'] });
    
    const patterns = context.identifyPatterns();
    
    assert.ok(patterns.commonIssues.includes('contrast'));
  });
  
  test('identifyPatterns - detects inconsistency', () => {
    const context = new SequentialDecisionContext();
    
    context.addDecision({ score: 2 });
    context.addDecision({ score: 9 });
    context.addDecision({ score: 3 });
    
    const patterns = context.identifyPatterns();
    
    assert.strictEqual(patterns.isConsistent, false);
    assert.ok(patterns.scoreVariance > 2.0);
  });
  
  test('adaptPrompt - returns base prompt when no history', () => {
    const context = new SequentialDecisionContext();
    const basePrompt = 'Evaluate this screenshot';
    
    const adapted = context.adaptPrompt(basePrompt, {});
    
    assert.strictEqual(adapted, basePrompt);
  });
  
  test('adaptPrompt - adapts based on history', () => {
    const context = new SequentialDecisionContext();
    context.addDecision({ score: 5, issues: ['contrast'] });
    context.addDecision({ score: 6, issues: ['contrast'] });
    
    const basePrompt = 'Evaluate this screenshot';
    const adapted = context.adaptPrompt(basePrompt, {});
    
    assert.ok(adapted.includes(basePrompt));
    assert.ok(adapted.includes('Previous Evaluation Context'));
    assert.ok(adapted.includes('contrast')); // Recurring issue
  });
  
  test('adaptPrompt - respects adaptationEnabled flag', () => {
    const context = new SequentialDecisionContext({ adaptationEnabled: false });
    context.addDecision({ score: 5 });
    
    const basePrompt = 'Evaluate this screenshot';
    const adapted = context.adaptPrompt(basePrompt, {});
    
    assert.strictEqual(adapted, basePrompt);
  });
  
  test('getContext - returns current context', () => {
    const context = new SequentialDecisionContext();
    context.addDecision({ score: 8 });
    context.addDecision({ score: 9 });
    
    const ctx = context.getContext();
    
    assert.strictEqual(ctx.historyLength, 2);
    assert.strictEqual(ctx.recentDecisions.length, 2);
    assert.ok(ctx.patterns);
  });
});

describe('humanPerceptionTime', () => {
  test('reading - calculates based on content length', () => {
    const time = humanPerceptionTime('reading', { contentLength: 500 });
    
    // 500 chars = ~100 words, at 250 wpm = ~24 seconds = ~24000ms
    // But clamped to 1s-30s range
    assert.ok(time >= 1000);
    assert.ok(time <= 30000);
  });
  
  test('reading - respects minimum time', () => {
    const time = humanPerceptionTime('reading', { contentLength: 0 });
    
    assert.ok(time >= 1000); // Minimum 1s
  });
  
  test('interaction - returns quick time', () => {
    const time = humanPerceptionTime('interaction', {});
    
    assert.ok(time >= 100); // Minimum 0.1s
    assert.ok(time <= 10000); // Reasonable upper bound
  });
  
  test('page-load - returns normal time', () => {
    const time = humanPerceptionTime('page-load', {});
    
    assert.ok(time >= 100);
    assert.ok(time <= 10000);
  });
  
  test('adjusts for attention level', () => {
    const focused = humanPerceptionTime('interaction', { attentionLevel: 'focused' });
    const normal = humanPerceptionTime('interaction', { attentionLevel: 'normal' });
    const distracted = humanPerceptionTime('interaction', { attentionLevel: 'distracted' });
    
    assert.ok(focused <= normal);
    assert.ok(normal <= distracted);
  });
  
  test('adjusts for action complexity', () => {
    const simple = humanPerceptionTime('interaction', { actionComplexity: 'simple' });
    const normal = humanPerceptionTime('interaction', { actionComplexity: 'normal' });
    const complex = humanPerceptionTime('interaction', { actionComplexity: 'complex' });
    
    assert.ok(simple <= normal);
    assert.ok(normal <= complex);
  });
  
  test('adjusts for persona', () => {
    const powerUser = humanPerceptionTime('interaction', {
      persona: { name: 'Power User' }
    });
    const normal = humanPerceptionTime('interaction', {});
    const careful = humanPerceptionTime('interaction', {
      persona: { name: 'Accessibility Focused User' }
    });
    
    assert.ok(powerUser <= normal);
    assert.ok(normal <= careful);
  });
  
  test('visual-appeal - returns 50ms base', () => {
    const time = humanPerceptionTime('visual-appeal', {});
    
    // Should be close to 50ms, but adjusted for other factors
    assert.ok(time >= 50);
    assert.ok(time <= 1000);
  });
  
  test('ensures minimum 100ms', () => {
    const time = humanPerceptionTime('interaction', {
      attentionLevel: 'focused',
      actionComplexity: 'simple',
      persona: { name: 'Power User' }
    });
    
    assert.ok(time >= 100); // Research-based minimum
  });
});

describe('aggregateMultiScale', () => {
  test('empty notes returns empty scales', () => {
    const result = aggregateMultiScale([]);
    
    assert.ok(result);
    assert.deepStrictEqual(result.scales, {});
    assert.strictEqual(result.summary, 'No notes available');
  });
  
  test('aggregates at multiple time scales', () => {
    const now = Date.now();
    const notes = [
      { timestamp: now, elapsed: 0, score: 8, observation: 'Start' },
      { timestamp: now + 500, elapsed: 500, score: 9, observation: 'Middle' },
      { timestamp: now + 5000, elapsed: 5000, score: 8, observation: 'End' }
    ];
    
    const result = aggregateMultiScale(notes);
    
    assert.ok(result.scales.immediate);
    assert.ok(result.scales.short);
    assert.ok(result.scales.medium);
    assert.ok(result.scales.long);
  });
  
  test('attention-based weighting', () => {
    const now = Date.now();
    const notes = [
      {
        timestamp: now,
        elapsed: 0,
        score: 8,
        observation: 'Start',
        attentionLevel: 'focused',
        salience: 'high'
      },
      {
        timestamp: now + 1000,
        elapsed: 1000,
        score: 5,
        observation: 'Middle',
        attentionLevel: 'distracted',
        salience: 'normal'
      }
    ];
    
    const result = aggregateMultiScale(notes, { attentionWeights: true });
    
    // High salience, focused attention should have higher weight
    assert.ok(result.scales.short.windows.length > 0);
  });
  
  test('calculates coherence per scale', () => {
    const now = Date.now();
    const notes = [
      { timestamp: now, elapsed: 0, score: 8 },
      { timestamp: now + 1000, elapsed: 1000, score: 9 },
      { timestamp: now + 2000, elapsed: 2000, score: 8 }
    ];
    
    const result = aggregateMultiScale(notes);
    
    for (const scale of Object.values(result.scales)) {
      assert.ok(scale.coherence >= 0);
      assert.ok(scale.coherence <= 1);
    }
  });
  
  test('custom time scales', () => {
    const now = Date.now();
    const notes = [
      { timestamp: now, elapsed: 0, score: 8 }
    ];
    
    const result = aggregateMultiScale(notes, {
      timeScales: {
        custom1: 500,
        custom2: 2000
      }
    });
    
    assert.ok(result.scales.custom1);
    assert.ok(result.scales.custom2);
  });
  
  test('generates summary', () => {
    const now = Date.now();
    const notes = [
      { timestamp: now, elapsed: 0, score: 8 },
      { timestamp: now + 10000, elapsed: 10000, score: 9 }
    ];
    
    const result = aggregateMultiScale(notes);
    
    assert.ok(result.summary);
    assert.ok(result.summary.includes('scale'));
  });
  
  // CRITICAL BUG FIX TESTS (2025-01)
  
  test('aggregateMultiScale - handles sparse arrays (no undefined entries)', () => {
    // CRITICAL BUG FIX: aggregateMultiScale() could produce sparse arrays with undefined entries
    // The fix: Filter out undefined entries before mapping
    // 
    // The problem:
    // - Empty windows could cause undefined entries in windows array
    // - Accessing avgScore on undefined would throw
    // 
    // The fix: Filter out undefined entries before mapping
    
    const now = Date.now();
    // Create notes that might produce empty windows at some scales
    const notes = [
      { timestamp: now, elapsed: 0, score: 8, observation: 'Start' },
      { timestamp: now + 50000, elapsed: 50000, score: 9, observation: 'End' } // 50s apart
    ];
    
    const result = aggregateMultiScale(notes);
    
    // CRITICAL: All windows should have valid avgScore (no undefined)
    for (const scale of Object.values(result.scales)) {
      if (scale.windows && scale.windows.length > 0) {
        for (const window of scale.windows) {
          assert.ok(window.avgScore !== undefined,
            'Window avgScore should not be undefined (sparse array bug fixed)');
          assert.ok(typeof window.avgScore === 'number',
            'Window avgScore should be a number');
          assert.ok(!isNaN(window.avgScore) && isFinite(window.avgScore),
            'Window avgScore should be valid number');
        }
      }
    }
  });
  
  test('aggregateMultiScale - handles empty windows gracefully', () => {
    // CRITICAL BUG FIX: generateMultiScaleSummary() could access avgScore on undefined windows
    // The fix: Defensive checks for firstWindow, lastWindow, avgScore
    // 
    // The problem:
    // - Empty windows could cause undefined entries
    // - generateMultiScaleSummary() would try to access avgScore on undefined
    // 
    // The fix: Defensive checks before accessing avgScore
    
    const now = Date.now();
    // Create notes that might produce empty windows
    const notes = [
      { timestamp: now, elapsed: 0, score: 8 }
      // Only one note - some scales might have empty windows
    ];
    
    const result = aggregateMultiScale(notes);
    
    // CRITICAL: Summary should be generated without errors (even with empty windows)
    assert.ok(result.summary, 'Summary should be generated even with empty windows');
    assert.strictEqual(typeof result.summary, 'string',
      'Summary should be a string');
    
    // All scales should have valid coherence (even if windows are empty)
    for (const scale of Object.values(result.scales)) {
      assert.ok(scale.coherence !== undefined,
        'Scale coherence should not be undefined');
      assert.ok(scale.coherence >= 0 && scale.coherence <= 1,
        'Scale coherence should be in [0, 1] range');
    }
  });
  
  test('aggregateMultiScale - filters undefined entries before mapping', () => {
    // CRITICAL: The fix filters out undefined entries before mapping
    // This prevents sparse arrays and undefined avgScore errors
    
    const now = Date.now();
    const notes = [
      { timestamp: now, elapsed: 0, score: 8 },
      { timestamp: now + 1000, elapsed: 1000, score: 9 },
      { timestamp: now + 2000, elapsed: 2000, score: 8 }
    ];
    
    const result = aggregateMultiScale(notes);
    
    // CRITICAL: All windows arrays should not contain undefined entries
    for (const scale of Object.values(result.scales)) {
      if (scale.windows) {
        // Check that windows array has no undefined entries
        const hasUndefined = scale.windows.some(w => w === undefined);
        assert.strictEqual(hasUndefined, false,
          'Windows array should not contain undefined entries (sparse array bug fixed)');
        
        // All windows should have valid structure
        for (const window of scale.windows) {
          assert.ok(window !== undefined, 'Window should not be undefined');
          assert.ok(window !== null, 'Window should not be null');
          assert.ok(window.avgScore !== undefined, 'Window should have avgScore');
        }
      }
    }
  });
  
  // EDGE CASE TESTS
  
  test('aggregateMultiScale - handles empty notes array', () => {
    // Edge case: Empty notes array
    const result = aggregateMultiScale([]);
    
    assert.ok(result);
    assert.deepStrictEqual(result.scales, {});
    assert.strictEqual(result.summary, 'No notes available');
  });
  
  test('aggregateMultiScale - handles single note', () => {
    // Edge case: Only one note
    const now = Date.now();
    const notes = [
      { timestamp: now, elapsed: 0, score: 8, observation: 'Single note' }
    ];
    
    const result = aggregateMultiScale(notes);
    
    assert.ok(result);
    assert.ok(result.scales);
    // Single note might produce empty windows at some scales, but should not throw
    assert.ok(result.summary);
  });
  
  test('aggregateMultiScale - handles very large note arrays', () => {
    // Edge case: Performance test with many notes
    const now = Date.now();
    const notes = Array.from({ length: 1000 }, (_, i) => ({
      timestamp: now + i * 100,
      elapsed: i * 100,
      score: 7 + (i % 3),
      observation: `Note ${i}`
    }));
    
    const startTime = Date.now();
    const result = aggregateMultiScale(notes);
    const duration = Date.now() - startTime;
    
    assert.ok(result, 'Should handle large note arrays');
    assert.ok(result.scales, 'Should produce scales');
    // Performance check: should complete in reasonable time (<2s for 1000 notes)
    assert.ok(duration < 2000, `Should complete quickly (${duration}ms for 1000 notes)`);
  });
  
  test('SequentialDecisionContext - handles empty history', () => {
    // Edge case: No decision history
    const context = new SequentialDecisionContext();
    
    const patterns = context.identifyPatterns();
    // identifyPatterns() returns {} when history.length < 2
    assert.ok(patterns);
    assert.deepStrictEqual(patterns, {});
    
    const adapted = context.adaptPrompt('Base prompt', {});
    assert.strictEqual(adapted, 'Base prompt');
  });
  
  test('SequentialDecisionContext - boundary condition: exactly maxHistory', () => {
    // Edge case: Exactly at maxHistory limit
    const context = new SequentialDecisionContext({ maxHistory: 3 });
    
    context.addDecision({ score: 1 });
    context.addDecision({ score: 2 });
    context.addDecision({ score: 3 });
    
    assert.strictEqual(context.history.length, 3);
    
    // Adding one more should remove the first
    context.addDecision({ score: 4 });
    assert.strictEqual(context.history.length, 3);
    assert.strictEqual(context.history[0].score, 2); // First one removed
    assert.strictEqual(context.history[2].score, 4); // New one added
  });
  
  test('humanPerceptionTime - boundary conditions', () => {
    // Edge case: Minimum and maximum values
    const minTime = humanPerceptionTime('interaction', {
      attentionLevel: 'focused',
      actionComplexity: 'simple',
      persona: { name: 'Power User' }
    });
    
    assert.ok(minTime >= 100, 'Minimum time should be at least 100ms');
    
    const maxTime = humanPerceptionTime('reading', {
      contentLength: 100000, // Very long content
      attentionLevel: 'distracted',
      actionComplexity: 'complex',
      persona: { name: 'Accessibility Focused User' }
    });
    
    // Reading time is clamped to MAX_READING_LONG (which might be >60s for very long content)
    // Check that it's at least 1s and reasonable (not infinite)
    assert.ok(maxTime >= 1000, 'Reading time should be at least 1s');
    // For 100k characters with distracted attention and complex action, might exceed 60s
    // So we just check it's not infinite and reasonable
    assert.ok(maxTime < 120000, 'Reading time should be reasonable (<120s for very long content)');
  });
  
  test('humanPerceptionTime - handles invalid inputs gracefully', () => {
    // Edge case: Invalid or missing inputs
    // humanPerceptionTime validates inputs and throws errors for invalid types
    // So we test that it throws appropriately
    
    assert.throws(() => {
      humanPerceptionTime('invalid-type', {});
    }, /Invalid action/, 'Invalid action type should throw error');
    
    // Invalid attention level also throws error
    assert.throws(() => {
      humanPerceptionTime('interaction', {
        attentionLevel: 'invalid-level' // Invalid level throws error
      });
    }, /Invalid attentionLevel/, 'Invalid attention level should throw error');
    
    // Negative content length also throws error
    assert.throws(() => {
      humanPerceptionTime('interaction', {
        contentLength: -100 // Negative content length throws error
      });
    }, /contentLength must be a non-negative number/, 'Negative content length should throw error');
    
    // But valid inputs with missing optional fields should work
    const time = humanPerceptionTime('interaction', {
      // No contentLength (optional, defaults to 0)
    });
    // Should return valid time
    assert.ok(time >= 100, 'Valid inputs should return valid time');
  });
});

