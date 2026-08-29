---
status: accepted
date: 2026-08-29
confidence: medium
extends: 0001
governs:
  - package.json
  - scripts/*.mjs
  - src/**/index.ts
  - test/types/**
  - test/unit/package-exports.test.mjs
why: Generated public declarations now resolve directly; any future handwritten composition overlay needs a fresh, explicit decision.
rejected:
  - Converting every export behind a public subpath in one commit couples unrelated policy changes and removes the module-sized rollback boundary required by ADR 0001.
  - Generating declarations from unchecked JavaScript makes inferred legacy shapes authoritative without proving that they match runtime behavior.
  - Permanent handwritten subpath declarations recreate the runtime/type drift that staged TypeScript is intended to remove.
review_trigger: Revisit if more than one public subpath needs a composition overlay at once, an overlay remains after its last JavaScript export migrates, or a packed strict TypeScript consumer cannot resolve the composed declarations.
---

# ADR 0003: Allow temporary declaration composition overlays

## Context

ADR 0001 requires module-sized TypeScript migrations and generated public
declarations, and asks for review if a supported subpath cannot be preserved
without a handwritten overlay. The team invoked that review while migrating the
`./ensemble` subpath. Its judge implementation and contract moved to
TypeScript, while the same public barrel still re-exports unchanged bias and
research helpers from JavaScript modules. Its already-converted counterbalance
helpers are composed from their generated declaration through a private alias.

Migrating all of those helpers together would turn a typed judge-boundary
change into a broader policy rewrite. Emitting declarations from the unchanged
JavaScript with `checkJs` disabled would instead publish weak inferred shapes.
After evaluating a whole-subpath conversion and unchecked JavaScript declaration
emission, the implemented boundary instead composes the generated judge and
counterbalance declarations with explicit declarations for only the
still-JavaScript exports, then proves the result from a clean packed installation.

## Decision

A public subpath may temporarily use one handwritten declaration composition
overlay while it contains both converted TypeScript exports and unchanged
JavaScript exports.

The overlay must:

- re-export converted values and types from their generated declaration through
  the same package-private alias used by runtime code;
- declare only the unchanged JavaScript exports, with signatures checked
  against their implementations and exercised by a strict consumer fixture;
- preserve exact public value-name parity with the runtime barrel;
- compile with `skipLibCheck: false` from a clean installation of the packed
  package; and
- be removed when the subpath's final JavaScript export migrates, at which point
  the package route must point directly to the generated barrel declaration.

An overlay is compatibility glue, not a generated-declaration completion. It
must not redeclare a converted contract, use opaque placeholders for a newly
typed boundary, or become a general location for public types.

## Consequences

- TypeScript conversion can remain module-sized when a public barrel groups
  several independently owned policies.
- The mixed period still has one deliberate handwritten surface, so package
  consumer compilation and runtime/type export parity are release gates rather
  than optional checks.
- The roadmap must name each live overlay and the remaining JavaScript exports
  that keep it necessary.
- A second simultaneous overlay reopens this decision instead of normalizing a
  growing parallel declaration system.

## Alternatives considered

Convert the entire public subpath atomically. This removes the overlay but
combines independent behavior, type, and packaging changes, contrary to the
reviewable rollback slices chosen in ADR 0001.

Generate declarations for the unchanged JavaScript barrel. With `allowJs`
enabled but `checkJs` disabled, this makes incomplete JSDoc inference part of
the public contract and pulls legacy declaration errors into otherwise strict
consumer checks.

Keep a permanent handwritten declaration for the subpath. This preserves the
old duplication and allows converted runtime contracts to drift from their
public types, so it is rejected.

## Verification

- The generated TypeScript declaration remains the only definition of every
  converted value and type.
- A declaration consumer calls each explicitly declared legacy helper using
  its real argument and result shape.
- Runtime and declaration value exports match for the subpath.
- A clean packed install imports the runtime subpath and compiles a strict
  TypeScript consumer with `skipLibCheck: false`.
- The roadmap records the overlay as open migration debt until removal.

## Rollback

Before release, revert the module-sized TypeScript conversion and restore the
previous subpath declaration. After release, preserve the public names while
either migrating the remaining JavaScript exports and deleting the overlay, or
restoring the last compatible implementation behind the same subpath.

## Update (2026-08-29)

The only overlay was removed after its remaining JavaScript exports migrated.
`./ensemble` now routes directly to generated declarations and the packed
runtime/type parity gate remains required. This temporary exception is
fulfilled; a future overlay requires a fresh ADR.
