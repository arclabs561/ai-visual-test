---
status: accepted
date: 2026-08-29
confidence: medium
extends: 0001
governs:
  - package.json
  - src/index.ts
  - src/game/index.ts
  - src/utils/index.ts
  - README.md
  - examples/*.mjs
  - test/types/*.ts
  - test/unit/package-exports.test.mjs
why: Live package examples, strict consumers, and sibling repositories use the supported game, utility, and overlapping root surfaces, while moving them now has no demonstrated consumer benefit.
rejected:
  - Moving game and utilities to a companion package during the current 0.x line adds package-version coordination and breaks every current subpath consumer.
  - Making advanced features research-only during the current 0.x line abandons documented game and utility workflows that still have live consumers.
  - Removing supported root overlaps immediately breaks sibling consumers and bypasses ADR 0001's consumer-survey and deliberate-breaking-release gate.
review_trigger: Revisit before 1.0 or another deliberately breaking release, if verified maintenance or security cost makes retention untenable, or if a new consumer inventory materially changes the evidence.
---

# ADR 0004: Retain game and utilities in the core package

## Context

The package introduced feature subpaths to keep the root API small while
preserving advanced capabilities. `./utils` was added as an organizational and
tree-shaking boundary, and `./game` was added when the root surface was reduced.
ADR 0001 subsequently required stable public subpaths throughout the staged
TypeScript migration and a separate consumer survey plus deliberate breaking
release before any narrowing.

That survey now finds live `./game` and `./utils` imports in package examples
and strict package consumers. Sibling repositories also use supported root
configuration and cache exports that overlap with the utility surface. Public
or private consumers outside the surveyed workspace remain unknown, so their
absence cannot justify a removal.

The TypeScript migration itself no longer forces a surface decision. Both
subpaths now resolve to generated runtime and declaration barrels and pass clean
packed-package consumers. The choice is therefore product scope, not migration
plumbing.

## Decision

Keep `./game`, `./utils`, and the currently supported overlapping root exports
in the core `@arclabs561/ai-visual-test` package for the current 0.x release
line. Preserve their public names and package routes through compatible
releases.

Retention applies to supported package exports, not every historical deep
import, undocumented alias, internal module, or tracked artifact. Continue to
prune dead code, stale documentation, invalid import paths, obsolete
compatibility shims, and unneeded generated or evaluation artifacts when live
consumer evidence and boundary tests make removal safe. Do not add a public
alias merely because a stale caller once imported it.

Keep session-cost tracking private. Its current `judge.ts` attribution callers
must receive an explicit replacement before that module is removed or moved,
but this decision does not promote session tracking into the public API.

Any future move of game or utilities to a companion package or research harness
requires a superseding ADR, migration notes, a fresh consumer inventory, and a
deliberately breaking release.

## Consequences

- Existing game, utility, and supported root consumers continue to resolve
  without a package migration.
- The core package remains broader than the scalar screenshot-review kernel and
  continues to own compatibility and package tests for both subpaths.
- Internal pruning remains expected; this ADR is not a freeze on implementation
  files, stale docs, unsupported aliases, or research artifacts.
- Unsupported root or deep-import paths remain unsupported unless a separate
  compatibility decision adds them deliberately.
- The public-surface question is settled for the current 0.x line, allowing
  maintenance work to distinguish safe pruning from breaking API narrowing.

## Alternatives considered

Move game and utilities into a companion package. This gives the kernel a
smaller conceptual boundary, but immediately creates cross-package release
coordination and requires every current subpath consumer to migrate.

Move advanced features into the research harness. This is the narrowest core,
but it abandons documented workflows and current package consumers without
evidence that they are obsolete.

Remove overlapping root exports while retaining the subpaths. This reduces
duplication, but observed sibling repositories still use supported root
configuration and cache exports. It is a breaking change with no current
consumer benefit.

## Verification

- `package.json` retains generated runtime and declaration routes for `./game`
  and `./utils`.
- Runtime and declaration export-parity tests continue to cover both subpaths.
- Clean packed-package tests compile strict consumers and import every public
  route.
- Examples and type fixtures continue to use supported package paths rather
  than internal source files.
- Any pruning change proves that the removed path is not a supported export and
  has no remaining live consumer in the surveyed scope.

## Rollback

If the decision changes before a compatible release, supersede this ADR and
update its ledger status rather than deleting its rationale. After users can
rely on the decision, the superseding ADR must also provide migration notes and
land through a deliberately breaking release; do not silently remove or
relocate the subpaths.
