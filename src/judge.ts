/**
 * VLLM Judge
 * 
 * Core screenshot validation using Vision Language Models.
 * Supports multiple providers (Gemini, OpenAI, Claude, Groq).
 * 
 * GROQ INTEGRATION:
 * - Groq uses OpenAI-compatible API (routes to callOpenAIAPI)
 * - ~0.22s latency (10x faster than typical providers)
 * - Useful for high-frequency decisions (10-60Hz temporal decisions)
 * 
 * NOTE: Groq should also be added to @arclabs561/llm-utils for text-only LLM calls.
 * This package handles VLLM (vision) calls; llm-utils handles text-only calls.
 */

import { readFileSync, existsSync } from 'fs';
import { dirname, basename, resolve } from 'path';
import { createConfig, getConfig } from './config.js';
import { getCached, setCached } from './cache.js';
import { createHash } from 'crypto';
import { FileError, ProviderError, TimeoutError, ValidationError } from './errors.js';
import { log, warn } from './logger.js';
import { evaluateTemporalDecision } from '#temporal-prompt-formatting';
import { recordCost } from './cost-tracker.js';
import { normalizeValidationResult } from '#validation-result-normalizer';
import { validateImagePath, validatePrompt } from './validation.mjs';
import { sanitizePrompt, validatePromptSecurity } from './utils/prompt-sanitizer.mjs';
import { getRateLimiter } from './utils/rate-limiter.mjs';
import { RETRY_CONSTANTS, API_CONSTANTS } from './constants.js';
import { enhanceErrorMessage } from './retry.js';
import { safeLogCacheOperation } from './safe-logger.mjs';
import { composeSingleImagePrompt, composeComparisonPrompt } from './prompt-composer.mjs';
import { createReviewTask } from '#review-contract';
import { createGameActionTask } from '#game-action-contract';
import { getProviderAdapter } from '#provider-adapters';
import { resolveTaskStructuredOutput } from '#structured-output';
import { executeStructuredTask } from '#structured-task';
import type { ConfigOptions, SemanticInfo, ValidationContext, ValidationResult } from '#public-contract';
import type { ProviderAdapter, ProviderConfig, ProviderImage, StructuredOutputSpec } from '#provider-adapters';
import type { ReviewOutcome } from '#review-contract';
import type { GameAction } from '#game-action-contract';

type AnyRecord = Record<string, any>;
type JudgeContext = ValidationContext & AnyRecord;
type ImagePath = string | string[];
type ProviderInput = { data: string; mime: ProviderImage['mime'] };
type ReviewBuildInput = {
  judgment: string;
  data: AnyRecord | null;
  logprobs: unknown;
  attempts: number;
  responseTime: number;
  imagePath: ImagePath;
  context: JudgeContext;
  reviewOutcome?: ReviewOutcome | null;
  outputFormat?: string | null;
  structuredOutput?: StructuredOutputSpec | null;
};

export interface GameActionResult {
  action: GameAction;
  outputFormat: string;
  diagnostics: string[];
  attempts: number;
  provider: string;
  model: string;
  structuredOutput: { mode: StructuredOutputSpec['mode']; diagnostic: string | null };
}

/** Clamp a score to [0, 10] or null. */
function _clampScore(raw: unknown): number | null {
  if (raw == null || typeof raw !== 'number' || isNaN(raw)) return null;
  return Math.max(0, Math.min(10, raw));
}

/**
 * VLLM Judge Class
 *
 * Handles screenshot validation using Vision Language Models.
 */
export class VLLMJudge {
  config: AnyRecord;
  provider: string;
  apiKey: string;
  providerConfig: ProviderConfig & AnyRecord;
  providerAdapter: ProviderAdapter;
  enabled: boolean;
  _cacheInitialized: boolean;

  constructor(options: ConfigOptions & AnyRecord = {}) {
    this.config = createConfig(options);
    this.provider = this.config.provider;
    this.apiKey = this.config.apiKey;
    this.providerConfig = this.config.providerConfig;
    this.providerAdapter = getProviderAdapter(this.provider);
    this.enabled = this.config.enabled;
    this._cacheInitialized = false;
  }

  /**
   * Initialize cache (lazy initialization)
   */
  async _initCache() {
    if (this._cacheInitialized || !this.config.cache.enabled) return;
    
    if (this.config.cache.dir) {
      const { initCache } = await import('./cache.js');
      initCache(this.config.cache.dir);
    }
    this._cacheInitialized = true;
  }

  /**
   * Convert image to base64 for API
   * 
   * SECURITY: Validates image path to prevent path traversal attacks
   * SECURITY: Validates image format using magic bytes to prevent format spoofing
   */
  imageToBase64(imagePath: string): string {
    return this.imageToProviderInput(imagePath).data;
  }

  /**
   * Read an image once and preserve the MIME detected from its magic bytes.
   */
  imageToProviderInput(imagePath: string): ProviderInput {
    // Validate and resolve path before file operations
    // Note: imagePath may already be validated/resolved from judgeScreenshot
    let validatedPath: string;
    try {
      // All paths go through validateImagePath for traversal + extension checks.
      // Absolute paths use their own directory as baseDir so the "within base"
      // check passes, while still validating extension and normalizing.
      if (imagePath.startsWith('/')) {
        validatedPath = validateImagePath(basename(imagePath), { baseDir: dirname(resolve(imagePath)) }) as unknown as string;
      } else {
        validatedPath = validateImagePath(imagePath) as unknown as string;
      }
    } catch (validationError: any) {
      throw new FileError(`Invalid image path: ${validationError.message}`, basename(imagePath));
    }
    
    if (!existsSync(validatedPath)) {
      throw new FileError(`Screenshot not found: ${basename(validatedPath)}`, basename(validatedPath));
    }
    try {
      const imageBuffer = readFileSync(validatedPath);

      // Enforce size limit to prevent OOM from oversized images
      const maxImageSize = (API_CONSTANTS as AnyRecord).MAX_IMAGE_SIZE as number;
      if (imageBuffer.length > maxImageSize) {
        const sizeMB = (imageBuffer.length / (1024 * 1024)).toFixed(1);
        const limitMB = (maxImageSize / (1024 * 1024)).toFixed(0);
        throw new FileError(`Image too large: ${sizeMB}MB (limit: ${limitMB}MB)`, basename(validatedPath));
      }

      // SECURITY: Validate image format using magic bytes
      const mime = this._validateImageFormat(imageBuffer, validatedPath);

      return { data: imageBuffer.toString('base64'), mime };
    } catch (error: any) {
      // Sanitize error message - don't leak full path
      throw new FileError(`Failed to read screenshot: ${error.message}`, basename(validatedPath), { originalError: error.message });
    }
  }

  /**
   * Validate image format using magic bytes (file signatures)
   * 
   * @param {Buffer} buffer - Image file buffer
   * @param {string} filePath - File path (for error messages)
   * @throws {ValidationError} If image format is invalid
   */
  private _validateImageFormat(buffer: Buffer, filePath: string): ProviderImage['mime'] {
    if (!Buffer.isBuffer(buffer) || buffer.length < 4) {
      throw new ValidationError('Invalid image file: file too small or not a buffer', basename(filePath) as any);
    }

    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      return 'image/png';
    }

    // JPEG signature: FF D8 FF
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      return 'image/jpeg';
    }

    // GIF signature: 47 49 46 38 (GIF8)
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
      return 'image/gif';
    }

    // WebP signature: RIFF...WEBP
    if (buffer.length >= 12 &&
        buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
        buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
      return 'image/webp';
    }

    // No valid signature found
    throw new (ValidationError as any)(
      'Invalid image format: file signature does not match supported formats (PNG, JPEG, GIF, WebP)',
      basename(filePath),
      {
        detectedSignature: Array.from(buffer.slice(0, 4)).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' ')
      } as AnyRecord
    );
  }

  /**
   * Resolve anchor images from config and per-call context into provider inputs.
   * Returns { images: {data:string,mime:string}[], count: { positive: number, negative: number } }
   * so the prompt composer can label them.
   *
   * AnchorEntry images can be:
   *   - A file path (resolved via imageToBase64)
   *   - A data URI ("data:image/png;base64,...") -- base64 extracted directly
   *   - A raw base64 string (no path separators, length > 100)
   *
   * @param {import('#public-contract').ValidationContext} context
   * @returns {{ images: Array<{data:string,mime:string}>, count: { positive: number, negative: number } }}
   */
  _resolveAnchorImages(context: JudgeContext): { images: ProviderInput[]; count: { positive: number; negative: number } } {
    const configAnchors = this.config.anchors || {};
    const ctxAnchors = context.anchors || {};

    // Extract image refs from AnchorEntry arrays (mixed string + object entries)
    const extractImageRefs = (entries: unknown): string[] => {
      if (!Array.isArray(entries)) return [];
      return entries
        .filter((e: any): e is { image: string } => typeof e === 'object' && e !== null && typeof e.image === 'string')
        .map(e => e.image);
    };

    const positiveRefs = [
      ...extractImageRefs(configAnchors.positive),
      ...extractImageRefs(ctxAnchors.positive)
    ];
    const negativeRefs = [
      ...extractImageRefs(configAnchors.negative),
      ...extractImageRefs(ctxAnchors.negative)
    ];

    if (positiveRefs.length === 0 && negativeRefs.length === 0) {
      return { images: [], count: { positive: 0, negative: 0 } };
    }

    const images: ProviderInput[] = [];
    let positiveCount = 0;
    let negativeCount = 0;

    const resolveImage = (ref: string): ProviderInput => {
      // Data URI: extract base64 payload
      if (ref.startsWith('data:image/')) {
        const commaIdx = ref.indexOf(',');
        const mime = ref.slice(5, ref.indexOf(';'));
        if (commaIdx > 0 && ['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(mime)) {
          return { data: ref.slice(commaIdx + 1), mime: mime as ProviderImage['mime'] };
        }
      }
      // Looks like raw base64 (no path separators, long enough)
      if (!ref.includes('/') && !ref.includes('\\') && ref.length > 100) {
        return { data: ref, mime: 'image/png' };
      }
      // File path: read and convert
      return this.imageToProviderInput(ref);
    };

    for (const ref of positiveRefs) {
      try {
        images.push(resolveImage(ref));
        positiveCount++;
      } catch (err: any) {
        warn(`[VLLM] Skipping positive anchor image ${ref.slice(0, 80)}: ${err.message}`);
      }
    }

    for (const ref of negativeRefs) {
      try {
        images.push(resolveImage(ref));
        negativeCount++;
      } catch (err: any) {
        warn(`[VLLM] Skipping negative anchor image ${ref.slice(0, 80)}: ${err.message}`);
      }
    }

    return { images, count: { positive: positiveCount, negative: negativeCount } };
  }

  /**
   * Judge screenshot using VLLM API
   *
   * @param {string | string[]} imagePath - Single image path or array of image paths for comparison
   * @param {string} prompt - Evaluation prompt
   * @param {import('#public-contract').ValidationContext} [context={}] - Validation context
   * @returns {Promise<import('#public-contract').ValidationResult>} Validation result
   */
  async judgeScreenshot(imagePath: ImagePath, prompt: string, context: JudgeContext = {}): Promise<ValidationResult> {
    prompt = this._validateAndSanitizePrompt(prompt, context);
    const imagePaths = Array.isArray(imagePath) ? imagePath : [imagePath];
    this._validateImagePaths(imagePaths);
    const isMultiImage = imagePaths.length > 1;
    if (!this.enabled) {
      // Return normalized disabled result
      return normalizeValidationResult({
        enabled: false,
        provider: this.provider,
        model: this.providerConfig.model,
        message: `API validation disabled (set ${this.provider.toUpperCase()}_API_KEY or API_KEY)`,
        pricing: this.providerConfig.pricing,
        score: null,
        issues: [],
        reasoning: 'API validation is disabled',
        assessment: null
      }, 'judgeScreenshot-disabled');
    }

    // Temporal Decision Manager
    // Logic extracted to evaluateTemporalDecision for testability and simplicity
    const temporalResult = await evaluateTemporalDecision(context, this.config);
    if (temporalResult) {
      return temporalResult as unknown as ValidationResult;
    }

    // Initialize cache if needed
    await this._initCache();
    
    const useCache = context.useCache !== false && this.config.cache.enabled;

    const startTime = Date.now();
    const timeout = context.timeout || this.config.performance.timeout;
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), timeout);
    
    let response;
    let data;
    let judgment = null;
    let error = null;
    let attempts = 0;
    let responseTime = 0; // Initialize for error logging

    try {
      // SECURITY: Rate limiting (if enabled)
      // Check rate limits before making API call
      if (context.enableRateLimit !== false) {
        try {
          const rateLimiter = getRateLimiter(context.rateLimitOptions || {});
          // Estimate cost for rate limiting (rough estimate based on provider)
          const estimatedCost = this.providerConfig.pricing?.input 
            ? (1000 / 1_000_000) * this.providerConfig.pricing.input // Rough estimate: 1k tokens
            : 0;
          rateLimiter.checkLimit(estimatedCost);
        } catch (rateLimitError: any) {
          throw new ValidationError(`Rate limit exceeded: ${rateLimitError.message}`);
        }
      }

      // Resolve anchor images (config-level + per-call), then the evaluation target(s)
      // Order: [positive examples] [negative examples] [target screenshot(s)]
      // The prompt text labels which images are references vs. evaluation targets
      const anchorImages = this._resolveAnchorImages(context);
      const targetImages = imagePaths.map(path => this.imageToProviderInput(path));
      const providerImages = [...anchorImages.images, ...targetImages];
      const composedPrompt = await this.buildPrompt(prompt, {
        ...context,
        _anchorImageCount: anchorImages.count
      }, isMultiImage);

      const reviewMode = isMultiImage || context.reviewMode === 'comparison' ? 'comparison' : 'scalar';
      const reviewTask = createReviewTask(reviewMode, context.legacyOutputFallback !== false);
      const structuredOutput = resolveTaskStructuredOutput({
        provider: this.provider,
        model: this.providerConfig.model,
        taskName: reviewTask.name,
        schema: reviewTask.schema,
        enabled: context.structuredOutput !== false
      });
      const fullPrompt = `${composedPrompt}\n\nOUTPUT CONTRACT\nReturn only JSON matching this schema:\n${JSON.stringify(structuredOutput.schema)}`;
      const anchorDigest = createHash('sha256')
        .update(anchorImages.images.map(image => `${image.mime}:${image.data}`).join(':'))
        .digest('hex');
      const cacheContext = {
        ...context,
        provider: this.provider,
        model: this.providerConfig.model,
        reviewMode,
        structuredOutputMode: structuredOutput.mode,
        anchorDigest
      };
      const cacheKey = isMultiImage ? imagePaths.join('|') : imagePaths[0]!;

      if (useCache) {
        const cached = getCached(cacheKey, fullPrompt, cacheContext);
        this._logCacheResult(cached ? 'hit' : 'miss', context, cacheKey);
        if (cached) {
          clearTimeout(timeoutId);
          return normalizeValidationResult({ ...cached, cached: true }, 'judgeScreenshot-cache');
        }
      }

      const apiResult = await executeStructuredImageTask({
        judge: this,
        images: providerImages,
        prompt: fullPrompt,
        task: reviewTask,
        structuredOutput,
        context,
        signal: abortController.signal,
        onAttempt: attempt => { attempts = attempt; },
      });
      attempts = apiResult.attempts;

      clearTimeout(timeoutId);

      judgment = apiResult.judgment;
      data = apiResult.data;
      const logprobs = apiResult.logprobs || null;
      const responseTime = Date.now() - startTime;

      const validationResult = await this._buildResult(
        {
          judgment, data, logprobs, attempts, responseTime, imagePath, context,
          reviewOutcome: apiResult.outcome as ReviewOutcome,
          outputFormat: apiResult.format,
          structuredOutput
        }
      );

      const normalizedResult = normalizeValidationResult(validationResult, 'judgeScreenshot');

      if (useCache) {
        setCached(cacheKey, fullPrompt, cacheContext, normalizedResult);
      }

      return normalizedResult;
    } catch (err: any) {
      clearTimeout(timeoutId);
      error = err;
      responseTime = Date.now() - startTime;
      
      this._logPerf({ provider: this.provider, latency: responseTime, retries: attempts - 1, success: false, error: err, testName: context.testType || context.step || 'unknown' }, 'logAPICallPerformance');
      this._logPerf({ error: err, context: `API call (${this.provider})`, recovery: 'retry_with_backoff', retryCount: attempts - 1, recovered: false }, 'logErrorPattern');

      // Handle timeout errors specifically
      if (error.name === 'AbortError' || error.message?.includes('timeout') || error.message?.includes('aborted')) {
        const enhancedMessage = enhanceErrorMessage(
          new TimeoutError(`VLLM API call timed out after ${timeout}ms`, timeout),
          attempts || 1,
          'judgeScreenshot'
        );
        throw new TimeoutError(enhancedMessage, timeout, {
          provider: this.provider,
          imagePath,
          attempts: attempts || 1
        });
      }
      
      // Re-throw ProviderError with enhanced context
      if (error instanceof ProviderError) {
        const enhancedMessage = enhanceErrorMessage(error, attempts || 1, 'judgeScreenshot');
        throw new ProviderError(enhancedMessage, this.provider, {
          ...error.details,
          imagePath: Array.isArray(imagePath) ? imagePath.map(p => basename(p)) : basename(imagePath),
          prompt: prompt.substring(0, 100),
          attempts: attempts || 1
        });
      }
      
      // Re-throw FileError and TimeoutError as-is (already have context)
      if (error instanceof FileError || error instanceof TimeoutError) {
        throw error;
      }
      
      // For other errors, enhance message and throw (consistent error handling)
      const enhancedMessage = enhanceErrorMessage(error, attempts || 1, 'judgeScreenshot');
      throw new ProviderError(
        `VLLM API call failed: ${enhancedMessage}`,
        this.provider,
        {
          imagePath: Array.isArray(imagePath) ? imagePath.map(p => basename(p)) : basename(imagePath),
          prompt: prompt.substring(0, 100),
          attempts: attempts || 1,
          originalError: error.message
        }
      );
    }
  }

  /**
   * Build prompt for screenshot validation
   * 
   * Uses unified prompt composition system for research-backed consistency.
   * Research: Explicit rubrics improve reliability by 10-20% (arXiv:2412.05579)
   * 
   * Supports variable goals: if context.goal is provided, it will be used to generate
   * the base prompt before composition. This allows integration of variable
   * goals throughout the system.
   * 
   * @param {string} prompt - Base prompt (or ignored if context.goal is provided)
   * @param {import('#public-contract').ValidationContext} context - Validation context
   * @param {boolean} [isMultiImage=false] - Whether this is a multi-image comparison
   * @returns {string} Full prompt with context
   */
  async buildPrompt(prompt: string, context: JudgeContext = {}, isMultiImage = false): Promise<string> {
    // If custom prompt builder provided, use it
    if (context.promptBuilder && typeof context.promptBuilder === 'function') {
      return context.promptBuilder(prompt, context);
    }

    // Use unified prompt composition system (which handles variable goals)
    // Config-level anchors are passed via composer options; per-call anchors
    // live on context.anchors. The composer merges both (config first, per-call appends).
    // Pass goal in context - composeSingleImagePrompt/composeComparisonPrompt will handle it
    try {
      const composerAnchors = this.config.anchors || null;
      if (isMultiImage) {
        return await composeComparisonPrompt(prompt, context, {
          includeRubric: context.includeRubric !== false, // Default true (research-backed)
          anchors: composerAnchors
        } as any);
      } else {
        return await composeSingleImagePrompt(prompt, context, {
          includeRubric: context.includeRubric !== false, // Default true (research-backed)
          temporalNotes: context.temporalNotes || null,
          anchors: composerAnchors
        } as any);
      }
    } catch (error: any) {
      // Fallback to basic prompt building if composition fails
      if (this.config.debug.verbose) {
        warn(`[VLLM] Prompt composition failed, using fallback: ${error.message}`);
      }
      
      // Basic fallback (original implementation)
      let fullPrompt = prompt;
      const contextParts = [];
      if (context.testType) {
        contextParts.push(`Test Type: ${context.testType}`);
      }
      if (context.viewport) {
        const viewport = context.viewport as AnyRecord;
        contextParts.push(`Viewport: ${viewport.width}x${viewport.height}`);
      }
      if (context.gameState) {
        contextParts.push(`Game State: ${JSON.stringify(context.gameState)}`);
      }
      if (contextParts.length > 0) {
        fullPrompt = `${prompt}\n\nContext:\n${contextParts.join('\n')}`;
      }
      if (isMultiImage) {
        fullPrompt = `${fullPrompt}\n\nYou are comparing two screenshots side-by-side. Return JSON with:
{
  "winner": "A" | "B" | "tie" | "indeterminate",
  "confidence": 0.0-1.0,
  "reasoning": "explanation",
  "differences": ["difference1", "difference2"],
  "scores": {"A": 0-10, "B": 0-10}
}

Image A is the first supplied image; Image B is the second supplied image.
Use "indeterminate" when the evidence is insufficient to choose or declare a tie.`;
      }
      return fullPrompt;
    }
  }

  /**
   * Extract semantic information from judgment text
   */
  extractSemanticInfo(judgment: unknown): SemanticInfo {
    // Handle case where judgment is already an object
    if (typeof judgment === 'object' && judgment !== null && !Array.isArray(judgment)) {
      const record = judgment as AnyRecord;
      // Normalize issues: handle both array of strings and array of objects
      let issues = Array.isArray(record.issues) ? record.issues : [];
      if (issues.length > 0 && typeof issues[0] === 'string') {
        // Convert string array to object array for consistency
        issues = issues.map((desc: unknown) => ({
          description: desc,
          importance: 'medium',
          annoyance: 'medium',
          impact: 'minor-inconvenience'
        }));
      }
      
      // Normalize recommendations: handle both array of strings and array of objects
      const richRecommendations = this._normalizeRichRecommendations(record.recommendations);
      const recommendations = richRecommendations.map(recommendation => recommendation.suggestion);
      
      return {
        score: _clampScore(record.score),
        issues: issues,
        assessment: record.assessment || null,
        reasoning: record.reasoning || null,
        strengths: Array.isArray(record.strengths) ? record.strengths : [],
        recommendations: recommendations,
        richRecommendations,
        evidence: record.evidence || null,
        dimensionScores: record.dimensionScores || null,
        brutalistViolations: record.brutalistViolations || [],
        zeroToleranceViolations: record.zeroToleranceViolations || []
      };
    }

    // Handle case where judgment is a string
    const judgmentText = typeof judgment === 'string' ? judgment : String(judgment || '');

    try {
      const jsonMatch = judgmentText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        // Normalize issues and recommendations
        let issues = Array.isArray(parsed.issues) ? parsed.issues : [];
        if (issues.length > 0 && typeof issues[0] === 'string') {
          issues = issues.map((desc: unknown) => ({
            description: desc,
            importance: 'medium',
            annoyance: 'medium',
            impact: 'minor-inconvenience'
          }));
        }

        const richRecommendations = this._normalizeRichRecommendations(parsed.recommendations);
        const recommendations = richRecommendations.map(recommendation => recommendation.suggestion);

        return {
          score: _clampScore(parsed.score),
          issues: issues,
          assessment: parsed.assessment || null,
          reasoning: parsed.reasoning || null,
          strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
          recommendations: recommendations,
          richRecommendations,
          evidence: parsed.evidence || null,
          dimensionScores: parsed.dimensionScores || null,
          brutalistViolations: parsed.brutalistViolations || [],
          zeroToleranceViolations: parsed.zeroToleranceViolations || []
        };
      }
    } catch (_error) {
      // Fall through to regex extraction
    }

    // Fallback: extract basic info from text
    // Try to extract score from the full judgment text (including reasoning)
    const extractedScore = this.extractScore(judgmentText);

    return {
      score: extractedScore,
      issues: this.extractIssues(judgmentText),
      assessment: this.extractAssessment(judgmentText),
      reasoning: judgmentText.substring(0, 500),
      recommendations: [],
      richRecommendations: [],
      strengths: [],
      dimensionScores: this.extractDimensionScores(judgmentText),
    };
  }

  _normalizeRichRecommendations(recommendations: unknown): Array<AnyRecord & { suggestion: string }> {
    if (!Array.isArray(recommendations)) return [];
    return recommendations.map((recommendation: unknown) => {
      if (typeof recommendation === 'string') {
        return {
          priority: 'medium',
          suggestion: recommendation,
          expectedImpact: 'improved user experience'
        };
      }
      if (recommendation && typeof recommendation === 'object') {
        const record = recommendation as AnyRecord;
        return {
          ...recommendation,
          suggestion: String(
            record.suggestion
              ?? record.description
              ?? record.text
              ?? JSON.stringify(record)
          )
        };
      }
      return {
        priority: 'medium',
        suggestion: String(recommendation),
        expectedImpact: 'improved user experience'
      };
    });
  }

  /**
   * Extract dimension scores from free-text VLM responses.
   * Matches patterns like "GAME AUTHENTICITY: 8/10" or "game_authenticity: 8"
   * or JSON-like "game_authenticity": 8.
   */
  extractDimensionScores(text: unknown): Record<string, number> | null {
    if (!text || typeof text !== 'string') return null;

    // Try embedded JSON first: "dimensionScores": { ... }
    const jsonMatch = text.match(/"dimensionScores"\s*:\s*\{([^}]+)\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(`{${jsonMatch[1]}}`);
      } catch { /* fall through */ }
    }

    // Regex: "DIMENSION_NAME: N/10" or "dimension_name: N"
    const scores: Record<string, number> = {};
    // Match "WORD WORD: N/10" or "word_word: N/10" patterns
    const pattern = /(?:^|\n)\s*(?:\d+\.\s*)?[*]*([A-Z][A-Z_ &]+)[*]*\s*:\s*(\d+)\s*(?:\/\s*10)?/gm;
    for (const match of text.matchAll(pattern)) {
      const name = match[1]!.trim().toLowerCase().replace(/[& ]+/g, '_');
      const value = parseInt(match[2]!, 10);
      if (value >= 0 && value <= 10) {
        scores[name] = value;
      }
    }

    return Object.keys(scores).length > 0 ? scores : null;
  }

  /**
   * Extract score from judgment text
   */
  extractScore(judgment: unknown): number | null {
    if (!judgment || typeof judgment !== 'string') return null;
    
    const patterns = [
      // JSON format: "score": 7
      /"score"\s*:\s*(\d+)/i,
      // Text format: Score: 7 or Score 7
      /score[:\s]*(\d+)/i,
      // Fraction format: score: 7/10 or 7/10
      /score[:\s]*(\d+)\s*\/\s*10/i,
      /(\d+)\s*\/\s*10/i,
      // Rating format: Rating: 7, Rated 7
      /rating[:\s]*(\d+)/i,
      /rated[:\s]*(\d+)/i,
      // Verdict format: Verdict: PASS (7/10) or Verdict: FAIL (3/10)
      /verdict[:\s]*(?:pass|fail)[:\s]*\((\d+)\s*\/\s*10\)/i,
      // Markdown format: **Score**: 7 or ## Score: 7
      /\*\*score\*\*[:\s]*(\d+)/i,
      /##\s*score[:\s]*(\d+)/i,
      // Structured text: "Overall Score: 7 out of 10"
      /overall\s*score[:\s]*(\d+)\s*(?:out\s*of|\/)\s*10/i,
      // Standalone number at start (common when API returns just "10" or "9" as reasoning)
      // Match: "10", "10.", "10 ", "10\n", etc.
      /^\s*(\d{1,2})(?:\s|\.|$)/,
      // Number followed by common words (e.g., "10 out of 10", "9/10")
      /^(\d{1,2})\s*(?:out\s*of|\/)\s*10/i,
      // "Rate from 1-10" response patterns
      /rate[:\s]*(\d{1,2})\s*(?:out\s*of|\/)?\s*10/i,
      // Very simple: just a number 0-10 at the start (for cases like "10" with nothing else)
      /^(\d{1,2})$/
    ];
    
    for (const pattern of patterns) {
      const match = judgment.match(pattern);
      if (match) {
        const score = parseInt(match[1]!, 10);
        if (score >= 0 && score <= 10) {
          return score;
        }
      }
    }
    
    // Try to infer from verdict language
    const lower = judgment.toLowerCase();
    if (lower.includes('excellent') || lower.includes('outstanding')) {
      return 9;
    }
    if (lower.includes('very good') || lower.includes('great')) {
      return 8;
    }
    if (lower.includes('good') || lower.includes('satisfactory')) {
      return 7;
    }
    if (lower.includes('fair') || lower.includes('adequate')) {
      return 6;
    }
    if (lower.includes('poor') || lower.includes('needs improvement')) {
      return 4;
    }
    if (lower.includes('fail') && !lower.includes('pass')) {
      return 3;
    }
    
    return null;
  }

  /**
   * Extract issues from judgment text
   */
  extractIssues(judgment: string): unknown[] {
    try {
      const jsonMatch = judgment.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.issues || [];
      }
    } catch (_error) {
      // Fall through to regex
    }

    const issues: string[] = [];
    const lines = judgment.split('\n');
    for (const line of lines) {
      if (line.match(/[-*]\s*(.+)/i) || line.match(/\d+\.\s*(.+)/i)) {
        issues.push(line.replace(/[-*]\s*|\d+\.\s*/i, '').trim());
      }
    }
    
    return issues;
  }

  /**
   * Extract assessment from judgment text
   */
  extractAssessment(judgment: string): string | null {
    try {
      const jsonMatch = judgment.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.assessment || null;
      }
    } catch (_error) {
      // Fall through to regex
    }

    const lower = judgment.toLowerCase();
    if (lower.includes('pass') && !lower.includes('fail')) {
      return 'pass';
    }
    if (lower.includes('fail')) {
      return 'fail';
    }
    
    return null;
  }

  /**
   * Build the validation result from API response data.
   * Handles semantic extraction, uncertainty, and cost recording.
   */
  async _buildResult({ judgment, data, logprobs, attempts, responseTime, imagePath, context, reviewOutcome = null, outputFormat = null, structuredOutput = null }: ReviewBuildInput): Promise<ValidationResult> {
    const isComparison = reviewOutcome?.kind === 'comparison';
    const semanticInfo = isComparison
      ? this.extractSemanticInfo({
          score: reviewOutcome.scores.B,
          issues: reviewOutcome.differences,
          assessment: reviewOutcome.winner,
          reasoning: reviewOutcome.reasoning,
          recommendations: [],
          strengths: []
        })
      : this.extractSemanticInfo(reviewOutcome || judgment);
    const testName = context.testType || context.step || 'unknown';

    // Uncertainty reduction (optional, lazy-loaded)
    let uncertainty = null, confidence = null;
    let selfConsistencyRecommended = false, selfConsistencyN = 0, selfConsistencyReason = '';

    if (context.enableUncertaintyReduction !== false) {
      try {
        const { enhanceWithUncertainty } = await import('./uncertainty-reducer.mjs');
        const enhanced = enhanceWithUncertainty({
          judgment, logprobs, attempts,
          screenshotPath: imagePath,
          score: semanticInfo.score,
          issues: semanticInfo.issues || []
        }, {
          enableHallucinationCheck: context.enableHallucinationCheck !== false,
          adaptiveSelfConsistency: context.adaptiveSelfConsistency !== false
        }, context);
        const enhancedRecord = enhanced as AnyRecord;
        uncertainty = enhancedRecord.uncertainty;
        confidence = enhancedRecord.confidence;
        selfConsistencyRecommended = enhancedRecord.selfConsistencyRecommended || false;
        selfConsistencyN = enhancedRecord.selfConsistencyN || 0;
        selfConsistencyReason = enhancedRecord.selfConsistencyReason || '';
      } catch (err: any) {
        if (this.config.debug.verbose) warn(`[VLLM] Uncertainty reduction failed: ${err.message}`);
      }
    }

    const estimatedCost = data ? this.estimateCost(data, this.provider) : null;

    // Log performance with actual cost data (fire-and-forget)
    this._logPerf({
      provider: this.provider, latency: responseTime, retries: attempts - 1,
      cost: estimatedCost?.totalCost || null, inputTokens: estimatedCost?.inputTokens || 0,
      outputTokens: estimatedCost?.outputTokens || 0, success: true, testName
    }, 'logAPICallPerformance');

    if (estimatedCost?.totalCost) {
      try {
        recordCost({ provider: this.provider, cost: estimatedCost.totalCost, inputTokens: estimatedCost.inputTokens || 0, outputTokens: estimatedCost.outputTokens || 0, testName });
        if (context.sessionId) {
          const { recordSessionCost } = await import('./session-cost-tracker.mjs');
          recordSessionCost(context.sessionId, { provider: this.provider, cost: estimatedCost.totalCost, inputTokens: estimatedCost.inputTokens || 0, outputTokens: estimatedCost.outputTokens || 0, testName });
        }
      } catch { /* cost tracking is optional */ }
    }

    return {
      enabled: true,
      kind: reviewOutcome?.kind || 'scalar',
      provider: this.provider,
      model: this.providerConfig.model,
      judgment,
      score: semanticInfo.score,
      issues: semanticInfo.issues,
      assessment: semanticInfo.assessment,
      reasoning: semanticInfo.reasoning,
      recommendations: semanticInfo.recommendations || [],
      richRecommendations: semanticInfo.richRecommendations || [],
      strengths: semanticInfo.strengths || [],
      pricing: this.providerConfig.pricing,
      estimatedCost,
      responseTime,
      timestamp: new Date().toISOString(),
      testName,
      viewport: context.viewport || null,
      captureMetadata: context.captureMetadata || null,
      raw: data || null,
      semantic: semanticInfo,
      dimensionScores: semanticInfo.dimensionScores || null,
      attempts: attempts || 1,
      logprobs,
      uncertainty,
      confidence,
      screenshotPath: imagePath,
      selfConsistencyRecommended,
      selfConsistencyN,
      selfConsistencyReason,
      outputFormat: outputFormat as ValidationResult['outputFormat'],
      structuredOutput: structuredOutput ? {
        mode: structuredOutput.mode,
        diagnostic: structuredOutput.diagnostic
      } : null,
      ...(isComparison ? {
        winner: reviewOutcome.winner,
        differences: reviewOutcome.differences,
        scores: reviewOutcome.scores,
        comparisonConfidence: reviewOutcome.confidence
      } : {})
    } as ValidationResult;
  }

  /**
   * Validate prompt length and security. Returns sanitized prompt.
   */
  _validateAndSanitizePrompt(prompt: string, context: JudgeContext): string {
    try {
      validatePrompt(prompt);
    } catch (err: any) {
      throw new ValidationError(`Invalid prompt: ${err.message}`);
    }

    const strictMode = context.strictPromptSecurity !== false;
    try {
      if (strictMode) {
        validatePromptSecurity(prompt, true);
      } else {
        prompt = sanitizePrompt(prompt, {
          systemPrefix: 'You are a UI evaluation assistant. User request:'
        });
      }
    } catch (err: any) {
      throw new ValidationError(`Prompt security violation: ${err.message}`);
    }
    return prompt;
  }

  /**
   * Validate and resolve image paths. Throws on invalid paths.
   */
  _validateImagePaths(imagePaths: string[]): void {
    const validExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
    for (const path of imagePaths) {
      try {
        if (path.startsWith('/') || path.startsWith(process.cwd())) {
          const resolved = resolve(path);
          if (!validExtensions.some(ext => resolved.toLowerCase().endsWith(ext))) {
            throw new ValidationError('Invalid image format. Supported: png, jpg, jpeg, gif, webp', path as any);
          }
        } else {
          validateImagePath(path);
        }
      } catch (err: any) {
        throw new FileError(`Invalid image path: ${err.message}`, basename(path));
      }
    }
  }

  /**
   * Fire-and-forget performance log. Dynamically imports performance-logger.
   * @param {Object} payload - Data to log
   * @param {string} method - Logger method name ('logAPICallPerformance' or 'logErrorPattern')
   */
  _logPerf(payload: AnyRecord, method: string): void {
    import('./utils/performance-logger.mjs')
      .then(m => (m as AnyRecord)[method](payload))
      .catch(() => {});
  }

  /**
   * Log cache hit/miss with optional session tracking. Fire-and-forget.
   */
  _logCacheResult(operation: 'hit' | 'miss', context: JudgeContext, cacheKey: string): void {
    const isHit = operation === 'hit';
    import('./cache.js').then((module: any) => {
      try {
        safeLogCacheOperation({ operation, hit: isHit, latency: 0, cacheSize: module.getCache().size, maxSize: 1000 });
      } catch { /* ignore */ }
    }).catch(() => {});

    if (isHit && this.config.debug.verbose) {
      log(`[VLLM] Cache hit for ${cacheKey}`);
    }

    if (context.sessionId) {
      const method = isHit ? 'recordSessionCacheHit' : 'recordSessionCacheMiss';
      import('./session-cost-tracker.mjs').then((m: any) => m[method](context.sessionId)).catch(() => {});
    }
  }

  /**
   * Route to the correct provider API method.
   */
  async _callProviderAPI(providerImages: ProviderInput | ProviderInput[], prompt: string, signal: AbortSignal, _isMultiImage: boolean, structuredOutput: StructuredOutputSpec | null = null): Promise<Response> {
    const images = Array.isArray(providerImages) ? providerImages : [providerImages];
    return this.providerAdapter.call({
      images,
      prompt,
      signal,
      apiKey: this.apiKey,
      config: this.providerConfig,
      structuredOutput,
    });
  }

  /**
   * Parse a provider API response: validate content-type, check for errors,
   * extract judgment text and logprobs.
   * @deprecated Internal compatibility wrapper. Provider parsing now belongs
   * to the selected adapter.
   */
  _parseProviderResponse(apiResponse: Response) {
    return this.providerAdapter.parseResponse(apiResponse);
  }

  /**
   * Call Google Gemini API
   * @deprecated Use the selected provider adapter through judgeScreenshot.
   *
   * @param {string | string[]} base64Images - Single image or array of images (base64)
   * @param {string} prompt - Evaluation prompt
   * @param {AbortSignal} signal - Abort signal for timeout
   * @param {boolean} [isMultiImage=false] - Whether this is a multi-image request
   * @returns {Promise<Response>} API response
   */
  async callGeminiAPI(base64Images: string | ProviderInput | Array<string | ProviderInput>, prompt: string, signal: AbortSignal, _isMultiImage = false, structuredOutput: StructuredOutputSpec | null = null): Promise<Response> {
    const inputs = Array.isArray(base64Images) ? base64Images : [base64Images];
    const images: ProviderInput[] = inputs.map(input => typeof input === 'string' ? { data: input, mime: 'image/png' as const } : input);
    return getProviderAdapter('gemini').call({
      images, prompt, signal, apiKey: this.apiKey,
      config: this.providerConfig, structuredOutput,
    });
  }

  /**
   * Call OpenAI API
   * @deprecated Use the selected provider adapter through judgeScreenshot.
   * 
   * @param {string | string[]} base64Images - Single image or array of images (base64)
   * @param {string} prompt - Evaluation prompt
   * @param {AbortSignal} signal - Abort signal for timeout
   * @param {boolean} [isMultiImage=false] - Whether this is a multi-image request
   * @returns {Promise<Response>} API response
   */
  async callOpenAIAPI(base64Images: string | ProviderInput | Array<string | ProviderInput>, prompt: string, signal: AbortSignal, _isMultiImage = false, structuredOutput: StructuredOutputSpec | null = null): Promise<Response> {
    const inputs = Array.isArray(base64Images) ? base64Images : [base64Images];
    const images: ProviderInput[] = inputs.map(input => typeof input === 'string' ? { data: input, mime: 'image/png' as const } : input);
    const provider = ['openai', 'groq', 'openrouter'].includes(this.provider) ? this.provider : 'openai';
    return getProviderAdapter(provider).call({
      images, prompt, signal, apiKey: this.apiKey,
      config: this.providerConfig, structuredOutput,
    });
  }

  /**
   * Call Anthropic Claude API
   * @deprecated Use the selected provider adapter through judgeScreenshot.
   * 
   * @param {string | string[]} base64Images - Single image or array of images (base64)
   * @param {string} prompt - Evaluation prompt
   * @param {AbortSignal} signal - Abort signal for timeout
   * @param {boolean} [isMultiImage=false] - Whether this is a multi-image request
   * @returns {Promise<Response>} API response
   */
  async callClaudeAPI(base64Images: string | ProviderInput | Array<string | ProviderInput>, prompt: string, signal: AbortSignal, _isMultiImage = false): Promise<Response> {
    const inputs = Array.isArray(base64Images) ? base64Images : [base64Images];
    const images: ProviderInput[] = inputs.map(input => typeof input === 'string' ? { data: input, mime: 'image/png' as const } : input);
    return getProviderAdapter('claude').call({
      images, prompt, signal, apiKey: this.apiKey,
      config: this.providerConfig, structuredOutput: null,
    });
  }

  /**
   * Estimate cost based on token usage
   */
  estimateCost(data: AnyRecord, provider: string): AnyRecord | null {
    if (!this.providerConfig.pricing || this.providerConfig.pricing.input === 0) {
      return null; // Free or self-hosted
    }
    
    const { inputTokens, outputTokens } = getProviderAdapter(provider).extractUsage(data);
    
    const inputCost = (inputTokens / 1_000_000) * this.providerConfig.pricing.input;
    const outputCost = (outputTokens / 1_000_000) * this.providerConfig.pricing.output;
    const totalCost = inputCost + outputCost;
    
    return {
      inputTokens,
      outputTokens,
      inputCost: inputCost.toFixed(6),
      outputCost: outputCost.toFixed(6),
      totalCost: totalCost.toFixed(6),
      currency: 'USD'
    };
  }
}

/** Execute the common provider call for an image-backed structured task. */
async function executeStructuredImageTask({
  judge, images, prompt, task, structuredOutput, context, signal, onAttempt,
}: {
  judge: VLLMJudge;
  images: ProviderInput[];
  prompt: string;
  task: any;
  structuredOutput: StructuredOutputSpec;
  context: JudgeContext;
  signal: AbortSignal;
  onAttempt?: (attempt: number) => void;
}) {
  const maxRetries = context.maxRetries ?? 3;
  return executeStructuredTask({
    adapter: judge.providerAdapter,
    call: {
      images,
      signal,
      apiKey: judge.apiKey,
      config: judge.providerConfig,
    },
    prompt,
    task,
    structuredOutput,
    maxRetries,
    baseDelay: context.retryBaseDelay ?? RETRY_CONSTANTS.DEFAULT_BASE_DELAY_MS,
    maxDelay: context.retryMaxDelay ?? RETRY_CONSTANTS.DEFAULT_MAX_DELAY_MS,
    ...(onAttempt ? { onAttempt } : {}),
    onRetry: (err, attempt, delay) => {
      judge._logPerf({ error: err, context: `API retry (${judge.provider})`, recovery: 'exponential_backoff', retryCount: attempt }, 'logErrorPattern');
      if (judge.config.debug.verbose) {
        warn(`[VLLM] Retry ${attempt}/${maxRetries} for ${judge.provider} API: ${err.message} (waiting ${delay}ms)`);
      }
    },
  });
}

function checkImageTaskRateLimit(judge: VLLMJudge, context: JudgeContext): void {
  if (context.enableRateLimit === false) return;
  try {
    const rateLimiter = getRateLimiter(context.rateLimitOptions || {});
    const estimatedCost = judge.providerConfig.pricing?.input
      ? (1000 / 1_000_000) * judge.providerConfig.pricing.input
      : 0;
    rateLimiter.checkLimit(estimatedCost);
  } catch (rateLimitError: any) {
    throw new ValidationError(`Rate limit exceeded: ${rateLimitError.message}`);
  }
}

async function runGameAction(judge: VLLMJudge, imagePath: string, prompt: string, context: JudgeContext): Promise<GameActionResult> {
  prompt = judge._validateAndSanitizePrompt(prompt, context);
  judge._validateImagePaths([imagePath]);
  if (!judge.enabled) {
    throw new ProviderError('Game action provider is disabled', judge.provider, {
      failureKind: 'disabled', retryable: false, imagePath: basename(imagePath), attempts: 0,
    });
  }

  const startTime = Date.now();
  const timeout = context.timeout || judge.config.performance.timeout;
  let attempts = 0;
  const task = createGameActionTask(context.legacyActionFallback !== false);
  const structuredOutput = resolveTaskStructuredOutput({
    provider: judge.provider, model: judge.providerConfig.model, taskName: task.name,
    schema: task.schema, enabled: context.structuredOutput !== false,
  });
  const fullPrompt = `${prompt}\n\nOUTPUT CONTRACT\nReturn only JSON matching this schema:\n${JSON.stringify(structuredOutput.schema)}`;
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), timeout);

  try {
    checkImageTaskRateLimit(judge, context);
    const result = await executeStructuredImageTask({
      judge,
      images: [judge.imageToProviderInput(imagePath)],
      prompt: fullPrompt,
      task,
      structuredOutput,
      context,
      signal: abortController.signal,
      onAttempt: attempt => { attempts = attempt; },
    });
    attempts = result.attempts;
    return {
      action: result.outcome as GameAction,
      outputFormat: result.format,
      diagnostics: result.diagnostics,
      attempts,
      provider: judge.provider,
      model: judge.providerConfig.model,
      structuredOutput: { mode: result.structuredOutput.mode, diagnostic: result.structuredOutput.diagnostic },
    };
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    judge._logPerf({ provider: judge.provider, latency: responseTime, retries: attempts - 1, success: false, error, testName: context.testType || context.step || 'game-action' }, 'logAPICallPerformance');
    judge._logPerf({ error, context: `API call (${judge.provider})`, recovery: 'retry_with_backoff', retryCount: attempts - 1, recovered: false }, 'logErrorPattern');
    if (error.name === 'AbortError' || error.message?.includes('timeout') || error.message?.includes('aborted')) {
      const enhancedMessage = enhanceErrorMessage(new TimeoutError(`VLLM API call timed out after ${timeout}ms`, timeout), attempts || 1, 'judgeGameAction');
      throw new TimeoutError(enhancedMessage, timeout, { provider: judge.provider, imagePath: basename(imagePath), attempts: attempts || 1 });
    }
    if (error instanceof ProviderError || error?.code === 'PROVIDER_ERROR') {
      const enhancedMessage = enhanceErrorMessage(error, attempts || 1, 'judgeGameAction');
      throw new ProviderError(enhancedMessage, judge.provider, {
        ...error.details, imagePath: basename(imagePath), prompt: prompt.substring(0, 100), attempts: attempts || 1,
      });
    }
    if (error instanceof FileError || error instanceof TimeoutError) throw error;
    const enhancedMessage = enhanceErrorMessage(error, attempts || 1, 'judgeGameAction');
    throw new ProviderError(`VLLM API call failed: ${enhancedMessage}`, judge.provider, {
      imagePath: basename(imagePath), prompt: prompt.substring(0, 100), attempts: attempts || 1, originalError: error.message,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Validate screenshot (convenience function)
 * 
 * Creates a judge instance and validates a screenshot.
 * 
 * Optional enhancements:
 * - `useTemporalDecision: true` - Use TemporalDecisionManager to conditionally skip visual reviews
 * - `useEnsemble: true` - Use EnsembleJudge for 10-20% accuracy improvement
 * - `autoSelectTier: true` - Select model tier based on context (cost optimization)
 * - `autoSelectProvider: true` - Select cheapest provider (cost optimization)
 * - `includeCostComparison: true` - Include cost comparison across tiers in result
 * 
 * @param {string} imagePath - Path to screenshot
 * @param {string} prompt - Evaluation prompt
 * @param {import('#public-contract').ValidationContext} [context={}] - Validation context
 * @param {boolean} [context.useTemporalDecision] - Use TemporalDecisionManager (reduces LLM calls)
 * @param {boolean} [context.useEnsemble] - Use EnsembleJudge (improves accuracy)
 * @param {boolean} [context.autoSelectTier] - Select model tier
 * @param {boolean} [context.autoSelectProvider] - Auto-select cheapest provider
 * @param {boolean} [context.includeCostComparison] - Include cost comparison in result
 * @returns {Promise<import('#public-contract').ValidationResult>} Validation result
 */
export async function validateScreenshot(imagePath: ImagePath, prompt: string, context: JudgeContext = {}): Promise<ValidationResult> {
  // Auto-select tier if requested (cost optimization)
  if (context.autoSelectTier) {
    try {
      const { selectModelTier } = await import('./model-tier-selector.js');
      const tier = selectModelTier(context);
      // Merge tier into context for config creation
      context = {
        ...context,
        modelTier: tier as NonNullable<ValidationContext['modelTier']>
      } as JudgeContext;
      if (context.debug?.verbose) {
        log(`[VLLM] Auto-selected tier: ${tier} based on context`);
      }
    } catch (error: any) {
      // Silently fail - auto-select is optional enhancement
      if (context.debug?.verbose) {
        warn(`[VLLM] Auto-tier selection failed: ${error.message}`);
      }
    }
  }

  // Auto-select provider if requested (cost optimization)
  if (context.autoSelectProvider) {
    try {
      const { selectProvider } = await import('./model-tier-selector.js');
      const provider = selectProvider({
        speed: context.speed,
        quality: context.quality,
        costSensitive: context.costSensitive,
        env: process.env
      });
      context = {
        ...context,
        provider
      };
      if (context.debug?.verbose) {
        log(`[VLLM] Auto-selected provider: ${provider}`);
      }
    } catch (error: any) {
      // Silently fail - auto-select is optional enhancement
      if (context.debug?.verbose) {
        warn(`[VLLM] Auto-provider selection failed: ${error.message}`);
      }
    }
  }

  // Ensemble Judge: Multiple LLM judges with consensus voting
  // Research: arXiv:2510.01499 - Optimal ensemble weighting improves accuracy by 10-20%
  if (context.useEnsemble) {
    try {
      const { createEnsembleJudge } = await import('#ensemble-judge');
      const providers = context.ensembleProviders || ['gemini', 'openai'];
      const ensemble = createEnsembleJudge(providers, context.ensembleOptions || {});
      const startTime = Date.now();
      const result = await ensemble.evaluate(imagePath as string, prompt, context);
      const latency = Date.now() - startTime;
      
      return result as unknown as ValidationResult;
    } catch (error: any) {
      // If EnsembleJudge fails, fall back to single judge (graceful degradation)
      if (context.debug?.verbose) {
        log(`[VLLM] EnsembleJudge error: ${error.message}, falling back to single judge`);
      }
    }
  }

  const judge = new VLLMJudge(context);
  const result = await judge.judgeScreenshot(imagePath, prompt, context);
  
  // Enhance result with cost comparison if requested
  if (context.includeCostComparison && result.estimatedCost) {
    try {
      const { calculateCostComparison } = await import('./cost-optimization.js');
      result.costComparison = calculateCostComparison(context, result);
    } catch (error: any) {
      // Silently fail - cost comparison is optional
      if (context.debug?.verbose) {
        warn(`[VLLM] Cost comparison failed: ${error.message}`);
      }
    }
  }
  
  return result;
}

/**
 * Internal game-action entry point. It is intentionally not re-exported from
 * the package root or game route while that public API is still legacy JS.
 */
export async function judgeGameAction(imagePath: string, prompt: string, context: JudgeContext = {}): Promise<GameActionResult> {
  return runGameAction(new VLLMJudge(context), imagePath, prompt, context);
}
