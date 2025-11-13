/**
 * Validation Tests: Human Ground Truth Validation
 * 
 * Tests whether we can validate VLLM judgments against human ground truth.
 * Validates:
 * - Human judgment collection works
 * - Calibration metrics are accurate
 * - Ground truth datasets can be used for validation
 * - Temporal perception validation against human data
 * 
 * These tests validate that our validation systems work correctly.
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  compareJudgments,
  collectHumanJudgment,
  loadHumanJudgment,
  saveCalibrationResults,
  generateCalibrationReport
} from '../evaluation/human-validation/human-validation.mjs';
import { getHumanValidationManager, initHumanValidation } from '../src/human-validation-manager.mjs';

const VALIDATION_DIR = join(process.cwd(), 'evaluation', 'human-validation');

test.describe('Human Ground Truth Validation', () => {
  
  test('can collect and match human judgments with VLLM judgments', () => {
    // Test that we can collect human judgments and match them with VLLM judgments
    
    const judgmentId = 'ground-truth-test-' + Date.now();
    
    const humanJudgment = {
      id: judgmentId,
      screenshot: 'test-screenshot.png',
      prompt: 'Test prompt',
      humanScore: 8,
      humanIssues: ['issue1', 'issue2'],
      humanReasoning: 'Test reasoning',
      timestamp: new Date().toISOString()
    };
    
    const vllmJudgment = {
      id: judgmentId,
      screenshot: 'test-screenshot.png',
      prompt: 'Test prompt',
      vllmScore: 7.5,
      vllmIssues: ['issue1'],
      vllmReasoning: 'VLLM reasoning',
      provider: 'gemini',
      timestamp: new Date().toISOString()
    };
    
    // Collect human judgment
    collectHumanJudgment(humanJudgment);
    
    // Load it back
    const loaded = loadHumanJudgment(judgmentId);
    assert.ok(loaded, 'Human judgment should be loadable');
    
    // Compare judgments
    const calibration = compareJudgments([humanJudgment], [vllmJudgment]);
    
    assert.ok(calibration.agreement, 'Should have agreement metrics');
    assert.ok(typeof calibration.agreement.mae === 'number', 'Should calculate MAE');
    assert.ok(calibration.agreement.mae >= 0, 'MAE should be non-negative');
    
    // Score difference: 8 - 7.5 = 0.5
    assert.ok(calibration.agreement.mae <= 1, 'MAE should be reasonable for test data');
  });
  
  test('calibration detects when VLLM is too lenient', () => {
    // Test that calibration detects when VLLM scores are consistently higher than human
    
    const humanJudgments = [
      { id: 'test1', humanScore: 5, humanIssues: ['issue1'] },
      { id: 'test2', humanScore: 6, humanIssues: ['issue2'] },
      { id: 'test3', humanScore: 7, humanIssues: [] }
    ];
    
    const vllmJudgments = [
      { id: 'test1', vllmScore: 9, vllmIssues: ['issue1'] }, // +4 bias
      { id: 'test2', vllmScore: 9, vllmIssues: ['issue2'] }, // +3 bias
      { id: 'test3', vllmScore: 9, vllmIssues: [] } // +2 bias
    ];
    
    const calibration = compareJudgments(humanJudgments, vllmJudgments);
    
    // Should detect positive bias (VLLM higher than human)
    assert.ok(calibration.bias.scoreBias > 0, 'Should detect positive bias (VLLM too lenient)');
    assert.ok(calibration.bias.scoreBias > 2, 'Bias should be significant (>2 points)');
    
    // Should recommend calibration adjustment
    assert.ok(calibration.recommendations.some(r => 
      r.includes('bias') || r.includes('calibration') || r.includes('adjust')
    ), 'Should recommend calibration adjustment for high bias');
  });
  
  test('calibration detects when VLLM is too strict', () => {
    // Test that calibration detects when VLLM scores are consistently lower than human
    
    const humanJudgments = [
      { id: 'test1', humanScore: 9, humanIssues: [] },
      { id: 'test2', humanScore: 8, humanIssues: [] },
      { id: 'test3', humanScore: 9, humanIssues: [] }
    ];
    
    const vllmJudgments = [
      { id: 'test1', vllmScore: 5, vllmIssues: [] }, // -4 bias
      { id: 'test2', vllmScore: 4, vllmIssues: [] }, // -4 bias
      { id: 'test3', vllmScore: 5, vllmIssues: [] } // -4 bias
    ];
    
    const calibration = compareJudgments(humanJudgments, vllmJudgments);
    
    // Should detect negative bias (VLLM lower than human)
    assert.ok(calibration.bias.scoreBias < 0, 'Should detect negative bias (VLLM too strict)');
    assert.ok(calibration.bias.scoreBias < -2, 'Bias should be significant (<-2 points)');
  });
  
  test('calibration report generation works', () => {
    // Test that calibration reports are generated correctly
    
    const calibration = {
      agreement: {
        kappa: 0.75,
        mae: 0.8,
        rmse: 1.2,
        pearson: 0.85,
        spearman: 0.82
      },
      bias: {
        scoreBias: 0.5,
        issueBias: 0.1
      },
      recommendations: [
        'VLLM scores are slightly higher than human scores',
        'Good agreement overall'
      ]
    };
    
    const report = generateCalibrationReport(calibration);
    
    assert.ok(report.includes('Calibration Report'), 'Report should have title');
    assert.ok(report.includes('0.75'), 'Report should include kappa');
    assert.ok(report.includes('0.85'), 'Report should include Pearson correlation');
    assert.ok(report.includes('0.5'), 'Report should include bias');
    assert.ok(report.includes('recommendations') || report.includes('Recommendations'), 
      'Report should include recommendations section');
  });
  
  test('human validation manager tracks judgments correctly', async () => {
    // Test that HumanValidationManager correctly tracks VLLM judgments
    
    const manager = initHumanValidation({
      enabled: true,
      autoCollect: true
    });
    
    // Simulate VLLM judgment
    const vllmJudgment = {
      id: 'manager-test-' + Date.now(),
      screenshot: 'test.png',
      prompt: 'Test',
      vllmScore: 8,
      vllmIssues: ['issue1'],
      vllmReasoning: 'Test reasoning',
      provider: 'gemini',
      timestamp: new Date().toISOString()
    };
    
    // collectVLLMJudgment is async but doesn't return a promise we can await
    // It pushes to vllmJudgments array synchronously
    manager.collectVLLMJudgment(vllmJudgment, 'test.png', 'Test', {});
    
    // Wait a bit for async operations
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Should have collected judgment
    assert.ok(manager.vllmJudgments.length > 0, 'Should have collected VLLM judgment');
    // Check by matching screenshot or prompt since ID might be generated
    const found = manager.vllmJudgments.some(j => 
      j.screenshot === vllmJudgment.screenshot || 
      j.prompt === vllmJudgment.prompt ||
      j.id === vllmJudgment.id
    );
    assert.ok(found, 'Should have the judgment we just collected');
  });
  
  test('calibration status reports correctly', () => {
    // Test that calibration status is reported correctly
    
    const manager = initHumanValidation({
      enabled: true
    });
    
    const status = manager.getCalibrationStatus();
    
    assert.ok(status, 'Should return status object');
    assert.ok(typeof status.calibrated === 'boolean', 'Should report calibrated status');
    assert.ok(typeof status.message === 'string', 'Should have status message');
  });
  
  test('calibration application adjusts scores correctly', () => {
    // Test that calibration application adjusts VLLM scores
    
    const manager = initHumanValidation({
      enabled: true
    });
    
    // Manually set calibration cache with known bias
    manager.calibrationCache = {
      judgments: [],
      lastCalibration: {
        bias: {
          scoreBias: 1.0 // VLLM scores 1 point higher on average
        },
        timestamp: new Date().toISOString()
      },
      stats: {
        total: 10,
        agreements: 8,
        disagreements: 2
      }
    };
    
    // Apply calibration
    const originalScore = 8;
    const calibrated = manager.applyCalibration(originalScore);
    
    // With +1 bias, calibrated score should be lower
    assert.ok(calibrated <= originalScore, 'Calibrated score should adjust for bias');
    assert.ok(calibrated >= originalScore - 2, 'Calibration should not over-adjust');
  });
});

