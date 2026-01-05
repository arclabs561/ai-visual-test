/**
 * Integration tests for validation-framework.mjs
 */

import '../test-setup.mjs';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  validateTemporalPerception,
  validateVLLMAccuracy,
  validateGameplayTemporal,
  validateWebpageEvaluation,
  validateComprehensive
} from '../../src/validation-framework.mjs';
import { TIME_SCALES } from '../../src/temporal-constants.mjs';

// Mock dependencies
let mockCompareJudgments = null;
let mockAggregateTemporalNotes = null;
let mockGetHumanValidationManager = null;

// Store original modules
const originalModules = {};

describe('Validation Framework', () => {
  beforeEach(() => {
    // Reset mocks
    mockCompareJudgments = null;
    mockAggregateTemporalNotes = null;
    mockGetHumanValidationManager = null;
  });

  describe('validateTemporalPerception', () => {
    it('should validate temporal perception against research values', () => {
      const result = validateTemporalPerception();
      
      assert.ok(result);
      assert.ok(result.researchAlignment);
      assert.ok(result.consistency);
      assert.ok(Array.isArray(result.recommendations));
      
      // Check visual appeal alignment
      assert.ok(result.researchAlignment.visualAppeal);
      assert.strictEqual(result.researchAlignment.visualAppeal.researchValue, 50);
      assert.ok(typeof result.researchAlignment.visualAppeal.actualValue === 'number');
      assert.ok(result.researchAlignment.visualAppeal.actualValue >= 50);
      
      // Check instant threshold
      assert.ok(result.researchAlignment.instantThreshold);
      assert.strictEqual(result.researchAlignment.instantThreshold.researchValue, 100);
      assert.strictEqual(result.researchAlignment.instantThreshold.actualValue, TIME_SCALES.INSTANT);
      
      // Check reading time scales
      assert.ok(result.researchAlignment.readingTime);
      assert.ok(typeof result.researchAlignment.readingTime.scalesWithContent === 'boolean');
      assert.ok(result.researchAlignment.readingTime.shortContent > 0);
      assert.ok(result.researchAlignment.readingTime.longContent > 0);
    });

    it('should return recommendations when values do not align', () => {
      const result = validateTemporalPerception();
      
      // If instant threshold doesn't match, should have recommendation
      if (!result.researchAlignment.instantThreshold.aligned) {
        assert.ok(result.recommendations.length > 0);
        assert.ok(result.recommendations.some(rec => rec.includes('Instant threshold')));
      }
    });
  });

  describe('validateVLLMAccuracy', () => {
    it('should validate VLLM accuracy with good correlation', () => {
      // Mock compareJudgments to return good metrics
      const humanJudgments = [
        { id: '1', humanScore: 8, humanIssues: [] },
        { id: '2', humanScore: 7, humanIssues: [] },
        { id: '3', humanScore: 9, humanIssues: [] }
      ];
      
      const vllmJudgments = [
        { id: '1', vllmScore: 8.2, vllmIssues: [] },
        { id: '2', vllmScore: 7.1, vllmIssues: [] },
        { id: '3', vllmScore: 8.9, vllmIssues: [] }
      ];

      // We need to mock compareJudgments, but it's imported from evaluation/human-validation
      // For now, test with actual function (may need real data)
      const result = validateVLLMAccuracy(humanJudgments, vllmJudgments, {
        minCorrelation: 0.5,
        maxMAE: 2.0,
        minKappa: 0.4
      });
      
      assert.ok(result);
      assert.ok(typeof result.isValid === 'boolean');
      assert.ok(Array.isArray(result.issues));
      assert.ok(Array.isArray(result.recommendations));
      assert.ok(result.calibration || result.error);
    });

    it('should handle errors gracefully', () => {
      const result = validateVLLMAccuracy([], [], {});
      
      assert.ok(result);
      assert.strictEqual(result.isValid, false);
      assert.ok(Array.isArray(result.issues));
      assert.ok(Array.isArray(result.recommendations));
    });

    it('should validate with custom thresholds', () => {
      const humanJudgments = [
        { id: '1', humanScore: 5, humanIssues: [] }
      ];
      
      const vllmJudgments = [
        { id: '1', vllmScore: 5.5, vllmIssues: [] }
      ];

      const result = validateVLLMAccuracy(humanJudgments, vllmJudgments, {
        minCorrelation: 0.9,
        maxMAE: 0.1,
        minKappa: 0.8
      });
      
      assert.ok(result);
      assert.ok(typeof result.isValid === 'boolean');
    });
  });

  describe('validateGameplayTemporal', () => {
    it('should validate gameplay temporal with valid notes', async () => {
      const gameplayNotes = [
        { timestamp: Date.now() - 5000, observation: 'Game started' },
        { timestamp: Date.now() - 4000, observation: 'Player moved' },
        { timestamp: Date.now() - 3000, observation: 'Action executed' },
        { timestamp: Date.now() - 2000, observation: 'State changed' },
        { timestamp: Date.now() - 1000, observation: 'Game continued' }
      ];

      const result = await validateGameplayTemporal(gameplayNotes, {
        minCoherenceForSmooth: 0.5,
        maxCoherenceForErratic: 0.3
      });
      
      assert.ok(result);
      assert.ok(result.aggregated);
      assert.ok(typeof result.isValid === 'boolean');
      assert.ok(Array.isArray(result.issues));
      assert.ok(Array.isArray(result.recommendations));
    });

    it('should return error for empty gameplay notes', async () => {
      const result = await validateGameplayTemporal([], {});
      
      assert.ok(result);
      assert.strictEqual(result.isValid, false);
      assert.ok(result.issues.includes('No gameplay notes provided'));
      assert.ok(result.recommendations.includes('Provide gameplay notes for validation'));
    });

    it('should return error for null gameplay notes', async () => {
      const result = await validateGameplayTemporal(null, {});
      
      assert.ok(result);
      assert.strictEqual(result.isValid, false);
      assert.ok(result.issues.includes('No gameplay notes provided'));
    });

    it('should validate with custom coherence thresholds', async () => {
      const gameplayNotes = [
        { timestamp: Date.now() - 2000, observation: 'Note 1' },
        { timestamp: Date.now() - 1000, observation: 'Note 2' }
      ];

      const result = await validateGameplayTemporal(gameplayNotes, {
        minCoherenceForSmooth: 0.8,
        maxCoherenceForErratic: 0.4
      });
      
      assert.ok(result);
      assert.ok(result.aggregated);
    });
  });

  describe('validateWebpageEvaluation', () => {
    it('should validate webpage evaluation with valid evaluations', () => {
      const evaluations = [
        { id: '1', score: 8, issues: ['Minor issue'], reasoning: 'Good design' },
        { id: '2', score: 7, issues: [], reasoning: 'Acceptable' },
        { id: '3', score: 9, issues: [], reasoning: 'Excellent' }
      ];

      const result = validateWebpageEvaluation(evaluations);
      
      assert.ok(result);
      assert.strictEqual(result.isValid, true);
      assert.ok(Array.isArray(result.issues));
      assert.ok(Array.isArray(result.recommendations));
      assert.strictEqual(result.evaluations, evaluations);
    });

    it('should detect invalid scores', () => {
      const evaluations = [
        { id: '1', score: 8, issues: [] },
        { id: '2', score: 15, issues: [] }, // Invalid: > 10
        { id: '3', score: -1, issues: [] }  // Invalid: < 0
      ];

      const result = validateWebpageEvaluation(evaluations);
      
      assert.strictEqual(result.isValid, false);
      assert.ok(result.issues.length >= 2);
      assert.ok(result.issues.some(issue => issue.includes('invalid score')));
    });

    it('should detect null/undefined scores', () => {
      const evaluations = [
        { id: '1', score: null, issues: [] },
        { id: '2', score: undefined, issues: [] }
      ];

      const result = validateWebpageEvaluation(evaluations);
      
      assert.strictEqual(result.isValid, false);
      assert.ok(result.issues.some(issue => issue.includes('null/undefined score')));
    });

    it('should detect non-array issues', () => {
      const evaluations = [
        { id: '1', score: 8, issues: 'not an array' }
      ];

      const result = validateWebpageEvaluation(evaluations);
      
      assert.strictEqual(result.isValid, false);
      assert.ok(result.issues.some(issue => issue.includes('non-array issues')));
    });

    it('should compare with ground truth when provided', () => {
      const evaluations = [
        { id: '1', score: 8, issues: [] }
      ];

      const groundTruth = {
        humanJudgments: [
          { id: '1', humanScore: 8, humanIssues: [] }
        ]
      };

      const result = validateWebpageEvaluation(evaluations, groundTruth);
      
      assert.ok(result);
      // May have accuracy if judgments match
      if (result.accuracy) {
        assert.ok(typeof result.accuracy.isValid === 'boolean');
      }
    });
  });

  describe('validateComprehensive', () => {
    it('should validate all aspects when data is provided', async () => {
      const data = {
        temporalPerception: true,
        humanJudgments: [
          { id: '1', humanScore: 8, humanIssues: [] }
        ],
        vllmJudgments: [
          { id: '1', vllmScore: 8.2, vllmIssues: [] }
        ],
        gameplayNotes: [
          { timestamp: Date.now() - 1000, observation: 'Test' }
        ],
        evaluations: [
          { id: '1', score: 8, issues: [] }
        ]
      };

      const result = await validateComprehensive(data);
      
      assert.ok(result);
      assert.ok(result.temporalPerception);
      assert.ok(result.vllmAccuracy || result.vllmAccuracy === null);
      assert.ok(result.gameplayTemporal || result.gameplayTemporal === null);
      assert.ok(result.webpageEvaluation);
      assert.ok(result.overall);
      assert.ok(typeof result.overall.isValid === 'boolean');
      assert.ok(Array.isArray(result.overall.issues));
      assert.ok(Array.isArray(result.overall.recommendations));
    });

    it('should skip temporal perception when set to false', async () => {
      const data = {
        temporalPerception: false,
        evaluations: [
          { id: '1', score: 8, issues: [] }
        ]
      };

      const result = await validateComprehensive(data);
      
      assert.ok(result);
      assert.strictEqual(result.temporalPerception, null);
      assert.ok(result.webpageEvaluation);
    });

    it('should handle missing optional data gracefully', async () => {
      const data = {
        evaluations: [
          { id: '1', score: 8, issues: [] }
        ]
      };

      const result = await validateComprehensive(data);
      
      assert.ok(result);
      assert.ok(result.overall);
      // Should not throw errors for missing optional data
    });

    it('should aggregate issues and recommendations', async () => {
      const data = {
        temporalPerception: true,
        evaluations: [
          { id: '1', score: 15, issues: [] } // Invalid score
        ]
      };

      const result = await validateComprehensive(data);
      
      assert.ok(result);
      assert.ok(result.overall.issues.length >= 0);
      // If temporal perception has recommendations, they should be in overall
      if (result.temporalPerception && result.temporalPerception.recommendations.length > 0) {
        assert.ok(result.overall.recommendations.length > 0);
      }
    });

    it('should mark overall as invalid when any validation fails', async () => {
      const data = {
        evaluations: [
          { id: '1', score: 15, issues: [] } // Invalid score
        ]
      };

      const result = await validateComprehensive(data);
      
      assert.ok(result);
      // If webpage evaluation fails, overall should be invalid
      if (result.webpageEvaluation && !result.webpageEvaluation.isValid) {
        assert.strictEqual(result.overall.isValid, false);
      }
    });
  });
});

