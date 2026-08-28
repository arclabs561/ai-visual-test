export interface ExtractedIssue { severity: string; timestamp: string; desc: string; }
export function timestampToSeconds(timestamp: string): number;
export function extractIssues(text: string, options?: { severities?: string[] }): ExtractedIssue[];
export function extractFixedTimestamps(text: string, options?: { severities?: string[] }): ExtractedIssue[];
export function findConsensus(byJudge: Record<string, ExtractedIssue[]>, options?: { windowSeconds?: number; minJudges?: number }): Array<{ cluster: ExtractedIssue[]; judges: string[] }>;
export function detectSpirals(currentByJudge: Record<string, ExtractedIssue[]>, previousFixedSeconds: Set<number>, options?: { windowSeconds?: number }): unknown[];
