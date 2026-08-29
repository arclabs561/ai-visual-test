/**
 * Deterministic screenshot capture for static visual review.
 *
 * Temporal, persona, and gameplay capture intentionally do not use this helper:
 * changes between their frames are evidence rather than noise.
 */

import { Buffer } from 'node:buffer';
import { ValidationError } from '#errors';

function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

async function settlePage(page, options) {
  const diagnostics = [];
  let networkIdle = 'skipped';
  let fonts = 'skipped';

  if (options.waitForNetworkIdle !== false) {
    if (typeof page.waitForLoadState === 'function') {
      try {
        await page.waitForLoadState('networkidle', {
          timeout: options.networkIdleTimeoutMs ?? 1000,
        });
        networkIdle = 'ready';
      } catch (error) {
        networkIdle = 'unavailable';
        diagnostics.push(`networkidle: ${messageOf(error)}`);
      }
    } else {
      networkIdle = 'unsupported';
    }
  }

  if (options.waitForFonts !== false) {
    if (typeof page.evaluate === 'function') {
      try {
        await page.evaluate(async () => {
          if (globalThis.document?.fonts?.ready) {
            await globalThis.document.fonts.ready;
          }
        });
        fonts = 'ready';
      } catch (error) {
        fonts = 'unavailable';
        diagnostics.push(`fonts: ${messageOf(error)}`);
      }
    } else {
      fonts = 'unsupported';
    }
  }

  return { networkIdle, fonts, diagnostics };
}

async function waitBetweenCaptures(page, delayMs) {
  if (!(delayMs > 0)) return;
  if (typeof page.waitForTimeout === 'function') {
    await page.waitForTimeout(delayMs);
    return;
  }
  await new Promise(resolve => setTimeout(resolve, delayMs));
}

/**
 * Capture a static page after readiness checks and consecutive matching frames.
 * Screenshot options are forwarded to Playwright, except that this helper owns
 * the output path.
 *
 * @param {import('playwright').Page} page
 * @param {{
 *   path: string;
 *   fullPage?: boolean;
 *   screenshot?: Record<string, unknown>;
 *   stability?: {
 *     enabled?: boolean;
 *     maxAttempts?: number;
 *     delayMs?: number;
 *     requireStable?: boolean;
 *     waitForNetworkIdle?: boolean;
 *     networkIdleTimeoutMs?: number;
 *     waitForFonts?: boolean;
 *   };
 * }} options
 */
export async function captureStableScreenshot(page, options) {
  if (!page || typeof page.screenshot !== 'function') {
    throw new ValidationError('captureStableScreenshot requires a Playwright Page object');
  }
  if (!options || typeof options.path !== 'string' || options.path.length === 0) {
    throw new ValidationError('captureStableScreenshot requires a non-empty output path');
  }

  const stability = options.stability || {};
  const enabled = stability.enabled !== false;
  const maxAttempts = enabled ? Math.max(2, stability.maxAttempts ?? 4) : 1;
  const delayMs = stability.delayMs ?? 50;
  const settle = await settlePage(page, stability);
  const screenshotOptions = {
    animations: 'disabled',
    caret: 'hide',
    fullPage: options.fullPage ?? false,
    ...(options.screenshot || {}),
    path: options.path,
  };

  let previous = null;
  let buffer = null;
  let stable = enabled ? false : null;
  let attempts = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    attempts = attempt;
    buffer = Buffer.from(await page.screenshot(screenshotOptions));
    if (enabled && previous && Buffer.compare(previous, buffer) === 0) {
      stable = true;
      break;
    }
    previous = buffer;
    if (attempt < maxAttempts) await waitBetweenCaptures(page, delayMs);
  }

  if (enabled && !stable && stability.requireStable === true) {
    throw new ValidationError(`Screenshot did not stabilize after ${attempts} attempts`, {
      attempts,
      path: options.path,
    });
  }

  return {
    path: options.path,
    buffer,
    metadata: {
      stable,
      attempts,
      viewport: typeof page.viewportSize === 'function' ? page.viewportSize() : null,
      url: typeof page.url === 'function' ? page.url() : null,
      screenshot: {
        fullPage: screenshotOptions.fullPage,
        animations: screenshotOptions.animations,
        caret: screenshotOptions.caret,
        maskCount: Array.isArray(screenshotOptions.mask) ? screenshotOptions.mask.length : 0,
        hasStyle: Boolean(screenshotOptions.style || screenshotOptions.stylePath),
      },
      settle,
    },
  };
}
