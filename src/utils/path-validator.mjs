/**
 * Path Validation Utilities
 * 
 * Provides secure path validation to prevent path traversal attacks.
 * All user-provided paths should be validated using these functions.
 */

import { resolve, normalize, basename, dirname } from 'path';
import { existsSync } from 'fs';
import { ValidationError } from '../errors.mjs';

/**
 * Validates and normalizes a file path to prevent path traversal attacks
 * 
 * @param {string} userPath - User-provided file path
 * @param {string} baseDir - Base directory (optional, defaults to process.cwd())
 * @returns {string} - Resolved, normalized path
 * @throws {ValidationError} - If path is invalid or outside base directory
 */
export function validateFilePath(userPath, baseDir = process.cwd()) {
  if (typeof userPath !== 'string' || !userPath.trim()) {
    throw new ValidationError('File path must be a non-empty string', null, {
      received: typeof userPath
    });
  }

  // Normalize the path (removes . and .. sequences)
  const normalized = normalize(userPath);
  
  // Resolve against base directory
  const base = resolve(baseDir);
  const resolved = resolve(base, normalized);
  
  // Ensure resolved path is within base directory
  // Use startsWith with path separator to prevent bypass
  if (!resolved.startsWith(base + '/') && resolved !== base) {
    throw new ValidationError('File path must be within the allowed directory', userPath, {
      resolved,
      base,
      normalized
    });
  }
  
  return resolved;
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

