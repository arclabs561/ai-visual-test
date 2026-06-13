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
 * Groups by (category, normalized target); ranks by role-weighted confidence mass.
 * Exported so callers (and tests) can re-rank or re-group without re-sampling.
 */
export function aggregate(samples, mode) {
  const groups = new Map();
  for (const s of samples.filter((x) => x.mode === mode)) {
    const key = `${s.category || mode}::${normTarget(s.target)}`;
    const g = groups.get(key) || { mode, category: s.category || mode, target: normTarget(s.target), count: 0, mass: 0, heads: [], sugg: [], roles: new Set() };
    g.count++;
    g.mass += (s.weight ?? 1) * (s.confidence ?? 0.5);
    g.heads.push(s.headline); g.sugg.push(s.suggestion); g.roles.add(s.role);
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => b.mass - a.mass);
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
 * aggregate, and adversarially verify the top findings.
 *
 * @param {object} cfg
 * @param {(sys:string,user:string,temperature:number)=>Promise<object>} cfg.vision  required
 * @param {string[]} [cfg.modes]      subset of ["question","problem","insight"]
 * @param {{id,who,weight}[]} cfg.personas   required (who = 2nd-person persona description; weight scales mass)
 * @param {{id,ctx}[]} cfg.contexts          required (glance contexts / moments)
 * @param {number} [cfg.n=2]          samples per cell
 * @param {number} [cfg.concurrency=10]
 * @param {number} [cfg.topK=6]       findings verified per mode
 * @param {boolean} [cfg.verify=true]
 * @param {string[]} [cfg.principles]  governing principles SEEDED into every prompt so the
 *                                     judge does not flag settled-by-design choices as defects
 * @param {{mode?,category?,target,disposition,reason}[]} [cfg.dispositions]  known findings to
 *                                     SUPPRESS from the surfaced set (convergence memory)
 * @returns {Promise<{samples:object[], sections:{mode,ranked,top,suppressed}[]}>}
 */
export async function samplePerceptions({ vision, modes = ["question", "problem", "insight"], personas, contexts, n = 2, concurrency = 10, topK = 6, verify = true, principles = [], dispositions = [] }) {
  if (typeof vision !== "function") throw new Error("samplePerceptions: vision fn required");
  if (!personas?.length || !contexts?.length) throw new Error("samplePerceptions: personas and contexts required");
  for (const m of modes) if (!MODE_SPEC[m]) throw new Error(`samplePerceptions: unknown mode '${m}'`);

  // Seed governing principles into every prompt (sampling AND verify) so the judge
  // treats settled-by-design choices as intended, not as problems/gaps/noise. This
  // is the upstream half of convergence; dispositions (below) are the downstream half.
  const seed = principles.length
    ? "\n\nDESIGN PRINCIPLES IN FORCE -- these are intended and correct; do NOT report them as problems, gaps, conflicts, or noise:\n- " + principles.join("\n- ")
    : "";

  const cells = [];
  for (const mode of modes) for (const persona of personas) for (const context of contexts) for (let s = 0; s < n; s++) cells.push({ mode, persona, context });
  const samples = (await pmap(cells, ({ mode, persona, context }) => {
    const spec = MODE_SPEC[mode];
    return vision(spec.sys + seed, spec.user(persona, context), 1.05).then((r) => ({ ...r, mode, role: persona.id, weight: persona.weight ?? 1, context: context.id }));
  }, concurrency)).filter((r) => r && !r._err && r.headline);

  const sections = [];
  for (const mode of modes) {
    const ranked = aggregate(samples, mode);
    const candidates = ranked.slice(0, Math.min(topK, ranked.length));
    if (verify && candidates.length) {
      const verdicts = await pmap(candidates, (g) => vision(VERIFY_SYS + seed, verifyUser(mode, { category: g.category, target: g.target, why: g.heads[0], suggestion: g.sugg[0] }), 0.1), 4);
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
  return { samples, sections };
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
      lines.push(`${String(i + 1).padStart(2)}. ${String(g.category).padEnd(9)} n=${String(g.count).padStart(2)} mass=${g.mass.toFixed(2)} ${v} ${g.target.slice(0, 26).padEnd(26)} ${g.heads[0].slice(0, 64)}`);
    });
    for (const g of top.filter((x) => x.verified !== false)) {
      lines.push(`\n  [${g.category}] ${g.target} (n=${g.count}, roles=${[...g.roles].join("/")}, verified=${g.verified})`);
      lines.push(`    ${g.heads.slice(0, 2).map((h) => `"${h}"`).join("  |  ")}`);
      if (mode !== "insight") lines.push(`    fix: ${g.sugg[0]}`);
      if (g.vreason) lines.push(`    verify: ${g.vreason}`);
    }
  }
  return lines.join("\n");
}
