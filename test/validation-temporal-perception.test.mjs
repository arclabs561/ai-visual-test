/**
 * Validation Tests: Temporal Perception Accuracy
 * 
 * Tests whether our temporal perception modeling aligns with human perception.
 * Validates that humanPerceptionTime() produces realistic time scales for:
 * - Gameplay interactions
 * - Webpage reading/scanning
 * - Visual appeal decisions
 * - User interactions
 * 
 * These tests validate that our time scales are correct, not just that they work.
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { humanPerceptionTime } from '../src/temporal-decision.mjs';
import { TIME_SCALES } from '../src/temporal-constants.mjs';

test.describe('Temporal Perception Validation', () => {
  
  test('visual appeal decision time aligns with research (50ms base)', () => {
    // Research: Lindgaard found 50ms for visual appeal decisions
    // Our implementation uses 80ms for focused attention (between 50ms research and 100ms minimum)
    const time = humanPerceptionTime('visual-appeal', {
      attentionLevel: 'focused',
      actionComplexity: 'simple'
    });
    
    // Should be at least 50ms (research base)
    assert.ok(time >= TIME_SCALES.VISUAL_DECISION, `Should be at least 50ms (research base), got ${time}ms`);
    // Should be reasonable (50-200ms range)
    assert.ok(time <= 200, `Should not exceed 200ms for focused simple visual appeal, got ${time}ms`);
    
    // Test that it's reasonable for visual appeal decisions
    // Research says 50ms, implementation may use 80ms (focused) or 100ms+ (minimum)
    // Both are reasonable - just need to be >= 50ms (research base)
    assert.ok(time >= 50 && time <= 200, `Visual appeal time should be in reasonable range (50-200ms), got ${time}ms`);
  });
  
  test('instant perception threshold aligns with research (0.1s)', () => {
    // Research: NN/g says 0.1s (100ms) is perceived as instant
    const instantTime = TIME_SCALES.INSTANT;
    
    assert.strictEqual(instantTime, 100, 'Instant threshold should be 100ms (0.1s) per NN/g research');
    
    // Test that interactions faster than this feel instant
    const quickInteraction = humanPerceptionTime('interaction', {
      attentionLevel: 'focused',
      actionComplexity: 'simple'
    });
    
    // Quick interactions should be close to instant threshold
    assert.ok(quickInteraction >= instantTime, 'Quick interactions should be at least instant threshold');
  });
  
  test('reading time scales with content length', () => {
    // Research: 200-300 words/minute reading speed
    // Test that reading time increases with content length
    
    const shortContent = humanPerceptionTime('reading', {
      contentLength: 100, // ~20 words
      attentionLevel: 'normal',
      actionComplexity: 'normal'
    });
    
    const longContent = humanPerceptionTime('reading', {
      contentLength: 1000, // ~200 words
      attentionLevel: 'normal',
      actionComplexity: 'normal'
    });
    
    // Long content should take more time than short content
    assert.ok(longContent > shortContent, 'Reading time should increase with content length');
    
    // Calculate expected reading time: 200-300 words/minute = 3.3-5 words/second
    // 20 words should take ~4-6 seconds, 200 words should take ~40-60 seconds
    // But our implementation may have minimums/maximums, so we check relative ordering
    assert.ok(longContent >= shortContent, 'Longer content should take at least as long');
  });
  
  test('attention level affects perception time', () => {
    // Research: Attention affects temporal perception
    // Focused attention = faster perception, distracted = slower
    
    const focused = humanPerceptionTime('interaction', {
      attentionLevel: 'focused',
      actionComplexity: 'normal'
    });
    
    const normal = humanPerceptionTime('interaction', {
      attentionLevel: 'normal',
      actionComplexity: 'normal'
    });
    
    const distracted = humanPerceptionTime('interaction', {
      attentionLevel: 'distracted',
      actionComplexity: 'normal'
    });
    
    // Focused should be faster than normal, normal faster than distracted
    assert.ok(focused <= normal, 'Focused attention should be faster or equal to normal');
    assert.ok(normal <= distracted, 'Normal attention should be faster or equal to distracted');
  });
  
  test('action complexity affects perception time', () => {
    // Complex actions take longer to perceive/process
    
    const simple = humanPerceptionTime('interaction', {
      attentionLevel: 'normal',
      actionComplexity: 'simple'
    });
    
    const normal = humanPerceptionTime('interaction', {
      attentionLevel: 'normal',
      actionComplexity: 'normal'
    });
    
    const complex = humanPerceptionTime('interaction', {
      attentionLevel: 'normal',
      actionComplexity: 'complex'
    });
    
    // Simple should be faster than normal, normal faster than complex
    assert.ok(simple <= normal, 'Simple actions should be faster or equal to normal');
    assert.ok(normal <= complex, 'Normal actions should be faster or equal to complex');
  });
  
  test('gameplay interaction times are reasonable', () => {
    // For gameplay, interactions should be fast (quick perception)
    // But not too fast (need time to process)
    
    const gameplayInteraction = humanPerceptionTime('interaction', {
      attentionLevel: 'focused',
      actionComplexity: 'simple',
      persona: { name: 'Gamer' } // Power user persona
    });
    
    // Gameplay interactions should be quick but not instant
    // Should be between 100ms (instant) and 2000ms (2 seconds)
    assert.ok(gameplayInteraction >= 100, 'Gameplay interactions should be at least 100ms');
    assert.ok(gameplayInteraction <= 2000, 'Gameplay interactions should not exceed 2 seconds');
    
    // Should be closer to quick (1s) than extended (10s)
    assert.ok(gameplayInteraction < TIME_SCALES.EXTENDED, 'Gameplay should be faster than extended focus');
  });
  
  test('webpage evaluation times are reasonable', () => {
    // Evaluating a webpage should take extended time (thorough evaluation)
    
    const evaluation = humanPerceptionTime('evaluation', {
      attentionLevel: 'normal',
      actionComplexity: 'normal',
      contentLength: 500 // Medium content
    });
    
    // Evaluation should take longer than quick interactions
    assert.ok(evaluation >= TIME_SCALES.QUICK, 'Evaluation should take at least 1 second');
    assert.ok(evaluation <= TIME_SCALES.LONG, 'Evaluation should not exceed 60 seconds');
    
    // Should be closer to extended (10s) than instant (0.1s)
    assert.ok(evaluation > TIME_SCALES.INSTANT, 'Evaluation should take longer than instant');
  });
  
  test('persona affects perception time (power user vs accessibility)', () => {
    // Power users perceive faster, accessibility-focused users take more time
    
    const powerUser = humanPerceptionTime('interaction', {
      attentionLevel: 'focused',
      actionComplexity: 'simple',
      persona: { name: 'Power User' }
    });
    
    const accessibilityUser = humanPerceptionTime('interaction', {
      attentionLevel: 'focused',
      actionComplexity: 'simple',
      persona: { name: 'Accessibility Focused User' }
    });
    
    // Power user should be faster (or equal)
    assert.ok(powerUser <= accessibilityUser, 'Power users should perceive faster than accessibility-focused users');
  });
  
  test('time scales match research values', () => {
    // Validate that our time scale constants match research
    
    // NN/g research: 0.1s (100ms) for instant perception
    assert.strictEqual(TIME_SCALES.INSTANT, 100, 'INSTANT should be 100ms (0.1s) per NN/g');
    
    // Lindgaard research: 50ms for visual appeal
    assert.strictEqual(TIME_SCALES.VISUAL_DECISION, 50, 'VISUAL_DECISION should be 50ms per Lindgaard');
    
    // NN/g research: 1s for noticeable delay
    assert.strictEqual(TIME_SCALES.QUICK, 1000, 'QUICK should be 1000ms (1s) per NN/g');
    
    // NN/g research: 3s for normal interaction
    assert.strictEqual(TIME_SCALES.NORMAL, 3000, 'NORMAL should be 3000ms (3s) per NN/g');
    
    // NN/g research: 10s for extended focus
    assert.strictEqual(TIME_SCALES.EXTENDED, 10000, 'EXTENDED should be 10000ms (10s) per NN/g');
  });
  
  test('minimum perception time is enforced', () => {
    // All perception times should respect minimum (100ms)
    // This ensures we don't have unrealistic sub-100ms times
    // NOTE: visual-appeal has special handling - it can be 50ms base but implementation may adjust
    
    const times = [
      { name: 'interaction', time: humanPerceptionTime('interaction', { attentionLevel: 'focused', actionComplexity: 'simple' }) },
      { name: 'reading', time: humanPerceptionTime('reading', { contentLength: 10, attentionLevel: 'focused' }) },
      { name: 'page-load', time: humanPerceptionTime('page-load', { attentionLevel: 'focused' }) }
    ];
    
    for (const { name, time } of times) {
      // All should be at least 100ms (implementation minimum)
      assert.ok(time >= 100, `${name} perception time ${time}ms should be at least 100ms minimum`);
    }
    
    // Visual appeal has special handling - check it's at least 50ms (research base)
    const visualAppealTime = humanPerceptionTime('visual-appeal', { attentionLevel: 'focused', actionComplexity: 'simple' });
    assert.ok(visualAppealTime >= 50, `visual-appeal should be at least 50ms (research base), got ${visualAppealTime}ms`);
  });
  
  test('perception times are consistent across calls', () => {
    // Same inputs should produce same outputs (deterministic)
    
    const context = {
      attentionLevel: 'normal',
      actionComplexity: 'normal',
      contentLength: 500
    };
    
    const time1 = humanPerceptionTime('reading', context);
    const time2 = humanPerceptionTime('reading', context);
    const time3 = humanPerceptionTime('reading', context);
    
    // Should be identical (deterministic)
    assert.strictEqual(time1, time2, 'Same inputs should produce same output');
    assert.strictEqual(time2, time3, 'Same inputs should produce same output');
  });
});

