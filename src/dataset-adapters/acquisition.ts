import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { isAbsolute, resolve, sep } from 'node:path';

import {
  DATASET_REGISTRY,
  createDatasetProvenance,
  type DatasetKey,
  type ExternalDatasetProvenance,
} from './registry.js';

export interface DatasetArtifactRecord {
  path: string;
  sha256: string;
  bytes: number;
}

export type DatasetAcquisitionRecord = {
  version: 1;
  key: DatasetKey;
  provenance: ExternalDatasetProvenance;
  retrievedAt: string;
  normalizerVersion: string;
  artifacts: DatasetArtifactRecord[];
} & (
  | { status: 'available' | 'metadata-only'; blockedReason?: never }
  | { status: 'blocked'; blockedReason: string }
);

export class DatasetAcquisitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatasetAcquisitionError';
  }
}

type UnknownRecord = Record<string, unknown>;

function record(value: unknown, subject: string): UnknownRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new DatasetAcquisitionError(`${subject} must be an object`);
  }
  return value as UnknownRecord;
}

function string(value: unknown, subject: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new DatasetAcquisitionError(`${subject} must be a non-empty string`);
  }
  return value.trim();
}

function sha256(value: unknown, subject: string): string {
  const digest = string(value, subject);
  if (!/^[a-f0-9]{64}$/.test(digest)) throw new DatasetAcquisitionError(`${subject} must be a lowercase SHA-256 digest`);
  return digest;
}

function artifact(value: unknown, subject: string): DatasetArtifactRecord {
  const candidate = record(value, subject);
  const path = string(candidate.path, `${subject}.path`);
  if (isAbsolute(path) || path.split(/[\\/]+/).includes('..')) {
    throw new DatasetAcquisitionError(`${subject}.path must be a safe relative path`);
  }
  if (!Number.isSafeInteger(candidate.bytes) || (candidate.bytes as number) < 0) {
    throw new DatasetAcquisitionError(`${subject}.bytes must be a non-negative safe integer`);
  }
  return { path, sha256: sha256(candidate.sha256, `${subject}.sha256`), bytes: candidate.bytes as number };
}

function provenance(value: unknown, key: DatasetKey): ExternalDatasetProvenance {
  const candidate = record(value, 'acquisition.provenance');
  let canonical: ExternalDatasetProvenance;
  try {
    canonical = createDatasetProvenance(
      key,
      string(candidate.revision, 'acquisition.provenance.revision'),
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new DatasetAcquisitionError(`acquisition.provenance.revision is not immutable: ${detail}`);
  }
  if (candidate.dataset !== canonical.dataset ||
    candidate.sourceUrl !== canonical.sourceUrl ||
    candidate.license !== canonical.license ||
    candidate.redistribution !== canonical.redistribution) {
    throw new DatasetAcquisitionError('acquisition provenance must match the dataset registry');
  }
  return canonical;
}

/** Parse an acquisition receipt without reading or downloading its artifacts. */
export function parseDatasetAcquisitionRecord(value: unknown): DatasetAcquisitionRecord {
  const candidate = record(value, 'acquisition');
  if (candidate.version !== 1) throw new DatasetAcquisitionError('acquisition.version must be 1');
  if (typeof candidate.key !== 'string' || !(candidate.key in DATASET_REGISTRY)) {
    throw new DatasetAcquisitionError('acquisition.key must name a registered dataset');
  }
  const key = candidate.key as DatasetKey;
  const retrievedAt = string(candidate.retrievedAt, 'acquisition.retrievedAt');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(retrievedAt) || !Number.isFinite(Date.parse(retrievedAt))) {
    throw new DatasetAcquisitionError('acquisition.retrievedAt must be an RFC 3339 UTC timestamp');
  }
  if (!Array.isArray(candidate.artifacts)) throw new DatasetAcquisitionError('acquisition.artifacts must be an array');
  const artifacts = candidate.artifacts.map((entry, index) => artifact(entry, `acquisition.artifacts[${index}]`));
  const artifactPaths = new Set<string>();
  for (const item of artifacts) {
    if (artifactPaths.has(item.path)) throw new DatasetAcquisitionError(`duplicate acquisition artifact path: ${item.path}`);
    artifactPaths.add(item.path);
  }
  const status = candidate.status;
  if (status !== 'available' && status !== 'metadata-only' && status !== 'blocked') {
    throw new DatasetAcquisitionError('acquisition.status must be available, metadata-only, or blocked');
  }
  if (status === 'available' && artifacts.length === 0) {
    throw new DatasetAcquisitionError('available acquisition must record at least one artifact');
  }
  if (status !== 'available' && artifacts.length !== 0) {
    throw new DatasetAcquisitionError(`${status} acquisition cannot claim downloaded artifacts`);
  }
  const base = {
    version: 1 as const,
    key,
    provenance: provenance(candidate.provenance, key),
    retrievedAt,
    normalizerVersion: string(candidate.normalizerVersion, 'acquisition.normalizerVersion'),
    artifacts,
  };
  if (status === 'blocked') {
    return { ...base, status, blockedReason: string(candidate.blockedReason, 'acquisition.blockedReason') };
  }
  if (candidate.blockedReason !== undefined) {
    throw new DatasetAcquisitionError(`${status} acquisition must not include blockedReason`);
  }
  return { ...base, status };
}

/** Verify every recorded artifact below an operator-selected external cache. */
export function verifyDatasetAcquisitionArtifacts(
  recordValue: unknown,
  cacheRoot: string,
): DatasetAcquisitionRecord {
  const acquisition = parseDatasetAcquisitionRecord(recordValue);
  if (acquisition.status !== 'available') return acquisition;
  const root = resolve(cacheRoot);
  for (const artifactRecord of acquisition.artifacts) {
    const artifactPath = resolve(root, artifactRecord.path);
    if (artifactPath !== root && !artifactPath.startsWith(`${root}${sep}`)) {
      throw new DatasetAcquisitionError(`artifact ${artifactRecord.path} escapes the external cache root`);
    }
    let bytes: Buffer;
    try {
      bytes = readFileSync(artifactPath);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new DatasetAcquisitionError(`artifact ${artifactRecord.path} is unavailable: ${detail}`);
    }
    if (bytes.byteLength !== artifactRecord.bytes) {
      throw new DatasetAcquisitionError(`artifact ${artifactRecord.path} byte length does not match its receipt`);
    }
    const actual = createHash('sha256').update(bytes).digest('hex');
    if (actual !== artifactRecord.sha256) {
      throw new DatasetAcquisitionError(`artifact ${artifactRecord.path} SHA-256 does not match its receipt`);
    }
  }
  return acquisition;
}
