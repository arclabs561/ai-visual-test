import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregate, parseJsonObject, MODE_SPEC } from "../../src/perception/index.mjs";

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

test("MODE_SPEC has all three modes with usable sys + user(persona,context)", () => {
  for (const m of ["question", "problem", "insight"]) {
    assert.equal(typeof MODE_SPEC[m].sys, "string");
    const u = MODE_SPEC[m].user({ who: "a viewer", weight: 1 }, { ctx: "some moment" });
    assert.ok(u.includes("a viewer") && u.includes("some moment"), "persona + context interpolated");
    assert.ok(u.includes("JSON"), "asks for JSON output");
  }
});
