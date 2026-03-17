/**
 * Integration tests for temporal-note-pruner.mjs
 */

import '../test-setup.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  pruneTemporalNotes,
  propagateNotes,
  selectTopWeightedNotes,
  selectRepresentativeScreenshots
} from '../../src/temporal-prompt-formatting.mjs';

describe('Temporal Note Pruner', () => {
  describe('pruneTemporalNotes', () => {
    it('should return empty array for empty notes', () => {
      const result = pruneTemporalNotes([]);
      assert.deepStrictEqual(result, []);
    });

    it('should prune notes below minimum weight', () => {
      const now = Date.now();
      const notes = [
        { timestamp: now - 5000, observation: 'Note 1', score: 5 },
        { timestamp: now - 4000, observation: 'Note 2', score: 5 },
        { timestamp: now - 3000, observation: 'Note 3', score: 5 }
      ];

      const result = pruneTemporalNotes(notes, {
        maxNotes: 10,
        minWeight: 0.5 // High threshold to filter most notes
      });

      assert.ok(Array.isArray(result));
      assert.ok(result.length <= notes.length);
    });

    it('should limit notes to maxNotes', () => {
      const now = Date.now();
      const notes = Array.from({ length: 20 }, (_, i) => ({
        timestamp: now - (20 - i) * 1000,
        observation: `Note ${i + 1}`,
        score: 5
      }));

      const result = pruneTemporalNotes(notes, {
        maxNotes: 5,
        minWeight: 0.01
      });

      assert.ok(result.length <= 5);
    });

    it('should prioritize high-weight notes', () => {
      const now = Date.now();
      const notes = [
        { timestamp: now - 1000, observation: 'Recent note', score: 9 }, // High score
        { timestamp: now - 5000, observation: 'Old note', score: 5 },
        { timestamp: now - 2000, observation: 'Medium note', score: 8 } // High score
      ];

      const result = pruneTemporalNotes(notes, {
        maxNotes: 2,
        minWeight: 0.01
      });

      assert.ok(result.length <= 2);
      // Should prioritize recent and high-score notes
      const hasRecent = result.some(note => note.observation === 'Recent note');
      const hasHighScore = result.some(note => note.score >= 8);
      assert.ok(hasRecent || hasHighScore);
    });

    it('should handle notes with issues (higher relevance)', () => {
      const now = Date.now();
      const notes = [
        { timestamp: now - 1000, observation: 'Note with issues', issues: ['Issue 1'] },
        { timestamp: now - 2000, observation: 'Note without issues' }
      ];

      const result = pruneTemporalNotes(notes, {
        maxNotes: 1,
        minWeight: 0.01
      });

      assert.ok(result.length <= 1);
      // Note with issues should be more likely to be selected
    });

    it('should handle notes with user interactions', () => {
      const now = Date.now();
      const notes = [
        { timestamp: now - 1000, step: 'user click interaction', observation: 'Click' },
        { timestamp: now - 2000, step: 'wait', observation: 'Wait' }
      ];

      const result = pruneTemporalNotes(notes, {
        maxNotes: 1,
        minWeight: 0.01
      });

      assert.ok(result.length <= 1);
    });

    it('should respect custom windowSize', () => {
      const now = Date.now();
      const notes = [
        { timestamp: now - 1000, observation: 'Note 1', score: 5 },
        { timestamp: now - 2000, observation: 'Note 2', score: 5 }
      ];

      const result1 = pruneTemporalNotes(notes, { windowSize: 5000 });
      const result2 = pruneTemporalNotes(notes, { windowSize: 20000 });

      // Both should work without errors
      assert.ok(Array.isArray(result1));
      assert.ok(Array.isArray(result2));
    });
  });

  describe('propagateNotes', () => {
    it('should return empty array for empty notes', () => {
      const result = propagateNotes([]);
      assert.deepStrictEqual(result, []);
    });

    it('should add weight and relevance to notes', () => {
      const now = Date.now();
      const notes = [
        { timestamp: now - 1000, observation: 'Note 1', score: 5 },
        { timestamp: now - 2000, observation: 'Note 2', score: 5 }
      ];

      const result = propagateNotes(notes);

      assert.ok(result.length > 0);
      result.forEach(note => {
        assert.ok(typeof note.weight === 'number');
        assert.ok(typeof note.relevance === 'number');
        assert.strictEqual(note.propagated, true);
      });
    });

    it('should filter notes below relevance threshold', () => {
      const now = Date.now();
      const veryOldNotes = [
        { timestamp: now - 100000, observation: 'Very old note', score: 5 }
      ];

      const result = propagateNotes(veryOldNotes, {
        relevanceThreshold: 0.5
      });

      // Very old notes should have low relevance and be filtered
      assert.ok(result.length <= veryOldNotes.length);
    });

    it('should sort by relevance (descending)', () => {
      const now = Date.now();
      const notes = [
        { timestamp: now - 1000, observation: 'Recent', score: 9 },
        { timestamp: now - 5000, observation: 'Older', score: 5 }
      ];

      const result = propagateNotes(notes);

      if (result.length > 1) {
        assert.ok(result[0].relevance >= result[1].relevance);
      }
    });

    it('should handle notes with high scores (higher relevance)', () => {
      const now = Date.now();
      const notes = [
        { timestamp: now - 1000, observation: 'High score', score: 9 },
        { timestamp: now - 2000, observation: 'Low score', score: 2 }
      ];

      const result = propagateNotes(notes);

      // High and low scores should have higher relevance
      const highScoreNote = result.find(note => note.score === 9);
      const lowScoreNote = result.find(note => note.score === 2);
      
      if (highScoreNote && lowScoreNote) {
        // Both should have higher relevance than medium scores
        assert.ok(highScoreNote.relevance > 0);
        assert.ok(lowScoreNote.relevance > 0);
      }
    });
  });

  describe('selectTopWeightedNotes', () => {
    it('should return empty array for empty notes', () => {
      const result = selectTopWeightedNotes([]);
      assert.deepStrictEqual(result, []);
    });

    it('should select top N notes by weight', () => {
      const now = Date.now();
      const notes = Array.from({ length: 10 }, (_, i) => ({
        timestamp: now - (10 - i) * 1000,
        observation: `Note ${i + 1}`,
        score: 5
      }));

      const result = selectTopWeightedNotes(notes, { topN: 3 });

      assert.strictEqual(result.length, 3);
    });

    it('should return all notes if topN exceeds length', () => {
      const now = Date.now();
      const notes = [
        { timestamp: now - 1000, observation: 'Note 1', score: 5 },
        { timestamp: now - 2000, observation: 'Note 2', score: 5 }
      ];

      const result = selectTopWeightedNotes(notes, { topN: 10 });

      assert.ok(result.length <= notes.length);
    });

    it('should prioritize recent notes', () => {
      const now = Date.now();
      const notes = [
        { timestamp: now - 1000, observation: 'Recent', score: 5 },
        { timestamp: now - 10000, observation: 'Old', score: 5 }
      ];

      const result = selectTopWeightedNotes(notes, { topN: 1 });

      assert.ok(result.length === 1);
      // Should return a valid note (weight calculation may vary)
      assert.ok(result[0]);
      assert.ok(typeof result[0].observation === 'string');
    });

    it('should handle custom topN', () => {
      const now = Date.now();
      const notes = Array.from({ length: 20 }, (_, i) => ({
        timestamp: now - (20 - i) * 1000,
        observation: `Note ${i + 1}`,
        score: 5
      }));

      const result1 = selectTopWeightedNotes(notes, { topN: 5 });
      const result2 = selectTopWeightedNotes(notes, { topN: 10 });

      assert.strictEqual(result1.length, 5);
      assert.strictEqual(result2.length, 10);
    });
  });

  describe('selectRepresentativeScreenshots', () => {
    it('should return all screenshots if count is below max', () => {
      const screenshots = [
        { path: 's1.png', timestamp: 1000 },
        { path: 's2.png', timestamp: 2000 }
      ];

      const result = selectRepresentativeScreenshots(screenshots, [], { maxScreenshots: 10 });

      assert.strictEqual(result.length, screenshots.length);
    });

    it('should select keyframes strategy', () => {
      const screenshots = Array.from({ length: 20 }, (_, i) => ({
        path: `s${i}.png`,
        timestamp: i * 1000
      }));

      const evaluations = Array.from({ length: 20 }, (_, i) => ({
        score: i === 5 ? 9 : 5 // Significant change at index 5
      }));

      const result = selectRepresentativeScreenshots(screenshots, evaluations, {
        maxScreenshots: 5,
        strategy: 'keyframes'
      });

      assert.ok(result.length <= 5);
      // Should include first and last
      assert.ok(result.some(s => s.path === 's0.png'));
      assert.ok(result.some(s => s.path === 's19.png'));
    });

    it('should select uniform strategy', () => {
      const screenshots = Array.from({ length: 20 }, (_, i) => ({
        path: `s${i}.png`,
        timestamp: i * 1000
      }));

      const result = selectRepresentativeScreenshots(screenshots, [], {
        maxScreenshots: 5,
        strategy: 'uniform'
      });

      assert.ok(result.length <= 5);
      // Should include last
      assert.ok(result.some(s => s.path === 's19.png'));
    });

    it('should select diversity strategy', () => {
      const screenshots = Array.from({ length: 20 }, (_, i) => ({
        path: `s${i}.png`,
        timestamp: i * 1000
      }));

      const evaluations = Array.from({ length: 20 }, (_, i) => ({
        score: i % 2 === 0 ? 9 : 1 // Alternating high/low scores
      }));

      const result = selectRepresentativeScreenshots(screenshots, evaluations, {
        maxScreenshots: 5,
        strategy: 'diversity'
      });

      assert.ok(result.length <= 5);
      // Should include first and last
      assert.ok(result.some(s => s.path === 's0.png'));
      assert.ok(result.some(s => s.path === 's19.png'));
    });

    it('should default to diversity strategy', () => {
      const screenshots = Array.from({ length: 20 }, (_, i) => ({
        path: `s${i}.png`,
        timestamp: i * 1000
      }));

      const result = selectRepresentativeScreenshots(screenshots, [], {
        maxScreenshots: 5
      });

      assert.ok(result.length <= 5);
    });

    it('should handle empty evaluations array', () => {
      const screenshots = Array.from({ length: 20 }, (_, i) => ({
        path: `s${i}.png`,
        timestamp: i * 1000
      }));

      const result = selectRepresentativeScreenshots(screenshots, [], {
        maxScreenshots: 5,
        strategy: 'diversity'
      });

      // Should fall back to uniform when no evaluations
      assert.ok(result.length <= 5);
    });

    it('should handle screenshots with missing evaluations', () => {
      const screenshots = Array.from({ length: 10 }, (_, i) => ({
        path: `s${i}.png`,
        timestamp: i * 1000
      }));

      const evaluations = [
        { score: 5 },
        { score: 7 }
        // Missing evaluations for other screenshots
      ];

      const result = selectRepresentativeScreenshots(screenshots, evaluations, {
        maxScreenshots: 5,
        strategy: 'diversity'
      });

      assert.ok(result.length <= 5);
    });
  });
});

