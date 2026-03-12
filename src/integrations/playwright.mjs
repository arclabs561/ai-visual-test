/**
 * Playwright Integration Helpers
 * 
 * Provides custom matchers for Playwright test assertions.
 * 
 * Usage:
 * ```javascript
 * import { expect } from '@playwright/test';
 * import { createMatchers } from '@arclabs561/ai-visual-test/playwright';
 * 
 * createMatchers(expect);
 * 
 * test('visual check', async ({ page }) => {
 *   await expect(page).toHaveVisualScore(8, 'Check for visual bugs');
 * });
 * ```
 */

import { validatePage } from '../convenience.mjs';
import { ConfigError } from '../errors.mjs';

/**
 * Create custom matchers for Playwright's expect
 * 
 * This function extends Playwright's expect with custom matchers:
 * - `toHaveVisualScore(minScore, prompt, options)` - Validate visual quality
 * - `toBeAccessibleHybrid(minContrast, options)` - Validate accessibility (hybrid)
 * 
 * @param {any} expect - Playwright's expect object (from @playwright/test)
 * @throws {Error} If expect is not provided or invalid
 * 
 * @example
 * ```javascript
 * import { expect } from '@playwright/test';
 * import { createMatchers } from '@arclabs561/ai-visual-test/playwright';
 * 
 * createMatchers(expect);
 * 
 * test('visual check', async ({ page }) => {
 *   await expect(page).toHaveVisualScore(7, 'Check visual quality');
 * });
 * ```
 */
export function createMatchers(expect) {
  if (!expect || typeof expect.extend !== 'function') {
    throw new ConfigError('createMatchers requires Playwright\'s expect object. Import it from @playwright/test');
  }
  expect.extend({
    /**
     * Assert that a page (or screenshot) meets a visual quality score
     * 
     * @param {import('playwright').Page | string} target - Page object or screenshot path
     * @param {number} minScore - Minimum score (0-10)
     * @param {string} prompt - Evaluation prompt
     * @param {Object} options - Validation options
     */
    async toHaveVisualScore(target, minScore, prompt = 'Evaluate visual quality', options = {}) {
      let result;
      
      if (typeof target === 'string') {
        // It's a screenshot path
        const { validateScreenshot } = await import('../judge.mjs');
        result = await validateScreenshot(target, prompt, options);
      } else {
        // It's a Page object
        result = await validatePage(target, prompt, options);
      }

      // Format issues for display
      const formattedIssues = result.issues?.slice(0, 5).map(issue => {
        if (typeof issue === 'string') return issue;
        return JSON.stringify(issue);
      }).join(', ') || 'none';

      // Handle null scores gracefully (API may be unavailable or validation disabled)
      const pass = result.score !== null && result.score >= minScore;

      if (result.score === null) {
        return {
          message: () =>
            `expected visual score to be >= ${minScore}, but got null.\n` +
            `This usually means:\n` +
            `- API validation is disabled (check API keys in .env)\n` +
            `- API call failed (check network/API status)\n` +
            `- Validation was skipped (check options)\n` +
            `Issues: ${formattedIssues}\n` +
            `Reasoning: ${result.reasoning?.substring(0, 200) || 'No reasoning available'}...`,
          pass: false,
        };
      }

      return {
        message: () =>
          `expected visual score to be >= ${minScore}, but got ${result.score}.\nIssues: ${formattedIssues}${result.issues?.length > 5 ? ` (and ${result.issues.length - 5} more)` : ''}\nReasoning: ${result.reasoning?.substring(0, 200)}${result.reasoning?.length > 200 ? '...' : ''}`,
        pass,
      };
    },

    /**
     * Assert that a page passes accessibility checks (Hybrid)
     * 
     * @param {import('playwright').Page} page - Page object
     * @param {number} minContrast - Minimum contrast (default 4.5)
     */
    async toBeAccessibleHybrid(page, minContrast = 4.5, options = {}) {
      const { validateAccessibilityHybrid } = await import('../validators/index.mjs');
      
      // We need a temporary screenshot path
      const fs = await import('fs');
      const path = await import('path');
      const os = await import('os');
      const tempDir = os.tmpdir();
      const screenshotPath = path.join(tempDir, `a11y-check-${Date.now()}.png`);
      
      await page.screenshot({ path: screenshotPath });
      
      let result;
      try {
        result = await validateAccessibilityHybrid(page, screenshotPath, minContrast, options);
      } finally {
        if (fs.existsSync(screenshotPath)) {
          fs.unlinkSync(screenshotPath);
        }
      }

      // Format issues for display
      const formattedIssues = result.uniqueIssues?.slice(0, 5).map(issue => {
        if (typeof issue === 'string') return issue;
        return JSON.stringify(issue);
      }).join(', ') || 'none';
      
      return {
        message: () =>
          `expected page to be accessible (programmatic + visual).\nPass: ${result.passed}\nIssues: ${formattedIssues}${result.uniqueIssues?.length > 5 ? ` (and ${result.uniqueIssues.length - 5} more)` : ''}`,
        pass: result.passed
      };
    }
  });
}

