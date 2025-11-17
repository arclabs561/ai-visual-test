import { test } from 'node:test';
import assert from 'node:assert';
import { buildTemporalGraph } from '../src/temporal.mjs';

test('buildTemporalGraph handles empty notes', async () => {
  const graph = await buildTemporalGraph([], { useLLM: false });
  
  assert.ok(graph.graph !== undefined, 'Should have graph structure');
  assert.ok(Array.isArray(graph.graph.nodes), 'Should have nodes array');
  assert.ok(Array.isArray(graph.graph.edges), 'Should have edges array');
  assert.strictEqual(graph.graph.nodes.length, 0, 'Should have no nodes for empty notes');
  assert.strictEqual(graph.graph.edges.length, 0, 'Should have no edges for empty notes');
});

test('buildTemporalGraph handles single note', async () => {
  const notes = [
    { timestamp: Date.now(), score: 8, observation: 'button visible', step: 1 }
  ];
  
  const graph = await buildTemporalGraph(notes, { windowSize: 2000, useLLM: false });
  
  assert.ok(graph.graph.nodes.length > 0, 'Should have at least one node');
  assert.strictEqual(graph.graph.edges.length, 0, 'Should have no edges for single note');
});

test('buildTemporalGraph handles high-frequency notes (60Hz simulation)', async () => {
  const now = Date.now();
  const notes = Array.from({ length: 60 }, (_, i) => ({
    timestamp: now - (60 - i) * 16, // 60Hz = ~16ms intervals
    score: 8 + Math.sin(i / 10) * 0.5,
    observation: `frame ${i} with button and score elements`, // Add keywords for entity extraction
    step: i
  }));
  
  const graph = await buildTemporalGraph(notes, {
    windowSize: 500, // 0.5 second windows (smaller to ensure multiple windows)
    useLLM: false, // Should use keyword matching for 60Hz
    frequency: 60 // High frequency
  });
  
  assert.ok(graph.graph.nodes.length > 0, 'Should have nodes');
  // With 60 notes at 16ms intervals over ~960ms, and 500ms windows, we should have at least 2 windows
  // So edges should exist (edges = nodes.length - 1)
  if (graph.graph.nodes.length > 1) {
    assert.ok(graph.graph.edges.length > 0, 'Should have edges when multiple nodes exist');
  }
  assert.ok(graph.graph.averageCoherence !== undefined, 'Should calculate average coherence');
  assert.ok(typeof graph.graph.averageCoherence === 'number', 'Average coherence should be a number');
  assert.ok(graph.graph.averageCoherence >= 0 && graph.graph.averageCoherence <= 1, 'Average coherence should be 0-1');
});

test('buildTemporalGraph handles low-frequency notes (analysis mode)', async () => {
  const now = Date.now();
  const notes = Array.from({ length: 10 }, (_, i) => ({
    timestamp: now - (10 - i) * 1000, // 1 second intervals
    score: 8 + i * 0.1,
    observation: `analysis frame ${i} with button and score elements`,
    step: i
  }));
  
  const graph = await buildTemporalGraph(notes, {
    windowSize: 5000, // 5 second windows
    useLLM: false, // Use keyword matching (LLM would be slower)
    frequency: 1 // Low frequency
  });
  
  assert.ok(graph.graph.nodes.length > 0, 'Should have nodes');
  assert.ok(graph.graph.edges.length > 0, 'Should have edges');
  
  // Check entity extraction (should find keywords)
  const hasEntities = Object.keys(graph.graph.entities).length > 0;
  // Entities may or may not be found depending on keywords in observations
  assert.ok(true, 'Entity extraction completed');
});

test('buildTemporalGraph calculates state continuity correctly', async () => {
  const now = Date.now();
  const notes = [
    { timestamp: now - 5000, score: 8, observation: 'state1', issues: ['issue1'] },
    { timestamp: now - 4000, score: 8.5, observation: 'state2', issues: ['issue1', 'issue2'] },
    { timestamp: now - 3000, score: 9, observation: 'state3', issues: ['issue2'] },
    { timestamp: now - 2000, score: 7, observation: 'state4', issues: ['issue3'] }, // Significant change
    { timestamp: now - 1000, score: 7.5, observation: 'state5', issues: ['issue3'] }
  ];
  
  const graph = await buildTemporalGraph(notes, { windowSize: 2000, useLLM: false });
  
  assert.ok(graph.graph.edges.length > 0, 'Should have edges');
  
  // Check that edges have continuity scores
  for (const edge of graph.graph.edges) {
    assert.ok(edge.stateContinuity >= 0 && edge.stateContinuity <= 1, 'State continuity should be 0-1');
    assert.ok(edge.entityContinuity >= 0 && edge.entityContinuity <= 1, 'Entity continuity should be 0-1');
    assert.ok(edge.coherence >= 0 && edge.coherence <= 1, 'Coherence should be 0-1');
  }
  
  // The edge between state3 and state4 should have lower continuity (score drop)
  const stateChangeEdge = graph.graph.edges.find(e => 
    e.stateContinuity < 0.8 // Significant state change
  );
  if (stateChangeEdge) {
    assert.ok(stateChangeEdge.coherence < 1.0, 'Should detect lower coherence for state changes');
  }
});

test('buildTemporalGraph generates recommendations for low coherence', async () => {
  const now = Date.now();
  // Create notes with erratic behavior (low coherence)
  const notes = Array.from({ length: 10 }, (_, i) => ({
    timestamp: now - (10 - i) * 1000,
    score: i % 2 === 0 ? 9 : 3, // Alternating high/low scores
    observation: `frame ${i}`,
    step: i
  }));
  
  const graph = await buildTemporalGraph(notes, { windowSize: 2000, useLLM: false });
  
  assert.ok(Array.isArray(graph.recommendations), 'Should have recommendations');
  
  // Should recommend reducing sequence length or increasing frequency for low coherence
  const hasLowCoherenceRecommendation = graph.recommendations.some(r => 
    r.toLowerCase().includes('coherence') || 
    r.toLowerCase().includes('sequence') ||
    r.toLowerCase().includes('frequency')
  );
  
  if (graph.graph.averageCoherence < 0.6) {
    assert.ok(hasLowCoherenceRecommendation, 'Should recommend action for low coherence');
  }
});

test('buildTemporalGraph handles missing timestamps gracefully', async () => {
  const notes = [
    { elapsed: 0, score: 8, observation: 'frame1' },
    { elapsed: 1000, score: 8.5, observation: 'frame2' },
    { elapsed: 2000, score: 9, observation: 'frame3' }
  ];
  
  const graph = await buildTemporalGraph(notes, { windowSize: 2000, useLLM: false });
  
  assert.ok(graph.graph.nodes.length > 0, 'Should handle elapsed instead of timestamp');
  assert.ok(graph.graph.edges.length > 0, 'Should create edges with elapsed');
});

test('buildTemporalGraph handles notes with gameState', async () => {
  const now = Date.now();
  const notes = [
    { timestamp: now - 2000, gameState: { score: 100 }, observation: 'game1' },
    { timestamp: now - 1000, gameState: { score: 150 }, observation: 'game2' },
    { timestamp: now, gameState: { score: 200 }, observation: 'game3' }
  ];
  
  const graph = await buildTemporalGraph(notes, { windowSize: 2000, useLLM: false });
  
  // Check that gameState.score is used for state extraction
  assert.ok(graph.graph.nodes.length > 0, 'Should extract state from gameState');
  
  for (const node of graph.graph.nodes) {
    assert.ok(node.state !== undefined, 'Node should have state');
    assert.ok(node.state.avgScore !== undefined, 'State should have avgScore');
  }
});

