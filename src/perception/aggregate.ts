/** Pure aggregation, semantic merge, and disposition matching for perception findings. */
import {
  MERGE_CLUSTERS_SCHEMA,
  PerceptionContractError,
  buildPerceptionRepairInstruction,
  parseMergeClusters,
} from './contracts.js';
import type { MergeClusters, PerceptionMode, PerceptionStructuredOutput } from './contracts.js';

export interface PerceptionSample {
  mode: PerceptionMode;
  category?: string;
  target?: string;
  role?: string;
  judge?: string;
  weight?: number;
  confidence?: number;
  headline: string;
  suggestion: string;
}

export interface AggregateFinding {
  mode: PerceptionMode;
  category: string;
  target: string;
  count: number;
  mass: number;
  heads: string[];
  sugg: string[];
  roles: Set<string | undefined>;
  judges: Set<string>;
  score: number;
  merged?: number;
}

export interface Disposition {
  mode?: PerceptionMode;
  category?: string;
  target?: string;
  [key: string]: unknown;
}

export type TextCompletion = (
  system: string,
  user: string,
  temperature: number,
  structuredOutput?: PerceptionStructuredOutput,
) => Promise<unknown>;

export interface MergeFindingsOptions {
  complete?: TextCompletion;
  contractRetries?: number;
  onContractError?: (error: PerceptionContractError) => void;
}

/** Normalize a finding target to its first three lowercased alphanumeric tokens. */
export function normTarget(target: unknown): string {
  return String(target || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim().split(/\s+/).slice(0, 3).join(' ');
}

/** Count distinct judges, surviving a JSON round-trip (Set -> array). */
export function judgeCount(group: Pick<AggregateFinding, 'judges'> | { judges?: Set<string> | readonly string[] | undefined }): number {
  const judges = group.judges;
  return judges ? (judges instanceof Set ? judges.size : judges.length) : 1;
}

function mergeScore(mass: number, judges: ReadonlySet<string>): number {
  return mass * (1 + Math.log2(judges.size));
}

/** Aggregate one mode into ranked, jury-diversity-weighted findings. */
export function aggregate(samples: readonly PerceptionSample[], mode: PerceptionMode): AggregateFinding[] {
  const groups = new Map<string, Omit<AggregateFinding, 'score'>>();
  for (const sample of samples.filter((item) => item.mode === mode)) {
    if (sample.weight !== undefined && (!Number.isFinite(sample.weight) || sample.weight < 0)) {
      throw new RangeError('aggregate: weight must be finite and nonnegative');
    }
    if (sample.confidence !== undefined && (!Number.isFinite(sample.confidence) || sample.confidence < 0 || sample.confidence > 1)) {
      throw new RangeError('aggregate: confidence must be finite and between 0 and 1');
    }
    const key = `${sample.category || mode}::${normTarget(sample.target)}`;
    const group = groups.get(key) ?? {
      mode,
      category: sample.category || mode,
      target: normTarget(sample.target),
      count: 0,
      mass: 0,
      heads: [],
      sugg: [],
      roles: new Set<string | undefined>(),
      judges: new Set<string>(),
    };
    group.count++;
    group.mass += (sample.weight ?? 1) * (sample.confidence ?? 0.5);
    group.heads.push(sample.headline);
    group.sugg.push(sample.suggestion);
    group.roles.add(sample.role);
    group.judges.add(sample.judge ?? 'default');
    groups.set(key, group);
  }
  return [...groups.values()]
    .map((group) => ({ ...group, score: mergeScore(group.mass, group.judges) }))
    .sort((left, right) => right.score - left.score);
}

function groupList(groups: readonly AggregateFinding[]): string[] {
  return groups.map((group, index) =>
    `[${index}] (${group.category}) ${group.target}: ${(group.heads[0] || '').slice(0, 100)}`,
  );
}

function asStringSet(values: ReadonlySet<string | undefined> | readonly string[] | undefined): Set<string | undefined> {
  return new Set(values ?? []);
}

/**
 * Canonicalize same-issue groups with an injected text model. Any failed or
 * malformed partition returns the original groups unchanged, never a partial
 * merge. `parseMergeClusters` makes fractional, NaN, and empty clusters safe
 * identity fallbacks rather than runtime errors.
 */
export async function mergeFindings(
  groups: AggregateFinding[],
  { complete, contractRetries = 1, onContractError }: MergeFindingsOptions = {},
): Promise<AggregateFinding[]> {
  if (groups.length < 2 || typeof complete !== 'function') return groups;
  if (!Number.isSafeInteger(contractRetries) || contractRetries < 0 || contractRetries > 2) {
    throw new RangeError('mergeFindings: contractRetries must be an integer between 0 and 2');
  }
  const system = 'You consolidate UI-review findings. Different reviewers may describe the SAME issue with different wording. STRICT JSON, no fences.';
  const user = 'Cluster the findings that describe the SAME underlying issue (same screen element AND same problem). Findings about different elements, or different problems on the same element, stay in separate clusters.\n' +
    groupList(groups).join('\n') +
    `\nReturn JSON {"clusters": [[indices], ...]} where every index 0..${groups.length - 1} appears EXACTLY once (a unique finding is its own one-element cluster).`;
  let clusters: MergeClusters | undefined;
  let prompt = user;
  for (let attempt = 0; attempt <= contractRetries; attempt++) {
    try {
      clusters = parseMergeClusters(
        await complete(system, prompt, 0.1, { name: 'perception_merge', schema: MERGE_CLUSTERS_SCHEMA, strict: true }),
        groups.length,
      );
      break;
    } catch (error) {
      if (!(error instanceof PerceptionContractError)) return groups;
      if (attempt >= contractRetries) {
        onContractError?.(error);
        return groups;
      }
      prompt = user + buildPerceptionRepairInstruction('perception_merge', error.diagnostics);
    }
  }
  if (clusters === undefined) return groups;

  const merged = clusters.clusters.map((cluster) => {
    const clusterGroups = cluster.map((index) => groups[index]!);
    if (clusterGroups.length === 1) return clusterGroups[0]!;
    const judges = new Set<string>();
    const roles = new Set<string | undefined>();
    const heads: string[] = [];
    const sugg: string[] = [];
    let mass = 0;
    let count = 0;
    for (const group of clusterGroups) {
      for (const judge of asStringSet(group.judges)) judges.add(judge!);
      for (const role of asStringSet(group.roles)) roles.add(role);
      mass += group.mass || 0;
      count += group.count || 0;
      heads.push(...group.heads);
      sugg.push(...group.sugg);
    }
    const canonical = clusterGroups.slice().sort((left, right) => (right.mass || 0) - (left.mass || 0))[0]!;
    return {
      mode: canonical.mode,
      category: canonical.category,
      target: canonical.target,
      count,
      mass,
      heads,
      sugg,
      roles,
      judges,
      score: mergeScore(mass, judges),
      merged: clusterGroups.length,
    };
  });
  return merged.sort((left, right) => right.score - left.score);
}

/** Return the matching disposition, if its optional mode/category pins agree. */
export function matchesDisposition(finding: Pick<AggregateFinding, 'mode' | 'category' | 'target'>, dispositions: readonly Disposition[] = []): Disposition | null {
  const findingTarget = normTarget(finding.target);
  for (const disposition of dispositions) {
    if (disposition.mode && disposition.mode !== finding.mode) continue;
    if (disposition.category && String(disposition.category).toUpperCase() !== String(finding.category).toUpperCase()) continue;
    const dispositionTarget = normTarget(disposition.target);
    if (dispositionTarget && findingTarget && (findingTarget === dispositionTarget || findingTarget.includes(dispositionTarget) || dispositionTarget.includes(findingTarget))) return disposition;
  }
  return null;
}
