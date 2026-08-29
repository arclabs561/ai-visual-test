# Architecture decisions

Accepted decisions govern the paths named in their frontmatter. Amend or
supersede a decision; do not rewrite its original rationale.

| ADR | Status | Decision |
| --- | --- | --- |
| [0001](0001-staged-typescript-source.md) | accepted | Migrate source to TypeScript through a compiled mixed-source staging tree. |
| [0002](0002-typebox-review-contracts.md) | accepted | Use TypeBox for private review-boundary runtime schemas and inferred types. |
| [0003](0003-temporary-declaration-composition-overlays.md) | accepted | Allow one temporary composition overlay while a public subpath mixes generated TypeScript and unchanged JavaScript exports. |
| [0004](0004-retain-game-and-utils-in-core.md) | accepted | Retain game, utilities, and supported root overlaps in core for the current 0.x line. |
