---
status: draft
scope: review engine, provider boundary, package architecture, source modernization
grounded-in:
  - README.md
  - docs/judge-graph.md
  - .claude/reports/scrutinize-2026-08-28.md
---

# Design: Review engine architecture

## Problem

`ai-visual-test` has a useful product kernel: capture one or more screenshots, ask a vision model a natural-language question, and return an actionable result. The implementation grew several partially overlapping paths around that kernel. Provider envelopes, free-text parsing, structured results, caching, comparison, ensembles, temporal processing, integrations, and declarations could each reinterpret the same review differently.

The immediate failures were contract failures rather than missing features: comparison fields were discarded, non-success HTTP responses could look like successful empty judgments, cache identity omitted evaluation inputs, cached results bypassed normalization, ensemble dispatch called the wrong method, and the hand-maintained root declaration file advertised runtime APIs that did not exist.

## Context

The package is currently native ESM JavaScript (`.mjs`) with a strict `checkJs` TypeScript configuration and hand-maintained `.d.ts` files. It publishes a root entry and multiple feature subpaths. Playwright, Vitest/Jest, the CLI, video, game, temporal review, ensembles, and perception all consume or extend parts of the review behavior.

External evidence and the repository's own probes favor pairwise comparison over absolute scoring for regressions, strict structured output where a model supports it, explicit disagreement rather than hidden averaging, and deterministic canned provider fixtures in CI. They do not justify treating model confidence or ensemble weights as calibrated truth without screenshot-specific human labels.

The current cleanup pass has already established a narrow compatibility seam: canonical scalar and comparison schemas; capability-aware schema requests; a bounded legacy parse/diagnose/repair loop; canonical results before caching; effective-request cache identity; additive comparison fields; and explicit perception failure diagnostics.

## Non-goals

- A mechanical whole-repository `.mjs` to `.ts` conversion in the current cleanup. It would preserve ambiguity behind casts and make review harder.
- Collapsing scalar assertions, pairwise regression, ensembles, and perception discovery into one policy. They may share contracts and provider adapters, but their decisions and failure semantics differ.
- Removing or redesigning the public temporal subpath during core hardening. Only duplicated state ownership and demonstrated defects are in scope.
- Making VLM judgment the deterministic visual-diff gate. Pixel/layout checks and stable capture remain complementary evidence.
- Auto-applying visual fixes or owning aesthetic taste. The library reports evidence; consumers and operators decide.

## Options considered

### Keep `.mjs` permanently with stronger JSDoc and declarations

This is the smallest operational change and can be made reliable with `checkJs`, generated declarations, and public export tests. It remains easy for runtime shapes and declaration shapes to drift when provider unions and feature subpaths evolve.

### Staged migration to TypeScript source

Stabilize runtime contracts first, then convert inward from the provider and contract seams. Compile ESM JavaScript and declarations into `dist/`; preserve the package's import surface throughout. This adds a build step but makes illegal review states, provider envelope translation, and public declarations substantially easier to keep aligned.

### Immediate TypeScript rewrite

This reaches the target quickly in calendar terms but combines behavioral repair, packaging changes, type design, and a language migration in one difficult-to-review change. Rejected.

### Reimplement in Rust or Python

Neither fits the primary consumers as well as TypeScript. Playwright, npm test runners, browser screenshots, and JS callbacks are the natural boundary of this package. Rejected.

## Chosen approach

Use a contract-first architecture now and adopt TypeScript source as the target implementation through a staged migration, subject to a dedicated migration decision before conversion begins.

The stable kernel is:

```text
ReviewRequest
  -> provider capability negotiation
  -> provider adapter
  -> transport envelope validation
  -> canonical schema validation
     -> bounded legacy parse/diagnose/repair fallback
  -> ReviewOutcome
  -> policy (scalar, pairwise, ensemble, temporal, perception)
  -> integration adapter
```

`ReviewOutcome` is discriminated. Scalar outcomes contain score, assessment, reasoning, issues, recommendations, and strengths. Comparison outcomes contain winner, per-side scores, confidence, differences, and reasoning. During compatibility, comparison also exposes the candidate/B score through the existing scalar `score` field so current matchers do not silently fail.

Providers own protocol translation: request serialization, authentication, model-specific structured-output flags, response extraction, and HTTP failure mapping. Known-capable models receive native JSON Schema requests. Models with uncertain schema support receive JSON-object mode. Providers without a safe native mode receive an explicit prompt-only capability state. Unsupported model overrides must be observable; they must not enter an opaque retry storm.

The compatibility loop is a supported boundary, not an incidental regex pile. It parses realistic sectioned text without crossing section ownership, emits bounded diagnostic codes, and retries with a trusted repair instruction. Raw provider output is never copied into the repair prompt.

Cache identity is the rendered request, not the caller's initial prompt. It includes target and reference image content, final composed prompt, provider, model, review kind, and negotiated output mode. Only normalized canonical results are cached, and cache hits pass through the same public normalizer as cold results.

Policies remain separate. Pairwise comparison should eventually counterbalance image order and report `indeterminate` on conflicting order-sensitive verdicts. Perception retains independently injected image and text capabilities and its ranked-section result. Temporal retains its public surface with one state owner per processor.

## TypeScript target

If the migration gate is accepted, source becomes `.ts` compiled as ESM with `module` and `moduleResolution` set to `NodeNext`, strict checking, declaration maps, source maps, `exactOptionalPropertyTypes`, and `noUncheckedIndexedAccess`. Package exports point only to built `dist/` runtime and declaration files. The build inherits one export manifest instead of maintaining a second hand-written map.

Runtime schemas should be the source of truth for both provider JSON Schema and static TypeScript types. The concrete schema library is intentionally undecided; TypeBox is the leading candidate because JSON Schema is native to its model, but adopting a new runtime dependency requires a focused decision and packed-package test.

## Tradeoffs

- The compatibility period carries both `.mjs` implementation and a TypeScript target, so discipline is needed to avoid designing the same boundary twice.
- Strong structured-output requests can reduce provider/model portability. Capability negotiation and observable fallback add code to preserve that portability.
- Richer cache fingerprints intentionally reduce hit rates when semantically relevant inputs change.
- Preserving additive compatibility fields makes the result type wider until a future major version can expose cleaner policy-specific return types.

## Implementation plan

1. Stabilize and test the canonical contracts in the existing `.mjs` implementation. Reversible.
2. Make source and packed export/type surfaces truthful and test every route. Reversible.
3. Centralize deterministic screenshot capture and pairwise order counterbalancing. Partially reversible because consumers may rely on defaults.
4. Decide the TypeScript build/schema toolchain in an ADR, then convert contracts and provider adapters first. Partially reversible after published declarations depend on generated output.
5. Convert policies and integrations incrementally, deleting corresponding hand declarations after each boundary passes packed-consumer tests. Reversible per module until release.
6. Consider a major-version API narrowing only after consumer impact is measured. One-way for downstream consumers.

## Decision gates

- Do not begin source conversion until a dedicated decision records build layout, schema source of truth, compatibility policy, and rollback procedure.
- Every converted or refactored boundary must pass deterministic scalar, pairwise, HTTP failure, malformed-output repair, cache cold/hit, and packed-import tests.
- Reconsider the TypeScript target if declaration generation cannot preserve every supported subpath without casts or handwritten overlays.
- Do not present confidence or ensemble weights as calibrated until a held-out human-labeled screenshot set demonstrates calibration.
- Do not narrow a published subpath without a consumer survey and a deliberate major-version decision.

## Open questions

- Which schema tool should own runtime validation and JSON Schema generation: TypeBox, another library, or a small local schema subset?
- Should compiled output use `.js` under `type: module` or `.mjs` from `.mts` sources?
- Which advanced surfaces remain supported public product features after consumer usage is measured?

---
Decided: 2026-08-28 | Status: proposed pending TypeScript migration gate
