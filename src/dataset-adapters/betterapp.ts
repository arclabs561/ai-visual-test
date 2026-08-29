/**
 * Offline adapter for the visible paired-row schema of UIClip BetterApp.
 *
 * This module intentionally accepts only already-downloaded records. The
 * publisher has not stated a dataset license or redistribution terms, so
 * BetterApp material remains external-only operationally and is never valid
 * release-gate evidence. Its one good/bad designation is a single
 * expert-derived label, not a human-vote distribution.
 */

import {
  createDatasetProvenance,
  DatasetRegistryError,
  type ExternalDatasetProvenance,
} from './registry.js';

export const BETTERAPP_DATASET = 'biglab/uiclip_human_data-paired_hf' as const;
export const BETTERAPP_LICENSE = 'unknown' as const;
export const BETTERAPP_REDISTRIBUTION = 'unknown' as const;

export type BetterAppPosition = 'A' | 'B';

/** The six fields visible in the hosted paired dataset schema. */
export interface BetterAppRow {
  img_good: unknown;
  img_bad: unknown;
  caption: string;
  caption_bad: string;
  filename: string;
  filename_bad: string;
}

export interface BetterAppNormalizationOptions {
  /**
   * The position assigned to the upstream `img_good` image for this run.
   * This is required: defaulting to A would permanently expose the label
   * through image order.
   */
  chosenPosition: BetterAppPosition;
}

export interface BetterAppPreferenceExample {
  track: 'preference';
  id: string;
  /** Pair family identity, shared by its A/B counterbalanced presentations. */
  groupId: string;
  /** Both original image identities, retained even when presentation is swapped. */
  sourceGroups: readonly [string, string];
  chosenPosition: BetterAppPosition;
  imageA: unknown;
  imageB: unknown;
  captionA: string;
  captionB: string;
  votes: { A: 0 | 1; B: 0 | 1 };
  winner: BetterAppPosition;
  evidence: {
    strength: 'single-expert-derived-label';
    voteDistribution: 'unavailable';
    releaseGateEligible: false;
  };
  provenance: ExternalDatasetProvenance;
}

export class BetterAppDatasetAdapterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BetterAppDatasetAdapterError';
  }
}

type RowRecord = Record<string, unknown>;

function fail(message: string): never {
  throw new BetterAppDatasetAdapterError(message);
}

function exactObject(value: unknown, subject: string, fields: readonly string[]): RowRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${subject} must be an object`);
  }
  const candidate = value as RowRecord;
  const allowed = new Set(fields);
  const unknown = Object.keys(candidate).filter(field => !allowed.has(field));
  const missing = fields.filter(field => !(field in candidate));
  if (unknown.length > 0) fail(`${subject} has unknown fields: ${unknown.join(', ')}`);
  if (missing.length > 0) fail(`${subject} is missing fields: ${missing.join(', ')}`);
  return candidate;
}

function nonEmptyString(value: unknown, subject: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(`${subject} must be a non-empty string`);
  }
  return value.trim();
}

function image(value: unknown, subject: string): unknown {
  if (value === null || value === undefined) fail(`${subject} must be present`);
  return value;
}

function provenance(value: unknown): ExternalDatasetProvenance {
  const candidate = exactObject(value, 'BetterApp provenance', [
    'dataset', 'sourceUrl', 'revision', 'license', 'redistribution',
  ]);
  const revision = nonEmptyString(candidate.revision, 'BetterApp provenance.revision');
  let canonical: ExternalDatasetProvenance;
  try {
    canonical = createDatasetProvenance('uiclip-betterapp', revision);
  } catch (error) {
    if (error instanceof DatasetRegistryError) fail(error.message);
    throw error;
  }
  for (const field of ['dataset', 'sourceUrl', 'revision', 'license', 'redistribution'] as const) {
    if (candidate[field] !== canonical[field]) {
      fail(`BetterApp provenance.${field} must match canonical registry provenance`);
    }
  }
  return canonical;
}

function chosenPosition(value: unknown): BetterAppPosition {
  const options = exactObject(value, 'options', ['chosenPosition']);
  if (options.chosenPosition !== 'A' && options.chosenPosition !== 'B') {
    fail('options.chosenPosition must be A or B');
  }
  return options.chosenPosition;
}

function pairIdentity(goodFilename: string, badFilename: string): string {
  return [goodFilename, badFilename].sort((left, right) => left.localeCompare(right)).map(encodeURIComponent).join(':');
}

/**
 * Normalize one downloaded BetterApp row into a deliberately counterbalanced
 * preference presentation. The upstream good/bad fields are never exposed in
 * a fixed A position.
 */
export function normalizeBetterAppRow(
  value: unknown,
  inputProvenance: ExternalDatasetProvenance,
  options: BetterAppNormalizationOptions,
): BetterAppPreferenceExample {
  const row = exactObject(value, 'BetterApp row', [
    'img_good', 'img_bad', 'caption', 'caption_bad', 'filename', 'filename_bad',
  ]);
  const source = provenance(inputProvenance);
  const position = chosenPosition(options);
  const goodFilename = nonEmptyString(row.filename, 'BetterApp row.filename');
  const badFilename = nonEmptyString(row.filename_bad, 'BetterApp row.filename_bad');
  if (goodFilename === badFilename) {
    fail('BetterApp row filenames must identify two distinct source images');
  }
  const goodImage = image(row.img_good, 'BetterApp row.img_good');
  const badImage = image(row.img_bad, 'BetterApp row.img_bad');
  const goodCaption = nonEmptyString(row.caption, 'BetterApp row.caption');
  const badCaption = nonEmptyString(row.caption_bad, 'BetterApp row.caption_bad');
  const identity = pairIdentity(goodFilename, badFilename);
  const goodAtA = position === 'A';
  return {
    track: 'preference',
    id: `uiclip-betterapp:${identity}:good-at-${position}`,
    groupId: `uiclip-betterapp:pair:${identity}`,
    sourceGroups: [`file:${goodFilename}`, `file:${badFilename}`],
    chosenPosition: position,
    imageA: goodAtA ? goodImage : badImage,
    imageB: goodAtA ? badImage : goodImage,
    captionA: goodAtA ? goodCaption : badCaption,
    captionB: goodAtA ? badCaption : goodCaption,
    votes: goodAtA ? { A: 1, B: 0 } : { A: 0, B: 1 },
    winner: position,
    evidence: {
      strength: 'single-expert-derived-label',
      voteDistribution: 'unavailable',
      releaseGateEligible: false,
    },
    provenance: source,
  };
}
