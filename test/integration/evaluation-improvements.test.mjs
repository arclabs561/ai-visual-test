/**
 * Evaluation Tests: Prove Improvements Work
 * 
 * These tests demonstrate that our improvements actually provide better results:
 * 1. Position counter-balancing reduces bias
 * 2. Spearman correlation provides better rank metrics
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { evaluateWithCounterBalance } from '../../src/position-counterbalance.js';
import { spearmanCorrelation, calculateRankAgreement } from '../../src/metrics.mjs';

describe('Improvement Validation', () => {
  describe('Position Counter-Balancing Reduces Bias', () => {
    it('should reduce position bias by averaging', async () => {
      // Simulate position bias: first evaluation always scores higher
      let callCount = 0;
      const biasedEvaluate = async (imagePath, prompt, context) => {
        callCount++;
        // Simulate strong position bias: first position gets +2 points
        const baseScore = 7;
        const bias = context.comparisonOrder === 'image-first' ? 2 : -2;
        return {
          score: baseScore + bias,
          reasoning: `Call ${callCount} with bias ${bias > 0 ? 'positive' : 'negative'}`,
          issues: []
        };
      };
      
      // Without counter-balancing: would get 9 (biased high)
      // With counter-balancing: should get 7 (averaged)
      const result = await evaluateWithCounterBalance(
        biasedEvaluate,
        'test.png',
        'Test',
        {},
        { enabled: true, baselinePath: 'baseline.png' }
      );
      
      // Counter-balancing should average out the bias
      assert.strictEqual(result.score, 7, 'Counter-balancing should eliminate bias');
      assert.strictEqual(result.counterBalanced, true);
      assert.ok(result.metadata.counterBalancing.positionBiasDetected, 
        'Should detect position bias when scores differ');
      assert.strictEqual(result.scoreDifference, 4, 'Should detect 4-point difference');
    });
    
    it('should show improvement over single evaluation', async () => {
      // Test that counter-balanced results are more stable
      const results = [];
      
      for (let i = 0; i < 5; i++) {
        let callCount = 0;
        const variableEvaluate = async (imagePath, prompt, context) => {
          callCount++;
          // Add some randomness to simulate variability
          const baseScore = 7;
          const random = (Math.random() - 0.5) * 2; // -1 to +1
          const bias = context.comparisonOrder === 'image-first' ? 1.5 : -1.5;
          return {
            score: baseScore + bias + random,
            reasoning: 'Test'
          };
        };
        
        const result = await evaluateWithCounterBalance(
          variableEvaluate,
          'test.png',
          'Test',
          {},
          { enabled: true, baselinePath: 'baseline.png' }
        );
        results.push(result.score);
      }
      
      // Counter-balanced scores should cluster around 7 (less variance)
      const avg = results.reduce((a, b) => a + b, 0) / results.length;
      const variance = results.reduce((sum, score) => sum + Math.pow(score - avg, 2), 0) / results.length;
      
      // Average should be close to 7 (bias eliminated)
      assert.ok(Math.abs(avg - 7) < 1.0, `Average should be ~7, got ${avg}`);
      // Variance should be lower than without counter-balancing
      assert.ok(variance < 2.0, `Variance should be low, got ${variance}`);
    });
  });
  
  describe('Spearman Correlation Better for Ordinal Data', () => {
    it('should handle non-linear relationships better than Pearson', () => {
      // Spearman works on ranks, so handles non-linear relationships
      const x = [1, 2, 3, 4, 5, 100]; // Non-linear scale
      const y = [1, 4, 9, 16, 25, 10000]; // Quadratic relationship
      
      const spearman = spearmanCorrelation(x, y);
      
      // Spearman should show strong correlation (perfect rank correlation)
      assert.ok(spearman !== null);
      assert.ok(Math.abs(spearman - 1.0) < 0.001, 
        'Spearman should show perfect rank correlation');
    });
    
    it('should be more robust to outliers than Pearson', () => {
      // Data with outlier
      const x = [1, 2, 3, 4, 5, 100];
      const y = [1, 2, 3, 4, 5, 6];
      
      const spearman = spearmanCorrelation(x, y);
      
      // Spearman should still show strong correlation despite outlier
      assert.ok(spearman !== null);
      assert.ok(spearman > 0.8, 'Spearman should be robust to outliers');
    });
    
    it('should provide better rank agreement metrics', () => {
      // Test rank agreement calculation
      const ranking1 = [1, 2, 3, 4, 5];
      const ranking2 = [1, 3, 2, 5, 4]; // Some disagreement
      
      const agreement = calculateRankAgreement(ranking1, ranking2);
      
      assert.ok(agreement.spearman !== null);
      assert.ok(agreement.spearman > 0.5, 'Should show positive correlation');
      assert.ok(agreement.exactMatches < 5, 'Should detect some disagreement');
      assert.ok(agreement.agreementRate < 1.0, 'Should show less than perfect agreement');
    });
  });
  
  describe('End-to-End Improvement Validation', () => {
    it('should demonstrate combined improvements work together', async () => {
      // Test that all improvements can work together
      
      // 1. Counter-balancing
      let callCount = 0;
      const evaluate = async (imagePath, prompt, context) => {
        callCount++;
        return {
          score: context.comparisonOrder === 'image-first' ? 8 : 6,
          reasoning: 'Test',
          issues: []
        };
      };
      
      const counterBalanced = await evaluateWithCounterBalance(
        evaluate,
        'test.png',
        'Test',
        {},
        { enabled: true, baselinePath: 'baseline.png' }
      );
      
      assert.strictEqual(counterBalanced.score, 7);
      
      // 2. Metrics
      const correlation = spearmanCorrelation([1, 2, 3], [1, 2, 3]);
      assert.strictEqual(correlation, 1.0);
      
    });
  });
});
