import assert from "node:assert/strict";
import { test } from "node:test";
import { selectForReview } from "../../src/perception/learn.js";
import { formatReport } from "../../src/perception/report.js";

test("selectForReview accepts serialized judge arrays as well as in-memory Sets", () => {
  const selected = selectForReview([{
    top: [
      { mode: "problem", category: "major", target: "solo", heads: ["one"], judges: ["a/j"], verified: true },
      { mode: "problem", category: "major", target: "consensus", heads: ["two"], judges: ["a/j", "b/j"], verified: true },
    ],
  }], { panelSize: 2, k: 2 });

  assert.equal(selected[0]?.target, "solo");
  assert.deepEqual(selected[0]?.judges, ["a/j"]);
  assert.equal(selected[0]?.disagreement, 0.5);
});

test("formatReport renders serialized collections and malformed display fields without throwing", () => {
  const report = formatReport({
    samples: [{ mode: "problem", category: "major" }],
    sections: [{
      mode: "problem",
      top: [{
        mode: "problem",
        category: null,
        target: null,
        count: null,
        mass: Number.NaN,
        heads: [null],
        sugg: [null],
        judges: ["vendor/model"],
        roles: ["operator"],
        verified: null,
      }],
    }],
  });

  assert.match(report, /1j score=n\/a/);
  assert.match(report, /judges=model, roles=operator/);
});

test("formatReport preserves malformed section failures instead of treating them as empty data", () => {
  assert.throws(
    () => formatReport({ samples: [], sections: [{ mode: "problem" }] }),
    TypeError,
  );
});
