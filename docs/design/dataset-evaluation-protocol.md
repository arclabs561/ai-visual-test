---
status: proposal
scope: screenshot-review evaluation data
grounded-in:
  - docs/design/review-engine-architecture.md
  - docs/design/review-engine-roadmap.md
  - test/fixtures/pairwise/README.md
review-trigger: before claiming calibration, adding a public benchmark adapter, or changing fixture provenance requirements
---

# Protocol: Dataset-backed screenshot review evaluation

## Purpose

The review engine needs evidence for three different questions: whether a
model chooses the preferred UI, notices a meaningful rendered change, and
produces a useful critique. These are distinct measurements. A single blended
"visual quality" score would hide failures and cannot justify calibration,
confidence, or product claims.

This protocol extends the local pairwise fixture gate; it does not make public
benchmark labels interchangeable with product-specific human review.

## Evidence tracks

| Track | Question | Initial source | Primary measure |
| --- | --- | --- | --- |
| Preference | Which UI do people prefer? | [Vibe Landing Page Arena](https://huggingface.co/datasets/datapointai/vibe-landing-page-arena), [Vibe Design Arena](https://huggingface.co/datasets/datapointai/vibe-design-arena), and [Apple RLDF](https://github.com/apple/ml-rldf) where its non-commercial terms permit local research | Agreement with the recorded majority; abstention; A/B vs B/A conflict |
| Regression | Did the rendered UI change and can the system describe the change? | [DiffSpot](https://github.com/Tencent/DiffSpot) | Changed/no-change recall and specificity; changed-property/localization accuracy where labels exist |
| Critique | Is the issue useful, grounded, and supported by the image? | [UICrit](https://github.com/google-research-datasets/uicrit) | Issue precision, unsupported-claim rate, rubric coverage, and grounding quality |

The Vibe datasets provide vote distributions, not merely a binary label. Keep
the vote counts and treat close votes as uncertain evidence. RLDF contains
professional-design feedback and chosen/rejected examples, but its data license
is [CC-BY-NC-ND](https://github.com/apple/ml-rldf/blob/main/LICENSE_DATA): it is
an opt-in external research input, never a vendored package fixture. DiffSpot
is synthetic mutation data: it measures regression sensitivity, not human
preference. UICrit supplies ratings, critiques, and regions from mobile UIs;
it is a critique/rubric source, not direct pairwise ground truth.

## Dataset record and acquisition

Every acquisition is a dataset-specific, immutable external record. It must
contain the source URL, the upstream commit/revision or release identifier
accepted by that dataset host, retrieval date, license URL, selected
split/filter, a SHA-256 digest for each downloaded artifact, and the
normalizer version that produced evaluation rows. It must also record known
restrictions, especially gated access, attribution, non-commercial use, and
whether screenshots may be redistributed. A mutable branch name, a bare
dataset slug, or a retrieval timestamp alone is not a revision pin.

Do not vendor restricted, gated, or otherwise non-redistributable screenshots
into this repository. Store a small checked-in manifest and a reproducible
downloader/normalizer; keep acquired artifacts in an ignored local cache.
Download failures, changed revisions, missing licenses, and hash mismatches are
unavailable-data states, never empty success.

The implemented acquisition receipt represents those states as `available`,
`metadata-only`, or `blocked`. An available receipt requires safe relative
artifact paths, byte lengths, and SHA-256 digests that are verified below an
operator-selected external cache. A blocked receipt carries a reason and no
artifacts; it cannot be mistaken for an empty successful dataset. The receipt
validates a non-empty dataset revision and registry identity; the operator is
responsible for supplying the host's immutable revision form.

An evaluation result additionally needs a **run identity**. Before results can
leave a development machine, record the acquisition receipt digest, dataset
key and revision, normalized-row manifest digest, selected split and sampling
seed, normalizer version, rubric/prompt version, model/provider identity, and
the evaluator version. These fields identify one run, rather than describing
an adapter in the abstract. The implemented evaluator requires versioned
examples and results documents to carry the same acquisition receipt, validates
the receipt's provenance identity, requires a named split, and emits the
validated acquisition with its report. Provider execution, dataset download,
and caller-supplied model/prompt metadata remain outside that offline command;
they must be retained alongside the report before making a release claim.

Normalize each external row into exactly one track. Preserve the upstream row
identifier and all label uncertainty; do not create a synthetic human winner
from a scalar rating or silently turn a critique into a pass/fail label.

## Pairwise labels and model outcomes

For preference, record `votesA`, `votesB`, any upstream tie/abstention count,
and the majority label separately. Report agreement stratified by vote margin;
do not give a 16–14 majority the same weight as a unanimous comparison.

Each external preference judgment must run both orders and reconcile them
through the production counterbalance rule before it reaches a preference
metric. A changed canonical winner between A/B and B/A is `indeterminate`, not
an averaged winner. Model abstention, human tie, and insufficient human
evidence are all retained as different states. Report them as rates and
exclude them from exact-agreement denominators unless the metric explicitly
evaluates abstention behavior.

Counterbalancing is implemented for production comparisons and first-party
fixture replay. The external preference evaluator also accepts AB and BA order
records, canonicalizes their sides, and reconciles them before scoring. A
pre-reconciled `prediction` remains accepted for compatibility, but a
single-order external result is development-only; release evidence retains
both raw order outcomes and the reconciled result.

The repository's first-party fixtures remain the release-quality calibration
set. Each has stable before/after assets, hashes, capture metadata, prompt and
rubric versions, and at least two independent human rationales as specified in
[the fixture protocol](../../test/fixtures/pairwise/README.md). Consensus is
not inferred from author intent; reviewer disagreement is retained and
excluded from agreement. First-party data is the only track that may be used
to make claims about the project's supported UI domain.

## Split and leakage policy

Split before sampling or tuning. The grouping key is the source application,
site/template, prompt family, or capture family—whichever prevents near-duplicate
screenshots and mutations from appearing on both sides of a split. Never split
individual pairs at random when their source page or variant family is known.

- Development: prompt/rubric work, parser diagnostics, and adapter integration.
- Validation: model and threshold selection, with all choices recorded.
- Held out: one final evaluation per pinned dataset revision; no prompt,
  rubric, or threshold changes after inspection.

The implemented split validator rejects a row ID or source group that crosses
named splits, including either source application in a pair. Calling that
validator with retained source-group evidence is mandatory before validation,
held-out, or release metrics; it is not optional sampling hygiene. External
benchmarks must not overlap first-party fixtures by source page, generated
template, or rendered asset hash. If provenance cannot establish either
group-disjointness or the first-party check, those rows are development-only.

DiffSpot currently exposes no stable source-page grouping, so its normalized
row ID prevents duplicate rows but cannot prove family disjointness. It is
useful for deterministic regression development and no-change specificity, but
not for a claimed group-disjoint held-out result unless additional provenance
is supplied.

## Critique dimensions and coverage

Critique scoring compares only identically named, numeric human and model
dimensions. It reports matched observations, mean absolute error, and
pairwise concordance per matched dimension; extra model dimensions are not
silently treated as human evidence. Natural-language critique text remains a
separate qualitative assessment rather than a proxy numeric score.

For each run, report per-dimension coverage as `matched / eligible`: eligible
means a reference rating exists for that dimension and the row is in the named
split; matched additionally requires a valid model score of the same name.
The implemented metric emits total eligible reference dimensions, matched
dimensions, their rate, missing result IDs, and per-row missing and unexpected
score dimensions. It still does not turn free-text critique prose into a
numeric substitute; qualitative critique assessment needs its own evaluator.

## Acquisition stages and gates

1. **Metadata-only reconnaissance — reversible.** Record source, license,
   schema, revision pinning method, and redistribution status. Gate: an
   independently reproducible acquisition plan exists; otherwise do not add an
   adapter.
2. **Read-only adapter smoke — reversible.** Download a bounded sample outside
   the repository, verify hashes and schema, then prove the normalizer preserves
   upstream IDs and uncertainty. Gate: deterministic normalization and no
   restricted artifact in Git.
3. **Track-specific development evaluation — reversible.** Run the selected
   corpus with counterbalanced pairwise outcomes or deterministic regression
   checks. Gate: metrics are emitted per track, both preference orders are
   retained and reconciled, the group-disjoint validator passes, critique
   coverage is reported by matched dimension, and no-change controls have
   explicit specificity results.
4. **First-party human calibration — partially reversible.** Add a small
   consented, redistributable fixture set with two independent reviews and
   stable captures. Gate: at least one held-out, consensus-labeled slice exists
   before any confidence, ensemble, or alignment claim.
5. **Release claim — one-way externally.** Publish only scoped results with
   a run-level provenance/acquisition identity, corpus size, exclusions,
   abstention/conflict rates, model and prompt identities, per-dimension
   critique coverage where applicable, and limitations. Gate: rerun from the
   recorded manifest and review the claim against the held-out first-party
   slice.

## Implemented adapter status

| Source | Pinned revision used for schema verification | Current gate |
| --- | --- | --- |
| UICrit | `adc92136cdaecf6a5c8bb85af08594dd9271eb00` | Real CSV smoke passes: three annotator rows aggregate into one screen while individual ratings, comment provenance, and corner-coordinate boxes remain auditable. RICO pixels remain external. |
| DiffSpot | `c6dd79d5e1c0cbb4e7ca234c9f53c418a75e30ce` | Real dataset-server smoke passes for visual-change rows and a no-change control. Upstream exposes no stable source-page key, so this corpus cannot support a claimed source-group-disjoint split without additional provenance. |
| Vibe Design Arena | `ee85ae467e14b1f454036544eb37eec0e2ab6368` | Adapter matches the published dataset-card contract; artifact verification is blocked until an operator accepts gated access and authenticates. |
| Vibe Landing Page Arena | `94d584034e81336fe440dcb3f62fe8d53a65f7f0` | Adapter matches the published dataset-card contract; artifact verification is blocked until an operator accepts gated access and authenticates. |

The pins above document the evidence used to verify schemas; they are not
silent defaults. The evaluation document now binds examples and results to the
same acquisition identity and rejects a mismatch. The receipt does not itself
record provider execution or a normalized-row manifest digest, so those remain
caller-owned provenance for any published claim.

## Non-goals

- Training a visual-quality model or collecting labels at scale.
- Treating a model's self-reported confidence as calibrated evidence.
- Replacing deterministic pixel/layout assertions with a model judge.
- Redistributing external screenshots merely to make tests convenient.
- Promoting an external benchmark score to a guarantee about arbitrary product
  UIs.

## Decision gates

- Revisit the selected preference corpus if its license, gated-access policy,
  or revision cannot be pinned and reproduced.
- Do not enable a dataset in CI until its adapter proves missing-data and
  license-restriction failures are explicit, it emits one track only, and its
  intended split passes the group-disjoint validator.
- Do not claim pairwise alignment until the held-out first-party fixture set
  has consensus labels and reports order conflict and abstention; external
  preference claims also require recorded AB and BA outcomes.
- Do not claim critique alignment until each reported dimension states matched
  and eligible coverage, with missing dimensions and malformed rows visible.
- Revisit the protocol when a supported consumer needs accessibility or
  cross-browser compatibility evaluation; those are separate tracks, not a
  reinterpretation of preference labels.

---
Proposed: 2026-08-28
