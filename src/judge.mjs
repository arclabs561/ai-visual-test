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

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname, basename, resolve } from 'path';
import { fileURLToPath } from 'url';
import { createConfig, getConfig } from './config.mjs';
import { getCached, setCached } from './cache.mjs';
import { FileError, ProviderError, TimeoutError, ValidationError } from './errors.mjs';
import { log, warn } from './logger.mjs';
import { evaluateTemporalDecision } from './temporal-prompt-formatting.mjs';
import { recordCost } from './cost-tracker.mjs';
import { normalizeValidationResult } from './validation-result-normalizer.mjs';
import { validateImagePath, validatePrompt } from './validation.mjs';
import { sanitizePrompt, validatePromptSecurity } from './utils/prompt-sanitizer.mjs';
import { getRateLimiter } from './utils/rate-limiter.mjs';
import { RETRY_CONSTANTS, API_CONSTANTS } from './constants.mjs';
import { retryWithBackoff, enhanceErrorMessage } from './retry.mjs';
import { safeLogCacheOperation } from './safe-logger.mjs';
import { composeSingleImagePrompt, composeComparisonPrompt } from './prompt-composer.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Clamp a score to [0, 10] or null. */
function _clampScore(raw) {
  if (raw == null || typeof raw !== 'number' || isNaN(raw)) return null;
  return Math.max(0, Math.min(10, raw));
}

/**
 * VLLM Judge Class
 *
 * Handles screenshot validation using Vision Language Models.
 */
export class VLLMJudge {
  constructor(options = {}) {
    this.config = createConfig(options);
    this.provider = this.config.provider;
    this.apiKey = this.config.apiKey;
    this.providerConfig = this.config.providerConfig;
    this.enabled = this.config.enabled;
    this._cacheInitialized = false;
  }

  /**
   * Initialize cache (lazy initialization)
   */
  async _initCache() {
    if (this._cacheInitialized || !this.config.cache.enabled) return;
    
    if (this.config.cache.dir) {
      const { initCache } = await import('./cache.mjs');
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
  imageToBase64(imagePath) {
    // Validate and resolve path before file operations
    // Note: imagePath may already be validated/resolved from judgeScreenshot
    let validatedPath;
    try {
      // All paths go through validateImagePath for traversal + extension checks.
      // Absolute paths use their own directory as baseDir so the "within base"
      // check passes, while still validating extension and normalizing.
      if (imagePath.startsWith('/')) {
        validatedPath = validateImagePath(basename(imagePath), { baseDir: dirname(resolve(imagePath)) });
      } else {
        validatedPath = validateImagePath(imagePath);
      }
    } catch (validationError) {
      throw new FileError(`Invalid image path: ${validationError.message}`, basename(imagePath));
    }
    
    if (!existsSync(validatedPath)) {
      throw new FileError(`Screenshot not found: ${basename(validatedPath)}`, basename(validatedPath));
    }
    try {
      const imageBuffer = readFileSync(validatedPath);

      // Enforce size limit to prevent OOM from oversized images
      if (imageBuffer.length > API_CONSTANTS.MAX_IMAGE_SIZE) {
        const sizeMB = (imageBuffer.length / (1024 * 1024)).toFixed(1);
        const limitMB = (API_CONSTANTS.MAX_IMAGE_SIZE / (1024 * 1024)).toFixed(0);
        throw new FileError(`Image too large: ${sizeMB}MB (limit: ${limitMB}MB)`, basename(validatedPath));
      }

      // SECURITY: Validate image format using magic bytes
      this._validateImageFormat(imageBuffer, validatedPath);

      return imageBuffer.toString('base64');
    } catch (error) {
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
  _validateImageFormat(buffer, filePath) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 4) {
      throw new ValidationError('Invalid image file: file too small or not a buffer', basename(filePath));
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
    throw new ValidationError(
      'Invalid image format: file signature does not match supported formats (PNG, JPEG, GIF, WebP)',
      basename(filePath),
      {
        detectedSignature: Array.from(buffer.slice(0, 4)).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' ')
      }
    );
  }

  /**
   * Resolve anchor images from config and per-call context into base64.
   * Returns { images: string[], count: { positive: number, negative: number } }
   * so the prompt composer can label them.
   *
   * AnchorEntry images can be:
   *   - A file path (resolved via imageToBase64)
   *   - A data URI ("data:image/png;base64,...") -- base64 extracted directly
   *   - A raw base64 string (no path separators, length > 100)
   *
   * @param {import('./index.mjs').ValidationContext} context
   * @returns {{ images: string[], count: { positive: number, negative: number } }}
   */
  _resolveAnchorImages(context) {
    const configAnchors = this.config.anchors || {};
    const ctxAnchors = context.anchors || {};

    // Extract image refs from AnchorEntry arrays (mixed string + object entries)
    const extractImageRefs = (entries) => {
      if (!Array.isArray(entries)) return [];
      return entries
        .filter(e => typeof e === 'object' && e !== null && e.image)
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

    const images = [];
    let positiveCount = 0;
    let negativeCount = 0;

    const resolveImage = (ref) => {
      // Data URI: extract base64 payload
      if (ref.startsWith('data:image/')) {
        const commaIdx = ref.indexOf(',');
        if (commaIdx > 0) return ref.slice(commaIdx + 1);
      }
      // Looks like raw base64 (no path separators, long enough)
      if (!ref.includes('/') && !ref.includes('\\') && ref.length > 100) {
        return ref;
      }
      // File path: read and convert
      return this.imageToBase64(ref);
    };

    for (const ref of positiveRefs) {
      try {
        images.push(resolveImage(ref));
        positiveCount++;
      } catch (err) {
        warn(`[VLLM] Skipping positive anchor image ${ref.slice(0, 80)}: ${err.message}`);
      }
    }

    for (const ref of negativeRefs) {
      try {
        images.push(resolveImage(ref));
        negativeCount++;
      } catch (err) {
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
   * @param {import('./index.mjs').ValidationContext} [context={}] - Validation context
   * @returns {Promise<import('./index.mjs').ValidationResult>} Validation result
   */
  async judgeScreenshot(imagePath, prompt, context = {}) {
    prompt = this._validateAndSanitizePrompt(prompt, context);
    const imagePaths = Array.isArray(imagePath) ? imagePath : [imagePath];
    this._validateImagePaths(imagePaths);
    const isMultiImage = imagePaths.length > 1;
    if (!this.enabled) {
      // Return normalized disabled result
      return normalizeValidationResult({
        enabled: false,
        provider: this.provider,
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
      return temporalResult;
    }

    // Initialize cache if needed
    await this._initCache();
    
    // Check cache first (if caching enabled)
    const useCache = context.useCache !== false && this.config.cache.enabled;
    if (useCache) {
      // Use original paths for cache key (before validation/resolution)
      const cacheKey = isMultiImage ? imagePaths.join('|') : imagePath;
      const cached = getCached(cacheKey, prompt, context);
      this._logCacheResult(cached ? 'hit' : 'miss', context, cacheKey);
      if (cached) {
        return { ...cached, cached: true };
      }
    }

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
        } catch (rateLimitError) {
          throw new ValidationError(`Rate limit exceeded: ${rateLimitError.message}`);
        }
      }
      
      // Resolve anchor images (config-level + per-call), then the evaluation target(s)
      // Order: [positive examples] [negative examples] [target screenshot(s)]
      // The prompt text labels which images are references vs. evaluation targets
      const anchorImages = this._resolveAnchorImages(context);
      const targetImages = imagePaths.map(path => this.imageToBase64(path));
      const base64Images = [...anchorImages.images, ...targetImages];
      const fullPrompt = await this.buildPrompt(prompt, {
        ...context,
        _anchorImageCount: anchorImages.count
      }, isMultiImage);
      
      // Retry API calls with exponential backoff
      const maxRetries = context.maxRetries ?? 3;
      const apiResult = await retryWithBackoff(async () => {
        attempts++;
        let apiResponse;
        let apiData;
        let logprobs = null; // Declare once outside switch
        
        // Call the appropriate API and parse the response
        apiResponse = await this._callProviderAPI(base64Images, fullPrompt, abortController.signal, isMultiImage);
        clearTimeout(timeoutId);
        return this._parseProviderResponse(apiResponse);
      }, {
        maxRetries,
        baseDelay: RETRY_CONSTANTS.DEFAULT_BASE_DELAY_MS,
        maxDelay: RETRY_CONSTANTS.DEFAULT_MAX_DELAY_MS,
        onRetry: (err, attempt, delay) => {
          // Log retry attempts (weighted: retries are important for debugging)
          // Use dynamic import with proper error handling to prevent unhandled promise rejections
          import('./utils/performance-logger.mjs')
            .then(({ logErrorPattern }) => {
              logErrorPattern({
                error: err,
                context: `API retry (${this.provider})`,
                recovery: 'exponential_backoff',
                retryCount: attempt
              });
            })
            .catch((importError) => {
              // Log to console if performance logger unavailable (better than silent failure)
              if (this.config.debug.verbose) {
                warn(`[VLLM] Performance logger unavailable: ${importError.message}`);
              }
            });
          
          if (this.config.debug.verbose) {
            warn(`[VLLM] Retry ${attempt}/${maxRetries} for ${this.provider} API: ${err.message} (waiting ${delay}ms)`);
          }
        }
      });
      
      judgment = apiResult.judgment;
      data = apiResult.data;
      const logprobs = apiResult.logprobs || null;
      
      const responseTime = Date.now() - startTime;
      
      // Log API call performance (weighted: always log for critical paths)
      // Use dynamic import with proper error handling to prevent unhandled promise rejections
      import('./utils/performance-logger.mjs')
        .then(({ logAPICallPerformance }) => {
          logAPICallPerformance({
            provider: this.provider,
            latency: responseTime,
            retries: attempts - 1,
            cost: estimatedCost?.totalCost || null,
            inputTokens: estimatedCost?.inputTokens || 0,
            outputTokens: estimatedCost?.outputTokens || 0,
            success: true,
            testName: context.testType || context.step || 'unknown'
          });
        })
        .catch((importError) => {
          // Log to console if performance logger unavailable (better than silent failure)
          if (this.config.debug.verbose) {
            warn(`[VLLM] Performance logger unavailable: ${importError.message}`);
          }
        });
      
      const validationResult = await this._buildResult(
        { judgment, data, logprobs, attempts, responseTime, imagePath, context }
      );

      if (useCache) {
        const cacheKey = isMultiImage ? imagePaths.join('|') : imagePath;
        setCached(cacheKey, prompt, context, validationResult);
      }

      return normalizeValidationResult(validationResult, 'judgeScreenshot');
    } catch (err) {
      clearTimeout(timeoutId);
      error = err;
      responseTime = Date.now() - startTime;
      
      // Log API call failure (weighted: always log errors)
      // Use dynamic import without await (fire-and-forget logging)
      import('./utils/performance-logger.mjs').then(({ logAPICallPerformance, logErrorPattern }) => {
        logAPICallPerformance({
          provider: this.provider,
          latency: responseTime,
          retries: attempts - 1,
          success: false,
          error: err,
          testName: context.testType || context.step || 'unknown'
        });
        logErrorPattern({
          error: err,
          context: `API call (${this.provider})`,
          recovery: 'retry_with_backoff',
          retryCount: attempts - 1,
          recovered: false
        });
      })
        .catch((importError) => {
          // Log to console if performance logger unavailable (better than silent failure)
          if (this.config.debug.verbose) {
            warn(`[VLLM] Performance logger unavailable: ${importError.message}`);
          }
        });
      
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
   * @param {import('./index.mjs').ValidationContext} context - Validation context
   * @param {boolean} [isMultiImage=false] - Whether this is a multi-image comparison
   * @returns {string} Full prompt with context
   */
  async buildPrompt(prompt, context = {}, isMultiImage = false) {
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
        });
      } else {
        return await composeSingleImagePrompt(prompt, context, {
          includeRubric: context.includeRubric !== false, // Default true (research-backed)
          temporalNotes: context.temporalNotes || null,
          anchors: composerAnchors
        });
      }
    } catch (error) {
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
        contextParts.push(`Viewport: ${context.viewport.width}x${context.viewport.height}`);
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
  "winner": "A" | "B" | "tie",
  "confidence": 0.0-1.0,
  "reasoning": "explanation",
  "differences": ["difference1", "difference2"],
  "scores": {"A": 0-10, "B": 0-10}
}`;
      }
      return fullPrompt;
    }
  }

  /**
   * Extract semantic information from judgment text
   */
  extractSemanticInfo(judgment) {
    // Handle case where judgment is already an object
    if (typeof judgment === 'object' && judgment !== null && !Array.isArray(judgment)) {
      // Normalize issues: handle both array of strings and array of objects
      let issues = judgment.issues || [];
      if (issues.length > 0 && typeof issues[0] === 'string') {
        // Convert string array to object array for consistency
        issues = issues.map(desc => ({
          description: desc,
          importance: 'medium',
          annoyance: 'medium',
          impact: 'minor-inconvenience'
        }));
      }
      
      // Normalize recommendations: handle both array of strings and array of objects
      let recommendations = judgment.recommendations || [];
      if (recommendations.length > 0 && typeof recommendations[0] === 'string') {
        recommendations = recommendations.map(suggestion => ({
          priority: 'medium',
          suggestion,
          expectedImpact: 'improved user experience'
        }));
      }
      
      return {
        score: _clampScore(judgment.score),
        issues: issues,
        assessment: judgment.assessment || null,
        reasoning: judgment.reasoning || null,
        strengths: judgment.strengths || [],
        recommendations: recommendations,
        evidence: judgment.evidence || null,
        dimensionScores: judgment.dimensionScores || null,
        brutalistViolations: judgment.brutalistViolations || [],
        zeroToleranceViolations: judgment.zeroToleranceViolations || []
      };
    }

    // Handle case where judgment is a string
    const judgmentText = typeof judgment === 'string' ? judgment : String(judgment || '');

    try {
      const jsonMatch = judgmentText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        // Normalize issues and recommendations
        let issues = parsed.issues || [];
        if (issues.length > 0 && typeof issues[0] === 'string') {
          issues = issues.map(desc => ({
            description: desc,
            importance: 'medium',
            annoyance: 'medium',
            impact: 'minor-inconvenience'
          }));
        }

        let recommendations = parsed.recommendations || [];
        if (recommendations.length > 0 && typeof recommendations[0] === 'string') {
          recommendations = recommendations.map(suggestion => ({
            priority: 'medium',
            suggestion,
            expectedImpact: 'improved user experience'
          }));
        }

        return {
          score: _clampScore(parsed.score),
          issues: issues,
          assessment: parsed.assessment || null,
          reasoning: parsed.reasoning || null,
          strengths: parsed.strengths || [],
          recommendations: recommendations,
          evidence: parsed.evidence || null,
          dimensionScores: parsed.dimensionScores || null,
          brutalistViolations: parsed.brutalistViolations || [],
          zeroToleranceViolations: parsed.zeroToleranceViolations || []
        };
      }
    } catch (e) {
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
      dimensionScores: this.extractDimensionScores(judgmentText),
    };
  }

  /**
   * Extract dimension scores from free-text VLM responses.
   * Matches patterns like "GAME AUTHENTICITY: 8/10" or "game_authenticity: 8"
   * or JSON-like "game_authenticity": 8.
   */
  extractDimensionScores(text) {
    if (!text || typeof text !== 'string') return null;

    // Try embedded JSON first: "dimensionScores": { ... }
    const jsonMatch = text.match(/"dimensionScores"\s*:\s*\{([^}]+)\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(`{${jsonMatch[1]}}`);
      } catch { /* fall through */ }
    }

    // Regex: "DIMENSION_NAME: N/10" or "dimension_name: N"
    const scores = {};
    // Match "WORD WORD: N/10" or "word_word: N/10" patterns
    const pattern = /(?:^|\n)\s*(?:\d+\.\s*)?[*]*([A-Z][A-Z_ &]+)[*]*\s*:\s*(\d+)\s*(?:\/\s*10)?/gm;
    for (const match of text.matchAll(pattern)) {
      const name = match[1].trim().toLowerCase().replace(/[& ]+/g, '_');
      const value = parseInt(match[2], 10);
      if (value >= 0 && value <= 10) {
        scores[name] = value;
      }
    }

    return Object.keys(scores).length > 0 ? scores : null;
  }

  /**
   * Extract score from judgment text
   */
  extractScore(judgment) {
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
        const score = parseInt(match[1]);
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
  extractIssues(judgment) {
    try {
      const jsonMatch = judgment.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.issues || [];
      }
    } catch (e) {
      // Fall through to regex
    }

    const issues = [];
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
  extractAssessment(judgment) {
    try {
      const jsonMatch = judgment.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.assessment || null;
      }
    } catch (e) {
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
  async _buildResult({ judgment, data, logprobs, attempts, responseTime, imagePath, context }) {
    const semanticInfo = this.extractSemanticInfo(judgment);
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
        uncertainty = enhanced.uncertainty;
        confidence = enhanced.confidence;
        selfConsistencyRecommended = enhanced.selfConsistencyRecommended || false;
        selfConsistencyN = enhanced.selfConsistencyN || 0;
        selfConsistencyReason = enhanced.selfConsistencyReason || '';
      } catch (err) {
        if (this.config.debug.verbose) warn(`[VLLM] Uncertainty reduction failed: ${err.message}`);
      }
    }

    // Cost estimation and recording
    const estimatedCost = data ? this.estimateCost(data, this.provider) : null;
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
      provider: this.provider,
      judgment,
      score: semanticInfo.score,
      issues: semanticInfo.issues,
      assessment: semanticInfo.assessment,
      reasoning: semanticInfo.reasoning,
      recommendations: semanticInfo.recommendations || [],
      strengths: semanticInfo.strengths || [],
      pricing: this.providerConfig.pricing,
      estimatedCost,
      responseTime,
      timestamp: new Date().toISOString(),
      testName,
      viewport: context.viewport || null,
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
      selfConsistencyReason
    };
  }

  /**
   * Validate prompt length and security. Returns sanitized prompt.
   */
  _validateAndSanitizePrompt(prompt, context) {
    try {
      validatePrompt(prompt);
    } catch (err) {
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
    } catch (err) {
      throw new ValidationError(`Prompt security violation: ${err.message}`);
    }
    return prompt;
  }

  /**
   * Validate and resolve image paths. Throws on invalid paths.
   */
  _validateImagePaths(imagePaths) {
    const validExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
    for (const path of imagePaths) {
      try {
        if (path.startsWith('/') || path.startsWith(process.cwd())) {
          const resolved = resolve(path);
          if (!validExtensions.some(ext => resolved.toLowerCase().endsWith(ext))) {
            throw new ValidationError('Invalid image format. Supported: png, jpg, jpeg, gif, webp', path);
          }
        } else {
          validateImagePath(path);
        }
      } catch (err) {
        throw new FileError(`Invalid image path: ${err.message}`, basename(path));
      }
    }
  }

  /**
   * Log cache hit/miss with optional session tracking. Fire-and-forget.
   */
  _logCacheResult(operation, context, cacheKey) {
    const isHit = operation === 'hit';
    import('./cache.mjs').then(({ getCache }) => {
      try {
        safeLogCacheOperation({ operation, hit: isHit, latency: 0, cacheSize: getCache().size, maxSize: 1000 });
      } catch { /* ignore */ }
    }).catch(() => {});

    if (isHit && this.config.debug.verbose) {
      log(`[VLLM] Cache hit for ${cacheKey}`);
    }

    if (context.sessionId) {
      const method = isHit ? 'recordSessionCacheHit' : 'recordSessionCacheMiss';
      import('./session-cost-tracker.mjs').then(m => m[method](context.sessionId)).catch(() => {});
    }
  }

  /**
   * Route to the correct provider API method.
   */
  async _callProviderAPI(base64Images, prompt, signal, isMultiImage) {
    switch (this.provider) {
      case 'gemini':
        return this.callGeminiAPI(base64Images, prompt, signal, isMultiImage);
      case 'openai':
      case 'groq':
      case 'openrouter':
        return this.callOpenAIAPI(base64Images, prompt, signal, isMultiImage);
      case 'claude':
        return this.callClaudeAPI(base64Images, prompt, signal, isMultiImage);
      default:
        throw new ProviderError(`Unknown provider: ${this.provider}`, this.provider);
    }
  }

  /**
   * Parse a provider API response: validate content-type, check for errors,
   * extract judgment text and logprobs.
   */
  _parseProviderResponse(apiResponse) {
    const ct = apiResponse.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      const statusCode = apiResponse.status;
      return apiResponse.text().then(text => {
        throw new ProviderError(
          `${this.provider} API returned non-JSON response (${ct}). Status: ${statusCode}. Check API key or endpoint.`,
          this.provider,
          { statusCode, contentType: ct, responsePreview: text.substring(0, 200), retryable: false }
        );
      });
    }

    return apiResponse.json().then(apiData => {
      if (apiData.error) {
        const statusCode = apiResponse.status;
        throw new ProviderError(
          `${this.provider} API error: ${apiData.error.message || 'Unknown error'}`,
          this.provider,
          { apiError: apiData.error, statusCode, retryable: statusCode === 429 || statusCode >= 500 }
        );
      }

      // Extract judgment text and logprobs per provider response format
      if (this.provider === 'gemini') {
        return {
          judgment: apiData.candidates?.[0]?.content?.parts?.[0]?.text || 'No response',
          data: apiData,
          logprobs: apiData.candidates?.[0]?.content?.parts?.[0]?.logprobs || null
        };
      }
      if (this.provider === 'claude') {
        return {
          judgment: apiData.content?.[0]?.text || 'No response',
          data: apiData,
          logprobs: null
        };
      }
      // OpenAI, Groq, OpenRouter (all OpenAI-compatible)
      return {
        judgment: apiData.choices?.[0]?.message?.content || 'No response',
        data: apiData,
        logprobs: apiData.choices?.[0]?.logprobs || null
      };
    });
  }

  /**
   * Call Google Gemini API
   *
   * @param {string | string[]} base64Images - Single image or array of images (base64)
   * @param {string} prompt - Evaluation prompt
   * @param {AbortSignal} signal - Abort signal for timeout
   * @param {boolean} [isMultiImage=false] - Whether this is a multi-image request
   * @returns {Promise<Response>} API response
   */
  async callGeminiAPI(base64Images, prompt, signal, isMultiImage = false) {
    const images = Array.isArray(base64Images) ? base64Images : [base64Images];
    
    // Build parts array: text prompt + all images
    const parts = [{ text: prompt }];
    for (const base64Image of images) {
      parts.push({
        inline_data: {
          mime_type: 'image/png',
          data: base64Image
        }
      });
    }
    
    // SECURITY: Use header for API key, not URL parameter
    // API keys in URLs are exposed in logs, browser history, referrer headers
    return fetch(
      `${this.providerConfig.apiUrl}/models/${this.providerConfig.model}:generateContent`,
      {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey  // Use header instead of URL parameter
        },
        signal,
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: API_CONSTANTS.DEFAULT_TEMPERATURE,
            maxOutputTokens: API_CONSTANTS.DEFAULT_MAX_OUTPUT_TOKENS,
            topP: API_CONSTANTS.DEFAULT_TOP_P,
            topK: 40
          }
        })
      }
    );
  }

  /**
   * Call OpenAI API
   * 
   * @param {string | string[]} base64Images - Single image or array of images (base64)
   * @param {string} prompt - Evaluation prompt
   * @param {AbortSignal} signal - Abort signal for timeout
   * @param {boolean} [isMultiImage=false] - Whether this is a multi-image request
   * @returns {Promise<Response>} API response
   */
  async callOpenAIAPI(base64Images, prompt, signal, isMultiImage = false) {
    const images = Array.isArray(base64Images) ? base64Images : [base64Images];
    
    // Build content array: text prompt + all images
    const content = [{ type: 'text', text: prompt }];
    for (const base64Image of images) {
      content.push({
        type: 'image_url',
        image_url: { url: `data:image/png;base64,${base64Image}` }
      });
    }
    
    return fetch(`${this.providerConfig.apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      signal,
      body: JSON.stringify({
        model: this.providerConfig.model,
        messages: [{
          role: 'user',
          content
        }],
        // Some OpenAI models have limited parameter support
        // Models that only support default temperature (1): gpt-4o-mini, gpt-5
        // Models that support custom temperature: gpt-4o, gpt-4-turbo, etc.
        // Only include temperature if model supports custom values (omit for models that require default)
        ...(this.providerConfig.model.includes('mini') || this.providerConfig.model.includes('gpt-5')
          ? {} // Use default temperature (1) - don't specify for models that require it
          : { temperature: API_CONSTANTS.DEFAULT_TEMPERATURE, top_p: API_CONSTANTS.DEFAULT_TOP_P } // Custom values for models that support them
        ),
        // Use max_completion_tokens for newer models (gpt-4o, gpt-5), max_tokens for older models
        ...(this.providerConfig.model.startsWith('gpt-4o') || this.providerConfig.model.startsWith('gpt-5')
          ? { max_completion_tokens: API_CONSTANTS.DEFAULT_MAX_OUTPUT_TOKENS }
          : { max_tokens: API_CONSTANTS.DEFAULT_MAX_OUTPUT_TOKENS })
        // Note: logprobs removed - not all OpenAI models support it (e.g., vision models)
        // If needed, can be conditionally added based on model support
      })
    });
  }

  /**
   * Call Anthropic Claude API
   * 
   * @param {string | string[]} base64Images - Single image or array of images (base64)
   * @param {string} prompt - Evaluation prompt
   * @param {AbortSignal} signal - Abort signal for timeout
   * @param {boolean} [isMultiImage=false] - Whether this is a multi-image request
   * @returns {Promise<Response>} API response
   */
  async callClaudeAPI(base64Images, prompt, signal, isMultiImage = false) {
    const images = Array.isArray(base64Images) ? base64Images : [base64Images];
    
    // Build content array: text prompt + all images
    const content = [{ type: 'text', text: prompt }];
    for (const base64Image of images) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/png',
          data: base64Image
        }
      });
    }
    
    return fetch(`${this.providerConfig.apiUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      signal,
      body: JSON.stringify({
        model: this.providerConfig.model,
        max_tokens: API_CONSTANTS.DEFAULT_MAX_OUTPUT_TOKENS,
        messages: [{
          role: 'user',
          content
        }]
      })
    });
  }

  /**
   * Estimate cost based on token usage
   */
  estimateCost(data, provider) {
    if (!this.providerConfig.pricing || this.providerConfig.pricing.input === 0) {
      return null; // Free or self-hosted
    }
    
    let inputTokens, outputTokens;
    if (provider === 'gemini') {
      inputTokens = data.usageMetadata?.promptTokenCount || 0;
      outputTokens = data.usageMetadata?.candidatesTokenCount || 0;
    } else if (provider === 'claude') {
      inputTokens = data.usage?.input_tokens || 0;
      outputTokens = data.usage?.output_tokens || 0;
    } else {
      // OpenAI, Groq, OpenRouter (all OpenAI-compatible)
      inputTokens = data.usage?.prompt_tokens || 0;
      outputTokens = data.usage?.completion_tokens || 0;
    }
    
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

/**
 * Validate screenshot (convenience function)
 * 
 * Creates a judge instance and validates a screenshot.
 * 
 * Optional enhancements:
 * - `useTemporalDecision: true` - Use TemporalDecisionManager to reduce LLM calls by 98.5%
 * - `useEnsemble: true` - Use EnsembleJudge for 10-20% accuracy improvement
 * - `autoSelectTier: true` - Select model tier based on context (cost optimization)
 * - `autoSelectProvider: true` - Select cheapest provider (cost optimization)
 * - `includeCostComparison: true` - Include cost comparison across tiers in result
 * 
 * @param {string} imagePath - Path to screenshot
 * @param {string} prompt - Evaluation prompt
 * @param {import('./index.mjs').ValidationContext} [context={}] - Validation context
 * @param {boolean} [context.useTemporalDecision] - Use TemporalDecisionManager (reduces LLM calls)
 * @param {boolean} [context.useEnsemble] - Use EnsembleJudge (improves accuracy)
 * @param {boolean} [context.autoSelectTier] - Select model tier
 * @param {boolean} [context.autoSelectProvider] - Auto-select cheapest provider
 * @param {boolean} [context.includeCostComparison] - Include cost comparison in result
 * @returns {Promise<import('./index.mjs').ValidationResult>} Validation result
 */
export async function validateScreenshot(imagePath, prompt, context = {}) {
  // Auto-select tier if requested (cost optimization)
  if (context.autoSelectTier) {
    try {
      const { selectModelTier } = await import('./model-tier-selector.mjs');
      const tier = selectModelTier(context);
      // Merge tier into context for config creation
      context = {
        ...context,
        modelTier: tier
      };
      if (context.debug?.verbose) {
        log(`[VLLM] Auto-selected tier: ${tier} based on context`);
      }
    } catch (error) {
      // Silently fail - auto-select is optional enhancement
      if (context.debug?.verbose) {
        warn(`[VLLM] Auto-tier selection failed: ${error.message}`);
      }
    }
  }

  // Auto-select provider if requested (cost optimization)
  if (context.autoSelectProvider) {
    try {
      const { selectProvider } = await import('./model-tier-selector.mjs');
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
    } catch (error) {
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
      const { createEnsembleJudge } = await import('./ensemble-judge.mjs');
      const providers = context.ensembleProviders || ['gemini', 'openai'];
      const ensemble = createEnsembleJudge(providers, context.ensembleOptions || {});
      const startTime = Date.now();
      const result = await ensemble.judge(imagePath, prompt, context);
      const latency = Date.now() - startTime;
      
      return result;
    } catch (error) {
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
      const { calculateCostComparison } = await import('./cost-optimization.mjs');
      result.costComparison = calculateCostComparison(context, result);
    } catch (error) {
      // Silently fail - cost comparison is optional
      if (context.debug?.verbose) {
        warn(`[VLLM] Cost comparison failed: ${error.message}`);
      }
    }
  }
  
  return result;
}
