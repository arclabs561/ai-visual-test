/**
 * Prompt Sanitization Utilities
 * 
 * Provides prompt sanitization and injection detection to prevent prompt injection attacks.
 * All user-provided prompts should be sanitized before being sent to LLM APIs.
 */

import { ValidationError } from '#errors';

/**
 * Common prompt injection patterns to detect
 */
const INJECTION_PATTERNS = [
  // System prompt override attempts
  /ignore\s+(all\s+)?(previous|prior|earlier)\s+(instructions?|prompts?|directives?)/gi,
  /forget\s+(all\s+)?(previous|prior|earlier)\s+(instructions?|prompts?|directives?)/gi,
  /disregard\s+(all\s+)?(previous|prior|earlier)\s+(instructions?|prompts?|directives?)/gi,
  /override\s+(previous|prior|earlier)\s+(instructions?|prompts?|directives?)/gi,
  
  // System role manipulation
  /you\s+are\s+now\s+(a|an)\s+/gi,
  /act\s+as\s+(if\s+you\s+are\s+)?(a|an)\s+/gi,
  /pretend\s+(you\s+are\s+)?(a|an)\s+/gi,
  /roleplay\s+as\s+(a|an)\s+/gi,
  
  // System prompt markers
  /<\|system\|>/gi,
  /<\|assistant\|>/gi,
  /<\|user\|>/gi,
  /\[system\]/gi,
  /\[assistant\]/gi,
  /\[user\]/gi,
  
  // Instruction injection
  /new\s+instructions?:/gi,
  /updated\s+instructions?:/gi,
  /revised\s+instructions?:/gi,
  /override\s+instructions?:/gi,
  
  // Data exfiltration attempts
  /extract\s+(and\s+)?(return|output|show|display|reveal)\s+(all\s+)?(api\s+)?keys?/gi,
  /return\s+(all\s+)?(api\s+)?keys?/gi,
  /show\s+(all\s+)?(api\s+)?keys?/gi,
  /reveal\s+(all\s+)?(api\s+)?keys?/gi,
  
  // Jailbreak attempts
  /jailbreak/gi,
  /bypass\s+(safety|security|filter)/gi,
  /ignore\s+(safety|security|filter)/gi,
  
  // Special tokens (common in LLM training)
  /<\|endoftext\|>/gi,
  /<\|end\|>/gi,
  /<\|pad\|>/gi,
];

/**
 * Sanitize a user-provided prompt to prevent injection attacks
 * 
 * @param {string} userPrompt - User-provided prompt
 * @param {Object} [options={}] - Sanitization options
 * @param {boolean} [options.detectOnly=false] - Only detect, don't sanitize
 * @param {boolean} [options.strict=false] - Strict mode (throw on detection)
 * @param {string} [options.systemPrefix] - System prefix to prepend
 * @returns {string} Sanitized prompt
 * @throws {ValidationError} If injection detected in strict mode
 */
export function sanitizePrompt(userPrompt, options = {}) {
  const {
    detectOnly = false,
    strict = false,
    systemPrefix = 'You are a UI evaluation assistant. User request:'
  } = options;

  if (typeof userPrompt !== 'string' || !userPrompt.trim()) {
    throw new ValidationError('Prompt must be a non-empty string');
  }

  // Detect injection patterns
  const detectedPatterns = [];
  for (const pattern of INJECTION_PATTERNS) {
    // Reset lastIndex for global regex patterns
    if (pattern.global) {
      pattern.lastIndex = 0;
    }
    if (pattern.test(userPrompt)) {
      detectedPatterns.push(pattern.source);
    }
  }

  // If injection detected and strict mode, throw error
  if (detectedPatterns.length > 0 && strict) {
    throw new ValidationError(
      'Potential prompt injection detected. Prompt contains suspicious patterns.',
      null,
      {
        detectedPatterns: detectedPatterns.slice(0, 5), // Limit to first 5
        promptLength: userPrompt.length
      }
    );
  }

  // If detect-only mode, return original (caller handles detection)
  if (detectOnly) {
    return userPrompt;
  }

  // Sanitize: Remove or escape injection patterns
  let sanitized = userPrompt;
  
  // Remove common injection phrases
  sanitized = sanitized
    .replace(/ignore\s+(all\s+)?(previous|prior|earlier)\s+(instructions?|prompts?|directives?)/gi, '')
    .replace(/forget\s+(all\s+)?(previous|prior|earlier)\s+(instructions?|prompts?|directives?)/gi, '')
    .replace(/disregard\s+(all\s+)?(previous|prior|earlier)\s+(instructions?|prompts?|directives?)/gi, '')
    .replace(/override\s+(previous|prior|earlier)\s+(instructions?|prompts?|directives?)/gi, '')
    .replace(/<\|system\|>/gi, '')
    .replace(/<\|assistant\|>/gi, '')
    .replace(/<\|user\|>/gi, '')
    .replace(/\[system\]/gi, '')
    .replace(/\[assistant\]/gi, '')
    .replace(/\[user\]/gi, '')
    .replace(/<\|endoftext\|>/gi, '')
    .replace(/<\|end\|>/gi, '')
    .replace(/<\|pad\|>/gi, '')
    .trim();

  // Prepend system prefix to prevent override
  // This ensures system instructions are always first
  if (systemPrefix && sanitized.length > 0) {
    sanitized = `${systemPrefix}\n\n${sanitized}`;
  }

  return sanitized;
}

/**
 * Detect if a prompt contains injection patterns
 * 
 * @param {string} userPrompt - User-provided prompt
 * @returns {Object} Detection result with patterns and severity
 */
export function detectPromptInjection(userPrompt) {
  if (typeof userPrompt !== 'string' || !userPrompt.trim()) {
    return {
      isInjection: false,
      patterns: [],
      severity: 'none'
    };
  }

  const detectedPatterns = [];
  for (const pattern of INJECTION_PATTERNS) {
    // Reset lastIndex for global regex patterns
    if (pattern.global) {
      pattern.lastIndex = 0;
    }
    if (pattern.test(userPrompt)) {
      detectedPatterns.push(pattern.source);
    }
  }

  // Determine severity
  let severity = 'none';
  if (detectedPatterns.length > 0) {
    // High severity: system override attempts
    if (detectedPatterns.some(p => 
      /ignore|forget|disregard|override/.test(p) && /instruction|prompt|directive/.test(p)
    )) {
      severity = 'high';
    }
    // Medium severity: role manipulation
    else if (detectedPatterns.some(p => 
      /you\s+are|act\s+as|pretend|roleplay/.test(p)
    )) {
      severity = 'medium';
    }
    // Low severity: special tokens or markers
    else {
      severity = 'low';
    }
  }

  return {
    isInjection: detectedPatterns.length > 0,
    patterns: detectedPatterns,
    severity
  };
}

/**
 * Validate prompt for injection (throws if detected)
 * 
 * @param {string} userPrompt - User-provided prompt
 * @param {boolean} [strict=true] - Whether to throw on detection
 * @throws {ValidationError} If injection detected and strict mode
 */
export function validatePromptSecurity(userPrompt, strict = true) {
  const detection = detectPromptInjection(userPrompt);
  
  if (detection.isInjection && strict) {
    throw new ValidationError(
      'Prompt injection detected. Prompt contains suspicious patterns that may attempt to override system instructions.',
      {
        severity: detection.severity,
        patternCount: detection.patterns.length
      }
    );
  }
  
  return detection;
}
