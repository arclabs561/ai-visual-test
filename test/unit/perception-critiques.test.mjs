import { test } from "node:test";
import assert from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendCritique, readLedger, ledgerToDispositions } from "../../src/perception/index.js";

test("appendCritique + readLedger round-trips, anchored to the version key", () => {
  const dir = mkdtempSync(join(tmpdir(), "crit-"));
  const ledger = join(dir, "c.jsonl");
  appendCritique(ledger, { version: "abc123", critique: "the rain bars look weird" }, "2026-06-14T00:00:00Z");
  appendCritique(ledger, { version: "def456", critique: "weather is crunched", status: "addressed" }, "2026-06-14T01:00:00Z");
  const rows = readLedger(ledger);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].version, "abc123");       // anchored to the version it references
  assert.equal(rows[0].status, "open");          // default
  assert.equal(rows[1].status, "addressed");
  rmSync(dir, { recursive: true, force: true });
});

test("ledgerToDispositions: open critique -> known finding, addressed -> suppressed", () => {
  const dir = mkdtempSync(join(tmpdir(), "crit-"));
  const ledger = join(dir, "c.jsonl");
  appendCritique(ledger, { version: "v1", critique: "blue rain bars are weird" }, "t");
  appendCritique(ledger, { version: "v2", critique: "weather crunched", status: "addressed" }, "t");
  const open = ledgerToDispositions(ledger);                 // onlyOpen default
  assert.equal(open.length, 1);
  assert.equal(open[0].disposition, "operator-critique");
  const all = ledgerToDispositions(ledger, { onlyOpen: false });
  assert.equal(all.length, 2);
  assert.equal(all.find((d) => d.reason.includes("crunched")).disposition, "rejected"); // addressed -> suppress
  rmSync(dir, { recursive: true, force: true });
});

test("readLedger on a missing file -> []", () => {
  assert.deepEqual(readLedger(join(tmpdir(), "does-not-exist-xyz.jsonl")), []);
});

test("appendCritique requires critique text", () => {
  assert.throws(() => appendCritique(join(tmpdir(), "x.jsonl"), { version: "v" }), /critique text required/);
});
