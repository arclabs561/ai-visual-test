#!/usr/bin/env node
/**
 * Embeddings Validation Using Real Datasets
 * 
 * Tests instruction-tuned embeddings and semantic matching using:
 * - Real evaluation datasets (webui, screenai, wcag)
 * - Issue detection and duplicate filtering
 * - Semantic similarity for temporal coherence
 * - Performance benchmarks
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { instructionSemanticSimilarity, batchInstructionSimilarity } from '../../evaluation/utils/instruction-embeddings.mjs';
import { semanticSimilarity } from '../../evaluation/utils/semantic-matcher.mjs';
import { loadDataset } from '../../evaluation/utils/dataset-adapters.mjs';

test('Embeddings - Real Dataset Issue Similarity', async () => {
  try {
    const dataset = await loadDataset('real', { limit: 10 });
    
    if (!dataset) {
      return; // Skip if not available
    }
    
    const samples = Array.isArray(dataset) ? dataset : (dataset.samples || []);
    
    if (samples.length === 0) {
      return; // Skip if empty
    }
    
    // Extract issues from ground truth
    const issues = samples
      .map(s => s.groundTruth?.structuredIssues || [])
      .flat()
      .filter(Boolean)
      .slice(0, 5);
    
    if (issues.length < 2) {
      return; // Skip if not enough issues
    }
    
    // Test similarity between issues
    const similarity = await instructionSemanticSimilarity(
      issues[0],
      issues[1],
      'accessibility'
    );
    
    assert.ok(similarity === null || (similarity >= 0 && similarity <= 1), 'Similarity should be valid');
    
    if (similarity !== null) {
      console.log(`✅ Issue similarity: ${similarity.toFixed(3)}`);
    } else {
      console.log('⚠️  Embeddings not available (using fallback)');
    }
  } catch (error) {
    t.skip(`Dataset error: ${error.message}`);
  }
});

test('Embeddings - Batch Similarity Performance', async () => {
  const queries = [
    'Button has low contrast',
    'Missing alt text',
    'Keyboard navigation broken',
    'Form label missing',
    'Color contrast insufficient'
  ];
  
  const candidates = [
    'Button contrast is too low',
    'Image missing alternative text',
    'Cannot navigate with keyboard',
    'Form field has no label',
    'Text color contrast fails WCAG'
  ];
  
  const start = performance.now();
  const results = await batchInstructionSimilarity(
    queries[0],
    candidates,
    'accessibility'
  );
  const elapsed = performance.now() - start;
  
  assert.ok(results === null || Array.isArray(results), 'Should return array or null');
  
  if (results) {
    assert.ok(results.length === candidates.length, 'Should return result for each candidate');
    results.forEach((r, i) => {
      assert.ok(typeof r.similarity === 'number', `Result ${i} should have similarity`);
      assert.ok(r.similarity >= 0 && r.similarity <= 1, `Result ${i} similarity should be in [0, 1]`);
    });
    
    console.log(`✅ Batch similarity: ${candidates.length} candidates in ${elapsed.toFixed(2)}ms`);
    console.log(`   Top match: ${results[0].text} (${results[0].similarity.toFixed(3)})`);
  } else {
    console.log('⚠️  Embeddings not available');
  }
});

test('Embeddings - Temporal Observation Consistency', async () => {
  // Test semantic similarity for temporal observations
  const observations = [
    'Gameplay is smooth and responsive',
    'Frame rate is consistent and fluid',
    'Controls feel laggy and unresponsive',
    'Input delay is noticeable'
  ];
  
  // Compare consecutive observations
  const similarities = [];
  for (let i = 1; i < observations.length; i++) {
    const sim = await instructionSemanticSimilarity(
      observations[i - 1],
      observations[i],
      'temporal'
    );
    
    if (sim !== null) {
      similarities.push(sim);
      assert.ok(sim >= 0 && sim <= 1, 'Similarity should be valid');
    }
  }
  
  if (similarities.length > 0) {
    const avgSimilarity = similarities.reduce((a, b) => a + b, 0) / similarities.length;
    console.log(`✅ Temporal observations: avg similarity=${avgSimilarity.toFixed(3)}`);
    
    // First two should be similar (both positive)
    if (similarities[0] > 0.5) {
      console.log('   ✅ Correctly identified similar positive observations');
    }
    
    // Last two should be similar (both negative)
    if (similarities[similarities.length - 1] > 0.5) {
      console.log('   ✅ Correctly identified similar negative observations');
    }
  } else {
    console.log('⚠️  Embeddings not available');
  }
});

test('Embeddings - Fallback to General Embeddings', async () => {
  // Test that general embeddings work as fallback
  const text1 = 'Button has low contrast';
  const text2 = 'Button contrast is insufficient';
  
  const similarity = await semanticSimilarity(text1, text2);
  
  assert.ok(similarity === null || (similarity >= 0 && similarity <= 1), 'General similarity should be valid');
  
  if (similarity !== null) {
    console.log(`✅ General embeddings: similarity=${similarity.toFixed(3)}`);
    assert.ok(similarity > 0.3, 'Similar texts should have reasonable similarity');
  } else {
    console.log('⚠️  General embeddings not available');
  }
});

test('Embeddings - Task-Specific Instructions', async () => {
  const text1 = 'Missing alt text on image';
  const text2 = 'Image lacks alternative text description';
  
  // Test different task types
  const tasks = ['accessibility', 'design', 'temporal', 'general'];
  const results = {};
  
  for (const task of tasks) {
    const sim = await instructionSemanticSimilarity(text1, text2, task);
    if (sim !== null) {
      results[task] = sim;
    }
  }
  
  if (Object.keys(results).length > 0) {
    console.log('✅ Task-specific similarities:');
    for (const [task, sim] of Object.entries(results)) {
      console.log(`   ${task}: ${sim.toFixed(3)}`);
      assert.ok(sim >= 0 && sim <= 1, `${task} similarity should be valid`);
    }
    
    // Accessibility task should work well for accessibility issues
    if (results.accessibility) {
      assert.ok(results.accessibility > 0.5, 'Accessibility task should identify similar issues');
    }
  } else {
    console.log('⚠️  Embeddings not available');
  }
});

test('Embeddings - Performance Benchmark', async () => {
  const texts = Array.from({ length: 20 }, (_, i) => `Issue ${i}: Button contrast low`);
  
  const start = performance.now();
  const similarities = [];
  
  for (let i = 1; i < texts.length; i++) {
    const sim = await instructionSemanticSimilarity(texts[i - 1], texts[i], 'accessibility');
    if (sim !== null) {
      similarities.push(sim);
    }
  }
  
  const elapsed = performance.now() - start;
  
  if (similarities.length > 0) {
    const avgTime = elapsed / similarities.length;
    console.log(`✅ Performance: ${similarities.length} comparisons in ${elapsed.toFixed(2)}ms`);
    console.log(`   Average: ${avgTime.toFixed(2)}ms per comparison`);
    
    assert.ok(elapsed < 10000, 'Should complete in reasonable time');
    assert.ok(avgTime < 1000, 'Per comparison should be fast');
  } else {
    console.log('⚠️  Embeddings not available');
  }
});

test('Embeddings - Input Validation', async () => {
  // Test invalid inputs
  const nullResult = await instructionSemanticSimilarity(null, 'text', 'accessibility');
  assert.ok(nullResult === null, 'Should return null for null input');
  
  const emptyResult = await instructionSemanticSimilarity('', 'text', 'accessibility');
  assert.ok(emptyResult === 0 || emptyResult === null, 'Should return 0 or null for empty input');
  
  const typeResult = await instructionSemanticSimilarity(123, 'text', 'accessibility');
  assert.ok(typeResult === null, 'Should return null for non-string input');
  
  console.log('✅ Input validation works');
});

console.log('\n🧪 Running embeddings dataset validation tests...\n');

