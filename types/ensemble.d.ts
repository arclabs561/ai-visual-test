import { OpaqueClass } from './shared.js';
import type { OpaqueFunction } from './shared.js';
import type { ValidationContext, ValidationResult } from '#public-contract';

export class EnsembleJudge extends OpaqueClass {}
export const applyBiasMitigation: OpaqueFunction;
export const createEnsembleJudge: OpaqueFunction;
export const detectBias: OpaqueFunction;
export const detectPositionBias: OpaqueFunction;
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
export const mitigateBias: OpaqueFunction;
export const mitigatePositionBias: OpaqueFunction;
export function shouldUseCounterBalance(context: ValidationContext): boolean;
export const validateMultipleWithPositionAnalysis: OpaqueFunction;
export const validateWithAllResearchEnhancements: OpaqueFunction;
export const validateWithExplicitRubric: OpaqueFunction;
export const validateWithLengthAlignment: OpaqueFunction;
export const validateWithResearchEnhancements: OpaqueFunction;
