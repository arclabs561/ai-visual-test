/**
 * Strict adapter for rows emitted by the pinned `tencent/DiffSpot` HF split.
 *
 * No downloading happens here. The caller supplies a revision-pinned shared
 * provenance record; this module only validates and normalizes the actual
 * dataset-server row shape. DiffSpot does not expose a stable source-page ID,
 * so `groupId` is necessarily its row ID. This prevents duplicate rows in a
 * sample but cannot prove that source-page variants are disjoint.
 */

import { createDatasetProvenance, type ExternalDatasetProvenance, type RedistributionPolicy } from './registry.js';

export const DIFFSPOT_DATASET = 'tencent/DiffSpot';
export const DIFFSPOT_LICENSE = 'MIT';
export const DIFFSPOT_GROUPING_NOTE =
  'DiffSpot supplies no stable source-page field; groupId equals id and source-page leakage cannot be prevented.';

export const DIFFSPOT_DIFFICULTIES = ['easy', 'medium', 'hard', 'no_diff'] as const;
export type DiffSpotDifficulty = typeof DIFFSPOT_DIFFICULTIES[number];
export type DiffSpotTaskType = 'visual_diff' | 'no_diff';

export interface DiffSpotMutationDetail {
  type: string;
  property: string;
  /** DiffSpot calls this `direction`; retain it as the closest operator-like signal. */
  direction: string;
  element: string;
  oldValue: string;
  newValue: string;
  template: string;
}

export interface DiffSpotBoundingBox { x: number; y: number; width: number; height: number; }

export interface DiffSpotGroundTruth {
  description: string;
  mutations: Array<{ text: string; mutationType: string; detail: DiffSpotMutationDetail }>;
  pixelDiff: number;
  targetDiff: number;
  outsideDiff: number;
  /** `null` represents DiffSpot's all--1 unavailable-bbox sentinel. */
  targetBbox: DiffSpotBoundingBox | null;
}

export interface DiffSpotRegressionExample {
  track: 'regression';
  id: string;
  groupId: string;
  before: unknown;
  after: unknown;
  taskType: DiffSpotTaskType;
  difficulty: DiffSpotDifficulty;
  domain: string;
  userQuery: string;
  groundTruth: DiffSpotGroundTruth;
  provenance: ExternalDatasetProvenance;
}

export class DiffSpotSchemaError extends Error {
  constructor(message: string) { super(message); this.name = 'DiffSpotSchemaError'; }
}

function object(value: unknown, subject: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new DiffSpotSchemaError(`${subject} must be an object`);
  return value as Record<string, unknown>;
}

function exactObject(value: unknown, subject: string, fields: readonly string[]): Record<string, unknown> {
  const candidate = object(value, subject);
  const expected = new Set(fields);
  const unknown = Object.keys(candidate).filter(key => !expected.has(key));
  const missing = fields.filter(key => !(key in candidate));
  if (unknown.length > 0) throw new DiffSpotSchemaError(`${subject} has unknown fields: ${unknown.join(', ')}`);
  if (missing.length > 0) throw new DiffSpotSchemaError(`${subject} is missing fields: ${missing.join(', ')}`);
  return candidate;
}

function nonEmptyString(value: unknown, subject: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new DiffSpotSchemaError(`${subject} must be a non-empty string`);
  return value;
}

function finiteNumber(value: unknown, subject: string, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum) throw new DiffSpotSchemaError(`${subject} must be a finite number >= ${minimum}`);
  return value;
}

function arrayOfStrings(value: unknown, subject: string): string[] {
  if (!Array.isArray(value)) throw new DiffSpotSchemaError(`${subject} must be an array`);
  return value.map((entry, index) => nonEmptyString(entry, `${subject}[${index}]`));
}

function rawImage(value: unknown, subject: string): unknown {
  if (value === null || value === undefined) throw new DiffSpotSchemaError(`${subject} must be present`);
  return value;
}

function mutationDetail(value: string, subject: string): DiffSpotMutationDetail {
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new DiffSpotSchemaError(`${subject} must be valid JSON`); }
  const detail = exactObject(parsed, subject, ['type', 'element', 'property', 'direction', 'old_value', 'new_value', 'template']);
  const optionalString = (field: string) => {
    if (typeof detail[field] !== 'string') throw new DiffSpotSchemaError(`${subject}.${field} must be a string`);
    return detail[field] as string;
  };
  return {
    type: nonEmptyString(detail.type, `${subject}.type`),
    element: nonEmptyString(detail.element, `${subject}.element`),
    property: nonEmptyString(detail.property, `${subject}.property`),
    direction: optionalString('direction'),
    oldValue: optionalString('old_value'),
    newValue: optionalString('new_value'),
    template: nonEmptyString(detail.template, `${subject}.template`),
  };
}

function targetBbox(row: Record<string, unknown>): DiffSpotBoundingBox | null {
  const values = [row.target_bbox_x, row.target_bbox_y, row.target_bbox_w, row.target_bbox_h];
  if (values.every(value => value === -1)) return null;
  if (values.some(value => value === -1)) throw new DiffSpotSchemaError('DiffSpot row target bbox must be all -1 or a complete non-negative rectangle');
  const names = ['x', 'y', 'w', 'h'];
  const parsed = values.map((value, index) => finiteNumber(value, `DiffSpot row.target_bbox_${names[index]}`, index < 2 ? 0 : Number.MIN_VALUE));
  return { x: parsed[0]!, y: parsed[1]!, width: parsed[2]!, height: parsed[3]! };
}

/** Validates the common provenance record while requiring a pinned DiffSpot revision. */
export function validateDiffSpotProvenance(value: unknown): ExternalDatasetProvenance {
  const source = exactObject(value, 'DiffSpot provenance', ['dataset', 'sourceUrl', 'revision', 'license', 'redistribution']);
  const provided: ExternalDatasetProvenance = {
    dataset: nonEmptyString(source.dataset, 'DiffSpot provenance.dataset'),
    sourceUrl: nonEmptyString(source.sourceUrl, 'DiffSpot provenance.sourceUrl'),
    revision: nonEmptyString(source.revision, 'DiffSpot provenance.revision'),
    license: nonEmptyString(source.license, 'DiffSpot provenance.license'),
    redistribution: source.redistribution as RedistributionPolicy,
  };
  if (source.redistribution !== 'allowed' && source.redistribution !== 'external-only' && source.redistribution !== 'unknown') {
    throw new DiffSpotSchemaError('DiffSpot provenance.redistribution must be allowed, external-only, or unknown');
  }
  let canonical: ExternalDatasetProvenance;
  try {
    canonical = createDatasetProvenance('diffspot', provided.revision);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new DiffSpotSchemaError(`DiffSpot provenance revision is not canonical: ${detail}`);
  }
  for (const field of ['dataset', 'sourceUrl', 'revision', 'license', 'redistribution'] as const) {
    if (provided[field] !== canonical[field]) {
      throw new DiffSpotSchemaError(`DiffSpot provenance.${field} must match the canonical dataset registry`);
    }
  }
  return canonical;
}

/** Normalize one actual DiffSpot HF row; image objects are returned unchanged. */
export function normalizeDiffSpotRow(value: unknown, provenance: ExternalDatasetProvenance): DiffSpotRegressionExample {
  const row = exactObject(value, 'DiffSpot row', [
    'id', 'image_before', 'image_after', 'user_query', 'ground_truth_diff',
    'mutations_text', 'mutation_types', 'mutation_dicts_json', 'task_type', 'difficulty', 'domain',
    'pixel_diff', 'target_diff', 'outside_diff', 'target_bbox_x', 'target_bbox_y', 'target_bbox_w', 'target_bbox_h',
  ]);
  if (row.task_type !== 'visual_diff' && row.task_type !== 'no_diff') {
    throw new DiffSpotSchemaError('DiffSpot row.task_type must be visual_diff or no_diff');
  }
  const taskType = row.task_type;
  if (typeof row.difficulty !== 'string' || !DIFFSPOT_DIFFICULTIES.includes(row.difficulty as DiffSpotDifficulty)) {
    throw new DiffSpotSchemaError(`DiffSpot row.difficulty must be one of ${DIFFSPOT_DIFFICULTIES.join(', ')}`);
  }
  const difficulty = row.difficulty as DiffSpotDifficulty;
  if ((taskType === 'no_diff') !== (difficulty === 'no_diff')) {
    throw new DiffSpotSchemaError('DiffSpot no_diff rows must use difficulty no_diff, and visual_diff rows must not');
  }
  const mutationTexts = arrayOfStrings(row.mutations_text, 'DiffSpot row.mutations_text');
  const mutationTypes = arrayOfStrings(row.mutation_types, 'DiffSpot row.mutation_types');
  const mutationJson = arrayOfStrings(row.mutation_dicts_json, 'DiffSpot row.mutation_dicts_json');
  if (mutationTexts.length !== mutationTypes.length || mutationTexts.length !== mutationJson.length) {
    throw new DiffSpotSchemaError('DiffSpot mutation arrays must have equal lengths');
  }
  const pixelDiff = finiteNumber(row.pixel_diff, 'DiffSpot row.pixel_diff');
  const targetDiff = finiteNumber(row.target_diff, 'DiffSpot row.target_diff');
  const outsideDiff = finiteNumber(row.outside_diff, 'DiffSpot row.outside_diff');
  const bbox = targetBbox(row);
  if (taskType === 'no_diff') {
    if (mutationTexts.length !== 0 || pixelDiff !== 0 || outsideDiff !== 0) {
      throw new DiffSpotSchemaError('DiffSpot no_diff rows require empty mutations plus zero pixel_diff and outside_diff');
    }
  } else if (mutationTexts.length === 0 || pixelDiff <= 0 || targetDiff <= 0) {
    throw new DiffSpotSchemaError('DiffSpot visual_diff rows require mutations plus positive pixel_diff and target_diff');
  }
  const id = nonEmptyString(row.id, 'DiffSpot row.id');
  return {
    track: 'regression', id, groupId: id,
    before: rawImage(row.image_before, 'DiffSpot row.image_before'),
    after: rawImage(row.image_after, 'DiffSpot row.image_after'),
    taskType, difficulty,
    domain: nonEmptyString(row.domain, 'DiffSpot row.domain'),
    userQuery: nonEmptyString(row.user_query, 'DiffSpot row.user_query'),
    groundTruth: {
      description: nonEmptyString(row.ground_truth_diff, 'DiffSpot row.ground_truth_diff'),
      mutations: mutationTexts.map((text, index) => ({ text, mutationType: mutationTypes[index]!, detail: mutationDetail(mutationJson[index]!, `DiffSpot row.mutation_dicts_json[${index}]`) })),
      pixelDiff, targetDiff, outsideDiff, targetBbox: bbox,
    },
    provenance: validateDiffSpotProvenance(provenance),
  };
}

/** Normalize a single externally pinned DiffSpot revision and reject duplicate IDs. */
export function normalizeDiffSpotRows(values: unknown, provenance: ExternalDatasetProvenance): DiffSpotRegressionExample[] {
  if (!Array.isArray(values)) throw new DiffSpotSchemaError('DiffSpot rows must be an array');
  const ids = new Set<string>();
  return values.map(value => {
    const normalized = normalizeDiffSpotRow(value, provenance);
    if (ids.has(normalized.id)) throw new DiffSpotSchemaError(`DiffSpot rows contain duplicate id: ${normalized.id}`);
    ids.add(normalized.id);
    return normalized;
  });
}

export interface DiffSpotSelectionOptions { limit: number; seed?: string; }

function stableRank(seed: string, id: string): number {
  let hash = 2166136261;
  for (const character of `${seed}\u0000${id}`) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}

/**
 * Deterministically balance task type, difficulty, and mutation type. Because
 * upstream has no source-page identity, this only deduplicates row IDs; it
 * must not be described as source-group-safe selection.
 */
export function selectDiffSpotExamples(rows: readonly DiffSpotRegressionExample[], { limit, seed = 'diffspot-v1' }: DiffSpotSelectionOptions): DiffSpotRegressionExample[] {
  if (!Number.isSafeInteger(limit) || limit < 0) throw new DiffSpotSchemaError('DiffSpot selection limit must be a non-negative safe integer');
  const ids = new Set<string>();
  for (const row of rows) {
    if (ids.has(row.id)) throw new DiffSpotSchemaError(`DiffSpot selection received duplicate id: ${row.id}`);
    ids.add(row.id);
  }
  const candidates = [...rows].sort((a, b) => stableRank(seed, a.id) - stableRank(seed, b.id) || a.id.localeCompare(b.id));
  const selected: DiffSpotRegressionExample[] = [];
  const taskTypes = new Map<DiffSpotTaskType, number>();
  const difficulties = new Map<DiffSpotDifficulty, number>();
  const mutationTypes = new Map<string, number>();
  while (selected.length < limit && candidates.length > 0) {
    candidates.sort((a, b) => {
      const aMutation = a.groundTruth.mutations[0]?.mutationType ?? 'no_diff';
      const bMutation = b.groundTruth.mutations[0]?.mutationType ?? 'no_diff';
      return (taskTypes.get(a.taskType) ?? 0) - (taskTypes.get(b.taskType) ?? 0)
        || (difficulties.get(a.difficulty) ?? 0) - (difficulties.get(b.difficulty) ?? 0)
        || (mutationTypes.get(aMutation) ?? 0) - (mutationTypes.get(bMutation) ?? 0)
        || stableRank(seed, a.id) - stableRank(seed, b.id) || a.id.localeCompare(b.id);
    });
    const next = candidates.shift();
    if (!next) break;
    const mutation = next.groundTruth.mutations[0]?.mutationType ?? 'no_diff';
    selected.push(next);
    taskTypes.set(next.taskType, (taskTypes.get(next.taskType) ?? 0) + 1);
    difficulties.set(next.difficulty, (difficulties.get(next.difficulty) ?? 0) + 1);
    mutationTypes.set(mutation, (mutationTypes.get(mutation) ?? 0) + 1);
  }
  return selected;
}
