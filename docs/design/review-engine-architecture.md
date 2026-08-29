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

The package now uses staged TypeScript source for its public and core boundaries,
emits native ESM JavaScript plus generated declarations, and retains a small set
of private `.mjs` implementation leaves. It publishes a root entry and multiple
feature subpaths. Playwright, Vitest/Jest, the CLI, video, game, temporal review,
ensembles, and perception all consume or extend parts of the review behavior.

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

Use a contract-first architecture now and adopt TypeScript source through the staged build and compatibility rules in [ADR 0001](../adr/0001-staged-typescript-source.md). Use private TypeBox review schemas under [ADR 0002](../adr/0002-typebox-review-contracts.md).

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

Source becomes `.ts` incrementally and compiles as ESM with `module` and `moduleResolution` set to `NodeNext`, strict checking, declaration maps, source maps, `exactOptionalPropertyTypes`, and `noUncheckedIndexedAccess`. A mixed-source staging tree keeps migration commits runnable on Node 18. Package exports in the published artifact point only to files actually emitted into `dist`; a generated manifest replaces the current extension-blind copy.

Private TypeBox 1.x schemas are the source of truth for provider JSON Schema, runtime validation, and static scalar/comparison types. Provider capability negotiation and the legacy scalar repair loop remain separate policies. TypeBox remains a production dependency and is verified from a clean packed install.

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

- Which advanced surfaces remain supported public product features after consumer usage is measured?

---
Decided: 2026-08-28 | Status: accepted by ADR 0001 and ADR 0002
