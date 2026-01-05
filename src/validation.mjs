/**
 * Input Validation Utilities
 * 
 * Provides validation functions for common input types to prevent
 * security vulnerabilities and improve error messages.
 */

import { ValidationError } from './errors.mjs';
import { existsSync } from 'fs';
import { normalize, resolve } from 'path';
import { VALIDATION_CONSTANTS } from './constants.mjs';

/**
 * Validate image file path
 * 
 * @param {string} imagePath - Path to image file
 * @returns {true} Always returns true if valid
 * @throws {ValidationError} If path is invalid, empty, or contains path traversal
 */
export function validateImagePath(imagePath, options = {}) {
  const { baseDir = process.cwd() } = options;
  
  if (typeof imagePath !== 'string') {
    throw new ValidationError('Image path must be a string', null, {
      received: typeof imagePath
    });
  }
  
  if (imagePath.length === 0) {
    throw new ValidationError('Image path cannot be empty');
  }
  
  // SECURITY: Use resolve-based validation to prevent path traversal
  const base = resolve(baseDir);
  const normalized = normalize(imagePath);
  const resolved = resolve(base, normalized);
  
  // Ensure resolved path is within base directory
  // Check both with and without trailing slash to handle edge cases
  const baseWithSlash = base.endsWith('/') ? base : base + '/';
  if (!resolved.startsWith(baseWithSlash) && resolved !== base) {
    throw new ValidationError('Invalid image path: path traversal detected', imagePath, {
      resolved,
      base
    });
  }
  
  // Validate file extension
  const validExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
  const hasValidExtension = validExtensions.some(ext => 
    resolved.toLowerCase().endsWith(ext)
  );
  
  if (!hasValidExtension) {
    throw new ValidationError('Invalid image format. Supported: png, jpg, jpeg, gif, webp', imagePath);
  }
  
  // Return resolved path for use
  return resolved;
}

/**
 * Validate prompt string
 * 
 * @param {string} prompt - Prompt text to validate
 * @param {number} [maxLength=10000] - Maximum allowed length
 * @returns {true} Always returns true if valid
 * @throws {ValidationError} If prompt is invalid, empty, or too long
 */
export function validatePrompt(prompt, maxLength = VALIDATION_CONSTANTS.MAX_PROMPT_LENGTH) {
  if (typeof prompt !== 'string') {
    throw new ValidationError('Prompt must be a string', null, {
      received: typeof prompt
    });
  }
  
  if (prompt.length === 0) {
    throw new ValidationError('Prompt cannot be empty');
  }
  
  if (prompt.length > maxLength) {
    throw new ValidationError(`Prompt too long (max ${maxLength} characters)`, null, {
      length: prompt.length,
      maxLength
    });
  }
  
  return true;
}

/**
 * Validate context object
 * 
 * @param {unknown} context - Context object to validate (can be null/undefined)
 * @param {number} [maxSize=50000] - Maximum serialized size in bytes
 * @returns {true} Always returns true if valid
 * @throws {ValidationError} If context is invalid type, too large, or non-serializable
 */
export function validateContext(context, maxSize = VALIDATION_CONSTANTS.MAX_CONTEXT_SIZE) {
  if (context === null || context === undefined) {
    return true; // Context is optional
  }
  
  if (typeof context !== 'object' || Array.isArray(context)) {
    throw new ValidationError('Context must be an object', null, {
      received: Array.isArray(context) ? 'array' : typeof context
    });
  }
  
  // Check size by stringifying
  try {
    const contextString = JSON.stringify(context);
    if (contextString.length > maxSize) {
      throw new ValidationError(`Context too large (max ${maxSize} bytes)`, null, {
        size: contextString.length,
        maxSize
      });
    }
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError('Context contains non-serializable data', null, {
      originalError: error.message
    });
  }
  
  return true;
}

/**
 * Validate timeout value
 * 
 * @param {number} timeout - Timeout value in milliseconds
 * @param {number} [min=1000] - Minimum allowed timeout
 * @param {number} [max=300000] - Maximum allowed timeout
 * @returns {true} Always returns true if valid
 * @throws {ValidationError} If timeout is invalid, too short, or too long
 */
export function validateTimeout(timeout, min = VALIDATION_CONSTANTS.MIN_TIMEOUT_MS, max = VALIDATION_CONSTANTS.MAX_TIMEOUT_MS) {
  if (typeof timeout !== 'number') {
    throw new ValidationError('Timeout must be a number', null, {
      received: typeof timeout
    });
  }
  
  if (timeout < min) {
    throw new ValidationError(`Timeout too short (min ${min}ms)`, null, {
      timeout,
      min
    });
  }
  
  if (timeout > max) {
    throw new ValidationError(`Timeout too long (max ${max}ms)`, null, {
      timeout,
      max
    });
  }
  
  return true;
}

/**
 * Validate schema object for data extraction
 * 
 * @param {unknown} schema - Schema object to validate
 * @returns {true} Always returns true if valid
 * @throws {ValidationError} If schema is invalid or has invalid field types
 */
export function validateSchema(schema) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    throw new ValidationError('Schema must be a non-empty object', null, {
      received: Array.isArray(schema) ? 'array' : typeof schema
    });
  }
  
  const validTypes = ['string', 'number', 'boolean', 'object', 'array'];
  
  for (const [key, field] of Object.entries(schema)) {
    if (typeof field !== 'object' || Array.isArray(field)) {
      throw new ValidationError(`Schema field "${key}" must be an object`, null, {
        field
      });
    }
    
    if (!field.type || !validTypes.includes(field.type)) {
      throw new ValidationError(`Schema field "${key}" has invalid type`, null, {
        type: field.type,
        validTypes
      });
    }
  }
  
  return true;
}

/**
 * Validate file path (general purpose)
 * 
 * This is the primary path validation function. For simpler use cases,
 * see the specialized functions: validateImagePath() for image files.
 * 
 * @param {string} filePath - File path to validate
 * @param {{
 *   mustExist?: boolean;
 *   allowedExtensions?: string[] | null;
 *   maxLength?: number;
 *   baseDir?: string;
 * }} [options={}] - Validation options
 * @returns {string} Resolved, validated path
 * @throws {ValidationError} If path is invalid, empty, too long, has path traversal, wrong extension, or doesn't exist (if required)
 */
export function validateFilePath(filePath, options = {}) {
  const {
    mustExist = false,
    allowedExtensions = null,
    maxLength = 4096,
    baseDir = process.cwd()
  } = options;
  
  if (typeof filePath !== 'string') {
    throw new ValidationError('File path must be a string', null, {
      received: typeof filePath
    });
  }
  
  if (filePath.length === 0) {
    throw new ValidationError('File path cannot be empty');
  }
  
  if (filePath.length > maxLength) {
    throw new ValidationError(`File path too long (max ${maxLength} characters)`, filePath);
  }
  
  // SECURITY: Check for path traversal patterns in original string (before normalization)
  // This provides better error messages and catches Windows backslash patterns
  const traversalPatterns = [
    /\.\.[\/\\]/,  // ../ or ..\
    /\.\.%2[fF]/,  // URL-encoded ../
    /\.\.%5[cC]/,  // URL-encoded ..\
    /%2[eE]%2[eE][\/\\]/,  // URL-encoded ../
    /%2[eE]%2[eE]%2[fF]/,  // URL-encoded ../
    /%2[eE]%2[eE]%5[cC]/   // URL-encoded ..\
  ];
  
  const hasTraversalPattern = traversalPatterns.some(pattern => pattern.test(filePath));
  if (hasTraversalPattern) {
    throw new ValidationError('Invalid file path: path traversal detected', filePath, {
      pattern: 'detected in original path',
      base: baseDir
    });
  }
  
  // SECURITY: Use resolve to prevent path traversal
  const base = resolve(baseDir);
  const normalized = normalize(filePath);
  
  // Resolve path - if absolute, use as-is; if relative, resolve against base
  const resolved = filePath.startsWith('/') 
    ? resolve(normalized)  // Absolute path
    : resolve(base, normalized);  // Relative path
  
  // Normalize path separators for cross-platform compatibility
  const baseNormalized = base.replace(/\\/g, '/');
  const resolvedNormalized = resolved.replace(/\\/g, '/');
  
  // Ensure resolved path is within base directory
  const isWithinBase = resolvedNormalized.startsWith(baseNormalized + '/') || resolvedNormalized === baseNormalized;
  
  if (!isWithinBase) {
    throw new ValidationError('Invalid file path: path traversal detected', filePath, {
      resolved,
      base
    });
  }
  
  // Check extension if specified
  if (allowedExtensions) {
    const ext = resolved.substring(resolved.lastIndexOf('.'));
    if (!allowedExtensions.includes(ext.toLowerCase())) {
      throw new ValidationError(`Invalid file extension. Allowed: ${allowedExtensions.join(', ')}`, filePath);
    }
  }
  
  // Check existence if required
  if (mustExist && !existsSync(resolved)) {
    throw new ValidationError('File does not exist', filePath);
  }
  
  return resolved;
}

