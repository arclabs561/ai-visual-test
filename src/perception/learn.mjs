/**
 * The learning half of the judge graph (all PURE; the consumer persists the
 * returned state and feeds it back next run): per-judge reliability calibration,
 * disposition decay / re-open, and active-learning selection of the findings most
 * worth a human label.
 */
import { judgeCount, matchesDisposition } from "./aggregate.mjs";

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
