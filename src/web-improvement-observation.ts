/**
 * Browser observation capture for the internal visual-improvement transaction.
 *
 * This deliberately owns neither browser lifecycle nor screenshot cleanup: the
 * downstream adapter supplies a page and an output path, then decides how long
 * the evidence should be retained.
 */

import { createHash } from 'node:crypto';
import { ValidationError } from './errors.js';
import { canonicalJsonSha256 } from './improvement-replay.js';
import type {
  ImprovementArtifactReference,
  ImprovementMetadata,
  ImprovementObservation,
} from './improvement-transaction.js';
import { extractRenderedCode, type RenderedCode } from './multi-modal.js';
import { captureStableScreenshot } from './stable-capture.mjs';

type ScreenshotPage = {
  screenshot(options: Record<string, unknown>): Promise<Uint8Array>;
};

type RenderedCodePage = ScreenshotPage & {
  content(): Promise<string>;
  evaluate<Result, Argument>(
    pageFunction: (argument: Argument) => Result,
    argument: Argument,
  ): Promise<Awaited<Result>>;
  evaluate<Result>(pageFunction: () => Result): Promise<Awaited<Result>>;
  url(): string;
  viewportSize(): { width: number; height: number } | null | Promise<{ width: number; height: number } | null>;
};

export interface WebImprovementObservationOptions {
  /** Caller-owned destination for the screenshot evidence. */
  screenshotPath: string;
  /** Capture rendered page context too. Defaults to true. */
  captureCode?: boolean;
  fullPage?: boolean;
  screenshot?: Record<string, unknown>;
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

/** Deliberately excludes pixels, raw URL query strings, and rendered code. */
export interface WebObservationCaptureMetadata {
  stable: boolean | null;
  attempts: number;
  viewport: { width: number; height: number } | null;
  url: string | null;
  screenshot: {
    fullPage: boolean;
    animations: string;
    caret: string;
    maskCount: number;
    hasStyle: boolean;
  };
  settle: {
    networkIdle: string;
    fonts: string;
  };
}

/** Rendered evidence stripped of volatile and non-essential operational fields. */
export type NormalizedRenderedCode = Omit<RenderedCode, 'timestamp' | 'url'>;

export interface WebImprovementObservationPayload {
  /**
   * Content-addressed image held by the caller's evidence store.
   *
   * The transaction/evaluator receives this descriptor only. Resolving the
   * digest to pixels is a separate, explicitly-authorized egress decision.
   */
  readonly screenshot: ImprovementArtifactReference;
  readonly renderedCode: NormalizedRenderedCode | null;
}

export interface WebImprovementObservation extends ImprovementObservation<WebImprovementObservationPayload> {
  /** Content address of the actual screenshot bytes, not the filesystem path. */
  digest: string;
  /** Scalar summary that can be copied directly into a transaction receipt. */
  metadata: ImprovementMetadata;
  payload: WebImprovementObservationPayload;
}

type StableCapture = {
  buffer: Uint8Array;
  metadata: {
    stable: boolean | null;
    attempts: number;
    viewport: { width: number; height: number } | null;
    url: string | null;
    screenshot: {
      fullPage: boolean;
      animations: string;
      caret: string;
      maskCount: number;
      hasStyle: boolean;
    };
    settle: {
      networkIdle: string;
      fonts: string;
      diagnostics: string[];
    };
  };
};

const captureStable = captureStableScreenshot as unknown as (
  page: ScreenshotPage,
  options: {
    path: string;
    fullPage?: boolean;
    screenshot?: Record<string, unknown>;
    stability?: WebImprovementObservationOptions['stability'];
  },
) => Promise<StableCapture>;

function sanitizedUrl(value: string | null): string | null {
  if (value === null) return null;
  try {
    const url = new URL(value);
    return url.origin;
  } catch {
    return null;
  }
}

function snapshotMetadata(metadata: StableCapture['metadata']): WebObservationCaptureMetadata {
  return {
    stable: metadata.stable,
    attempts: metadata.attempts,
    viewport: metadata.viewport === null ? null : { ...metadata.viewport },
    url: sanitizedUrl(metadata.url),
    screenshot: { ...metadata.screenshot },
    settle: {
      networkIdle: metadata.settle.networkIdle,
      fonts: metadata.settle.fonts,
    },
  };
}

function receiptMetadata(
  capture: WebObservationCaptureMetadata,
  screenshotSha256: string,
  renderedCodeSha256: string | null,
): ImprovementMetadata {
  return {
    screenshotSha256,
    renderedCodeSha256,
    captureStable: capture.stable,
    captureAttempts: capture.attempts,
    captureViewportWidth: capture.viewport?.width ?? null,
    captureViewportHeight: capture.viewport?.height ?? null,
    captureUrl: capture.url,
    captureFullPage: capture.screenshot.fullPage,
    captureAnimations: capture.screenshot.animations,
    captureCaret: capture.screenshot.caret,
    captureMaskCount: capture.screenshot.maskCount,
    captureHasStyle: capture.screenshot.hasStyle,
    captureNetworkIdle: capture.settle.networkIdle,
    captureFonts: capture.settle.fonts,
  };
}

function normalizeRenderedCode(renderedCode: RenderedCode): NormalizedRenderedCode {
  const snapshot = structuredClone(renderedCode);
  const { timestamp: _timestamp, url: _url, ...normalized } = snapshot;
  return freezeNested(normalized);
}

/** Freeze a detached rendered-code snapshot without retaining page-owned data. */
function freezeNested<T>(value: T): T {
  const seen = new WeakSet<object>();
  const visit = (node: unknown): void => {
    if (node === null || typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    for (const child of Object.values(node)) visit(child);
    Object.freeze(node);
  };
  visit(value);
  return value;
}

function screenshotMediaType(options: WebImprovementObservationOptions): string {
  const requestedType = options.screenshot?.type;
  if (requestedType === undefined) {
    const extension = options.screenshotPath.match(/\.([A-Za-z0-9]+)$/)?.[1]?.toLowerCase();
    return extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' : 'image/png';
  }
  if (requestedType === 'png') return 'image/png';
  if (requestedType === 'jpeg') return 'image/jpeg';
  throw new ValidationError('captureWebImprovementObservation only supports png or jpeg screenshot artifacts', {
    screenshotType: typeof requestedType === 'string' ? requestedType : typeof requestedType,
  });
}

function assertPageCapabilities(page: unknown, captureCode: boolean): asserts page is RenderedCodePage {
  const candidate = page as Partial<RenderedCodePage> | null;
  if (!candidate || typeof candidate.screenshot !== 'function') {
    throw new ValidationError('captureWebImprovementObservation: page must provide screenshot()', {
      received: typeof page,
    });
  }

  if (!captureCode) return;

  const missing = ['content', 'evaluate', 'url', 'viewportSize'].filter(
    capability => typeof candidate[capability as keyof RenderedCodePage] !== 'function',
  );
  if (missing.length > 0) {
    throw new ValidationError(
      `captureWebImprovementObservation: captureCode requires page capabilities: ${missing.join(', ')}`,
      { missing, captureCode: true },
    );
  }
}

/**
 * Capture an immutable observation for a downstream visual-improvement review.
 * The caller retains ownership of the screenshot path and any later cleanup.
 */
export async function captureWebImprovementObservation(
  page: ScreenshotPage,
  options: WebImprovementObservationOptions,
): Promise<WebImprovementObservation> {
  if (typeof options?.screenshotPath !== 'string' || options.screenshotPath.length === 0) {
    throw new ValidationError('captureWebImprovementObservation requires a non-empty screenshotPath');
  }

  const captureCode = options.captureCode !== false;
  assertPageCapabilities(page, captureCode);

  const captureOptions: Parameters<typeof captureStable>[1] = {
    path: options.screenshotPath,
    ...(options.fullPage === undefined ? {} : { fullPage: options.fullPage }),
    ...(options.screenshot === undefined ? {} : { screenshot: { ...options.screenshot } }),
    ...(options.stability === undefined ? {} : { stability: { ...options.stability } }),
  };
  const capture = await captureStable(page, captureOptions);
  const renderedCode = captureCode
    ? normalizeRenderedCode(await extractRenderedCode(page))
    : null;
  const captureMetadata = snapshotMetadata(capture.metadata);
  const screenshotSha256 = createHash('sha256').update(capture.buffer).digest('hex');
  const screenshot = Object.freeze({
    kind: 'sha256-artifact' as const,
    sha256: screenshotSha256,
    byteLength: capture.buffer.byteLength,
    mediaType: screenshotMediaType(options),
  }) satisfies ImprovementArtifactReference;
  const renderedCodeSha256 = renderedCode === null ? null : canonicalJsonSha256(renderedCode);
  const payload = Object.freeze({ screenshot, renderedCode });

  return {
    // Match the transaction's canonical frozen-payload identity. The separate
    // code hash remains receipt metadata for concise diagnostics.
    digest: canonicalJsonSha256(payload),
    metadata: receiptMetadata(captureMetadata, screenshotSha256, renderedCodeSha256),
    payload,
  };
}
