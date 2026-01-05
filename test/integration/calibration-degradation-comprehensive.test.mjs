import { test } from 'node:test';
import assert from 'node:assert';
import { getHumanValidationManager } from '../../src/human-validation-manager.mjs';

test('trackSequenceCalibration detects gradual degradation', () => {
  const manager = getHumanValidationManager();
  
  // Reset sequence history for this test
  manager.sequenceHistory = [];
  
  // Simulate gradual degradation over 20 steps
  const results = Array.from({ length: 20 }, (_, i) => ({
    confidence: 0.9 - (i * 0.02), // Gradual decline
    score: 8 - (i * 0.2),
    uncertainty: 0.1 + (i * 0.02)
  }));

  let degradationDetected = false;
  let detectionIndex = -1;
  
  for (let i = 0; i < results.length; i++) {
    const degradation = manager.trackSequenceCalibration(i, results[i]);
    if (degradation.degraded && !degradationDetected) {
      degradationDetected = true;
      detectionIndex = i;
      assert.ok(degradation.degradation > 0.15, 'Should detect >15% degradation');
      assert.ok(degradation.recommendation, 'Should provide recommendation');
      assert.ok(degradation.suggestedAction, 'Should suggest action');
    }
  }

  assert.ok(degradationDetected, 'Should detect degradation in long sequence');
  assert.ok(detectionIndex >= 5, 'Should detect after at least 5 steps');
});

test('trackSequenceCalibration handles stable sequences', () => {
  const manager = getHumanValidationManager();
  
  // Reset sequence history for this test
  manager.sequenceHistory = [];
  
  // Simulate stable sequence (no degradation)
  const results = Array.from({ length: 10 }, () => ({
    confidence: 0.85, // Stable
    score: 7.5,
    uncertainty: 0.15
  }));

  let degradationDetected = false;
  
  for (let i = 0; i < results.length; i++) {
    const degradation = manager.trackSequenceCalibration(i, results[i]);
    if (degradation.degraded) {
      degradationDetected = true;
    }
  }

  assert.ok(!degradationDetected, 'Should not detect degradation in stable sequence');
});

test('trackSequenceCalibration handles rapid degradation', () => {
  const manager = getHumanValidationManager();
  
  // Reset sequence history for this test
  manager.sequenceHistory = [];
  
  // Simulate rapid degradation (sudden drop)
  const results = [
    { confidence: 0.9, score: 8, uncertainty: 0.1 },
    { confidence: 0.9, score: 8, uncertainty: 0.1 },
    { confidence: 0.9, score: 8, uncertainty: 0.1 },
    { confidence: 0.9, score: 8, uncertainty: 0.1 },
    { confidence: 0.9, score: 8, uncertainty: 0.1 },
    { confidence: 0.5, score: 4, uncertainty: 0.5 }, // Sudden drop
    { confidence: 0.5, score: 4, uncertainty: 0.5 },
    { confidence: 0.5, score: 4, uncertainty: 0.5 },
    { confidence: 0.5, score: 4, uncertainty: 0.5 },
    { confidence: 0.5, score: 4, uncertainty: 0.5 }
  ];

  let degradationDetected = false;
  
  for (let i = 0; i < results.length; i++) {
    const degradation = manager.trackSequenceCalibration(i, results[i]);
    if (degradation.degraded) {
      degradationDetected = true;
      // Degradation should be > 0.15 threshold (actual value depends on sequence)
      assert.ok(degradation.degradation > 0.15, `Should detect >15% degradation for rapid drop (got ${degradation.degradation})`);
      assert.ok(degradation.recommendation, 'Should provide recommendation');
      break;
    }
  }

  assert.ok(degradationDetected, 'Should detect rapid degradation');
});

test('getSequenceCalibrationMetrics handles edge cases', () => {
  const manager = getHumanValidationManager();
  
  // Reset sequence history for this test
  manager.sequenceHistory = [];
  
  // Test with insufficient data
  const metrics1 = manager.getSequenceCalibrationMetrics();
  assert.ok(metrics1.quality === 'unknown', 'Should return unknown for insufficient data');
  
  // Test with single entry
  manager.trackSequenceCalibration(0, { confidence: 0.8, score: 7 });
  const metrics2 = manager.getSequenceCalibrationMetrics();
  assert.ok(metrics2.quality === 'unknown', 'Should return unknown for single entry');
  
  // Test with two entries
  manager.trackSequenceCalibration(1, { confidence: 0.7, score: 6 });
  const metrics3 = manager.getSequenceCalibrationMetrics();
  assert.ok(metrics3.quality !== undefined, 'Should return metrics for two+ entries');
});

test('calculateVariance handles various inputs through metrics', () => {
  // Test variance calculation through getSequenceCalibrationMetrics
  const manager1 = getHumanValidationManager();
  manager1.sequenceHistory = [];
  
  // Empty sequence
  const metrics1 = manager1.getSequenceCalibrationMetrics();
  assert.ok(metrics1.quality === 'unknown', 'Should handle empty sequence');
  
  // Identical values (should have very low variance)
  manager1.trackSequenceCalibration(0, { confidence: 0.8, score: 7 });
  manager1.trackSequenceCalibration(1, { confidence: 0.8, score: 7 });
  manager1.trackSequenceCalibration(2, { confidence: 0.8, score: 7 });
  const metrics2 = manager1.getSequenceCalibrationMetrics();
  assert.ok(metrics2.variance !== undefined, 'Should calculate variance');
  assert.ok(metrics2.variance >= 0, 'Variance should be non-negative');
  assert.ok(metrics2.variance < 0.01, 'Identical values should have very low variance');
  
  // Varying values (should have higher variance)
  const manager2 = getHumanValidationManager();
  manager2.sequenceHistory = [];
  manager2.trackSequenceCalibration(0, { confidence: 0.9, score: 8 });
  manager2.trackSequenceCalibration(1, { confidence: 0.7, score: 6 });
  manager2.trackSequenceCalibration(2, { confidence: 0.5, score: 4 });
  const metrics3 = manager2.getSequenceCalibrationMetrics();
  assert.ok(metrics3.variance > metrics2.variance, 'Varying values should have higher variance');
});

test('calculateTrend handles various patterns through metrics', () => {
  // Test increasing trend
  const manager1 = getHumanValidationManager();
  manager1.sequenceHistory = [];
  manager1.trackSequenceCalibration(0, { confidence: 0.5, score: 5 });
  manager1.trackSequenceCalibration(1, { confidence: 0.6, score: 6 });
  manager1.trackSequenceCalibration(2, { confidence: 0.7, score: 7 });
  manager1.trackSequenceCalibration(3, { confidence: 0.8, score: 8 });
  manager1.trackSequenceCalibration(4, { confidence: 0.9, score: 9 });
  const metrics1 = manager1.getSequenceCalibrationMetrics();
  assert.ok(metrics1.trend > 0, 'Should detect increasing trend');
  
  // Test decreasing trend
  const manager2 = getHumanValidationManager();
  manager2.sequenceHistory = [];
  manager2.trackSequenceCalibration(0, { confidence: 0.9, score: 9 });
  manager2.trackSequenceCalibration(1, { confidence: 0.8, score: 8 });
  manager2.trackSequenceCalibration(2, { confidence: 0.7, score: 7 });
  manager2.trackSequenceCalibration(3, { confidence: 0.6, score: 6 });
  manager2.trackSequenceCalibration(4, { confidence: 0.5, score: 5 });
  const metrics2 = manager2.getSequenceCalibrationMetrics();
  assert.ok(metrics2.trend < 0, 'Should detect decreasing trend');
  
  // Test stable trend
  const manager3 = getHumanValidationManager();
  manager3.sequenceHistory = [];
  manager3.trackSequenceCalibration(0, { confidence: 0.8, score: 8 });
  manager3.trackSequenceCalibration(1, { confidence: 0.8, score: 8 });
  manager3.trackSequenceCalibration(2, { confidence: 0.8, score: 8 });
  manager3.trackSequenceCalibration(3, { confidence: 0.8, score: 8 });
  manager3.trackSequenceCalibration(4, { confidence: 0.8, score: 8 });
  const metrics3 = manager3.getSequenceCalibrationMetrics();
  assert.ok(Math.abs(metrics3.trend) < 0.1, 'Should detect stable trend (trend near 0)');
});

