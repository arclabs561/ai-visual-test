/**
 * Log Sanitization Utilities
 * 
 * Provides log sanitization to prevent information disclosure in production logs.
 * Removes sensitive data like API keys, full paths, and long prompts.
 */

import { basename } from 'path';

/**
 * Fields that should never be logged (sensitive data)
 */
const SENSITIVE_FIELDS = [
  'apiKey',
  'token',
  'password',
  'secret',
  'credential',
  'authorization',
  'x-api-key',
  'x-goog-api-key',
  'bearer'
];

/**
 * Maximum length for logged strings (prevents log flooding)
 */
const MAX_LOG_LENGTH = 200;

/**
 * Sanitize data for logging
 * 
 * Removes sensitive fields, truncates long strings, and sanitizes paths.
 * 
 * @param {unknown} data - Data to sanitize
 * @param {Object} [options={}] - Sanitization options
 * @param {boolean} [options.removeSensitive=true] - Remove sensitive fields
 * @param {number} [options.maxLength=200] - Maximum string length
 * @param {boolean} [options.sanitizePaths=true] - Sanitize file paths
 * @returns {unknown} Sanitized data
 */
export function sanitizeForLogging(data, options = {}) {
  const {
    removeSensitive = true,
    maxLength = MAX_LOG_LENGTH,
    sanitizePaths = true
  } = options;

  // Handle null/undefined
  if (data === null || data === undefined) {
    return data;
  }

  // Handle primitives
  if (typeof data !== 'object') {
    return sanitizePrimitive(data, maxLength);
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => sanitizeForLogging(item, options));
  }

  // Handle objects
  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    // Remove sensitive fields
    if (removeSensitive && isSensitiveField(key)) {
      sanitized[key] = '[REDACTED]';
      continue;
    }

    // Sanitize paths
    if (sanitizePaths && isPathField(key)) {
      sanitized[key] = typeof value === 'string' ? basename(value) : value;
      continue;
    }

    // Recursively sanitize nested objects
    if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForLogging(value, options);
      continue;
    }

    // Sanitize primitives
    sanitized[key] = sanitizePrimitive(value, maxLength);
  }

  return sanitized;
}

/**
 * Check if a field name indicates sensitive data
 * 
 * @param {string} fieldName - Field name to check
 * @returns {boolean} True if field is sensitive
 */
function isSensitiveField(fieldName) {
  const lower = fieldName.toLowerCase();
  return SENSITIVE_FIELDS.some(sensitive => lower.includes(sensitive.toLowerCase()));
}

/**
 * Check if a field name indicates a file path
 * 
 * @param {string} fieldName - Field name to check
 * @returns {boolean} True if field is a path
 */
function isPathField(fieldName) {
  const lower = fieldName.toLowerCase();
  return lower.includes('path') || lower.includes('file') || lower.includes('dir');
}

/**
 * Sanitize a primitive value
 * 
 * @param {unknown} value - Value to sanitize
 * @param {number} maxLength - Maximum length
 * @returns {unknown} Sanitized value
 */
function sanitizePrimitive(value, maxLength) {
  if (typeof value === 'string') {
    if (value.length > maxLength) {
      return value.substring(0, maxLength) + '...';
    }
    return value;
  }
  return value;
}

/**
 * Sanitize error object for logging
 * 
 * @param {Error} error - Error object
 * @param {Object} [options={}] - Sanitization options
 * @returns {Object} Sanitized error
 */
export function sanitizeErrorForLogging(error, options = {}) {
  if (!error || typeof error !== 'object') {
    return error;
  }

  const sanitized = {
    name: error.name,
    message: sanitizePrimitive(error.message, options.maxLength || MAX_LOG_LENGTH)
  };

  // Include stack trace only in debug mode
  if (options.includeStack && error.stack) {
    sanitized.stack = sanitizePrimitive(error.stack, options.maxStackLength || 500);
  }

  // Sanitize error details if present
  if (error.details && typeof error.details === 'object') {
    sanitized.details = sanitizeForLogging(error.details, options);
  }

  // Include code if present (useful for debugging)
  if (error.code) {
    sanitized.code = error.code;
  }

  return sanitized;
}

