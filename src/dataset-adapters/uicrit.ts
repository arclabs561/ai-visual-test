/**
 * Offline adapter for the pinned UICrit `uicrit_public.csv` export.
 *
 * UICrit rows are annotator-level screen records, not one-comment records.
 * The CSV carries Python-list strings for comment provenance and comments.
 * This module accepts decoded CSV rows only; it never fetches UICrit or RICO
 * pixels, and therefore retains a RICO reference rather than an image path.
 */

import { createDatasetProvenance, type ExternalDatasetProvenance } from './registry.js';

export const UICRIT_TRACK = 'critique' as const;
export const UICRIT_DATASET = 'google-research-datasets/uicrit' as const;

export type UICritRatingTask =
  | 'aesthetics'
  | 'learnability'
  | 'efficiency'
  | 'usability'
  | 'design-quality';

export type UICritCommentEvidence = 'human' | 'both';

export interface NormalizedBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface UICritComment {
  task: string;
  text: string;
  evidence: UICritCommentEvidence;
  box?: NormalizedBox;
}

export interface UICritAnnotatorRecord {
  /** Stable within one adaptation; UICrit's public CSV does not expose worker IDs. */
  annotatorId: string;
  sourceRow: number;
  task: string;
  ratings: Record<UICritRatingTask, number>;
  comments: UICritComment[];
}

export interface UICritRatingAggregate {
  values: readonly [number, number, number];
  mean: number;
  min: number;
  max: number;
  range: number;
  standardDeviation: number;
}

export interface UICritScreenRecord {
  track: typeof UICRIT_TRACK;
  id: string;
  groupId: string;
  screenshotRef: { system: 'rico'; id: string };
  provenance: ExternalDatasetProvenance;
  annotators: readonly [UICritAnnotatorRecord, UICritAnnotatorRecord, UICritAnnotatorRecord];
  comments: UICritComment[];
  /** Per-dimension mean scores for generic critique metric consumers. */
  ratings: Record<UICritRatingTask, number>;
  aggregatedRatings: Record<UICritRatingTask, UICritRatingAggregate>;
  disagreement: Record<UICritRatingTask, Pick<UICritRatingAggregate, 'range' | 'standardDeviation'>>;
}

export interface RejectedUICritRow {
  row: number;
  reason: string;
}

export interface RejectedUICritScreen {
  ricoId: string;
  reason: string;
}

export interface UICritAdaptation {
  provenance: ExternalDatasetProvenance;
  records: UICritScreenRecord[];
  rejectedRows: RejectedUICritRow[];
  rejectedScreens: RejectedUICritScreen[];
}

export class UICritEvidenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UICritEvidenceError';
  }
}

type CsvRow = Readonly<Record<string, unknown>>;

interface Annotation {
  ricoId: string;
  sourceRow: number;
  task: string;
  ratings: Record<UICritRatingTask, number>;
  comments: UICritComment[];
}

const MAX_LIST_CHARACTERS = 100_000;
const MAX_LIST_ITEMS = 512;
const RATING_COLUMNS: Readonly<Record<UICritRatingTask, { column: string; maximum: number }>> = {
  aesthetics: { column: 'aesthetics_rating', maximum: 10 },
  learnability: { column: 'learnability', maximum: 5 },
  efficiency: { column: 'efficency', maximum: 5 }, // upstream spelling is intentional
  usability: { column: 'usability_rating', maximum: 10 },
  'design-quality': { column: 'design_quality_rating', maximum: 10 },
};

function fail(message: string): never {
  throw new UICritEvidenceError(message);
}

function record(value: unknown, subject: string): CsvRow {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(`${subject} must be an object`);
  return value as CsvRow;
}

function nonEmptyString(value: unknown, subject: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) fail(`${subject} must be a non-empty string`);
  return value.trim();
}

function finiteInteger(value: unknown, subject: string, maximum: number): number {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : Number.NaN;
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
    fail(`${subject} must be an integer from 1 through ${maximum}`);
  }
  return parsed;
}

/**
 * Parse a bounded Python/JSON list of quoted strings without evaluating data.
 * JSON is preferred; the fallback accepts only list syntax, quoted strings,
 * commas, whitespace, and conservative escapes.
 */
function parseStringList(value: unknown, subject: string): string[] {
  const text = nonEmptyString(value, subject);
  if (text.length > MAX_LIST_CHARACTERS) fail(`${subject} exceeds the maximum list size`);
  try {
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed) || parsed.some(item => typeof item !== 'string')) fail(`${subject} must be a list of strings`);
    if (parsed.length > MAX_LIST_ITEMS) fail(`${subject} has too many items`);
    return parsed;
  } catch (error) {
    if (error instanceof UICritEvidenceError) throw error;
  }

  let position = 0;
  const skipSpace = (): void => { while (/\s/.test(text[position] ?? '')) position += 1; };
  const next = (): string => text[position] ?? '';
  const require = (character: string): void => {
    if (next() !== character) fail(`${subject} must be a Python-style list of quoted strings`);
    position += 1;
  };
  const readEscape = (): string => {
    position += 1;
    const escaped = next();
    if (!escaped) fail(`${subject} has an incomplete escape`);
    const simple: Record<string, string> = { '\\': '\\', "'": "'", '"': '"', n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' };
    if (simple[escaped] !== undefined) {
      position += 1;
      return simple[escaped];
    }
    if (escaped === 'x' || escaped === 'u' || escaped === 'U') {
      const count = escaped === 'x' ? 2 : escaped === 'u' ? 4 : 8;
      const digits = text.slice(position + 1, position + 1 + count);
      if (!new RegExp(`^[0-9a-fA-F]{${count}}$`).test(digits)) fail(`${subject} has an invalid hexadecimal escape`);
      const codePoint = Number.parseInt(digits, 16);
      if (codePoint > 0x10ffff) fail(`${subject} has an invalid Unicode escape`);
      position += 1 + count;
      return String.fromCodePoint(codePoint);
    }
    fail(`${subject} has an unsupported escape`);
  };
  const readQuoted = (): string => {
    const quote = next();
    if (quote !== "'" && quote !== '"') fail(`${subject} list values must be quoted strings`);
    position += 1;
    let output = '';
    while (position < text.length) {
      const character = next();
      if (character === quote) {
        position += 1;
        return output;
      }
      if (character === '\\') output += readEscape();
      else {
        if (character === '\n' || character === '\r') fail(`${subject} has an unterminated string`);
        output += character;
        position += 1;
      }
    }
    fail(`${subject} has an unterminated string`);
  };

  skipSpace();
  require('[');
  skipSpace();
  const items: string[] = [];
  if (next() === ']') {
    position += 1;
    skipSpace();
    if (position !== text.length) fail(`${subject} has trailing data`);
    return items;
  }
  while (true) {
    if (items.length >= MAX_LIST_ITEMS) fail(`${subject} has too many items`);
    items.push(readQuoted());
    skipSpace();
    if (next() === ']') {
      position += 1;
      skipSpace();
      if (position !== text.length) fail(`${subject} has trailing data`);
      return items;
    }
    require(',');
    skipSpace();
  }
}

function commentEvidence(value: string): UICritCommentEvidence | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'human') return 'human';
  if (normalized === 'both') return 'both';
  return null;
}

function normalizedBoxFromComment(text: string): { text: string; box?: NormalizedBox } {
  const match = /(?:\bbbox\b|\bbounding\s*box\b)\s*[:=]?\s*[\[(]\s*(-?(?:\d+\.?\d*|\.\d+))\s*,\s*(-?(?:\d+\.?\d*|\.\d+))\s*,\s*(-?(?:\d+\.?\d*|\.\d+))\s*,\s*(-?(?:\d+\.?\d*|\.\d+))\s*[\])]/i.exec(text);
  if (!match) return { text };
  const numbers = match.slice(1).map(part => Number(part));
  if (numbers.length !== 4 || numbers.some(number => !Number.isFinite(number))) fail('comment bbox must contain four finite coordinates');
  const [left, top, right, bottom] = numbers as [number, number, number, number];
  if (left < 0 || top < 0 || right > 1 || bottom > 1 || right <= left || bottom <= top) {
    fail('comment bbox must be normalized and contained by the screen');
  }
  const withoutBox = text.replace(match[0], '').replace(/\s{2,}/g, ' ').trim();
  return {
    text: withoutBox || text.trim(),
    // Preserve the human-readable decimal scale from the CSV rather than
    // leaking a binary-subtraction tail into deterministic fixture output.
    box: {
      x: left,
      y: top,
      width: Number((right - left).toPrecision(15)),
      height: Number((bottom - top).toPrecision(15)),
    },
  };
}

function annotationFromRow(value: unknown, sourceRow: number): Annotation {
  const row = record(value, `row ${sourceRow}`);
  const ricoId = nonEmptyString(row.rico_id, `row ${sourceRow}.rico_id`);
  const task = nonEmptyString(row.task, `row ${sourceRow}.task`);
  const ratings = {} as Record<UICritRatingTask, number>;
  for (const [ratingTask, definition] of Object.entries(RATING_COLUMNS) as [UICritRatingTask, { column: string; maximum: number }][]) {
    ratings[ratingTask] = finiteInteger(row[definition.column], `row ${sourceRow}.${definition.column}`, definition.maximum);
  }
  const sources = parseStringList(row.comments_source, `row ${sourceRow}.comments_source`);
  const comments = parseStringList(row.comments, `row ${sourceRow}.comments`);
  if (sources.length !== comments.length) fail(`row ${sourceRow} comments_source and comments must have equal lengths`);
  const humanComments: UICritComment[] = [];
  sources.forEach((source, index) => {
    const evidence = commentEvidence(source);
    if (evidence === null) return;
    const comment = comments[index];
    if (comment === undefined || comment.trim().length === 0) fail(`row ${sourceRow}.comments[${index}] must be a non-empty string`);
    const boxed = normalizedBoxFromComment(comment);
    const output: UICritComment = { task, text: boxed.text, evidence };
    if (boxed.box !== undefined) output.box = boxed.box;
    humanComments.push(output);
  });
  return { ricoId, sourceRow, task, ratings, comments: humanComments };
}

function normalizeProvenance(value: ExternalDatasetProvenance): ExternalDatasetProvenance {
  if (value === null || typeof value !== 'object') fail('provenance must be an object');
  let canonical: ExternalDatasetProvenance;
  try {
    canonical = createDatasetProvenance('uicrit', nonEmptyString(value.revision, 'provenance.revision'));
  } catch (error) {
    if (error instanceof UICritEvidenceError) throw error;
    const detail = error instanceof Error ? error.message : 'invalid revision';
    fail(`UICrit provenance must use the canonical immutable registry revision: ${detail}`);
  }
  if (
    value.dataset !== canonical.dataset
    || value.sourceUrl !== canonical.sourceUrl
    || value.license !== canonical.license
    || value.redistribution !== canonical.redistribution
  ) {
    fail('UICrit provenance must exactly match the canonical registry metadata');
  }
  return canonical;
}

function aggregateRatings(annotators: readonly UICritAnnotatorRecord[]): {
  ratings: Record<UICritRatingTask, UICritRatingAggregate>;
  disagreement: Record<UICritRatingTask, Pick<UICritRatingAggregate, 'range' | 'standardDeviation'>>;
} {
  const ratings = {} as Record<UICritRatingTask, UICritRatingAggregate>;
  const disagreement = {} as Record<UICritRatingTask, Pick<UICritRatingAggregate, 'range' | 'standardDeviation'>>;
  for (const task of Object.keys(RATING_COLUMNS) as UICritRatingTask[]) {
    const values = annotators.map(annotator => annotator.ratings[task]) as [number, number, number];
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    const standardDeviation = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
    ratings[task] = { values, mean, min, max, range, standardDeviation };
    disagreement[task] = { range, standardDeviation };
  }
  return { ratings, disagreement };
}

function maybeRicoId(value: unknown): string | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const ricoId = (value as Record<string, unknown>).rico_id;
  return typeof ricoId === 'string' && ricoId.trim() ? ricoId.trim() : null;
}

/**
 * Convert exact `uicrit_public.csv` rows into human-supported critique records.
 * Bad rows and screens are retained as diagnostics; no incomplete screen is
 * emitted as evaluation evidence.
 */
export function adaptUICritRows(rows: readonly CsvRow[], provenanceInput: ExternalDatasetProvenance): UICritAdaptation {
  if (!Array.isArray(rows)) fail('UICrit rows must be an array of decoded CSV row objects');
  const provenance = normalizeProvenance(provenanceInput);
  const annotations: Annotation[] = [];
  const rejectedRows: RejectedUICritRow[] = [];
  const expectedRowsByScreen = new Map<string, number>();

  rows.forEach((row, index) => {
    const ricoId = maybeRicoId(row);
    if (ricoId !== null) expectedRowsByScreen.set(ricoId, (expectedRowsByScreen.get(ricoId) ?? 0) + 1);
    try {
      annotations.push(annotationFromRow(row, index));
    } catch (error) {
      rejectedRows.push({ row: index, reason: error instanceof Error ? error.message : 'invalid UICrit evidence' });
    }
  });

  const byScreen = new Map<string, Annotation[]>();
  for (const annotation of annotations) {
    const entries = byScreen.get(annotation.ricoId);
    if (entries) entries.push(annotation);
    else byScreen.set(annotation.ricoId, [annotation]);
  }

  const records: UICritScreenRecord[] = [];
  const rejectedScreens: RejectedUICritScreen[] = [];
  for (const ricoId of [...expectedRowsByScreen.keys()].sort((left, right) => left.localeCompare(right))) {
    const screenAnnotations = byScreen.get(ricoId) ?? [];
    if (expectedRowsByScreen.get(ricoId) !== 3 || screenAnnotations.length !== 3) {
      rejectedScreens.push({ ricoId, reason: `requires exactly three valid UICrit rows; found ${screenAnnotations.length} valid of ${expectedRowsByScreen.get(ricoId) ?? 0}` });
      continue;
    }
    const annotators = screenAnnotations
      .sort((left, right) => left.sourceRow - right.sourceRow)
      .map((annotation, index) => ({
        annotatorId: `uicrit:${ricoId}:annotator-${index + 1}`,
        sourceRow: annotation.sourceRow,
        task: annotation.task,
        ratings: annotation.ratings,
        comments: annotation.comments,
      })) as [UICritAnnotatorRecord, UICritAnnotatorRecord, UICritAnnotatorRecord];
    const aggregate = aggregateRatings(annotators);
    records.push({
      track: UICRIT_TRACK,
      id: `uicrit:${ricoId}`,
      groupId: `rico:${ricoId}`,
      screenshotRef: { system: 'rico', id: ricoId },
      provenance,
      annotators,
      comments: annotators.flatMap(annotator => annotator.comments),
      ratings: Object.fromEntries(
        Object.entries(aggregate.ratings).map(([task, aggregateRating]) => [task, aggregateRating.mean]),
      ) as Record<UICritRatingTask, number>,
      aggregatedRatings: aggregate.ratings,
      disagreement: aggregate.disagreement,
    });
  }
  return { provenance, records, rejectedRows, rejectedScreens };
}
