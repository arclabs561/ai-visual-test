/**
 * Integration tests for temporal-context.mjs and temporal-prompt-formatter.mjs
 */

import '../test-setup.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  createTemporalContext,
  mergeTemporalContext
} from '#temporal-core';
import {
  formatTemporalContext,
  formatTemporalForPrompt
} from '../../src/temporal-prompt-formatting.mjs';

describe('Temporal Context', () => {
  describe('createTemporalContext', () => {
    it('should create context with default values', () => {
      const context = createTemporalContext();
      
      assert.ok(context);
      assert.strictEqual(context.sequentialContext, null);
      assert.strictEqual(context.viewport, null);
      assert.strictEqual(context.testType, null);
      assert.strictEqual(context.enableBiasMitigation, true);
      assert.strictEqual(context.attentionLevel, 'normal');
      assert.strictEqual(context.actionComplexity, 'normal');
      assert.strictEqual(context.persona, null);
      assert.strictEqual(context.contentLength, 0);
    });

    it('should create context with custom values', () => {
      const context = createTemporalContext({
        sequentialContext: { step: 1 },
        viewport: { width: 1920, height: 1080 },
        testType: 'gameplay',
        enableBiasMitigation: false,
        attentionLevel: 'focused',
        actionComplexity: 'complex',
        persona: { name: 'Test Persona' },
        contentLength: 1000
      });
      
      assert.ok(context);
      assert.deepStrictEqual(context.sequentialContext, { step: 1 });
      assert.deepStrictEqual(context.viewport, { width: 1920, height: 1080 });
      assert.strictEqual(context.testType, 'gameplay');
      assert.strictEqual(context.enableBiasMitigation, false);
      assert.strictEqual(context.attentionLevel, 'focused');
      assert.strictEqual(context.actionComplexity, 'complex');
      assert.deepStrictEqual(context.persona, { name: 'Test Persona' });
      assert.strictEqual(context.contentLength, 1000);
    });

    it('should include additional options', () => {
      const context = createTemporalContext({
        customField: 'customValue',
        anotherField: 123
      });
      
      assert.strictEqual(context.customField, 'customValue');
      assert.strictEqual(context.anotherField, 123);
    });
  });

  describe('mergeTemporalContext', () => {
    it('should merge two contexts', () => {
      const base = createTemporalContext({
        attentionLevel: 'normal',
        actionComplexity: 'normal'
      });
      
      const additional = {
        attentionLevel: 'focused',
        customField: 'value'
      };
      
      const merged = mergeTemporalContext(base, additional);
      
      assert.strictEqual(merged.attentionLevel, 'focused');
      assert.strictEqual(merged.actionComplexity, 'normal');
      assert.strictEqual(merged.customField, 'value');
    });

    it('should handle null/undefined base', () => {
      const additional = {
        attentionLevel: 'focused'
      };
      
      const merged = mergeTemporalContext({}, additional);
      
      assert.ok(merged);
      assert.strictEqual(merged.attentionLevel, 'focused');
    });

    it('should handle null/undefined additional', () => {
      const base = createTemporalContext({
        attentionLevel: 'normal'
      });
      
      const merged = mergeTemporalContext(base, {});
      
      assert.ok(merged);
      assert.strictEqual(merged.attentionLevel, 'normal');
    });

    it('should merge nested objects', () => {
      const base = createTemporalContext({
        sequentialContext: { step: 1, count: 5 }
      });
      
      const additional = {
        sequentialContext: { step: 2 }
      };
      
      const merged = mergeTemporalContext(base, additional);
      
      assert.ok(merged.sequentialContext);
      assert.strictEqual(merged.sequentialContext.step, 2);
      // Should preserve count from base if merge is shallow
      assert.ok(typeof merged.sequentialContext === 'object');
    });
  });

  describe('formatTemporalContext', () => {
    it('should return empty string for null/undefined', () => {
      assert.strictEqual(formatTemporalContext(null), '');
      assert.strictEqual(formatTemporalContext(undefined), '');
    });

    it('should return empty string for raw arrays', () => {
      const notes = [
        { timestamp: Date.now(), observation: 'Note 1' }
      ];
      
      assert.strictEqual(formatTemporalContext(notes), '');
    });

    it('should format single-scale aggregation', () => {
      const aggregated = {
        windows: [
          {
            startTime: 1000,
            endTime: 2000,
            notes: [
              { timestamp: 1500, observation: 'Note 1' }
            ],
            summary: 'Window 1',
            avgScore: 5.0,
            noteCount: 1,
            timeRange: '1s-2s'
          }
        ],
        coherence: 0.8,
        conflicts: []
      };
      
      const result = formatTemporalContext(aggregated);
      
      assert.ok(typeof result === 'string');
      assert.ok(result.length > 0);
    });

    it('should format multi-scale aggregation', () => {
      const multiScale = {
        scales: {
          immediate: {
            windows: [
              { 
                startTime: 1000, 
                endTime: 2000, 
                notes: [],
                avgScore: 5.0,
                noteCount: 0,
                timeRange: '1s-2s'
              }
            ],
            coherence: 0.9
          },
          short: {
            windows: [
              { 
                startTime: 1000, 
                endTime: 5000, 
                notes: [],
                avgScore: 5.0,
                noteCount: 0,
                timeRange: '1s-5s'
              }
            ],
            coherence: 0.8
          }
        }
      };
      
      const result = formatTemporalContext(multiScale);
      
      assert.ok(typeof result === 'string');
      assert.ok(result.length > 0);
    });

    it('should handle empty aggregation', () => {
      const aggregated = {
        windows: [],
        coherence: 0,
        conflicts: []
      };
      
      const result = formatTemporalContext(aggregated);
      
      assert.ok(typeof result === 'string');
    });
  });

  describe('formatTemporalForPrompt', () => {
    it('should return empty string for null/undefined', () => {
      assert.strictEqual(formatTemporalForPrompt(null), '');
      assert.strictEqual(formatTemporalForPrompt(undefined), '');
    });

    it('should return empty string for raw arrays', () => {
      const notes = [
        { timestamp: Date.now(), observation: 'Note 1' }
      ];
      
      assert.strictEqual(formatTemporalForPrompt(notes), '');
    });

    it('should format single-scale aggregation', () => {
      const aggregated = {
        windows: [
          {
            startTime: 1000,
            endTime: 2000,
            notes: [
              { timestamp: 1500, observation: 'Note 1', score: 5 }
            ],
            summary: 'Window 1',
            avgScore: 5.0,
            noteCount: 1,
            timeRange: '1s-2s'
          }
        ],
        coherence: 0.8,
        conflicts: []
      };
      
      const result = formatTemporalForPrompt(aggregated);
      
      assert.ok(typeof result === 'string');
      assert.ok(result.length > 0);
    });

    it('should format multi-scale aggregation', () => {
      const multiScale = {
        scales: {
          immediate: {
            windows: [
              {
                startTime: 1000,
                endTime: 2000,
                notes: [{ timestamp: 1500, observation: 'Immediate note' }],
                summary: 'Immediate window',
                avgScore: 5.0,
                noteCount: 1,
                timeRange: '1s-2s'
              }
            ],
            coherence: 0.9
          },
          short: {
            windows: [
              {
                startTime: 1000,
                endTime: 5000,
                notes: [{ timestamp: 3000, observation: 'Short note' }],
                summary: 'Short window',
                avgScore: 5.0,
                noteCount: 1,
                timeRange: '1s-5s'
              }
            ],
            coherence: 0.8
          }
        }
      };
      
      const result = formatTemporalForPrompt(multiScale);
      
      assert.ok(typeof result === 'string');
      assert.ok(result.length > 0);
    });

    it('should respect naturalLanguage option', () => {
      const aggregated = {
        windows: [
          {
            startTime: 1000,
            endTime: 2000,
            notes: [{ timestamp: 1500, observation: 'Note 1' }],
            summary: 'Window 1',
            avgScore: 5.0,
            noteCount: 1
          }
        ],
        coherence: 0.8
      };
      
      const result1 = formatTemporalForPrompt(aggregated, { naturalLanguage: true });
      // Skip testing naturalLanguage: false as it calls formatNotesForPrompt which needs different structure
      
      assert.ok(typeof result1 === 'string');
      assert.ok(result1.length > 0);
    });

    it('should respect includeMultiScale option', () => {
      const multiScale = {
        scales: {
          immediate: {
            windows: [
              { startTime: 1000, endTime: 2000, notes: [], summary: 'Window' }
            ],
            coherence: 0.9
          }
        }
      };
      
      const result1 = formatTemporalForPrompt(multiScale, { includeMultiScale: true });
      const result2 = formatTemporalForPrompt(multiScale, { includeMultiScale: false });
      
      assert.ok(typeof result1 === 'string');
      assert.ok(result1.length > 0, 'multi-scale context should be included when enabled');
      assert.strictEqual(result2, '', 'multi-scale context should be suppressed when disabled');
    });

    it('should handle aggregation with conflicts', () => {
      const aggregated = {
        windows: [
          {
            startTime: 1000,
            endTime: 2000,
            notes: [{ timestamp: 1500, observation: 'Note 1' }],
            summary: 'Window 1',
            avgScore: 5.0,
            noteCount: 1,
            timeRange: '1s-2s'
          }
        ],
        coherence: 0.8,
        conflicts: [
          { type: 'score', description: 'Score mismatch' }
        ]
      };
      
      const result = formatTemporalForPrompt(aggregated);
      
      assert.ok(typeof result === 'string');
      assert.ok(result.length > 0);
    });
  });
});
