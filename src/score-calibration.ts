/** Adjust raw VLM scores to reduce provider-specific bias. */

import { warn } from './logger.js';
import { ValidationError } from '#errors';

export interface CalibrationProfile {
  offset: number;
  scale: number;
}

export interface CalibrationPair {
  raw: number;
  expected: number;
}

export interface DerivedCalibrationProfile extends CalibrationProfile {
  r2: number;
}

export interface ScoreDistribution {
  mean: number;
  stddev: number;
  skew: number;
  histogram: Record<number, number>;
}

const DEFAULT_PROFILES: Readonly<Record<string, CalibrationProfile>> = {
  gemini: { offset: 0, scale: 1 },
  openai: { offset: 0, scale: 1 },
  claude: { offset: 0, scale: 1 },
  groq: { offset: 0, scale: 1 },
  openrouter: { offset: 0, scale: 1 },
};

let userProfiles: Record<string, CalibrationProfile> = {};

export function setCalibrationProfile(provider: string, profile: CalibrationProfile): void {
  if (typeof profile.offset !== 'number' || typeof profile.scale !== 'number') {
    throw new ValidationError('Calibration profile must have numeric offset and scale', {
      offset: typeof profile.offset,
      scale: typeof profile.scale,
    });
  }
  if (profile.scale <= 0) {
    throw new ValidationError('Calibration scale must be positive', { scale: profile.scale });
  }
  userProfiles[provider] = { ...profile };
}

export function getCalibrationProfile(provider: string): CalibrationProfile {
  return userProfiles[provider] ?? DEFAULT_PROFILES[provider] ?? { offset: 0, scale: 1 };
}

export function resetCalibrationProfiles(): void {
  userProfiles = {};
}

export function calibrateScore(score: number | null | undefined, provider: string): number | null {
  if (score === null || score === undefined) {
    return null;
  }

  const profile = getCalibrationProfile(provider);
  const calibrated = (score + profile.offset) * profile.scale;
  return Math.max(0, Math.min(10, Math.round(calibrated * 100) / 100));
}

export function deriveCalibrationProfile(pairs: CalibrationPair[]): DerivedCalibrationProfile {
  if (!Array.isArray(pairs) || pairs.length < 2) {
    throw new ValidationError('Need at least 2 (raw, expected) pairs to derive calibration', { count: pairs?.length ?? 0 });
  }

  const n = pairs.length;
  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumXY = 0;
  let sumYY = 0;

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
    return { offset: 0, scale: 1, r2: 0 };
  }

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  const scale = slope || 1;
  const offset = scale !== 0 ? intercept / scale : 0;
  const meanY = sumY / n;
  const ssTot = sumYY - n * meanY * meanY;
  const ssRes = pairs.reduce((sum, { raw, expected }) => {
    const predicted = raw * slope + intercept;
    return sum + (expected - predicted) ** 2;
  }, 0);
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  return { offset, scale, r2 };
}

export function analyzeScoreDistribution(scores: number[]): ScoreDistribution {
  if (!scores.length) {
    return { mean: 0, stddev: 0, skew: 0, histogram: {} };
  }

  const n = scores.length;
  const mean = scores.reduce((total, score) => total + score, 0) / n;
  const variance = scores.reduce((total, score) => total + (score - mean) ** 2, 0) / n;
  const stddev = Math.sqrt(variance);
  const skew = stddev > 0
    ? scores.reduce((total, score) => total + ((score - mean) / stddev) ** 3, 0) / n
    : 0;

  const histogram: Record<number, number> = {};
  for (let bucket = 0; bucket <= 10; bucket++) histogram[bucket] = 0;
  for (const score of scores) {
    const bucket = Math.max(0, Math.min(10, Math.round(score)));
    histogram[bucket] = (histogram[bucket] ?? 0) + 1;
  }

  return { mean, stddev, skew, histogram };
}
