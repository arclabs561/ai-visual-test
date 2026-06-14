import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregate, parseJsonObject, MODE_SPEC, matchesDisposition, makePanel, calibrateJudges, decayDispositions } from "../../src/perception/index.mjs";

test("aggregate groups by (category,target) and ranks by role-weighted confidence mass", () => {
  const samples = [
    { mode: "question", category: "GAP", target: "door status", role: "operator", weight: 1.0, confidence: 0.9, headline: "how long open?", suggestion: "show duration" },
    { mode: "question", category: "GAP", target: "Door Status!", role: "adult", weight: 1.0, confidence: 0.8, headline: "open how long?", suggestion: "duration" },
    { mode: "question", category: "UI", target: "clock", role: "guest", weight: 0.4, confidence: 0.5, headline: "is that the time?", suggestion: "bigger" },
    { mode: "problem", category: "major", target: "elsewhere", role: "operator", weight: 1, confidence: 1, headline: "x", suggestion: "y" },
  ];
  const ranked = aggregate(samples, "question");
  assert.equal(ranked.length, 2, "two question groups (door merged, clock); problem excluded");
  const door = ranked[0];
  assert.equal(door.target, "door status", "punctuation/case normalized so the two door samples merge");
  assert.equal(door.count, 2);
  assert.ok(Math.abs(door.mass - (1.0 * 0.9 + 1.0 * 0.8)) < 1e-9, "mass = sum of weight*confidence");
  assert.ok(door.mass > ranked[1].mass, "higher-mass finding ranks first");
  assert.deepEqual([...door.roles].sort(), ["adult", "operator"]);
});

test("aggregate excludes other modes", () => {
  const samples = [{ mode: "insight", category: "insight", target: "a", role: "x", weight: 1, confidence: 1, headline: "h" }];
  assert.equal(aggregate(samples, "question").length, 0);
});

test("aggregate defaults missing weight/confidence (doesn't NaN the mass)", () => {
  const ranked = aggregate([{ mode: "problem", category: "minor", target: "t", role: "r", headline: "h" }], "problem");
  assert.equal(ranked.length, 1);
  assert.ok(Number.isFinite(ranked[0].mass) && ranked[0].mass > 0);
});

test("parseJsonObject strips code fences", () => {
  assert.deepEqual(parseJsonObject('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseJsonObject('{"b":2}'), { b: 2 });
});

test("matchesDisposition: mode pin + overlapping target, category pin, no-match", () => {
  const disp = [
    { mode: "problem", target: "temperature panel", disposition: "rejected", reason: "intended behavior, not a defect" },
    { target: "status label", disposition: "rejected", reason: "intentional label, not a typo" },
  ];
  // mode matches + target substring overlap ("temperature panel" inside the finding target)
  assert.ok(matchesDisposition({ mode: "problem", category: "major", target: "indoor temperature panel" }, disp));
  // mode-pinned disposition does NOT match a different mode
  assert.equal(matchesDisposition({ mode: "question", category: "GAP", target: "temperature panel region" }, disp.slice(0, 1)), null);
  // unpinned (no mode) disposition matches any mode on target overlap
  assert.ok(matchesDisposition({ mode: "problem", category: "major", target: "status label region" }, disp));
  // no target overlap -> null
  assert.equal(matchesDisposition({ mode: "problem", target: "weather chart" }, disp), null);
  // empty dispositions -> null, never throws
  assert.equal(matchesDisposition({ mode: "problem", target: "x" }), null);
});

test("aggregate: jury diversity outranks single-judge repetition at equal mass", () => {
  // finding A: same mass split across two DISTINCT judges; finding B: same mass from one judge.
  const samples = [
    { mode: "problem", category: "major", target: "alpha", role: "operator", weight: 1, confidence: 0.5, judge: "google/g", headline: "a1", suggestion: "fix" },
    { mode: "problem", category: "major", target: "alpha", role: "adult", weight: 1, confidence: 0.5, judge: "anthropic/c", headline: "a2", suggestion: "fix" },
    { mode: "problem", category: "minor", target: "beta", role: "operator", weight: 1, confidence: 0.5, judge: "google/g", headline: "b1", suggestion: "fix" },
    { mode: "problem", category: "minor", target: "beta", role: "adult", weight: 1, confidence: 0.5, judge: "google/g", headline: "b2", suggestion: "fix" },
  ];
  const ranked = aggregate(samples, "problem");
  assert.equal(ranked[0].target, "alpha", "two-judge finding ranks above the equal-mass one-judge finding");
  assert.equal(ranked[0].judges.size, 2);
  assert.ok(Math.abs(ranked[0].mass - ranked[1].mass) < 1e-9, "masses are equal; only the diversity factor separates them");
  assert.ok(ranked[0].score > ranked[1].score, "diversity factor (log2 distinct judges) breaks the tie toward decorrelated agreement");
});

test("aggregate: single-judge callers (no s.judge) collapse to mass ranking (score==mass)", () => {
  const ranked = aggregate([{ mode: "problem", category: "minor", target: "t", role: "r", weight: 1, confidence: 0.7, headline: "h" }], "problem");
  assert.equal(ranked[0].judges.size, 1, "absent judge => single 'default' judge");
  assert.ok(Math.abs(ranked[0].score - ranked[0].mass) < 1e-9, "1 judge => diversity factor of 1, score == mass (back-compat)");
});

test("makePanel builds one judge entry per model with id/weight/vision", () => {
  const panel = makePanel({ apiKey: "k", imageBase64: "Zm9v", models: ["google/gemini-3.5-flash", { id: "anthropic/claude-haiku-4.5", weight: 1.3 }] });
  assert.equal(panel.length, 2);
  assert.equal(panel[0].id, "google/gemini-3.5-flash");
  assert.equal(panel[0].weight, 1, "string model defaults weight 1");
  assert.equal(panel[1].weight, 1.3, "object model carries its reliability weight");
  assert.ok(panel.every((j) => typeof j.vision === "function"), "each entry has a callable vision fn");
});

test("calibrateJudges: survivors gain weight, refuted judges lose it but never below floor", () => {
  const sections = [{
    mode: "problem",
    top: [
      { judges: new Set(["good/j"]), verified: true },
      { judges: new Set(["good/j"]), verified: true },
      { judges: new Set(["bad/j"]), verified: false },
      { judges: new Set(["bad/j"]), verified: false },
      { judges: new Set(["unadjudicated/j"]), verified: null }, // ignored
    ],
  }];
  const w = calibrateJudges({ prior: { "good/j": 1, "bad/j": 1 }, sections, lr: 0.5, floor: 0.25, ceil: 2 });
  assert.ok(w["good/j"] > 1, "all-verified judge moves above its prior toward the ceiling");
  assert.ok(w["bad/j"] < 1, "all-refuted judge moves below its prior");
  assert.ok(w["bad/j"] >= 0.25, "but never below the floor (calibrate, not curate)");
  assert.equal(w["unadjudicated/j"], undefined, "a judge with only null-verdict findings does not move");
});

test("calibrateJudges: EMA blends with prior rather than replacing it", () => {
  const sections = [{ top: [{ judges: new Set(["j"]), verified: true }] }];
  const w = calibrateJudges({ prior: { j: 1 }, sections, lr: 0.3, floor: 0.25, ceil: 2 });
  // reliability for a 100%-survival judge = ceil (2); EMA: 1*0.7 + 2*0.3 = 1.3
  assert.ok(Math.abs(w.j - 1.3) < 1e-9, "weight = prior*(1-lr) + reliability*lr");
});

test("decayDispositions: a regressed 'fixed' disposition decays + re-opens; 'rejected' never decays", () => {
  const dispositions = [
    { target: "weather chart", disposition: "fixed", confidence: 0.5 },
    { target: "presence label", disposition: "rejected", confidence: 1 },
  ];
  const sections = [{ suppressed: [
    { target: "weather chart", judges: new Set(["a/j", "b/j"]) }, // recurs, 2 distinct judges
    { target: "presence label", judges: new Set(["a/j", "b/j"]) }, // recurs too, but rejected
  ] }];
  const out = decayDispositions({ dispositions, sections, decay: 0.6, reopenBelow: 0.4, minJudges: 2 });
  assert.ok(Math.abs(out[0].confidence - 0.3) < 1e-9, "fixed disposition confidence *= decay on multi-judge recurrence");
  assert.equal(out[0].reopen, true, "decayed below reopenBelow -> flagged to re-open (anti-ossification)");
  assert.equal(out[1].confidence, 1, "rejected disposition (intended-by-design) never decays on recurrence");
  assert.equal(out[1].reopen, false);
});

test("decayDispositions: a 'fixed' recurrence from only ONE judge is not enough to re-open", () => {
  const out = decayDispositions({
    dispositions: [{ target: "weather chart", disposition: "fixed", confidence: 0.5 }],
    sections: [{ suppressed: [{ target: "weather chart", judges: new Set(["solo/j"]) }] }],
    minJudges: 2,
  });
  assert.equal(out[0].confidence, 0.5, "single-judge recurrence is below the decorrelation guard -> no decay");
  assert.equal(out[0].reopen, false);
});

test("MODE_SPEC has all three modes with usable sys + user(persona,context)", () => {
  for (const m of ["question", "problem", "insight"]) {
    assert.equal(typeof MODE_SPEC[m].sys, "string");
    const u = MODE_SPEC[m].user({ who: "a viewer", weight: 1 }, { ctx: "some moment" });
    assert.ok(u.includes("a viewer") && u.includes("some moment"), "persona + context interpolated");
    assert.ok(u.includes("JSON"), "asks for JSON output");
  }
});
