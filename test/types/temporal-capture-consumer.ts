import {
  captureTemporalScreenshots,
  type Page,
  type TemporalCaptureOptions,
  type TemporalScreenshot,
} from '../../build/src/temporal-capture.js';

const page: Page = {
  screenshot: async () => undefined,
  waitForTimeout: async () => undefined,
};

const options: TemporalCaptureOptions = {
  fps: 2,
  duration: 1_000,
  outputDir: 'test-results',
};

export const fromObject: Promise<TemporalScreenshot[]> = captureTemporalScreenshots(page, options);
export const fromPositionals: Promise<TemporalScreenshot[]> = captureTemporalScreenshots(page, 2, 1_000, options);
