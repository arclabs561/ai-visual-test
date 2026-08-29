---
status: draft
scope: game review loop and TypeScript boundary
grounded-in:
  - docs/design/review-engine-architecture.md
  - docs/design/review-engine-roadmap.md
  - docs/adr/0001-staged-typescript-source.md
  - docs/adr/0002-typebox-review-contracts.md
---

# Design: Game review loop

## Problem

The game surface currently has more than one owner for the same temporal decision. `playGame` keeps a session-level `TemporalDecisionManager`, but a validation that it elects to run asks the judge to create another manager. Action selection then performs additional validations and parses an action from free-form reasoning. The result is extra provider work, temporal state that cannot persist across the real provider boundary, and tests that observe result shape rather than exact provider-call behavior.

The game package also exposes nine values from three JavaScript modules. Converting those modules before deciding the review loop would encode duplicate scheduling, score-based termination, and heuristic action parsing into generated public types.

## Context

The review engine now has typed scalar and pairwise contracts, model-aware structured-output negotiation, a bounded diagnostic repair retry, and a fully generated temporal subpath. Game code should consume those boundaries rather than reproduce them.

The existing runtime supports two modes with different purposes:

- `playGame` is an automated session that may reuse prior evaluation and skip provider work.
- `GameGym` is an external iterator whose caller may intentionally inspect every step.

These modes should share action and result contracts, but they do not need identical scheduling defaults.

## Non-goals

- Do not claim a provider-call reduction percentage without a reproducible, held-out run artifact. The existing `98.5%` statement is not local evidence.
- Do not enable probabilistic sampling by default. A hidden random default would change call frequency and make CI behavior nondeterministic.
- Do not merge `GameGym` and `playGame` into one control loop. Their caller ownership and observation semantics differ.
- Do not migrate all of `convenience.mjs` merely to type the game subpath. Extract only the three game-facing convenience functions.
- Do not calibrate confidence, sampling probability, or ensemble weights without human-labeled game screenshots.

## Options considered

### Game session owns temporal scheduling

`playGame` keeps one persistent decision manager. Once that manager decides to prompt, the downstream validation runs with temporal re-decision disabled. The current evaluation is passed into action selection so it is not recomputed by default. This gives one state owner and makes provider-call counts testable.

### Validator owns temporal scheduling

Every caller would pass a persistent manager through validation context. This could centralize policy for non-game consumers, but it expands the root validation API and leaves game-specific reuse and action decisions awkward. It is deferred until a second session-oriented consumer needs the same manager lifecycle.

### Preserve the current layered decisions

This is rejected. A fresh manager per validation begins from warm-start state, so it cannot implement session adaptation. Extra action validations also make the outer scheduler's call accounting misleading.

### Keep heuristic action parsing

This is acceptable only as an explicit legacy fallback. It is not a trustworthy primary contract because numbers and JSON-like fragments in reasoning can be misassigned without a schema diagnostic.

## Chosen approach

`playGame` is the sole temporal scheduler for an automated game session. It passes its existing evaluation into action selection and disables downstream temporal re-decision for provider calls it has already scheduled. The validation API retains its standalone temporal behavior for non-game callers.

Game actions get a dedicated runtime schema and inferred TypeScript union for `keyboard`, `click`, and `wait`. Before that schema is wired into game code, the current review-specific structured-output loop is split into a private generic task executor plus review and game task definitions. A task definition supplies its schema, parser, diagnostic formatter, and repair prompt; provider adapters continue to own model capability negotiation and transport. The public scalar/comparison result contract does not become a generic task union.

Provider-native JSON Schema or JSON-object output is used when the selected provider/model supports it. Malformed or unsupported action output enters the task executor's bounded parse-diagnostic-repair path. The old reasoning parser remains a named legacy fallback during migration; it never silently converts malformed output into a successful action.

Temporal scheduling governs visual review calls, not whether the game advances. A skipped visual review reuses the last canonical evaluation, then the declared action policy may make one structured action call. A scheduled frame makes one visual review call and the same action-policy call. Scripted or caller-injected action policies may make no provider call. Provider counts are reported separately for visual review and action selection.

Adaptive sampling is explicit and injectable. A sampler may suppress only ordinary, non-urgent candidates; decision points, coherence drops, and failure recovery remain unconditional. Tests inject deterministic samples. The default stays deterministic until human-reviewed evidence justifies another policy.

Termination no longer treats score `0` as game over. `playGame` and `GameGym` use an explicit termination policy based on declared game state, terminal issue evidence, or a caller callback. Capture output is owned by a run-scoped output policy that produces collision-safe paths and defines retention. `GameGym.step()` surfaces failed action execution rather than advancing as if the action succeeded.

Action validation is enforced again at execution time for caller-supplied actions. Unknown or malformed actions fail instead of becoming an implicit wait. When a game root is configured, click selectors resolve within that root and cannot target unrelated page controls.

## Tradeoffs

The session owner becomes more explicit, so callers that want custom scheduling need an injected manager or policy rather than a loose context flag. Structured actions add a schema and one bounded repair path. Extracting game convenience leaves a compatibility delegation layer in `convenience.mjs` until the broader module is migrated.

In return, provider work becomes countable, action results become discriminated and validated, and generated declarations describe legal states instead of opaque functions.

## Implementation plan

1. Add deterministic game seams for validation, action policy, clock, temporal manager, and output-path policy. Preserve current defaults. Reversible.
2. Extract a private generic structured-task executor from the review-specific loop. Prove scalar and comparison behavior is unchanged before adding another task. Reversible while review keeps its adapter.
3. Introduce the structured `GameAction` task and bounded legacy parser adapter. Keep malformed output explicit. Reversible while fallback remains.
4. Make `playGame` the only temporal decision owner; pass the scheduled or reused evaluation into the action policy and report visual-review and action-call counts separately. Reversible behind compatibility options.
5. Replace score-zero termination, surface action execution failures, validate `maxSteps` and `fps`, and make run paths collision-safe. Behavior change, guarded by regression tests.
6. Convert goal prompts, game convenience, game player, and finally the game barrel to TypeScript. Delete `types/game.d.ts` only when the clean packed consumer compiles. Public contract change becomes durable after release.
7. Remove or qualify unsupported percentage claims. Add measured claims only from versioned evaluation receipts.

## Decision gates

- A scheduled frame must invoke exactly one temporal decision owner.
- A skipped frame must make zero visual-review calls; scheduled and skipped frames must make only the provider calls declared by their action policy.
- Visual-review and action-selection calls must be counted and reported separately.
- High-urgency decisions must never be suppressed by adaptive sampling.
- Every action variant must round-trip through the runtime schema and generated public type; malformed output must be diagnostic or error, never implicit success.
- The generic task executor must preserve the existing scalar/comparison request, retry, diagnostic, and result behavior before game uses it.
- Score `0` must not terminate a game without separate terminal evidence.
- Unknown actions must fail, and a configured game root must contain every click target.
- Concurrent runs must produce distinct artifact paths and explicit retention behavior.
- The final `./game` route must have exact runtime/type export parity and pass a strict TypeScript consumer from a clean packed install.

## Open questions

- Whether `GameGym` should gain an opt-in temporal scheduler is deferred until a caller needs skipped-step semantics.
- The default number of action-provider calls remains an evaluation question; the implementation must expose review and action counts before tuning either.
- Adaptive probabilities require a first-party, human-reviewed game fixture set before becoming a product default or claim.
