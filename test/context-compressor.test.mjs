/**
 * Tests for context-compressor.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { compressContext, compressStateHistory } from '../src/context-compressor.mjs';

test('compressContext - empty notes', () => {
  const result = compressContext([]);
  
  assert.ok(result);
  assert.deepStrictEqual(result.compressed, []);
  assert.strictEqual(result.tokenEstimate, 0);
  assert.strictEqual(result.compressionRatio, 1.0);
});

test('compressContext - single note', () => {
  const notes = [
    {
      timestamp: Date.now(),
      step: 'test_step',
      observation: 'Test observation'
    }
  ];
  
  const result = compressContext(notes);
  
  assert.ok(result);
  assert.ok(result.compressed.length > 0);
  assert.ok(result.tokenEstimate > 0);
  assert.ok(result.summary);
});

test('compressContext - multiple notes', () => {
  const now = Date.now();
  const notes = [
    { timestamp: now, step: 'step1', observation: 'obs1' },
    { timestamp: now + 1000, step: 'step2', observation: 'obs2' },
    { timestamp: now + 2000, step: 'step3', observation: 'obs3' }
  ];
  
  const result = compressContext(notes);
  
  assert.ok(result);
  assert.ok(result.compressed.length > 0);
  assert.ok(result.compressed.length <= notes.length);
  assert.ok(result.tokenEstimate > 0);
});

test('compressContext - includes key events', () => {
  const now = Date.now();
  const notes = [
    { timestamp: now, step: 'normal_step', observation: 'normal' },
    { timestamp: now + 1000, step: 'bug_detection', observation: 'bug found' },
    { timestamp: now + 2000, step: 'critical_issue', observation: 'critical' }
  ];
  
  const result = compressContext(notes, { includeKeyEvents: true });
  
  assert.ok(result);
  const hasBug = result.compressed.some(n => n.step?.includes('bug'));
  assert.ok(hasBug);
});

test('compressContext - respects maxNotes', () => {
  const now = Date.now();
  const notes = Array.from({ length: 20 }, (_, i) => ({
    timestamp: now + i * 1000,
    step: `step${i}`,
    observation: `obs${i}`
  }));
  
  const result = compressContext(notes, { maxNotes: 5 });
  
  assert.ok(result);
  assert.ok(result.compressed.length <= 5);
});

test('compressStateHistory - empty history', () => {
  const result = compressStateHistory([]);
  
  assert.ok(result);
  assert.deepStrictEqual(result.compressed, []);
  assert.strictEqual(result.tokenEstimate, 0);
});

test('compressStateHistory - single state', () => {
  const stateHistory = [{ score: 10, active: true }];
  
  const result = compressStateHistory(stateHistory);
  
  assert.ok(result);
  assert.ok(result.compressed.length > 0);
});

test('compressStateHistory - multiple states', () => {
  const stateHistory = [
    { score: 10, active: true },
    { score: 20, active: true },
    { score: 30, active: false }
  ];
  
  const result = compressStateHistory(stateHistory, { maxStates: 2 });
  
  assert.ok(result);
  assert.ok(result.compressed.length <= 2);
  assert.ok(result.compressed.length > 0);
});

test('compressStateHistory - includes first and last', () => {
  const stateHistory = [
    { score: 10 },
    { score: 20 },
    { score: 30 },
    { score: 40 }
  ];
  
  const result = compressStateHistory(stateHistory, {
    includeFirst: true,
    includeLast: true,
    maxStates: 2
  });
  
  assert.ok(result);
  assert.strictEqual(result.compressed[0].score, 10); // First
  assert.strictEqual(result.compressed[result.compressed.length - 1].score, 40); // Last
});

test('compressStateHistory - finds key transitions', () => {
  const stateHistory = [
    { score: 10 },
    { score: 10 },
    { score: 50 }, // Significant change
    { score: 50 }
  ];
  
  const result = compressStateHistory(stateHistory, {
    includeKeyTransitions: true,
    maxStates: 3
  });
  
  assert.ok(result);
  assert.ok(result.compressed.length > 0);
});

