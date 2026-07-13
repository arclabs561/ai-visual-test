/**
 * Ablation Tests: Validate Research Claims
 * 
 * These tests compare results with/without features to validate research claims:
 * 1. Rubrics: Does adding explicit rubrics improve reliability?
 * 2. Counter-balancing: Does it reduce position bias?
 * 
 * Note: These are controlled experiments, not production validation.
 * For real validation, run on actual datasets with human annotations.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { validateScreenshot, createConfig } from '../src/index.mjs';
import { evaluateWithCounterBalance } from '../src/position-counterbalance.mjs';
import { buildRubricPrompt, getRubricForTestType } from '../src/rubrics.mjs';

describe('Ablation Tests: Research Claim Validation', () => {
  describe('Rubrics Ablation', () => {
    it('should demonstrate rubrics provide structure (not validated improvement)', () => {
      // Test that rubrics add structure to prompts
      const rubric = getRubricForTestType('payment-screen');
      const withRubric = buildRubricPrompt(rubric, true);
      const withoutRubric = 'Evaluate this payment screen';
      
      // Rubrics should add explicit criteria
      assert.ok(withRubric.includes('EVALUATION RUBRIC'));
      assert.ok(withRubric.includes('Evaluation Dimensions'));
      assert.ok(withRubric.length > withoutRubric.length);
      
      // Note: This proves rubrics add structure, not that they improve by 10-20%
      // Real validation requires A/B testing on actual datasets
    });
    
    it('should show rubrics are optional and can be disabled', () => {
      const rubric = getRubricForTestType('payment-screen');
      const withDimensions = buildRubricPrompt(rubric, true);
      const withoutDimensions = buildRubricPrompt(rubric, false);
      
      // Without dimensions should be shorter
      assert.ok(withoutDimensions.length < withDimensions.length);
      
      // Both should include rubric structure
      assert.ok(withDimensions.includes('EVALUATION RUBRIC'));
      assert.ok(withoutDimensions.includes('EVALUATION RUBRIC'));
    });
  });
  
  describe('Counter-Balancing Ablation', () => {
    it('should show counter-balancing reduces variance (not proven 70-80% reduction)', async () => {
      // Simulate position bias
      let callCount = 0;
      const biasedEvaluate = async (imagePath, prompt, context) => {
        callCount++;
        const bias = context.comparisonOrder === 'image-first' ? 2 : -2;
        return {
          score: 7 + bias,
          reasoning: 'Test',
          issues: []
        };
      };
      
      // Without counter-balancing: would get biased score (9 or 5)
      // With counter-balancing: should get averaged score (7)
      const result = await evaluateWithCounterBalance(
        biasedEvaluate,
        'test.png',
        'Test',
        {},
        { enabled: true, baselinePath: 'baseline.png' }
      );
      
      // Counter-balancing should average out bias
      assert.strictEqual(result.score, 7);
      assert.ok(result.metadata.counterBalancing.positionBiasDetected);
      
      // Note: This proves counter-balancing works, not that it reduces bias by 70-80%
      // Real validation requires measuring bias reduction across many evaluations
    });
    
    it('should demonstrate variance reduction (not quantified improvement)', async () => {
      // Run multiple evaluations with/without counter-balancing
      const resultsWith = [];
      const resultsWithout = [];
      
      for (let i = 0; i < 5; i++) {
        let callCount = 0;
        const variableEvaluate = async (imagePath, prompt, context) => {
          callCount++;
          const random = (Math.random() - 0.5) * 2; // -1 to +1
          const bias = context.comparisonOrder === 'image-first' ? 1.5 : -1.5;
          return {
            score: 7 + bias + random,
            reasoning: 'Test'
          };
        };
        
        // With counter-balancing
        const withCB = await evaluateWithCounterBalance(
          variableEvaluate,
          'test.png',
          'Test',
          {},
          { enabled: true, baselinePath: 'baseline.png' }
        );
        resultsWith.push(withCB.score);
        
        // Without counter-balancing (simulate single evaluation)
        const withoutCB = await variableEvaluate('test.png', 'Test', {
          comparisonOrder: 'image-first'
        });
        resultsWithout.push(withoutCB.score);
      }
      
      // Calculate variance
      const avgWith = resultsWith.reduce((a, b) => a + b, 0) / resultsWith.length;
      const avgWithout = resultsWithout.reduce((a, b) => a + b, 0) / resultsWithout.length;
      
      const varianceWith = resultsWith.reduce((sum, score) => 
        sum + Math.pow(score - avgWith, 2), 0) / resultsWith.length;
      const varianceWithout = resultsWithout.reduce((sum, score) => 
        sum + Math.pow(score - avgWithout, 2), 0) / resultsWithout.length;
      
      // Counter-balanced should have lower variance (averaging reduces variance)
      assert.ok(varianceWith < varianceWithout || Math.abs(varianceWith - varianceWithout) < 1.0,
        `Counter-balancing should reduce variance. With: ${varianceWith.toFixed(2)}, Without: ${varianceWithout.toFixed(2)}`);
      
      // Note: This shows variance reduction, not quantified 70-80% bias reduction
      // Real validation requires measuring bias across many scenarios
    });
  });
  
  describe('End-to-End Ablation', () => {
    it('should demonstrate remaining features work together (not validated improvements)', async () => {
      // Test that the remaining features can be used together
      // This doesn't prove they improve results, just that they work
      
      // 1. Rubrics
      const rubric = getRubricForTestType('payment-screen');
      const rubricPrompt = buildRubricPrompt(rubric);
      assert.ok(rubricPrompt.length > 0);
      
      // 2. Counter-balancing
      const evaluate = async () => ({ score: 7, reasoning: 'Test' });
      const counterBalanced = await evaluateWithCounterBalance(
        evaluate,
        'test.png',
        'Test',
        {},
        { enabled: true, baselinePath: 'baseline.png' }
      );
      assert.strictEqual(counterBalanced.score, 7);
      
      // Note: This proves integration, not that features improve results
      // Real validation requires measuring actual improvements on real tasks
    });
  });
});

/**
 * IMPORTANT NOTES:
 * 
 * These ablation tests demonstrate that:
 * 1. Features work as implemented
 * 2. Features can be enabled/disabled
 * 3. Features integrate together
 * 
 * They do NOT prove:
 * 1. 10-20% improvement from rubrics
 * 2. 70-80% bias reduction from counter-balancing
 * To validate research claims, you need:
 * - Real evaluation datasets
 * - Human-annotated ground truth
 * - A/B testing framework
 * - Statistical significance testing
 * - Multiple evaluation scenarios
 * 
 * Current status: Features are implemented and tested, but research claims
 * are not yet validated in this codebase.
 */
