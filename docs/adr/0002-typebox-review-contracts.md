---
status: accepted
date: 2026-08-28
confidence: medium
extends: 0001
governs:
  - src/review-contract.*
  - src/structured-output.*
  - src/providers/**
  - package.json
why: Provider structured-output schemas, runtime validation, diagnostics, and TypeScript result types must describe the same review contract.
rejected:
  - Handwritten JSON Schema plus handwritten guards repeats the current source of contract drift.
  - TypeScript-only interfaces disappear at runtime and cannot be sent to providers as structured-output schemas.
  - A general validation framework would expand the dependency and API surface beyond the two review-boundary schemas.
review_trigger: Revisit if a supported provider rejects TypeBox-emitted schema constructs, TypeBox no longer supports the package TypeScript/Node matrix, or runtime cost becomes measurable.
---

# ADR 0002: Use TypeBox for review contracts

## Context

`src/review-contract.mjs` currently defines JSON Schema objects and separately
implements manual checks that return canonical scalar or comparison outcomes.
Those schemas are sent to capable providers, while the checks drive diagnostics
and the bounded repair loop. TypeScript declarations represent the shapes a
third time.

TypeBox 1.x is ESM-only, targets TypeScript 6/7, produces JSON Schema, infers
static types, and provides runtime value checking. Those properties match this
package's ESM and TypeScript 7 target. The current package name is `typebox`,
not the legacy `@sinclair/typebox` line. See the
[official TypeBox repository](https://github.com/sinclairzx81/typebox).

## Decision

Add the current TypeBox 1.x major as a production dependency and use it only at
the canonical review/provider boundary initially. Define scalar and comparison
schemas with TypeBox, infer their TypeScript types with `Type.Static`, send the
same JSON Schema objects to structured-output-capable providers, and validate
untrusted provider values with `Value.Check` followed by bounded `Value.Errors`
diagnostics on failure.

Keep the schemas private implementation details. Public consumers receive
generated TypeScript outcome types, not TypeBox-specific types. Preserve the
existing legacy scalar parse/diagnose/repair path; comparison output remains
structured-only. Do not use the JIT compiler unless profiling shows boundary
validation is material, and never compile a schema per provider request.

## Consequences

- One definition owns provider schema, runtime validity, and static outcome
  shape at the highest-risk boundary.
- TypeBox must remain in `dependencies`; the publish builder strips
  `devDependencies`.
- Provider capability negotiation remains separate because schema support is a
  provider/model property, not guaranteed by TypeBox.
- TypeBox is not permission to convert configuration, temporal state, or every
  legacy object into schemas.
- Diagnostic mapping must remain stable and bounded so repair prompts do not
  expose raw provider output or library-specific error detail.

## Alternatives considered

Keeping local schema literals avoids a dependency but retains three parallel
representations. TypeScript interfaces plus schema generation make emitted
schemas a build artifact and complicate runtime use. A broader validator such as
Ajv is unnecessary for the two small schemas while TypeBox provides direct
checking; this can be revisited if schema breadth or performance changes.

## Verification

- Existing valid scalar and comparison fixtures validate unchanged.
- Malformed fixtures produce stable diagnostic codes and enter the existing
  bounded repair retry.
- Generated schemas retain the strict fields and numeric bounds accepted by
  each provider capability path.
- A clean installation of the packed artifact resolves TypeBox and executes a
  real canonical parse without development dependencies.
- Package audit and size changes are recorded before the first release.

## Rollback

Replace the private TypeBox definitions with equivalent local JSON Schema and
guards while preserving the exported outcome types and diagnostic codes. No
consumer migration is required because TypeBox types are not public.
