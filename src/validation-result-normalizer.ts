import type { ValidationResult } from '#public-contract';
import { warn } from './logger.mjs';

type RichItem = Record<string, unknown>;

function richItem(value: unknown, fallbackKey: string): RichItem {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return { ...value as RichItem };
  }
  return { [fallbackKey]: String(value) };
}

function issueText(issue: unknown): string {
  if (typeof issue === 'string') return issue;
  const rich = richItem(issue, 'description');
  if (rich.description) return String(rich.description);
  if (rich.element && rich.issue) return `${String(rich.element)}: ${String(rich.issue)}`;
  if (rich.ratio && rich.required) return `Contrast ${String(rich.ratio)}:1 (required: ${String(rich.required)}:1)`;
  if (rich.message) return String(rich.message);
  return JSON.stringify(rich);
}

function recommendationText(recommendation: unknown): string {
  if (typeof recommendation === 'string') return recommendation;
  const rich = richItem(recommendation, 'suggestion');
  return String(rich.suggestion ?? rich.description ?? rich.text ?? JSON.stringify(rich));
}

/** Normalize every public validation result to one stable, serializable shape. */
export function normalizeValidationResult(result: unknown, source = 'unknown'): ValidationResult {
  if (result === null || result === undefined) {
    warn(`[Normalizer] ${source}: result is null/undefined`);
    return {
      enabled: false,
      score: null,
      issues: [],
      recommendations: [],
      reasoning: 'Result was null or undefined',
      assessment: null,
    };
  }
  if (typeof result !== 'object' || Array.isArray(result)) {
    warn(`[Normalizer] ${source}: result is not an object`);
    return {
      enabled: false,
      score: null,
      issues: [],
      recommendations: [],
      reasoning: 'Result was not an object',
      assessment: null,
    };
  }

  const normalized = { ...result as Record<string, unknown> };
  if (normalized.enabled === undefined) {
    normalized.enabled = normalized.score !== null
      || Boolean(normalized.judgment)
      || normalized.provider !== undefined;
  }
  if (typeof normalized.enabled !== 'boolean') normalized.enabled = Boolean(normalized.enabled);

  if (normalized.score === null || normalized.score === undefined) {
    if (normalized.score === undefined) warn(`[Normalizer] ${source}: score is undefined, defaulting to null`);
    normalized.score = null;
  }

  const issues = Array.isArray(normalized.issues) ? normalized.issues : [];
  if (!Array.isArray(normalized.issues)) {
    warn(`[Normalizer] ${source}: issues is not an array, defaulting to empty array`);
  }
  normalized.richIssues = issues.map(issue => richItem(issue, 'description'));
  normalized.issues = issues.map(issueText);

  const recommendations = Array.isArray(normalized.recommendations) ? normalized.recommendations : [];
  const existingRich = Array.isArray(normalized.richRecommendations)
    && normalized.richRecommendations.length === recommendations.length
    ? normalized.richRecommendations
    : recommendations;
  normalized.richRecommendations = existingRich.map(recommendation => richItem(recommendation, 'suggestion'));
  normalized.recommendations = recommendations.map(recommendationText);

  if (!normalized.reasoning) {
    normalized.reasoning = normalized.judgment || normalized.message || 'No reasoning provided';
  }
  if (normalized.assessment === undefined) normalized.assessment = null;

  return normalized as unknown as ValidationResult;
}
