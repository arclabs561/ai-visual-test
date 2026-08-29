/**
 * Offline adapters for the Datapoint AI Vibe pairwise datasets.
 *
 * These functions deliberately accept rows that a caller has already
 * downloaded. They do not fetch images, resolve URLs, or otherwise perform
 * network I/O. Keep the supplied revision with every normalized example so a
 * result can always be traced back to the immutable input snapshot.
 */

import { createHash } from 'node:crypto';

import { createDatasetProvenance, type ExternalDatasetProvenance } from './registry.js';

export type VibeDatasetName = 'vibe-landing-page-arena' | 'vibe-design-arena';
export type PreferenceWinner = 'A' | 'B' | 'tie';
export type PreferenceMarginBand = 'tie' | 'close' | 'moderate' | 'decisive';

export interface VibeLandingPageArenaRow {
  image_a: unknown;
  image_b: unknown;
  tool_a: string;
  tool_b: string;
  prompt_id: number;
  prompt?: string;
  dimension: string;
  votes_a: number;
  votes_b: number;
  winner: 'A' | 'B' | 'tie';
}

export interface VibeDesignArenaRow {
  image_a: unknown;
  image_b: unknown;
  app_a: string;
  app_b: string;
  votes_a: number;
  votes_b: number;
  winner: 'app_a' | 'app_b' | 'A' | 'B' | 'tie';
}

export interface VibePreferenceExample {
  track: 'preference';
  id: string;
  /** Record-family identity only; do not use pair IDs as a leakage-safe split key. */
  groupId: string;
  /** Source identities for a future group-safe split; this adapter does not split records. */
  sourceGroups: string[];
  imageA: unknown;
  imageB: unknown;
  votes: { A: number; B: number; tie?: number };
  winner: PreferenceWinner;
  dimension?: string;
  prompt?: string;
  provenance: ExternalDatasetProvenance;
}

export interface VibeSelectionOptions {
  limit: number;
  seed?: string;
}

export class VibeDatasetAdapterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VibeDatasetAdapterError';
  }
}

type Row = Record<string, unknown>;

function record(value: unknown, subject: string): Row {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new VibeDatasetAdapterError(`${subject} must be an object`);
  }
  return value as Row;
}

function nonEmptyString(value: unknown, subject: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new VibeDatasetAdapterError(`${subject} must be a non-empty string`);
  }
  return value;
}

function positiveInteger(value: unknown, subject: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new VibeDatasetAdapterError(`${subject} must be a non-negative safe integer`);
  }
  return value as number;
}

function image(value: unknown, subject: string): unknown {
  if (value === null || value === undefined) {
    throw new VibeDatasetAdapterError(`${subject} is missing`);
  }
  if (typeof value !== 'string' && (typeof value !== 'object' || Array.isArray(value))) {
    throw new VibeDatasetAdapterError(`${subject} must retain an image value`);
  }
  return value;
}

function provenance(value: unknown, expectedDataset: VibeDatasetName): ExternalDatasetProvenance {
  const candidate = record(value, 'provenance');
  const revision = nonEmptyString(candidate.revision, 'provenance.revision');
  let canonical: ExternalDatasetProvenance;
  try {
    canonical = createDatasetProvenance(expectedDataset, revision);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new VibeDatasetAdapterError(`provenance.revision is not an immutable dataset revision: ${detail}`);
  }
  for (const field of ['dataset', 'sourceUrl', 'license', 'redistribution'] as const) {
    if (candidate[field] !== canonical[field]) {
      throw new VibeDatasetAdapterError(`provenance.${field} must match the canonical ${expectedDataset} registry record`);
    }
  }
  return canonical;
}

function votesAndWinner(
  row: Row,
  winnerValue: unknown,
  winnerMap: Readonly<Record<string, PreferenceWinner>>,
): Pick<VibePreferenceExample, 'votes' | 'winner'> {
  const A = positiveInteger(row.votes_a, 'row.votes_a');
  const B = positiveInteger(row.votes_b, 'row.votes_b');
  const tie = row.votes_tie === undefined ? undefined : positiveInteger(row.votes_tie, 'row.votes_tie');
  if (A + B + (tie ?? 0) === 0) throw new VibeDatasetAdapterError('row must contain at least one human vote');
  if (typeof winnerValue !== 'string' || !(winnerValue in winnerMap)) {
    throw new VibeDatasetAdapterError('row.winner is not a recognized dataset label');
  }
  const winner = winnerMap[winnerValue]!;
  const voteWinner: PreferenceWinner = A === B ? 'tie' : A > B ? 'A' : 'B';
  if (winner !== voteWinner) {
    throw new VibeDatasetAdapterError('row.winner contradicts the recorded vote counts');
  }
  return { votes: tie === undefined ? { A, B } : { A, B, tie }, winner };
}

function requiredRow(value: unknown): Row {
  return record(value, 'row');
}

/** Normalize one downloaded `comparisons` row from Vibe Landing Page Arena. */
export function normalizeVibeLandingPageArenaRow(
  value: unknown,
  inputProvenance: ExternalDatasetProvenance,
): VibePreferenceExample {
  const row = requiredRow(value);
  const source = provenance(inputProvenance, 'vibe-landing-page-arena');
  const promptId = positiveInteger(row.prompt_id, 'row.prompt_id');
  const toolA = nonEmptyString(row.tool_a, 'row.tool_a');
  const toolB = nonEmptyString(row.tool_b, 'row.tool_b');
  const dimension = nonEmptyString(row.dimension, 'row.dimension');
  if (toolA === toolB) throw new VibeDatasetAdapterError('row must compare two distinct tools');
  const prompt = row.prompt === undefined ? undefined : nonEmptyString(row.prompt, 'row.prompt');
  const output: VibePreferenceExample = {
    track: 'preference',
    id: `vibe-landing-page-arena:${promptId}:${dimension}:${toolA}:${toolB}`,
    groupId: `vibe-landing-page-arena:prompt:${promptId}`,
    sourceGroups: [`prompt:${promptId}`],
    imageA: image(row.image_a, 'row.image_a'),
    imageB: image(row.image_b, 'row.image_b'),
    ...votesAndWinner(row, row.winner, { A: 'A', B: 'B', tie: 'tie' }),
    dimension,
    provenance: source,
  };
  if (prompt !== undefined) output.prompt = prompt;
  return output;
}

/** Normalize one downloaded `comparisons` row from Vibe Design Arena. */
export function normalizeVibeDesignArenaRow(
  value: unknown,
  inputProvenance: ExternalDatasetProvenance,
): VibePreferenceExample {
  const row = requiredRow(value);
  const source = provenance(inputProvenance, 'vibe-design-arena');
  const appA = nonEmptyString(row.app_a, 'row.app_a');
  const appB = nonEmptyString(row.app_b, 'row.app_b');
  if (appA === appB) throw new VibeDatasetAdapterError('row must compare two distinct apps');
  const [firstApp, secondApp] = [appA, appB].sort();
  return {
    track: 'preference',
    id: `vibe-design-arena:${appA}:${appB}`,
    groupId: `vibe-design-arena:apps:${firstApp}:${secondApp}`,
    sourceGroups: [`app:${appA}`, `app:${appB}`],
    imageA: image(row.image_a, 'row.image_a'),
    imageB: image(row.image_b, 'row.image_b'),
    ...votesAndWinner(row, row.winner, { app_a: 'A', app_b: 'B', A: 'A', B: 'B', tie: 'tie' }),
    provenance: source,
  };
}

/** Map a vote margin into a stable, inspectable sampling stratum. */
export function preferenceMarginBand(example: Pick<VibePreferenceExample, 'votes'>): PreferenceMarginBand {
  const total = example.votes.A + example.votes.B + (example.votes.tie ?? 0);
  if (!Number.isSafeInteger(total) || total <= 0) {
    throw new VibeDatasetAdapterError('example votes must contain a positive safe-integer total');
  }
  const margin = Math.abs(example.votes.A - example.votes.B) / total;
  if (margin === 0) return 'tie';
  if (margin <= 0.2) return 'close';
  if (margin <= 0.5) return 'moderate';
  return 'decisive';
}

function stableRank(seed: string, id: string): string {
  return createHash('sha256').update(`${seed}\u0000${id}`).digest('hex');
}

function exampleStratum(example: VibePreferenceExample): string {
  return `${example.dimension ?? 'overall'}\u0000${preferenceMarginBand(example)}`;
}

/**
 * Select a reproducible, round-robin sample across dimension × vote-margin
 * strata. The input is never mutated, and duplicate IDs are rejected rather
 * than silently collapsing evidence from separate rows.
 */
export function selectStratifiedVibeExamples(
  examples: readonly VibePreferenceExample[],
  options: VibeSelectionOptions,
): VibePreferenceExample[] {
  if (!Number.isSafeInteger(options.limit) || options.limit < 0) {
    throw new VibeDatasetAdapterError('options.limit must be a non-negative safe integer');
  }
  const seed = options.seed ?? 'ai-visual-test-vibe-v1';
  if (typeof seed !== 'string' || seed.length === 0) {
    throw new VibeDatasetAdapterError('options.seed must be a non-empty string when provided');
  }
  const ids = new Set<string>();
  const strata = new Map<string, VibePreferenceExample[]>();
  for (const example of examples) {
    if (ids.has(example.id)) throw new VibeDatasetAdapterError(`examples contain duplicate id: ${example.id}`);
    ids.add(example.id);
    const key = exampleStratum(example);
    const entries = strata.get(key) ?? [];
    entries.push(example);
    strata.set(key, entries);
  }
  const buckets = [...strata.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, entries]) => [...entries].sort((a, b) => {
      const rank = stableRank(seed, a.id).localeCompare(stableRank(seed, b.id));
      return rank === 0 ? a.id.localeCompare(b.id) : rank;
    }));
  const selected: VibePreferenceExample[] = [];
  let offset = 0;
  while (selected.length < options.limit) {
    let selectedThisRound = false;
    for (const bucket of buckets) {
      const candidate = bucket[offset];
      if (candidate === undefined) continue;
      selected.push(candidate);
      selectedThisRound = true;
      if (selected.length === options.limit) return selected;
    }
    if (!selectedThisRound) return selected;
    offset += 1;
  }
  return selected;
}
