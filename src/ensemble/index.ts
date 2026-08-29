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
} from '../bias-detector.mjs';

// Bias mitigation
export {
  applyBiasMitigation,
  mitigateBias,
  mitigatePositionBias
} from '../bias-mitigation.mjs';

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
} from '../research-enhanced-validation.mjs';
