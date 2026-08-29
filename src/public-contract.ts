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

/** Cost accounting captured for a completed batch validation. */
export interface BatchCostStats {
  total: number;
  count: number;
  average: number;
  byProvider: Record<string, { total: number; count: number; average: number }>;
  byDate: Record<string, { total: number; count: number }>;
  recent: Array<{ provider: string; cost: number; timestamp: number }>;
}

/** Process-lifetime performance accounting captured for a completed batch. */
export interface BatchPerformanceStats {
  totalRequests: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  successRate: number;
}

/** Optional accounting accompanying a `BatchValidator` result. */
export interface BatchValidationStats {
  total: number;
  passed: number;
  failed: number;
  duration: number;
  costStats: BatchCostStats | null;
  performance: BatchPerformanceStats | null;
}

/** The enriched response returned by `BatchValidator.batchValidate`. */
export interface BatchValidationResult {
  results: ValidationResult[];
  stats: BatchValidationStats | null;
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
  issues: unknown[];
  assessment: string | null;
  reasoning: string | null;
  recommendations: string[];
  richRecommendations?: Array<Record<string, unknown> & { suggestion: string }>;
  strengths?: unknown[];
  [key: string]: unknown;
}

/** Legacy root contracts still shared by unconverted JavaScript modules. */
export interface Rubric {
  score: { description?: string; criteria: Record<number, string> };
  dimensions?: Record<string, { description?: string; criteria: string[] }>;
}

export interface RenderedCode {
  html?: string;
  stylesheets?: unknown[];
  criticalCSS?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface Persona {
  name: string;
  perspective: string;
  focus: string[];
  device?: string;
  [key: string]: unknown;
}

export interface PerspectiveEvaluation {
  persona: string;
  perspective: string;
  focus: string[];
  evaluation: ValidationResult;
  [key: string]: unknown;
}

export type HybridValidationResult = Omit<ValidationResult, 'issues'> & {
  passed: boolean;
  issues: unknown[];
  uniqueIssues?: string[];
  programmaticData: Record<string, unknown>;
  programmatic: Record<string, unknown>;
  semantic: ValidationResult;
  method: 'hybrid';
};

export interface VisualAnchorEntry {
  text?: string;
  image?: string;
  [key: string]: unknown;
}

export interface VisualAnchors {
  positive?: Array<string | VisualAnchorEntry>;
  negative?: Array<string | VisualAnchorEntry>;
  [key: string]: unknown;
}

export interface CacheStats {
  size: number;
  maxAge: number;
  cacheFile: string;
  atomicWrites: number;
  atomicWriteFailures: number;
  tempFileCleanups: number;
  atomicWriteSuccessRate: number;
  [key: string]: unknown;
}

export interface ScoreTrackerStats {
  totalTests: number;
  averageScore: number | null;
  [key: string]: unknown;
}

export interface AggregatedFeedbackAccumulator {
  scores: number[];
  issues: Record<string, number>;
  recommendations: Record<string, number>;
  strengths: Record<string, number>;
  weaknesses: Record<string, number>;
  actionableItems: Record<string, number>;
  categories: Record<string, string[]>;
  priority: Record<string, string[]>;
  trends: Record<string, unknown[]>;
}

export interface AggregatedFeedbackStats {
  totalJudgments: number;
  averageScore: number | null;
  minScore: number | null;
  maxScore: number | null;
  mostCommonIssues: Array<{ issue: string; count: number }>;
  mostCommonRecommendations: Array<{ rec: string; count: number }>;
  mostCommonStrengths: Array<{ strength: string; count: number }>;
  mostCommonWeaknesses: Array<{ weakness: string; count: number }>;
  mostCommonActionableItems: Array<{ item: string; count: number }>;
  categoryCounts: Array<{ category: string; count: number }>;
  priorityCounts: Array<{ level: string; count: number }>;
}

export interface AggregatedFeedback {
  aggregated: AggregatedFeedbackAccumulator;
  stats: AggregatedFeedbackStats;
  summary: string;
}

export interface PersonaExperienceOptions {
  viewport?: { width: number; height: number };
  device?: string;
  darkMode?: boolean;
  timeScale?: 'human' | 'mechanical';
  captureScreenshots?: boolean;
  captureState?: boolean;
  captureCode?: boolean;
  notes?: unknown[];
  trace?: unknown;
  [key: string]: unknown;
}

export interface PersonaExperienceResult {
  persona: string;
  screenshots: Array<{ path: string; [key: string]: unknown }>;
  notes: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface HallucinationDetectionResult {
  hasHallucination: boolean;
  issues: string[];
  confidence: number;
  severity: 'low' | 'medium' | 'high';
}
