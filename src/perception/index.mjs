/**
 * Perception sampler sub-module.
 *
 * Import from 'ai-visual-test/perception'.
 *
 * The COMPASS counterpart to rubric validation (validateScreenshot is the GATE):
 * instead of scoring a screenshot against fixed anchors, this samples what real
 * viewers PERCEIVE and discovers the failures (and strengths) a fixed rubric did
 * not anticipate. Three perception modes, because a glance produces more than
 * questions:
 *
 *   question  what does the viewer want to know that the surface doesn't answer?
 *             -> classified by uncertainty LOCUS (UI/INFO/GAP/CONFLICT/NOISE).
 *   problem   what looks wrong / broken / low-quality / confusing?
 *             -> classified by SEVERITY (blocker/major/minor).
 *   insight   the single most useful takeaway + what works and must be preserved
 *             -> the positive signal a defect-only judge never sees.
 *
 * Method: for each (mode x persona x context) cell, ask a vision model at high
 * temperature; classify; aggregate by (category, target) weighted by persona
 * weight; adversarially VERIFY the top findings (a refute pass) before they ship,
 * because VLM samples hallucinate. Caller supplies the personas, contexts, and a
 * `vision` fn (or uses makeOpenRouterVision); this module is provider-agnostic
 * orchestration. STATELESS by design: convergence/disposition memory is a caller
 * concern (see the consumer's decision record) layered on top of these results.
 */

const LOCI = ["UI", "INFO", "GAP", "CONFLICT", "NOISE"];
const SEV = ["blocker", "major", "minor"];

// Generic perception prompts. category vocabulary differs per mode; target +
// confidence are shared so aggregation is uniform.
export const MODE_SPEC = {
  question: {
    sys: "Simulate a real person glancing at this display, read at its intended distance. Answer AS THAT PERSON. STRICT JSON, no prose, no fences.",
    user: (persona, context) => `You are ${persona.who}. ${context.ctx}\n` +
      "You glance at this display. What is the FIRST genuine question that forms -- something you want to know but the display does not clearly answer? Then diagnose WHERE the uncertainty lives (one locus):\n" +
      "  UI = the answer IS on screen but you can't find/read it (too small, buried, low contrast, ambiguous symbol)\n" +
      "  INFO = derivable from data clearly present elsewhere on screen, but not surfaced\n" +
      "  GAP = the data needed simply isn't on the display at all\n" +
      "  CONFLICT = two things disagree, or something contradicts what you'd expect\n" +
      "  NOISE = your question is really 'why is THIS even here?'\n" +
      'JSON: {"headline": the question, "category": one of ' + JSON.stringify(LOCI) +
      ', "target": 2-4 words naming the screen region, "why": one sentence on the source of uncertainty, "suggestion": one concrete change that pre-answers it, "confidence": 0..1 this is a real issue not taste}',
  },
  problem: {
    sys: "You are a sharp design + correctness reviewer. Report defects only. STRICT JSON, no prose, no fences.",
    user: (persona, context) => `Viewer context: ${persona.who}; ${context.ctx}\n` +
      "Identify the single most important thing that is WRONG with this display right now -- broken/mis-rendered layout, clipped or overflowing content, illegible or low-contrast text, a value that looks incorrect or contradictory, font fallback, wasted space, or visual clutter. Rate its severity.\n" +
      'JSON: {"headline": the problem, "category": one of ' + JSON.stringify(SEV) +
      ' (blocker=unusable/wrong, major=clearly degrades, minor=polish), "target": 2-4 words naming the region, "why": one sentence of evidence visible on screen, "suggestion": one concrete fix, "confidence": 0..1 this is really wrong not taste}',
  },
  insight: {
    sys: "Simulate a real person glancing at this display. Report what WORKS and what you take away. STRICT JSON, no prose, no fences.",
    user: (persona, context) => `You are ${persona.who}. ${context.ctx}\n` +
      "You glance at this display. What is the single most USEFUL thing you take away in that glance, and what about the display works well enough that it should be PRESERVED (not regressed)? Be specific about the element that delivers it.\n" +
      'JSON: {"headline": the useful takeaway, "category": "insight", "target": 2-4 words naming the element that delivers it, "why": one sentence on why it works at a glance, "suggestion": how to protect or amplify it, "confidence": 0..1 this is genuinely supported by what is shown}',
  },
};

/**
 * General, domain-agnostic UI/UX heuristics seeded into the question + problem
 * prompts so the judge reasons from named, well-established principles rather than
 * ad-hoc "looks wrong". Grounded in Nielsen's 10 usability heuristics (NN/g) and
 * Gestalt visual-grouping principles -- the common-sense aesthetics/UX baseline any
 * surface is held to. A consumer's domain `principles` (passed to samplePerceptions)
 * are the OVERRIDE: where a principle marks a choice intended (e.g. "dense is by
 * design, do not flag whitespace"), it wins over the generic heuristic. Override the
 * set by passing your own `heuristics`, or pass `[]` to disable.
 */
export const UX_HEURISTICS = [
  "Visual hierarchy: the most important value is the most visually prominent (size, weight, position); a glance should land on what matters first.",
  "Grouping: related items read as a group (proximity, alignment, shared enclosure/color) and unrelated items are visually separated (Gestalt proximity/similarity).",
  "Legibility: every element is readable at the intended viewing distance with sufficient contrast; nothing is clipped, overlapping, or truncated mid-word.",
  "Status visibility: the state of each thing (fresh vs stale, on/off, normal vs alarm) is unambiguous at a glance (Nielsen: visibility of system status).",
  "Consistency: the same kind of value is presented the same way everywhere; units, color meaning, and number formats do not shift between regions (Nielsen: consistency & standards).",
  "Recognition over recall: labels, icons, and abbreviations are self-evident; the viewer should not have to remember what a symbol means (Nielsen: recognition not recall).",
  "Signal over noise: every element earns its place; decorative or redundant content competes with the data (Nielsen: aesthetic & minimalist design) -- note this is about NOISE, not information density.",
];

const VERIFY_SYS = "You are an adversarial reviewer given a screenshot and a CLAIM about it. REFUTE the claim if you can. Default refuted=true when uncertain. STRICT JSON, no fences.";
const verifyUser = (mode, f) =>
  (mode === "insight"
    ? `Claimed strength (target "${f.target}"): ${f.why}\n`
    : `Claimed ${mode} (category ${f.category}, target "${f.target}"): ${f.why}\nProposed: ${f.suggestion}\n`) +
  "Look at the screenshot. Is this claim actually TRUE of what is shown? " +
  'JSON: {"refuted": bool, "reason": one sentence}. ' +
  (mode === "insight"
    ? "Refute if the claimed strength is not actually present/legible/effective on screen."
    : "Refute if the thing is in fact present/legible/correct, or if the claim is vague taste rather than a real defect.");

/** Strip code fences and parse a single JSON object from an LLM response. */
export function parseJsonObject(text) {
  const clean = String(text || "").replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  return JSON.parse(clean);
}

/** Build a vision(sys, user, temperature) -> object fn backed by OpenRouter. */
export function makeOpenRouterVision({ apiKey, model = "google/gemini-3.5-flash", imageBase64, referer = "https://ai-visual-test", title = "perception-eval" }) {
  if (!apiKey) throw new Error("makeOpenRouterVision: apiKey required");
  if (!imageBase64) throw new Error("makeOpenRouterVision: imageBase64 required");
  return async (sys, user, temperature) => {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "HTTP-Referer": referer, "X-Title": title },
      body: JSON.stringify({
        model, temperature, response_format: { type: "json_object" },
        messages: [
          { role: "system", content: sys },
          { role: "user", content: [
            { type: "text", text: user },
            { type: "image_url", image_url: { url: `data:image/png;base64,${imageBase64}` } },
          ] },
        ],
      }),
    });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
    const j = await res.json();
    return parseJsonObject(j.choices?.[0]?.message?.content ?? "");
  };
}

/** Build a text-only complete(sys, user, temperature) -> object fn backed by
 * OpenRouter (no image -- used by mergeFindings, which reasons over finding text,
 * not the screenshot, so it can run on a cheap text model). */
export function makeOpenRouterText({ apiKey, model = "google/gemini-3.5-flash", referer = "https://ai-visual-test", title = "perception-merge" }) {
  if (!apiKey) throw new Error("makeOpenRouterText: apiKey required");
  return async (sys, user, temperature = 0.1) => {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "HTTP-Referer": referer, "X-Title": title },
      body: JSON.stringify({
        model, temperature, response_format: { type: "json_object" },
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
      }),
    });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
    const j = await res.json();
    return parseJsonObject(j.choices?.[0]?.message?.content ?? "");
  };
}

/**
 * Build a jury panel from a list of OpenRouter model ids: returns
 * [{ id, vision, weight }] ready for samplePerceptions({ panel }). Picking
 * models from DIFFERENT labs (e.g. a Google, an Anthropic, an OpenAI, a Qwen)
 * is the load-bearing choice -- a panel only decorrelates bias if the judges
 * disagree on the right things, which same-lab models do not (Verga et al 2024).
 * `weight` per model (optional, default 1) is the reliability weight a gold-set
 * calibration would set ("LLM-as-a-jury", Qian et al 2026: judges are not equally
 * reliable, so do not equal-vote).
 *
 * @param {object} cfg
 * @param {string} cfg.apiKey
 * @param {string} cfg.imageBase64
 * @param {(string | {id:string, weight?:number})[]} cfg.models  model ids or {id,weight}
 */
export function makePanel({ apiKey, imageBase64, models, referer, title }) {
  if (!models?.length) throw new Error("makePanel: models required");
  return models.map((m) => {
    const id = typeof m === "string" ? m : m.id;
    const weight = typeof m === "string" ? 1 : (m.weight ?? 1);
    return { id, weight, vision: makeOpenRouterVision({ apiKey, model: id, imageBase64, referer, title }) };
  });
}

async function pmap(items, fn, conc) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(conc, items.length) }, async () => {
    while (i < items.length) { const k = i++; try { out[k] = await fn(items[k], k); } catch (e) { out[k] = { _err: e.message }; } }
  }));
  return out;
}

const normTarget = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9 ]/g, "").trim().split(/\s+/).slice(0, 3).join(" ");

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

const mergeScore = (mass, judges) => mass * (1 + Math.log2(judges.size));

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

const judgeCount = (g) => (g.judges ? (g.judges.size ?? g.judges.length ?? 1) : 1);

/**
 * Active-learning selection (PURE): pick the findings where an operator label is
 * most informative -- the ones the jury is most SPLIT on. Labeling random findings
 * wastes human attention; labeling the borderline ones (max-disagreement / flip-
 * flop query, Cho et al 2024) resolves the most uncertainty per touch and gives
 * the calibration its ground truth. Disagreement is the gap between how much of
 * the panel RAISED a finding (support) and whether the cross-model verify
 * CONFIRMED it: a lone-but-verified finding (low support, confirmed) or a
 * many-but-refuted one (high support, refuted) is exactly where the panel and the
 * verifier conflict and a human should break the tie.
 *
 * @param {{top:object[]}[]} sections   sections from samplePerceptions
 * @param {object} [cfg]
 * @param {number} [cfg.k=3]            how many to surface
 * @param {number} [cfg.panelSize]      number of judges in the panel (for the support fraction)
 * @returns {{mode,category,target,head,verified,judges,disagreement}[]} most-split first
 */
export function selectForReview(sections, { k = 3, panelSize } = {}) {
  const items = [];
  for (const sec of sections || []) for (const g of sec.top || []) {
    if (g.verified == null) continue; // only adjudicated findings have a support-vs-verify signal
    const support = panelSize ? judgeCount(g) / panelSize : 0.5;
    const confirmed = g.verified === true ? 1 : 0;
    items.push({ mode: g.mode, category: g.category, target: g.target, head: g.heads?.[0], verified: g.verified, judges: g.judges ? [...g.judges] : [], disagreement: Math.abs(support - confirmed) });
  }
  return items.sort((a, b) => b.disagreement - a.disagreement).slice(0, k);
}

/**
 * Online per-judge reliability calibration (PURE; the consumer persists the
 * returned weights and feeds them back as `prior` + into the next panel's judge
 * weights). The symbiotic half of the judge graph: the panel produces findings,
 * the verify pass + ground truth adjudicate them, and that outcome reshapes how
 * much each judge counts next round.
 *
 * "Calibrate, don't curate" (Li 2026): never drop a judge -- reweight it. A
 * judge's round reliability is the verified-survival rate of the findings it
 * raised (of the adjudicated candidates it contributed to, the fraction verified
 * TRUE rather than refuted), mapped to [floor, ceil] and EMA-blended with its
 * prior weight so reliability ACCUMULATES across runs ("Becoming Experienced
 * Judges", Jwa et al 2025) instead of each run starting cold. The floor keeps
 * even a weak judge in the panel (a lone dissenter is sometimes right -- "Beyond
 * the Illusion of Consensus", Song et al 2026); the ceiling stops one judge
 * dominating the mass.
 *
 * @param {object} cfg
 * @param {Record<string,number>} [cfg.prior]   prior per-judge weights (judgeId -> weight); default 1 each
 * @param {{top:object[]}[]} cfg.sections        sections from samplePerceptions (top findings carry g.judges + g.verified)
 * @param {number} [cfg.lr=0.3]     EMA rate: how fast this round's evidence moves the weight
 * @param {number} [cfg.floor=0.25] minimum weight (calibrate, never curate to zero)
 * @param {number} [cfg.ceil=2]     maximum weight
 * @returns {Record<string,number>} updated per-judge weights (only judges seen this round move)
 */
export function calibrateJudges({ prior = {}, sections, lr = 0.3, floor = 0.25, ceil = 2 }) {
  const hit = {}, tot = {};
  for (const sec of sections) for (const g of sec.top || []) {
    if (g.verified == null) continue; // only adjudicated findings carry a credit signal
    for (const jid of (g.judges || [])) {
      tot[jid] = (tot[jid] || 0) + 1;
      if (g.verified === true) hit[jid] = (hit[jid] || 0) + 1;
    }
  }
  const out = { ...prior };
  for (const jid of Object.keys(tot)) {
    const rate = (hit[jid] || 0) / tot[jid];               // verified-survival rate this round
    const reliability = floor + (ceil - floor) * rate;      // [0,1] -> [floor, ceil]
    const prev = prior[jid] ?? 1;
    out[jid] = Math.min(ceil, Math.max(floor, prev * (1 - lr) + reliability * lr)); // EMA toward reliability
  }
  return out;
}

/**
 * Recency-decay disposition confidence and RE-OPEN regressed suppressions (PURE).
 * The anti-ossification half of convergence memory: a disposition that keeps a
 * settled finding suppressed should not do so forever if the finding actually
 * came back. Only `fixed` dispositions decay here -- a fix can regress, so when
 * its finding recurs this round with independent multi-judge support (not one
 * model's noise), drop the disposition's confidence; past `reopenBelow`, flag
 * `reopen` so the consumer stops suppressing it and it surfaces again. `rejected`
 * dispositions are permanent design calls (recurrence is EXPECTED -- the judge
 * keeps seeing the intended thing) and never decay; `deferred` ones gate on their
 * own condition (a date/threshold the consumer owns), so they pass through too.
 *
 * @param {object} cfg
 * @param {object[]} cfg.dispositions   each {target, disposition, confidence?, ...}
 * @param {{suppressed:object[]}[]} cfg.sections   sections (g.suppressed = dispositions matched this round, carry g.judges)
 * @param {number} [cfg.decay=0.6]      confidence multiplier when a fixed disposition's finding recurs
 * @param {number} [cfg.reopenBelow=0.3] confidence under which the disposition is flagged reopen=true
 * @param {number} [cfg.minJudges=2]    distinct judges required to count a recurrence as real (decorrelation guard)
 * @returns {object[]} updated dispositions (confidence adjusted, reopen flagged) -- consumer persists these
 */
export function decayDispositions({ dispositions, sections, decay = 0.6, reopenBelow = 0.3, minJudges = 2 }) {
  const suppressed = sections.flatMap((s) => s.suppressed || []);
  return dispositions.map((d) => {
    const conf = d.confidence ?? 1;
    // Recurrence is detected with the SAME matcher that suppressed the finding
    // (matchesDisposition: substring overlap + mode/category pins), not an exact
    // target lookup -- otherwise a substring-matched suppression ("presence label"
    // disposition vs a "presence label region" finding) suppresses but never
    // decays, silently dead-ending the re-open path. nj = strongest recurrence.
    const nj = suppressed.reduce((m, g) => (matchesDisposition(g, [d]) ? Math.max(m, judgeCount(g)) : m), 0);
    if (d.disposition === "fixed" && nj >= minJudges) {
      const nc = conf * decay;
      return { ...d, confidence: nc, reopen: nc < reopenBelow };
    }
    return { ...d, confidence: conf, reopen: false };
  });
}
