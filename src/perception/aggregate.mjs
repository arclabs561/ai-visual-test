/**
 * Aggregation + cross-judge consolidation: group raw samples into ranked findings,
 * merge same-issue findings across judges, and match findings against known
 * dispositions. Pure, no I/O (mergeFindings takes an injected `complete` fn).
 */

/** Normalize a finding target to its first 3 lowercased alnum tokens. Internal,
 * shared with learn.mjs / sample.mjs (not part of the public surface). */
export const normTarget = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9 ]/g, "").trim().split(/\s+/).slice(0, 3).join(" ");

/** Count distinct judges on a finding, surviving a JSON round-trip (Set->size, array->length). */
export const judgeCount = (g) => (g.judges ? (g.judges.size ?? g.judges.length ?? 1) : 1);

const mergeScore = (mass, judges) => mass * (1 + Math.log2(judges.size));

/**
 * Aggregate raw samples for one mode into ranked findings (PURE, no I/O).
 * Groups by (category, normalized target); ranks by a JURY score that rewards
 * cross-judge agreement, not raw sample count.
 *
 * The jury score (Verga et al 2024 "Replacing Judges with Juries"; orq.ai "weak
 * judges, strong panel"): a finding raised independently by several DISTINCT
 * judge models is far more trustworthy than the same count of samples from one
 * model -- decorrelated agreement is the signal, correlated repetition is not.
 * So score = role-weighted confidence mass scaled by a diversity factor in the
 * number of distinct judges (1 judge -> x1, 2 -> x2, 4 -> x3; log2). A lone-judge
 * finding keeps its mass but loses the multiplier, so it ranks below corroborated
 * ones and is the first to be caught by the cross-model verify pass. Single-judge
 * callers (no s.judge) collapse to the old mass ranking exactly (diversity x1).
 */
export function aggregate(samples, mode) {
  const groups = new Map();
  for (const s of samples.filter((x) => x.mode === mode)) {
    const key = `${s.category || mode}::${normTarget(s.target)}`;
    const g = groups.get(key) || { mode, category: s.category || mode, target: normTarget(s.target), count: 0, mass: 0, heads: [], sugg: [], roles: new Set(), judges: new Set() };
    g.count++;
    g.mass += (s.weight ?? 1) * (s.confidence ?? 0.5);
    g.heads.push(s.headline); g.sugg.push(s.suggestion); g.roles.add(s.role);
    g.judges.add(s.judge ?? "default");
    groups.set(key, g);
  }
  for (const g of groups.values()) g.score = g.mass * (1 + Math.log2(g.judges.size));
  return [...groups.values()].sort((a, b) => b.score - a.score);
}

/**
 * Canonicalize cross-judge findings: merge aggregated groups that describe the
 * SAME underlying issue under different wording into one golden finding (entity
 * consolidation, Deng et al 2017; cluster consolidation, Cattan et al 2023). This
 * is what lets the diversity bonus actually fire -- different labs name the same
 * region differently ("weather panel footer" vs "weather widget footer"), so
 * without a semantic merge each stays single-judge and the cross-judge agreement
 * is invisible. Uses a text model (the findings are text; no image needed) to
 * cluster, then unions judges/roles/mass per cluster and re-scores over the UNION
 * judge set. PURE-on-failure: any malformed or non-covering clustering falls back
 * to the unmerged input, so a flaky canonicalizer never drops findings.
 *
 * @param {object[]} groups   aggregated groups from aggregate() (carry category/target/heads/judges/mass)
 * @param {object} cfg
 * @param {(sys:string,user:string,temperature:number)=>Promise<object>} cfg.complete  text completion fn (makeOpenRouterText)
 * @returns {Promise<object[]>} merged + re-ranked groups (or the input unchanged on any failure)
 */
export async function mergeFindings(groups, { complete } = {}) {
  if (!groups || groups.length < 2 || typeof complete !== "function") return groups;
  const list = groups.map((g, i) => `[${i}] (${g.category}) ${g.target}: ${(g.heads?.[0] || "").slice(0, 100)}`);
  const sys = "You consolidate UI-review findings. Different reviewers may describe the SAME issue with different wording. STRICT JSON, no fences.";
  const user = "Cluster the findings that describe the SAME underlying issue (same screen element AND same problem). Findings about different elements, or different problems on the same element, stay in separate clusters.\n" +
    list.join("\n") +
    '\nReturn JSON {"clusters": [[indices], ...]} where every index 0..' + (groups.length - 1) + " appears EXACTLY once (a unique finding is its own one-element cluster).";
  let clusters = null;
  try { const r = await complete(sys, user, 0.1); clusters = Array.isArray(r?.clusters) ? r.clusters : null; } catch { clusters = null; }
  // Validate full, disjoint coverage; any deviation -> fall back to unmerged (never drop a finding).
  if (!clusters) return groups;
  const seen = new Set();
  for (const c of clusters) {
    if (!Array.isArray(c)) return groups;
    for (const i of c) { if (typeof i !== "number" || i < 0 || i >= groups.length || seen.has(i)) return groups; seen.add(i); }
  }
  if (seen.size !== groups.length) return groups;
  const merged = clusters.map((c) => {
    const gs = c.map((i) => groups[i]);
    if (gs.length === 1) return gs[0];
    const judges = new Set(), roles = new Set(), heads = [], sugg = [];
    let mass = 0, count = 0;
    for (const g of gs) {
      for (const j of (g.judges || [])) judges.add(j);
      for (const r of (g.roles || [])) roles.add(r);
      mass += g.mass || 0; count += g.count || 0;
      heads.push(...(g.heads || [])); sugg.push(...(g.sugg || []));
    }
    const canon = gs.slice().sort((a, b) => (b.mass || 0) - (a.mass || 0))[0]; // most-massive group names the cluster
    return { mode: canon.mode, category: canon.category, target: canon.target, count, mass, heads, sugg, roles, judges, score: mergeScore(mass, judges), merged: gs.length };
  });
  return merged.sort((a, b) => b.score - a.score);
}

/**
 * Does a finding match a known disposition? Same mode (if the disposition pins
 * one), same category (if pinned), and overlapping normalized target. Returns the
 * matching disposition or null. Pure + exported so callers/tests can reason about
 * what gets suppressed.
 */
export function matchesDisposition(finding, dispositions = []) {
  const ft = normTarget(finding.target);
  for (const d of dispositions) {
    if (d.mode && d.mode !== finding.mode) continue;
    if (d.category && String(d.category).toUpperCase() !== String(finding.category).toUpperCase()) continue;
    const dt = normTarget(d.target);
    if (dt && ft && (ft === dt || ft.includes(dt) || dt.includes(ft))) return d;
  }
  return null;
}
