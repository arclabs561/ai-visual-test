# Design: the perception judge graph

The `./perception` module is a discovery COMPASS for screenshots: it samples what
viewers perceive, ranks the findings, verifies them, and learns which of its judges
and memories to trust over runs. This doc is the generic design — the architecture,
the research it rests on, and the roadmap. It is provider- and domain-agnostic; a
consumer supplies the screenshot, the judge models, the personas/contexts, and the
domain principles. (For one consumer's configuration and the decision to adopt this,
see that consumer's own records — e.g. the infra repo's `docs/design/judge-graph.md`
and ADR-0056.)

## Problem

A single LLM/VLM judge is biased, nondeterministic, and its biases do not average out
by sampling it more (CyclicJudge, Zhu et al 2026; position-bias studies). It starts
cold every run (no accumulated experience — Jwa et al 2025), and a fixed rubric
re-flags settled-by-design choices every run so the signal never converges. We want a
judge that decorrelates its bias, is hard to fool, converges instead of repeating
itself, and sharpens over runs from cheap feedback — without owning the aesthetic call
(structurally the human's).

## The graph (built)

```
            ┌─ judge A (lab 1) ─┐
  shot ──┐  ├─ judge B (lab 2) ─┤
 UX heur ├──┼─ judge C (lab 3) ─┼─→ samples ─→ aggregate (mass × judge-diversity)
 princ.  │  └─ judge D (lab 4) ─┘                    │
 dispos. │                                            ▼ cross-judge MERGE (canonicalize)
         │                                            ▼ cross-model VERIFY (verifier≠proposer)
         │                                            ▼ disposition filter (convergence)
         ▼                              NEW findings ─┴─→ selectForReview (most-split)
   outcomes ──→ calibrateJudges / decayDispositions ──→ persisted weights (consumer I/O)
```

Mechanisms, each grounded:

1. **Diverse panel** (`makePanel`) — judges from different labs decorrelate bias; a
   panel of diverse judges beats one big judge "only if they disagree on the right
   things" (Verga et al 2024 PoLL; orq.ai). Diversity of LAB is the lever, not count.
2. **UX-heuristic + principle + disposition seeding** — every prompt is seeded with
   `UX_HEURISTICS` (Nielsen's 10 usability heuristics + Gestalt visual principles: the
   common-sense aesthetics baseline), then the consumer's domain `principles` as the
   override, and known `dispositions` suppressed. LLMs give usable Nielsen-heuristic
   assessments (Leveraging LLMs to Identify Usability Flaws, arXiv:2512.04262).
3. **Diversity-weighted aggregation** (`aggregate`) — score = role-weighted mass × a
   factor in the number of DISTINCT judges that raised it.
4. **Cross-judge merge** (`mergeFindings`) — canonicalize same-issue/different-wording
   findings into one golden finding (entity consolidation, Deng et al 2017) so the
   diversity bonus actually fires across labs.
5. **Cross-model verify** — refute pass run by a judge that did NOT raise the finding.
6. **Online learning** — `calibrateJudges` (EMA over verified-survival, floored so no
   judge is curated out — Li 2026 calibrate-don't-curate), `decayDispositions`
   (re-open a `fixed` disposition that regressed), `selectForReview` (surface the
   most-split findings for a human label).

## The most important open problem: prediction-powered audit allocation

Every weight `calibrateJudges` learns today is calibrated against the cross-model
verifier, not a human. The BAI-with-LLM-judges result (Ao, Chen, Gao, Li,
Simchi-Levi 2026, arXiv:2601.21471) proves this is not enough:

- **Impossibility**: under arm/context-dependent bias, proxy-only selection can never
  identify the best arm *even with infinite proxy data*. The verifier's bias does not
  wash out. A gold-set of human labels is necessary, not polish.
- **Prediction-powered estimator (PPI)**: don't override the verifier with the human —
  estimate a finding's true mean as `verifier_mean + IPW-corrected residual(human −
  verifier)`. The cheap verifier carries the bulk; scarce human labels estimate only
  the bias correction; inverse-propensity weighting keeps it unbiased under selective
  auditing. This is the correct upgrade to `calibrateJudges`.
- **Neyman audit + anytime-valid stopping**: audit where residual variance is highest
  × the margin is smallest (the principled `selectForReview`), and stop sampling a
  finding once its confidence sequence separates. 48% fewer labels than uniform,
  70-90% total savings. Read-depth caveat: the BAI theory is for bounded scalar arms,
  so it applies cleanly to the per-finding accept/reject decision but not to NEW-finding
  discovery — keep a uniform-exploration floor for discovery.

## Sampling optimizer

The sampler currently fans a full grid (modes × personas × contexts × judges × n).
The principled replacement is the same BAI machinery: a LUCB outer loop (sample the
estimated-best finding + its closest contender; stop on separation via anytime-valid
confidence sequences) collapses the uniform grid toward the close/uncertain findings.
Same allocation problem as the audit layer above.

## Roadmap (primitives, each independently shippable)

1. **Built**: panel, UX/principle/disposition seeding, diversity aggregation, merge,
   cross-model verify, `calibrateJudges`/`decayDispositions`/`selectForReview`.
2. **PPI audit layer** (highest priority): `ppiArmMean` (IPW-debiased estimator) +
   `neymanSelect` (audit ∝ residual variance × margin). Turns weights from
   self-consistent into aligned-to-truth.
3. **Sampling optimizer**: LUCB + anytime-valid stopping, uniform-explore floor.
4. **Dependence-aware diversity** (correlated same-lab judges count <1 vote each;
   Ising aggregation, Balasubramanian et al 2026) + **Dawid-Skene batch re-fit** once a
   gold-set exists.
5. **Learned aggregator** (Sprejer et al 2025): learn how to combine judges from
   operator labels rather than a fixed mass×diversity formula.

## Non-goals

- Owning aesthetic/taste — the jury surfaces and ranks; the human decides.
- Replacing the consumer's deterministic checks — the panel is the perceptual COMPASS,
  not the every-run GATE (it is ~Nx the cost; run it periodically).
- A built-in weight store — the learning primitives are PURE; the consumer persists the
  returned state and supplies config (roster, personas, principles, labels).
- Auto-applying fixes — the jury proposes; a guard/operator disposes.
- Trusting learned weights as calibrated-to-truth before a gold-set exists.
