import { test } from 'node:test';
import assert from 'node:assert';
import { scoreExplainability, batchScoreExplainability } from '../src/utils/explainability-scorer.mjs';

test('scoreExplainability handles empty reasoning', () => {
  const result = scoreExplainability('', { type: 'click', selector: '#button' });
  
  assert.ok(result.score === 0, 'Should score 0 for empty reasoning');
  assert.ok(result.issues.length > 0, 'Should identify issues');
  assert.ok(result.issues.some(i => i.includes('No reasoning')), 
    'Should identify missing reasoning');
});

test('scoreExplainability scores clarity', () => {
  // Clear reasoning
  const clear = scoreExplainability(
    'I will click the submit button to submit the form.',
    { type: 'click', selector: '#submit' }
  );
  assert.ok(clear.clarity >= 0.7, 'Should have high clarity for clear reasoning');
  
  // Unclear reasoning (jargon, long sentences)
  const unclear = scoreExplainability(
    'The algorithmic implementation of the optimization paradigm requires the utilization of complex computational strategies to achieve the desired outcome through the systematic application of advanced techniques.',
    { type: 'click', selector: '#button' }
  );
  assert.ok(unclear.clarity < clear.clarity, 'Should have lower clarity for unclear reasoning');
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
  assert.ok(relevant.relevance >= 0.7, 'Should have high relevance for relevant reasoning');
  
  // Less relevant reasoning
  const lessRelevant = scoreExplainability(
    'The weather is nice today. I like programming.',
    { type: 'click', selector: '#button' }
  );
  assert.ok(lessRelevant.relevance < relevant.relevance, 
    'Should have lower relevance for less relevant reasoning');
});

test('scoreExplainability calculates overall score', () => {
  const result = scoreExplainability(
    'The goal is to submit the form. I will click the submit button. This should submit the form.',
    { type: 'click', selector: '#submit' }
  );
  
  assert.ok(result.score >= 0 && result.score <= 1, 'Should have valid score (0-1)');
  assert.ok(result.clarity >= 0 && result.clarity <= 1, 'Should have valid clarity');
  assert.ok(result.completeness >= 0 && result.completeness <= 1, 'Should have valid completeness');
  assert.ok(result.relevance >= 0 && result.relevance <= 1, 'Should have valid relevance');
});

test('scoreExplainability identifies issues', () => {
  const result = scoreExplainability(
    'Click.',
    { type: 'click', selector: '#button' }
  );
  
  assert.ok(Array.isArray(result.issues), 'Should have issues array');
  assert.ok(result.issues.length > 0, 'Should identify issues for low-quality reasoning');
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
  
  assert.ok(result.total === 3, 'Should process all reasonings');
  assert.ok(result.averageScore >= 0 && result.averageScore <= 1, 'Should have valid average score');
  assert.ok(result.averageClarity >= 0 && result.averageClarity <= 1, 'Should have valid average clarity');
  assert.ok(result.averageCompleteness >= 0 && result.averageCompleteness <= 1, 
    'Should have valid average completeness');
  assert.ok(result.averageRelevance >= 0 && result.averageRelevance <= 1, 
    'Should have valid average relevance');
  assert.ok(result.recommendation, 'Should provide recommendation');
});

test('scoreExplainability handles action without selector', () => {
  const result = scoreExplainability(
    'I will perform a keyboard action.',
    { type: 'keyboard', key: 'ArrowRight' }
  );
  
  assert.ok(result.score >= 0 && result.score <= 1, 'Should handle action without selector');
  assert.ok(result.relevance >= 0 && result.relevance <= 1, 'Should calculate relevance');
});


