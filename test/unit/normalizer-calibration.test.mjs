import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeValidationResult } from '../../src/validation-result-normalizer.mjs';
import { setCalibrationProfile, resetCalibrationProfiles } from '../../src/score-calibration.mjs';

describe('Normalizer Calibration Integration', () => {
  beforeEach(() => {
    resetCalibrationProfiles();
  });

  it('should preserve rawScore when provider is present', () => {
    const result = normalizeValidationResult({
      score: 8,
      provider: 'gemini',
      issues: []
    }, 'test');
    // With default identity profile, rawScore === score
    assert.equal(result.rawScore, 8);
    assert.equal(result.score, 8);
  });

  it('should apply calibration offset when profile is set', () => {
    setCalibrationProfile('openai', { offset: -1, scale: 1.0 });
    const result = normalizeValidationResult({
      score: 8,
      provider: 'openai',
      issues: []
    }, 'test');
    assert.equal(result.rawScore, 8);
    assert.equal(result.score, 7);
  });

  it('should not add rawScore when provider is absent', () => {
    const result = normalizeValidationResult({
      score: 5,
      issues: []
    }, 'test');
    assert.equal(result.score, 5);
    assert.equal(result.rawScore, undefined);
  });

  it('should not calibrate null scores', () => {
    const result = normalizeValidationResult({
      score: null,
      provider: 'gemini',
      issues: []
    }, 'test');
    assert.equal(result.score, null);
    assert.equal(result.rawScore, undefined);
  });

  it('should preserve score 0 through calibration', () => {
    const result = normalizeValidationResult({
      score: 0,
      provider: 'gemini',
      issues: []
    }, 'test');
    assert.equal(result.rawScore, 0);
    assert.equal(result.score, 0);
  });
});
