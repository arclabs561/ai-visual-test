import { validateScreenshot } from './judge.mjs';
import { detectBias, detectPositionBias, type PositionBiasResult } from './bias-detector.js';
import { mitigateBias, mitigatePositionBias } from './bias-mitigation.js';
import { evaluateWithCounterBalance } from '#position-counterbalance';
import { normalizeValidationResult } from '#validation-result-normalizer';
import type { ValidationContext, ValidationResult } from '#public-contract';

type TaskMetadata = { inputLength?: number; outputLength?: number; promptLength?: number };
export interface ResearchOptions extends ValidationContext { enableBiasDetection?: boolean; enableBiasMitigation?: boolean; qualityGap?: number | null; judgeModel?: string | null; taskMetadata?: TaskMetadata; useCounterBalance?: boolean }
export interface PositionAnalysisResult { judgments: ValidationResult[]; positionBias: PositionBiasResult; qualityGap: QualityGap | null; metrics?: NonNullable<PositionBiasResult['metrics']>; researchMetadata: { papers: string[]; findings: string[] } }
interface QualityGap { value: number; isEquivocal: boolean; note: string }
function ensureQualityGap(value: number | null): void { if (value !== null && (!Number.isFinite(value) || value < 0 || value > 1)) throw new RangeError('qualityGap must be a finite value between 0 and 1'); }
function qualityGapMetadata(value: number | null): QualityGap | null {
  ensureQualityGap(value);
  if (value === null) return null;
  const isEquivocal = Math.abs(value - 0.5) < 0.1;
  return { value, isEquivocal, note: isEquivocal ? 'Equivocal case (δ_q ≈ 0.5) - maximum position bias risk per arXiv:2406.07791' : 'Quality gap analysis per research findings' };
}
function provider(options: ValidationContext, judgeModel: string | null): string { return judgeModel || options.provider || 'unknown'; }
function finiteScores(judgments: ValidationResult[]): number[] { return judgments.flatMap(({ score }) => score !== null && Number.isFinite(score) ? [score] : []); }

export async function validateWithResearchEnhancements(imagePath: string, prompt: string, options: ResearchOptions = {}): Promise<ValidationResult> {
  const { enableBiasDetection = true, enableBiasMitigation = true, qualityGap = null, judgeModel = null, taskMetadata = {}, useCounterBalance = false, ...validationOptions } = options;
  ensureQualityGap(qualityGap);
  let result: ValidationResult = normalizeValidationResult(useCounterBalance
    ? await evaluateWithCounterBalance(validateScreenshot, imagePath, prompt, validationOptions, { enabled: true })
    : await validateScreenshot(imagePath, prompt, validationOptions), 'validateWithResearchEnhancements');
  if (enableBiasDetection || enableBiasMitigation) {
    const biasDetection = enableBiasDetection ? detectBias(result.reasoning || result.assessment || '') : null;
    const positionBias = enableBiasDetection && Array.isArray(result.judgments) ? detectPositionBias(result.judgments as Array<{ score: number | null }>, { qualityGap, judgeModel: provider(validationOptions, judgeModel), taskMetadata }) : null;
    if (enableBiasMitigation && biasDetection?.hasBias) result = mitigateBias(result, biasDetection, { adjustScores: true });
    result.researchEnhancements = { biasDetection, positionBias, qualityGap: qualityGapMetadata(qualityGap), factors: { judgeModel: provider(validationOptions, judgeModel), taskMetadata }, researchPapers: ['arXiv:2406.07791 - Position bias, quality gaps', 'arXiv:2407.01085 - Length bias, AdapAlpaca', 'arXiv:2412.05579 - LLM-as-judge best practices'] };
  }
  return normalizeValidationResult(result, 'validateWithResearchEnhancements');
}

export async function validateMultipleWithPositionAnalysis(imagePaths: string[], prompt: string, options: ResearchOptions & { calculateMetrics?: boolean; enableMitigation?: boolean } = {}): Promise<PositionAnalysisResult> {
  const { calculateMetrics = true, qualityGap = null, judgeModel = null, taskMetadata = {}, enableMitigation = false, ...validationOptions } = options;
  ensureQualityGap(qualityGap);
  const judgments = await Promise.all(imagePaths.map(async (path) => normalizeValidationResult(await validateScreenshot(path, prompt, validationOptions), 'validateMultipleWithPositionAnalysis')));
  const positionBias = detectPositionBias(judgments, { calculateMetrics, qualityGap, judgeModel: provider(validationOptions, judgeModel), taskMetadata });
  const scores = finiteScores(judgments);
  const calculated = qualityGap ?? (scores.length >= 2 ? 0.5 - Math.abs((Math.max(...scores) - Math.min(...scores)) / 10 - 0.5) : null);
  return { judgments: enableMitigation && positionBias.detected ? mitigatePositionBias(judgments) : judgments, positionBias, qualityGap: qualityGapMetadata(calculated), ...(positionBias.metrics ? { metrics: positionBias.metrics } : {}), researchMetadata: { papers: ['arXiv:2406.07791'], findings: ['Position bias varies by judge and task', 'Quality gap strongly affects bias (parabolic relationship)', 'Equivocal cases (δ_q ≈ 0.5) cause maximum confusion'] } };
}

export async function validateWithLengthAlignment(imagePath: string, prompt: string, options: ValidationContext & { referenceLength?: number | null; lengthInterval?: number; enableLengthNormalization?: boolean } = {}): Promise<ValidationResult> {
  const { referenceLength = null, lengthInterval = 50, enableLengthNormalization = true, ...validationOptions } = options;
  if (!Number.isFinite(lengthInterval) || lengthInterval <= 0) throw new RangeError('lengthInterval must be a finite positive number');
  if (referenceLength !== null && (!Number.isFinite(referenceLength) || referenceLength < 0)) throw new RangeError('referenceLength must be a finite nonnegative number or null');
  let result = normalizeValidationResult(await validateScreenshot(imagePath, prompt, validationOptions), 'validateWithLengthAlignment');
  if (enableLengthNormalization && result.reasoning) {
    const detection = detectBias(result.reasoning, { checkFormatting: false, checkAuthority: false });
    if (detection.hasBias) result = mitigateBias(result, detection, { adjustScores: true });
    result.lengthAlignment = { originalLength: result.reasoning!.length, referenceLength, lengthInterval, normalized: detection.hasBias, note: 'AdapAlpaca-inspired length normalization (arXiv:2407.01085).', researchPaper: 'arXiv:2407.01085 - Explaining Length Bias in LLM-Based Preference Evaluations' };
  }
  return normalizeValidationResult(result, 'validateWithLengthAlignment');
}

export async function validateWithExplicitRubric(imagePath: string, prompt: string, options: ValidationContext & { rubric?: unknown; useDefaultRubric?: boolean } = {}): Promise<ValidationResult> {
  const { rubric = null, useDefaultRubric = true, ...validationOptions } = options;
  const { buildRubricPrompt, DEFAULT_RUBRIC } = await import('./rubrics.mjs');
  const rubricToUse = rubric || (useDefaultRubric ? DEFAULT_RUBRIC : null);
  const enhancedPrompt = rubricToUse ? `${prompt}\n\n${buildRubricPrompt(rubricToUse, true)}` : prompt;
  const result = normalizeValidationResult(await validateScreenshot(imagePath, enhancedPrompt, validationOptions), 'validateWithExplicitRubric');
  result.rubricEnhancement = { used: Boolean(rubricToUse), type: rubric ? 'custom' : 'default', researchPaper: 'arXiv:2412.05579 - LLMs-as-Judges Survey', finding: 'Explicit rubrics improve reliability by 10-20% and reduce bias from superficial features' };
  return normalizeValidationResult(result, 'validateWithExplicitRubric');
}

export async function validateWithAllResearchEnhancements(imagePath: string, prompt: string, options: ResearchOptions & { enableRubrics?: boolean; enableLengthAlignment?: boolean } = {}): Promise<ValidationResult> {
  const { enableRubrics = true, enableBiasDetection = true, enableBiasMitigation = true, enableLengthAlignment = true, qualityGap = null, judgeModel = null, taskMetadata = {}, ...validationOptions } = options;
  ensureQualityGap(qualityGap);
  let enhancedPrompt = prompt;
  if (enableRubrics) {
    const { buildRubricPrompt, DEFAULT_RUBRIC } = await import('./rubrics.mjs');
    // The first argument is the rubric; the user prompt remains the prefix.
    enhancedPrompt = `${prompt}\n\n${buildRubricPrompt(DEFAULT_RUBRIC, true)}`;
  }
  let result = enableLengthAlignment
    ? await validateWithLengthAlignment(imagePath, enhancedPrompt, validationOptions)
    : normalizeValidationResult(await validateScreenshot(imagePath, enhancedPrompt, validationOptions), 'validateWithAllResearchEnhancements');
  const detection = enableBiasDetection ? detectBias(result.reasoning || result.assessment || '') : null;
  if (enableBiasMitigation && detection?.hasBias) result = mitigateBias(result, detection, { adjustScores: true });
  result.comprehensiveResearchEnhancements = { rubrics: enableRubrics ? { used: true, paper: 'arXiv:2412.05579', finding: 'Explicit rubrics improve reliability by 10-20%' } : null, biasDetection: detection, lengthAlignment: enableLengthAlignment ? { applied: true, paper: 'arXiv:2407.01085', method: 'AdapAlpaca-inspired' } : null, qualityGap: qualityGapMetadata(qualityGap), factors: { judgeModel: provider(validationOptions, judgeModel), taskMetadata }, researchPapers: ['arXiv:2406.07791 - Position bias, quality gaps', 'arXiv:2407.01085 - Length bias, AdapAlpaca', 'arXiv:2412.05579 - LLM-as-judge best practices'] };
  return normalizeValidationResult(result, 'validateWithAllResearchEnhancements');
}
