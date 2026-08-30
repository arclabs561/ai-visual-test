/** Internal, review-only orchestration for one reversible visual improvement. */

import { createHash } from 'node:crypto';
import {
  createReplayIdentity,
  createReplayVariant,
  type ReplayIdentity,
  type ReplayVariant,
  type ReplayVariantInput,
} from './improvement-replay.js';

export type ImprovementMetadataValue = string | number | boolean | null;
export type ImprovementMetadata = Readonly<Record<string, ImprovementMetadataValue>>;
export type JsonEvidence = null | boolean | number | string | JsonEvidenceArray | JsonEvidenceObject;
export interface JsonEvidenceArray extends ReadonlyArray<JsonEvidence> {}
export interface JsonEvidenceObject {
  readonly [key: string]: JsonEvidence;
}

/**
 * A caller-owned immutable artifact. The transaction only fingerprints this
 * descriptor; it never resolves, reads, or sends the referenced bytes.
 */
export interface ImprovementArtifactReference {
  readonly kind: 'sha256-artifact';
  readonly sha256: string;
  readonly byteLength: number;
  readonly mediaType: string;
}

export interface ImprovementObjective {
  readonly id: string;
  readonly description: string;
  readonly metadata?: ImprovementMetadata;
}

export interface ImprovementObservation<Payload> {
  /** Ignored by the runner: it derives the receipt identity from frozen payload. */
  readonly digest?: string;
  readonly metadata?: ImprovementMetadata;
  /** Captured evidence is snapshotted to bounded JSON before evaluation. */
  readonly payload: Payload;
}

export interface ImprovementCandidate<Payload> {
  readonly id: string;
  readonly metadata?: ImprovementMetadata;
  /** Opaque mutation input. Never copied into a receipt. */
  readonly payload: Payload;
}

export interface ImprovementGateResult {
  readonly id: string;
  readonly passed: boolean;
  readonly metadata?: ImprovementMetadata;
}

export type ImprovementOrderOutcome = 'candidate' | 'baseline' | 'tie';

export interface ImprovementAdapter<CandidatePayload, Handle> {
  /** Must not mutate; binds opaque candidate bytes to a sealed apply handle. */
  prepare(candidate: ImprovementCandidate<CandidatePayload>): Promise<PreparedImprovement<Handle>>;
  /** May mutate using only the sealed handle; caller payload never crosses this boundary. */
  apply(handle: Handle): Promise<void>;
  verify(handle: Handle): Promise<readonly ImprovementGateResult[]>;
  rollback(handle: Handle): Promise<void>;
}

export interface PreparedImprovement<Handle> {
  readonly handle: Handle;
  readonly candidateSha256: string;
}

/** Independent observation boundary; it has no mutation capability. */
export interface ImprovementObserver<ObservationPayload> {
  capture(phase: 'baseline' | 'candidate' | 'rollback'): Promise<ImprovementObservation<ObservationPayload>>;
}

export type ImprovementBlindEvidence<Payload> = Readonly<{
  readonly payload: Payload;
}>;

export type ImprovementBlindOutcome = 'first' | 'second' | 'tie';

export interface ImprovementEvaluator<ObservationPayload> {
  compare(input: {
    readonly objective: ImprovementObjective;
    /** The runner deliberately withholds baseline/candidate identity. */
    readonly a: ImprovementBlindEvidence<ObservationPayload>;
    readonly b: ImprovementBlindEvidence<ObservationPayload>;
  }): Promise<Readonly<{
    winner: ImprovementBlindOutcome;
    execution: ImprovementEvaluationExecution;
  }>>;
}

/** Storage-safe receipt from one actual evaluator invocation. */
export interface ImprovementEvaluationExecution {
  readonly id: string;
  readonly metadata?: ImprovementMetadata;
}

/**
 * Consumer-owned evidence transformation. It receives only frozen blind
 * payloads and has no mutation or egress authority in this kernel.
 */
export interface ImprovementEvidenceProjector<ObservationPayload, EvaluationPayload> {
  readonly id: string;
  readonly configSha256: string;
  project(observation: ImprovementBlindEvidence<ObservationPayload>): Promise<EvaluationPayload>;
}

export interface ImprovementEvaluation {
  readonly id: string;
  readonly configSha256: string;
  readonly variant: ReplayVariantInput;
}

type ReceiptObservation = Readonly<{ digest: string; metadata?: ImprovementMetadata }>;
type ReceiptCandidate = Readonly<{ id: string; digest: string; metadata?: ImprovementMetadata }>;
type ReceiptObjective = Readonly<{ id: string; digest: string; metadata?: ImprovementMetadata }>;
type ReceiptComparison = Readonly<{
  original: ImprovementOrderOutcome;
  reversed: ImprovementOrderOutcome;
  winner: ImprovementOrderOutcome | 'conflict';
  originalExecution: ImprovementEvaluationExecution;
  reversedExecution: ImprovementEvaluationExecution;
}>;
type ReceiptProjector = Readonly<{ id: string; configSha256: string }>;
type ReceiptEvaluation = Readonly<{
  id: string;
  configSha256: string;
  responseKind: 'pairwise';
  variant: ReplayVariant;
  projector: ReceiptProjector;
  /** Present only when both observations existed and a replay binding was created. */
  replay?: ReplayIdentity;
}>;
type ReceiptRollback = Readonly<{ status: 'observed-restored'; digest: string }>;

interface ReceiptBase {
  readonly objective: ReceiptObjective;
  readonly baseline: ReceiptObservation;
  readonly candidate: ReceiptCandidate;
  readonly evaluation: ReceiptEvaluation;
  readonly gates: readonly ImprovementGateResult[];
  readonly rollback: ReceiptRollback;
}
type ReceiptBeforeRollback = Omit<ReceiptBase, 'rollback'>;
type ReceiptDecision =
  | { readonly status: 'rejected'; readonly reason: 'constraint-failed' }
  | {
    readonly status: 'rejected';
    readonly reason: 'no-observable-change';
    readonly candidateObservation: ReceiptObservation;
  }
  | {
    readonly status: 'rejected';
    readonly reason: 'baseline-preferred' | 'tie';
    readonly candidateObservation: ReceiptObservation;
    readonly comparison: ReceiptComparison;
  }
  | {
    readonly status: 'indeterminate';
    readonly reason: 'comparison-conflict';
    readonly candidateObservation: ReceiptObservation;
    readonly comparison: ReceiptComparison;
  }
  | {
    readonly status: 'review-required';
    readonly reason: 'candidate-preferred';
    readonly candidateObservation: ReceiptObservation;
    readonly comparison: ReceiptComparison;
  };
export type ImprovementReceipt = Readonly<ReceiptBase & ReceiptDecision>;

export type ImprovementTransactionPhase =
  | 'validate-input'
  | 'capture-baseline'
  | 'prepare'
  | 'apply'
  | 'verify'
  | 'capture-candidate'
  | 'project-evidence'
  | 'evaluate'
  | 'rollback';
type NonRollbackPhase = Exclude<ImprovementTransactionPhase, 'rollback'>;
type TransactionFailure = Readonly<{ phase: NonRollbackPhase; cause: unknown }>;

export class ImprovementTransactionError extends Error {
  readonly phase: ImprovementTransactionPhase;
  readonly failedPhase?: NonRollbackPhase;
  readonly failedCause?: unknown;

  constructor(phase: ImprovementTransactionPhase, cause: unknown, priorFailure?: TransactionFailure) {
    super(`Visual improvement transaction failed during ${phase}`, { cause });
    this.name = 'ImprovementTransactionError';
    this.phase = phase;
    if (priorFailure !== undefined) {
      this.failedPhase = priorFailure.phase;
      this.failedCause = priorFailure.cause;
    }
  }
}

const SHA256_DIGEST = /^[a-f0-9]{64}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const METADATA_KEY = /^[A-Za-z][A-Za-z0-9._-]{0,63}$/;
const MAX_METADATA_ENTRIES = 32;
const MAX_METADATA_STRING_LENGTH = 1_024;
const MAX_GATES = 64;
const MAX_EVIDENCE_DEPTH = 16;
const MAX_EVIDENCE_NODES = 10_000;
const MAX_EVIDENCE_STRING_LENGTH = 1_000_000;
const MAX_EVIDENCE_KEY_LENGTH = 256;
const MAX_OBJECTIVE_DESCRIPTION_LENGTH = 16_384;

function invalidInput(message: string): ImprovementTransactionError {
  return new ImprovementTransactionError('validate-input', new Error(message));
}
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function parseMetadata(value: unknown, label: string): ImprovementMetadata | undefined {
  if (value === undefined) return undefined;
  if (!isPlainObject(value)) throw invalidInput(`${label} metadata must be a plain object`);
  const entries = Object.entries(value);
  if (entries.length > MAX_METADATA_ENTRIES) throw invalidInput(`${label} metadata has too many entries`);
  const copy: Record<string, ImprovementMetadataValue> = {};
  for (const [key, item] of entries) {
    if (!METADATA_KEY.test(key)) throw invalidInput(`${label} metadata key is invalid`);
    if (typeof item === 'string') {
      if (item.length > MAX_METADATA_STRING_LENGTH) throw invalidInput(`${label} metadata string is too long`);
      copy[key] = item;
    } else if (typeof item === 'number') {
      if (!Number.isFinite(item)) throw invalidInput(`${label} metadata number must be finite`);
      copy[key] = item;
    } else if (typeof item === 'boolean' || item === null) {
      copy[key] = item;
    } else {
      throw invalidInput(`${label} metadata values must be scalar`);
    }
  }
  return Object.freeze(copy);
}
function parseId(value: unknown, label: string): string {
  if (typeof value !== 'string' || !ID.test(value)) throw invalidInput(`${label} id is invalid`);
  return value;
}
function parseDigest(value: unknown, label: string): string {
  if (typeof value !== 'string' || !SHA256_DIGEST.test(value)) {
    throw invalidInput(`${label} digest must be a lowercase 64-character SHA-256 hex string`);
  }
  return value;
}
function parseObjective(value: ImprovementObjective): ImprovementObjective & Readonly<{ digest: string }> {
  const id = parseId(value.id, 'objective');
  if (typeof value.description !== 'string' || value.description.length > MAX_OBJECTIVE_DESCRIPTION_LENGTH) {
    throw invalidInput('objective description must be a bounded string');
  }
  const metadata = parseMetadata(value.metadata, 'objective');
  const canonical = metadata === undefined ? { id, description: value.description } : { id, description: value.description, metadata };
  const digest = evidenceDigest(snapshotEvidence(canonical));
  const suppliedDigest = (value as { digest?: unknown }).digest;
  if (suppliedDigest !== undefined && parseDigest(suppliedDigest, 'objective') !== digest) {
    throw invalidInput('objective digest does not match canonical objective');
  }
  return (metadata === undefined
    ? Object.freeze({ id, digest, description: value.description })
    : Object.freeze({ id, digest, description: value.description, metadata })) as ImprovementObjective & Readonly<{ digest: string }>;
}
function parseCandidate<Payload>(value: ImprovementCandidate<Payload>): ImprovementCandidate<Payload> {
  const id = parseId(value.id, 'candidate');
  const metadata = parseMetadata(value.metadata, 'candidate');
  return metadata === undefined
    ? Object.freeze({ id, payload: value.payload })
    : Object.freeze({ id, metadata, payload: value.payload });
}
function parsePrepared<Handle>(value: PreparedImprovement<Handle>): Readonly<{ handle: Handle; candidateSha256: string }> {
  if (value === null || typeof value !== 'object' || !Object.hasOwn(value, 'handle')) {
    throw new Error('adapter prepare result must include a handle');
  }
  return Object.freeze({ handle: value.handle, candidateSha256: parseDigest(value.candidateSha256, 'prepared candidate') });
}
function snapshotEvidence(value: unknown): JsonEvidence {
  const state = { nodes: 0, ancestors: new Set<object>() };
  return snapshotEvidenceValue(value, state, 0);
}
function canonicalEvidence(value: JsonEvidence): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalEvidence).join(',')}]`;
  const record = value as JsonEvidenceObject;
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonicalEvidence(record[key]!)}`).join(',')}}`;
}
function evidenceDigest(payload: JsonEvidence): string {
  return createHash('sha256').update(canonicalEvidence(payload)).digest('hex');
}
function snapshotEvidenceValue(
  value: unknown,
  state: { nodes: number; ancestors: Set<object> },
  depth: number,
): JsonEvidence {
  state.nodes += 1;
  if (state.nodes > MAX_EVIDENCE_NODES) throw invalidInput('observation payload has too many nodes');
  if (depth > MAX_EVIDENCE_DEPTH) throw invalidInput('observation payload is too deeply nested');
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw invalidInput('observation payload number must be finite');
    return value;
  }
  if (typeof value === 'string') {
    if (value.length > MAX_EVIDENCE_STRING_LENGTH) throw invalidInput('observation payload string is too long');
    return value;
  }
  if (typeof value !== 'object' || state.ancestors.has(value)) {
    throw invalidInput('observation payload must be acyclic JSON evidence');
  }
  state.ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return Object.freeze(value.map(item => snapshotEvidenceValue(item, state, depth + 1)));
    }
    if (!isPlainObject(value)) throw invalidInput('observation payload must contain only plain objects');
    const copy: Record<string, JsonEvidence> = Object.create(null) as Record<string, JsonEvidence>;
    for (const [key, item] of Object.entries(value)) {
      if (key.length > MAX_EVIDENCE_KEY_LENGTH) throw invalidInput('observation payload key is too long');
      Object.defineProperty(copy, key, {
        value: snapshotEvidenceValue(item, state, depth + 1), enumerable: true, writable: false, configurable: false,
      });
    }
    return Object.freeze(copy);
  } finally {
    state.ancestors.delete(value);
  }
}
function parseObservation<Payload>(
  value: ImprovementObservation<Payload>,
  label: 'baseline observation' | 'candidate observation' | 'rollback observation',
): ImprovementObservation<JsonEvidence> & Readonly<{ digest: string }> {
  const metadata = parseMetadata(value.metadata, label);
  const payload = snapshotEvidence(value.payload);
  const digest = evidenceDigest(payload);
  return (metadata === undefined
    ? Object.freeze({ digest, payload })
    : Object.freeze({ digest, metadata, payload })) as ImprovementObservation<JsonEvidence> & Readonly<{ digest: string }>;
}
function blindEvidence(observation: ImprovementObservation<JsonEvidence>): ImprovementBlindEvidence<JsonEvidence> {
  return Object.freeze({ payload: observation.payload });
}
function parseGates(value: unknown): readonly ImprovementGateResult[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_GATES) {
    throw invalidInput('deterministic gates must be a non-empty bounded array');
  }
  return Object.freeze(value.map((gate, index) => {
    if (!isPlainObject(gate)) throw invalidInput(`gate ${index} must be a plain object`);
    const id = parseId(gate.id, `gate ${index}`);
    if (typeof gate.passed !== 'boolean') throw invalidInput(`gate ${index} passed must be boolean`);
    const metadata = parseMetadata(gate.metadata, `gate ${index}`);
    return metadata === undefined
      ? Object.freeze({ id, passed: gate.passed })
      : Object.freeze({ id, passed: gate.passed, metadata });
  }));
}
function parseExecution(value: unknown): ImprovementEvaluationExecution {
  if (!isPlainObject(value)) throw new Error('blinded comparison execution must be an object');
  const id = parseId(value.id, 'comparison execution');
  const metadata = parseMetadata(value.metadata, 'comparison execution');
  return metadata === undefined ? Object.freeze({ id }) : Object.freeze({ id, metadata });
}
function parseBlindComparison(value: unknown): Readonly<{ winner: ImprovementBlindOutcome; execution: ImprovementEvaluationExecution }> {
  if (!isPlainObject(value) || (value.winner !== 'first' && value.winner !== 'second' && value.winner !== 'tie')) {
    throw new Error('blinded comparison requires a first, second, or tie winner');
  }
  return Object.freeze({ winner: value.winner, execution: parseExecution(value.execution) });
}
function canonicalOutcome(
  outcome: ImprovementBlindOutcome,
  first: 'baseline' | 'candidate',
): ImprovementOrderOutcome {
  if (outcome === 'tie') return 'tie';
  return outcome === 'first' ? first : first === 'baseline' ? 'candidate' : 'baseline';
}
function comparisonFromBlindResults(
  original: Readonly<{ winner: ImprovementBlindOutcome; execution: ImprovementEvaluationExecution }>,
  reversed: Readonly<{ winner: ImprovementBlindOutcome; execution: ImprovementEvaluationExecution }>,
): ReceiptComparison {
  const originalOutcome = canonicalOutcome(original.winner, 'baseline');
  const reversedOutcome = canonicalOutcome(reversed.winner, 'candidate');
  const winner = originalOutcome === reversedOutcome ? originalOutcome : 'conflict';
  const result: {
    original: ImprovementOrderOutcome;
    reversed: ImprovementOrderOutcome;
    winner: ImprovementOrderOutcome | 'conflict';
    originalExecution: ImprovementEvaluationExecution;
    reversedExecution: ImprovementEvaluationExecution;
  } = {
    original: originalOutcome,
    reversed: reversedOutcome,
    winner,
    originalExecution: original.execution,
    reversedExecution: reversed.execution,
  };
  return Object.freeze(result);
}
function receiptObservation<Payload>(observation: ImprovementObservation<Payload>): ReceiptObservation {
  return observation.metadata === undefined
    ? Object.freeze({ digest: observation.digest! })
    : Object.freeze({ digest: observation.digest!, metadata: observation.metadata });
}
function receiptCandidate<Payload>(candidate: ImprovementCandidate<Payload>, digest: string): ReceiptCandidate {
  return candidate.metadata === undefined
    ? Object.freeze({ id: candidate.id, digest })
    : Object.freeze({ id: candidate.id, digest, metadata: candidate.metadata });
}
function receiptObjective(objective: ImprovementObjective & Readonly<{ digest: string }>): ReceiptObjective {
  return objective.metadata === undefined
    ? Object.freeze({ id: objective.id, digest: objective.digest })
    : Object.freeze({ id: objective.id, digest: objective.digest, metadata: objective.metadata });
}
function parseEvaluation(value: ImprovementEvaluation): Readonly<{
  id: string;
  configSha256: string;
  responseKind: 'pairwise';
  variant: ReplayVariant;
}> {
  try {
    const id = parseId(value.id, 'evaluation');
    const configSha256 = parseDigest(value.configSha256, 'evaluation config');
    const claimedResponseKind = (value as { responseKind?: unknown }).responseKind;
    if (claimedResponseKind !== undefined && claimedResponseKind !== 'pairwise') {
      throw new Error('this transaction supports only pairwise responses');
    }
    const variant = createReplayVariant(value.variant);
    return Object.freeze({ id, configSha256, responseKind: 'pairwise' as const, variant });
  } catch {
    throw invalidInput('evaluation identity is invalid');
  }
}
function parseProjector<ObservationPayload, EvaluationPayload>(
  value: ImprovementEvidenceProjector<ObservationPayload, EvaluationPayload>,
): ReceiptProjector {
  if (value === null || typeof value !== 'object' || typeof value.project !== 'function') {
    throw invalidInput('evidence projector is invalid');
  }
  return Object.freeze({
    id: parseId(value.id, 'evidence projector'),
    configSha256: parseDigest(value.configSha256, 'evidence projector config'),
  });
}
function receiptEvaluationConfig(
  evaluation: Readonly<{ id: string; configSha256: string; responseKind: 'pairwise'; variant: ReplayVariant }>,
  projector: ReceiptProjector,
): ReceiptEvaluation {
  return Object.freeze({ ...evaluation, projector });
}
function receiptEvaluation(
  evaluation: Readonly<{ id: string; configSha256: string; responseKind: 'pairwise'; variant: ReplayVariant }>,
  projector: ReceiptProjector,
  objective: ImprovementObjective & Readonly<{ digest: string }>,
  candidateSha256: string,
  baseline: ImprovementObservation<JsonEvidence>,
  candidateObservation: ImprovementObservation<JsonEvidence>,
  projectedBaselineSha256: string,
  projectedCandidateSha256: string,
): ReceiptEvaluation {
  const variant: ReplayVariantInput = evaluation.variant.kind === 'graph'
    ? { kind: 'graph', promptVersion: evaluation.variant.promptVersion, promptSha256: evaluation.variant.promptSha256, evidenceSha256: evaluation.variant.evidenceSha256, graphSha256: evaluation.variant.graphSha256 }
    : evaluation.variant.kind === 'evidence'
      ? { kind: 'evidence', promptVersion: evaluation.variant.promptVersion, promptSha256: evaluation.variant.promptSha256, evidenceSha256: evaluation.variant.evidenceSha256 }
      : { kind: evaluation.variant.kind, promptVersion: evaluation.variant.promptVersion, promptSha256: evaluation.variant.promptSha256 };
  const replay = createReplayIdentity({
    binding: {
      objectiveSha256: objective.digest,
      candidateSha256,
      baselineObservationSha256: baseline.digest,
      candidateObservationSha256: candidateObservation.digest,
      evaluatorId: evaluation.id,
      evaluatorConfigSha256: evaluation.configSha256,
      projectionId: projector.id,
      projectionConfigSha256: projector.configSha256,
      projectedBaselineSha256,
      projectedCandidateSha256,
      responseKind: evaluation.responseKind,
    },
    variant,
  });
  return Object.freeze({ ...evaluation, projector, replay });
}
function receiptBase<ObservationPayload, CandidatePayload>(
  objective: ImprovementObjective & Readonly<{ digest: string }>,
  baseline: ImprovementObservation<ObservationPayload>,
  evaluation: ReceiptEvaluation,
  gates: readonly ImprovementGateResult[],
  candidate: ImprovementCandidate<CandidatePayload>,
  candidateSha256: string,
): ReceiptBeforeRollback {
  return Object.freeze({
    objective: receiptObjective(objective),
    baseline: receiptObservation(baseline),
    candidate: receiptCandidate(candidate, candidateSha256),
    evaluation,
    gates,
  });
}
function asTransactionError(phase: NonRollbackPhase, cause: unknown): ImprovementTransactionError {
  return cause instanceof ImprovementTransactionError ? cause : new ImprovementTransactionError(phase, cause);
}
function failureFrom(cause: unknown): TransactionFailure {
  if (cause instanceof ImprovementTransactionError && cause.phase !== 'rollback') {
    return Object.freeze({ phase: cause.phase, cause: cause.cause });
  }
  return Object.freeze({ phase: 'evaluate', cause });
}
async function verifyRollback<ObservationPayload, CandidatePayload, Handle>(
  adapter: ImprovementAdapter<CandidatePayload, Handle>,
  observer: ImprovementObserver<ObservationPayload>,
  handle: Handle,
  baselineDigest: string,
  priorFailure: TransactionFailure | undefined,
): Promise<string> {
  try {
    await adapter.rollback(handle);
    const restored = parseObservation(await observer.capture('rollback'), 'rollback observation');
    if (restored.digest !== baselineDigest) throw new Error('rollback capture digest does not match baseline');
    return restored.digest;
  } catch (cause) {
    throw new ImprovementTransactionError('rollback', cause, priorFailure);
  }
}

/** Runs one review-only transaction. It never commits a downstream mutation. */
export async function runImprovementReview<ObservationPayload, CandidatePayload, Handle>(input: {
  readonly objective: ImprovementObjective;
  readonly candidate: ImprovementCandidate<CandidatePayload>;
  readonly adapter: ImprovementAdapter<CandidatePayload, Handle>;
  readonly observer: ImprovementObserver<ObservationPayload>;
  readonly projector: ImprovementEvidenceProjector<JsonEvidence, unknown>;
  readonly evaluator: ImprovementEvaluator<JsonEvidence>;
  readonly evaluation: ImprovementEvaluation;
}): Promise<ImprovementReceipt> {
  const objective = parseObjective(input.objective);
  const candidateInput = parseCandidate(input.candidate);
  const evaluation = parseEvaluation(input.evaluation);
  const projector = parseProjector(input.projector);
  let baseline: ImprovementObservation<JsonEvidence>;
  try {
    baseline = parseObservation(await input.observer.capture('baseline'), 'baseline observation');
  } catch (cause) {
    throw asTransactionError('capture-baseline', cause);
  }
  let prepared: Readonly<{ handle: Handle; candidateSha256: string }>;
  try {
    prepared = parsePrepared(await input.adapter.prepare(candidateInput));
  } catch (cause) {
    throw new ImprovementTransactionError('prepare', cause);
  }

  let failure: TransactionFailure | undefined;
  let decision: ReceiptDecision | undefined;
  let base: ReceiptBeforeRollback | undefined;
  try {
    try {
      await input.adapter.apply(prepared.handle);
    } catch (cause) {
      throw asTransactionError('apply', cause);
    }
    let gates: readonly ImprovementGateResult[];
    try {
      gates = parseGates(await input.adapter.verify(prepared.handle));
    } catch (cause) {
      throw asTransactionError('verify', cause);
    }
    if (gates.some(gate => !gate.passed)) {
      base = receiptBase(objective, baseline, receiptEvaluationConfig(evaluation, projector), gates, candidateInput, prepared.candidateSha256);
      decision = { status: 'rejected', reason: 'constraint-failed' };
    } else {
      let after: ImprovementObservation<JsonEvidence>;
      try {
        after = parseObservation(await input.observer.capture('candidate'), 'candidate observation');
      } catch (cause) {
        throw asTransactionError('capture-candidate', cause);
      }
      const candidateObservation = receiptObservation(after);
      if (after.digest === baseline.digest) {
        base = receiptBase(objective, baseline, receiptEvaluationConfig(evaluation, projector), gates, candidateInput, prepared.candidateSha256);
        decision = { status: 'rejected', reason: 'no-observable-change', candidateObservation };
      } else {
        let projectedBaseline: JsonEvidence;
        let projectedCandidate: JsonEvidence;
        try {
          projectedBaseline = snapshotEvidence(await input.projector.project(blindEvidence(baseline)));
          projectedCandidate = snapshotEvidence(await input.projector.project(blindEvidence(after)));
        } catch (cause) {
          throw asTransactionError('project-evidence', cause);
        }
        const projectedBaselineSha256 = evidenceDigest(projectedBaseline);
        const projectedCandidateSha256 = evidenceDigest(projectedCandidate);
        const evaluationReceipt = receiptEvaluation(
          evaluation, projector, objective, prepared.candidateSha256, baseline, after,
          projectedBaselineSha256, projectedCandidateSha256,
        );
        base = receiptBase(objective, baseline, evaluationReceipt, gates, candidateInput, prepared.candidateSha256);
        if (projectedBaselineSha256 === projectedCandidateSha256) {
          decision = { status: 'rejected', reason: 'no-observable-change', candidateObservation };
        } else {
          let comparison: ReceiptComparison;
          try {
            const original = parseBlindComparison(await input.evaluator.compare({
              objective,
              a: Object.freeze({ payload: projectedBaseline }),
              b: Object.freeze({ payload: projectedCandidate }),
            }));
            const reversed = parseBlindComparison(await input.evaluator.compare({
              objective,
              a: Object.freeze({ payload: projectedCandidate }),
              b: Object.freeze({ payload: projectedBaseline }),
            }));
            if (original.execution.id === reversed.execution.id) {
              throw new Error('counterbalanced comparisons require distinct execution ids');
            }
            comparison = comparisonFromBlindResults(original, reversed);
          } catch (cause) {
            throw asTransactionError('evaluate', cause);
          }
          if (comparison.winner === 'candidate') {
            decision = { status: 'review-required', reason: 'candidate-preferred', candidateObservation, comparison };
          } else if (comparison.winner === 'conflict') {
            decision = { status: 'indeterminate', reason: 'comparison-conflict', candidateObservation, comparison };
          } else {
            decision = {
              status: 'rejected',
              reason: comparison.winner === 'baseline' ? 'baseline-preferred' : 'tie',
              candidateObservation,
              comparison,
            };
          }
        }
      }
    }
  } catch (cause) {
    failure = failureFrom(cause);
  }
  const rollbackDigest = await verifyRollback(input.adapter, input.observer, prepared.handle, baseline.digest!, failure);
  if (failure !== undefined) throw new ImprovementTransactionError(failure.phase, failure.cause);
  if (base === undefined || decision === undefined) {
    throw new ImprovementTransactionError('evaluate', new Error('transaction completed without a decision'));
  }
  return Object.freeze({
    ...base,
    ...decision,
    rollback: Object.freeze({ status: 'observed-restored' as const, digest: rollbackDigest }),
  });
}
