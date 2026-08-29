---
status: accepted
date: 2026-08-28
confidence: high
governs:
  - package.json
  - tsconfig*.json
  - scripts/build*
  - src/**
  - bin/**
  - test/**
  - index.d.ts
  - types/**
why: Runtime review contracts and handwritten declarations have already drifted, while the package must keep working on Node 18 throughout migration.
rejected:
  - Permanent .mjs plus JSDoc retains duplicate runtime and declaration representations at the provider boundary.
  - An immediate whole-repository rewrite combines behavior, packaging, test-harness, and language changes into one unauditable step.
  - Native TypeScript execution would either raise the Node floor or add a runtime loader that consumers do not otherwise need.
review_trigger: Revisit if generated declarations cannot preserve every supported package subpath without handwritten overlays, or if the clean packed-package gate cannot run on Node 18.
---

# ADR 0001: Adopt staged TypeScript source

## Context

The package is native ESM JavaScript with explicit `.mjs` imports, a strict
TypeScript declaration check, and handwritten declarations for the root plus
public subpaths. The declaration repair in `d4f1e0a` removed many APIs that
TypeScript accepted but Node could not import. The same class of drift remains
possible whenever runtime objects, provider envelopes, and declarations change
independently.

The current build copies `src/**/*.mjs` into `dist`, selectively obfuscates
three modules, and inherits the source package manifest. A `.ts` file compiled
to `.js` would therefore disappear from the tarball or sit behind an export or
CLI import that still names `.mjs` unless the build transition is explicit.

## Decision

Migrate source to TypeScript module by module, starting at canonical contracts
and provider adapters. Use ordinary `.ts` files under the existing
`"type": "module"`, TypeScript `NodeNext` module semantics, and explicit `.js`
relative import specifiers. `.mts` is not the default because package scope
already establishes ESM and `.mts` would preserve an extension distinction the
public subpath API does not expose.

During migration, `tsc` compiles the mixed `.ts`/`.mjs` source and test trees
into an ignored staging tree. Tests for migrated boundaries execute the staged
JavaScript. The publish build consumes that staging tree and produces `dist`.
Its package manifest is generated from the source manifest but rewrites every
runtime, declaration, and bin target to the file actually emitted. The
published `files` allowlist includes both remaining `.mjs` and emitted `.js`
until migration is complete.

The target compiler configuration is strict and enables
`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, declarations,
declaration maps, and source maps. Generated declarations replace a handwritten
file only after the corresponding runtime boundary and package subpath pass
consumer compilation. Compatibility is measured at package export names and
behavior, not at internal filename extensions.

## Consequences

- The source-to-package build becomes mandatory for tests touching migrated
  modules; direct execution of `.ts` is not a supported runtime path.
- Fast source tests may remain for untouched `.mjs` internals, but release
  authority belongs to tests against compiled and packed output.
- The build must understand `.js` and `.mjs` during the transition. Selective
  obfuscation remains a packaging stage, not a TypeScript compiler concern.
- The CLI must migrate or update its internal imports in the same commit as any
  module it loads changes extension.
- Public subpath names remain stable. A future API narrowing still requires a
  separate major-version decision and consumer survey.

## Alternatives considered

Permanent `.mjs` with generated JSDoc declarations has lower build cost, but
provider unions and discriminated outcomes remain harder to express once and
reuse at runtime. An immediate rewrite has a shorter nominal schedule but no
useful rollback boundary. `.mts` would emit `.mjs`, but makes module format a
per-file concern even though the whole package is already ESM.

## Verification

Every migration commit must prove:

- strict compilation and generated declaration checking;
- deterministic boundary tests against emitted code;
- root and every public subpath resolve from a clean installation of the packed
  `dist` artifact on Node 18;
- the packed CLI executes its `check` path without a source-tree import; and
- the tarball contains every file referenced by `exports`, `types`, and `bin`.

TypeScript documents that `NodeNext` follows the nearest package module type and
that `.ts` ESM emits `.js`; Node requires explicit relative extensions. See the
[TypeScript module reference](https://www.typescriptlang.org/docs/handbook/modules/reference.html#node16-node18-node20-nodenext)
and [Node package documentation](https://nodejs.org/api/packages.html).

## Rollback

Before a migration release, revert the module-sized conversion and its generated
manifest changes. After a migration release, restore the last published `.mjs`
implementation behind the same export names in a patch release; do not ask
consumers to import internal emitted filenames.

## Update (2026-08-29)

The team invoked the declaration-overlay review trigger during the mixed
`./ensemble` migration after evaluating generated-only-barrel alternatives.
[ADR 0003](0003-temporary-declaration-composition-overlays.md)
permits one temporary composition overlay under strict packed-consumer and
runtime/type parity gates; it does not treat that overlay as completion of the
generated-declaration migration.
