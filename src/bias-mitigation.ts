import { detectBias, detectPositionBias, type BiasDetection } from './bias-detector.js';
import type { ValidationResult } from '#public-contract';

export interface BiasMitigationOptions { adjustScores?: boolean; adjustIssues?: boolean; minAdjustment?: number; maxAdjustment?: number; randomizeOrder?: boolean; enabled?: boolean }
type MitigatedResult = ValidationResult & { originalScore?: number | null; biasMitigation: Record<string, unknown> };
function finiteScore(score: number | null): void { if (score !== null && !Number.isFinite(score)) throw new RangeError('score must be finite or null'); }
function adjustmentFor(type: string, score: number): number { return type === 'verbosity' ? -0.5 * score : type === 'length' ? -0.3 * score : type === 'formatting' ? -0.2 * score : type === 'authority' ? -0.4 * score : 0; }
export function mitigateBias(result: ValidationResult, biasDetection: BiasDetection | null | undefined, options: BiasMitigationOptions = {}): MitigatedResult {
  const { adjustScores = true, adjustIssues = false, minAdjustment = -2, maxAdjustment = 2 } = options;
  void adjustIssues; // Preserved public option; issue text is intentionally never rewritten heuristically.
  finiteScore(result.score);
  if (!Number.isFinite(minAdjustment) || !Number.isFinite(maxAdjustment) || minAdjustment > maxAdjustment) throw new RangeError('adjustment bounds must be finite and minAdjustment must not exceed maxAdjustment');
  if (!biasDetection?.hasBias) return { ...result, biasMitigation: { applied: false, reason: 'No bias detected' } };
  const adjustments = biasDetection.biases.map((bias) => ({ type: bias.type, adjustment: adjustmentFor(bias.type, bias.score).toFixed(2), reason: `Reduced score due to ${bias.type} bias` }));
  const rawAdjustment = biasDetection.biases.reduce((sum, bias) => sum + adjustmentFor(bias.type, bias.score), 0);
  const totalAdjustment = Math.max(minAdjustment, Math.min(maxAdjustment, rawAdjustment));
  const score = adjustScores && result.score !== null ? Math.max(0, Math.min(10, result.score + totalAdjustment)) : result.score;
  return { ...result, score, originalScore: result.score, biasMitigation: { applied: true, adjustments, totalAdjustment: score !== null && result.score !== null ? (score - result.score).toFixed(2) : '0.00', detectedBiases: biasDetection.biases.map((bias) => bias.type), severity: biasDetection.severity } };
}
export function mitigatePositionBias(judgments: ValidationResult[], options: BiasMitigationOptions = {}): MitigatedResult[] {
  const { randomizeOrder = true, adjustScores = true } = options;
  void randomizeOrder; // This post-hoc API cannot randomize an already evaluated sequence; retained for compatibility.
  const bias = detectPositionBias(judgments);
  if (!bias.detected) return judgments.map((judgment) => ({ ...judgment, biasMitigation: { applied: false, reason: 'No position bias detected' } }));
  return judgments.map((judgment, index) => {
    finiteScore(judgment.score);
    if (!adjustScores || judgment.score === null) return { ...judgment, biasMitigation: { applied: false, reason: 'No adjustment needed' } };
    const adjustment = (bias.firstBias && index === 0) || (bias.lastBias && index === judgments.length - 1) ? -1 : 0;
    return { ...judgment, score: Math.max(0, Math.min(10, judgment.score + adjustment)), originalScore: judgment.score, biasMitigation: { applied: true, type: 'position', adjustment: adjustment.toFixed(2), reason: adjustment ? 'Reduced position bias' : 'No adjustment needed' } };
  });
}
export function applyBiasMitigation(result: ValidationResult, reasoning?: string, options: BiasMitigationOptions = {}): MitigatedResult {
  return mitigateBias(result, detectBias(reasoning || result.reasoning || ''), options);
}
