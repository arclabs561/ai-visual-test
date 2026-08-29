import { ValidationError } from './errors.js';
import { warn } from './logger.js';
import { randomUUID } from 'node:crypto';

export interface TemporalScreenshot {
  path: string;
  frame: number;
  timestamp: number;
}

export interface ScreenshotOptions extends Record<string, unknown> {
  type: 'png';
  path: string;
}

/** The Playwright surface temporal capture needs; no Playwright package dependency required. */
export interface Page {
  screenshot(options: ScreenshotOptions): Promise<unknown>;
  waitForTimeout?(milliseconds: number): Promise<unknown>;
}

export interface TemporalCaptureOptions {
  fps?: number;
  duration?: number;
  /** @deprecated PNG captures have no quality setting; retained only for call compatibility. */
  optimizeForSpeed?: boolean;
  outputDir?: string;
}

const DEFAULT_FPS = 2;
const DEFAULT_DURATION = 2_000;
const MAX_TIMER_DELAY = 2_147_483_647;
const CAPTURE_SESSION_ID = randomUUID();

function assertPositiveFinite(value: number, name: 'fps' | 'duration'): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new ValidationError(`captureTemporalScreenshots requires a finite positive ${name}`, {
      [name]: value
    });
  }
}

function isPage(page: unknown): page is Page {
  return Boolean(page)
    && typeof (page as Partial<Page>).screenshot === 'function';
}

async function waitForInterval(page: Page, milliseconds: number): Promise<void> {
  if (typeof page.waitForTimeout === 'function') {
    await page.waitForTimeout(milliseconds);
    return;
  }

  await new Promise<void>(resolve => setTimeout(resolve, Math.min(milliseconds, MAX_TIMER_DELAY)));
}

/**
 * Capture temporal screenshots for an animation using one options object.
 */
export function captureTemporalScreenshots(
  page: Page,
  options?: TemporalCaptureOptions,
): Promise<TemporalScreenshot[]>;

/**
 * Capture temporal screenshots for an animation using the established positional API.
 */
export function captureTemporalScreenshots(
  page: Page,
  fps?: number,
  duration?: number,
  options?: TemporalCaptureOptions,
): Promise<TemporalScreenshot[]>;

export async function captureTemporalScreenshots(
  page: unknown,
  fpsOrOptions: number | TemporalCaptureOptions = DEFAULT_FPS,
  positionalDuration = DEFAULT_DURATION,
  positionalOptions: TemporalCaptureOptions = {},
): Promise<TemporalScreenshot[]> {
  if (!isPage(page)) {
    throw new ValidationError('captureTemporalScreenshots requires a Playwright Page object', {
      received: typeof page,
      hasScreenshot: typeof (page as Partial<Page> | null)?.screenshot === 'function',
      hasWaitForTimeout: typeof (page as Partial<Page> | null)?.waitForTimeout === 'function'
    });
  }

  const objectForm = typeof fpsOrOptions === 'object' && fpsOrOptions !== null;
  const options = objectForm ? fpsOrOptions : positionalOptions;
  const fps = objectForm ? options.fps ?? DEFAULT_FPS : fpsOrOptions;
  const duration = objectForm ? options.duration ?? DEFAULT_DURATION : positionalDuration;
  const outputDir = options.outputDir ?? 'test-results';

  assertPositiveFinite(fps, 'fps');
  assertPositiveFinite(duration, 'duration');

  const screenshots: TemporalScreenshot[] = [];
  const interval = 1_000 / fps;
  const frames = Math.floor(duration / interval);

  for (let frame = 0; frame < frames; frame += 1) {
    const timestamp = Date.now();
    const path = `${outputDir}/temporal-${CAPTURE_SESSION_ID}-${randomUUID()}-${timestamp}-${frame}.png`;

    try {
      // Playwright does not support `quality` for PNG screenshots.
      await page.screenshot({ type: 'png', path });
      screenshots.push({ path, frame, timestamp });

      const elapsed = Date.now() - timestamp;
      const waitTime = fps > 30 ? Math.max(0, interval - elapsed) : interval;
      if (waitTime > 0) await waitForInterval(page, waitTime);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warn(`[Temporal Capture] Screenshot ${frame} failed: ${message}`);
    }
  }

  return screenshots;
}
