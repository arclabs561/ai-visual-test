/**
 * Runtime contracts for model-produced perception data.
 *
 * These contracts are intentionally separate from the sampler orchestration:
 * provider adapters can enforce the schemas natively, while older providers can
 * parse and repair their JSON at this single boundary.
 */
import Type, { type Static } from 'typebox';
import * as Value from 'typebox/value';

export const PERCEPTION_MODES = ['question', 'problem', 'insight'] as const;
export type PerceptionMode = typeof PERCEPTION_MODES[number];

const QuestionCategorySchema = Type.Union([
  Type.Literal('UI'),
  Type.Literal('INFO'),
  Type.Literal('GAP'),
  Type.Literal('CONFLICT'),
  Type.Literal('NOISE'),
]);
const ProblemCategorySchema = Type.Union([
  Type.Literal('blocker'),
  Type.Literal('major'),
  Type.Literal('minor'),
]);
const NonEmptyText = Type.String({ minLength: 1, maxLength: 2_000 });

const FindingFields = {
  headline: NonEmptyText,
  target: NonEmptyText,
  why: NonEmptyText,
  suggestion: NonEmptyText,
  confidence: Type.Number({ minimum: 0, maximum: 1 }),
} as const;

/** Provider-enforceable output schemas for each perception prompt mode. */
export const QUESTION_FINDING_SCHEMA = Type.Object({
  ...FindingFields,
  category: QuestionCategorySchema,
}, { additionalProperties: false });

export const PROBLEM_FINDING_SCHEMA = Type.Object({
  ...FindingFields,
  category: ProblemCategorySchema,
}, { additionalProperties: false });

export const INSIGHT_FINDING_SCHEMA = Type.Object({
  ...FindingFields,
  category: Type.Literal('insight'),
}, { additionalProperties: false });

/** A union is convenient for generic structured-output adapters. */
export const PERCEPTION_FINDING_SCHEMA = Type.Union([
  QUESTION_FINDING_SCHEMA,
  PROBLEM_FINDING_SCHEMA,
  INSIGHT_FINDING_SCHEMA,
]);

export type QuestionFinding = Static<typeof QUESTION_FINDING_SCHEMA>;
export type ProblemFinding = Static<typeof PROBLEM_FINDING_SCHEMA>;
export type InsightFinding = Static<typeof INSIGHT_FINDING_SCHEMA>;
export type PerceptionFinding = QuestionFinding | ProblemFinding | InsightFinding;

export const VERIFIER_VERDICT_SCHEMA = Type.Object({
  refuted: Type.Boolean(),
  reason: NonEmptyText,
}, { additionalProperties: false });
export type VerifierVerdict = Static<typeof VERIFIER_VERDICT_SCHEMA>;

export const MERGE_CLUSTERS_SCHEMA = Type.Object({
  clusters: Type.Array(Type.Array(Type.Integer({ minimum: 0 }), { minItems: 1 })),
}, { additionalProperties: false });
export type MergeClusters = Static<typeof MERGE_CLUSTERS_SCHEMA>;

export const PERCEPTION_DIAGNOSTIC_CODES = {
  invalidJson: 'invalid_json',
  invalidFinding: 'invalid_finding',
  missingHeadline: 'missing_headline',
  invalidCategory: 'invalid_category',
  missingTarget: 'missing_target',
  missingWhy: 'missing_why',
  missingSuggestion: 'missing_suggestion',
  invalidConfidence: 'invalid_confidence',
  invalidVerifierVerdict: 'invalid_verifier_verdict',
  invalidRefuted: 'invalid_refuted',
  missingReason: 'missing_reason',
  invalidMergeClusters: 'invalid_merge_clusters',
  emptyCluster: 'empty_cluster',
  invalidClusterIndex: 'invalid_cluster_index',
  duplicateClusterIndex: 'duplicate_cluster_index',
  missingClusterIndex: 'missing_cluster_index',
} as const;

export type PerceptionDiagnosticCode = typeof PERCEPTION_DIAGNOSTIC_CODES[keyof typeof PERCEPTION_DIAGNOSTIC_CODES];

/** Optional fourth argument understood by schema-capable injected providers. */
export interface PerceptionStructuredOutput {
  name: string;
  schema: object;
  strict?: boolean;
}

export class PerceptionContractError extends Error {
  readonly diagnostics: readonly PerceptionDiagnosticCode[];

  constructor(subject: string, diagnostics: PerceptionDiagnosticCode[]) {
    super(`${subject} did not satisfy the perception contract: ${diagnostics.join(', ')}`);
    this.name = 'PerceptionContractError';
    this.diagnostics = diagnostics;
  }
}

function recordFrom(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function jsonValue(input: unknown): unknown {
  if (typeof input !== 'string') return input;
  const trimmed = input.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  try {
    return JSON.parse(fenced?.[1] ?? trimmed) as unknown;
  } catch {
    throw new PerceptionContractError('Provider output', [PERCEPTION_DIAGNOSTIC_CODES.invalidJson]);
  }
}

export function schemaForPerceptionMode(mode: PerceptionMode) {
  switch (mode) {
    case 'question': return QUESTION_FINDING_SCHEMA;
    case 'problem': return PROBLEM_FINDING_SCHEMA;
    case 'insight': return INSIGHT_FINDING_SCHEMA;
  }
}

function findingDiagnostics(value: unknown): PerceptionDiagnosticCode[] {
  const record = recordFrom(value);
  if (record === null) return [PERCEPTION_DIAGNOSTIC_CODES.invalidFinding];
  const diagnostics: PerceptionDiagnosticCode[] = [];
  if (typeof record.headline !== 'string' || record.headline.trim() === '') diagnostics.push(PERCEPTION_DIAGNOSTIC_CODES.missingHeadline);
  if (typeof record.category !== 'string') diagnostics.push(PERCEPTION_DIAGNOSTIC_CODES.invalidCategory);
  if (typeof record.target !== 'string' || record.target.trim() === '') diagnostics.push(PERCEPTION_DIAGNOSTIC_CODES.missingTarget);
  if (typeof record.why !== 'string' || record.why.trim() === '') diagnostics.push(PERCEPTION_DIAGNOSTIC_CODES.missingWhy);
  if (typeof record.suggestion !== 'string' || record.suggestion.trim() === '') diagnostics.push(PERCEPTION_DIAGNOSTIC_CODES.missingSuggestion);
  if (typeof record.confidence !== 'number' || !Number.isFinite(record.confidence) || record.confidence < 0 || record.confidence > 1) diagnostics.push(PERCEPTION_DIAGNOSTIC_CODES.invalidConfidence);
  return diagnostics.length ? diagnostics : [PERCEPTION_DIAGNOSTIC_CODES.invalidFinding];
}

/** Parse a model finding against the category vocabulary for its requested mode. */
export function parsePerceptionFinding(mode: PerceptionMode, input: unknown): PerceptionFinding {
  const value = jsonValue(input);
  if (!Value.Check(schemaForPerceptionMode(mode), value)) {
    throw new PerceptionContractError('Perception finding', findingDiagnostics(value));
  }
  return value as PerceptionFinding;
}

/** Diagnostic-only repair text. Provider output is deliberately never echoed. */
export function buildPerceptionRepairInstruction(
  taskName: string,
  diagnostics: readonly PerceptionDiagnosticCode[],
): string {
  const codes = [...new Set(diagnostics)].slice(0, 8).join(', ');
  return `\n\nOUTPUT CONTRACT REPAIR (${taskName}): the prior response failed these checks: ${codes}. Return exactly one JSON object matching the requested schema. No Markdown or prose.`;
}

/** Parse the adversarial verifier's narrow structured response. */
export function parseVerifierVerdict(input: unknown): VerifierVerdict {
  const value = jsonValue(input);
  if (!Value.Check(VERIFIER_VERDICT_SCHEMA, value)) {
    const record = recordFrom(value);
    const diagnostics: PerceptionDiagnosticCode[] = [];
    if (record === null || typeof record.refuted !== 'boolean') diagnostics.push(PERCEPTION_DIAGNOSTIC_CODES.invalidRefuted);
    if (record === null || typeof record.reason !== 'string' || record.reason.trim() === '') diagnostics.push(PERCEPTION_DIAGNOSTIC_CODES.missingReason);
    throw new PerceptionContractError('Verifier verdict', diagnostics.length ? diagnostics : [PERCEPTION_DIAGNOSTIC_CODES.invalidVerifierVerdict]);
  }
  return value as VerifierVerdict;
}

/**
 * Parse a merge plan and prove it is a full, disjoint partition of `groupCount`.
 * The returned cluster indices are safe array indices: no NaN, fractions, empty
 * clusters, duplicates, or uncovered findings can reach aggregation.
 */
export function parseMergeClusters(input: unknown, groupCount: number): MergeClusters {
  const value = jsonValue(input);
  if (!Number.isSafeInteger(groupCount) || groupCount < 0 || !Value.Check(MERGE_CLUSTERS_SCHEMA, value)) {
    throw new PerceptionContractError('Merge clusters', [PERCEPTION_DIAGNOSTIC_CODES.invalidMergeClusters]);
  }
  const seen = new Set<number>();
  for (const cluster of value.clusters) {
    if (cluster.length === 0) throw new PerceptionContractError('Merge clusters', [PERCEPTION_DIAGNOSTIC_CODES.emptyCluster]);
    for (const index of cluster) {
      if (!Number.isSafeInteger(index) || index < 0 || index >= groupCount) {
        throw new PerceptionContractError('Merge clusters', [PERCEPTION_DIAGNOSTIC_CODES.invalidClusterIndex]);
      }
      if (seen.has(index)) throw new PerceptionContractError('Merge clusters', [PERCEPTION_DIAGNOSTIC_CODES.duplicateClusterIndex]);
      seen.add(index);
    }
  }
  if (seen.size !== groupCount) {
    throw new PerceptionContractError('Merge clusters', [PERCEPTION_DIAGNOSTIC_CODES.missingClusterIndex]);
  }
  return value;
}
