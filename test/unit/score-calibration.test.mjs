import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  calibrateScore,
  setCalibrationProfile,
  getCalibrationProfile,
  resetCalibrationProfiles,
  deriveCalibrationProfile,
  analyzeScoreDistribution
} from '../../src/score-calibration.mjs';

describe('Score Calibration', () => {
  beforeEach(() => {
    resetCalibrationProfiles();
  });

  describe('calibrateScore', () => {
    it('should return null for null input', () => {
      assert.equal(calibrateScore(null, 'gemini'), null);
    });

    it('should return null for undefined input', () => {
      assert.equal(calibrateScore(undefined, 'gemini'), null);
    });

    it('should pass through score with default profile (identity)', () => {
      assert.equal(calibrateScore(7, 'gemini'), 7);
    });

    it('should preserve score 0', () => {
      assert.equal(calibrateScore(0, 'gemini'), 0);
    });

    it('should apply custom offset', () => {
      setCalibrationProfile('gemini', { offset: -1, scale: 1.0 });
      assert.equal(calibrateScore(8, 'gemini'), 7);
    });

    it('should apply custom scale', () => {
      setCalibrationProfile('openai', { offset: 0, scale: 0.9 });
      const result = calibrateScore(10, 'openai');
      assert.equal(result, 9);
    });

    it('should clamp to 0-10 range', () => {
      setCalibrationProfile('claude', { offset: 5, scale: 1.0 });
      assert.equal(calibrateScore(8, 'claude'), 10); // 13 clamped to 10

      setCalibrationProfile('claude', { offset: -5, scale: 1.0 });
      assert.equal(calibrateScore(3, 'claude'), 0); // -2 clamped to 0
    });

    it('should handle unknown provider with identity profile', () => {
      assert.equal(calibrateScore(5, 'unknown_provider'), 5);
    });
  });

  describe('setCalibrationProfile / getCalibrationProfile', () => {
    it('should store and retrieve profile', () => {
      setCalibrationProfile('gemini', { offset: -0.5, scale: 1.1 });
      const profile = getCalibrationProfile('gemini');
      assert.equal(profile.offset, -0.5);
      assert.equal(profile.scale, 1.1);
    });

    it('should reject non-numeric offset', () => {
      assert.throws(() => setCalibrationProfile('gemini', { offset: 'bad', scale: 1.0 }));
    });

    it('should reject zero scale', () => {
      assert.throws(() => setCalibrationProfile('gemini', { offset: 0, scale: 0 }));
    });

    it('should reject negative scale', () => {
      assert.throws(() => setCalibrationProfile('gemini', { offset: 0, scale: -1 }));
    });
  });

  describe('resetCalibrationProfiles', () => {
    it('should reset to defaults', () => {
      setCalibrationProfile('gemini', { offset: 5, scale: 2 });
      resetCalibrationProfiles();
      const profile = getCalibrationProfile('gemini');
      assert.equal(profile.offset, 0);
      assert.equal(profile.scale, 1.0);
    });
  });

  describe('deriveCalibrationProfile', () => {
    it('should derive identity for perfectly calibrated data', () => {
      const pairs = [
        { raw: 2, expected: 2 },
        { raw: 5, expected: 5 },
        { raw: 8, expected: 8 }
      ];
      const profile = deriveCalibrationProfile(pairs);
      assert.ok(Math.abs(profile.scale - 1.0) < 0.01);
      assert.ok(Math.abs(profile.offset) < 0.01);
      assert.ok(profile.r2 > 0.99);
    });

    it('should derive correction for systematically high scorer', () => {
      // VLM scores 2 points higher than expected
      const pairs = [
        { raw: 4, expected: 2 },
        { raw: 7, expected: 5 },
        { raw: 10, expected: 8 }
      ];
      const profile = deriveCalibrationProfile(pairs);
      // After calibration, raw 7 should map close to 5
      const calibrated = (7 + profile.offset) * profile.scale;
      assert.ok(Math.abs(calibrated - 5) < 0.5);
    });

    it('should reject fewer than 2 pairs', () => {
      assert.throws(() => deriveCalibrationProfile([{ raw: 5, expected: 5 }]));
    });

    it('should handle identical raw scores gracefully', () => {
      const pairs = [
        { raw: 5, expected: 3 },
        { raw: 5, expected: 7 }
      ];
      const profile = deriveCalibrationProfile(pairs);
      assert.equal(profile.r2, 0);
    });
  });

  describe('analyzeScoreDistribution', () => {
    it('should compute mean and stddev', () => {
      const scores = [4, 6, 8];
      const dist = analyzeScoreDistribution(scores);
      assert.equal(dist.mean, 6);
      assert.ok(dist.stddev > 0);
    });

    it('should build histogram with integer buckets', () => {
      const scores = [1, 1, 3, 7, 9];
      const dist = analyzeScoreDistribution(scores);
      assert.equal(dist.histogram[1], 2);
      assert.equal(dist.histogram[3], 1);
      assert.equal(dist.histogram[7], 1);
      assert.equal(dist.histogram[9], 1);
      assert.equal(dist.histogram[5], 0);
    });

    it('should handle empty array', () => {
      const dist = analyzeScoreDistribution([]);
      assert.equal(dist.mean, 0);
      assert.equal(dist.stddev, 0);
    });

    it('should compute skewness', () => {
      // Right-skewed: many low, few high
      const scores = [1, 1, 2, 2, 3, 3, 9, 10];
      const dist = analyzeScoreDistribution(scores);
      assert.ok(dist.skew > 0, `Expected positive skew, got ${dist.skew}`);
    });
  });
});
