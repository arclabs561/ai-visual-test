/**
 * Operator-critique ledger (generic): a permanent, append-only record of live human
 * critiques of a rendered artifact, each ANCHORED to the version it references so an
 * opinion about "the rain bars in build X" resolves to that exact version's
 * {code, screenshot, critique}. Provider-agnostic: the CONSUMER supplies the version
 * key (a build SHA, a git ref, a timestamp) and, optionally, a screenshot path it
 * captured for that version. ai-visual-test owns the format + the bridge into the
 * perception loop; it does not know how the consumer renders or versions.
 *
 * The bridge: open critiques become DISPOSITIONS fed to samplePerceptions(), so a
 * human's live opinion (episodic) is carried forward as a finding the judge must not
 * regress, and an addressed one is suppressed (the episodic->semantic promotion).
 *
 *   import { appendCritique, readLedger, ledgerToDispositions } from "@arclabs561/ai-visual-test/perception"
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

export interface AppendCritiqueInput {
  version?: unknown;
  critique?: unknown;
  status?: unknown;
  screenshot?: unknown;
  [key: string]: unknown;
}

export interface WrittenCritique extends Record<string, unknown> {
  ts: string;
  version: unknown;
  critique: unknown;
  status: unknown;
}

export interface CritiqueDisposition {
  target: string;
  disposition: 'rejected' | 'operator-critique';
  reason: string;
}

function ledgerRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function dispositionRecord(value: unknown): Record<string, unknown> | null {
  const entry = ledgerRecord(value);
  if (
    entry === null
    || typeof entry.critique !== 'string'
    || !entry.critique.trim()
    || (entry.status !== 'open' && entry.status !== 'addressed')
  ) return null;
  return entry;
}

/**
 * Append one critique as a JSONL line. Pure except the single appendFileSync.
 * Ledger contents are intentionally not validated here: this function preserves
 * caller metadata alongside the required, truthy critique value.
 */
export function appendCritique(
  ledgerPath: string,
  { version, critique, status = 'open', ...extra }: AppendCritiqueInput,
  nowIso?: string,
): WrittenCritique {
  if (!critique) throw new Error('appendCritique: critique text required');
  const rec: WrittenCritique = {
    ts: nowIso || new Date().toISOString(),
    version: version || 'unknown',
    critique,
    status,
    ...extra,
  };
  appendFileSync(ledgerPath, `${JSON.stringify(rec)}\n`);
  return rec;
}

/**
 * Read parseable JSONL values in chronological order. A ledger is append-only
 * external input, so an interrupted append must not hide earlier or later valid
 * entries. Callers that need a schema must validate each returned value themselves.
 */
export function readLedger(ledgerPath: string): unknown[] {
  if (!existsSync(ledgerPath)) return [];
  const values: unknown[] = [];
  for (const line of readFileSync(ledgerPath, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      values.push(JSON.parse(line) as unknown);
    } catch {
      // A partially appended line is not a ledger record. Keep scanning because
      // valid records may follow it after a later append.
    }
  }
  return values;
}

/**
 * Bridge ledger records into perception dispositions: open critiques become findings
 * the judge is told are KNOWN (so they keep surfacing / are not re-litigated as
 * noise), addressed ones are suppressed. Invalid JSONL values have no disposition.
 * Shape matches samplePerceptions({ dispositions }).
 */
export function ledgerToDispositions(ledgerPath: string, { onlyOpen = true }: { onlyOpen?: boolean } = {}): CritiqueDisposition[] {
  return readLedger(ledgerPath)
    .map(dispositionRecord)
    .filter((entry): entry is Record<string, unknown> => entry !== null)
    .filter(entry => !onlyOpen || entry.status === 'open')
    .map(entry => ({
      target: String(entry.critique).toLowerCase().replace(/[^a-z0-9 ]/g, '').trim().split(/\s+/).slice(0, 4).join(' '),
      disposition: entry.status === 'addressed' ? 'rejected' : 'operator-critique',
      reason: `operator critique (build ${String(entry.version)}): ${String(entry.critique)}`,
    }));
}
