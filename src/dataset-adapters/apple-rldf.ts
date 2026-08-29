/**
 * Offline adapter for Apple ML-RLDF records.
 *
 * This module intentionally accepts only caller-supplied, revision-pinned rows.
 * Its data license is CC-BY-NC-ND-4.0, so normalized records remain external
 * evaluation material: callers must not turn the returned pixels or HTML into
 * distributable fixtures. The explicit `chosenPosition` parameter is required
 * to make presentation counterbalancing an invocation-level decision.
 */

import { createHash } from 'node:crypto';

import { createDatasetProvenance, type ExternalDatasetProvenance } from './registry.js';

export const APPLE_RLDF_DATASET = 'apple/ml-rldf' as const;
export const APPLE_RLDF_SOURCE_URL = 'https://github.com/apple/ml-rldf' as const;
export const APPLE_RLDF_LICENSE = 'CC-BY-NC-ND-4.0' as const;
export const APPLE_RLDF_REDISTRIBUTION = 'external-only' as const;

export type AppleRldfChosenPosition = 'A' | 'B';
export type AppleRldfRowKind = 'ranking' | 'revision';

export interface AppleRldfRankingRow {
  userid: string;
  screenid: string;
  description: string;
  chosen_image: unknown;
  rejected_image: unknown;
  chosen_html: string;
  rejected_html: string;
}

export interface AppleRldfRevisionRow {
  userid: string;
  description: string;
  chosen_image: unknown;
  rejected_image: unknown;
}

export interface AppleRldfPlacementOptions {
  /** Required: the caller's counterbalancing scheduler chooses this per presentation. */
  chosenPosition: AppleRldfChosenPosition;
}

export interface AppleRldfPreferenceExample {
  track: 'preference';
  id: string;
  /** Screen family for ranking rows, or user family for revision rows. */
  groupId: string;
  /** Keep both screen and annotator families together whenever upstream exposes them. */
  sourceGroups: string[];
  imageA: unknown;
  imageB: unknown;
  /** Maps the upstream semantic roles to the deliberately selected presentation sides. */
  roles: { chosen: AppleRldfChosenPosition; rejected: AppleRldfChosenPosition };
  /** The human-selected outcome after the supplied presentation placement. */
  winner: AppleRldfChosenPosition;
  votes: { A: 0 | 1; B: 0 | 1 };
  evidence: {
    strength: 'single-professional-designer-choice';
    voteDistribution: 'available';
    releaseGateEligible: false;
  };
  rowKind: AppleRldfRowKind;
  userid: string;
  description: string;
  screenid?: string;
  chosenHtml?: string;
  rejectedHtml?: string;
  provenance: ExternalDatasetProvenance;
}

export class AppleRldfSchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppleRldfSchemaError';
  }
}

type UnknownRecord = Record<string, unknown>;

function record(value: unknown, subject: string): UnknownRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new AppleRldfSchemaError(`${subject} must be an object`);
  }
  return value as UnknownRecord;
}

function exactRecord(value: unknown, subject: string, fields: readonly string[]): UnknownRecord {
  const candidate = record(value, subject);
  const expected = new Set(fields);
  const unknown = Object.keys(candidate).filter(field => !expected.has(field));
  const missing = fields.filter(field => !(field in candidate));
  if (unknown.length > 0) throw new AppleRldfSchemaError(`${subject} has unknown fields: ${unknown.join(', ')}`);
  if (missing.length > 0) throw new AppleRldfSchemaError(`${subject} is missing fields: ${missing.join(', ')}`);
  return candidate;
}

function nonEmptyString(value: unknown, subject: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AppleRldfSchemaError(`${subject} must be a non-empty string`);
  }
  return value;
}

function image(value: unknown, subject: string): unknown {
  if (value === null || value === undefined || Array.isArray(value)) {
    throw new AppleRldfSchemaError(`${subject} must retain a supplied image value`);
  }
  if (typeof value !== 'string' && typeof value !== 'object') {
    throw new AppleRldfSchemaError(`${subject} must retain a supplied image value`);
  }
  return value;
}

function requirePlacement(options: AppleRldfPlacementOptions): AppleRldfChosenPosition {
  if (options === null || typeof options !== 'object') {
    throw new AppleRldfSchemaError('Apple RLDF placement options are required');
  }
  if (options.chosenPosition !== 'A' && options.chosenPosition !== 'B') {
    throw new AppleRldfSchemaError('Apple RLDF options.chosenPosition must be A or B');
  }
  return options.chosenPosition;
}

function stableId(kind: AppleRldfRowKind, fields: readonly string[]): string {
  const digest = createHash('sha256').update(fields.join('\u0000')).digest('hex').slice(0, 20);
  return `apple-rldf:${kind}:${digest}`;
}

function placedImages(
  chosenImage: unknown,
  rejectedImage: unknown,
  chosenPosition: AppleRldfChosenPosition,
): Pick<AppleRldfPreferenceExample, 'imageA' | 'imageB' | 'roles' | 'winner' | 'votes' | 'evidence'> {
  const evidence = {
    strength: 'single-professional-designer-choice' as const,
    voteDistribution: 'available' as const,
    releaseGateEligible: false as const,
  };
  return chosenPosition === 'A'
    ? {
      imageA: chosenImage,
      imageB: rejectedImage,
      roles: { chosen: 'A', rejected: 'B' },
      winner: 'A',
      votes: { A: 1, B: 0 },
      evidence,
    }
    : {
      imageA: rejectedImage,
      imageB: chosenImage,
      roles: { chosen: 'B', rejected: 'A' },
      winner: 'B',
      votes: { A: 0, B: 1 },
      evidence,
    };
}

/** Validate a provenance record for non-redistributable Apple ML-RLDF material. */
export function validateAppleRldfProvenance(value: unknown): ExternalDatasetProvenance {
  const source = exactRecord(value, 'Apple RLDF provenance', [
    'dataset', 'sourceUrl', 'revision', 'license', 'redistribution',
  ]);
  const expected = (() => {
    try {
      return createDatasetProvenance('apple-rldf', nonEmptyString(source.revision, 'Apple RLDF provenance.revision'));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Apple RLDF provenance revision is invalid';
      throw new AppleRldfSchemaError(message);
    }
  })();
  if (source.dataset !== expected.dataset) {
    throw new AppleRldfSchemaError(`Apple RLDF provenance.dataset must be ${expected.dataset}`);
  }
  if (source.sourceUrl !== expected.sourceUrl) {
    throw new AppleRldfSchemaError(`Apple RLDF provenance.sourceUrl must be ${expected.sourceUrl}`);
  }
  if (source.license !== expected.license) {
    throw new AppleRldfSchemaError(`Apple RLDF provenance.license must be ${expected.license}`);
  }
  if (source.redistribution !== expected.redistribution) {
    throw new AppleRldfSchemaError(`Apple RLDF provenance.redistribution must be ${expected.redistribution}`);
  }
  return expected;
}

/** Normalize one documented ML-RLDF ranking row with an explicit presentation side. */
export function normalizeAppleRldfRankingRow(
  value: unknown,
  provenance: ExternalDatasetProvenance,
  options: AppleRldfPlacementOptions,
): AppleRldfPreferenceExample {
  const row = exactRecord(value, 'Apple RLDF ranking row', [
    'userid', 'screenid', 'description', 'chosen_image', 'rejected_image', 'chosen_html', 'rejected_html',
  ]);
  const chosenPosition = requirePlacement(options);
  const userid = nonEmptyString(row.userid, 'Apple RLDF ranking row.userid');
  const screenid = nonEmptyString(row.screenid, 'Apple RLDF ranking row.screenid');
  const description = nonEmptyString(row.description, 'Apple RLDF ranking row.description');
  const chosenHtml = nonEmptyString(row.chosen_html, 'Apple RLDF ranking row.chosen_html');
  const rejectedHtml = nonEmptyString(row.rejected_html, 'Apple RLDF ranking row.rejected_html');
  return {
    track: 'preference',
    id: stableId('ranking', [userid, screenid, description, chosenHtml, rejectedHtml]),
    groupId: `apple-rldf:screen:${screenid}`,
    sourceGroups: [`apple-rldf:screen:${screenid}`, `apple-rldf:user:${userid}`],
    ...placedImages(
      image(row.chosen_image, 'Apple RLDF ranking row.chosen_image'),
      image(row.rejected_image, 'Apple RLDF ranking row.rejected_image'),
      chosenPosition,
    ),
    rowKind: 'ranking',
    userid,
    description,
    screenid,
    chosenHtml,
    rejectedHtml,
    provenance: validateAppleRldfProvenance(provenance),
  };
}

/** Normalize one documented ML-RLDF direct-revision row with an explicit presentation side. */
export function normalizeAppleRldfRevisionRow(
  value: unknown,
  provenance: ExternalDatasetProvenance,
  options: AppleRldfPlacementOptions,
): AppleRldfPreferenceExample {
  const row = exactRecord(value, 'Apple RLDF revision row', [
    'userid', 'description', 'chosen_image', 'rejected_image',
  ]);
  const chosenPosition = requirePlacement(options);
  const userid = nonEmptyString(row.userid, 'Apple RLDF revision row.userid');
  const description = nonEmptyString(row.description, 'Apple RLDF revision row.description');
  return {
    track: 'preference',
    id: stableId('revision', [userid, description]),
    groupId: `apple-rldf:user:${userid}`,
    sourceGroups: [`apple-rldf:user:${userid}`],
    ...placedImages(
      image(row.chosen_image, 'Apple RLDF revision row.chosen_image'),
      image(row.rejected_image, 'Apple RLDF revision row.rejected_image'),
      chosenPosition,
    ),
    rowKind: 'revision',
    userid,
    description,
    provenance: validateAppleRldfProvenance(provenance),
  };
}
