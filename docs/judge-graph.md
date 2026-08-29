# Perception judge graph

`@arclabs561/ai-visual-test/perception` helps collect and rank open-ended
visual findings from one or more vision judges. It is a review aid, not an
automatic pass/fail gate.

## Flow

1. `makePanel` configures judges and `samplePerceptions` collects findings
   across the requested modes, personas, and contexts.
2. `aggregate` groups related findings; `mergeFindings` can use a supplied
   text model to consolidate different wording for the same issue.
3. A separate verifier may confirm or refute findings. `selectForReview`
   ranks the unresolved results for a human.
4. `calibrateJudges` and `decayDispositions` return updated in-memory state.
   Consumers decide whether and where to persist it.

## Boundaries

- Findings are probabilistic and should be reviewed by a person.
- The module does not apply fixes or persist state on its own.
- Use deterministic checks for every-run regression gates. Run perception
  sampling when its cost and variability are acceptable.

See the [public API](../src/perception/index.ts) for the available functions
and types.
