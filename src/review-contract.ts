/**
 * Canonical provider-output contracts.
 *
 * Providers may enforce these schemas natively or return legacy text. Both
 * paths terminate here so downstream code never has to guess at response
 * shape.
 */

import Type, { type Static } from 'typebox';
import * as Value from 'typebox/value';
import {
  StructuredTaskContractError,
  type StructuredTaskDefinition,
  type StructuredTaskParseResult,
} from '#structured-task';

const StringList = Type.Array(Type.String());

export const SCALAR_REVIEW_SCHEMA = Type.Object({
  kind: Type.Literal('scalar'),
  score: Type.Number({ minimum: 0, maximum: 10 }),
  assessment: Type.String(),
  reasoning: Type.String(),
  issues: StringList,
  recommendations: StringList,
  strengths: StringList
}, { additionalProperties: false });

export const COMPARISON_REVIEW_SCHEMA = Type.Object({
  kind: Type.Literal('comparison'),
  winner: Type.Union([
    Type.Literal('A'),
    Type.Literal('B'),
    Type.Literal('tie'),
    Type.Literal('indeterminate')
  ]),
  confidence: Type.Number({ minimum: 0, maximum: 1 }),
  reasoning: Type.String(),
  differences: StringList,
  scores: Type.Object({
    A: Type.Number({ minimum: 0, maximum: 10 }),
    B: Type.Number({ minimum: 0, maximum: 10 })
  }, { additionalProperties: false })
}, { additionalProperties: false });

export type ScalarReviewOutcome = Static<typeof SCALAR_REVIEW_SCHEMA>;
export type ComparisonReviewOutcome = Static<typeof COMPARISON_REVIEW_SCHEMA>;
export type ReviewOutcome = ScalarReviewOutcome | ComparisonReviewOutcome;
export type ReviewMode = 'scalar' | 'comparison';

export class ReviewContractError extends StructuredTaskContractError {
  constructor(diagnostics: string[]) {
    super(`Provider output did not satisfy the review contract: ${diagnostics.join(', ')}`, diagnostics);
    this.name = 'ReviewContractError';
  }
}

export function getReviewSchema(mode: ReviewMode = 'scalar') {
  return mode === 'comparison' ? COMPARISON_REVIEW_SCHEMA : SCALAR_REVIEW_SCHEMA;
}

function recordFrom(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object'
    ? value as Record<string, unknown>
    : {};
}

function errorPaths(schema: typeof SCALAR_REVIEW_SCHEMA | typeof COMPARISON_REVIEW_SCHEMA, value: unknown): Set<string> {
  if (Value.Check(schema, value)) return new Set();
  return new Set(Value.Errors(schema, value).map(error => error.instancePath));
}

function hasPath(paths: Set<string>, field: string): boolean {
  return [...paths].some(path => path === `/${field}` || path.startsWith(`/${field}/`));
}

function scalarCandidate(value: unknown) {
  const record = recordFrom(value);
  // The historical parser normalizes the discriminator and ignores unknown
  // fields. Keep that tolerant boundary while TypeBox owns field validation.
  return {
    kind: 'scalar' as const,
    score: record.score,
    assessment: record.assessment,
    reasoning: record.reasoning,
    issues: record.issues,
    recommendations: record.recommendations,
    strengths: record.strengths
  };
}

function comparisonCandidate(value: unknown) {
  const record = recordFrom(value);
  return {
    kind: 'comparison' as const,
    winner: record.winner,
    confidence: record.confidence,
    reasoning: record.reasoning,
    differences: record.differences,
    scores: record.scores
  };
}

function validateScalar(value: unknown): ScalarReviewOutcome {
  const candidate = scalarCandidate(value);
  const paths = errorPaths(SCALAR_REVIEW_SCHEMA, candidate);
  const diagnostics: string[] = [];
  if (hasPath(paths, 'score')) diagnostics.push('invalid_score');
  if (hasPath(paths, 'assessment')) diagnostics.push('missing_assessment');
  if (hasPath(paths, 'reasoning')) diagnostics.push('missing_reasoning');
  for (const field of ['issues', 'recommendations', 'strengths']) {
    if (hasPath(paths, field)) diagnostics.push(`invalid_${field}`);
  }
  if (diagnostics.length) throw new ReviewContractError(diagnostics);
  return candidate as ScalarReviewOutcome;
}

function validateComparison(value: unknown): ComparisonReviewOutcome {
  const candidate = comparisonCandidate(value);
  const paths = errorPaths(COMPARISON_REVIEW_SCHEMA, candidate);
  const diagnostics: string[] = [];
  if (hasPath(paths, 'winner')) diagnostics.push('invalid_winner');
  if (hasPath(paths, 'confidence')) diagnostics.push('invalid_confidence');
  if (hasPath(paths, 'reasoning')) diagnostics.push('missing_reasoning');
  if (hasPath(paths, 'differences')) diagnostics.push('invalid_differences');
  if (hasPath(paths, 'scores')) diagnostics.push('invalid_scores');
  if (diagnostics.length) throw new ReviewContractError(diagnostics);
  return candidate as ComparisonReviewOutcome;
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const unfenced = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(unfenced) as unknown;
  } catch {
    const start = unfenced.indexOf('{');
    const end = unfenced.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(unfenced.slice(start, end + 1)) as unknown;
    } catch {
      return null;
    }
  }
}

type LegacySection = 'issues' | 'recommendations' | 'strengths' | 'differences' | 'reasoning';

const SECTION_NAMES: ReadonlyMap<string, LegacySection> = new Map([
  ['issues', 'issues'], ['findings', 'issues'], ['problems', 'issues'],
  ['recommendations', 'recommendations'], ['suggestions', 'recommendations'],
  ['strengths', 'strengths'], ['positives', 'strengths'],
  ['differences', 'differences'],
  ['reasoning', 'reasoning'], ['rationale', 'reasoning']
]);

function cleanHeading(line: string): string {
  return line
    .replace(/^\s{0,3}#{1,6}\s*/, '')
    .replace(/^\s*\*\*(.+)\*\*\s*:?[\s]*$/, '$1')
    .replace(/:\s*$/, '')
    .trim()
    .toLowerCase();
}

function cleanListItem(line: string): string | null {
  const match = line.match(/^\s*(?:[-*+]\s+|\d+[.)]\s+)(.+?)\s*$/);
  if (!match) return null;
  return match[1]!.replace(/^\*\*(.+?):?\*\*\s*:?[\s]*/, '$1: ').trim();
}

function parseLegacyScalar(text: string): ScalarReviewOutcome {
  const lists = { issues: [] as string[], recommendations: [] as string[], strengths: [] as string[] };
  let section: LegacySection | null = null;
  let assessment: string | null = null;
  const reasoning: string[] = [];

  for (const line of text.split(/\r?\n/)) {
    const heading = cleanHeading(line);
    if (SECTION_NAMES.has(heading)) {
      section = SECTION_NAMES.get(heading) ?? null;
      continue;
    }
    const field = line.match(/^\s*(?:\*\*)?(assessment|verdict)(?:\*\*)?\s*:\s*(.+?)\s*$/i);
    if (field) {
      assessment = field[2]!.trim();
      section = null;
      continue;
    }
    const item = cleanListItem(line);
    if (item && (section === 'issues' || section === 'recommendations' || section === 'strengths')) {
      lists[section].push(item);
      continue;
    }
    if (section === 'reasoning' && line.trim()) reasoning.push(line.trim());
  }

  const scoreMatch = text.match(/(?:overall\s+)?score\s*:?\s*(\d+(?:\.\d+)?)\s*(?:\/\s*10)?/i)
    || text.match(/^\s*(\d+(?:\.\d+)?)\s*\/\s*10\s*$/m);
  const parsedScore = scoreMatch ? Number(scoreMatch[1]) : null;
  if (!Number.isFinite(parsedScore) || parsedScore === null || parsedScore < 0 || parsedScore > 10) {
    throw new ReviewContractError(['invalid_json', 'invalid_score']);
  }
  const score = parsedScore;

  if (!assessment) {
    const verdict = text.match(/(?:final\s+)?verdict\s*:?\s*(pass|fail|needs[- ]improvement)/i);
    assessment = verdict?.[1] || (score >= 7 ? 'pass' : 'needs-improvement');
  }

  return {
    kind: 'scalar',
    score,
    assessment,
    reasoning: reasoning.join(' ') || text.trim().slice(0, 500),
    issues: lists.issues,
    recommendations: lists.recommendations,
    strengths: lists.strengths
  };
}

/**
 * Parse and validate a provider result. Legacy text is accepted only for
 * scalar reviews; pairwise results require an unambiguous structured object.
 */
export function parseReviewOutcome(
  input: unknown,
  { mode = 'scalar', allowLegacy = true }: { mode?: ReviewMode; allowLegacy?: boolean } = {}
): { outcome: ReviewOutcome; format: 'structured' | 'legacy-text'; diagnostics: string[] } {
  const value = typeof input === 'string' ? extractJson(input) : input;
  try {
    const outcome = mode === 'comparison' ? validateComparison(value) : validateScalar(value);
    return { outcome, format: 'structured', diagnostics: [] };
  } catch (error) {
    if (mode === 'scalar' && allowLegacy && typeof input === 'string') {
      const outcome = parseLegacyScalar(input);
      return { outcome, format: 'legacy-text', diagnostics: ['structured_output_invalid'] };
    }
    if (error instanceof ReviewContractError) throw error;
    throw new ReviewContractError(['invalid_output']);
  }
}

export function buildRepairInstruction(diagnostics: string[], mode: ReviewMode = 'scalar'): string {
  const unique = [...new Set(diagnostics)].slice(0, 8);
  return [
    'Your previous response could not be validated.',
    `Diagnostic codes: ${unique.join(', ') || 'invalid_output'}.`,
    `Return only one JSON object matching the ${mode} review schema. Do not include markdown.`
  ].join('\n');
}

export function createReviewTask(
  mode: ReviewMode,
  allowLegacy: boolean,
): StructuredTaskDefinition<ReviewOutcome> {
  return {
    name: mode === 'comparison' ? 'visual_comparison' : 'visual_review',
    schema: getReviewSchema(mode),
    invalidOutputDescription: `${mode} review`,
    parse(input): StructuredTaskParseResult<ReviewOutcome> {
      return parseReviewOutcome(input, { mode, allowLegacy });
    },
    buildRepairInstruction(diagnostics): string {
      return buildRepairInstruction(diagnostics, mode);
    },
  };
}
