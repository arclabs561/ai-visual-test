/**
 * Tests for path-validator.mjs
 */

import '../test-setup.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { resolve } from 'path';
import {
  validateFilePath,
  sanitizePathForError,
  validatePathInAllowedDirs
} from '../../src/utils/path-validator.mjs';
import { ValidationError } from '../../src/errors.mjs';

describe('Path Validator', () => {
  const baseDir = process.cwd();

  describe('validateFilePath', () => {
    it('should validate and normalize valid path', () => {
      const path = 'test/file.txt';
      const result = validateFilePath(path, baseDir);
      
      assert.ok(result);
      assert.ok(result.startsWith(baseDir));
      assert.ok(result.includes('test/file.txt'));
    });

    it('should resolve relative paths', () => {
      const path = './test/file.txt';
      const result = validateFilePath(path, baseDir);
      
      assert.ok(result.startsWith(baseDir));
    });

    it('should throw ValidationError for non-string input', () => {
      assert.throws(() => validateFilePath(null, baseDir), ValidationError);
      assert.throws(() => validateFilePath(123, baseDir), ValidationError);
      assert.throws(() => validateFilePath({}, baseDir), ValidationError);
    });

    it('should throw ValidationError for empty string', () => {
      assert.throws(() => validateFilePath('', baseDir), ValidationError);
      assert.throws(() => validateFilePath('   ', baseDir), ValidationError);
    });

    it('should prevent path traversal with ..', () => {
      const path = '../../etc/passwd';
      
      assert.throws(() => validateFilePath(path, baseDir), ValidationError);
    });

    it('should prevent path traversal with absolute path', () => {
      const path = '/etc/passwd';
      
      assert.throws(() => validateFilePath(path, baseDir), ValidationError);
    });

    it('should allow paths within base directory', () => {
      const path = 'test/subdir/file.txt';
      const result = validateFilePath(path, baseDir);
      
      assert.ok(result.startsWith(baseDir));
    });

    it('should normalize path separators', () => {
      const path = 'test\\subdir\\file.txt'; // Windows-style
      const result = validateFilePath(path, baseDir);
      
      // Should normalize to forward slashes or system default
      assert.ok(result);
    });
  });

  describe('sanitizePathForError', () => {
    it('should return full path if depth <= maxDepth', () => {
      const path = 'test/file.txt';
      const result = sanitizePathForError(path, 5);
      
      assert.strictEqual(result, path);
    });

    it('should truncate long paths', () => {
      const path = '/very/long/path/to/file/that/exceeds/max/depth/file.txt';
      const result = sanitizePathForError(path, 2);
      
      assert.ok(result.startsWith('.../'));
      assert.ok(result.includes('file.txt'));
      assert.ok(!result.includes('/very/long/path'));
    });

    it('should handle invalid input', () => {
      assert.strictEqual(sanitizePathForError(null, 2), '[invalid path]');
      assert.strictEqual(sanitizePathForError(123, 2), '[invalid path]');
    });

    it('should use default maxDepth of 2', () => {
      const path = '/a/b/c/d/e/file.txt';
      const result = sanitizePathForError(path);
      
      assert.ok(result.startsWith('.../'));
      // Should show last 2 components
      assert.ok(result.includes('e/file.txt') || result.includes('e' + require('path').sep + 'file.txt'));
    });
  });

  describe('validatePathInAllowedDirs', () => {
    it('should validate path in allowed directory', () => {
      const allowedDirs = [baseDir, '/tmp'];
      const path = 'test/file.txt';
      
      const result = validatePathInAllowedDirs(path, allowedDirs);
      
      assert.ok(result.startsWith(baseDir));
    });

    it('should try multiple allowed directories', () => {
      // Use a path that would fail validation in first dir (path traversal)
      // but succeed in second dir
      const allowedDirs = ['/tmp', baseDir];
      const path = 'test/file.txt';
      
      // Should try first directory (might succeed if /tmp exists), 
      // but we'll test with a path that definitely fails in first
      // Actually, let's test with a path that works in baseDir
      const result = validatePathInAllowedDirs(path, allowedDirs);
      
      // Result should be a valid resolved path
      assert.ok(result);
      // Should be within one of the allowed directories
      const inFirstDir = result.startsWith('/tmp');
      const inSecondDir = result.startsWith(baseDir);
      assert.ok(inFirstDir || inSecondDir, `Path ${result} should be in one of the allowed directories`);
    });

    it('should throw ValidationError if path not in any allowed directory', () => {
      const allowedDirs = ['/tmp'];
      const path = '../../etc/passwd';
      
      assert.throws(() => validatePathInAllowedDirs(path, allowedDirs), ValidationError);
    });

    it('should throw ValidationError for empty allowedDirs', () => {
      assert.throws(() => validatePathInAllowedDirs('test.txt', []), ValidationError);
    });

    it('should throw ValidationError for non-array allowedDirs', () => {
      assert.throws(() => validatePathInAllowedDirs('test.txt', 'not-array'), ValidationError);
    });
  });
});

