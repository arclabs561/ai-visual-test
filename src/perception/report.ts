/** Human-readable report formatting for the sections + samples that
 * samplePerceptions returns. Pure string building, no I/O. */

import type { PerceptionAggregate, PerceptionSection } from "./learn.js";
import type { PerceptionMode } from "./contracts.js";

export interface PerceptionSample {
  mode: PerceptionMode | string;
  category?: string;
}

export interface PerceptionReportSection extends PerceptionSection {
  mode: PerceptionMode;
  top: readonly PerceptionAggregate[];
  suppressed?: readonly PerceptionAggregate[];
}

export interface PerceptionReportInput {
  samples: readonly PerceptionSample[];
  sections: readonly PerceptionReportSection[];
}

function displayText(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function displayItems(values: unknown): string[] {
  return values instanceof Set || Array.isArray(values)
    ? [...values].map(displayText)
    : [];
}

function displayScore(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(2) : "n/a";
}

function judgeCountForDisplay(judges: unknown): number {
  if (judges instanceof Set) return judges.size;
  if (Array.isArray(judges)) return judges.length;
  return 1;
}

/** Format sections + samples as a human-readable report string. */
export function formatReport({ samples, sections }: PerceptionReportInput): string {
  const LABEL = { question: "QUESTIONS -> what to add/clarify", problem: "PROBLEMS -> what to fix", insight: "INSIGHTS -> what works, protect it" };
  const lines = [];
  for (const { mode, top, suppressed = [] } of sections) {
    const cats = [...new Set(samples.filter((s) => s.mode === mode).map((s) => s.category))].filter((category): category is string => Boolean(category));
    const supTag = suppressed.length ? `; ${suppressed.length} suppressed by disposition` : "";
    const label = mode === "question" || mode === "problem" || mode === "insight" ? LABEL[mode] : mode;
    lines.push(`\n=== ${label} (${samples.filter((s) => s.mode === mode).length} samples; categories: ${cats.join(", ")}${supTag}) ===`);
    for (const g of suppressed) lines.push(`  (suppressed ${displayText(g.disposition)}) [${displayText(g.category)}] ${displayText(g.target)} -- ${displayText(g.dispositionReason)}`);
    top.forEach((g, i) => {
      const v = g.verified === true ? "OK " : g.verified === false ? "REF" : " ? ";
      const nj = judgeCountForDisplay(g.judges);
      const heads = displayItems(g.heads);
      lines.push(`${String(i + 1).padStart(2)}. ${displayText(g.category).padEnd(9)} n=${String(g.count ?? "").padStart(2)} ${nj}j score=${displayScore(g.score ?? g.mass)} ${v} ${displayText(g.target).slice(0, 26).padEnd(26)} ${displayText(heads[0]).slice(0, 64)}`);
    });
    for (const g of top.filter((x) => x.verified !== false)) {
      const jl = displayItems(g.judges).map((judge) => judge.split("/").pop() ?? judge).join("+");
      lines.push(`\n  [${displayText(g.category)}] ${displayText(g.target)} (n=${String(g.count ?? "")}, judges=${jl}, roles=${displayItems(g.roles).join("/")}, verified=${String(g.verified)}${g.verifiedBy ? " by " + (displayText(g.verifiedBy).split("/").pop() ?? displayText(g.verifiedBy)) : ""})`);
      lines.push(`    ${displayItems(g.heads).slice(0, 2).map((head) => `"${head}"`).join("  |  ")}`);
      if (mode !== "insight") lines.push(`    fix: ${displayText(g.sugg?.[0])}`);
      if (g.vreason) lines.push(`    verify: ${displayText(g.vreason)}`);
    }
  }
  return lines.join("\n");
}
