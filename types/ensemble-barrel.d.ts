/**
 * Public ensemble barrel composition.
 *
 * The judge contract is generated from TypeScript.  The remaining helpers are
 * unchanged JavaScript modules, so this small overlay keeps their established
 * public names and safe callable boundaries without pulling their legacy
 * implementation declarations into consumer type checking.
 */
import type { ValidationContext, ValidationResult } from '#public-contract';

export {
  EnsembleJudge,
  createEnsembleJudge,
} from '#ensemble-judge';
export type {
  Agreement,
  Availability,
  Disagreement,
  EnsembleJudgeOptions,
  EnsembleResult,
  IndividualJudgment,
  JudgeLike,
  JudgeResponse,
  VotingMethod,
} from '#ensemble-judge';

export interface BiasDetection {
  hasBias: boolean;
  biases: Array<{ type: 'verbosity' | 'length' | 'formatting' | 'authority'; score: number; [key: string]: unknown }>;
  severity: 'none' | 'low' | 'medium' | 'high';
  recommendations: string[];
}
export interface BiasMitigationOptions {
  adjustScores?: boolean;
  adjustIssues?: boolean;
  minAdjustment?: number;
  maxAdjustment?: number;
}
export interface PositionBiasResult {
  detected: boolean;
  firstBias?: boolean;
  lastBias?: boolean;
  reason?: string;
  evidence?: { firstScore: number; lastScore: number; avgMiddle: number; allScores: number[] };
  metrics?: { positionConsistency: number; preferenceFairness: Record<string, unknown> };
  [key: string]: unknown;
}
export function detectBias(
  judgment: string | Record<string, unknown>,
  options?: { checkVerbosity?: boolean; checkLength?: boolean; checkFormatting?: boolean; checkPosition?: boolean; checkAuthority?: boolean },
): BiasDetection;
export function detectPositionBias(
  results: Array<{ score: number | null }>,
  options?: Record<string, unknown>,
): PositionBiasResult;
export function applyBiasMitigation(
  result: ValidationResult,
  reasoning: string,
  options?: BiasMitigationOptions,
): ValidationResult;
export function mitigateBias(
  result: ValidationResult,
  biasDetection: BiasDetection,
  options?: BiasMitigationOptions,
): ValidationResult;
export function mitigatePositionBias(
  judgments: ValidationResult[],
  options?: { randomizeOrder?: boolean; adjustScores?: boolean; enabled?: boolean },
): ValidationResult[];
export function evaluateWithCounterBalance(
  evaluateFn: (imagePath: string, prompt: string, context: ValidationContext) => Promise<ValidationResult>,
  imagePath: string,
  prompt: string,
  context?: ValidationContext,
  options?: {
    enabled?: boolean;
    baselinePath?: string | null;
    contextOrder?: 'original' | 'reversed';
  },
): Promise<ValidationResult>;
export function shouldUseCounterBalance(context: ValidationContext): boolean;
export function validateWithResearchEnhancements(
  imagePath: string,
  prompt: string,
  context?: ValidationContext,
): Promise<ValidationResult>;
export interface PositionAnalysisResult {
  judgments: ValidationResult[];
  positionBias: PositionBiasResult;
  qualityGap: { value: number; isEquivocal: boolean; note: string } | null;
  metrics?: { positionConsistency: number; preferenceFairness: Record<string, unknown> };
  researchMetadata: { papers: string[]; findings: string[] };
}
export function validateMultipleWithPositionAnalysis(
  imagePaths: string[],
  prompt: string,
  options?: ValidationContext & {
    calculateMetrics?: boolean;
    qualityGap?: number | null;
    judgeModel?: string | null;
    taskMetadata?: { inputLength?: number; outputLength?: number; promptLength?: number };
    enableMitigation?: boolean;
  },
): Promise<PositionAnalysisResult>;
export function validateWithLengthAlignment(
  imagePath: string,
  prompt: string,
  context?: ValidationContext,
): Promise<ValidationResult>;
export function validateWithExplicitRubric(
  imagePath: string,
  prompt: string,
  context?: ValidationContext,
): Promise<ValidationResult>;
export function validateWithAllResearchEnhancements(
  imagePath: string,
  prompt: string,
  context?: ValidationContext,
): Promise<ValidationResult>;
