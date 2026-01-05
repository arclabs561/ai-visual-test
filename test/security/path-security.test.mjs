#!/usr/bin/env node
/**
 * Path Security Tests
 * 
 * Tests path validation and security utilities
 */

import '../test-setup.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { validatePath, validatePagination, sanitizeFilename } from '../../evaluation/utils/path-security.mjs';
import { resolve } from 'path';

describe('Path Security Utilities', () => {
  
  describe('validatePath', () => {
    it('should allow valid paths within base directory', () => {
      const baseDir = resolve('/safe/base');
      const result = validatePath('subdir/file.txt', baseDir);
      assert.ok(result, 'Should allow valid path');
      assert.ok(result.includes('subdir'), 'Should include subdirectory');
    });
    
    it('should reject path traversal attempts', () => {
      const baseDir = resolve('/safe/base');
      const result = validatePath('../../../etc/passwd', baseDir);
      assert.strictEqual(result, null, 'Should reject path traversal');
    });
    
    it('should reject absolute paths', () => {
      const baseDir = resolve('/safe/base');
      const result = validatePath('/etc/passwd', baseDir);
      assert.strictEqual(result, null, 'Should reject absolute paths');
    });
    
    it('should handle empty or invalid inputs', () => {
      const baseDir = resolve('/safe/base');
      assert.strictEqual(validatePath('', baseDir), null, 'Should reject empty path');
      assert.strictEqual(validatePath(null, baseDir), null, 'Should reject null');
      assert.strictEqual(validatePath(undefined, baseDir), null, 'Should reject undefined');
    });
  });
  
  describe('validatePagination', () => {
    it('should accept valid pagination parameters', () => {
      const result = validatePagination(100, 0);
      assert.ok(result.valid, 'Should accept valid limit and offset');
      assert.strictEqual(result.limit, 100);
      assert.strictEqual(result.offset, 0);
    });
    
    it('should reject negative limit', () => {
      const result = validatePagination(-1, 0);
      assert.ok(!result.valid, 'Should reject negative limit');
      assert.ok(result.error.includes('Invalid limit'), 'Should have helpful error');
    });
    
    it('should reject negative offset', () => {
      const result = validatePagination(100, -5);
      assert.ok(!result.valid, 'Should reject negative offset');
      assert.ok(result.error.includes('Invalid offset'), 'Should have helpful error');
    });
    
    it('should reject non-integer values', () => {
      const result1 = validatePagination(100.5, 0);
      assert.ok(!result1.valid, 'Should reject non-integer limit');
      
      const result2 = validatePagination(100, 5.5);
      assert.ok(!result2.valid, 'Should reject non-integer offset');
    });
    
    it('should cap limit at maximum', () => {
      const result = validatePagination(50000, 0, 10000);
      assert.ok(result.valid, 'Should be valid');
      assert.strictEqual(result.limit, 10000, 'Should cap at maxLimit');
      assert.ok(result.error?.includes('capped'), 'Should warn about capping');
    });
    
    it('should accept null limit', () => {
      const result = validatePagination(null, 0);
      assert.ok(result.valid, 'Should accept null limit');
      assert.strictEqual(result.limit, null);
    });
  });
  
  describe('sanitizeFilename', () => {
    it('should remove path separators', () => {
      const result = sanitizeFilename('file/name.txt');
      assert.strictEqual(result, 'filename.txt', 'Should remove forward slash');
      
      const result2 = sanitizeFilename('file\\name.txt');
      assert.strictEqual(result2, 'filename.txt', 'Should remove backslash');
    });
    
    it('should remove path traversal sequences', () => {
      const result = sanitizeFilename('../../../etc/passwd');
      assert.strictEqual(result, 'etcpasswd', 'Should remove .. sequences');
    });
    
    it('should remove invalid filename characters', () => {
      const result = sanitizeFilename('file<name>.txt');
      assert.ok(!result.includes('<'), 'Should remove <');
      assert.ok(!result.includes('>'), 'Should remove >');
    });
    
    it('should handle empty input', () => {
      assert.strictEqual(sanitizeFilename(''), '');
      assert.strictEqual(sanitizeFilename(null), '');
      assert.strictEqual(sanitizeFilename(undefined), '');
    });
  });
});


