# Pairwise fixture protocol

This directory contains a versioned template, not evidence and not a benchmark.
Do not add generated screenshots, invented human winners, or model-quality claims.

When real review material is available, each fixture needs `before` and `after`
assets beneath this directory, each pinned with its lowercase SHA-256 digest.
Use paths relative to the manifest; absolute and parent-traversal paths are
rejected. Record the exact prompt, rubric version, stable-capture environment,
and a rationale from each of at least two distinct human reviewers. A fixture contributes a
human label only when all reviewers choose the same `A`, `B`, or `tie` winner.
An `indeterminate` review is an abstention; fewer than two reviews and
disagreement are reported but excluded from agreement calculations.

Recorded evaluation inputs are offline order outcomes, never API credentials:

```json
{
  "version": 1,
  "outcomes": [
    { "id": "fixture-id", "orders": { "AB": {}, "BA": {} } }
  ]
}
```

The evaluator replays those two outcomes through the production
counterbalance function, then reports agreement, abstention/conflict/incomplete
rates, confusion, and missing evidence. It does not call a provider.

```sh
npm run evaluate:pairwise-fixtures -- --manifest test/fixtures/pairwise/manifest.template.json --results recorded-orders.json
```
