/** Page-validation convenience functions with no Playwright dependency. */

import { validateScreenshot } from '#judge';
import { extractRenderedCode } from './multi-modal.js';
import { ValidationError } from './errors.js';
import { validatePrompt } from './validation.mjs';
import { log } from './logger.mjs';
import { captureStableScreenshot } from './stable-capture.mjs';
import { evaluatePairwiseCounterBalance } from '#position-counterbalance';
import type { ValidationContext, ValidationResult } from '#public-contract';

type ScreenshotValidator = (
  imagePath: string | string[],
  prompt: string,
  context?: ValidationContext,
) => Promise<ValidationResult>;
type StableCaptureOptions = {
  path: string;
  fullPage: boolean;
  screenshot?: Record<string, unknown>;
  stability?: NonNullable<PageValidationOptions['stability']>;
};
type StableCapture = { metadata: Record<string, unknown> };
type StableScreenshotCapture = (page: ScreenshotPage, options: StableCaptureOptions) => Promise<StableCapture>;
type RenderedCodeExtractor = (page: PageLike) => Promise<unknown>;

// Keep the root judge's broader image/context contract from leaking into this
// framework-neutral page adapter's narrower callable seam.
const validate = validateScreenshot as unknown as ScreenshotValidator;
const captureStable = captureStableScreenshot as unknown as StableScreenshotCapture;
const extractCode = extractRenderedCode as unknown as RenderedCodeExtractor;

/**
 * The minimum page surface needed to capture a review image when code capture
 * is disabled.
 */
export interface ScreenshotPage {
  screenshot(options: Record<string, unknown>): Promise<Uint8Array>;
}

/**
 * The page surface needed for the default visual-plus-rendered-code review.
 *
 * This remains structural on purpose: consumers can pass a Playwright Page,
 * a compatible framework page, or a test double without making Playwright a
 * runtime or type dependency of the core package.
 */
export interface PageLike extends ScreenshotPage {
  content(): Promise<string>;
  url(): string;
  viewportSize(): { width: number; height: number } | null;
  evaluate(
    callback: (arg?: unknown) => unknown,
    arg?: unknown,
  ): Promise<unknown>;
}

export interface PageValidationOptions extends ValidationContext {
  /** Take a full-page screenshot instead of the viewport. */
  fullPage?: boolean;
  /** Include rendered HTML/CSS context in the review. Defaults to true. */
  captureCode?: boolean;
  /** Directory for the temporary screenshot. Defaults to the OS temp directory. */
  tempDir?: string;
  /** Preserve the temporary screenshot after validation. Defaults to false. */
  keepScreenshot?: boolean;
  /** Additional screenshot options passed through to the page. */
  screenshot?: Record<string, unknown>;
  /** Stability settings used by deterministic capture. */
  stability?: {
    enabled?: boolean;
    maxAttempts?: number;
    delayMs?: number;
    requireStable?: boolean;
    waitForNetworkIdle?: boolean;
    networkIdleTimeoutMs?: number;
    waitForFonts?: boolean;
  };
}

/** Options for screenshot-only pages, which must opt out of code capture. */
export interface ScreenshotPageValidationOptions extends PageValidationOptions {
  captureCode: false;
}

/** Validate a page by capturing a stable screenshot and sending it to the VLM. */
export function validatePage(
  page: PageLike,
  prompt: string,
  options?: PageValidationOptions,
): Promise<ValidationResult>;
export function validatePage(
  page: ScreenshotPage,
  prompt: string,
  options: ScreenshotPageValidationOptions,
): Promise<ValidationResult>;
export async function validatePage(
  page: ScreenshotPage,
  prompt: string,
  options: PageValidationOptions = {},
): Promise<ValidationResult> {
  if (!page || typeof page.screenshot !== 'function') {
    throw new ValidationError('validatePage: page must be a Playwright Page object', { received: typeof page });
  }
  if (options.captureCode !== false) {
    const candidate = page as unknown as Record<string, unknown>;
    const missing = ['content', 'evaluate', 'url', 'viewportSize'].filter(
      capability => typeof candidate[capability] !== 'function',
    );
    if (missing.length > 0) {
      throw new ValidationError(
        `validatePage: captureCode requires page capabilities: ${missing.join(', ')}`,
        { missing, captureCode: true },
      );
    }
  }

  // Keep filesystem work after structural validation so invalid pages fail
  // without initializing temporary-capture dependencies.
  const fs = await import('node:fs');
  const path = await import('node:path');
  const os = await import('node:os');
  const crypto = await import('node:crypto');
  const tempDir = options.tempDir || os.tmpdir();
  const screenshotPath = path.join(tempDir, `validate-page-${Date.now()}-${crypto.randomUUID()}.png`);

  try {
    const captureOptions: StableCaptureOptions = {
      path: screenshotPath,
      fullPage: options.fullPage ?? false,
    };
    if (options.screenshot !== undefined) captureOptions.screenshot = options.screenshot;
    if (options.stability !== undefined) captureOptions.stability = options.stability;
    const capture = await captureStable(page, captureOptions);

    let renderedCode: unknown = null;
    if (options.captureCode !== false) {
      renderedCode = await extractCode(page as PageLike);
    }

    return await validate(screenshotPath, prompt, {
      ...options,
      renderedCode,
      captureMetadata: capture.metadata,
    }) as ValidationResult;
  } finally {
    if (!options.keepScreenshot && fs.existsSync(screenshotPath)) {
      fs.unlinkSync(screenshotPath);
    }
  }
}

/** Compare two screenshots using the VLM, counter-balancing image order by default. */
export async function validateComparison(
  beforePath: string,
  afterPath: string,
  prompt: string,
  context: ValidationContext = {},
): Promise<ValidationResult> {
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
      validate(images, effectivePrompt, effectiveContext),
    beforePath,
    afterPath,
    comparisonPrompt,
    { testType: 'comparison', ...reviewContext },
    { enabled: counterBalance !== false },
  ) as ValidationResult;
}
