/**
 * Vitest / Jest Integration
 *
 * Provides custom matchers for Vitest and Jest test assertions.
 * Works with both frameworks since they share the expect.extend API.
 *
 * Usage (Vitest):
 * ```javascript
 * import { expect } from 'vitest';
 * import { createMatchers } from '@arclabs561/ai-visual-test/vitest';
 *
 * createMatchers(expect);
 *
 * test('visual check', async () => {
 *   await expect('screenshot.png').toPassVisualCheck('Is this accessible?');
 * });
 * ```
 *
 * Usage (Jest):
 * ```javascript
 * const { createMatchers } = require('@arclabs561/ai-visual-test/vitest');
 * // or: import { createMatchers } from '@arclabs561/ai-visual-test/vitest';
 *
 * createMatchers(expect);
 *
 * test('visual check', async () => {
 *   await expect('screenshot.png').toPassVisualCheck('Is this accessible?');
 * });
 * ```
 */

import { validateScreenshot } from '../judge.mjs';
import { validateComparison } from '../page-validation.mjs';
import { ConfigError } from '../errors.mjs';

/**
 * Create custom matchers for Vitest or Jest.
 *
 * Extends expect with:
 * - `toPassVisualCheck(prompt, options?)` -- validate a screenshot path
 * - `toHaveVisualScore(minScore, prompt, options?)` -- assert minimum score
 * - `toMatchVisually(otherPath, prompt, options?)` -- compare two screenshots
 *
 * @param {any} expect - Vitest or Jest expect object
 * @throws {ConfigError} If expect is not provided or doesn't support extend
 */
export function createMatchers(expect) {
  if (!expect || typeof expect.extend !== 'function') {
    throw new ConfigError(
      'createMatchers requires Vitest or Jest expect object. ' +
      'Import expect from "vitest" or use the global Jest expect.'
    );
  }

  expect.extend({
    /**
     * Assert that a screenshot passes visual validation (score >= 7 by default).
     *
     * @param {string} imagePath - Path to the screenshot
     * @param {string} prompt - What to check
     * @param {Object} [options] - Validation context (provider, model, etc.)
     * @param {number} [options.minScore=7] - Minimum passing score
     */
    async toPassVisualCheck(imagePath, prompt, options = {}) {
      const { minScore = 7, ...context } = options;

      if (typeof imagePath !== 'string') {
        return {
          message: () => `expected a screenshot path (string), got ${typeof imagePath}`,
          pass: false,
        };
      }

      let result;
      try {
        result = await validateScreenshot(imagePath, prompt, context);
      } catch (err) {
        return {
          message: () => `Visual validation failed: ${err.message}`,
          pass: false,
        };
      }

      const score = result.score;
      const pass = typeof score === 'number' && score >= minScore;
      const topIssues = (result.issues || []).slice(0, 3).join('; ') || 'none';

      return {
        message: () =>
          pass
            ? `expected visual score < ${minScore}, but got ${score}/10`
            : `expected visual score >= ${minScore}, but got ${score ?? 'null'}/10. Issues: ${topIssues}`,
        pass,
      };
    },

    /**
     * Assert that a screenshot meets a minimum visual score.
     *
     * @param {string} imagePath - Path to the screenshot
     * @param {number} minScore - Minimum score (0-10)
     * @param {string} prompt - What to evaluate
     * @param {Object} [options] - Validation context
     */
    async toHaveVisualScore(imagePath, minScore, prompt = 'Evaluate visual quality', options = {}) {
      if (typeof imagePath !== 'string') {
        return {
          message: () => `expected a screenshot path (string), got ${typeof imagePath}`,
          pass: false,
        };
      }

      let result;
      try {
        result = await validateScreenshot(imagePath, prompt, options);
      } catch (err) {
        return {
          message: () => `Visual validation failed: ${err.message}`,
          pass: false,
        };
      }

      const score = result.score;
      const pass = typeof score === 'number' && score >= minScore;
      const topIssues = (result.issues || []).slice(0, 3).join('; ') || 'none';

      return {
        message: () =>
          pass
            ? `expected visual score < ${minScore}, but got ${score}/10`
            : `expected visual score >= ${minScore}, but got ${score ?? 'null'}/10. Issues: ${topIssues}`,
        pass,
      };
    },

    /**
     * Assert that two screenshots match visually (comparison passes).
     *
     * @param {string} beforePath - Path to the "before" screenshot
     * @param {string} afterPath - Path to the "after" screenshot
     * @param {string} prompt - What to compare
     * @param {Object} [options] - Validation context
     * @param {number} [options.minScore=7] - Minimum passing score
     */
    async toMatchVisually(beforePath, afterPath, prompt, options = {}) {
      const { minScore = 7, ...context } = options;

      if (typeof beforePath !== 'string') {
        return {
          message: () => `expected a screenshot path (string), got ${typeof beforePath}`,
          pass: false,
        };
      }

      let result;
      try {
        result = await validateComparison(beforePath, afterPath, prompt, context);
      } catch (err) {
        return {
          message: () => `Visual comparison failed: ${err.message}`,
          pass: false,
        };
      }

      const score = result.score;
      const determinate = result.winner !== 'indeterminate';
      const pass = determinate && typeof score === 'number' && score >= minScore;
      const topIssues = (result.issues || []).slice(0, 3).join('; ') || 'none';
      const verdict = determinate
        ? `winner: ${result.winner ?? 'unknown'}`
        : 'winner: indeterminate (image-order verdicts conflicted)';

      return {
        message: () =>
          pass
            ? `expected comparison score < ${minScore}, but got ${score}/10 (${verdict})`
            : `expected a determinate comparison score >= ${minScore}, but got ${score ?? 'null'}/10 (${verdict}). Issues: ${topIssues}`,
        pass,
      };
    },
  });
}
