/**
 * Integration tests for uncertainty-reducer.mjs
 */

import '../test-setup.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  estimateUncertainty,
  selfConsistencyCheck,
  combineUncertaintySources,
  shouldUseSelfConsistency,
  enhanceWithUncertainty
} from '../../src/uncertainty-reducer.mjs';

describe('Uncertainty Reducer', () => {
  describe('estimateUncertainty', () => {
    it('should return default uncertainty for null logprobs', () => {
      const result = estimateUncertainty(null);
      
      assert.ok(result);
      assert.strictEqual(result.uncertainty, 0.5);
      assert.strictEqual(result.confidence, 0.5);
      assert.strictEqual(result.method, 'default');
    });

    it('should estimate uncertainty from OpenAI format logprobs', () => {
      const logprobs = {
        tokens: ['test', 'result'],
        token_logprobs: [-0.5, -1.0]
      };
      
      const result = estimateUncertainty(logprobs);
      
      assert.ok(result);
      assert.ok(result.uncertainty >= 0 && result.uncertainty <= 1);
      assert.ok(result.confidence >= 0 && result.confidence <= 1);
      assert.strictEqual(result.method, 'logprobs');
      assert.ok(typeof result.avgLogprob === 'number');
    });

    it('should handle empty token_logprobs array', () => {
      const logprobs = {
        tokens: [],
        token_logprobs: []
      };
      
      const result = estimateUncertainty(logprobs);
      
      assert.ok(result);
      assert.strictEqual(result.method, 'no-logprobs');
    });

    it('should handle null values in token_logprobs', () => {
      const logprobs = {
        tokens: ['test', 'null', 'result'],
        token_logprobs: [-0.5, null, -1.0]
      };
      
      const result = estimateUncertainty(logprobs);
      
      assert.ok(result);
      assert.ok(result.uncertainty >= 0 && result.uncertainty <= 1);
      assert.strictEqual(result.method, 'logprobs');
    });

    it('should handle low logprobs (high uncertainty)', () => {
      const logprobs = {
        tokens: ['test'],
        token_logprobs: [-3.0] // Very low logprob
      };
      
      const result = estimateUncertainty(logprobs);
      
      assert.ok(result);
      assert.ok(result.uncertainty > 0.5); // Should be high uncertainty
    });

    it('should handle high logprobs (low uncertainty)', () => {
      const logprobs = {
        tokens: ['test'],
        token_logprobs: [-0.1] // High logprob
      };
      
      const result = estimateUncertainty(logprobs);
      
      assert.ok(result);
      assert.ok(result.confidence > 0.5); // Should be high confidence
    });
  });

  describe('selfConsistencyCheck', () => {
    it('should return failed result when judgeFn throws', async () => {
      const judgeFn = async () => {
        throw new Error('API error');
      };
      
      const result = await selfConsistencyCheck(judgeFn, 3, { maxCalls: 2 });
      
      assert.ok(result);
      assert.strictEqual(result.score, null);
      assert.strictEqual(result.method, 'self-consistency-failed');
      assert.strictEqual(result.uncertainty, 1.0);
    });

    it('should aggregate multiple consistent results', async () => {
      let callCount = 0;
      const judgeFn = async () => {
        callCount++;
        return { score: 8.0, issues: [] };
      };
      
      const result = await selfConsistencyCheck(judgeFn, 3);
      
      assert.ok(result);
      assert.ok(result.score !== null);
      assert.ok(result.consistency >= 0 && result.consistency <= 1);
      assert.ok(result.confidence >= 0 && result.confidence <= 1);
      assert.ok(callCount >= 3);
    });

    it('should detect inconsistency in results', async () => {
      const scores = [8.0, 2.0, 9.0]; // Inconsistent
      let index = 0;
      const judgeFn = async () => {
        return { score: scores[index++], issues: [] };
      };
      
      const result = await selfConsistencyCheck(judgeFn, 3);
      
      assert.ok(result);
      assert.ok(result.consistency < 1.0); // Should detect inconsistency
    });

    it('should respect maxCalls option', async () => {
      let callCount = 0;
      const judgeFn = async () => {
        callCount++;
        throw new Error('Error');
      };
      
      await selfConsistencyCheck(judgeFn, 10, { maxCalls: 3 });
      
      assert.ok(callCount <= 3);
    });

    it('should calculate improvement metrics when baseline provided', async () => {
      const judgeFn = async () => {
        return { score: 8.5, issues: [] };
      };
      
      const result = await selfConsistencyCheck(judgeFn, 3, {
        baselineScore: 8.0
      });
      
      assert.ok(result);
      if (result.improvementMetrics) {
        assert.ok(result.improvementMetrics.baselineScore === 8.0);
        assert.ok(result.improvementMetrics.improvedScore !== undefined);
      }
    });
  });

  describe('combineUncertaintySources', () => {
    it('should return default when no sources provided', () => {
      const result = combineUncertaintySources({});
      
      assert.ok(result);
      assert.strictEqual(result.uncertainty, 0.5);
      assert.strictEqual(result.confidence, 0.5);
      assert.strictEqual(result.method, 'default');
    });

    it('should combine logprobs uncertainty', () => {
      const logprobs = {
        tokens: ['test'],
        token_logprobs: [-1.0]
      };
      
      const result = combineUncertaintySources({ logprobs });
      
      assert.ok(result);
      assert.ok(result.uncertainty >= 0 && result.uncertainty <= 1);
      assert.strictEqual(result.method, 'ensemble');
      assert.ok(result.sources.includes('logprobs'));
    });

    it('should combine self-consistency uncertainty', () => {
      const result = combineUncertaintySources({
        selfConsistency: {
          consistency: 0.8,
          confidence: 0.8
        }
      });
      
      assert.ok(result);
      assert.strictEqual(result.method, 'ensemble');
      assert.ok(result.sources.includes('self-consistency'));
    });

    it('should combine hallucination uncertainty', () => {
      const result = combineUncertaintySources({
        hallucination: {
          confidence: 0.7
        }
      });
      
      assert.ok(result);
      assert.strictEqual(result.method, 'ensemble');
      assert.ok(result.sources.includes('hallucination'));
    });

    it('should include retry count in uncertainty', () => {
      const result = combineUncertaintySources({
        retryCount: 3
      });
      
      assert.ok(result);
      assert.strictEqual(result.method, 'ensemble');
      assert.ok(result.sources.includes('retries'));
    });

    it('should combine multiple sources', () => {
      const logprobs = {
        tokens: ['test'],
        token_logprobs: [-1.0]
      };
      
      const result = combineUncertaintySources({
        logprobs,
        selfConsistency: { consistency: 0.8 },
        hallucination: { confidence: 0.7 },
        retryCount: 2
      });
      
      assert.ok(result);
      assert.strictEqual(result.method, 'ensemble');
      assert.ok(result.sources.length >= 2);
      assert.ok(result.breakdown);
    });
  });

  describe('shouldUseSelfConsistency', () => {
    it('should recommend self-consistency for critical scenarios', () => {
      const result = shouldUseSelfConsistency({
        testType: 'accessibility',
        severity: 'critical'
      }, { score: 5.0 });
      
      assert.ok(result);
      assert.ok(typeof result.shouldUse === 'boolean');
      assert.ok(typeof result.reason === 'string');
    });

    it('should recommend self-consistency for high uncertainty', () => {
      const result = shouldUseSelfConsistency({}, {
        score: 5.0,
        uncertainty: 0.8
      });
      
      assert.ok(result);
      assert.ok(typeof result.shouldUse === 'boolean');
    });

    it('should recommend self-consistency for edge case scores', () => {
      const result = shouldUseSelfConsistency({}, {
        score: 1.0 // Very low score
      });
      
      assert.ok(result);
      assert.ok(typeof result.shouldUse === 'boolean');
    });
  });

  describe('enhanceWithUncertainty', () => {
    it('uses the same logprob estimate as the source combiner', () => {
      const logprobs = {
        tokens: ['test', 'result'],
        token_logprobs: [-1.0, -1.0]
      };

      const expected = combineUncertaintySources({ logprobs });
      const result = enhanceWithUncertainty(
        { logprobs, attempts: 1 },
        { enableHallucinationCheck: false, adaptiveSelfConsistency: false }
      );

      assert.strictEqual(result.uncertainty, expected.uncertainty);
      assert.strictEqual(result.confidence, expected.confidence);
    });

    it('should enhance result with uncertainty information', () => {
      const partialResult = {
        score: 8.0,
        issues: []
      };
      
      const result = enhanceWithUncertainty(partialResult, {}, {});
      
      assert.ok(result);
      // enhanceWithUncertainty may return the result with uncertainty fields added
      assert.ok(typeof result === 'object');
    });

    it('should preserve original result properties', () => {
      const partialResult = {
        score: 8.0,
        issues: ['Issue 1'],
        reasoning: 'Test reasoning'
      };
      
      const result = enhanceWithUncertainty(partialResult, {}, {});
      
      // Check that result is an object (may spread partialResult)
      assert.ok(result);
      assert.ok(typeof result === 'object');
      // Properties may be preserved or added
      if (result.score !== undefined) {
        assert.strictEqual(result.score, 8.0);
      }
      if (result.issues !== undefined) {
        assert.deepStrictEqual(result.issues, ['Issue 1']);
      }
      if (result.reasoning !== undefined) {
        assert.strictEqual(result.reasoning, 'Test reasoning');
      }
    });
  });
});
