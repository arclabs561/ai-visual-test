/** Framework-neutral Vitest/Jest matcher registration. */

import { validateScreenshot } from '../judge.mjs';
import { validateComparison } from '#page-validation';
import { ConfigError } from '../errors.mjs';

export interface MatcherResult {
  message(): string;
  pass: boolean;
}

export interface VisualValidationOptions {
  minScore?: number;
  [key: string]: unknown;
}

export type VisualMatcher = (...args: unknown[]) => Promise<MatcherResult>;

/** The small `expect` surface shared by Vitest and Jest. */
export interface ExtendableExpect {
  extend(matchers: Record<string, unknown>): void;
}

export interface VisualMatchers {
  toPassVisualCheck: (
    imagePath: unknown,
    prompt: unknown,
    options?: VisualValidationOptions,
  ) => Promise<MatcherResult>;
  toHaveVisualScore: (
    imagePath: unknown,
    minScore: unknown,
    prompt?: unknown,
    options?: VisualValidationOptions,
  ) => Promise<MatcherResult>;
  toMatchVisually: (
    beforePath: unknown,
    afterPath: unknown,
    prompt: unknown,
    options?: VisualValidationOptions,
  ) => Promise<MatcherResult>;
}

interface VisualResult {
  score?: unknown;
  issues?: unknown;
  winner?: unknown;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function topIssues(result: VisualResult): string {
  return Array.isArray(result.issues)
    ? result.issues.slice(0, 3).join('; ') || 'none'
    : 'none';
}

function notAPath(value: unknown): MatcherResult {
  return {
    message: () => `expected a screenshot path (string), got ${typeof value}`,
    pass: false,
  };
}

/**
 * Add visual matchers to either framework's supplied `expect` object.
 * This deliberately depends only on their shared `expect.extend` protocol.
 */
export function createMatchers(expect: ExtendableExpect): void {
  if (!expect || typeof expect.extend !== 'function') {
    throw new ConfigError(
      'createMatchers requires Vitest or Jest expect object. '
      + 'Import expect from "vitest" or use the global Jest expect.',
    );
  }

  const matchers: VisualMatchers = {
    async toPassVisualCheck(imagePath, prompt, options = {}) {
      if (typeof imagePath !== 'string') return notAPath(imagePath);
      const { minScore = 7, ...context } = options;

      let result: VisualResult;
      try {
        result = await validateScreenshot(imagePath, prompt as string, context) as VisualResult;
      } catch (error) {
        return { message: () => `Visual validation failed: ${errorMessage(error)}`, pass: false };
      }

      const pass = typeof result.score === 'number' && result.score >= minScore;
      return {
        message: () => pass
          ? `expected visual score < ${minScore}, but got ${result.score}/10`
          : `expected visual score >= ${minScore}, but got ${result.score ?? 'null'}/10. Issues: ${topIssues(result)}`,
        pass,
      };
    },

    async toHaveVisualScore(imagePath, minScore, prompt = 'Evaluate visual quality', options = {}) {
      if (typeof imagePath !== 'string') return notAPath(imagePath);

      let result: VisualResult;
      try {
        result = await validateScreenshot(imagePath, prompt as string, options) as VisualResult;
      } catch (error) {
        return { message: () => `Visual validation failed: ${errorMessage(error)}`, pass: false };
      }

      const pass = typeof result.score === 'number' && result.score >= (minScore as number);
      return {
        message: () => pass
          ? `expected visual score < ${String(minScore)}, but got ${result.score}/10`
          : `expected visual score >= ${String(minScore)}, but got ${result.score ?? 'null'}/10. Issues: ${topIssues(result)}`,
        pass,
      };
    },

    async toMatchVisually(beforePath, afterPath, prompt, options = {}) {
      if (typeof beforePath !== 'string') return notAPath(beforePath);
      const { minScore = 7, ...context } = options;

      let result: VisualResult;
      try {
        result = await validateComparison(beforePath, afterPath as string, prompt as string, context) as VisualResult;
      } catch (error) {
        return { message: () => `Visual comparison failed: ${errorMessage(error)}`, pass: false };
      }

      const determinate = result.winner !== 'indeterminate';
      const pass = determinate && typeof result.score === 'number' && result.score >= minScore;
      const verdict = determinate
        ? `winner: ${result.winner ?? 'unknown'}`
        : 'winner: indeterminate (image-order verdicts conflicted)';
      return {
        message: () => pass
          ? `expected comparison score < ${minScore}, but got ${result.score}/10 (${verdict})`
          : `expected a determinate comparison score >= ${minScore}, but got ${result.score ?? 'null'}/10 (${verdict}). Issues: ${topIssues(result)}`,
        pass,
      };
    },
  };

  expect.extend(matchers as unknown as Record<string, unknown>);
}
