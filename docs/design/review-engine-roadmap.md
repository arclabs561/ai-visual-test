---
status: proposal
scope: review engine modernization
grounded-in:
  - docs/design/review-engine-architecture.md
  - docs/judge-graph.md
  - .claude/reports/scrutinize-2026-08-28.md
review-trigger: after the current contract-hardening release or before any source-language migration
---

# Roadmap: Review engine modernization

## Current position

The public kernel is implemented and the current working tree is repairing its highest-risk contract defects. Canonical scalar and pairwise review schemas exist; structured-output negotiation distinguishes JSON Schema, JSON object, and prompt-only modes; malformed output enters a diagnostic repair retry; non-success provider envelopes are rejected; effective requests determine cache identity; cached results are normalized; pairwise fields survive the public boundary; ensemble dispatch is repaired; perception exposes partial and total provider failure; temporal/game state ownership is simplified; declarations and source/dist export maps are aligned; and verified dead human-validation and logging surfaces have been removed.

The full compatibility gate now passes: canonical unit, integration, security,
and end-to-end suites; strict declaration compilation; the actual obfuscated
publish build; package audit; packed-file inspection; and self-import smoke for
all 15 runtime routes. A fresh diff review found one declaration-gate blocker,
which was repaired with explicit subpath contracts and runtime/type export
parity tests. Phase 0 is committed locally and unreleased.

Phase 1 now has centralized stable static capture and order-counterbalanced
comparison with explicit conflict semantics. The human-reviewed repeatability
fixture harness now validates reproducibility metadata, asset hashes, independent
reviewer consensus, and offline agreement/abstention metrics; real screenshots
and human labels remain open and must not be fabricated. ADR 0001 and ADR 0002 accept the staged TypeScript
and TypeBox boundary decisions, subject to their packed Node 18 gates.

## Dependency map

```text
P0 contract hardening + QA
  -> P1 deterministic capture and pairwise reliability
       -> P2 TypeScript migration decision
            -> P3 contracts/providers conversion
                 -> P4 policies/integrations conversion
                      -> P5 public API narrowing

Human-labeled calibration can begin after P0 and informs P1/P5.
```

## Phase 0: Finish the current compatibility repair

**Consumer:** every existing CLI, matcher, and programmatic caller.

- Complete full repository checks, packed-package smoke, and fresh diff scrutiny.
- Verify scalar, pairwise, provider failure, repair retry, and cache cold/hit behavior at exported boundaries.
- Reconcile documentation with additive comparison and structured-output diagnostics.
- Keep live-provider checks opt-in; deterministic canned envelopes remain the CI authority.

**Reversibility:** reversible before release.

**Gate:** met locally. Canonical unit, integration, security, and build checks
pass; packed imports cover every declared route; declarations compile through
package self-resolution; runtime/declaration export names match; final review
has no unresolved correctness finding. Remote CI and release verification
remain delivery steps, not implementation work.

## Phase 1: Make screenshot regression evidence stable

**Consumer:** Playwright/Vitest/Jest users running visual regression in CI.

- Define one stable capture policy: settled network/fonts, bounded animation handling, masks/styles, viewport and environment metadata, with caller overrides.
- Add first-class A/B comparison counterbalancing. Evaluate both orders and return `indeterminate` when order changes the winner.
- Keep the numeric candidate/B score for compatibility, but document winner and disagreement as the primary pairwise evidence.
- Add a small human-reviewed fixture set to measure whether the new pairwise behavior improves alignment.

**Status:** the offline fixture protocol, validator, SHA-256 gate, real
counterbalance replay, and categorical metrics are implemented. The tracked
manifest is intentionally empty until real screenshots receive at least two
independent human reviews with auditable rationales.

**Reversibility:** partially reversible because capture defaults affect baselines.

**Gate:** repeat captures of stable fixtures agree; A/B and B/A conflicts are surfaced rather than averaged away; existing matcher semantics remain tested.

## Phase 2: Decide the TypeScript migration boundary

**Consumer:** package maintainers and downstream TypeScript users.

This structural fork is decided by
[ADR 0001](../adr/0001-staged-typescript-source.md) and
[ADR 0002](../adr/0002-typebox-review-contracts.md).

- **Option A — staged TypeScript (recommended):** convert contracts and provider adapters first, compile ESM and declarations into `dist/`, then migrate policies and integrations module by module. Best balance of correctness and reversibility.
- **Option B — remain `.mjs` + `checkJs`:** generate declarations from JSDoc and strengthen export tests. Lower tooling cost but retains more representational drift risk.
- **Option C — immediate rewrite:** shortest nominal path, largest review and regression surface. Not recommended.

The accepted path uses `.ts` to emitted `.js` under `NodeNext`, a mixed-source
staging tree, generated publish targets, and private TypeBox 1.x review schemas.
The canonical review contract is now the first converted boundary: TypeBox owns
its runtime schema and inferred static types, while the existing public result
shape and bounded legacy-repair behavior remain compatible.

**Reversibility:** partially reversible; published generated declarations create downstream expectations.

**Gate:** met locally. The mixed-source compiler emits executable ESM and
generated declarations; unit, integration, security, and end-to-end suites run
against the staged JavaScript; a clean packed install resolves all 15 runtime
routes and executes the installed CLI; CI repeats the packed-package gate on
Node 18. The last `.mjs` release remains the rollback boundary until publish.

**Guardrail satisfied:** Phase 3 may continue provider by provider, but no
converted boundary may land without the compiled and clean-packed gates in ADR
0001.

## Phase 3: Convert contracts and provider adapters

**Consumer:** all review policies, which require one trustworthy provider boundary.

- Make runtime schema definitions generate static scalar/comparison types.
- Introduce one canonical provider request and response-envelope interface.
- Move provider-specific request serialization, schema capability flags, response extraction, and HTTP error mapping behind adapters.
- Preserve the diagnostic-only legacy repair loop as an explicit capability.
- Delete each handwritten declaration only when its generated replacement passes the same public contract.

**Reversibility:** module-by-module until a release is published.

**Status:** the canonical scalar/comparison contract and provider wire boundary
are converted. Three typed protocol adapters now own request serialization,
model-aware structured-output capabilities, response envelopes, HTTP error
mapping, and usage extraction for all five supported provider names. Judge
policy, retry/repair, cache, normalization, and public methods remain outside.
An opt-in live Groq/Qwen screenshot review verified the complete capture-to-CLI
path: model-aware JSON-object negotiation with reasoning disabled produced a
canonical result without repair retries. Dogfooding also exposed and closed a
public normalization leak where recommendation strings became rich objects;
flat strings remain canonical and rich metadata is now additive.
Structured-output negotiation now also compiles from TypeScript. Screenshot and
video parsing call the selected adapter directly; duplicated response-format
logic is gone, while provider-specific forwarding methods retain a documented
deprecation window. Root result, context, configuration, and semantic contracts
now also come from generated TypeScript declarations. Phase 3 is locally
complete; removal of forwarding methods is deliberately reserved for a major
release after the deprecation window.

**Gate:** every supported provider passes canned capability/envelope matrices, including arbitrary model override fallback; no provider switch remains above the adapter boundary.

## Phase 4: Convert policies and integrations

**Consumer:** scalar assertions, pairwise regression, ensembles, temporal/game users, perception discovery, and test-framework integrations.

- Convert scalar, pairwise, ensemble, and temporal policies without merging their semantics.
- Keep perception's injected image/text capability boundary and ranked-section result.
- Make CLI, Playwright, Vitest/Jest, and video adapters thin consumers of policy results.
- Retire duplicated logger/config/cache authority only where production callers are proven migrated.

**Reversibility:** partially reversible across published subpaths.

**Gate:** compiled public-route tests, fixture-backed policy tests, and consumer examples pass without handwritten declaration overlays.

## Phase 5: Deliberately narrow the product surface

**Consumer:** maintainers and actual downstream users, not hypothetical callers.

- Survey external and sibling consumers before changing any public subpath.
- Decide whether game, broad utilities, session-cost tracking, and research/evaluation machinery belong in the core package, an optional package, or the research harness.
- Remove compatibility aliases only in a deliberate major version.
- Use human-labeled screenshot data to decide which confidence, ensemble, and calibration features deserve supported status.

**Reversibility:** one-way for removed public APIs.

**Gate:** consumer-impact inventory, migration notes, major-version decision, and held-out evidence for any calibration claims.

## Parallel evidence work

Human labeling has a real consumer: validating pairwise decisions and confidence claims. Build a small, versioned screenshot set with baseline/candidate pairs, human preference, rubric, environment metadata, and provider/model identity. It should inform Phase 1 behavior and Phase 5 scope; it must not block Phase 0 correctness repairs.

## Explicitly parked

- Prediction-powered perception auditing and learned judge aggregation remain governed by `docs/judge-graph.md`; they require a gold set and are not pulled into core hardening.
- Utility-barrel narrowing and session-cost tracking disposition wait for consumer evidence.
- Aesthetic auto-fix and autonomous remediation remain out of scope.

## Review trigger

Re-run this roadmap after Phase 0 lands, when the TypeScript ADR is accepted or rejected, or when a consumer survey changes the supported-surface assumptions.
