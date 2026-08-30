/**
 * Provider-neutral replay identities for visual-improvement experiments.
 *
 * This module intentionally stores only bounded identifiers and SHA-256
 * digests. Prompts, evidence, graph definitions, image bytes, credentials,
 * and provider envelopes remain outside the replay receipt.
 */

import { createHash } from 'node:crypto';

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const MAX_IDENTIFIER_LENGTH = 200;
const MAX_PROMPT_VERSION_LENGTH = 100;

export type ReplayResponseKind = 'scalar' | 'pairwise' | 'grounding' | 'binary';
export type ReplayVariantKind = 'direct' | 'prompt' | 'evidence' | 'graph';
export type Sha256 = string & { readonly __sha256: unique symbol };

export interface ReplayBindingInput {
  objectiveSha256: string;
  /** Adapter-owned fingerprint of the opaque candidate under evaluation. */
  candidateSha256: string;
  baselineObservationSha256: string;
  candidateObservationSha256: string;
  /** Identifier and digest for the consumer-owned evaluator evidence projection. */
  projectionId: string;
  projectionConfigSha256: string;
  /** Hashes of the frozen, projected payloads actually presented to the evaluator. */
  projectedBaselineSha256: string;
  projectedCandidateSha256: string;
  evaluatorId: string;
  evaluatorConfigSha256: string;
  responseKind: ReplayResponseKind;
}

/** The invariants that must not drift when results are compared or replayed. */
export interface ReplayBinding {
  readonly version: 1;
  readonly objectiveSha256: Sha256;
  readonly candidateSha256: Sha256;
  readonly baselineObservationSha256: Sha256;
  readonly candidateObservationSha256: Sha256;
  readonly projectionId: string;
  readonly projectionConfigSha256: Sha256;
  readonly projectedBaselineSha256: Sha256;
  readonly projectedCandidateSha256: Sha256;
  readonly evaluatorId: string;
  readonly evaluatorConfigSha256: Sha256;
  readonly responseKind: ReplayResponseKind;
  readonly sha256: Sha256;
}

interface PromptReplayVariantFields {
  promptVersion: string;
  promptSha256: string;
}

export interface DirectReplayVariantInput extends PromptReplayVariantFields {
  kind: 'direct';
}

export interface PromptReplayVariantInput extends PromptReplayVariantFields {
  kind: 'prompt';
}

export interface EvidenceReplayVariantInput extends PromptReplayVariantFields {
  kind: 'evidence';
  evidenceSha256: string;
}

export interface GraphReplayVariantInput extends PromptReplayVariantFields {
  kind: 'graph';
  evidenceSha256: string;
  graphSha256: string;
}

export type ReplayVariantInput =
  | DirectReplayVariantInput
  | PromptReplayVariantInput
  | EvidenceReplayVariantInput
  | GraphReplayVariantInput;

export interface DirectReplayVariant {
  readonly kind: 'direct';
  readonly promptVersion: string;
  readonly promptSha256: Sha256;
  readonly sha256: Sha256;
}

export interface PromptReplayVariant {
  readonly kind: 'prompt';
  readonly promptVersion: string;
  readonly promptSha256: Sha256;
  readonly sha256: Sha256;
}

export interface EvidenceReplayVariant {
  readonly kind: 'evidence';
  readonly promptVersion: string;
  readonly promptSha256: Sha256;
  readonly evidenceSha256: Sha256;
  readonly sha256: Sha256;
}

export interface GraphReplayVariant {
  readonly kind: 'graph';
  readonly promptVersion: string;
  readonly promptSha256: Sha256;
  readonly evidenceSha256: Sha256;
  readonly graphSha256: Sha256;
  readonly sha256: Sha256;
}

export type ReplayVariant =
  | DirectReplayVariant
  | PromptReplayVariant
  | EvidenceReplayVariant
  | GraphReplayVariant;

export interface ReplayIdentityInput {
  binding: ReplayBindingInput;
  variant: ReplayVariantInput;
}

/** A complete receipt identity: binding invariants plus an experimental variant. */
export interface ReplayIdentity {
  readonly version: 1;
  readonly binding: ReplayBinding;
  readonly variant: ReplayVariant;
  readonly sha256: Sha256;
}

export type ReplayIdentityErrorCode =
  | 'invalid_replay_binding'
  | 'invalid_replay_variant'
  | 'invalid_replay_identity'
  | 'incompatible_replay_binding';

/** Typed, storage-safe rejection; details name fields but never include their values. */
export class ReplayIdentityError extends Error {
  readonly code: ReplayIdentityErrorCode;
  readonly field?: string;

  constructor(code: ReplayIdentityErrorCode, message: string, field?: string) {
    super(message);
    this.name = 'ReplayIdentityError';
    this.code = code;
    if (field !== undefined) this.field = field;
  }
}

type CanonicalJson = null | boolean | number | string | CanonicalJson[] | { [key: string]: CanonicalJson };

function fail(code: ReplayIdentityErrorCode, message: string, field?: string): never {
  throw new ReplayIdentityError(code, message, field);
}

function objectFrom(value: unknown, code: ReplayIdentityErrorCode, field: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return fail(code, `${field} must be an object`, field);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return fail(code, `${field} must be a plain object`, field);
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], code: ReplayIdentityErrorCode, field: string): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  const missing = expected.find(key => !Object.hasOwn(value, key));
  if (missing !== undefined) {
    fail(code, `${field} is missing ${missing}`, missing);
  }
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail(code, `${field} has an unsupported shape`, field);
  }
}

function boundedString(value: unknown, field: string, maximum: number, code: ReplayIdentityErrorCode): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximum) {
    return fail(code, `${field} must be a nonempty string of at most ${maximum} characters`, field);
  }
  return value;
}

function sha256(value: unknown, field: string, code: ReplayIdentityErrorCode): Sha256 {
  const candidate = boundedString(value, field, 64, code);
  if (!SHA256_PATTERN.test(candidate)) {
    return fail(code, `${field} must be a lowercase SHA-256 hex digest`, field);
  }
  return candidate as Sha256;
}

function responseKind(value: unknown): ReplayResponseKind {
  if (value === 'scalar' || value === 'pairwise' || value === 'grounding' || value === 'binary') return value;
  return fail('invalid_replay_binding', 'responseKind must be a supported response kind', 'responseKind');
}

function canonicalize(value: unknown): CanonicalJson {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Canonical JSON does not support non-finite numbers');
    return value;
  }
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === 'object') {
    const record = objectFrom(value, 'invalid_replay_identity', 'canonical JSON value');
    const result: { [key: string]: CanonicalJson } = {};
    for (const key of Object.keys(record).sort()) {
      const member = record[key];
      if (member === undefined) throw new TypeError('Canonical JSON does not support undefined values');
      result[key] = canonicalize(member);
    }
    return result;
  }
  throw new TypeError('Canonical JSON supports only JSON values');
}

/** Stable JSON serialization that is insensitive to plain-object key order. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

/** SHA-256 over canonical JSON, useful for caller-owned configurations. */
export function canonicalJsonSha256(value: unknown): Sha256 {
  return createHash('sha256').update(canonicalJson(value)).digest('hex') as Sha256;
}

export function createReplayBinding(input: unknown): ReplayBinding {
  const value = objectFrom(input, 'invalid_replay_binding', 'binding');
  exactKeys(value, [
    'objectiveSha256', 'candidateSha256', 'baselineObservationSha256',
    'candidateObservationSha256', 'projectionId', 'projectionConfigSha256',
    'projectedBaselineSha256', 'projectedCandidateSha256',
    'evaluatorId', 'evaluatorConfigSha256', 'responseKind',
  ], 'invalid_replay_binding', 'binding');
  const binding = {
    version: 1 as const,
    objectiveSha256: sha256(value.objectiveSha256, 'objectiveSha256', 'invalid_replay_binding'),
    candidateSha256: sha256(value.candidateSha256, 'candidateSha256', 'invalid_replay_binding'),
    baselineObservationSha256: sha256(value.baselineObservationSha256, 'baselineObservationSha256', 'invalid_replay_binding'),
    candidateObservationSha256: sha256(value.candidateObservationSha256, 'candidateObservationSha256', 'invalid_replay_binding'),
    projectionId: boundedString(value.projectionId, 'projectionId', MAX_IDENTIFIER_LENGTH, 'invalid_replay_binding'),
    projectionConfigSha256: sha256(value.projectionConfigSha256, 'projectionConfigSha256', 'invalid_replay_binding'),
    projectedBaselineSha256: sha256(value.projectedBaselineSha256, 'projectedBaselineSha256', 'invalid_replay_binding'),
    projectedCandidateSha256: sha256(value.projectedCandidateSha256, 'projectedCandidateSha256', 'invalid_replay_binding'),
    evaluatorId: boundedString(value.evaluatorId, 'evaluatorId', MAX_IDENTIFIER_LENGTH, 'invalid_replay_binding'),
    evaluatorConfigSha256: sha256(value.evaluatorConfigSha256, 'evaluatorConfigSha256', 'invalid_replay_binding'),
    responseKind: responseKind(value.responseKind),
  };
  return Object.freeze({ ...binding, sha256: canonicalJsonSha256(binding) });
}

export function createReplayVariant(input: unknown): ReplayVariant {
  const value = objectFrom(input, 'invalid_replay_variant', 'variant');
  const kind = value.kind;
  if (kind === 'direct') {
    exactKeys(value, ['kind', 'promptVersion', 'promptSha256'], 'invalid_replay_variant', 'variant');
    const variant = {
      kind,
      promptVersion: boundedString(value.promptVersion, 'promptVersion', MAX_PROMPT_VERSION_LENGTH, 'invalid_replay_variant'),
      promptSha256: sha256(value.promptSha256, 'promptSha256', 'invalid_replay_variant'),
    } as const;
    return Object.freeze({ ...variant, sha256: canonicalJsonSha256(variant) });
  }
  if (kind === 'prompt') {
    exactKeys(value, ['kind', 'promptVersion', 'promptSha256'], 'invalid_replay_variant', 'variant');
    const variant = {
      kind,
      promptVersion: boundedString(value.promptVersion, 'promptVersion', MAX_PROMPT_VERSION_LENGTH, 'invalid_replay_variant'),
      promptSha256: sha256(value.promptSha256, 'promptSha256', 'invalid_replay_variant'),
    } as const;
    return Object.freeze({ ...variant, sha256: canonicalJsonSha256(variant) });
  }
  if (kind === 'evidence') {
    exactKeys(value, ['kind', 'promptVersion', 'promptSha256', 'evidenceSha256'], 'invalid_replay_variant', 'variant');
    const variant = {
      kind,
      promptVersion: boundedString(value.promptVersion, 'promptVersion', MAX_PROMPT_VERSION_LENGTH, 'invalid_replay_variant'),
      promptSha256: sha256(value.promptSha256, 'promptSha256', 'invalid_replay_variant'),
      evidenceSha256: sha256(value.evidenceSha256, 'evidenceSha256', 'invalid_replay_variant'),
    } as const;
    return Object.freeze({ ...variant, sha256: canonicalJsonSha256(variant) });
  }
  if (kind === 'graph') {
    exactKeys(value, ['kind', 'promptVersion', 'promptSha256', 'evidenceSha256', 'graphSha256'], 'invalid_replay_variant', 'variant');
    const variant = {
      kind,
      promptVersion: boundedString(value.promptVersion, 'promptVersion', MAX_PROMPT_VERSION_LENGTH, 'invalid_replay_variant'),
      promptSha256: sha256(value.promptSha256, 'promptSha256', 'invalid_replay_variant'),
      evidenceSha256: sha256(value.evidenceSha256, 'evidenceSha256', 'invalid_replay_variant'),
      graphSha256: sha256(value.graphSha256, 'graphSha256', 'invalid_replay_variant'),
    } as const;
    return Object.freeze({ ...variant, sha256: canonicalJsonSha256(variant) });
  }
  return fail('invalid_replay_variant', 'variant.kind must be direct, prompt, evidence, or graph', 'kind');
}

export function createReplayIdentity(input: unknown): ReplayIdentity {
  const value = objectFrom(input, 'invalid_replay_identity', 'identity');
  exactKeys(value, ['binding', 'variant'], 'invalid_replay_identity', 'identity');
  const binding = createReplayBinding(value.binding);
  const variant = createReplayVariant(value.variant);
  const identity = { version: 1 as const, binding, variant };
  return Object.freeze({ ...identity, sha256: canonicalJsonSha256(identity) });
}

function bindingOf(value: ReplayIdentity | ReplayBinding): ReplayBinding {
  return 'binding' in value ? value.binding : value;
}

/**
 * Reject a comparison if any binding invariant has changed. Variant changes
 * are deliberately compatible: they are the treatments an experiment varies.
 */
export function assertReplayCompatible(expected: ReplayIdentity | ReplayBinding, actual: ReplayIdentity | ReplayBinding): void {
  const left = bindingOf(expected);
  const right = bindingOf(actual);
  const fields: (keyof ReplayBindingInput)[] = [
    'objectiveSha256',
    'candidateSha256',
    'baselineObservationSha256',
    'candidateObservationSha256',
    'projectionId',
    'projectionConfigSha256',
    'projectedBaselineSha256',
    'projectedCandidateSha256',
    'evaluatorId',
    'evaluatorConfigSha256',
    'responseKind',
  ];
  for (const field of fields) {
    if (left[field] !== right[field]) {
      fail('incompatible_replay_binding', `Replay binding differs at ${field}`, field);
    }
  }
}
