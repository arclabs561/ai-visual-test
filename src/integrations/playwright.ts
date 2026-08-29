/** Framework-neutral matcher registration for Playwright's `expect` API. */

import { randomUUID } from 'node:crypto';
import { existsSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { validateScreenshot } from '../judge.mjs';
import { ConfigError } from '../errors.mjs';
import { captureStableScreenshot as captureStable } from '../stable-capture.mjs';
import { validatePage } from '#page-validation';
import type { PageLike, PageValidationOptions, ScreenshotPage } from '#page-validation';

export interface MatcherResult {
  message(): string;
  pass: boolean;
}

export interface PlaywrightExpect {
  extend(matchers: Record<string, unknown>): void;
}

/**
 * Full page capability required by the default visual and accessibility
 * matchers. This mirrors the core review boundary without importing the
 * optional Playwright peer's types.
 */
export type PlaywrightPage = PageLike;

/** Options forwarded to the core visual-review boundary. */
export type PlaywrightValidationOptions = PageValidationOptions;

export interface StableScreenshotOptions {
  path: string;
  fullPage?: boolean;
  screenshot?: Record<string, unknown>;
  stability?: Record<string, unknown>;
}

export interface PlaywrightMatchers {
  toHaveVisualScore(
    target: string | PlaywrightPage,
    minScore: number,
    prompt?: string,
    options?: PlaywrightValidationOptions,
  ): Promise<MatcherResult>;
  toBeAccessibleHybrid(
    page: PlaywrightPage,
    minContrast?: number,
    options?: PlaywrightValidationOptions,
  ): Promise<MatcherResult>;
}

interface VisualResult {
  score?: number | null;
  issues?: unknown[];
  reasoning?: string;
}

interface AccessibilityResult extends VisualResult {
  passed: boolean;
  uniqueIssues?: unknown[];
}

/** Capture a stable frame without exposing Playwright's optional peer types. */
export async function captureStableScreenshot(
  page: ScreenshotPage,
  options: StableScreenshotOptions,
): Promise<{ path: string; buffer: Uint8Array; metadata: Record<string, unknown> }> {
  return await captureStable(page as never, options as never) as {
    path: string; buffer: Uint8Array; metadata: Record<string, unknown>;
  };
}

function formatIssues(issues: unknown[] | undefined): string {
  return issues?.slice(0, 5).map(issue => (
    typeof issue === 'string' ? issue : JSON.stringify(issue)
  )).join(', ') || 'none';
}

function moreIssues(issues: unknown[] | undefined): string {
  return (issues?.length ?? 0) > 5 ? ` (and ${issues!.length - 5} more)` : '';
}

/**
 * Add visual and hybrid accessibility matchers to a Playwright-compatible
 * `expect`. This package neither imports nor exports Playwright itself, so the
 * integration remains usable with the optional peer absent until a caller
 * supplies its expect/page objects.
 */
export function createMatchers(expect: PlaywrightExpect): void {
  if (!expect || typeof expect.extend !== 'function') {
    throw new ConfigError(
      "createMatchers requires Playwright's expect object. Import it from @playwright/test",
    );
  }

  const matchers: PlaywrightMatchers = {
    async toHaveVisualScore(target, minScore, prompt = 'Evaluate visual quality', options = {}) {
      const result = typeof target === 'string'
        ? await validateScreenshot(target, prompt, options) as VisualResult
        : await validatePage(target as never, prompt, options as never) as VisualResult;
      const issues = formatIssues(result.issues);
      const pass = result.score !== null && result.score !== undefined && result.score >= minScore;

      if (result.score === null || result.score === undefined) {
        return {
          message: () =>
            `expected visual score to be >= ${minScore}, but got null.\n`
            + 'This usually means:\n'
            + '- API validation is disabled (check API keys in .env)\n'
            + '- API call failed (check network/API status)\n'
            + '- Validation was skipped (check options)\n'
            + `Issues: ${issues}\n`
            + `Reasoning: ${result.reasoning?.substring(0, 200) || 'No reasoning available'}...`,
          pass: false,
        };
      }

      return {
        message: () =>
          `expected visual score to be >= ${minScore}, but got ${result.score}.\n`
          + `Issues: ${issues}${moreIssues(result.issues)}\n`
          + `Reasoning: ${result.reasoning?.substring(0, 200)}${(result.reasoning?.length ?? 0) > 200 ? '...' : ''}`,
        pass,
      };
    },

    async toBeAccessibleHybrid(page, minContrast = 4.5, options = {}) {
      const { validateAccessibilityHybrid } = await import('../validators/index.mjs');
      const screenshotPath = join(tmpdir(), `a11y-check-${Date.now()}-${randomUUID()}.png`);
      let result: AccessibilityResult;
      try {
        const captureOptions: StableScreenshotOptions = {
          path: screenshotPath,
          fullPage: options.fullPage ?? false,
        };
        if (options.screenshot !== undefined) captureOptions.screenshot = options.screenshot;
        if (options.stability !== undefined) captureOptions.stability = options.stability;
        await captureStableScreenshot(page, captureOptions);
        result = await validateAccessibilityHybrid(
          page as never,
          screenshotPath,
          minContrast,
          options,
        ) as AccessibilityResult;
      } finally {
        if (existsSync(screenshotPath)) unlinkSync(screenshotPath);
      }

      return {
        message: () =>
          'expected page to be accessible (programmatic + visual).\n'
          + `Pass: ${result.passed}\n`
          + `Issues: ${formatIssues(result.uniqueIssues)}${moreIssues(result.uniqueIssues)}`,
        pass: result.passed,
      };
    },
  };

  expect.extend(matchers as unknown as Record<string, unknown>);
}
