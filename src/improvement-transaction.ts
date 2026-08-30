/** Internal, review-only orchestration for one reversible visual improvement. */

export type ImprovementMetadataValue = string | number | boolean | null;
export type ImprovementMetadata = Readonly<Record<string, ImprovementMetadataValue>>;
export type JsonEvidence = null | boolean | number | string | JsonEvidenceArray | JsonEvidenceObject;
export interface JsonEvidenceArray extends ReadonlyArray<JsonEvidence> {}
export interface JsonEvidenceObject {
  readonly [key: string]: JsonEvidence;
}

export interface ImprovementObjective {
  readonly id: string;
  readonly digest: string;
  readonly description: string;
  readonly metadata?: ImprovementMetadata;
}

export interface ImprovementObservation<Payload> {
  readonly digest: string;
  readonly metadata?: ImprovementMetadata;
  /** Captured evidence is snapshotted to bounded JSON before evaluation. */
  readonly payload: Payload;
}

export interface ImprovementCandidate<Payload> {
  readonly id: string;
  readonly digest: string;
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

/** Both orders are canonicalized back to baseline/candidate identity. */
export interface ImprovementComparison {
  readonly original: ImprovementOrderOutcome;
  readonly reversed: ImprovementOrderOutcome;
  readonly metadata?: ImprovementMetadata;
}

export interface ImprovementAdapter<CandidatePayload, Handle> {
  /** Must create rollback capability without changing the target. */
  prepare(candidate: ImprovementCandidate<CandidatePayload>): Promise<Handle>;
  /** May mutate the target; the runner rolls back even when this rejects. */
  apply(handle: Handle, candidate: ImprovementCandidate<CandidatePayload>): Promise<void>;
  verify(handle: Handle): Promise<readonly ImprovementGateResult[]>;
  rollback(handle: Handle): Promise<void>;
}

/** Independent observation boundary; it has no mutation capability. */
export interface ImprovementObserver<ObservationPayload> {
  capture(phase: 'baseline' | 'candidate' | 'rollback'): Promise<ImprovementObservation<ObservationPayload>>;
}

export type ImprovementEvidence<Payload> = Readonly<{
  readonly digest: string;
  readonly payload: Payload;
}>;

export interface ImprovementEvaluator<ObservationPayload> {
  compare(input: {
    readonly objective: ImprovementObjective;
    readonly baseline: ImprovementEvidence<ObservationPayload>;
    readonly candidate: ImprovementEvidence<ObservationPayload>;
  }): Promise<ImprovementComparison>;
}

type ReceiptObservation = Readonly<{ digest: string; metadata?: ImprovementMetadata }>;
type ReceiptCandidate = Readonly<{ id: string; digest: string; metadata?: ImprovementMetadata }>;
type ReceiptObjective = Readonly<{ id: string; digest: string; metadata?: ImprovementMetadata }>;
type ReceiptComparison = Readonly<{
  original: ImprovementOrderOutcome;
  reversed: ImprovementOrderOutcome;
  winner: ImprovementOrderOutcome | 'conflict';
  metadata?: ImprovementMetadata;
}>;
type ReceiptRollback = Readonly<{ status: 'observed-restored'; digest: string }>;

interface ReceiptBase {
  readonly objective: ReceiptObjective;
  readonly baseline: ReceiptObservation;
  readonly candidate: ReceiptCandidate;
  readonly gates: readonly ImprovementGateResult[];
  readonly rollback: ReceiptRollback;
}
type ReceiptBeforeRollback = Omit<ReceiptBase, 'rollback'>;
type ReceiptDecision =
  | { readonly status: 'rejected'; readonly reason: 'constraint-failed' }
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
function parseObjective(value: ImprovementObjective): ImprovementObjective {
  const id = parseId(value.id, 'objective');
  const digest = parseDigest(value.digest, 'objective');
  if (typeof value.description !== 'string') throw invalidInput('objective description must be a string');
  const metadata = parseMetadata(value.metadata, 'objective');
  return metadata === undefined
    ? Object.freeze({ id, digest, description: value.description })
    : Object.freeze({ id, digest, description: value.description, metadata });
}
function parseCandidate<Payload>(value: ImprovementCandidate<Payload>): ImprovementCandidate<Payload> {
  const id = parseId(value.id, 'candidate');
  const digest = parseDigest(value.digest, 'candidate');
  const metadata = parseMetadata(value.metadata, 'candidate');
  return metadata === undefined
    ? Object.freeze({ id, digest, payload: value.payload })
    : Object.freeze({ id, digest, metadata, payload: value.payload });
}
function snapshotEvidence(value: unknown): JsonEvidence {
  const state = { nodes: 0, ancestors: new Set<object>() };
  return snapshotEvidenceValue(value, state, 0);
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
): ImprovementObservation<JsonEvidence> {
  const digest = parseDigest(value.digest, label);
  const metadata = parseMetadata(value.metadata, label);
  const payload = snapshotEvidence(value.payload);
  return metadata === undefined
    ? Object.freeze({ digest, payload })
    : Object.freeze({ digest, metadata, payload });
}
function evidenceView(observation: ImprovementObservation<JsonEvidence>): ImprovementEvidence<JsonEvidence> {
  return Object.freeze({ digest: observation.digest, payload: observation.payload });
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
function isOrderOutcome(value: unknown): value is ImprovementOrderOutcome {
  return value === 'candidate' || value === 'baseline' || value === 'tie';
}
function parseComparison(value: unknown): ReceiptComparison {
  if (!isPlainObject(value) || !isOrderOutcome(value.original) || !isOrderOutcome(value.reversed)) {
    throw new Error('counterbalanced comparison requires original and reversed outcomes');
  }
  const metadata = parseMetadata(value.metadata, 'comparison');
  const winner = value.original === value.reversed ? value.original : 'conflict';
  return metadata === undefined
    ? Object.freeze({ original: value.original, reversed: value.reversed, winner })
    : Object.freeze({ original: value.original, reversed: value.reversed, winner, metadata });
}
function receiptObservation<Payload>(observation: ImprovementObservation<Payload>): ReceiptObservation {
  return observation.metadata === undefined
    ? Object.freeze({ digest: observation.digest })
    : Object.freeze({ digest: observation.digest, metadata: observation.metadata });
}
function receiptCandidate<Payload>(candidate: ImprovementCandidate<Payload>): ReceiptCandidate {
  return candidate.metadata === undefined
    ? Object.freeze({ id: candidate.id, digest: candidate.digest })
    : Object.freeze({ id: candidate.id, digest: candidate.digest, metadata: candidate.metadata });
}
function receiptObjective(objective: ImprovementObjective): ReceiptObjective {
  return objective.metadata === undefined
    ? Object.freeze({ id: objective.id, digest: objective.digest })
    : Object.freeze({ id: objective.id, digest: objective.digest, metadata: objective.metadata });
}
function receiptBase<ObservationPayload, CandidatePayload>(
  objective: ImprovementObjective,
  baseline: ImprovementObservation<ObservationPayload>,
  gates: readonly ImprovementGateResult[],
  candidate: ImprovementCandidate<CandidatePayload>,
): ReceiptBeforeRollback {
  return Object.freeze({
    objective: receiptObjective(objective),
    baseline: receiptObservation(baseline),
    candidate: receiptCandidate(candidate),
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
  readonly evaluator: ImprovementEvaluator<JsonEvidence>;
}): Promise<ImprovementReceipt> {
  const objective = parseObjective(input.objective);
  const candidate = parseCandidate(input.candidate);
  let baseline: ImprovementObservation<JsonEvidence>;
  try {
    baseline = parseObservation(await input.observer.capture('baseline'), 'baseline observation');
  } catch (cause) {
    throw asTransactionError('capture-baseline', cause);
  }
  let handle: Handle;
  try {
    handle = await input.adapter.prepare(candidate);
  } catch (cause) {
    throw asTransactionError('prepare', cause);
  }

  let failure: TransactionFailure | undefined;
  let decision: ReceiptDecision | undefined;
  let base: ReceiptBeforeRollback | undefined;
  try {
    try {
      await input.adapter.apply(handle, candidate);
    } catch (cause) {
      throw asTransactionError('apply', cause);
    }
    let gates: readonly ImprovementGateResult[];
    try {
      gates = parseGates(await input.adapter.verify(handle));
    } catch (cause) {
      throw asTransactionError('verify', cause);
    }
    base = receiptBase(objective, baseline, gates, candidate);
    if (gates.some(gate => !gate.passed)) {
      decision = { status: 'rejected', reason: 'constraint-failed' };
    } else {
      let after: ImprovementObservation<JsonEvidence>;
      try {
        after = parseObservation(await input.observer.capture('candidate'), 'candidate observation');
      } catch (cause) {
        throw asTransactionError('capture-candidate', cause);
      }
      let comparison: ReceiptComparison;
      try {
        comparison = parseComparison(await input.evaluator.compare({
          objective,
          baseline: evidenceView(baseline),
          candidate: evidenceView(after),
        }));
      } catch (cause) {
        throw asTransactionError('evaluate', cause);
      }
      const candidateObservation = receiptObservation(after);
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
  } catch (cause) {
    failure = failureFrom(cause);
  }
  const rollbackDigest = await verifyRollback(input.adapter, input.observer, handle, baseline.digest, failure);
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
