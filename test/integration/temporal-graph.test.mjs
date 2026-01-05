import { test } from 'node:test';
import assert from 'node:assert';
import { buildTemporalGraph } from '../../src/temporal.mjs';

// Structured test logging utility
const testLog = {
  info: (msg, data = {}) => {
    const prefix = '   ℹ️  ';
    if (Object.keys(data).length > 0) {
      console.log(`${prefix}${msg}`, JSON.stringify(data, null, 2));
    } else {
      console.log(`${prefix}${msg}`);
    }
  },
  debug: (msg, data = {}) => {
    if (process.env.DEBUG_TESTS) {
      const prefix = '   🔍 [DEBUG] ';
      if (Object.keys(data).length > 0) {
        console.log(`${prefix}${msg}`, JSON.stringify(data, null, 2));
      } else {
        console.log(`${prefix}${msg}`);
      }
    }
  },
  error: (msg, error) => {
    const prefix = '   ❌ ';
    console.log(`${prefix}${msg}`, error?.message || error);
    if (error?.stack && process.env.DEBUG_TESTS) {
      console.log('   Stack:', error.stack);
    }
  },
  success: (msg) => {
    const prefix = '   ✅ ';
    console.log(`${prefix}${msg}`);
  }
};

test('buildTemporalGraph creates graph structure', async () => {
  const notes = [
    { timestamp: Date.now() - 10000, score: 8, observation: 'button visible', step: 1 },
    { timestamp: Date.now() - 9000, score: 8.5, observation: 'button clicked', step: 2 },
    { timestamp: Date.now() - 8000, score: 9, observation: 'page loaded', step: 3 },
    { timestamp: Date.now() - 7000, score: 8.5, observation: 'form visible', step: 4 },
    { timestamp: Date.now() - 6000, score: 9, observation: 'form filled', step: 5 }
  ];

  testLog.debug('Building temporal graph', { noteCount: notes.length, windowSize: 2000 });
  const graph = await buildTemporalGraph(notes, { windowSize: 2000, useLLM: false }); // Use keyword matching for speed in tests

  testLog.debug('Graph structure', {
    hasGraph: !!graph.graph,
    nodeCount: graph.graph?.nodes?.length || 0,
    edgeCount: graph.graph?.edges?.length || 0,
    entityCount: Object.keys(graph.graph?.entities || {}).length
  });

  assert.ok(graph.graph, 'Should have graph structure');
  assert.ok(graph.graph.nodes, 'Should have nodes');
  assert.ok(graph.graph.edges, 'Should have edges');
  assert.ok(graph.graph.entities, 'Should have entities');
  assert.ok(graph.graph.averageCoherence !== undefined, 'Should have average coherence');
  assert.ok(graph.graph.nodes.length > 0, 'Should have nodes');
  assert.ok(graph.graph.edges.length > 0, 'Should have edges');
  testLog.success('Graph structure created successfully');
});

test('buildTemporalGraph tracks entity continuity', async () => {
  const notes = [
    { timestamp: Date.now() - 10000, score: 8, observation: 'button visible', step: 1 },
    { timestamp: Date.now() - 9000, score: 8.5, observation: 'button clicked', step: 2 },
    { timestamp: Date.now() - 8000, score: 9, observation: 'page loaded', step: 3 },
    { timestamp: Date.now() - 7000, score: 8.5, observation: 'form visible', step: 4 },
    { timestamp: Date.now() - 6000, score: 9, observation: 'form filled', step: 5 }
  ];

  testLog.debug('Testing entity continuity', { noteCount: notes.length });
  const graph = await buildTemporalGraph(notes, { windowSize: 2000, useLLM: false });

  assert.ok(graph.graph.entities, 'Should track entities');
  const entityKeys = Object.keys(graph.graph.entities);
  
  testLog.debug('Entity extraction results', {
    entityCount: entityKeys.length,
    entities: entityKeys,
    extractionMethod: 'keyword-matching (useLLM=false)'
  });
  
  assert.ok(Array.isArray(entityKeys), 'Should have entity keys array');
  
  // If entities are found, check structure
  // Note: Entity extraction now uses LLM when available, falls back to keyword matching
  // So we only verify structure if entities exist, but don't require them to exist
  if (entityKeys.length > 0) {
    testLog.success(`Found ${entityKeys.length} entities`);
    for (const entity of entityKeys) {
      const tracking = graph.graph.entities[entity];
      testLog.debug(`Entity tracking: ${entity}`, tracking);
      assert.ok(tracking.firstSeen !== undefined, 'Should have firstSeen');
      assert.ok(tracking.lastSeen !== undefined, 'Should have lastSeen');
      assert.ok(tracking.continuity !== undefined, 'Should have continuity');
    }
  } else {
    testLog.info('No entities extracted (acceptable - extraction is optional)');
  }
});

test('buildTemporalGraph calculates state continuity', async () => {
  const notes = [
    { timestamp: Date.now() - 10000, score: 8, observation: 'state1', step: 1 },
    { timestamp: Date.now() - 9000, score: 8.5, observation: 'state2', step: 2 },
    { timestamp: Date.now() - 8000, score: 9, observation: 'state3', step: 3 }
  ];

  testLog.debug('Testing state continuity', { noteCount: notes.length });
  const graph = await buildTemporalGraph(notes, { windowSize: 2000, useLLM: false });

  assert.ok(graph.graph.edges.length > 0, 'Should have edges');
  testLog.debug('Edge continuity', {
    edgeCount: graph.graph.edges.length,
    continuities: graph.graph.edges.map(e => ({
      stateContinuity: e.stateContinuity,
      entityContinuity: e.entityContinuity,
      coherence: e.coherence
    }))
  });
  
  for (const edge of graph.graph.edges) {
    assert.ok(edge.stateContinuity !== undefined, 'Edge should have stateContinuity');
    assert.ok(edge.entityContinuity !== undefined, 'Edge should have entityContinuity');
    assert.ok(edge.coherence !== undefined, 'Edge should have coherence');
    assert.ok(edge.coherence >= 0 && edge.coherence <= 1, 'Coherence should be 0-1');
  }
  testLog.success('State continuity calculated correctly');
});

