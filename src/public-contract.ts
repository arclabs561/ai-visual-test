/** Public result and configuration contracts shared by runtime declarations. */

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
  richRecommendations?: Array<Record<string, unknown> & { suggestion: string }>;
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
  counterBalance?: {
    enabled: true;
    status: 'agree' | 'conflict' | 'incomplete';
    canonicalWinners: Array<'A' | 'B' | 'tie' | 'indeterminate' | null>;
    [key: string]: unknown;
  };
  captureMetadata?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface ValidationContext {
  provider?: string;
  model?: string;
  modelTier?: 'fast' | 'balanced' | 'best';
  testType?: string;
  viewport?: unknown;
  counterBalance?: boolean;
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
  richRecommendations?: Array<Record<string, unknown> & { suggestion: string }>;
  strengths?: string[];
  [key: string]: unknown;
}
