import { test } from 'node:test';
import assert from 'node:assert';
import { scoreExplainability, batchScoreExplainability } from '../../src/utils/explainability-scorer.mjs';

test('scoreExplainability handles empty reasoning', () => {
  const result = scoreExplainability('', { type: 'click', selector: '#button' });
  
  assert.strictEqual(result.score, 0, 'Should score 0 for empty reasoning');
  assert.ok(Array.isArray(result.issues), 'Should have issues array');
  assert.ok(result.issues.length > 0, 'Should identify issues for empty reasoning');
  assert.ok(result.issues.some(i => i.includes('No reasoning') || i.includes('reasoning')), 
    'Should identify missing reasoning');
  assert.strictEqual(result.clarity, 0, 'Should have 0 clarity for empty reasoning');
  assert.strictEqual(result.completeness, 0, 'Should have 0 completeness for empty reasoning');
  assert.strictEqual(result.relevance, 0, 'Should have 0 relevance for empty reasoning');
});

test('scoreExplainability scores clarity', () => {
  // Clear reasoning
  const clear = scoreExplainability(
    'I will click the submit button to submit the form.',
    { type: 'click', selector: '#submit' }
  );
  assert.ok(typeof clear.clarity === 'number', 'Clarity should be a number');
  assert.ok(clear.clarity >= 0 && clear.clarity <= 1, 'Clarity should be 0-1');
  assert.ok(clear.clarity >= 0.7, `Should have high clarity (>=0.7) for clear reasoning, got ${clear.clarity}`);
  
  // Unclear reasoning (jargon, long sentences)
  const unclear = scoreExplainability(
    'The algorithmic implementation of the optimization paradigm requires the utilization of complex computational strategies to achieve the desired outcome through the systematic application of advanced techniques.',
    { type: 'click', selector: '#button' }
  );
  assert.ok(typeof unclear.clarity === 'number', 'Clarity should be a number');
  assert.ok(unclear.clarity >= 0 && unclear.clarity <= 1, 'Clarity should be 0-1');
  assert.ok(unclear.clarity < clear.clarity, 
    `Should have lower clarity for unclear reasoning (clear: ${clear.clarity}, unclear: ${unclear.clarity})`);
});

test('scoreExplainability scores completeness', () => {
  // Complete reasoning
  const complete = scoreExplainability(
    'The goal is to submit the form. The current state shows a filled form. I will click the submit button. This should submit the form.',
    { type: 'click', selector: '#submit' }
  );
  assert.ok(complete.completeness >= 0.7, 'Should have high completeness for complete reasoning');
  
  // Incomplete reasoning
  const incomplete = scoreExplainability(
    'Click button.',
    { type: 'click', selector: '#button' }
  );
  assert.ok(incomplete.completeness < complete.completeness, 
    'Should have lower completeness for incomplete reasoning');
});

test('scoreExplainability scores relevance', () => {
  // Relevant reasoning
  const relevant = scoreExplainability(
    'I will click the submit button to submit the form.',
    { type: 'click', selector: '#submit' }
  );
  assert.ok(typeof relevant.relevance === 'number', 'Relevance should be a number');
  assert.ok(relevant.relevance >= 0 && relevant.relevance <= 1, 'Relevance should be 0-1');
  assert.ok(relevant.relevance >= 0.7, 
    `Should have high relevance (>=0.7) for relevant reasoning, got ${relevant.relevance}`);
  
  // Less relevant reasoning
  const lessRelevant = scoreExplainability(
    'The weather is nice today. I like programming.',
    { type: 'click', selector: '#button' }
  );
  assert.ok(typeof lessRelevant.relevance === 'number', 'Relevance should be a number');
  assert.ok(lessRelevant.relevance >= 0 && lessRelevant.relevance <= 1, 'Relevance should be 0-1');
  assert.ok(lessRelevant.relevance < relevant.relevance, 
    `Should have lower relevance for less relevant reasoning (relevant: ${relevant.relevance}, less: ${lessRelevant.relevance})`);
});

test('scoreExplainability calculates overall score', () => {
  const result = scoreExplainability(
    'The goal is to submit the form. I will click the submit button. This should submit the form.',
    { type: 'click', selector: '#submit' }
  );
  
  // Verify all fields are present and valid
  assert.ok(typeof result.score === 'number', 'Score should be a number');
  assert.ok(result.score >= 0 && result.score <= 1, `Score should be 0-1, got ${result.score}`);
  assert.ok(typeof result.clarity === 'number', 'Clarity should be a number');
  assert.ok(result.clarity >= 0 && result.clarity <= 1, `Clarity should be 0-1, got ${result.clarity}`);
  assert.ok(typeof result.completeness === 'number', 'Completeness should be a number');
  assert.ok(result.completeness >= 0 && result.completeness <= 1, 
    `Completeness should be 0-1, got ${result.completeness}`);
  assert.ok(typeof result.relevance === 'number', 'Relevance should be a number');
  assert.ok(result.relevance >= 0 && result.relevance <= 1, 
    `Relevance should be 0-1, got ${result.relevance}`);
  assert.ok(Array.isArray(result.issues), 'Issues should be an array');
  assert.ok(typeof result.recommendation === 'string', 'Recommendation should be a string');
});

test('scoreExplainability identifies issues', () => {
  const result = scoreExplainability(
    'Click.',
    { type: 'click', selector: '#button' }
  );
  
  assert.ok(Array.isArray(result.issues), 'Should have issues array');
  assert.ok(result.issues.length > 0, 
    `Should identify issues for low-quality reasoning, got ${result.issues.length} issues`);
  // Verify issues are strings
  result.issues.forEach((issue, i) => {
    assert.ok(typeof issue === 'string', `Issue ${i} should be a string, got ${typeof issue}`);
    assert.ok(issue.length > 0, `Issue ${i} should not be empty`);
  });
  // Low-quality reasoning should have low score
  assert.ok(result.score < 0.7, 
    `Low-quality reasoning should have low score (<0.7), got ${result.score}`);
});

test('batchScoreExplainability aggregates results', () => {
  const reasonings = [
    'The goal is to submit the form. I will click the submit button.',
    'Click.',
    'I need to navigate to the checkout page to complete the purchase.'
  ];
  
  const actions = [
    { type: 'click', selector: '#submit' },
    { type: 'click', selector: '#button' },
    { type: 'navigate', url: '/checkout' }
  ];
  
  const result = batchScoreExplainability(reasonings, actions);
  
  assert.strictEqual(result.total, 3, 'Should process all reasonings');
  assert.ok(typeof result.averageScore === 'number', 'Average score should be a number');
  assert.ok(result.averageScore >= 0 && result.averageScore <= 1, 
    `Average score should be 0-1, got ${result.averageScore}`);
  assert.ok(typeof result.averageClarity === 'number', 'Average clarity should be a number');
  assert.ok(result.averageClarity >= 0 && result.averageClarity <= 1, 
    `Average clarity should be 0-1, got ${result.averageClarity}`);
  assert.ok(typeof result.averageCompleteness === 'number', 'Average completeness should be a number');
  assert.ok(result.averageCompleteness >= 0 && result.averageCompleteness <= 1, 
    `Average completeness should be 0-1, got ${result.averageCompleteness}`);
  assert.ok(typeof result.averageRelevance === 'number', 'Average relevance should be a number');
  assert.ok(result.averageRelevance >= 0 && result.averageRelevance <= 1, 
    `Average relevance should be 0-1, got ${result.averageRelevance}`);
  assert.ok(typeof result.recommendation === 'string', 'Recommendation should be a string');
  assert.ok(result.recommendation.length > 0, 'Recommendation should not be empty');
});

test('scoreExplainability handles action without selector', () => {
  const result = scoreExplainability(
    'I will perform a keyboard action.',
    { type: 'keyboard', key: 'ArrowRight' }
  );
  
  assert.ok(typeof result.score === 'number', 'Score should be a number');
  assert.ok(result.score >= 0 && result.score <= 1, 
    `Should handle action without selector, score should be 0-1, got ${result.score}`);
  assert.ok(typeof result.relevance === 'number', 'Relevance should be a number');
  assert.ok(result.relevance >= 0 && result.relevance <= 1, 
    `Should calculate relevance, got ${result.relevance}`);
  // Should still have all required fields
  assert.ok(typeof result.clarity === 'number', 'Should have clarity');
  assert.ok(typeof result.completeness === 'number', 'Should have completeness');
  assert.ok(Array.isArray(result.issues), 'Should have issues array');
});


