---
status: active
scope: public screenshot-review evaluation data
grounded-in:
  - test/fixtures/pairwise/README.md
review-trigger: before publishing benchmark, calibration, or alignment claims
---

# Dataset evaluation protocol

## What we measure

Keep evaluation questions separate. None of these corpora alone establishes
product quality, accessibility, or general preference alignment.

| Track | Question | Public source | Boundary |
| --- | --- | --- | --- |
| Regression | Did the rendered UI visibly change? | DiffSpot | Bounded external smoke sample |
| Critique | Is a reported issue grounded and useful? | UICrit with public RICO images | Local model for pixel-bearing runs |
| Aesthetics | Can a model characterize interface quality? | Dataset-interfaces-GUI | Scoring needs labels the publisher does not provide machine-readably |
| Grounding | Can a model locate a requested target? | UI-Vision; ScreenSpot-Pro | Local loopback Ollama only |
| Preference | Does a model reproduce annotated pair choices? | BetterApp; Apple ML-RLDF | Local-only; not a release gate |

Gated sources, including Vibe Design and Landing Page Arena, are deliberately
outside the operator command surface. Their registry metadata remains only so
the application can identify and fail closed on them; the project does not
accept terms, fetch their data, or evaluate them.

## Data policy

Dataset pixels, normalized rows, results, confirmations, and reports remain
outside Git under ignored `evaluation/` or an operator-selected cache. Commit
only acquisition and evaluation code, schemas, empty templates, and docs.
Acquisition never imports provider code; evaluation is an explicit later step.

Every acquisition records the dataset URL, immutable revision, retrieval time,
license and redistribution policy, selection/normalizer version, and byte
length plus SHA-256 for every downloaded artifact. Every evaluation additionally
records its acquisition and normalized-row digests, evaluator/prompt version,
model, split, and sampling seed. Unavailable, gated, or malformed data is an
explicit failure, never an empty successful run.

Pixel-bearing public datasets are still not sent to hosted providers by these
runners. The local paths use only literal-loopback Ollama. Apple ML-RLDF is
non-commercial local research only; BetterApp has an unknown license and is
also local-only. RICO use is local research only unless the operator separately
establishes broader rights.

## Labels and splits

- Preserve upstream uncertainty, votes, ties, and abstentions.
- Run preference comparisons in both image orders. Conflicting canonical
  winners are `indeterminate`.
- Split by source application, template, prompt family, or capture family
  before tuning. Do not randomly separate near-duplicates.
- DiffSpot has no stable source-page family key. Its bounded sample is a
  development smoke check, not a group-disjoint held-out claim.
- Dataset-interfaces-GUI publishes images but not an exact machine-readable
  high/medium/low mapping. Label-free output is characterization, never an
  accuracy or release-gate result.
- First-party calibration fixtures require stable assets and hashes plus two
  independent human reviews. Reviewer disagreement remains visible.

## Commands

All paths below are ignored local storage. Replace angle-bracket placeholders
with the receipt directory printed by the preceding command.

### DiffSpot

```bash
npm run evaluate:diffspot -- --fetch-only --limit 4
AI_VISUAL_TEST_LIVE=1 VLM_PROVIDER=openrouter \
  VLM_MODEL=google/gemini-2.5-flash-lite \
  npm run evaluate:diffspot -- --limit 4
```

The runner accepts at most 20 rows and fetches both changed and no-change
controls. Its live path is the existing production comparison path.

### UICrit and RICO

Fetch annotations only:

```bash
npm run evaluate:uicrit -- --fetch-only --limit 5
```

Fetch annotations and selectively extract the chosen public RICO screenshots
to the private cache, then evaluate them locally:

```bash
npm run evaluate:uicrit -- --fetch-only --limit 5 --download-rico
npm run evaluate:uicrit -- \
  --evaluate-local evaluation/results/uicrit/<acquisition> \
  --local-model gemma4:e2b \
  --cache-dir evaluation/cache/uicrit \
  --output-dir evaluation/results/uicrit/<local-run>
```

An existing local RICO directory may be supplied with `--rico-root` instead of
`--download-rico`. The hosted-provider route remains separately guarded by an
operator upload confirmation and is not the public-data workflow documented
here.

### Dataset-interfaces-GUI

Fetch the 36 public Mendeley images:

```bash
npm run evaluate:gui-aesthetics -- --fetch-only --limit 36
```

Characterize a prior receipt locally without labels:

```bash
npm run evaluate:gui-aesthetics -- \
  --characterize-existing evaluation/results/dataset-interfaces-gui/<acquisition> \
  --local-model gemma4:e2b --limit 36
```

Scored evaluation is possible only when an operator supplies a private,
exact-label manifest with `--labels`; it requires an explicit provider/model
and should remain clearly separated from label-free characterization.

### UI-Vision and ScreenSpot-Pro grounding

Both datasets are anonymously fetched at pinned revisions and evaluated only
through loopback Ollama:

```bash
npm run evaluate:grounding -- --dataset ui-vision --fetch-only --limit 20
npm run evaluate:grounding -- --dataset ui-vision \
  --evaluate-existing evaluation/results/ui-vision/<acquisition> \
  --local-model gemma4:e2b \
  --cache-dir evaluation/cache/ui-vision \
  --output-dir evaluation/results/ui-vision/<local-run>

npm run evaluate:grounding -- --dataset screenspot-pro --fetch-only --limit 20
```

Run the same second command with `--dataset screenspot-pro` and the matching
receipt/cache/output paths for ScreenSpot-Pro.

### BetterApp preference

BetterApp is publicly downloadable but license-unknown. It is intentionally a
local exploratory path, never hosted upload or a release gate:

```bash
npm run evaluate:betterapp -- --fetch-only --limit 20
npm run evaluate:betterapp -- \
  --evaluate-existing evaluation/results/betterapp/<acquisition> \
  --local-model gemma4:e2b \
  --cache-dir evaluation/cache/betterapp \
  --output-dir evaluation/results/betterapp/<local-run>
```

### Apple ML-RLDF preference

Acquire, normalize, then evaluate the non-commercial Apple corpus locally:

```bash
npm run evaluate:apple-rldf -- --fetch-only
uv run scripts/normalize-apple-rldf.py \
  --acquisition evaluation/results/apple-rldf/<acquisition>/apple-rldf-acquisition-v1.json \
  --cache-dir evaluation/cache/apple-rldf \
  --output-dir evaluation/results/apple-rldf/<normalized> --limit 20
npm run evaluate:apple-rldf -- \
  --evaluate-existing evaluation/results/apple-rldf/<acquisition> \
  --records evaluation/results/apple-rldf/<normalized>/apple-rldf-records-v1.json \
  --normalization evaluation/results/apple-rldf/<normalized>/apple-rldf-normalization-v1.json \
  --local-model gemma4:e2b --limit 20 \
  --output-dir evaluation/results/apple-rldf/<local-run>
```

`evaluate:dataset` independently scores compatible examples/results documents
supplied by the operator. `evaluate:pairwise-fixtures` validates and scores an
operator-supplied counterbalanced fixture manifest and result set; neither
acquires data nor calls a provider.

## Current evidence

The current receipts are deliberately tiny smoke checks, not benchmark claims.
They prove that acquisition, provenance binding, local inference, and scoring
run end to end:

- DiffSpot: four hosted comparison rows; 0 true positives, 2 false negatives,
  0 false positives, and 2 true negatives.
- UICrit/RICO: two locally evaluated screens with all 10 requested dimension
  scores present. Mean absolute errors were 0.667 aesthetics, 1.0 learnability,
  1.167 efficiency, 0.167 usability, and 0.167 design quality.
- BetterApp: two local counterbalanced pairs; both presentation orders
  conflicted, so both were correctly abstained rather than scored.
- Apple ML-RLDF: two local counterbalanced pairs, 1/2 agreement, and no order
  conflicts.
- UI-Vision and ScreenSpot-Pro: two local grounding examples each, with 0/2
  points inside the target boxes in both corpora.
- Dataset-interfaces-GUI: three images characterized as high quality, without
  labels or an accuracy claim.

All pixels, receipts, and results are ignored local evidence. Rerun the commands
above to regenerate them before citing a result.

## Adapter status

| Source | Revision | Status |
| --- | --- | --- |
| DiffSpot | `c6dd79d5e1c0cbb4e7ca234c9f53c418a75e30ce` | Public regression smoke runner |
| UICrit | `adc92136cdaecf6a5c8bb85af08594dd9271eb00` | Public annotations plus selective local RICO extraction/evaluation |
| Dataset-interfaces-GUI | Mendeley version `1` | Public image acquisition and local characterization; no published machine-readable labels |
| UI-Vision | `766c66aeffef16608d4916525902d9fb2598d7ce` | Public local-only grounding runner |
| ScreenSpot-Pro | `210e78d3844251110bff86c95835ebd37a6930fa` | Public local-only grounding runner |
| UIClip BetterApp | `5e087dedcd48c74fffb0802e8035006995b57e36` | Anonymous-public, license-unknown, local-only exploratory runner |
| Apple ML-RLDF | `be0d7f816ded6fa5111035f34f69b077072ba9a3` plus pinned archive SHA-256 | Non-commercial local-only preference runner |

## Claim gates

- Do not claim preference alignment without consensus first-party held-out
  fixtures and reported order conflicts/abstentions.
- Do not claim critique alignment without matched/eligible coverage for every
  reported dimension.
- Do not claim calibrated confidence from model self-reports.
- Publish only scoped results that include corpus size, exclusions, provenance,
  model, prompt version, and limitations.
