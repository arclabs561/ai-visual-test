/**
 * Ensemble Sub-Module
 * 
 * Ensemble judging, bias detection, and counter-balancing.
 * 
 * Import from 'ai-visual-test/ensemble'
 */

// Ensemble judging
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

// Bias detection
export {
  detectBias,
  detectPositionBias
} from '../bias-detector.js';
export type {
  BiasDetection,
  BiasDetectionOptions,
  BiasSeverity,
  BiasType,
  DetectedBias,
  PositionBiasOptions,
  PositionBiasResult,
  PositionJudgment,
} from '../bias-detector.js';

// Bias mitigation
export {
  applyBiasMitigation,
  mitigateBias,
  mitigatePositionBias
} from '../bias-mitigation.js';
export type { BiasMitigationOptions } from '../bias-mitigation.js';

// Position counter-balance
export {
  evaluateWithCounterBalance,
  shouldUseCounterBalance
} from '#position-counterbalance';

// Research-enhanced validation
export {
  validateWithResearchEnhancements,
  validateMultipleWithPositionAnalysis,
  validateWithLengthAlignment,
  validateWithExplicitRubric,
  validateWithAllResearchEnhancements
} from '../research-enhanced-validation.js';
export type { PositionAnalysisResult, ResearchOptions } from '../research-enhanced-validation.js';
