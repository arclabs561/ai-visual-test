/** Human-readable report formatting for the sections + samples that
 * samplePerceptions returns. Pure string building, no I/O. */

/** Format sections + samples as a human-readable report string. */
export function formatReport({ samples, sections }) {
  const LABEL = { question: "QUESTIONS -> what to add/clarify", problem: "PROBLEMS -> what to fix", insight: "INSIGHTS -> what works, protect it" };
  const lines = [];
  for (const { mode, top, suppressed = [] } of sections) {
    const cats = [...new Set(samples.filter((s) => s.mode === mode).map((s) => s.category))].filter(Boolean);
    const supTag = suppressed.length ? `; ${suppressed.length} suppressed by disposition` : "";
    lines.push(`\n=== ${LABEL[mode] || mode} (${samples.filter((s) => s.mode === mode).length} samples; categories: ${cats.join(", ")}${supTag}) ===`);
    for (const g of suppressed) lines.push(`  (suppressed ${g.disposition}) [${g.category}] ${g.target} -- ${g.dispositionReason}`);
    top.forEach((g, i) => {
      const v = g.verified === true ? "OK " : g.verified === false ? "REF" : " ? ";
      const nj = g.judges ? g.judges.size : 1;
      lines.push(`${String(i + 1).padStart(2)}. ${String(g.category).padEnd(9)} n=${String(g.count).padStart(2)} ${nj}j score=${(g.score ?? g.mass).toFixed(2)} ${v} ${g.target.slice(0, 26).padEnd(26)} ${g.heads[0].slice(0, 64)}`);
    });
    for (const g of top.filter((x) => x.verified !== false)) {
      const jl = g.judges ? [...g.judges].map((j) => j.split("/").pop()).join("+") : "";
      lines.push(`\n  [${g.category}] ${g.target} (n=${g.count}, judges=${jl}, roles=${[...g.roles].join("/")}, verified=${g.verified}${g.verifiedBy ? " by " + g.verifiedBy.split("/").pop() : ""})`);
      lines.push(`    ${g.heads.slice(0, 2).map((h) => `"${h}"`).join("  |  ")}`);
      if (mode !== "insight") lines.push(`    fix: ${g.sugg[0]}`);
      if (g.vreason) lines.push(`    verify: ${g.vreason}`);
    }
  }
  return lines.join("\n");
}
