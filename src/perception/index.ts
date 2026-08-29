/** Public perception API. */
export { MODE_SPEC, UX_HEURISTICS } from './prompts.js';
export { parseJsonObject, makeOpenRouterVision, makeOpenRouterText, makePanel } from './openrouter.js';
export { aggregate, mergeFindings, matchesDisposition } from './aggregate.js';
export { samplePerceptions } from './sample.js';
export { selectForReview, calibrateJudges, decayDispositions } from './learn.js';
export { formatReport } from './report.js';
export { appendCritique, readLedger, ledgerToDispositions } from './critiques.js';

export type {
  PerceptionDiagnosticCode,
  PerceptionFinding,
  PerceptionMode,
  PerceptionStructuredOutput,
  VerifierVerdict,
} from './contracts.js';
export type { AggregateFinding, Disposition, PerceptionSample as AggregateSample } from './aggregate.js';
export type {
  PerceptionAggregate,
  PerceptionDisposition,
  PerceptionReviewCandidate,
  PerceptionSection as LearningPerceptionSection,
} from './learn.js';
export type {
  PanelJudge,
  PerceptionContext,
  PerceptionDiagnostics,
  PerceptionFailure,
  PerceptionPersona,
  PerceptionSample,
  PerceptionSection,
  RankedPerceptionFinding,
  SamplePerceptionsOptions,
  SamplePerceptionsResult,
  VisionCompletion,
} from './sample.js';
export type {
  OpenRouterPanelMember,
  OpenRouterPanelOptions,
  OpenRouterStructuredTask,
  OpenRouterTextCompletion,
  OpenRouterTextOptions,
  OpenRouterVisionCompletion,
  OpenRouterVisionOptions,
} from './openrouter.js';
export type { AppendCritiqueInput, CritiqueDisposition, WrittenCritique } from './critiques.js';
