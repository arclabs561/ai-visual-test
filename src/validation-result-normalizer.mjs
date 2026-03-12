/**
 * Validation Result Normalizer
 * 
 * Ensures validation results have consistent structure.
 * Centralizes normalization logic to avoid duplication.
 */

import { warn } from './logger.mjs';
import { calibrateScore } from './score-calibration.mjs';

/**
 * Normalize validation result to ensure consistent structure
 * 
 * @param {Object} result - Validation result from validateScreenshot
 * @param {string} [source] - Source function name for logging
 * @returns {Object} Normalized validation result
 */
export function normalizeValidationResult(result, source = 'unknown') {
  if (!result) {
    warn(`[Normalizer] ${source}: result is null/undefined`);
    return {
      enabled: false,
      score: null,
      issues: [],
      reasoning: 'Result was null or undefined',
      assessment: null
    };
  }

  // Create a copy to avoid mutating the original
  const normalized = { ...result };

  // Ensure enabled field is always present (default to true if not specified)
  if (normalized.enabled === undefined) {
    // If enabled is not specified, infer from presence of other fields
    normalized.enabled = normalized.score !== null || normalized.judgment || normalized.provider !== undefined;
  }

  // Ensure score is always present (may be null)
  if (normalized.score === null || normalized.score === undefined) {
    if (normalized.score === undefined) {
      warn(`[Normalizer] ${source}: score is undefined, defaulting to null`);
    }
    normalized.score = null;
  }

  // Ensure issues is always an array of strings
  if (!Array.isArray(normalized.issues)) {
    warn(`[Normalizer] ${source}: issues is not an array, defaulting to empty array`);
    normalized.issues = [];
    normalized.richIssues = [];
  } else {
    // Preserve original rich issue objects before flattening
    normalized.richIssues = normalized.issues.map(issue => {
      if (typeof issue === 'string') {
        return { description: issue };
      }
      return typeof issue === 'object' && issue !== null ? { ...issue } : { description: String(issue) };
    });
    // Normalize issues to strings for consistent formatting (backward compat)
    normalized.issues = normalized.issues.map(issue => {
      if (typeof issue === 'string') {
        return issue;
      }
      if (typeof issue === 'object' && issue !== null) {
        // Format object issues as strings
        if (issue.description) {
          return issue.description;
        }
        if (issue.element && issue.issue) {
          return `${issue.element}: ${issue.issue}`;
        }
        if (issue.ratio && issue.required) {
          return `Contrast ${issue.ratio}:1 (required: ${issue.required}:1)`;
        }
        if (issue.message) {
          return issue.message;
        }
        // Fallback: stringify the object
        return JSON.stringify(issue);
      }
      // Fallback: convert to string
      return String(issue);
    });
  }

  // Ensure reasoning is always present
  if (!normalized.reasoning) {
    normalized.reasoning = normalized.judgment || normalized.message || 'No reasoning provided';
  }

  // Ensure assessment is present (may be null)
  if (normalized.assessment === undefined) {
    normalized.assessment = null;
  }

  // Apply score calibration if provider is known
  // Stores both raw and calibrated scores for transparency
  if (normalized.score !== null && normalized.provider) {
    normalized.rawScore = normalized.score;
    normalized.score = calibrateScore(normalized.score, normalized.provider);
  }

  return normalized;
}

