/**
 * The sampling orchestrator: fan every (mode x persona x context x sample) cell
 * across a jury of judges, aggregate + (optionally) merge, then cross-model verify
 * and partition off dispositioned findings. Provider-agnostic: judges are injected
 * `vision` fns and the merge model an injected `complete` fn.
 */
import { MODE_SPEC, UX_HEURISTICS, VERIFY_SYS, verifyUser } from "./prompts.mjs";
import { aggregate, mergeFindings, matchesDisposition } from "./aggregate.mjs";

async function pmap(items, fn, conc) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(conc, items.length) }, async () => {
    while (i < items.length) { const k = i++; try { out[k] = await fn(items[k], k); } catch (e) { out[k] = { _err: e.message }; } }
  }));
  return out;
}

/**
 * Sample perceptions of one screenshot across modes x personas x contexts,
 * aggregate with a JURY of diverse judge models, and adversarially verify the
 * top findings with a CROSS-MODEL refute pass.
 *
 * The judge graph (grounded in the panel-of-judges literature):
 *   1. PANEL not one model. Pass `panel: [{id, vision, weight}]` (build with
 *      makePanel) -- diverse-lab judges decorrelate bias where one model's
 *      samples only repeat it (Verga et al 2024, PoLL). `vision` alone is still
 *      accepted and runs as a one-judge panel (back-compat, no diversity bonus).
 *   2. MASS SPANS JUDGES. aggregate() scores a finding by role-weighted mass x a
 *      diversity factor in the number of DISTINCT judges that raised it, so
 *      cross-judge agreement outranks single-judge repetition.
 *   3. CROSS-MODEL VERIFY. The refute pass for a finding is run by a judge that
 *      did NOT raise it whenever the panel allows, so a model cannot rubber-stamp
 *      its own claim -- the structural debias that more same-model samples cannot
 *      buy (CyclicJudge 2026; position-bias studies). Falls back to any judge
 *      when every panel member raised the finding.
 *
 * @param {object} cfg
 * @param {{id:string, vision:Function, weight?:number}[]} [cfg.panel]  jury of judges (preferred)
 * @param {(sys:string,user:string,temperature:number)=>Promise<object>} [cfg.vision]  single-judge fallback
 * @param {(sys:string,user:string,temperature:number)=>Promise<object>} [cfg.complete]  text model (makeOpenRouterText): if set, cross-judge findings are canonicalized/merged before ranking
 * @param {string[]} [cfg.modes]      subset of ["question","problem","insight"]
 * @param {{id,who,weight}[]} cfg.personas   required (who = 2nd-person persona description; weight scales mass)
 * @param {{id,ctx}[]} cfg.contexts          required (glance contexts / moments)
 * @param {number} [cfg.n=2]          samples per cell PER JUDGE
 * @param {number} [cfg.concurrency=10]
 * @param {number} [cfg.topK=6]       findings verified per mode
 * @param {boolean} [cfg.verify=true]
 * @param {string[]} [cfg.principles]  governing principles SEEDED into every prompt so the
 *                                     judge does not flag settled-by-design choices as defects
 * @param {{mode?,category?,target,disposition,reason}[]} [cfg.dispositions]  known findings to
 *                                     SUPPRESS from the surfaced set (convergence memory)
 * @param {string[]} [cfg.heuristics]  generic UI/UX heuristics seeded into prompts (default UX_HEURISTICS; [] disables)
 * @returns {Promise<{samples:object[], sections:{mode,ranked,top,suppressed}[], judges:string[]}>}
 */
export async function samplePerceptions({ panel, vision, complete, modes = ["question", "problem", "insight"], personas, contexts, n = 2, concurrency = 10, topK = 6, verify = true, principles = [], dispositions = [], heuristics = UX_HEURISTICS }) {
  // Normalize to a panel; a bare `vision` fn becomes a single-judge jury (back-compat).
  const jury = panel?.length ? panel : (typeof vision === "function" ? [{ id: "default", vision, weight: 1 }] : null);
  if (!jury) throw new Error("samplePerceptions: panel or vision fn required");
  for (const j of jury) if (typeof j.vision !== "function") throw new Error(`samplePerceptions: judge '${j.id}' missing vision fn`);
  if (!personas?.length || !contexts?.length) throw new Error("samplePerceptions: personas and contexts required");
  for (const m of modes) if (!MODE_SPEC[m]) throw new Error(`samplePerceptions: unknown mode '${m}'`);

  // Seed governing principles into every prompt (sampling AND verify) so the judge
  // treats settled-by-design choices as intended, not as problems/gaps/noise. This
  // is the upstream half of convergence; dispositions (below) are the downstream half.
  const seed = principles.length
    ? "\n\nDESIGN PRINCIPLES IN FORCE -- these are intended and correct; do NOT report them as problems, gaps, conflicts, or noise:\n- " + principles.join("\n- ")
    : "";
  // General UI/UX heuristics (Nielsen + Gestalt) seeded BEFORE the domain principles
  // so the judge reasons from named conventions, while the principles above remain the
  // override where a choice is intended-by-design.
  const hseed = heuristics.length
    ? "\n\nGENERAL UI/UX HEURISTICS (apply unless a design principle above marks the choice intended):\n- " + heuristics.join("\n- ")
    : "";

  // Fan every (mode x persona x context x sample) cell across EVERY judge.
  const cells = [];
  for (const mode of modes) for (const persona of personas) for (const context of contexts) for (const judge of jury) for (let s = 0; s < n; s++) cells.push({ mode, persona, context, judge });
  const samples = (await pmap(cells, ({ mode, persona, context, judge }) => {
    const spec = MODE_SPEC[mode];
    return judge.vision(spec.sys + hseed + seed, spec.user(persona, context), 1.05)
      .then((r) => ({ ...r, mode, role: persona.id, weight: (persona.weight ?? 1) * (judge.weight ?? 1), context: context.id, judge: judge.id }));
  }, concurrency)).filter((r) => r && !r._err && r.headline);

  const sections = [];
  for (const mode of modes) {
    // Aggregate, then (if a text model is supplied) canonicalize cross-judge
    // findings so same-issue/different-wording groups merge BEFORE topK + verify
    // -- the merged diversity score is what should decide which findings rank.
    let ranked = aggregate(samples, mode);
    if (complete) ranked = await mergeFindings(ranked, { complete });
    const candidates = ranked.slice(0, Math.min(topK, ranked.length));
    if (verify && candidates.length) {
      // Cross-model: verify each finding with a judge that did NOT raise it (so a
      // model can't rubber-stamp its own claim); fall back to the first judge when
      // every member raised it. Single-judge juries verify with themselves as before.
      const verdicts = await pmap(candidates, (g) => {
        const verifier = jury.find((j) => !g.judges.has(j.id)) || jury[0];
        g.verifiedBy = verifier.id;
        return verifier.vision(VERIFY_SYS + seed, verifyUser(mode, { category: g.category, target: g.target, why: g.heads[0], suggestion: g.sugg[0] }), 0.1);
      }, 4);
      candidates.forEach((g, i) => { g.verified = verdicts[i] && !verdicts[i]._err ? !verdicts[i].refuted : null; g.vreason = verdicts[i]?.reason || verdicts[i]?._err || ""; });
    }
    // Convergence: partition off findings already dispositioned (fixed/rejected/
    // deferred) so each run surfaces genuinely-new signal, not re-litigated ones.
    const top = [], suppressed = [];
    for (const g of candidates) {
      const d = matchesDisposition(g, dispositions);
      if (d) { g.disposition = d.disposition; g.dispositionReason = d.reason || d.adr || ""; suppressed.push(g); }
      else top.push(g);
    }
    sections.push({ mode, ranked, top, suppressed });
  }
  return { samples, sections, judges: jury.map((j) => j.id) };
}
