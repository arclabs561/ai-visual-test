/**
 * Windows Path Validation Tests
 * 
 * Tests for Windows-specific path traversal patterns and edge cases.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { validateFilePath } from '../../src/validation.mjs';
import { ValidationError } from '../../src/errors.mjs';

describe('Windows Path Validation', () => {
  it('should prevent Windows backslash traversal', () => {
    const attempts = [
      '..\\',
      '..\\test',
      '..\\..\\etc\\passwd',
      'test\\..\\..\\etc',
      '.\\..\\etc'
    ];

    for (const attempt of attempts) {
      assert.throws(() => {
        validateFilePath(attempt);
      }, ValidationError, `Should prevent Windows traversal: ${attempt}`);
    }
  });

  it('should prevent URL-encoded Windows backslash', () => {
    const attempts = [
      '..%5c',      // URL-encoded ..\
      '..%5C',      // URL-encoded ..\ (uppercase)
      'test%5c..%5cetc',  // Mixed encoding
    ];

    for (const attempt of attempts) {
      // Decode first, then validate
      try {
        const decoded = decodeURIComponent(attempt);
        assert.throws(() => {
          validateFilePath(decoded);
        }, ValidationError, `Should prevent decoded Windows traversal: ${decoded}`);
      } catch (decodeError) {
        // If decode fails, validation should still catch it
        assert.throws(() => {
          validateFilePath(attempt);
        }, ValidationError, `Should prevent traversal: ${attempt}`);
      }
    }
  });

  it('should handle mixed separators', () => {
    // Mixed forward/backward slashes should be normalized and caught
    const attempts = [
      '..\\/etc',
      'test/..\\etc',
      '.\\../etc'
    ];

    for (const attempt of attempts) {
      assert.throws(() => {
        validateFilePath(attempt);
      }, ValidationError, `Should prevent mixed separator traversal: ${attempt}`);
    }
  });

  it('should allow valid relative paths', () => {
    // These should not throw (assuming they're within base directory)
    const validPaths = [
      'test.png',
      'subdir/test.png',
      'subdir/nested/file.png'
    ];

    for (const path of validPaths) {
      // May throw if outside base, but should not throw ValidationError for traversal
      try {
        const resolved = validateFilePath(path);
        assert.ok(typeof resolved === 'string', 'Should return resolved path');
        assert.ok(resolved.length > 0, 'Should return non-empty path');
      } catch (error) {
        // If it throws, should be for other reasons (not traversal)
        assert.ok(!error.message.includes('path traversal'), 
          `Should not throw traversal error for valid path: ${path}`);
      }
    }
  });
});

