/**
 * Page Validation Convenience Functions
 *
 * validatePage: take screenshot + validate in one call
 * validateComparison: compare two screenshots via VLM
 */

import { validateScreenshot } from './judge.mjs';
import { extractRenderedCode } from './multi-modal.mjs';
import { ValidationError } from './errors.mjs';
import { validatePrompt } from './validation.mjs';
import { log } from './logger.mjs';
import { captureStableScreenshot } from './stable-capture.mjs';
import { evaluatePairwiseCounterBalance } from './position-counterbalance.mjs';

/**
 * Validate a Playwright page by taking a screenshot and sending it to the VLM.
 *
 * @param {import('playwright').Page} page - Playwright page object
 * @param {string} prompt - What to evaluate
 * @param {Object} [options={}] - Options
 * @param {boolean} [options.fullPage] - Take full-page screenshot (default: false)
 * @param {boolean} [options.captureCode] - Extract HTML/CSS for context (default: true)
 * @param {string} [options.tempDir] - Temp directory for screenshot
 * @param {boolean} [options.keepScreenshot] - Keep screenshot after validation (default: false)
 * @returns {Promise<Object>} Validation result
 */
export async function validatePage(page, prompt, options = {}) {
  if (!page || typeof page.screenshot !== 'function') {
    throw new ValidationError('validatePage: page must be a Playwright Page object', { received: typeof page });
  }

  const fs = await import('fs');
  const path = await import('path');
  const os = await import('os');
  const tempDir = options.tempDir || os.tmpdir();
  const screenshotPath = path.join(tempDir, `validate-page-${Date.now()}.png`);

  try {
    const capture = await captureStableScreenshot(page, {
      path: screenshotPath,
      fullPage: options.fullPage ?? false,
      screenshot: options.screenshot,
      stability: options.stability,
    });

    let renderedCode = null;
    if (options.captureCode !== false) {
      renderedCode = await extractRenderedCode(page);
    }

    return await validateScreenshot(screenshotPath, prompt, {
      ...options,
      renderedCode,
      captureMetadata: capture.metadata,
    });
  } finally {
    if (!options.keepScreenshot && fs.existsSync(screenshotPath)) {
      fs.unlinkSync(screenshotPath);
    }
  }
}

/**
 * Compare two screenshots using VLM.
 *
 * @param {string} beforePath - Path to the "before" screenshot
 * @param {string} afterPath - Path to the "after" screenshot
 * @param {string} prompt - What to compare
 * @param {Object} [context={}] - Additional validation context
 * @returns {Promise<Object>} Validation result with comparison analysis
 */
export async function validateComparison(beforePath, afterPath, prompt, context = {}) {
  if (typeof beforePath !== 'string' || beforePath.length === 0) {
    throw new ValidationError('beforePath must be a non-empty string', { received: typeof beforePath });
  }
  if (typeof afterPath !== 'string' || afterPath.length === 0) {
    throw new ValidationError('afterPath must be a non-empty string', { received: typeof afterPath });
  }

  validatePrompt(prompt);

  const comparisonPrompt =
    `Compare these two screenshots (before and after). ${prompt} ` +
    'Identify what changed and whether the changes are improvements or regressions.';

  log('[Convenience] Comparing screenshots:', { beforePath, afterPath });

  const { counterBalance = true, ...reviewContext } = context;
  return await evaluatePairwiseCounterBalance(
    (images, effectivePrompt, effectiveContext) =>
      validateScreenshot(images, effectivePrompt, effectiveContext),
    beforePath,
    afterPath,
    comparisonPrompt,
    { testType: 'comparison', ...reviewContext },
    { enabled: counterBalance !== false },
  );
}
