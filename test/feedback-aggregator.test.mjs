/**
 * Tests for feedback-aggregator.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { aggregateFeedback, generateRecommendations } from '../src/feedback-aggregator.mjs';

test('aggregateFeedback - empty results', () => {
  const result = aggregateFeedback([]);
  
  assert.ok(result);
  assert.deepStrictEqual(result.aggregated.scores, []);
  assert.ok(result.stats);
  assert.strictEqual(result.stats.totalJudgments, 0);
});

test('aggregateFeedback - single result', () => {
  const judgeResults = [
    {
      score: 8,
      semantic: {
        issues: ['issue1', 'issue2'],
        recommendations: ['rec1'],
        strengths: ['strength1'],
        weaknesses: ['weakness1']
      }
    }
  ];
  
  const result = aggregateFeedback(judgeResults);
  
  assert.ok(result);
  assert.strictEqual(result.stats.totalJudgments, 1);
  assert.strictEqual(result.stats.averageScore, 8);
  assert.strictEqual(result.aggregated.issues.issue1, 1);
  assert.strictEqual(result.aggregated.issues.issue2, 1);
});

test('aggregateFeedback - multiple results', () => {
  const judgeResults = [
    { score: 8, semantic: { issues: ['issue1'], recommendations: ['rec1'] } },
    { score: 9, semantic: { issues: ['issue1'], recommendations: ['rec1'] } },
    { score: 7, semantic: { issues: ['issue2'], recommendations: ['rec2'] } }
  ];
  
  const result = aggregateFeedback(judgeResults);
  
  assert.ok(result);
  assert.strictEqual(result.stats.totalJudgments, 3);
  assert.strictEqual(result.stats.averageScore, 8);
  assert.strictEqual(result.aggregated.issues.issue1, 2);
  assert.strictEqual(result.aggregated.issues.issue2, 1);
  assert.strictEqual(result.aggregated.recommendations.rec1, 2);
});

test('aggregateFeedback - calculates statistics', () => {
  const judgeResults = [
    { score: 8 },
    { score: 9 },
    { score: 7 }
  ];
  
  const result = aggregateFeedback(judgeResults);
  
  assert.ok(result.stats);
  assert.strictEqual(result.stats.averageScore, 8);
  assert.strictEqual(result.stats.minScore, 7);
  assert.strictEqual(result.stats.maxScore, 9);
});

test('generateRecommendations - empty aggregated', () => {
  const aggregated = {
    priority: { critical: [], high: [], medium: [], low: [] },
    categories: {},
    actionableItems: {}
  };
  
  const recommendations = generateRecommendations(aggregated);
  
  assert.ok(Array.isArray(recommendations));
});

test('generateRecommendations - with critical items', () => {
  const aggregated = {
    priority: {
      critical: ['critical1', 'critical2'],
      high: ['high1'],
      medium: [],
      low: []
    },
    categories: {},
    actionableItems: {}
  };
  
  const recommendations = generateRecommendations(aggregated);
  
  assert.ok(recommendations.length > 0);
  const critical = recommendations.find(r => r.priority === 'critical');
  assert.ok(critical);
  assert.ok(critical.items.length > 0);
});

test('generateRecommendations - with actionable items', () => {
  const aggregated = {
    priority: { critical: [], high: [], medium: [], low: [] },
    categories: {},
    actionableItems: {
      'action1': 5,
      'action2': 3,
      'action3': 1
    }
  };
  
  const recommendations = generateRecommendations(aggregated);
  
  assert.ok(recommendations.length > 0);
  const actionable = recommendations.find(r => r.category === 'actionable');
  assert.ok(actionable);
  assert.ok(actionable.items.length > 0);
});

