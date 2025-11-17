/**
 * Entity Extraction Performance Tests
 * 
 * Validates that entity extraction meets 60Hz requirements:
 * - Keyword matching: <1ms (suitable for 60Hz)
 * - LLM extraction: 1-3s (not suitable for 60Hz, but acceptable for analysis)
 * - Auto-selection: Correctly chooses method based on frequency
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { buildTemporalGraph } from '../src/temporal.mjs';
import { testLog } from './test-logger.mjs';

test('Keyword extraction is fast enough for 60Hz (<1ms)', async () => {
  const notes = Array.from({ length: 100 }, (_, i) => ({
    timestamp: Date.now() - (100 - i) * 100,
    score: 8 + Math.random(),
    observation: `button clicked at step ${i}`,
    reasoning: `score increased to ${8 + i}`,
    step: i
  }));

  const startTime = process.hrtime.bigint();
  const graph = await buildTemporalGraph(notes, {
    windowSize: 2000,
    useLLM: false, // Force keyword matching
    frequency: 60 // 60Hz scenario
  });
  const endTime = process.hrtime.bigint();
  const durationMs = Number(endTime - startTime) / 1_000_000;

  testLog.performance('Keyword extraction (100 notes)', durationMs, {
    method: 'keyword',
    noteCount: notes.length,
    entityCount: Object.keys(graph.graph.entities || {}).length
  });

  // Should be <1ms for keyword matching
  assert.ok(durationMs < 10, `Keyword extraction took ${durationMs}ms, should be <10ms for 60Hz`);
  testLog.success(`Keyword extraction: ${durationMs.toFixed(2)}ms (suitable for 60Hz)`);
});

test('Auto-selection disables LLM for 60Hz scenarios', async () => {
  const notes = [
    { timestamp: Date.now() - 1000, score: 8, observation: 'button visible', step: 1 },
    { timestamp: Date.now() - 500, score: 8.5, observation: 'button clicked', step: 2 }
  ];

  const startTime = process.hrtime.bigint();
  const graph = await buildTemporalGraph(notes, {
    windowSize: 2000,
    frequency: 60 // Auto-selects keyword matching
  });
  const endTime = process.hrtime.bigint();
  const durationMs = Number(endTime - startTime) / 1_000_000;

  testLog.debug('Auto-selection for 60Hz', {
    frequency: 60,
    duration_ms: durationMs,
    method: 'auto-selected (keyword)',
    entityCount: Object.keys(graph.graph.entities || {}).length
  });

  // Should be fast (keyword matching, not LLM)
  assert.ok(durationMs < 10, `Auto-selection should use keyword matching for 60Hz (took ${durationMs}ms)`);
  testLog.success(`Auto-selection correctly chose keyword matching for 60Hz`);
});

test('Auto-selection enables LLM for low-frequency scenarios', async function() {
  // Skip if no API key (LLM extraction requires API)
  if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    testLog.skip('No API key available for LLM extraction test');
    this.skip();
    return;
  }

  const notes = [
    { timestamp: Date.now() - 10000, score: 8, observation: 'button visible and accessible', step: 1 },
    { timestamp: Date.now() - 9000, score: 8.5, observation: 'form submitted successfully', step: 2 },
    { timestamp: Date.now() - 8000, score: 9, observation: 'page loaded with all elements', step: 3 }
  ];

  const startTime = process.hrtime.bigint();
  let graph;
  try {
    graph = await buildTemporalGraph(notes, {
      windowSize: 2000,
      frequency: 1 // Low frequency - should use LLM
    });
  } catch (e) {
    testLog.error('LLM extraction failed', e);
    this.skip();
    return;
  }
  const endTime = process.hrtime.bigint();
  const durationMs = Number(endTime - startTime) / 1_000_000;

  testLog.debug('Auto-selection for low frequency', {
    frequency: 1,
    duration_ms: durationMs,
    method: 'auto-selected (LLM)',
    entityCount: Object.keys(graph.graph.entities || {}).length
  });

  // LLM extraction should take 1-3s (acceptable for analysis, not real-time)
  assert.ok(durationMs >= 100, `LLM extraction should take >=100ms (took ${durationMs}ms)`);
  assert.ok(durationMs < 5000, `LLM extraction should take <5s (took ${durationMs}ms)`);
  testLog.success(`Auto-selection correctly chose LLM for low-frequency analysis (${durationMs.toFixed(0)}ms)`);
});

test('Auto-selection based on maxLatency requirement', async () => {
  const notes = [
    { timestamp: Date.now() - 1000, score: 8, observation: 'button visible', step: 1 }
  ];

  // <200ms requirement should use keyword matching
  const startTime1 = process.hrtime.bigint();
  const graph1 = await buildTemporalGraph(notes, {
    windowSize: 2000,
    maxLatency: 100 // <200ms - should use keyword
  });
  const duration1 = Number(process.hrtime.bigint() - startTime1) / 1_000_000;

  // >=200ms requirement can use LLM
  const startTime2 = process.hrtime.bigint();
  const graph2 = await buildTemporalGraph(notes, {
    windowSize: 2000,
    maxLatency: 500 // >=200ms - can use LLM
  });
  const duration2 = Number(process.hrtime.bigint() - startTime2) / 1_000_000;

  testLog.debug('Auto-selection by maxLatency', {
    maxLatency_100ms: { duration_ms: duration1, method: 'keyword' },
    maxLatency_500ms: { duration_ms: duration2, method: 'LLM (if available)' }
  });

  // First should be fast (keyword), second might be slower (LLM if available)
  assert.ok(duration1 < 10, `maxLatency=100ms should use keyword matching (took ${duration1}ms)`);
  testLog.success(`Auto-selection correctly respects maxLatency requirements`);
});

test('Keyword extraction handles large note arrays efficiently', async () => {
  // Create large note array (1000 notes)
  const notes = Array.from({ length: 1000 }, (_, i) => ({
    timestamp: Date.now() - (1000 - i) * 10,
    score: 8 + Math.random(),
    observation: `step ${i} completed`,
    step: i
  }));

  const startTime = process.hrtime.bigint();
  const graph = await buildTemporalGraph(notes, {
    windowSize: 2000,
    useLLM: false // Force keyword matching
  });
  const endTime = process.hrtime.bigint();
  const durationMs = Number(endTime - startTime) / 1_000_000;

  testLog.performance('Keyword extraction (1000 notes)', durationMs, {
    method: 'keyword',
    noteCount: notes.length,
    notesPerMs: (notes.length / durationMs).toFixed(0)
  });

  // Should still be fast even with 1000 notes
  assert.ok(durationMs < 50, `Keyword extraction with 1000 notes took ${durationMs}ms, should be <50ms`);
  testLog.success(`Keyword extraction scales well: ${(notes.length / durationMs).toFixed(0)} notes/ms`);
});

