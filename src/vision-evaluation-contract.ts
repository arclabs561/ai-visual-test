/**
 * Provider-neutral vocabulary for bounded visual evaluation.
 *
 * Transport modules own endpoint, authentication, and wire envelopes. This
 * contract deliberately contains no provider names, credentials, or I/O.
 */

export type VisionEvaluationResponseKind = 'scalar' | 'pairwise' | 'grounding' | 'binary';

export interface VisionScalarOutcome {
  kind: 'scalar';
  score: number;
}

export interface VisionPairwiseOutcome {
  /** The winning image position in the submitted A/B request. */
  kind: 'pairwise';
  winner: 'A' | 'B';
  /** A conventional point for A (1) or B (0), useful for AB/BA reconciliation. */
  point: 0 | 1;
}

export interface VisionGroundingOutcome {
  /** Normalized horizontal coordinate in the inclusive 0 through 1000 space. */
  kind: 'grounding';
  x: number;
  /** Normalized vertical coordinate in the inclusive 0 through 1000 space. */
  y: number;
}

/** A two-image regression verdict, where true means an observable difference exists. */
export interface VisionBinaryOutcome {
  kind: 'binary';
  value: boolean;
}

export type VisionEvaluationOutcome =
  | VisionScalarOutcome
  | VisionPairwiseOutcome
  | VisionGroundingOutcome
  | VisionBinaryOutcome;

/**
 * Transport-independent caller inputs. Transports may add their own endpoint,
 * credential, output-token, or test-seam options.
 */
export interface VisionEvaluationRequest {
  /** One image for scalar/grounding, or the before/after or A/B image pair. */
  imagePaths: readonly string[];
  /** A caller-owned fixed evaluation prompt. Image bytes are never interpolated into it. */
  prompt: string;
  /** A concrete model identifier; transports must never use an implicit default. */
  model: string;
  responseKind: VisionEvaluationResponseKind;
  timeoutMs?: number;
  maximumImageBytes?: number;
  maximumResponseBytes?: number;
  minimumScore?: number;
  maximumScore?: number;
  /** Require a whole-number scalar score; default scalar scores remain numeric. */
  integerScore?: boolean;
}

/**
 * A portable, storage-safe evaluation receipt: only the decision and bounded
 * model identities are admissible. Usage/cost records remain transport-owned.
 */
export interface VisionEvaluationReceipt {
  outcome: VisionEvaluationOutcome;
  /** The model that actually produced the response, if a router resolved it. */
  model: string;
  provider?: string;
  nativeModel?: string;
}
