/**
 * Simple logger utility
 * 
 * Provides conditional logging that respects debug mode.
 * In production, warnings are silent unless explicitly enabled.
 * 
 * SECURITY: Logs are sanitized to prevent information disclosure.
 */

import { sanitizeForLogging, sanitizeErrorForLogging } from './utils/log-sanitizer.mjs';

let DEBUG_ENABLED = false;

/**
 * Enable debug logging
 */
export function enableDebug() {
  DEBUG_ENABLED = true;
}

/**
 * Disable debug logging
 */
export function disableDebug() {
  DEBUG_ENABLED = false;
}

/**
 * Check if debug is enabled
 */
export function isDebugEnabled() {
  return DEBUG_ENABLED;
}

/**
 * Log a warning (only if debug enabled)
 * 
 * SECURITY: Logs are sanitized to prevent information disclosure.
 */
export function warn(...args) {
  if (DEBUG_ENABLED) {
    const sanitized = args.map(arg => {
      if (arg instanceof Error) {
        return sanitizeErrorForLogging(arg, { includeStack: true });
      }
      return sanitizeForLogging(arg);
    });
    console.warn(...sanitized);
  }
}

/**
 * Log info (only if debug enabled)
 * 
 * SECURITY: Logs are sanitized to prevent information disclosure.
 */
export function log(...args) {
  if (DEBUG_ENABLED) {
    const sanitized = args.map(arg => {
      if (arg instanceof Error) {
        return sanitizeErrorForLogging(arg, { includeStack: true });
      }
      return sanitizeForLogging(arg);
    });
    console.log(...sanitized);
  }
}

/**
 * Log error (always logged)
 * 
 * SECURITY: Logs are sanitized to prevent information disclosure.
 */
export function error(...args) {
  const sanitized = args.map(arg => {
    if (arg instanceof Error) {
      return sanitizeErrorForLogging(arg, { includeStack: true });
    }
    return sanitizeForLogging(arg);
  });
  console.error(...sanitized);
}

