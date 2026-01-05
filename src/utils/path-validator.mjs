/**
 * Path Validation Utilities
 * 
 * Provides secure path validation to prevent path traversal attacks.
 * 
 * NOTE: The primary validateFilePath() function is in src/validation.mjs.
 * This module provides additional utilities for path validation.
 * 
 * @deprecated validateFilePath() - Use validateFilePath() from '../validation.mjs' instead
 * This function is kept for backward compatibility but delegates to the main implementation.
 */

import { resolve, normalize, basename } from 'path';
import { existsSync } from 'fs';
import { ValidationError } from '../errors.mjs';
import { validateFilePath as validateFilePathMain } from '../validation.mjs';

/**
 * Validates and normalizes a file path to prevent path traversal attacks
 * 
 * @deprecated Use validateFilePath() from '../validation.mjs' instead
 * @param {string} userPath - User-provided file path
 * @param {string} baseDir - Base directory (optional, defaults to process.cwd())
 * @returns {string} - Resolved, normalized path
 * @throws {ValidationError} - If path is invalid or outside base directory
 */
export function validateFilePath(userPath, baseDir = process.cwd()) {
  // Validate empty string before delegating (main implementation also checks, but we want consistent error)
  if (typeof userPath !== 'string' || !userPath.trim()) {
    throw new ValidationError('File path must be a non-empty string', null, {
      received: typeof userPath
    });
  }
  
  // Delegate to main implementation for consistency
  return validateFilePathMain(userPath, { baseDir });
}

/**
 * Sanitize file path for error messages (prevents information disclosure)
 * 
 * @param {string} fullPath - Full file path
 * @param {number} maxDepth - Maximum directory depth to show (default: 2)
 * @returns {string} - Sanitized path showing only last N components
 */
export function sanitizePathForError(fullPath, maxDepth = 2) {
  if (typeof fullPath !== 'string') {
    return '[invalid path]';
  }
  
  const parts = fullPath.split('/').filter(p => p);
  if (parts.length <= maxDepth) {
    return fullPath;
  }
  
  // Show only last maxDepth parts
  return '.../' + parts.slice(-maxDepth).join('/');
}

/**
 * Validate that a path is within allowed directories
 * 
 * @param {string} userPath - User-provided path
 * @param {string[]} allowedDirs - Array of allowed base directories
 * @returns {string} - Resolved path if valid
 * @throws {ValidationError} - If path is outside all allowed directories
 */
export function validatePathInAllowedDirs(userPath, allowedDirs) {
  if (!Array.isArray(allowedDirs) || allowedDirs.length === 0) {
    throw new ValidationError('allowedDirs must be a non-empty array');
  }
  
  for (const allowedDir of allowedDirs) {
    try {
      const resolved = validateFilePath(userPath, allowedDir);
      return resolved;
    } catch {
      // Try next allowed directory
      continue;
    }
  }
  
  // Path not in any allowed directory
  throw new ValidationError('File path is outside allowed directories', userPath, {
    allowedDirs
  });
}

