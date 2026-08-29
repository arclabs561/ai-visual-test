/**
 * Public declarations for the package root.
 *
 * Advanced APIs are declared at their matching subpath export, for example
 * `@arclabs561/ai-visual-test/temporal`. Keeping this file to the root
 * runtime surface prevents TypeScript from accepting imports Node rejects.
 */
import type {
  Config,
  ConfigOptions,
  SemanticInfo,
  ValidationContext,
  ValidationResult,
} from '#public-contract';

export type {
  Config,
  ConfigOptions,
  SemanticInfo,
  ValidationContext,
  ValidationResult,
} from '#public-contract';

export class ValidationError extends Error { constructor(message: string, details?: Record<string, unknown>); }
export class ConfigError extends Error { constructor(message: string, details?: Record<string, unknown>); }
export class ProviderError extends Error { provider: string; constructor(message: string, provider: string, details?: Record<string, unknown>); }
export class FileError extends Error { filePath: string; constructor(message: string, filePath: string, details?: Record<string, unknown>); }

export class VLLMJudge {
  constructor(options?: ConfigOptions);
  judgeScreenshot(
    imagePath: string | string[],
    prompt: string,
    context?: ValidationContext,
  ): Promise<ValidationResult>;
  buildPrompt(prompt: string, context?: ValidationContext, isMultiImage?: boolean): Promise<string>;
  extractSemanticInfo(judgment: string | object | null | undefined): SemanticInfo;
}

export function validateScreenshot(
  imagePath: string | string[], prompt: string, context?: ValidationContext,
): Promise<ValidationResult>;
/** Backward-compatible alias for validateScreenshot. */
export { validateScreenshot as _validateScreenshot };

/** Framework-neutral page surface for screenshot-only reviews. */
export interface ScreenshotPage {
  screenshot(options: Record<string, unknown>): Promise<Uint8Array>;
}

/** Framework-neutral page surface required by the default code-capturing review. */
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
  fullPage?: boolean;
  captureCode?: boolean;
  tempDir?: string;
  keepScreenshot?: boolean;
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
export interface ScreenshotPageValidationOptions extends PageValidationOptions {
  captureCode: false;
}
export function validatePage(
  page: PageLike, prompt: string, options?: PageValidationOptions,
): Promise<ValidationResult>;
export function validatePage(
  page: ScreenshotPage, prompt: string, options: ScreenshotPageValidationOptions,
): Promise<ValidationResult>;
export function validateComparison(
  beforePath: string, afterPath: string, prompt: string, context?: ValidationContext,
): Promise<ValidationResult>;
export function validateWithRubric(
  screenshotPath: string, prompt: string, rubric: unknown, context?: ValidationContext, options?: Record<string, unknown>,
): Promise<ValidationResult>;
export function extractSemanticInfo(judgment: string | object | null | undefined): SemanticInfo;

export function createConfig(options?: ConfigOptions): Config;
export function getConfig(): Config;
export function validateStartup(options?: { strict?: boolean }): { valid: boolean; warnings: string[]; [key: string]: unknown };

export function getCached(imagePath: string, prompt: string, context?: ValidationContext): ValidationResult | null;
export function setCached(imagePath: string, prompt: string, context: ValidationContext, result: ValidationResult): void;
export function clearCache(): void;
export function getCacheStats(): Record<string, unknown>;

export interface CostEstimate {
  provider: string;
  model: string;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCost: string;
  currency: string;
}
export function estimateCost(provider: string, options?: {
  imageCount?: number; promptLength?: number; model?: string | null;
}): CostEstimate;

export const VideoJudge: typeof import('#video').VideoJudge;
export type VideoJudge = InstanceType<typeof VideoJudge>;
export const judgeVideo: typeof import('#video').judgeVideo;
export type { VideoContext, VideoInput, VideoInputEntry, VideoJudgeOptions, VideoTranscodeOptions } from '#video';

export interface ExtractedIssue { severity: string; timestamp: string; desc: string; }
export function timestampToSeconds(timestamp: string): number;
export function extractIssues(text: string, options?: { severities?: string[] }): ExtractedIssue[];
export function extractFixedTimestamps(text: string, options?: { severities?: string[] }): ExtractedIssue[];
export function findConsensus(byJudge: Record<string, ExtractedIssue[]>, options?: { windowSeconds?: number; minJudges?: number }): Array<{ cluster: ExtractedIssue[]; judges: string[] }>;
export function detectSpirals(currentByJudge: Record<string, ExtractedIssue[]>, previousFixedSeconds: Set<number>, options?: { windowSeconds?: number }): unknown[];

export function createMatchers(expect: unknown): void;
