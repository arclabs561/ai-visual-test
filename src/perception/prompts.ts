/**
 * Perception prompts: per-mode sampling templates, generic UX heuristics, and
 * the cross-model verifier template. Pure strings/templates, no I/O.
 */
import type { PerceptionFinding, PerceptionMode } from './contracts.js';

const LOCI = ['UI', 'INFO', 'GAP', 'CONFLICT', 'NOISE'] as const;
const SEV = ['blocker', 'major', 'minor'] as const;

export interface PerceptionPersona {
  who: string;
}

export interface PerceptionContext {
  ctx: string;
}

export interface PerceptionPromptSpec {
  sys: string;
  user: (persona: PerceptionPersona, context: PerceptionContext) => string;
}

export type PerceptionPromptMode = PerceptionMode;

// Generic perception prompts. Category vocabulary differs per mode; target and
// confidence are shared so aggregation remains uniform.
export const MODE_SPEC: Readonly<Record<PerceptionPromptMode, PerceptionPromptSpec>> = {
  question: {
    sys: 'Simulate a real person glancing at this display, read at its intended distance. Answer AS THAT PERSON. STRICT JSON, no prose, no fences.',
    user: (persona, context) => `You are ${persona.who}. ${context.ctx}\n` +
      'You glance at this display. What is the FIRST genuine, naive question that forms -- the literal thing a curious viewer blurts out about something shown but not explained? Hunt especially for:\n' +
      '  - an abbreviation, symbol, code, or unit you do not recognize\n' +
      '  - a visual element that looks odd, inconsistent, or unexplained (a bar that doesn\'t start from the baseline, one item colored differently from its peers, a second thinner bar with no key, a glyph with assumed meaning)\n' +
      '  - a number with no context (N of WHAT, over what window, is that high or low?)\n' +
      '  - a color, dot, or icon whose meaning is assumed, not shown.\n' +
      'Pick the single sharpest such question -- the one most worth pre-answering. Asking what a term means is fair even when the term is intentional (the answer may be a compact legend, not removing it). Then diagnose WHERE the uncertainty lives (one locus):\n' +
      '  UI = the answer IS on screen but you can\'t find/read it (too small, buried, low contrast, ambiguous symbol)\n' +
      '  INFO = derivable from data clearly present elsewhere on screen, but not surfaced\n' +
      '  GAP = the data needed simply isn\'t on the display at all\n' +
      '  CONFLICT = two things disagree, or something contradicts what you\'d expect\n' +
      '  NOISE = your question is really \'why is THIS even here?\'\n' +
      'JSON: {"headline": the question, "category": one of ' + JSON.stringify(LOCI) +
      ', "target": 2-4 words naming the screen region, "why": one sentence on the source of uncertainty, "suggestion": one concrete change that pre-answers it, "confidence": 0..1 this is a real issue not taste}',
  },
  problem: {
    sys: 'You are a sharp design + correctness reviewer. Report defects only. STRICT JSON, no prose, no fences.',
    user: (persona, context) => `Viewer context: ${persona.who}; ${context.ctx}\n` +
      'Identify the single most important thing that is WRONG with this display right now -- broken/mis-rendered layout, clipped or overflowing content, illegible or low-contrast text, a value that looks incorrect or contradictory, font fallback, wasted space, or visual clutter. Rate its severity.\n' +
      'JSON: {"headline": the problem, "category": one of ' + JSON.stringify(SEV) +
      ' (blocker=unusable/wrong, major=clearly degrades, minor=polish), "target": 2-4 words naming the region, "why": one sentence of evidence visible on screen, "suggestion": one concrete fix, "confidence": 0..1 this is really wrong not taste}',
  },
  insight: {
    sys: 'Simulate a real person glancing at this display. Report what WORKS and what you take away. STRICT JSON, no prose, no fences.',
    user: (persona, context) => `You are ${persona.who}. ${context.ctx}\n` +
      'You glance at this display. What is the single most USEFUL thing you take away in that glance, and what about the display works well enough that it should be PRESERVED (not regressed)? Be specific about the element that delivers it.\n' +
      'JSON: {"headline": the useful takeaway, "category": "insight", "target": 2-4 words naming the element that delivers it, "why": one sentence on why it works at a glance, "suggestion": how to protect or amplify it, "confidence": 0..1 this is genuinely supported by what is shown}',
  },
};

/** General, domain-agnostic UI/UX heuristics seeded into perception prompts. */
export const UX_HEURISTICS = [
  'Visual hierarchy: the most important value is the most visually prominent (size, weight, position); a glance should land on what matters first.',
  'Grouping: related items read as a group (proximity, alignment, shared enclosure/color) and unrelated items are visually separated (Gestalt proximity/similarity).',
  'Legibility: every element is readable at the intended viewing distance with sufficient contrast; nothing is clipped, overlapping, or truncated mid-word.',
  'Status visibility: the state of each thing (fresh vs stale, on/off, normal vs alarm) is unambiguous at a glance (Nielsen: visibility of system status).',
  'Consistency: the same kind of value is presented the same way everywhere; units, color meaning, and number formats do not shift between regions (Nielsen: consistency & standards).',
  'Recognition over recall: labels, icons, and abbreviations are self-evident; the viewer should not have to remember what a symbol means (Nielsen: recognition not recall).',
  'Signal over noise: every element earns its place; decorative or redundant content competes with the data (Nielsen: aesthetic & minimalist design) -- note this is about NOISE, not information density.',
] as const;

export const VERIFY_SYS = 'You are an adversarial reviewer given a screenshot and a CLAIM about it. REFUTE the claim if you can. Default refuted=true when uncertain. STRICT JSON, no fences.';

export function verifyUser(mode: PerceptionMode, finding: Pick<PerceptionFinding, 'category' | 'target' | 'why' | 'suggestion'>): string {
  return (mode === 'insight'
    ? `Claimed strength (target "${finding.target}"): ${finding.why}\n`
    : `Claimed ${mode} (category ${finding.category}, target "${finding.target}"): ${finding.why}\nProposed: ${finding.suggestion}\n`) +
    'Look at the screenshot. Is this claim actually TRUE of what is shown? ' +
    'JSON: {"refuted": bool, "reason": one sentence}. ' +
    (mode === 'insight'
      ? 'Refute if the claimed strength is not actually present/legible/effective on screen.'
      : 'Refute if the thing is in fact present/legible/correct, or if the claim is vague taste rather than a real defect.');
}
