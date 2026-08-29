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
export function enableDebug(): void {
  DEBUG_ENABLED = true;
}

/**
 * Disable debug logging
 */
export function disableDebug(): void {
  DEBUG_ENABLED = false;
}

/**
 * Check if debug is enabled
 */
export function isDebugEnabled(): boolean {
  return DEBUG_ENABLED;
}

/**
 * Log a warning (only if debug enabled)
 * 
 * SECURITY: Logs are sanitized to prevent information disclosure.
 */
function sanitizeArguments(args: readonly unknown[]): unknown[] {
  return args.map((arg) => {
    if (arg instanceof Error) {
      return sanitizeErrorForLogging(arg, { includeStack: true });
    }
    return sanitizeForLogging(arg);
  });
}

export function warn(...args: unknown[]): void {
  if (DEBUG_ENABLED) {
    const sanitized = sanitizeArguments(args);
    console.warn(...sanitized);
  }
}

/**
 * Log info (only if debug enabled)
 * 
 * SECURITY: Logs are sanitized to prevent information disclosure.
 */
export function log(...args: unknown[]): void {
  if (DEBUG_ENABLED) {
    const sanitized = sanitizeArguments(args);
    console.log(...sanitized);
  }
}

/**
 * Log error (always logged)
 * 
 * SECURITY: Logs are sanitized to prevent information disclosure.
 */
export function error(...args: unknown[]): void {
  const sanitized = sanitizeArguments(args);
  console.error(...sanitized);
}
