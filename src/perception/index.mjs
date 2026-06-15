/**
 * Perception sampler sub-module. Import from 'ai-visual-test/perception'.
 *
 * The COMPASS counterpart to rubric validation (validateScreenshot is the GATE):
 * instead of scoring a screenshot against fixed anchors, this samples what real
 * viewers PERCEIVE and discovers the failures (and strengths) a fixed rubric did
 * not anticipate. Three perception modes (question / problem / insight), a diverse
 * JURY of judge models, cross-judge merge, cross-model verification, and an online
 * learning loop (judge calibration + disposition decay + active-learning selection).
 * Provider-agnostic orchestration: the caller supplies the screenshot, personas,
 * contexts, and either a `vision` fn or a `panel` (build with makePanel). STATELESS:
 * the consumer persists the learning state and config. Full design + research:
 * docs/judge-graph.md.
 *
 * This file is the public barrel; the implementation is split by concern:
 *   prompts.mjs     mode templates + UX_HEURISTICS + the verify template
 *   openrouter.mjs  the OpenRouter vision/text providers + makePanel
 *   aggregate.mjs   aggregate / mergeFindings / matchesDisposition
 *   sample.mjs      samplePerceptions (the orchestrator)
 *   learn.mjs       calibrateJudges / decayDispositions / selectForReview
 *   report.mjs      formatReport
 */

export { MODE_SPEC, UX_HEURISTICS } from "./prompts.mjs";
export { parseJsonObject, makeOpenRouterVision, makeOpenRouterText, makePanel } from "./openrouter.mjs";
export { aggregate, mergeFindings, matchesDisposition } from "./aggregate.mjs";
export { samplePerceptions } from "./sample.mjs";
export { selectForReview, calibrateJudges, decayDispositions } from "./learn.mjs";
export { formatReport } from "./report.mjs";
export { appendCritique, readLedger, ledgerToDispositions } from "./critiques.mjs";
