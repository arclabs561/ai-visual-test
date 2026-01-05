import { test } from 'node:test';
import assert from 'node:assert';
import { getHumanValidationManager } from '../../src/human-validation-manager.mjs';

test('trackSequenceCalibration detects degradation', () => {
  const manager = getHumanValidationManager();
  
  // Simulate degradation (confidence drops over time)
  const results = [
    { confidence: 0.9, score: 8, uncertainty: 0.1 },
    { confidence: 0.85, score: 7.5, uncertainty: 0.15 },
    { confidence: 0.8, score: 7, uncertainty: 0.2 },
    { confidence: 0.75, score: 6.5, uncertainty: 0.25 },
    { confidence: 0.7, score: 6, uncertainty: 0.3 },
    { confidence: 0.65, score: 5.5, uncertainty: 0.35 },
    { confidence: 0.6, score: 5, uncertainty: 0.4 },
    { confidence: 0.55, score: 4.5, uncertainty: 0.45 },
    { confidence: 0.5, score: 4, uncertainty: 0.5 },
    { confidence: 0.45, score: 3.5, uncertainty: 0.55 }
  ];

  let degradationDetected = false;
  for (let i = 0; i < results.length; i++) {
    const degradation = manager.trackSequenceCalibration(i, results[i]);
    if (degradation.degraded) {
      degradationDetected = true;
      assert.ok(degradation.degradation > 0.15, 'Degradation should be >15%');
      assert.ok(degradation.recommendation, 'Should provide recommendation');
      break;
    }
  }

  assert.ok(degradationDetected, 'Should detect degradation in sequence');
});

test('getSequenceCalibrationMetrics returns quality metrics', () => {
  const manager = getHumanValidationManager();
  
  // Add some results
  const results = [
    { confidence: 0.9, score: 8 },
    { confidence: 0.85, score: 7.5 },
    { confidence: 0.8, score: 7 },
    { confidence: 0.75, score: 6.5 },
    { confidence: 0.7, score: 6 }
  ];

  for (let i = 0; i < results.length; i++) {
    manager.trackSequenceCalibration(i, results[i]);
  }

  const metrics = manager.getSequenceCalibrationMetrics();
  assert.ok(metrics.quality, 'Should return quality');
  assert.ok(metrics.variance !== undefined, 'Should return variance');
  assert.ok(metrics.trend !== undefined, 'Should return trend');
});

