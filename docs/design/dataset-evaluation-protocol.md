---
status: proposal
scope: screenshot-review evaluation data
grounded-in:
  - test/fixtures/pairwise/README.md
review-trigger: before publishing benchmark, calibration, or alignment claims
---

# Dataset evaluation protocol

## What we measure

Keep the evaluation questions separate:

| Track | Question | Candidate source |
| --- | --- | --- |
| Preference | Which UI do people prefer? | Vibe Design/Landing Page Arena; Apple RLDF for permitted local research |
| Regression | Did the rendered UI visibly change? | DiffSpot |
| Critique | Is a reported issue grounded and useful? | UICrit |

An external benchmark does not establish product quality. DiffSpot measures
change detection, not preference or accessibility. Synthetic data does not
replace first-party screenshots reviewed by people.

## Data policy

Dataset pixels, normalized rows, provider results, confirmations, and reports
stay outside Git under ignored `evaluation/` or another operator-selected
cache. Commit only acquisition/evaluation code, schemas, empty templates, and
documentation. Acquisition commands do not import provider code; evaluation is
a separate, explicit step.

Every acquisition must record:

- dataset URL and immutable revision;
- retrieval time, license, and redistribution policy;
- selected split/filter and normalizer version;
- byte length and SHA-256 digest for every downloaded artifact.

Every evaluated run must additionally record the acquisition and normalized-row
digests, evaluator/prompt version, provider/model, split, and sampling seed.
Unavailable, gated, or malformed data is an explicit failure, never an empty
successful run.

## Labels and splits

- Preserve upstream uncertainty, votes, ties, and abstentions.
- Run preference comparisons in both image orders. Conflicting canonical
  winners are `indeterminate`.
- Split by source application, template, prompt family, or capture family
  before tuning. Do not randomly separate near-duplicates.
- DiffSpot has no stable source-page family key. Its bounded sample is suitable
  for development smoke tests, not a group-disjoint held-out claim.
- First-party calibration fixtures require stable assets and hashes plus two
  independent human reviews. Reviewer disagreement remains visible.

## Commands

Fetch a revision-pinned, balanced DiffSpot sample without a provider call:

```bash
npm run evaluate:diffspot -- --fetch-only --limit 4
```

Run the same sample through the production comparison path:

```bash
AI_VISUAL_TEST_LIVE=1 VLM_PROVIDER=openrouter \
  VLM_MODEL=google/gemini-2.5-flash-lite \
  npm run evaluate:diffspot -- --limit 4
```

The runner accepts at most 20 rows, fetches both changed and no-change controls,
hashes all artifacts, and writes only to ignored storage by default.

UICrit acquisition fetches only the public annotation CSV by default:

```bash
npm run evaluate:uicrit -- --fetch-only --limit 5
npm run evaluate:uicrit -- --fetch-only --limit 5 --rico-root /private/path/rico
```

Supplying a local RICO directory may add selected local PNGs to that private
receipt. A live run must consume that pixel-bearing receipt and separately bind
the exact provider and model in a private upload confirmation:

```bash
AI_VISUAL_TEST_LIVE=1 npm run evaluate:uicrit -- \
  --evaluate-existing evaluation/results/uicrit/<acquisition> \
  --cache-dir evaluation/cache/uicrit --output-dir evaluation/results/uicrit \
  --upload-confirmation /private/path/uicrit-upload-confirmation.json
```

Vibe Design and Landing Page Arena use the same split. The operator must first
have accepted the host terms and have working access; the tool never accepts
terms on their behalf:

```bash
# requires HF_TOKEN in the environment
npm run evaluate:vibe -- --dataset design --fetch-only --limit 5
npm run evaluate:vibe -- --dataset landing --fetch-only --limit 5
```

Then evaluate a prior acquisition with explicit cache/output paths and a
private confirmation that binds provider and model:

```bash
AI_VISUAL_TEST_LIVE=1 npm run evaluate:vibe -- --dataset design \
  --evaluate-existing evaluation/results/vibe-design/<acquisition> \
  --cache-dir evaluation/cache/vibe-design --output-dir evaluation/results/vibe-design/<run> \
  --upload-confirmation /private/path/vibe-upload-confirmation.json
```

`evaluate:dataset` independently scores compatible examples/results documents
supplied by the operator.

## Current evidence

On 2026-08-29, the tracked runner fetched four examples from DiffSpot revision
`c6dd79d5e1c0cbb4e7ca234c9f53c418a75e30ce`: two visual changes and two
no-change controls. Eight image artifacts were downloaded and hashed outside
Git. The production counterbalanced comparison path ran with OpenRouter and
`google/gemini-2.5-flash-lite`.

This smoke run found both no-change controls and missed both changed examples:

- true positive: 0;
- false negative: 2;
- false positive: 0;
- true negative: 2.

That four-row result verifies the acquisition and evaluation path, but it is
not a benchmark or release-quality model claim. The ignored receipt/results are
local evidence; rerun the command to regenerate them.

## Adapter status

| Source | Revision | Status |
| --- | --- | --- |
| DiffSpot | `c6dd79d5e1c0cbb4e7ca234c9f53c418a75e30ce` | Fetch/evaluation runner exercised on a bounded external sample |
| UICrit | `adc92136cdaecf6a5c8bb85af08594dd9271eb00` | Public annotations fetched only; no local RICO pixels or provider run |
| Vibe Design Arena | `ee85ae467e14b1f454036544eb37eec0e2ab6368` | Gated; current local access returned 401; terms were not accepted automatically |
| Vibe Landing Page Arena | `94d584034e81336fe440dcb3f62fe8d53a65f7f0` | Gated; current local access returned 401; terms were not accepted automatically |
| Apple RLDF | `be0d7f816ded6fa5111035f34f69b077072ba9a3` | Provider upload denied: noncommercial, external-only corpus |
| UIClip BetterApp | `5e087dedcd48c74fffb0802e8035006995b57e36` | Provider upload and release gating blocked while licence is unknown |

## Claim gates

- Do not claim preference alignment without consensus first-party held-out
  fixtures and reported order conflicts/abstentions.
- Do not claim critique alignment without matched/eligible coverage for every
  reported dimension.
- Do not claim calibrated confidence from model self-reports.
- Publish only scoped results that include corpus size, exclusions, provenance,
  provider/model, prompt version, and limitations.

---
Proposed: 2026-08-28
