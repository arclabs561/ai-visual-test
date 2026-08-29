import { test } from "node:test";
import assert from "node:assert/strict";
import { formatReport, samplePerceptions } from "../../src/perception/index.js";

const persona = { id: "operator", who: "an operator", weight: 1 };
const context = { id: "routine", ctx: "during routine use" };
const validFinding = {
  headline: "The label is too small",
  category: "major",
  target: "temperature label",
  why: "It is difficult to read at a glance.",
  suggestion: "Increase the label size.",
  confidence: 0.7,
};

function samplingConfig(overrides = {}) {
  return {
    vision: async () => validFinding,
    modes: ["problem"],
    personas: [persona],
    contexts: [context],
    n: 1,
    verify: false,
    ...overrides,
  };
}

test("samplePerceptions rejects malformed findings at the provider boundary", async () => {
  const result = await samplePerceptions(samplingConfig({
    vision: async () => ({
      headline: "Looks wrong",
      category: "major",
      target: "temperature label",
      confidence: 2,
    }),
  }));

  assert.deepEqual(result.samples, [], "untrusted output is never accepted as a finding");
  assert.equal(result.diagnostics.status, "unavailable");
  assert.deepEqual(result.diagnostics.sampling, {
    attempted: 1,
    completed: 0,
    accepted: 0,
    failed: 1,
  });
  const failure = result.diagnostics.failures[0];
  assert.equal(failure.phase, "sampling");
  assert.ok(failure.diagnostics.includes("invalid_finding"), "the failure is machine-actionable, not merely a free-text error");
  assert.ok(failure.diagnostics.includes("missing_why"));
  assert.ok(failure.diagnostics.includes("missing_suggestion"));
  assert.ok(failure.diagnostics.includes("invalid_confidence"));
});

test("samplePerceptions performs one diagnostic-only contract repair with the same native schema", async () => {
  const calls = [];
  const result = await samplePerceptions(samplingConfig({
    vision: async (_system, prompt, _temperature, task) => {
      calls.push({ prompt, task });
      return calls.length === 1 ? { headline: "RAW_OUTPUT_MARKER" } : validFinding;
    },
  }));

  assert.equal(result.samples.length, 1);
  assert.equal(result.diagnostics.status, "ok");
  assert.equal(calls.length, 2);
  assert.equal(calls[0].task.name, "perception_problem");
  assert.equal(calls[1].task.name, "perception_problem");
  assert.equal(calls[0].task.schema, calls[1].task.schema);
  assert.match(calls[1].prompt, /OUTPUT CONTRACT REPAIR.*missing_why/s);
  assert.doesNotMatch(calls[1].prompt, /RAW_OUTPUT_MARKER/);
});

test("samplePerceptions treats a malformed verifier answer as unadjudicated", async () => {
  let calls = 0;
  const result = await samplePerceptions(samplingConfig({
    vision: async () => {
      calls++;
      return calls === 1 ? validFinding : { reason: "I cannot determine that." };
    },
    verify: true,
  }));

  const finding = result.sections[0].top[0];
  assert.equal(finding.verified, null, "a missing refuted boolean must never become an implicit confirmation");
  assert.equal(result.diagnostics.verification.attempted, 1);
  assert.equal(result.diagnostics.verification.completed, 0);
  assert.equal(result.diagnostics.verification.failed, 1);
  const failure = result.diagnostics.failures.find(({ phase }) => phase === "verification");
  assert.ok(failure?.diagnostics.includes("invalid_verifier_verdict"));
  assert.ok(failure?.diagnostics.includes("invalid_refuted"));
});

test("samplePerceptions rejects invalid controls before invoking providers", async () => {
  const invalidConfigs = [
    { concurrency: 0 },
    { topK: -1 },
    { n: 1.5 },
    { personas: [{ ...persona }, { ...persona }] },
    { personas: [{ ...persona, id: "" }] },
    { contexts: [{ ...context }, { ...context }] },
    { contexts: [{ ...context, id: "" }] },
    { personas: [{ ...persona, weight: Number.NaN }] },
    { personas: [{ ...persona, weight: -0.1 }] },
    { panel: [{ id: "judge", weight: Infinity }] },
    { contractRetries: 3 },
  ];

  for (const invalid of invalidConfigs) {
    let calls = 0;
    const panel = invalid.panel?.map((judge) => ({
      ...judge,
      vision: async () => {
        calls++;
        return validFinding;
      },
    }));
    await assert.rejects(
      () => samplePerceptions(samplingConfig({
        vision: async () => {
          calls++;
          return validFinding;
        },
        ...invalid,
        ...(panel ? { panel } : {}),
      })),
      /samplePerceptions/,
    );
    assert.equal(calls, 0, `invalid controls must fail before a provider call: ${JSON.stringify(invalid)}`);
  }
});

test("samplePerceptions reports a malformed merge after its bounded repair", async () => {
  const tasks = [];
  let sampleCall = 0;
  const result = await samplePerceptions(samplingConfig({
    n: 2,
    vision: async () => ({ ...validFinding, target: `temperature label ${++sampleCall}` }),
    complete: async (_system, _prompt, _temperature, task) => {
      tasks.push(task);
      return { clusters: [[0]] };
    },
  }));

  assert.equal(tasks.length, 2);
  assert.ok(tasks.every((task) => task.name === "perception_merge"));
  assert.deepEqual(result.diagnostics.merge, { attempted: 1, completed: 0, failed: 1 });
  const failure = result.diagnostics.failures.find(({ phase }) => phase === "merge");
  assert.equal(failure?.diagnostic, "invalid_merge_clusters");
  assert.equal(failure?.attempts, 2);
  assert.equal(result.diagnostics.status, "partial");
});

test("formatReport renders JSON-round-tripped aggregate collections", () => {
  const report = formatReport({
    samples: [{ mode: "problem", category: "major" }],
    sections: [{
      mode: "problem",
      top: [{
        category: "major",
        target: "temperature label",
        count: 1,
        score: 0.7,
        heads: ["The label is too small"],
        sugg: ["Increase the label size"],
        judges: ["provider/judge"],
        roles: ["operator"],
        verified: true,
      }],
    }],
  });

  assert.match(report, /1j score=0\.70/);
  assert.match(report, /judges=judge, roles=operator/);
  assert.match(report, /"The label is too small"/);
});
