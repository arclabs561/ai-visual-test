/**
 * Canonical provider-output contracts.
 *
 * Providers may enforce these schemas natively or return legacy text. Both
 * paths terminate here so downstream code never has to guess at response
 * shape.
 */

const stringArray = {
  type: 'array',
  items: { type: 'string' }
};

export const SCALAR_REVIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    kind: { type: 'string', enum: ['scalar'] },
    score: { type: 'number', minimum: 0, maximum: 10 },
    assessment: { type: 'string' },
    reasoning: { type: 'string' },
    issues: stringArray,
    recommendations: stringArray,
    strengths: stringArray
  },
  required: ['kind', 'score', 'assessment', 'reasoning', 'issues', 'recommendations', 'strengths']
};

export const COMPARISON_REVIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    kind: { type: 'string', enum: ['comparison'] },
    winner: { type: 'string', enum: ['A', 'B', 'tie', 'indeterminate'] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    reasoning: { type: 'string' },
    differences: stringArray,
    scores: {
      type: 'object',
      additionalProperties: false,
      properties: {
        A: { type: 'number', minimum: 0, maximum: 10 },
        B: { type: 'number', minimum: 0, maximum: 10 }
      },
      required: ['A', 'B']
    }
  },
  required: ['kind', 'winner', 'confidence', 'reasoning', 'differences', 'scores']
};

export class ReviewContractError extends Error {
  constructor(diagnostics) {
    super(`Provider output did not satisfy the review contract: ${diagnostics.join(', ')}`);
    this.name = 'ReviewContractError';
    this.diagnostics = diagnostics;
  }
}

export function getReviewSchema(mode = 'scalar') {
  return mode === 'comparison' ? COMPARISON_REVIEW_SCHEMA : SCALAR_REVIEW_SCHEMA;
}

function finiteNumber(value, min, max) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function stringList(value) {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

function validateScalar(value) {
  const diagnostics = [];
  if (!finiteNumber(value?.score, 0, 10)) diagnostics.push('invalid_score');
  if (typeof value?.assessment !== 'string') diagnostics.push('missing_assessment');
  if (typeof value?.reasoning !== 'string') diagnostics.push('missing_reasoning');
  for (const field of ['issues', 'recommendations', 'strengths']) {
    if (!stringList(value?.[field])) diagnostics.push(`invalid_${field}`);
  }
  if (diagnostics.length) throw new ReviewContractError(diagnostics);
  return {
    kind: 'scalar',
    score: value.score,
    assessment: value.assessment,
    reasoning: value.reasoning,
    issues: value.issues,
    recommendations: value.recommendations,
    strengths: value.strengths
  };
}

function validateComparison(value) {
  const diagnostics = [];
  if (!['A', 'B', 'tie', 'indeterminate'].includes(value?.winner)) diagnostics.push('invalid_winner');
  if (!finiteNumber(value?.confidence, 0, 1)) diagnostics.push('invalid_confidence');
  if (typeof value?.reasoning !== 'string') diagnostics.push('missing_reasoning');
  if (!stringList(value?.differences)) diagnostics.push('invalid_differences');
  if (!finiteNumber(value?.scores?.A, 0, 10) || !finiteNumber(value?.scores?.B, 0, 10)) {
    diagnostics.push('invalid_scores');
  }
  if (diagnostics.length) throw new ReviewContractError(diagnostics);
  return {
    kind: 'comparison',
    winner: value.winner,
    confidence: value.confidence,
    reasoning: value.reasoning,
    differences: value.differences,
    scores: { A: value.scores.A, B: value.scores.B }
  };
}

function extractJson(text) {
  const trimmed = text.trim();
  const unfenced = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(unfenced);
  } catch {
    const start = unfenced.indexOf('{');
    const end = unfenced.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(unfenced.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

const SECTION_NAMES = new Map([
  ['issues', 'issues'], ['findings', 'issues'], ['problems', 'issues'],
  ['recommendations', 'recommendations'], ['suggestions', 'recommendations'],
  ['strengths', 'strengths'], ['positives', 'strengths'],
  ['differences', 'differences'],
  ['reasoning', 'reasoning'], ['rationale', 'reasoning']
]);

function cleanHeading(line) {
  return line
    .replace(/^\s{0,3}#{1,6}\s*/, '')
    .replace(/^\s*\*\*(.+)\*\*\s*:?[\s]*$/, '$1')
    .replace(/:\s*$/, '')
    .trim()
    .toLowerCase();
}

function cleanListItem(line) {
  const match = line.match(/^\s*(?:[-*+]\s+|\d+[.)]\s+)(.+?)\s*$/);
  if (!match) return null;
  return match[1].replace(/^\*\*(.+?):?\*\*\s*:?[\s]*/, '$1: ').trim();
}

function parseLegacyScalar(text) {
  const lists = { issues: [], recommendations: [], strengths: [] };
  let section = null;
  let assessment = null;
  const reasoning = [];

  for (const line of text.split(/\r?\n/)) {
    const heading = cleanHeading(line);
    if (SECTION_NAMES.has(heading)) {
      section = SECTION_NAMES.get(heading);
      continue;
    }
    const field = line.match(/^\s*(?:\*\*)?(assessment|verdict)(?:\*\*)?\s*:\s*(.+?)\s*$/i);
    if (field) {
      assessment = field[2].trim();
      section = null;
      continue;
    }
    const item = cleanListItem(line);
    if (item && lists[section]) {
      lists[section].push(item);
      continue;
    }
    if (section === 'reasoning' && line.trim()) reasoning.push(line.trim());
  }

  const scoreMatch = text.match(/(?:overall\s+)?score\s*:?\s*(\d+(?:\.\d+)?)\s*(?:\/\s*10)?/i)
    || text.match(/^\s*(\d+(?:\.\d+)?)\s*\/\s*10\s*$/m);
  const score = scoreMatch ? Number(scoreMatch[1]) : null;
  if (!finiteNumber(score, 0, 10)) throw new ReviewContractError(['invalid_json', 'invalid_score']);

  if (!assessment) {
    const verdict = text.match(/(?:final\s+)?verdict\s*:?\s*(pass|fail|needs[- ]improvement)/i);
    assessment = verdict?.[1] || (score >= 7 ? 'pass' : 'needs-improvement');
  }

  return {
    kind: 'scalar',
    score,
    assessment,
    reasoning: reasoning.join(' ') || text.trim().slice(0, 500),
    issues: lists.issues,
    recommendations: lists.recommendations,
    strengths: lists.strengths
  };
}

/**
 * Parse and validate a provider result. Legacy text is accepted only for
 * scalar reviews; pairwise results require an unambiguous structured object.
 */
export function parseReviewOutcome(input, { mode = 'scalar', allowLegacy = true } = {}) {
  const value = typeof input === 'string' ? extractJson(input) : input;
  try {
    const outcome = mode === 'comparison' ? validateComparison(value) : validateScalar(value);
    return { outcome, format: 'structured', diagnostics: [] };
  } catch (error) {
    if (mode === 'scalar' && allowLegacy && typeof input === 'string') {
      const outcome = parseLegacyScalar(input);
      return { outcome, format: 'legacy-text', diagnostics: ['structured_output_invalid'] };
    }
    if (error instanceof ReviewContractError) throw error;
    throw new ReviewContractError(['invalid_output']);
  }
}

export function buildRepairInstruction(diagnostics, mode = 'scalar') {
  const unique = [...new Set(diagnostics)].slice(0, 8);
  return [
    'Your previous response could not be validated.',
    `Diagnostic codes: ${unique.join(', ') || 'invalid_output'}.`,
    `Return only one JSON object matching the ${mode} review schema. Do not include markdown.`
  ].join('\n');
}
