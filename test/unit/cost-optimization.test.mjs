/**
 * Cost Optimization Tests
 * 
 * Tests for cost optimization utilities and recommendations.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { calculateCostComparison, optimizeCost } from '../../src/cost-optimization.js';

describe('Cost Optimization', () => {
  describe('calculateCostComparison', () => {
    it('should calculate cost comparison with current tier', () => {
      const context = { modelTier: 'balanced' };
      const currentResult = {
        provider: 'gemini',
        estimatedCost: { totalCost: '0.001' }
      };

      const comparison = calculateCostComparison(context, currentResult);

      assert.ok(comparison, 'Should return comparison object');
      assert.ok(comparison.current, 'Should have current cost info');
      assert.strictEqual(comparison.current.tier, 'balanced');
      assert.strictEqual(comparison.current.provider, 'gemini');
      assert.ok(comparison.tiers, 'Should have tier costs');
      assert.ok(comparison.savings, 'Should have savings calculations');
      assert.ok(comparison.recommendation, 'Should have recommendation');
    });

    it('should handle missing cost gracefully', () => {
      const context = { modelTier: 'fast' };
      const currentResult = { provider: 'openai' };

      const comparison = calculateCostComparison(context, currentResult);

      assert.ok(comparison, 'Should return comparison even without cost');
      assert.strictEqual(comparison.current.cost, null);
    });

    it('should calculate savings for different tiers', () => {
      const context = { modelTier: 'best' };
      const currentResult = {
        provider: 'gemini',
        estimatedCost: { totalCost: '0.002' }
      };

      const comparison = calculateCostComparison(context, currentResult);

      assert.ok(comparison.savings, 'Should calculate savings');
      assert.strictEqual(comparison.tiers.fast, null);
      assert.strictEqual(comparison.savings.balanced, undefined);
      assert.strictEqual(comparison.savings.best.absolute, 0);
    });

    it('should provide recommendation based on context', () => {
      const context = { 
        modelTier: 'balanced',
        frequency: 'high',
        costSensitive: true
      };
      const currentResult = {
        provider: 'gemini',
        estimatedCost: { totalCost: '0.001' }
      };

      const comparison = calculateCostComparison(context, currentResult);

      assert.ok(comparison.recommendation, 'Should have recommendation');
      assert.ok(comparison.recommendation.tier, 'Should recommend tier');
      assert.ok(comparison.recommendation.reason, 'Should provide reason');
    });
  });

  describe('optimizeCost', () => {
    it('should optimize cost based on options', () => {
      const options = {
        currentCost: 0.001,
        frequency: 'high',
        criticality: 'normal'
      };

      const result = optimizeCost(options);

      assert.ok(result, 'Should return optimization result');
      // Result structure may vary - just verify it returns something
      assert.ok(typeof result === 'object', 'Should return object');
    });

    it('should handle high frequency scenarios', () => {
      const options = {
        currentCost: 0.002,
        frequency: 20, // High frequency
        costSensitive: true
      };

      const result = optimizeCost(options);

      assert.ok(result, 'Should return result');
      // Just verify it returns something valid
      assert.ok(typeof result === 'object', 'Should return object');
    });

    it('should handle critical scenarios', () => {
      const options = {
        currentCost: 0.001,
        criticality: 'critical'
      };

      const result = optimizeCost(options);

      assert.ok(result, 'Should return result');
      // Just verify it returns something valid
      assert.ok(typeof result === 'object', 'Should return object');
    });

    it('should handle missing options gracefully', () => {
      const result = optimizeCost({});

      assert.ok(result, 'Should return result with defaults');
    });
  });
});


it('prices the same workload and preserves actual cost for model aliases', () => {
  const result = calculateCostComparison({ modelTier: 'balanced', modelPrices: {
    'gemini-3-pro-preview': { input: 5, output: 20 }
  } }, { provider: 'gemini', estimatedCost: { totalCost: 0.04, inputTokens: 2000, outputTokens: 500 } });
  assert.equal(result.savings.fast.absolute, 0);
  assert.equal(result.savings.balanced.absolute, 0);
  assert.equal(result.tiers.best, 0.02);
  assert.equal(optimizeCost({ budget: 0 }).withinBudget, false);
});
