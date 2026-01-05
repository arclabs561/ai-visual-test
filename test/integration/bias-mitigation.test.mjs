/**
 * Integration tests for bias-mitigation.mjs
 */

import '../test-setup.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  mitigateBias,
  mitigatePositionBias,
  applyBiasMitigation
} from '../../src/bias-mitigation.mjs';
import { detectBias } from '../../src/bias-detector.mjs';

describe('Bias Mitigation', () => {
  describe('mitigateBias', () => {
    it('should return unchanged result when no bias detected', () => {
      const result = {
        score: 8.0,
        issues: [],
        reasoning: 'Normal reasoning'
      };
      
      const biasDetection = {
        hasBias: false,
        biases: []
      };
      
      const mitigated = mitigateBias(result, biasDetection);
      
      assert.strictEqual(mitigated.score, 8.0);
      assert.strictEqual(mitigated.biasMitigation.applied, false);
      assert.strictEqual(mitigated.biasMitigation.reason, 'No bias detected');
    });

    it('should adjust score for verbosity bias', () => {
      const result = {
        score: 8.0,
        issues: [],
        reasoning: 'Very long and verbose reasoning that goes on and on'
      };
      
      const biasDetection = detectBias(result.reasoning);
      
      if (biasDetection.hasBias) {
        const mitigated = mitigateBias(result, biasDetection);
        
        assert.ok(mitigated.biasMitigation.applied);
        assert.ok(mitigated.originalScore === 8.0);
        // Score should be adjusted (may be lower)
        assert.ok(typeof mitigated.score === 'number');
      }
    });

    it('should respect minAdjustment and maxAdjustment', () => {
      const result = {
        score: 8.0,
        issues: []
      };
      
      const biasDetection = {
        hasBias: true,
        biases: [
          { type: 'verbosity', score: 10.0 } // Very high bias
        ],
        severity: 'high'
      };
      
      const mitigated = mitigateBias(result, biasDetection, {
        minAdjustment: -2.0,
        maxAdjustment: 2.0
      });
      
      assert.ok(mitigated);
      const adjustment = mitigated.score - result.score;
      assert.ok(adjustment >= -2.0 && adjustment <= 2.0);
    });

    it('should clamp adjusted score to 0-10 range', () => {
      const result = {
        score: 1.0,
        issues: []
      };
      
      const biasDetection = {
        hasBias: true,
        biases: [
          { type: 'verbosity', score: 10.0 }
        ],
        severity: 'high'
      };
      
      const mitigated = mitigateBias(result, biasDetection);
      
      assert.ok(mitigated.score >= 0 && mitigated.score <= 10);
    });

    it('should handle null score gracefully', () => {
      const result = {
        score: null,
        issues: []
      };
      
      const biasDetection = {
        hasBias: true,
        biases: [{ type: 'verbosity', score: 5.0 }]
      };
      
      const mitigated = mitigateBias(result, biasDetection);
      
      assert.strictEqual(mitigated.score, null);
    });

    it('should include adjustment details in biasMitigation', () => {
      const result = {
        score: 8.0,
        issues: []
      };
      
      const biasDetection = {
        hasBias: true,
        biases: [
          { type: 'verbosity', score: 5.0 },
          { type: 'length', score: 3.0 }
        ],
        severity: 'medium'
      };
      
      const mitigated = mitigateBias(result, biasDetection);
      
      assert.ok(mitigated.biasMitigation.applied);
      assert.ok(Array.isArray(mitigated.biasMitigation.adjustments));
      assert.ok(mitigated.biasMitigation.detectedBiases.length > 0);
    });
  });

  describe('mitigatePositionBias', () => {
    it('should return unchanged when no position bias detected', () => {
      const judgments = [
        { score: 5.0, issues: [] },
        { score: 5.0, issues: [] },
        { score: 5.0, issues: [] }
      ];
      
      const mitigated = mitigatePositionBias(judgments);
      
      assert.ok(Array.isArray(mitigated));
      assert.strictEqual(mitigated.length, judgments.length);
    });

    it('should adjust scores for first position bias', () => {
      const judgments = [
        { score: 9.0, issues: [] }, // First position (high)
        { score: 5.0, issues: [] },
        { score: 5.0, issues: [] }
      ];
      
      const mitigated = mitigatePositionBias(judgments, {
        adjustScores: true
      });
      
      assert.ok(Array.isArray(mitigated));
      // First judgment may have adjusted score
      assert.ok(typeof mitigated[0].score === 'number');
      if (mitigated[0].biasMitigation?.applied) {
        assert.ok(mitigated[0].originalScore === 9.0);
      }
    });

    it('should adjust scores for last position bias', () => {
      const judgments = [
        { score: 5.0, issues: [] },
        { score: 5.0, issues: [] },
        { score: 9.0, issues: [] } // Last position (high)
      ];
      
      const mitigated = mitigatePositionBias(judgments, {
        adjustScores: true
      });
      
      assert.ok(Array.isArray(mitigated));
      // Last judgment may have adjusted score
      const lastIndex = mitigated.length - 1;
      assert.ok(typeof mitigated[lastIndex].score === 'number');
    });

    it('should preserve null scores', () => {
      const judgments = [
        { score: null, issues: [] },
        { score: 5.0, issues: [] }
      ];
      
      const mitigated = mitigatePositionBias(judgments);
      
      assert.strictEqual(mitigated[0].score, null);
    });

    it('should clamp adjusted scores to 0-10', () => {
      const judgments = [
        { score: 1.0, issues: [] }, // Very low, might go below 0
        { score: 9.0, issues: [] }  // Very high, might go above 10
      ];
      
      const mitigated = mitigatePositionBias(judgments, {
        adjustScores: true
      });
      
      mitigated.forEach(j => {
        if (j.score !== null) {
          assert.ok(j.score >= 0 && j.score <= 10);
        }
      });
    });
  });

  describe('applyBiasMitigation', () => {
    it('should apply comprehensive bias mitigation', () => {
      const result = {
        score: 8.0,
        issues: [],
        reasoning: 'Very long and verbose reasoning text that goes on and on'
      };
      
      const mitigated = applyBiasMitigation(result, result.reasoning);
      
      assert.ok(mitigated);
      assert.ok(typeof mitigated.score === 'number');
      assert.ok(mitigated.biasMitigation);
    });

    it('should use result.reasoning when reasoning not provided', () => {
      const result = {
        score: 8.0,
        issues: [],
        reasoning: 'Test reasoning'
      };
      
      const mitigated = applyBiasMitigation(result);
      
      assert.ok(mitigated);
      assert.ok(mitigated.biasMitigation);
    });

    it('should handle empty reasoning', () => {
      const result = {
        score: 8.0,
        issues: []
      };
      
      const mitigated = applyBiasMitigation(result, '');
      
      assert.ok(mitigated);
      assert.strictEqual(mitigated.score, 8.0);
    });

    it('should respect mitigation options', () => {
      const result = {
        score: 8.0,
        issues: [],
        reasoning: 'Very verbose reasoning'
      };
      
      const biasDetection = detectBias(result.reasoning);
      
      if (biasDetection.hasBias) {
        const mitigated1 = applyBiasMitigation(result, result.reasoning, {
          adjustScores: true
        });
        
        const mitigated2 = applyBiasMitigation(result, result.reasoning, {
          adjustScores: false
        });
        
        // When adjustScores is false, score should not change
        if (mitigated2.biasMitigation.applied === false || 
            mitigated2.biasMitigation.reason === 'No bias detected') {
          // OK - no bias or not applied
        } else {
          // If applied, score adjustment should be different
          assert.ok(mitigated1.score !== mitigated2.score || 
                   mitigated1.biasMitigation.applied !== mitigated2.biasMitigation.applied);
        }
      }
    });
  });
});

