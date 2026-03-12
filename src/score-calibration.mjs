/**
 * Score Calibration
 *
 * Adjusts raw VLM scores to reduce provider-specific bias.
 * Research shows each VLM has a stable "evaluative fingerprint" --
 * systematic scoring tendencies that differ across providers
 * (Evaluative Fingerprints, arXiv:2601.05114).
 *
 * Supports:
 * - Per-provider linear calibration (offset + scale)
 * - User-supplied calibration profiles
 * - Score histogram analysis for drift detection
 */

import { warn } from './logger.mjs';
import { ValidationError } from './errors.mjs';

/**
 * Default calibration profiles per provider.
 *
 * These are initial estimates based on observed tendencies.
 * Users should override with their own profiles via calibrate()
 * after running createCalibrationSuite().
 *
 * Format: { offset, scale } where calibrated = (raw + offset) * scale
 * Then clamped to [0, 10].
 */
const DEFAULT_PROFILES = {
  gemini:    { offset: 0, scale: 1.0 },
  openai:    { offset: 0, scale: 1.0 },
  claude:    { offset: 0, scale: 1.0 },
  groq:      { offset: 0, scale: 1.0 },
  openrouter: { offset: 0, scale: 1.0 }
};

// User-supplied profiles override defaults
let userProfiles = {};

/**
 * Set calibration profile for a provider
 *
 * @param {string} provider - Provider name
 * @param {{ offset: number, scale: number }} profile - Calibration profile
 */
export function setCalibrationProfile(provider, profile) {
  if (typeof profile.offset !== 'number' || typeof profile.scale !== 'number') {
    throw new ValidationError('Calibration profile must have numeric offset and scale', { offset: typeof profile.offset, scale: typeof profile.scale });
  }
  if (profile.scale <= 0) {
    throw new ValidationError('Calibration scale must be positive', { scale: profile.scale });
  }
  userProfiles[provider] = { ...profile };
}

/**
 * Get calibration profile for a provider
 *
 * @param {string} provider - Provider name
 * @returns {{ offset: number, scale: number }} Calibration profile
 */
export function getCalibrationProfile(provider) {
  return userProfiles[provider] || DEFAULT_PROFILES[provider] || { offset: 0, scale: 1.0 };
}

/**
 * Reset all calibration profiles to defaults
 */
export function resetCalibrationProfiles() {
  userProfiles = {};
}

/**
 * Calibrate a raw score using the provider's profile
 *
 * @param {number | null} score - Raw score from VLM (0-10)
 * @param {string} provider - Provider name
 * @returns {number | null} Calibrated score (0-10), or null if input is null
 */
export function calibrateScore(score, provider) {
  if (score === null || score === undefined) {
    return null;
  }

  const profile = getCalibrationProfile(provider);
  const calibrated = (score + profile.offset) * profile.scale;

  // Clamp to [0, 10]
  return Math.max(0, Math.min(10, Math.round(calibrated * 100) / 100));
}

/**
 * Derive a calibration profile from labeled data
 *
 * Given pairs of (raw VLM score, expected score), computes the
 * least-squares linear fit: expected = raw * scale + offset.
 *
 * @param {Array<{ raw: number, expected: number }>} pairs - Score pairs
 * @returns {{ offset: number, scale: number, r2: number }} Calibration profile with fit quality
 */
export function deriveCalibrationProfile(pairs) {
  if (!Array.isArray(pairs) || pairs.length < 2) {
    throw new ValidationError('Need at least 2 (raw, expected) pairs to derive calibration', { count: pairs?.length ?? 0 });
  }

  const n = pairs.length;
  let sumX = 0, sumY = 0, sumXX = 0, sumXY = 0, sumYY = 0;

  for (const { raw, expected } of pairs) {
    sumX += raw;
    sumY += expected;
    sumXX += raw * raw;
    sumXY += raw * expected;
    sumYY += expected * expected;
  }

  const denom = n * sumXX - sumX * sumX;

  if (Math.abs(denom) < 1e-10) {
    warn('[Calibration] All raw scores are identical; cannot derive profile');
    return { offset: 0, scale: 1.0, r2: 0 };
  }

  // Linear regression: expected = scale * raw + offset_intercept
  // We want calibrated = (raw + offset) * scale, so:
  // calibrated = raw * scale + offset * scale
  // Matching: scale = slope, offset_intercept = offset * scale -> offset = intercept / scale
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  // Convert to our format: calibrated = (raw + offset) * scale
  const scale = slope || 1.0;
  const offset = scale !== 0 ? intercept / scale : 0;

  // R-squared
  const meanY = sumY / n;
  const ssTot = sumYY - n * meanY * meanY;
  const ssRes = pairs.reduce((sum, { raw, expected }) => {
    const predicted = raw * slope + intercept;
    return sum + (expected - predicted) ** 2;
  }, 0);
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  return { offset, scale, r2 };
}

/**
 * Analyze score distribution for a provider to detect drift
 *
 * @param {number[]} scores - Array of scores from a single provider
 * @returns {{ mean: number, stddev: number, skew: number, histogram: Record<number, number> }}
 */
export function analyzeScoreDistribution(scores) {
  if (!scores.length) {
    return { mean: 0, stddev: 0, skew: 0, histogram: {} };
  }

  const n = scores.length;
  const mean = scores.reduce((a, b) => a + b, 0) / n;

  const variance = scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / n;
  const stddev = Math.sqrt(variance);

  // Skewness (Fisher's)
  const skew = stddev > 0
    ? scores.reduce((sum, s) => sum + ((s - mean) / stddev) ** 3, 0) / n
    : 0;

  // Histogram (integer buckets 0-10)
  const histogram = {};
  for (let i = 0; i <= 10; i++) histogram[i] = 0;
  for (const s of scores) {
    const bucket = Math.max(0, Math.min(10, Math.round(s)));
    histogram[bucket]++;
  }

  return { mean, stddev, skew, histogram };
}
