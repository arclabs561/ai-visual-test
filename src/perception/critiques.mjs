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
 *   import { appendCritique, readLedger, ledgerToDispositions } from "ai-visual-test/.../critiques.mjs"
 */
import { appendFileSync, readFileSync, existsSync } from "node:fs";

/**
 * Append one critique as a JSONL line. Pure except the single appendFileSync.
 * @param {string} ledgerPath  path to the append-only .jsonl ledger
 * @param {{version:string, critique:string, status?:string, screenshot?:string}} entry
 * @param {string} [nowIso]  injectable timestamp (caller passes for testability/determinism)
 * @returns {object} the written record
 */
export function appendCritique(ledgerPath, { version, critique, status = "open", ...extra }, nowIso) {
  if (!critique) throw new Error("appendCritique: critique text required");
  const rec = { ts: nowIso || new Date().toISOString(), version: version || "unknown", critique, status, ...extra };
  appendFileSync(ledgerPath, JSON.stringify(rec) + "\n");
  return rec;
}

/** Read the ledger into records (oldest first). Missing file -> []. */
export function readLedger(ledgerPath) {
  if (!existsSync(ledgerPath)) return [];
  return readFileSync(ledgerPath, "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
}

/**
 * Bridge the ledger into perception dispositions: open critiques become findings the
 * judge is told are KNOWN (so they keep surfacing / are not re-litigated as noise),
 * addressed ones are suppressed. Shape matches samplePerceptions({ dispositions }).
 * @param {string} ledgerPath
 * @param {{onlyOpen?:boolean}} [opts]
 */
export function ledgerToDispositions(ledgerPath, { onlyOpen = true } = {}) {
  return readLedger(ledgerPath)
    .filter((e) => !onlyOpen || e.status === "open")
    .map((e) => ({
      target: String(e.critique).toLowerCase().replace(/[^a-z0-9 ]/g, "").trim().split(/\s+/).slice(0, 4).join(" "),
      disposition: e.status === "addressed" ? "rejected" : "operator-critique",
      reason: `operator critique (build ${e.version}): ${e.critique}`,
    }));
}
