/**
 * Public declarations for the package root.
 *
 * Advanced APIs are declared at their matching subpath export, for example
 * `@arclabs561/ai-visual-test/temporal`. Keeping this file to the root
 * runtime surface prevents TypeScript from accepting imports Node rejects.
 */

export interface ValidationResult {
  enabled: boolean;
  kind?: 'scalar' | 'comparison';
  provider?: string | null;
  model?: string | null;
  judgment?: string | null;
  score: number | null;
  issues: string[];
  assessment?: string | null;
  reasoning?: string | null;
  recommendations: string[];
  strengths?: string[];
  /** Whether the provider response satisfied the structured contract or needed legacy parsing. */
  outputFormat?: 'structured' | 'legacy-text' | null;
  /** Structured-output capability negotiated for this request. */
  structuredOutput?: {
    mode: 'json-schema' | 'json-object' | 'prompt-only';
    diagnostic: string | null;
  } | null;
  /** Present for two-image comparison reviews. */
  winner?: 'A' | 'B' | 'tie' | 'indeterminate';
  differences?: string[];
  scores?: { A: number; B: number };
  comparisonConfidence?: number;
  [key: string]: unknown;
}

export interface ValidationContext {
  provider?: string;
  model?: string;
  modelTier?: 'fast' | 'balanced' | 'best';
  testType?: string;
  viewport?: unknown;
  [key: string]: unknown;
}

export interface ConfigOptions extends ValidationContext {
  apiKey?: string | null;
  enabled?: boolean;
}

export interface Config extends ConfigOptions {
  provider: string;
  enabled: boolean;
  providerConfig: Record<string, unknown>;
}

export interface SemanticInfo {
  score: number | null;
  issues: string[];
  assessment: string | null;
  reasoning: string | null;
  recommendations: string[];
  strengths?: string[];
  [key: string]: unknown;
}

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

export function validatePage(page: unknown, prompt: string, options?: ValidationContext & {
  fullPage?: boolean; captureCode?: boolean; tempDir?: string; keepScreenshot?: boolean;
}): Promise<ValidationResult>;
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

export class VideoJudge extends VLLMJudge {
  judgeVideo(input: string | string[] | Array<{ path: string; label?: string; mime?: string }>, prompt: string, context?: ValidationContext): Promise<ValidationResult>;
}
export function judgeVideo(input: string | string[] | Array<{ path: string; label?: string; mime?: string }>, prompt: string, context?: ValidationContext): Promise<ValidationResult>;

export interface ExtractedIssue { severity: string; timestamp: string; desc: string; }
export function timestampToSeconds(timestamp: string): number;
export function extractIssues(text: string, options?: { severities?: string[] }): ExtractedIssue[];
export function extractFixedTimestamps(text: string, options?: { severities?: string[] }): ExtractedIssue[];
export function findConsensus(byJudge: Record<string, ExtractedIssue[]>, options?: { windowSeconds?: number; minJudges?: number }): Array<{ cluster: ExtractedIssue[]; judges: string[] }>;
export function detectSpirals(currentByJudge: Record<string, ExtractedIssue[]>, previousFixedSeconds: Set<number>, options?: { windowSeconds?: number }): unknown[];

export function createMatchers(expect: unknown): void;
