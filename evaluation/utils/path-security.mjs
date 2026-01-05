#!/usr/bin/env node
/**
 * Path Security Utilities
 * 
 * Provides secure path validation and normalization to prevent:
 * - Path traversal attacks (../, ..\, etc.)
 * - Access to files outside intended directories
 * - Malicious path manipulation
 */

import { resolve, normalize, relative, isAbsolute } from 'path';
import { existsSync, statSync } from 'fs';

/**
 * Validate and normalize a path to prevent traversal attacks
 * 
 * @param {string} filePath - Path to validate
 * @param {string} baseDir - Base directory (must be absolute)
 * @returns {string|null} - Normalized absolute path if valid, null if invalid
 */
export function validatePath(filePath, baseDir) {
  if (!filePath || typeof filePath !== 'string') {
    return null;
  }
  
  // Ensure baseDir is absolute
  if (!isAbsolute(baseDir)) {
    baseDir = resolve(baseDir);
  }
  
  // Resolve the path (handles .., ., etc.)
  const resolvedPath = resolve(baseDir, filePath);
  
  // Normalize to remove redundant separators
  const normalizedPath = normalize(resolvedPath);
  
  // Check that resolved path is within baseDir
  // Use relative() to check if path escapes baseDir
  const relativePath = relative(baseDir, normalizedPath);
  
  // If relative path starts with .., it's outside baseDir
  if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
    return null; // Path traversal detected
  }
  
  return normalizedPath;
}

/**
 * Validate that a path exists and is within the allowed directory
 * 
 * @param {string} filePath - Path to validate
 * @param {string} baseDir - Base directory
 * @param {boolean} mustExist - Whether file must exist (default: false)
 * @returns {{valid: boolean, path: string|null, error: string|null}}
 */
export function validateAndCheckPath(filePath, baseDir, mustExist = false) {
  const validatedPath = validatePath(filePath, baseDir);
  
  if (!validatedPath) {
    return {
      valid: false,
      path: null,
      error: 'Path traversal detected or invalid path'
    };
  }
  
  if (mustExist && !existsSync(validatedPath)) {
    return {
      valid: false,
      path: validatedPath,
      error: 'Path does not exist'
    };
  }
  
  return {
    valid: true,
    path: validatedPath,
    error: null
  };
}

/**
 * Sanitize a filename to prevent directory traversal
 * Removes path separators and dangerous characters
 * 
 * @param {string} filename - Filename to sanitize
 * @returns {string} - Sanitized filename
 */
export function sanitizeFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    return '';
  }
  
  // Remove path separators and dangerous characters
  return filename
    .replace(/[\/\\]/g, '') // Remove path separators
    .replace(/\.\./g, '') // Remove parent directory references
    .replace(/[<>:"|?*\x00-\x1f]/g, '') // Remove invalid filename characters
    .trim();
}

/**
 * Validate pagination parameters
 * 
 * @param {number|null} limit - Maximum items to return
 * @param {number} offset - Number of items to skip
 * @param {number} maxLimit - Maximum allowed limit (default: 10000)
 * @returns {{valid: boolean, limit: number|null, offset: number, error: string|null}}
 */
export function validatePagination(limit, offset = 0, maxLimit = 10000) {
  // Validate offset
  if (typeof offset !== 'number' || offset < 0 || !Number.isInteger(offset)) {
    return {
      valid: false,
      limit: null,
      offset: 0,
      error: `Invalid offset: must be non-negative integer, got ${offset}`
    };
  }
  
  // Validate limit
  if (limit !== null) {
    if (typeof limit !== 'number' || limit < 0 || !Number.isInteger(limit)) {
      return {
        valid: false,
        limit: null,
        offset,
        error: `Invalid limit: must be non-negative integer or null, got ${limit}`
      };
    }
    
    // Cap at maximum
    if (limit > maxLimit) {
      return {
        valid: true,
        limit: maxLimit,
        offset,
        error: `Limit capped at ${maxLimit}`
      };
    }
  }
  
  return {
    valid: true,
    limit,
    offset,
    error: null
  };
}





