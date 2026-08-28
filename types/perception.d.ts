import type { OpaqueFunction } from './shared.js';

export const MODE_SPEC: Readonly<Record<string, unknown>>;
export const UX_HEURISTICS: readonly unknown[];
export const aggregate: OpaqueFunction;
export const appendCritique: OpaqueFunction;
export const calibrateJudges: OpaqueFunction;
export const decayDispositions: OpaqueFunction;
export const formatReport: OpaqueFunction;
export const ledgerToDispositions: OpaqueFunction;
export const makeOpenRouterText: OpaqueFunction;
export const makeOpenRouterVision: OpaqueFunction;
export const makePanel: OpaqueFunction;
export const matchesDisposition: OpaqueFunction;
export const mergeFindings: OpaqueFunction;
export const parseJsonObject: OpaqueFunction;
export const readLedger: OpaqueFunction;
export const samplePerceptions: OpaqueFunction;
export const selectForReview: OpaqueFunction;
