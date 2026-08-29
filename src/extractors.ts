/** Parse free-text VLM critiques into structured issues and iteration signals. */

const DEFAULT_SEVERITIES = ['CRITICAL', 'MAJOR', 'MINOR', 'NITPICK', 'FIXED'];

export interface ExtractedIssue {
  severity: string;
  timestamp: string;
  desc: string;
}

export interface ExtractorOptions {
  severities?: string[];
}

export interface ConsensusIssue extends ExtractedIssue {
  judge: string;
  sec: number;
}

export interface ConsensusCluster {
  cluster: ConsensusIssue[];
  judges: string[];
}

export interface ConsensusOptions {
  windowSeconds?: number;
  minJudges?: number;
}

export interface SpiralWarning extends ExtractedIssue {
  judge: string;
  prevFixedSec: number;
}

/** Convert MM:SS or HH:MM:SS to total seconds. */
export function timestampToSeconds(timestamp: string): number {
  const parts = timestamp.split(':').map(Number);
  if (parts.length === 2) return parts[0]! * 60 + parts[1]!;
  if (parts.length === 3) return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  return Number.NaN;
}

/**
 * Extract severity-anchored issue lines from a critique.
 *
 * The matcher accepts an optional inline tag between the timestamp and the
 * separator so judges can annotate a region or mode without breaking parsing.
 */
export function extractIssues(text: string, options: ExtractorOptions = {}): ExtractedIssue[] {
  const severities = options.severities || DEFAULT_SEVERITIES;
  const severityPattern = severities.join('|');
  const matcher = new RegExp(
    `\\[(${severityPattern})\\]\\s+(\\d{1,2}:\\d{2}(?::\\d{2})?)[^—–\\-:\\n]{0,40}[—–\\-:]\\s*(.+)`,
    'gi',
  );
  const issues: ExtractedIssue[] = [];
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(text))) {
    issues.push({
      severity: match[1]!.toUpperCase(),
      timestamp: match[2]!,
      desc: match[3]!.trim(),
    });
  }
  return issues;
}

/** Extract just the FIXED-tagged items from a critique. */
export function extractFixedTimestamps(text: string, options: ExtractorOptions = {}): ExtractedIssue[] {
  return extractIssues(text, { ...options, severities: ['FIXED'] });
}

/** Cluster issues from distinct judges that fall within a timestamp window. */
export function findConsensus(
  byJudge: Record<string, ExtractedIssue[]>,
  options: ConsensusOptions = {},
): ConsensusCluster[] {
  const windowSeconds = options.windowSeconds ?? 5;
  const minJudges = options.minJudges ?? 2;
  const all: ConsensusIssue[] = [];
  for (const [judge, issues] of Object.entries(byJudge)) {
    for (const issue of issues) {
      all.push({ ...issue, judge, sec: timestampToSeconds(issue.timestamp) });
    }
  }
  all.sort((a, b) => a.sec - b.sec);

  const clusters: ConsensusCluster[] = [];
  const used = new Set<number>();
  for (let index = 0; index < all.length; index += 1) {
    if (used.has(index)) continue;
    const anchor = all[index]!;
    const cluster = [anchor];
    used.add(index);
    for (let candidateIndex = index + 1; candidateIndex < all.length; candidateIndex += 1) {
      if (used.has(candidateIndex)) continue;
      const candidate = all[candidateIndex]!;
      if (Math.abs(candidate.sec - anchor.sec) <= windowSeconds) {
        cluster.push(candidate);
        used.add(candidateIndex);
      }
    }
    const judges = [...new Set(cluster.map((issue) => issue.judge))];
    if (judges.length >= minJudges) clusters.push({ cluster, judges });
  }

  const severityOrder: Record<string, number> = {
    CRITICAL: 0,
    MAJOR: 1,
    MINOR: 2,
    NITPICK: 3,
    FIXED: 4,
  };
  clusters.sort((left, right) => {
    const leftSeverity = Math.min(...left.cluster.map((issue) => severityOrder[issue.severity] ?? 9));
    const rightSeverity = Math.min(...right.cluster.map((issue) => severityOrder[issue.severity] ?? 9));
    if (leftSeverity !== rightSeverity) return leftSeverity - rightSeverity;
    return left.cluster[0]!.sec - right.cluster[0]!.sec;
  });
  return clusters;
}

/** Flag current issues that occur near a timestamp previously marked FIXED. */
export function detectSpirals(
  currentByJudge: Record<string, ExtractedIssue[]>,
  previousFixedSeconds: Set<number>,
  options: Pick<ConsensusOptions, 'windowSeconds'> = {},
): SpiralWarning[] {
  const windowSeconds = options.windowSeconds ?? 5;
  const warnings: SpiralWarning[] = [];
  for (const [judge, issues] of Object.entries(currentByJudge)) {
    for (const issue of issues) {
      if (issue.severity === 'FIXED') continue;
      const seconds = timestampToSeconds(issue.timestamp);
      for (const fixedSeconds of previousFixedSeconds) {
        if (Math.abs(seconds - fixedSeconds) <= windowSeconds) {
          warnings.push({ ...issue, judge, prevFixedSec: fixedSeconds });
          break;
        }
      }
    }
  }
  return warnings;
}
