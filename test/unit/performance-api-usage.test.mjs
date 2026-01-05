/**
 * Performance API Usage Tests
 * 
 * Tests to verify correct usage of performance measurement APIs.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { measureAsync, measureSync, PerformanceProfiler } from '../../src/utils/performance-measurement.mjs';

describe('Performance API Usage', () => {
  describe('measureAsync', () => {
    it('should use correct signature: measureAsync(name, fn, options)', async () => {
      const result = await measureAsync('test-op', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'test-result';
      });

      assert.ok(result, 'Should return result');
      assert.ok(result.result === 'test-result', 'Should return function result');
      assert.ok(result.measurement, 'Should have measurement');
      assert.ok(result.measurement.duration >= 0, 'Should have duration');
      assert.ok(result.measurement.name === 'test-op', 'Should have correct name');
    });

    it('should handle errors correctly', async () => {
      await assert.rejects(async () => {
        await measureAsync('error-op', async () => {
          throw new Error('Test error');
        });
      }, /Test error/);
    });
  });

  describe('measureSync', () => {
    it('should use correct signature: measureSync(name, fn, options)', () => {
      const result = measureSync('sync-op', () => {
        return 'sync-result';
      });

      assert.ok(result, 'Should return result');
      assert.ok(result.result === 'sync-result', 'Should return function result');
      assert.ok(result.measurement, 'Should have measurement');
      assert.ok(result.measurement.duration >= 0, 'Should have duration');
    });
  });

  describe('PerformanceProfiler', () => {
    it('should return correct getSummary structure', () => {
      const profiler = new PerformanceProfiler();

      const id1 = profiler.start('op1');
      profiler.end(id1);
      const id2 = profiler.start('op2');
      profiler.end(id2);

      const summary = profiler.getSummary();

      // Verify structure matches actual API
      assert.ok(summary, 'Should have summary');
      assert.strictEqual(typeof summary.count, 'number', 'count should be number');
      assert.strictEqual(typeof summary.total, 'string', 'total should be string (formatted)');
      assert.strictEqual(typeof summary.average, 'string', 'average should be string (formatted)');
      assert.strictEqual(typeof summary.min, 'string', 'min should be string (formatted)');
      assert.strictEqual(typeof summary.max, 'string', 'max should be string (formatted)');
      assert.ok(summary.byName, 'Should have byName');
      assert.ok(summary.byName.op1, 'Should track op1');
      assert.ok(summary.byName.op2, 'Should track op2');
      
      // Verify byName structure
      assert.strictEqual(typeof summary.byName.op1.count, 'number', 'byName.count should be number');
      assert.strictEqual(typeof summary.byName.op1.total, 'number', 'byName.total should be number');
      assert.strictEqual(typeof summary.byName.op1.average, 'number', 'byName.average should be number');
    });

    it('should not have nested statistics property', () => {
      const profiler = new PerformanceProfiler();
      const id = profiler.start('test');
      profiler.end(id);

      const summary = profiler.getSummary();

      // Verify statistics are NOT nested
      assert.ok(!summary.statistics, 'Should NOT have nested statistics property');
      assert.strictEqual(typeof summary.count, 'number', 'Should have count directly as number');
      // getSummary() returns total as string (formatted with toFixed(2))
      assert.ok(typeof summary.total === 'string' || typeof summary.total === 'number', 'Should have total (string or number)');
      assert.ok(summary.count >= 0, 'Should have valid count');
    });
  });
});

