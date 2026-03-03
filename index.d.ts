/**
 * TypeScript definitions for ai-visual-test
 * 
 * Provides type safety and IntelliSense support for the package.
 */

// Utility Types
/**
 * Make specific properties optional
 * @template T
 * @template K
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Make specific properties required
 * @template T
 * @template K
 */
export type RequiredBy<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Extract return type from a function
 * @template T
 */
export type ReturnType<T extends (...args: any[]) => any> = T extends (...args: any[]) => infer R ? R : never;

/**
 * Extract parameter types from a function
 * @template T
 */
export type Parameters<T extends (...args: any[]) => any> = T extends (...args: infer P) => any ? P : never;

/**
 * Deep partial - makes all nested properties optional
 * @template T
 */
export type DeepPartial<T> = T extends object ? { [P in keyof T]?: DeepPartial<T[P]> } : T;

/**
 * Deep required - makes all nested properties required
 * @template T
 */
export type DeepRequired<T> = T extends object ? { [P in keyof T]-?: DeepRequired<T[P]> } : T;

/**
 * Non-nullable - removes null and undefined from type
 * @template T
 */
export type NonNullable<T> = T extends null | undefined ? never : T;

/**
 * Function type for validation functions
 * @template T
 */
export type ValidationFunction<T = ValidationResult> = (
  imagePath: string,
  prompt: string,
  context?: ValidationContext
) => Promise<T>;

// Error Types
export class AIBrowserTestError extends Error {
  code: string;
  details: Record<string, unknown>;
  constructor(message: string, code: string, details?: Record<string, unknown>);
  toJSON(): {
    name: string;
    code: string;
    message: string;
    details: Record<string, unknown>;
    stack?: string;
  };
}

export class ValidationError extends AIBrowserTestError {
  constructor(message: string, details?: Record<string, unknown>);
}

export class CacheError extends AIBrowserTestError {
  constructor(message: string, details?: Record<string, unknown>);
}

export class ConfigError extends AIBrowserTestError {
  constructor(message: string, details?: Record<string, unknown>);
}

export class ProviderError extends AIBrowserTestError {
  provider: string;
  constructor(message: string, provider: string, details?: Record<string, unknown>);
}

export class TimeoutError extends AIBrowserTestError {
  timeout: number;
  constructor(message: string, timeout: number, details?: Record<string, unknown>);
}

export class FileError extends AIBrowserTestError {
  filePath: string;
  constructor(message: string, filePath: string, details?: Record<string, unknown>);
}

export class StateMismatchError extends ValidationError {
  discrepancies: string[];
  extracted: unknown;
  expected: unknown;
  constructor(discrepancies: string[], extracted: unknown, expected: unknown, message?: string);
}

export function isAIBrowserTestError(error: unknown): error is AIBrowserTestError;
export function isErrorType<T extends AIBrowserTestError>(error: unknown, errorClass: new (...args: any[]) => T): error is T;

// Rubrics
export interface Rubric {
  score: {
    description: string;
    criteria: Record<string, string>;
  };
  dimensions?: Record<string, {
    description: string;
    criteria: string[];
  }>;
}

export const DEFAULT_RUBRIC: Rubric;
export function buildRubricPrompt(rubric?: Rubric | null, includeDimensions?: boolean): string;
export function getRubricForTestType(testType: string): Rubric;

// Bias Detection
export interface BiasDetectionResult {
  hasBias: boolean;
  biases: Array<{
    type: string;
    detected: boolean;
    score: number;
    evidence: Record<string, unknown>;
  }>;
  severity: 'none' | 'low' | 'medium' | 'high';
  recommendations: string[];
}

export function detectBias(judgment: string | object, options?: {
  checkVerbosity?: boolean;
  checkLength?: boolean;
  checkFormatting?: boolean;
  checkPosition?: boolean;
  checkAuthority?: boolean;
}): BiasDetectionResult;

export interface PositionBiasResult {
  detected: boolean;
  firstBias?: boolean;
  lastBias?: boolean;
  reason?: string;
  evidence?: {
    firstScore: number;
    lastScore: number;
    avgMiddle: number;
    allScores: number[];
  };
}

export function detectPositionBias(judgments: Array<{ score: number | null }>): PositionBiasResult;

// Ensemble Judging
export interface EnsembleJudgeOptions {
  judges?: Array<VLLMJudge>;
  votingMethod?: 'weighted_average' | 'majority' | 'consensus';
  weights?: number[];
  minAgreement?: number;
  enableBiasDetection?: boolean;
}

export interface EnsembleResult {
  score: number | null;
  assessment: string;
  issues: string[];
  reasoning: string;
  confidence: number;
  agreement: {
    score: number;
    scoreAgreement: number;
    assessmentAgreement: number;
    mean: number;
    stdDev: number;
    scores: number[];
  };
  disagreement: {
    hasDisagreement: boolean;
    scoreRange: number;
    assessmentDisagreement: boolean;
    uniqueAssessments: string[];
    maxScore: number;
    minScore: number;
  };
  biasDetection?: {
    individual: BiasDetectionResult[];
    position: PositionBiasResult;
  };
  individualJudgments: Array<{
    judgeIndex: number;
    score: number | null;
    assessment: string | null;
    issues: string[];
    reasoning: string | null;
    provider: string;
    error?: string;
  }>;
  judgeCount: number;
  votingMethod: string;
}

/**
 * Ensemble Judge
 * 
 * Uses multiple LLM providers to evaluate screenshots and aggregates results
 * for improved accuracy (10-20% improvement with 3+ models).
 * 
 * **Research:** Based on arXiv:2510.01499 - "Optimal LLM Aggregation"
 * 
 * **Use when:** You need maximum reliability for critical evaluations
 * (accessibility, quality checks, design validation).
 * 
 * @example
 * ```typescript
 * const judge = new EnsembleJudge({
 *   judges: [
 *     new VLLMJudge({ provider: 'gemini' }),
 *     new VLLMJudge({ provider: 'openai' }),
 *     new VLLMJudge({ provider: 'claude' })
 *   ],
 *   votingMethod: 'weighted_average'
 * });
 * 
 * const result = await judge.evaluate(
 *   'screenshot.png',
 *   'Evaluate accessibility'
 * );
 * 
 * console.log(result.score); // Aggregated score
 * console.log(result.agreement.score); // How much models agree
 * ```
 */
export class EnsembleJudge {
  /**
   * Create a new Ensemble Judge instance.
   * 
   * @param options - Ensemble options (judges, voting method, weights, etc.)
   */
  constructor(options?: EnsembleJudgeOptions);
  
  /**
   * Evaluate screenshot using multiple judges and aggregate results.
   * 
   * @param imagePath - Path to screenshot
   * @param prompt - Evaluation prompt
   * @param context - Optional validation context
   * @returns Promise resolving to EnsembleResult with aggregated score and agreement metrics
   */
  evaluate(imagePath: string, prompt: string, context?: Record<string, unknown>): Promise<EnsembleResult>;
}

export function createEnsembleJudge(providers?: string[], options?: EnsembleJudgeOptions): EnsembleJudge;

// Core Types
/**
 * Validation context for screenshot validation.
 * 
 * Provides additional context to guide the AI evaluation, including test type,
 * viewport information, game state, and optimization options.
 * 
 * @example
 * ```typescript
 * const context: ValidationContext = {
 *   testType: 'accessibility',
 *   viewport: { width: 1920, height: 1080 },
 *   autoSelectTier: true,
 *   autoSelectProvider: true
 * };
 * ```
 */
export interface ValidationContext {
  /** Test type identifier (e.g., 'accessibility', 'payment-screen', 'gameplay') */
  testType?: string;
  /** Viewport dimensions for context-aware evaluation */
  viewport?: { width: number; height: number };
  /** Game state or application state for context */
  gameState?: Record<string, unknown>;
  /** Enable caching (default: true) */
  useCache?: boolean;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Use explicit rubric for consistent scoring */
  useRubric?: boolean;
  /** Include dimension scores in evaluation */
  includeDimensions?: boolean;
  /** URL of the page being tested */
  url?: string;
  /** Description of the test scenario */
  description?: string;
  /** Current step in multi-step test */
  step?: string;
  /** Custom prompt builder function */
  promptBuilder?: (prompt: string, context: ValidationContext) => string;
  /** Auto-select model tier (fast/balanced/best) based on context */
  autoSelectTier?: boolean;
  /** Auto-select provider (cheapest available) */
  autoSelectProvider?: boolean;
  /** Include cost comparison in results */
  includeCostComparison?: boolean;
  /** Frequency for high-frequency validation (Hz) */
  frequency?: number;
  /** Cost sensitivity flag for optimization */
  costSensitive?: boolean;
  /** Criticality level (low/medium/high/critical) */
  criticality?: 'low' | 'medium' | 'high' | 'critical';
  /** Model tier to use (fast/balanced/best) */
  modelTier?: 'fast' | 'balanced' | 'best';
  /** Temporal decision options (for high-frequency validation) */
  useTemporalDecision?: boolean;
  /** Temporal notes for decision context */
  temporalNotes?: TemporalNote[];
  /** Current state for temporal decision */
  currentState?: Record<string, unknown>;
  /** Previous state for temporal decision */
  previousState?: Record<string, unknown>;
  /** Previous result for temporal decision */
  previousResult?: ValidationResult;
  /** Temporal decision manager options */
  temporalDecisionOptions?: Record<string, unknown>;
  /** Per-call visual anchors (appended to config-level anchors) */
  anchors?: VisualAnchors | null;
}

export interface EstimatedCost {
  inputTokens: number;
  outputTokens: number;
  inputCost: string;
  outputCost: string;
  totalCost: string;
  currency: string;
}

/** A structured issue with metadata (importance, evidence, suggestion). */
export interface RichIssue {
  /** Human-readable issue description */
  description: string;
  /** Importance level */
  importance?: 'low' | 'medium' | 'high' | 'critical';
  /** Annoyance level */
  annoyance?: 'low' | 'medium' | 'high';
  /** Impact category */
  impact?: string;
  /** Evidence observed in the screenshot */
  evidence?: string;
  /** Suggested fix */
  suggestion?: string;
}

/** A structured recommendation with priority and expected impact. */
export interface Recommendation {
  /** Priority level */
  priority?: 'low' | 'medium' | 'high';
  /** What to change */
  suggestion: string;
  /** Expected improvement from the change */
  expectedImpact?: string;
}

export interface SemanticInfo {
  score: number | null;
  issues: RichIssue[];
  assessment: string | null;
  reasoning: string | null;
  strengths?: string[];
  recommendations?: Recommendation[];
  evidence?: string | Record<string, unknown> | null;
  dimensionScores?: Record<string, number> | null;
  brutalistViolations?: string[];
  zeroToleranceViolations?: string[];
}

/**
 * Result of screenshot validation.
 * 
 * Contains the AI's evaluation of the screenshot, including score, issues,
 * reasoning, and metadata about the validation process.
 * 
 * @example
 * ```typescript
 * const result: ValidationResult = {
 *   enabled: true,
 *   provider: 'gemini',
 *   score: 8.5,
 *   issues: ['Low contrast on submit button'],
 *   assessment: 'Good',
 *   reasoning: 'The form is mostly accessible...',
 *   estimatedCost: { totalCost: '0.000123', currency: 'USD' },
 *   responseTime: 1234,
 *   cached: false
 * };
 * ```
 */
export interface ValidationResult {
  /** Whether validation was enabled (false if API key missing) */
  enabled: boolean;
  /** LLM provider used (gemini, openai, claude, groq) */
  provider: string;
  /** Quality score (0-10, null if validation failed) */
  score: number | null;
  /** List of issues found (flat strings for backward compat) */
  issues: string[];
  /** Structured issues with importance, evidence, and suggestions */
  richIssues?: RichIssue[];
  /** Overall assessment (e.g., 'Good', 'Needs Improvement') */
  assessment: string | null;
  /** Detailed reasoning for the score */
  reasoning: string;
  /** Actionable recommendations with priority and expected impact */
  recommendations?: Recommendation[];
  /** What the UI does well */
  strengths?: string[];
  /** Per-dimension scores (e.g., game_authenticity: 9, typography: 7) */
  dimensionScores?: Record<string, number> | null;
  /** Estimated API cost breakdown */
  estimatedCost?: EstimatedCost | null;
  /** Response time in milliseconds */
  responseTime: number;
  /** Whether result was served from cache */
  cached?: boolean;
  /** Raw judgment text from LLM */
  judgment?: string;
  /** Raw API response */
  raw?: unknown;
  /** Extracted semantic information */
  semantic?: SemanticInfo;
  /** Error message if validation failed */
  error?: string;
  /** Status message */
  message?: string;
  /** Provider pricing information */
  pricing?: { input: number; output: number };
  /** Timestamp of validation */
  timestamp?: string;
  /** Test name if provided */
  testName?: string;
  /** Viewport dimensions if provided */
  viewport?: { width: number; height: number } | null;
  /** Cost comparison information (if includeCostComparison enabled) */
  costComparison?: {
    current: { tier: string; provider: string; cost: number };
    tiers: Record<string, number>;
    savings: Record<string, { absolute: number; percent: number; cost: number }>;
    recommendation: { tier: string; cost: number; savings: number; savingsPercent: number; reason: string };
  };
  /** Whether temporal decision skipped this call */
  skipped?: boolean;
  /** Reason for skipping (if skipped) */
  skipReason?: string;
  /** Urgency level (if temporal decision used) */
  urgency?: 'low' | 'medium' | 'high';
}

/**
 * A single visual anchor: either a plain text string or an object
 * with optional dimension scoping and/or an image reference.
 *
 * Plain string: `"Card images large enough to see art"`
 * With dimension: `{ text: "Card images large", dimension: "card_presentation" }`
 * Image ref: `{ image: "/path/to/good.png", label: "Well-themed Magic layout" }`
 * Image + dimension: `{ image: "/path/to/good.png", label: "...", dimension: "game_authenticity" }`
 *
 * Images accept a file path or a data URI (`data:image/png;base64,...`).
 */
export type AnchorEntry = string | {
  /** Text description of the anchor signal */
  text?: string;
  /** File path or data URI of a reference screenshot */
  image?: string;
  /** Short label for the image (shown in prompt) */
  label?: string;
  /** Rubric dimension this anchor relates to (e.g., "game_authenticity") */
  dimension?: string;
};

/**
 * Domain-level visual anchors for VLM evaluation grounding.
 *
 * Text anchors describe what to look for / flag in words.
 * Image anchors provide reference screenshots as few-shot visual examples
 * so the VLM can calibrate against concrete good/bad instances.
 *
 * Anchors can optionally be scoped to rubric dimensions via the
 * `dimension` field on AnchorEntry objects.
 *
 * Set once in config for the project; per-call anchors in
 * ValidationContext append to (not replace) config-level anchors.
 */
export interface VisualAnchors {
  /** Brief domain description injected as context (e.g., "Card game search UI for TCG players") */
  domain?: string;
  /** Positive signals the VLM should look for (text and/or image entries) */
  positive?: AnchorEntry[];
  /** Negative signals the VLM should flag (text and/or image entries) */
  negative?: AnchorEntry[];
}

export interface ConfigOptions {
  provider?: 'gemini' | 'openai' | 'claude' | null;
  apiKey?: string | null;
  env?: NodeJS.ProcessEnv;
  cacheDir?: string | null;
  cacheEnabled?: boolean;
  maxConcurrency?: number;
  timeout?: number;
  verbose?: boolean;
  /** Domain-level visual anchors included in every evaluation prompt */
  anchors?: VisualAnchors | null;
}

export interface Config {
  provider: string;
  apiKey: string | null;
  providerConfig: {
    name: string;
    apiUrl: string;
    model: string;
    freeTier: boolean;
    pricing: { input: number; output: number };
    priority: number;
  };
  enabled: boolean;
  /** Normalized visual anchors (null when none configured) */
  anchors: VisualAnchors | null;
  cache: {
    enabled: boolean;
    dir: string | null;
  };
  performance: {
    maxConcurrency: number;
    timeout: number;
  };
  debug: {
    verbose: boolean;
  };
}

/**
 * VLLM Judge Class
 * 
 * Core screenshot validation engine using Vision Language Models.
 * Supports multiple providers (Gemini, OpenAI, Claude, Groq) with automatic
 * selection, caching, and cost optimization.
 * 
 * **Use when:** You need fine-grained control over validation or custom judge implementations.
 * **Otherwise:** Use `validateScreenshot()` function for simpler API.
 * 
 * @example
 * ```typescript
 * // Create custom judge instance
 * const judge = new VLLMJudge({
 *   provider: 'gemini',
 *   apiKey: process.env.GEMINI_API_KEY,
 *   cacheEnabled: true
 * });
 * 
 * const result = await judge.judgeScreenshot(
 *   'screenshot.png',
 *   'Evaluate this page'
 * );
 * ```
 */
export class VLLMJudge {
  /**
   * Create a new VLLM Judge instance.
   * 
   * @param options - Configuration options (provider, API key, cache, etc.)
   */
  constructor(options?: ConfigOptions);
  
  /** Current provider name (gemini, openai, claude, groq) */
  provider: string;
  /** API key for current provider */
  apiKey: string | null;
  /** Provider configuration (model, pricing, etc.) */
  providerConfig: Config['providerConfig'];
  /** Whether validation is enabled (false if API key missing) */
  enabled: boolean;
  
  /**
   * Convert image file to base64 string for API.
   * 
   * @param imagePath - Path to image file
   * @returns Base64-encoded image string
   * @throws {FileError} If file not found or invalid format
   */
  imageToBase64(imagePath: string): string;
  
  /**
   * Build evaluation prompt with context.
   * 
   * @param prompt - Base evaluation prompt
   * @param context - Validation context
   * @returns Enhanced prompt with context
   */
  buildPrompt(prompt: string, context: ValidationContext): string;
  
  /**
   * Extract semantic information from judgment text.
   * 
   * @param judgment - Judgment text or object
   * @returns Structured semantic information
   */
  extractSemanticInfo(judgment: string | object): SemanticInfo;
  
  /**
   * Estimate API cost for validation.
   * 
   * @param data - API request/response data
   * @param provider - Provider name
   * @returns Estimated cost breakdown or null
   */
  estimateCost(data: unknown, provider: string): EstimatedCost | null;
  
  /**
   * Judge a screenshot using VLLM.
   * 
   * @param imagePath - Path to screenshot or array for comparison
   * @param prompt - Evaluation prompt
   * @param context - Optional validation context
   * @returns Promise resolving to ValidationResult
   */
  judgeScreenshot(imagePath: string | string[], prompt: string, context?: ValidationContext): Promise<ValidationResult>;
}

// Core Functions
/**
 * Validate a screenshot using Vision Language Models (VLLM).
 * 
 * This is the primary API function. It takes a screenshot and evaluation prompt,
 * sends it to an AI model (Gemini, OpenAI, Claude, or Groq), and returns structured
 * validation results with score, issues, and reasoning.
 * 
 * **Key Features:**
 * - Automatic provider selection (cheapest available)
 * - Automatic tier selection (fast/balanced/best)
 * - Built-in caching (7-day TTL)
 * - Cost optimization
 * - Temporal decision making (for high-frequency validation)
 * 
 * @param imagePath - Path to screenshot file (PNG, JPEG, GIF, WebP) or array of paths for comparison
 * @param prompt - Evaluation prompt (e.g., "Is this accessible?", "Check if payment form works")
 * @param context - Optional validation context (testType, viewport, optimization options)
 * @returns Promise resolving to ValidationResult with score, issues, reasoning, and metadata
 * 
 * @example
 * ```typescript
 * // Basic usage
 * const result = await validateScreenshot(
 *   'screenshot.png',
 *   'Check if this payment form is accessible'
 * );
 * console.log(result.score);      // 8.5 (0-10 scale)
 * console.log(result.issues);     // ['Low contrast on button', 'Missing label']
 * console.log(result.reasoning);  // "The form is mostly accessible..."
 * ```
 * 
 * @example
 * ```typescript
 * // With cost optimization
 * const result = await validateScreenshot(
 *   'screenshot.png',
 *   'Evaluate accessibility',
 *   {
 *     autoSelectTier: true,
 *     autoSelectProvider: true,
 *     includeCostComparison: true
 *   }
 * );
 * console.log(result.costComparison?.savings.fast?.percent); // 45% savings
 * ```
 * 
 * @example
 * ```typescript
 * // High-frequency validation (60Hz)
 * const result = await validateScreenshot(
 *   'frame.png',
 *   'Is the game playable?',
 *   {
 *     frequency: 60,
 *     autoSelectTier: true,
 *     useTemporalDecision: true
 *   }
 * );
 * ```
 * 
 * @throws {FileError} If screenshot file not found or invalid format
 * @throws {ValidationError} If validation fails
 * @throws {ProviderError} If API provider error occurs
 * @throws {TimeoutError} If request times out
 */
export function validateScreenshot(
  imagePath: string | string[],
  prompt: string,
  context?: ValidationContext
): Promise<ValidationResult>;

/**
 * Extract semantic information from VLLM judgment text.
 * 
 * Parses AI judgment responses into structured data (score, issues, reasoning).
 * Useful for custom implementations that need to parse judgment text.
 * 
 * @param judgment - Judgment text or object from VLLM
 * @returns Structured semantic information with score, issues, assessment, reasoning
 * 
 * @example
 * ```typescript
 * const judgment = "Score: 8.5. Issues: Low contrast. Reasoning: The form is mostly accessible...";
 * const info = extractSemanticInfo(judgment);
 * console.log(info.score);    // 8.5
 * console.log(info.issues);   // ['Low contrast']
 * ```
 */
export function extractSemanticInfo(judgment: string | object): SemanticInfo;

// Multi-Modal Types
export interface RenderedCode {
  html: string;
  criticalCSS: Record<string, Record<string, string>>;
  domStructure: {
    prideParade?: {
      computedTop: string;
      flagRowCount: number;
    };
    footer?: {
      computedBottom: string;
      hasStripe: boolean;
    };
    paymentCode?: {
      visible: boolean;
    };
  };
}

export interface TemporalScreenshot {
  path: string;
  timestamp: number;
  elapsed: number;
}

export interface Persona {
  name: string;
  perspective: string;
  focus: string[];
}

export interface PerspectiveEvaluation {
  persona: Persona;
  evaluation: ValidationResult;
}

// Multi-Modal Functions
export function extractRenderedCode(page: any): Promise<RenderedCode>;
export function captureTemporalScreenshots(
  page: any,
  fps?: number,
  duration?: number
): Promise<TemporalScreenshot[]>;
export function multiPerspectiveEvaluation(
  validateFn: ValidationFunction,
  screenshotPath: string,
  renderedCode: RenderedCode,
  gameState?: Record<string, unknown>,
  personas?: Persona[] | null
): Promise<PerspectiveEvaluation[]>;
export function multiModalValidation(
  validateFn: ValidationFunction,
  page: any,
  testName: string,
  options?: {
    fps?: number;
    duration?: number;
    captureCode?: boolean;
    captureState?: boolean;
    multiPerspective?: boolean;
  }
): Promise<{
  screenshotPath: string;
  renderedCode: RenderedCode | null;
  gameState: Record<string, unknown>;
  temporalScreenshots: TemporalScreenshot[];
  perspectives: PerspectiveEvaluation[];
  codeValidation: Record<string, boolean>;
  aggregatedScore: number | null;
  aggregatedIssues: string[];
  timestamp: number;
}>;

// Temporal Types
/**
 * Temporal note for tracking state over time.
 * 
 * Used in high-frequency validation (10-60Hz) to track observations
 * and enable temporal decision making (reduces LLM calls by 98.5%).
 * 
 * @example
 * ```typescript
 * const note: TemporalNote = {
 *   timestamp: Date.now(),
 *   elapsed: 100,
 *   score: 8.5,
 *   observation: 'Button clicked',
 *   step: 'checkout'
 * };
 * ```
 */
export interface TemporalNote {
  /** Timestamp in milliseconds */
  timestamp?: number;
  /** Elapsed time since start in milliseconds */
  elapsed?: number;
  /** Quality score (0-10) */
  score?: number;
  /** Observation description */
  observation?: string;
  /** Step identifier */
  step?: string;
}

export interface TemporalWindow {
  index: number;
  startTime: number;
  endTime: number;
  notes: TemporalNote[];
  weightedScore: number;
  totalWeight: number;
  avgScore: number;
  observations: Set<string>;
}

export interface AggregatedTemporalNotes {
  windows: TemporalWindow[];
  summary: string;
  coherence: number;
  conflicts: Array<{
    window1: number;
    window2: number;
    type: string;
    description: string;
  }>;
}

// Temporal Functions
/**
 * Aggregate temporal notes into time windows with weighted scores.
 * 
 * Used for high-frequency validation to reduce LLM calls by aggregating
 * observations over time windows. Implements exponential decay weighting
 * (recent notes weighted more heavily).
 * 
 * **Research:** Inspired by arXiv:2505.17663 (DynToM) and arXiv:2507.15851
 * (Human Temporal Cognition), adapted with exponential decay for practical use.
 * 
 * @param notes - Array of temporal notes to aggregate
 * @param options - Aggregation options
 * @param options.windowSize - Time window size in milliseconds (default: 1000)
 * @param options.decayFactor - Exponential decay factor (default: 0.9)
 * @param options.coherenceThreshold - Coherence threshold for filtering (default: 0.5)
 * @returns Aggregated notes with windows, summary, and coherence score
 * 
 * @example
 * ```typescript
 * const notes: TemporalNote[] = [
 *   { timestamp: 0, score: 8, observation: 'Initial state' },
 *   { timestamp: 100, score: 8.5, observation: 'Button clicked' },
 *   { timestamp: 200, score: 9, observation: 'Form submitted' }
 * ];
 * 
 * const aggregated = aggregateTemporalNotes(notes);
 * console.log(aggregated.coherence); // 0.92 (high coherence)
 * console.log(aggregated.windows[0].avgScore); // 8.5
 * ```
 */
export function aggregateTemporalNotes(
  notes: TemporalNote[],
  options?: {
    windowSize?: number;
    decayFactor?: number;
    coherenceThreshold?: number;
  }
): AggregatedTemporalNotes;

export function formatNotesForPrompt(aggregated: AggregatedTemporalNotes): string;

export function calculateCoherence(windows: TemporalWindow[]): number;

/**
 * Temporal Decision Manager
 * 
 * Decides when to call LLM vs. reuse previous result for high-frequency validation.
 * Reduces LLM calls by 98.5% while maintaining accuracy through temporal coherence.
 * 
 * **Research:** Based on arXiv:2406.12125 - "Efficient Sequential Decision Making with Large Language Models"
 * 
 * **Core Insight:** Don't prompt on every state change, prompt when decision is needed.
 * 
 * **Note:** Implementation is obfuscated to protect proprietary algorithms, but API is fully documented.
 * 
 * @example
 * ```typescript
 * const manager = new TemporalDecisionManager({
 *   minNotesForPrompt: 3,
 *   coherenceThreshold: 0.5,
 *   urgencyThreshold: 0.3
 * });
 * 
 * const decision = await manager.shouldPrompt(
 *   currentState,
 *   previousState,
 *   temporalNotes,
 *   context
 * );
 * 
 * if (decision.shouldPrompt) {
 *   // Call LLM
 * } else {
 *   // Reuse previous result
 * }
 * ```
 */
export class TemporalDecisionManager {
  /**
   * Create a new Temporal Decision Manager.
   * 
   * @param options - Decision manager options
   * @param options.minNotesForPrompt - Minimum notes before prompting (default: 3)
   * @param options.coherenceThreshold - Coherence threshold for prompting (default: 0.5)
   * @param options.urgencyThreshold - Urgency threshold for prompting (default: 0.3)
   * @param options.maxWaitTime - Maximum wait time before forcing prompt (default: 10000ms)
   * @param options.stateChangeThreshold - State change threshold for prompting (default: 0.2)
   * @param options.warmStartSteps - Use LLM for first N steps (default: 10)
   * @param options.adaptiveSampling - Enable adaptive sampling (default: true)
   */
  constructor(options?: {
    minNotesForPrompt?: number;
    coherenceThreshold?: number;
    urgencyThreshold?: number;
    maxWaitTime?: number;
    stateChangeThreshold?: number;
    warmStartSteps?: number;
    adaptiveSampling?: boolean;
  });
  
  /**
   * Decide if we should prompt now or wait for more context.
   * 
   * @param currentState - Current state object
   * @param previousState - Previous state object (if any)
   * @param temporalNotes - Array of temporal notes
   * @param context - Additional context
   * @returns Decision object with shouldPrompt, reason, and urgency
   */
  shouldPrompt(
    currentState: Record<string, unknown>,
    previousState: Record<string, unknown> | null,
    temporalNotes: TemporalNote[],
    context?: Record<string, unknown>
  ): Promise<{
    shouldPrompt: boolean;
    reason: string;
    urgency: 'low' | 'medium' | 'high';
  }>;
  
  /**
   * Calculate state change magnitude.
   * 
   * @param currentState - Current state
   * @param previousState - Previous state
   * @returns State change score (0-1)
   */
  calculateStateChange(
    currentState: Record<string, unknown>,
    previousState: Record<string, unknown> | null
  ): number;
  
  /**
   * Check if current state is a decision point.
   * 
   * @param currentState - Current state
   * @param context - Additional context
   * @returns True if decision point
   */
  isDecisionPoint(
    currentState: Record<string, unknown>,
    context?: Record<string, unknown>
  ): boolean;
  
  /**
   * Check if there's a recent user action.
   * 
   * @param temporalNotes - Array of temporal notes
   * @param context - Additional context
   * @returns True if recent user action detected
   */
  hasRecentUserAction(
    temporalNotes: TemporalNote[],
    context?: Record<string, unknown>
  ): boolean;
}

/**
 * Create a temporal decision manager with default options.
 * 
 * @param options - Decision manager options
 * @returns New TemporalDecisionManager instance
 */
export function createTemporalDecisionManager(options?: {
  minNotesForPrompt?: number;
  coherenceThreshold?: number;
  urgencyThreshold?: number;
  maxWaitTime?: number;
  stateChangeThreshold?: number;
  warmStartSteps?: number;
  adaptiveSampling?: boolean;
}): TemporalDecisionManager;

/**
 * Temporal Preprocessing Manager
 * 
 * Optimizes temporal note processing for high-frequency validation (10-60Hz).
 * Implements activity-based preprocessing patterns to reduce computational overhead.
 * 
 * **Note:** Implementation is obfuscated to protect proprietary algorithms, but API is fully documented.
 * 
 * @example
 * ```typescript
 * const manager = new TemporalPreprocessingManager({
 *   activityThreshold: 0.5,
 *   highFrequencyMode: true
 * });
 * 
 * const processed = await manager.preprocess(temporalNotes, context);
 * ```
 */
export class TemporalPreprocessingManager {
  /**
   * Create a new Temporal Preprocessing Manager.
   * 
   * @param options - Preprocessing options
   */
  constructor(options?: Record<string, unknown>);
  
  /**
   * Preprocess temporal notes for efficient handling.
   * 
   * @param notes - Array of temporal notes
   * @param context - Additional context
   * @returns Processed notes
   */
  preprocess(
    notes: TemporalNote[],
    context?: Record<string, unknown>
  ): Promise<TemporalNote[]>;
}

/**
 * Adaptive Temporal Processor
 * 
 * Adaptively processes temporal notes based on activity patterns.
 * 
 * @example
 * ```typescript
 * const processor = new AdaptiveTemporalProcessor();
 * const processed = await processor.process(notes, context);
 * ```
 */
export class AdaptiveTemporalProcessor {
  /**
   * Create a new Adaptive Temporal Processor.
   * 
   * @param options - Processor options
   */
  constructor(options?: Record<string, unknown>);
  
  /**
   * Process temporal notes adaptively.
   * 
   * @param notes - Array of temporal notes
   * @param context - Additional context
   * @returns Processed notes
   */
  process(
    notes: TemporalNote[],
    context?: Record<string, unknown>
  ): Promise<TemporalNote[]>;
}

/**
 * Create a temporal preprocessing manager with default options.
 * 
 * @param options - Preprocessing options
 * @returns New TemporalPreprocessingManager instance
 */
export function createTemporalPreprocessingManager(options?: Record<string, unknown>): TemporalPreprocessingManager;

/**
 * Create an adaptive temporal processor with default options.
 * 
 * @param options - Processor options
 * @returns New AdaptiveTemporalProcessor instance
 */
export function createAdaptiveTemporalProcessor(options?: Record<string, unknown>): AdaptiveTemporalProcessor;

// Cache Types
export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

// Cache Functions
/**
 * Initialize cache system.
 * 
 * Sets up file-based caching with 7-day TTL. Cache persists across
 * process restarts and reduces API costs by serving cached results.
 * 
 * @param cacheDir - Cache directory path (default: `.cache/ai-visual-test`)
 * 
 * @example
 * ```typescript
 * initCache('/tmp/my-cache');
 * const result = await validateScreenshot('screenshot.png', 'Evaluate');
 * // Subsequent calls with same screenshot/prompt use cache
 * ```
 */
export function initCache(cacheDir?: string): void;

/**
 * Generate cache key for validation request.
 * 
 * Creates SHA-256 hash of image path, prompt, and context for cache lookup.
 * 
 * @param imagePath - Screenshot path
 * @param prompt - Evaluation prompt
 * @param context - Validation context
 * @returns Cache key string
 */
export function generateCacheKey(imagePath: string, prompt: string, context?: ValidationContext): string;

/**
 * Get cached validation result.
 * 
 * @param imagePath - Screenshot path
 * @param prompt - Evaluation prompt
 * @param context - Validation context
 * @returns Cached ValidationResult or null if not cached
 */
export function getCached(imagePath: string, prompt: string, context?: ValidationContext): ValidationResult | null;

/**
 * Cache validation result.
 * 
 * @param imagePath - Screenshot path
 * @param prompt - Evaluation prompt
 * @param context - Validation context
 * @param result - Validation result to cache
 */
export function setCached(
  imagePath: string,
  prompt: string,
  context: ValidationContext,
  result: ValidationResult
): void;

/**
 * Clear all cached results.
 */
export function clearCache(): void;

/**
 * Get cache statistics.
 * 
 * @returns Cache stats (hits, misses, size, hit rate)
 * 
 * @example
 * ```typescript
 * const stats = getCacheStats();
 * console.log(`Hit rate: ${stats.hitRate * 100}%`); // 85%
 * console.log(`Cache size: ${stats.size}`); // 123
 * ```
 */
export function getCacheStats(): CacheStats;

// Config Functions
export function createConfig(options?: ConfigOptions): Config;
export function getConfig(): Config;
export function setConfig(config: Config): void;
export function getProvider(providerName?: string | null): Config['providerConfig'];

// Utility Functions
export function loadEnv(basePath?: string | null): void;
export function initErrorHandlers(): void;

// ScoreTracker Class
export class ScoreTracker {
  constructor(options?: { baselineDir?: string; autoSave?: boolean });
  record(testName: string, score: number, metadata?: Record<string, unknown>): { score: number; timestamp: string; metadata: Record<string, unknown> };
  getBaseline(testName: string): number | null;
  getCurrent(testName: string): number | null;
  compare(testName: string, currentScore: number): { hasBaseline: boolean; baseline: number | null; current: number; improved: boolean; delta: number; percentage: number; regression?: boolean; trend?: string; history?: Array<{ score: number; timestamp: string; metadata?: Record<string, unknown> }> } | null;
  updateBaseline(testName: string, newBaseline?: number | null): boolean;
  getAll(): Record<string, { history: Array<{ score: number; timestamp: string; metadata?: Record<string, unknown> }>; current: number | null; baseline: number | null; firstRecorded: string; lastUpdated: string; baselineSetAt?: string }>;
  getStats(): {
    current: number | null;
    baseline: number | null;
    history: Array<{ score: number; timestamp: number; metadata?: Record<string, unknown> }>;
    average: number | null;
    min: number | null;
    max: number | null;
    totalTests?: number;
    testsWithBaselines?: number;
    testsWithRegressions?: number;
    testsWithImprovements?: number;
    averageScore?: number;
    averageBaseline?: number;
  };
}

// BatchOptimizer Class
/**
 * Batch Optimizer
 * 
 * Optimizes validation of multiple screenshots by batching requests,
 * managing concurrency, and caching results.
 * 
 * **Use when:** You need to validate multiple screenshots efficiently.
 * 
 * @example
 * ```typescript
 * const optimizer = new BatchOptimizer({
 *   maxConcurrency: 5,
 *   batchSize: 10,
 *   cacheEnabled: true
 * });
 * 
 * const results = await optimizer.batchValidate(
 *   ['screenshot1.png', 'screenshot2.png', 'screenshot3.png'],
 *   'Evaluate accessibility'
 * );
 * 
 * console.log(results.length); // 3
 * ```
 */
export class BatchOptimizer {
  /**
   * Create a new Batch Optimizer instance.
   * 
   * @param options - Optimizer options (maxConcurrency, batchSize, cacheEnabled)
   */
  constructor(options?: { maxConcurrency?: number; batchSize?: number; cacheEnabled?: boolean });
  
  /**
   * Validate multiple screenshots in batch.
   * 
   * @param imagePaths - Single path, array of paths, or array of arrays for comparison
   * @param prompt - Evaluation prompt
   * @param context - Optional validation context
   * @returns Promise resolving to array of ValidationResults
   */
  batchValidate(imagePaths: string | string[], prompt: string, context?: ValidationContext): Promise<ValidationResult[]>;
  
  /**
   * Clear batch optimizer cache.
   */
  clearCache(): void;
  
  /**
   * Get cache statistics.
   * 
   * @returns Cache stats (size, queue length, active requests)
   */
  getCacheStats(): { cacheSize: number; queueLength: number; activeRequests: number };
}

// Data Extractor
export function extractStructuredData(
  text: string,
  schema: object,
  options?: {
    method?: 'json' | 'llm' | 'regex';
    provider?: string;
    apiKey?: string;
  }
): Promise<unknown>;

// Feedback Aggregator
export interface AggregatedFeedback {
  averageScore: number;
  totalIssues: number;
  commonIssues: Array<{ issue: string; count: number }>;
  scoreDistribution: Record<string, number>;
  recommendations: string[];
}

export function aggregateFeedback(judgeResults: ValidationResult[]): AggregatedFeedback;
export function generateRecommendations(aggregated: AggregatedFeedback): string[];

// Context Compressor
export function compressContext(
  notes: TemporalNote[],
  options?: {
    maxLength?: number;
    preserveImportant?: boolean;
  }
): TemporalNote[];

export function compressStateHistory(
  stateHistory: Array<Record<string, unknown>>,
  options?: {
    maxLength?: number;
    preserveImportant?: boolean;
  }
): Array<Record<string, unknown>>;

// Persona Experience
export interface PersonaExperienceOptions {
  viewport?: { width: number; height: number };
  device?: string;
  darkMode?: boolean;
  timeScale?: 'human' | 'mechanical';
  captureScreenshots?: boolean;
  captureState?: boolean;
  captureCode?: boolean;
  notes?: TemporalNote[];
}

export interface PersonaExperienceResult {
  persona: Persona;
  notes: TemporalNote[];
  screenshots: TemporalScreenshot[];
  renderedCode?: RenderedCode;
  gameState?: Record<string, unknown>;
  evaluation?: ValidationResult;
  timestamp: number;
}

export function experiencePageAsPersona(
  page: any,
  persona: Persona,
  options?: PersonaExperienceOptions
): Promise<PersonaExperienceResult>;

export function experiencePageWithPersonas(
  page: any,
  personas: Persona[],
  options?: PersonaExperienceOptions
): Promise<PersonaExperienceResult[]>;

// Type Guards
export function isObject<T>(value: unknown): value is Record<string, T>;
export function isString(value: unknown): value is string;
export function isNumber(value: unknown): value is number;
export function isPositiveInteger(value: unknown): value is number;
export function isNonEmptyString(value: unknown): value is string;
export function isArray<T>(value: unknown): value is T[];
export function isFunction(value: unknown): value is Function;
export function isPromise<T>(value: unknown): value is Promise<T>;
export function isValidationResult(value: unknown): value is ValidationResult;
export function isValidationContext(value: unknown): value is ValidationContext;
export function isPersona(value: unknown): value is Persona;
export function isTemporalNote(value: unknown): value is TemporalNote;

// Type Assertions
export function assertObject<T>(value: unknown, name?: string): asserts value is Record<string, T>;
export function assertString(value: unknown, name?: string): asserts value is string;
export function assertNonEmptyString(value: unknown, name?: string): asserts value is string;
export function assertNumber(value: unknown, name?: string): asserts value is number;
export function assertArray<T>(value: unknown, name?: string): asserts value is T[];
export function assertFunction(value: unknown, name?: string): asserts value is Function;

// Utility Functions
export function pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K>;
export function getProperty<T, D>(obj: T, key: string, defaultValue: D): T[keyof T] | D;

// Experience Tracer
export class ExperienceTrace {
  constructor(sessionId: string, persona?: Persona | null);
  sessionId: string;
  persona: Persona | null;
  startTime: number;
  events: Array<Record<string, unknown>>;
  validations: Array<Record<string, unknown>>;
  screenshots: Array<Record<string, unknown>>;
  stateHistory: Array<Record<string, unknown>>;
  aggregatedNotes: AggregatedTemporalNotes | null;
  metaEvaluation: Record<string, unknown> | null;
  
  addEvent(type: string, data: Record<string, unknown>, timestamp?: number | null): Record<string, unknown>;
  addValidation(validation: ValidationResult, context?: Record<string, unknown>): Record<string, unknown>;
  addScreenshot(path: string, step: string, metadata?: Record<string, unknown>): Record<string, unknown>;
  addStateSnapshot(state: Record<string, unknown>, label?: string): Record<string, unknown>;
  aggregateNotes(
    aggregateTemporalNotes: (notes: TemporalNote[], options?: Record<string, unknown>) => AggregatedTemporalNotes,
    options?: Record<string, unknown>
  ): AggregatedTemporalNotes;
  getSummary(): Record<string, unknown>;
  getFullTrace(): Record<string, unknown>;
  exportToJSON(filePath: string): Promise<void>;
}

export class ExperienceTracerManager {
  constructor();
  createTrace(sessionId: string, persona?: Persona | null): ExperienceTrace;
  getTrace(sessionId: string): ExperienceTrace | null;
  getAllTraces(): ExperienceTrace[];
  metaEvaluateTrace(
    sessionId: string,
    validateScreenshot: ValidationFunction
  ): Promise<Record<string, unknown>>;
  getMetaEvaluationSummary(): {
    totalEvaluations: number;
    averageQuality: number | null;
    evaluations?: Array<Record<string, unknown>>;
  };
}

export function getTracerManager(): ExperienceTracerManager;

// Position Counter-Balance
export interface CounterBalanceOptions {
  enabled?: boolean;
  baselinePath?: string | null;
  contextOrder?: 'original' | 'reversed';
}

export interface CounterBalancedResult extends ValidationResult {
  counterBalanced: boolean;
  originalScore: number | null;
  reversedScore: number | null;
  scoreDifference: number | null;
  metadata: {
    counterBalancing: {
      enabled: boolean;
      originalResult: ValidationResult;
      reversedResult: ValidationResult;
      positionBiasDetected: boolean;
    };
  };
}

export function evaluateWithCounterBalance(
  evaluateFn: ValidationFunction<ValidationResult>,
  imagePath: string,
  prompt: string,
  context?: ValidationContext,
  options?: CounterBalanceOptions
): Promise<CounterBalancedResult>;

export function shouldUseCounterBalance(context: ValidationContext): boolean;

// Dynamic Few-Shot Examples
export interface FewShotExample {
  description?: string;
  evaluation?: string;
  score?: number | null;
  screenshot?: string;
  quality?: string;
  result?: {
    score?: number | null;
    reasoning?: string;
  };
  json?: unknown;
}

export interface FewShotOptions {
  maxExamples?: number;
  similarityThreshold?: number;
  useSemanticMatching?: boolean;
}

export function selectFewShotExamples(
  prompt: string,
  examples?: FewShotExample[],
  options?: FewShotOptions
): FewShotExample[];

export function formatFewShotExamples(
  examples: FewShotExample[],
  format?: 'default' | 'json'
): string;

// Metrics
export function spearmanCorrelation(
  x: Array<number | null>,
  y: Array<number | null>
): number | null;

export function pearsonCorrelation(
  x: Array<number | null>,
  y: Array<number | null>
): number | null;

export interface RankAgreementResult {
  spearman: number | null;
  pearson: number | null;
  kendall: number | null;
  exactMatches: number;
  totalItems: number;
  agreementRate: number;
}

export function calculateRankAgreement(
  ranking1: Array<number | null>,
  ranking2: Array<number | null>
): RankAgreementResult;

// Validators
export interface StateValidatorOptions<T = unknown> {
  tolerance?: number;
  validateScreenshot?: ValidationFunction;
  stateExtractor?: (result: ValidationResult, expected: T) => Partial<T>;
  stateComparator?: (extracted: Partial<T>, expected: T, options: { tolerance: number }) => {
    matches: boolean;
    discrepancies: string[];
  };
}

export interface StateValidationOptions<T = unknown> {
  promptBuilder?: (expected: T, options: Record<string, unknown>) => string;
  testType?: string;
  context?: Record<string, unknown>;
  stateDescription?: string;
  extractionTasks?: string[];
}

export interface StateValidationResult<T = unknown> extends ValidationResult {
  extractedState: Partial<T>;
  expectedState: T;
  validation: {
    matches: boolean;
    discrepancies: string[];
  };
  matches: boolean;
}

/**
 * State Validator
 * 
 * Validates that visual state matches expected state using VLLM extraction.
 * Extracts state from screenshot and compares with expected state.
 * 
 * **Use when:** You need to verify specific state values (cart count, button text, etc.)
 * 
 * @example
 * ```typescript
 * const validator = new StateValidator();
 * 
 * const result = await validator.validateState(
 *   'checkout.png',
 *   {
 *     cartCount: 1,
 *     buttonText: 'Checkout'
 *   },
 *   {
 *     testType: 'cart-state'
 *   }
 * );
 * 
 * console.log(result.matches); // true/false
 * console.log(result.discrepancies); // ['cartCount: expected 1, got 2']
 * ```
 */
export class StateValidator<T = unknown> {
  /**
   * Create a new State Validator instance.
   * 
   * @param options - Validator options (tolerance, state extractor, etc.)
   */
  constructor(options?: StateValidatorOptions<T>);
  
  /**
   * Validate state (static method).
   * 
   * @param screenshotPath - Path to screenshot or array for comparison
   * @param expectedState - Expected state object
   * @param options - Validation options
   * @returns Promise resolving to StateValidationResult
   */
  static validate<T = unknown>(
    screenshotPath: string | string[],
    expectedState: T,
    options?: StateValidationOptions<T>
  ): Promise<StateValidationResult<T>>;
  
  /**
   * Validate state matches expected state.
   * 
   * @param screenshotPath - Path to screenshot or array for comparison
   * @param expectedState - Expected state object
   * @param options - Validation options
   * @returns Promise resolving to StateValidationResult
   */
  validateState(
    screenshotPath: string | string[],
    expectedState: T,
    options?: StateValidationOptions<T>
  ): Promise<StateValidationResult<T>>;
  
  /**
   * Build state validation prompt.
   * 
   * @param expectedState - Expected state object
   * @param options - Validation options
   * @returns Validation prompt string
   */
  buildStatePrompt(expectedState: T, options?: StateValidationOptions<T>): string;
}

export interface AccessibilityValidatorOptions {
  minContrast?: number;
  standards?: string[];
  zeroTolerance?: boolean;
  validateScreenshot?: ValidationFunction;
}

export interface AccessibilityOptions {
  customPrompt?: string;
  minContrast?: number;
  standards?: string[];
  testType?: string;
  [key: string]: unknown;
}

export interface AccessibilityResult extends ValidationResult {
  violations: {
    zeroTolerance: string[];
    critical: string[];
    warnings: string[];
  };
  passes: boolean;
  contrastCheck: {
    ratios: string[];
    minRatio: number | null;
    meetsRequirement: boolean | null;
  };
  standards: string[];
}

/**
 * Accessibility Validator
 * 
 * Validates accessibility using VLLM semantic evaluation.
 * Checks contrast, labels, keyboard navigation, error messages, and WCAG compliance.
 * 
 * **Use when:** You need comprehensive accessibility validation beyond programmatic checks.
 * 
 * @example
 * ```typescript
 * const validator = new AccessibilityValidator({
 *   minContrast: 4.5,
 *   standards: ['WCAG-AA']
 * });
 * 
 * const result = await validator.validateAccessibility(
 *   'payment-form.png',
 *   {
 *     testType: 'accessibility'
 *   }
 * );
 * 
 * console.log(result.passes); // true/false
 * console.log(result.violations.zeroTolerance); // Critical violations
 * ```
 */
export class AccessibilityValidator {
  /**
   * Create a new Accessibility Validator instance.
   * 
   * @param options - Validator options (minContrast, standards, etc.)
   */
  constructor(options?: AccessibilityValidatorOptions);
  
  /**
   * Validate accessibility (static method).
   * 
   * @param screenshotPath - Path to screenshot or array for comparison
   * @param options - Validation options
   * @returns Promise resolving to AccessibilityResult
   */
  static validate(
    screenshotPath: string | string[],
    options?: AccessibilityOptions
  ): Promise<AccessibilityResult>;
  
  /**
   * Validate accessibility of screenshot.
   * 
   * @param screenshotPath - Path to screenshot or array for comparison
   * @param options - Validation options
   * @returns Promise resolving to AccessibilityResult
   */
  validateAccessibility(
    screenshotPath: string | string[],
    options?: AccessibilityOptions
  ): Promise<AccessibilityResult>;
  
  /**
   * Build accessibility validation prompt.
   * 
   * @param options - Validation options
   * @returns Validation prompt string
   */
  buildAccessibilityPrompt(options?: AccessibilityOptions): string;
  
  /**
   * Detect accessibility violations from validation result.
   * 
   * @param result - Validation result
   * @returns Categorized violations (zeroTolerance, critical, warnings)
   */
  detectViolations(result: ValidationResult): {
    zeroTolerance: string[];
    critical: string[];
    warnings: string[];
  };
  
  /**
   * Extract contrast information from validation result.
   * 
   * @param result - Validation result
   * @returns Contrast ratios and compliance status
   */
  extractContrastInfo(result: ValidationResult): {
    ratios: string[];
    minRatio: number | null;
    meetsRequirement: boolean | null;
  };
}

export type PromptTemplate = (variables: Record<string, unknown>, context?: Record<string, unknown>) => string;

export interface PromptBuilderOptions {
  templates?: Record<string, PromptTemplate | string>;
  rubric?: Rubric;
  defaultContext?: Record<string, unknown>;
}

export interface PromptOptions {
  variables?: Record<string, unknown>;
  context?: Record<string, unknown>;
  includeRubric?: boolean;
  includeZeroTolerance?: boolean;
  includeScoring?: boolean;
  enforceZeroTolerance?: boolean;
  rubric?: Rubric;
}

export class PromptBuilder {
  constructor(options?: PromptBuilderOptions);
  buildPrompt(basePrompt: string, options?: PromptOptions): string;
  buildFromTemplate(templateName: string, variables?: Record<string, unknown>, options?: PromptOptions): string;
  registerTemplate(name: string, template: PromptTemplate | string): void;
}

export interface RubricOptions {
  enforceZeroTolerance?: boolean;
  includeZeroTolerance?: boolean;
  includeScoring?: boolean;
}

export interface RubricCriterion {
  id: string;
  rule: string;
  weight?: number;
  zeroTolerance?: boolean;
  penalty?: number;
  description?: string;
}

export interface ExtendedRubric extends Rubric {
  criteria?: RubricCriterion[];
  name?: string;
  description?: string;
}

export function validateWithRubric(
  screenshotPath: string,
  prompt: string,
  rubric: ExtendedRubric,
  context?: ValidationContext,
  options?: RubricOptions
): Promise<ValidationResult & { zeroToleranceViolation?: boolean }>;

export interface BatchValidatorOptions {
  maxConcurrency?: number;
  batchSize?: number;
  cacheEnabled?: boolean;
  trackCosts?: boolean;
  trackStats?: boolean;
}

export interface BatchValidationStats {
  total: number;
  passed: number;
  failed: number;
  duration: number;
  costStats: ReturnType<CostTracker['getStats']> | null;
  performance: {
    totalRequests: number;
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
    successRate: number;
  } | null;
}

export interface BatchValidationResult {
  results: ValidationResult[];
  stats: BatchValidationStats | null;
}

export class BatchValidator extends BatchOptimizer {
  constructor(options?: BatchValidatorOptions);
  batchValidate(
    screenshots: string | string[],
    prompt: string,
    context?: ValidationContext
  ): Promise<BatchValidationResult>;
  getCostStats(): ReturnType<CostTracker['getStats']>;
  getPerformanceStats(): {
    totalRequests: number;
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
    successRate: number;
  };
  resetStats(): void;
}

// Programmatic Validators (fast, deterministic)
// Use these when you have Playwright page access and need fast feedback (<100ms)

/**
 * Calculate contrast ratio between two colors (WCAG algorithm)
 * 
 * @param color1 - First color (rgb, rgba, or hex)
 * @param color2 - Second color (rgb, rgba, or hex)
 * @returns Contrast ratio (1.0 to 21.0+)
 */
export function getContrastRatio(color1: string, color2: string): number;

/**
 * Contrast check result for a single element
 */
export interface ElementContrastResult {
  ratio: number;
  passes: boolean;
  foreground: string;
  background: string;
  foregroundRgb?: [number, number, number];
  backgroundRgb?: [number, number, number];
  error?: string;
  selector?: string;
}

/**
 * Check contrast ratio for an element
 * 
 * @param page - Playwright page object
 * @param selector - CSS selector for element
 * @param minRatio - Minimum required contrast ratio (default: 4.5 for WCAG-AA)
 * @returns Contrast check result
 */
export function checkElementContrast(
  page: any,
  selector: string,
  minRatio?: number
): Promise<ElementContrastResult>;

/**
 * Text contrast check result for all text elements
 */
export interface AllTextContrastResult {
  total: number;
  passing: number;
  failing: number;
  violations: Array<{
    element: string;
    ratio: string;
    required: number;
    foreground: string;
    background: string;
  }>;
  elements?: Array<{
    tag: string;
    id: string;
    className: string;
    ratio: number;
    passes: boolean;
    foreground: string;
    background: string;
  }>;
}

/**
 * Check contrast for all text elements on page
 * 
 * @param page - Playwright page object
 * @param minRatio - Minimum required contrast ratio (default: 4.5 for WCAG-AA)
 * @returns Contrast check results for all text elements
 */
export function checkAllTextContrast(
  page: any,
  minRatio?: number
): Promise<AllTextContrastResult>;

/**
 * Keyboard navigation check result
 */
export interface KeyboardNavigationResult {
  keyboardAccessible: boolean;
  focusableElements: number;
  violations: Array<{
    element: string;
    issue: string;
  }>;
  focusableSelectors: string[];
}

/**
 * Check keyboard navigation accessibility
 * 
 * @param page - Playwright page object
 * @returns Keyboard navigation check result
 */
export function checkKeyboardNavigation(page: any): Promise<KeyboardNavigationResult>;

/**
 * Programmatic state validation options
 */
export interface ProgrammaticStateOptions {
  selectors?: Record<string, string>;
  tolerance?: number;
  stateExtractor?: (page: any) => Promise<unknown>;
}

/**
 * Programmatic state validation result
 */
export interface ProgrammaticStateResult {
  matches: boolean;
  discrepancies: string[];
  visualState: Record<string, {
    x: number;
    y: number;
    width: number;
    height: number;
    visible: boolean;
  } | null>;
  expectedState: Record<string, unknown>;
  gameState?: unknown;
}

/**
 * Validate state matches visual representation
 * 
 * @param page - Playwright page object
 * @param expectedState - Expected state object
 * @param options - Validation options
 * @returns State validation result
 */
export function validateStateProgrammatic(
  page: any,
  expectedState: Record<string, unknown>,
  options?: ProgrammaticStateOptions
): Promise<ProgrammaticStateResult>;

/**
 * Element position validation result
 */
export interface ElementPositionResult {
  matches: boolean;
  actual: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  expected: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  };
  diff: {
    x: number;
    y: number;
    width?: number;
    height?: number;
  };
  tolerance: number;
  error?: string;
  selector?: string;
}

/**
 * Validate element position matches expected position
 * 
 * @param page - Playwright page object
 * @param selector - CSS selector for element
 * @param expectedPosition - Expected position {x, y} or {x, y, width, height}
 * @param tolerance - Pixel tolerance (default: 5)
 * @returns Position validation result
 */
export function validateElementPosition(
  page: any,
  selector: string,
  expectedPosition: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  },
  tolerance?: number
): Promise<ElementPositionResult>;

// Hybrid Validators (Programmatic + VLLM)
// Combine programmatic data with semantic LLM evaluation

/**
 * Hybrid accessibility validation result
 */
export interface AccessibilityHybridResult extends ValidationResult {
  programmaticData: {
    contrast: AllTextContrastResult;
    keyboard: KeyboardNavigationResult;
  };
}

/**
 * Hybrid accessibility validation
 * Combines programmatic contrast/keyboard checks with VLLM semantic evaluation
 * 
 * @param page - Playwright page object
 * @param screenshotPath - Path to screenshot
 * @param minContrast - Minimum contrast ratio (default: 4.5)
 * @param options - Validation options
 * @returns Hybrid validation result with programmatic data
 */
export function validateAccessibilityHybrid(
  page: any,
  screenshotPath: string,
  minContrast?: number,
  options?: ValidationContext
): Promise<AccessibilityHybridResult>;

/**
 * Hybrid state validation result
 */
export interface StateHybridResult extends ValidationResult {
  programmaticData: {
    gameState?: unknown;
    visualState: Record<string, {
      x: number;
      y: number;
      width: number;
      height: number;
      visible: boolean;
    } | null>;
    discrepancies: string[];
    matches: boolean;
  };
}

/**
 * Hybrid state validation
 * Combines programmatic state extraction with VLLM semantic evaluation
 * 
 * @param page - Playwright page object
 * @param screenshotPath - Path to screenshot
 * @param expectedState - Expected state object
 * @param options - Validation options
 * @returns Hybrid validation result with programmatic data
 */
export function validateStateHybrid(
  page: any,
  screenshotPath: string,
  expectedState: Record<string, unknown>,
  options?: ProgrammaticStateOptions & ValidationContext
): Promise<StateHybridResult>;

/**
 * Generic hybrid validator result
 */
export interface HybridValidationResult extends ValidationResult {
  programmaticData: Record<string, unknown>;
}

/**
 * Generic hybrid validator helper
 * Combines any programmatic data with VLLM evaluation
 * 
 * @param screenshotPath - Path to screenshot
 * @param prompt - Base evaluation prompt
 * @param programmaticData - Programmatic validation data
 * @param options - Validation options
 * @returns Hybrid validation result with programmatic data
 */
export function validateWithProgrammaticContext(
  screenshotPath: string,
  prompt: string,
  programmaticData: Record<string, unknown>,
  options?: ValidationContext
): Promise<HybridValidationResult>;

