export function createMatchers(expect: { extend(matchers: Record<string, unknown>): void }): void;
export function captureStableScreenshot(page: unknown, options: {
  path: string;
  fullPage?: boolean;
  screenshot?: Record<string, unknown>;
  stability?: Record<string, unknown>;
}): Promise<{ path: string; buffer: Uint8Array; metadata: Record<string, unknown> }>;
