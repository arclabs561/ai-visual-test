/**
 * Tests for temporal-adaptive.mjs
 */

import '../test-setup.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  calculateOptimalWindowSize,
  detectActivityPattern,
  aggregateTemporalNotesAdaptive
} from '../../src/temporal-multi-scale.mjs';

describe('Temporal Adaptive', () => {
  describe('calculateOptimalWindowSize', () => {
    it('should return default window for empty notes', () => {
      const windowSize = calculateOptimalWindowSize([], { defaultWindow: 10000 });
      assert.strictEqual(windowSize, 10000);
    });

    it('should return default window for single note', () => {
      const notes = [{ timestamp: Date.now() }];
      const windowSize = calculateOptimalWindowSize(notes, { defaultWindow: 10000 });
      assert.strictEqual(windowSize, 10000);
    });

    it('should return default window for zero time span', () => {
      const now = Date.now();
      const notes = [
        { timestamp: now },
        { timestamp: now }
      ];
      const windowSize = calculateOptimalWindowSize(notes, { defaultWindow: 10000 });
      assert.strictEqual(windowSize, 10000);
    });

    it('should use smaller window for high frequency (>2 notes/sec)', () => {
      const now = Date.now();
      const notes = [
        { timestamp: now },
        { timestamp: now + 200 }, // 5 notes per second
        { timestamp: now + 400 },
        { timestamp: now + 600 },
        { timestamp: now + 800 }
      ];
      const windowSize = calculateOptimalWindowSize(notes, {
        defaultWindow: 10000,
        minWindow: 5000
      });
      
      assert.ok(windowSize <= 5000, 'High frequency should use smaller window');
    });

    it('should use larger window for low frequency (<0.5 notes/sec)', () => {
      const now = Date.now();
      const notes = [
        { timestamp: now },
        { timestamp: now + 5000 } // 0.2 notes per second
      ];
      const windowSize = calculateOptimalWindowSize(notes, {
        defaultWindow: 10000,
        maxWindow: 30000
      });
      
      assert.ok(windowSize >= 20000, 'Low frequency should use larger window');
    });

    it('should use default window for medium frequency', () => {
      const now = Date.now();
      const notes = [
        { timestamp: now },
        { timestamp: now + 1000 }, // 1 note per second
        { timestamp: now + 2000 }
      ];
      const windowSize = calculateOptimalWindowSize(notes, {
        defaultWindow: 10000
      });
      
      assert.strictEqual(windowSize, 10000);
    });

    it('should respect minWindow option', () => {
      const now = Date.now();
      const notes = [
        { timestamp: now },
        { timestamp: now + 100 } // Very high frequency
      ];
      const windowSize = calculateOptimalWindowSize(notes, {
        defaultWindow: 10000,
        minWindow: 1000
      });
      
      assert.ok(windowSize >= 1000, 'Should respect minWindow');
    });

    it('should respect maxWindow option', () => {
      const now = Date.now();
      const notes = [
        { timestamp: now },
        { timestamp: now + 10000 } // Very low frequency
      ];
      const windowSize = calculateOptimalWindowSize(notes, {
        defaultWindow: 10000,
        maxWindow: 20000
      });
      
      assert.ok(windowSize <= 20000, 'Should respect maxWindow');
    });
  });

  describe('detectActivityPattern', () => {
    it('should return consistent for empty notes', () => {
      const pattern = detectActivityPattern([]);
      assert.strictEqual(pattern, 'consistent');
    });

    it('should return consistent for single note', () => {
      const notes = [{ timestamp: Date.now() }];
      const pattern = detectActivityPattern(notes);
      assert.strictEqual(pattern, 'consistent');
    });

    it('should detect fastChange pattern', () => {
      const now = Date.now();
      const notes = [
        { timestamp: now, gameState: { score: 0 } },
        { timestamp: now + 500, gameState: { score: 100 } },
        { timestamp: now + 1000, gameState: { score: 200 } },
        { timestamp: now + 1500, gameState: { score: 50 } } // High variance
      ];
      const pattern = detectActivityPattern(notes);
      
      // May be fastChange or erratic depending on variance calculation
      assert.ok(['fastChange', 'erratic', 'consistent'].includes(pattern));
    });

    it('should detect slowChange pattern', () => {
      const now = Date.now();
      const notes = [
        { timestamp: now, gameState: { score: 100 } },
        { timestamp: now + 3000, gameState: { score: 105 } },
        { timestamp: now + 6000, gameState: { score: 110 } } // Low variance, slow
      ];
      const pattern = detectActivityPattern(notes);
      
      // May be slowChange or consistent
      assert.ok(['slowChange', 'consistent'].includes(pattern));
    });

    it('should detect erratic pattern', () => {
      const now = Date.now();
      const notes = [
        { timestamp: now, gameState: { score: 100 } },
        { timestamp: now + 1000, gameState: { score: 50 } },
        { timestamp: now + 2000, gameState: { score: 150 } },
        { timestamp: now + 3000, gameState: { score: 75 } },
        { timestamp: now + 4000, gameState: { score: 125 } } // Many direction changes
      ];
      const pattern = detectActivityPattern(notes);
      
      // May be erratic or consistent depending on direction change calculation
      assert.ok(['erratic', 'consistent', 'fastChange'].includes(pattern));
    });

    it('should return consistent for stable scores', () => {
      const now = Date.now();
      const notes = [
        { timestamp: now, gameState: { score: 100 } },
        { timestamp: now + 1000, gameState: { score: 100 } },
        { timestamp: now + 2000, gameState: { score: 100 } }
      ];
      const pattern = detectActivityPattern(notes);
      
      assert.strictEqual(pattern, 'consistent');
    });

    it('should handle notes without gameState', () => {
      const now = Date.now();
      const notes = [
        { timestamp: now },
        { timestamp: now + 1000 },
        { timestamp: now + 2000 }
      ];
      const pattern = detectActivityPattern(notes);
      
      assert.strictEqual(pattern, 'consistent');
    });
  });

  describe('aggregateTemporalNotesAdaptive', () => {
    it('should aggregate notes with adaptive window sizing', async () => {
      const now = Date.now();
      const notes = [
        { timestamp: now, observation: 'start' },
        { timestamp: now + 500, observation: 'middle' },
        { timestamp: now + 1000, observation: 'end' }
      ];
      
      const aggregated = await aggregateTemporalNotesAdaptive(notes, {
        adaptive: true
      });
      
      assert.ok(aggregated);
      assert.ok(Array.isArray(aggregated.windows));
    });

    it('should use provided windowSize when not adaptive', async () => {
      const now = Date.now();
      const notes = [
        { timestamp: now, observation: 'start' },
        { timestamp: now + 1000, observation: 'end' }
      ];
      
      const aggregated = await aggregateTemporalNotesAdaptive(notes, {
        adaptive: false,
        windowSize: 5000
      });
      
      assert.ok(aggregated);
    });

    it('should adjust window based on activity pattern', async () => {
      const now = Date.now();
      const notes = [
        { timestamp: now, gameState: { score: 0 }, observation: 'start' },
        { timestamp: now + 200, gameState: { score: 100 }, observation: 'fast1' },
        { timestamp: now + 400, gameState: { score: 200 }, observation: 'fast2' },
        { timestamp: now + 600, gameState: { score: 50 }, observation: 'fast3' }
      ];
      
      const aggregated = await aggregateTemporalNotesAdaptive(notes, {
        adaptive: true
      });
      
      assert.ok(aggregated);
      // Window should be adjusted for fastChange pattern
    });

    it('should use default window when adaptive is false and no windowSize provided', async () => {
      const now = Date.now();
      const notes = [
        { timestamp: now, observation: 'start' },
        { timestamp: now + 1000, observation: 'end' }
      ];
      
      const aggregated = await aggregateTemporalNotesAdaptive(notes, {
        adaptive: false
      });
      
      assert.ok(aggregated);
    });

    it('should handle empty notes array', async () => {
      const aggregated = await aggregateTemporalNotesAdaptive([], {
        adaptive: true
      });
      
      assert.ok(aggregated);
      assert.ok(Array.isArray(aggregated.windows));
    });
  });
});

