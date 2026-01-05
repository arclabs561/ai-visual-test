/**
 * Tests for log-sanitizer.mjs
 */

import '../test-setup.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  sanitizeForLogging,
  sanitizeErrorForLogging
} from '../../src/utils/log-sanitizer.mjs';

describe('Log Sanitizer', () => {
  describe('sanitizeForLogging', () => {
    it('should return null/undefined as-is', () => {
      assert.strictEqual(sanitizeForLogging(null), null);
      assert.strictEqual(sanitizeForLogging(undefined), undefined);
    });

    it('should truncate long strings', () => {
      const longString = 'a'.repeat(300);
      const result = sanitizeForLogging(longString, { maxLength: 200 });
      
      assert.ok(result.length <= 203); // 200 + '...'
      assert.ok(result.endsWith('...'));
    });

    it('should not truncate short strings', () => {
      const shortString = 'short';
      const result = sanitizeForLogging(shortString);
      
      assert.strictEqual(result, shortString);
    });

    it('should remove sensitive fields', () => {
      const data = {
        apiKey: 'secret-key',
        password: 'secret-password',
        token: 'secret-token',
        normalField: 'value'
      };
      
      const result = sanitizeForLogging(data);
      
      assert.strictEqual(result.apiKey, '[REDACTED]');
      assert.strictEqual(result.password, '[REDACTED]');
      assert.strictEqual(result.token, '[REDACTED]');
      assert.strictEqual(result.normalField, 'value');
    });

    it('should sanitize paths', () => {
      const data = {
        filePath: '/very/long/path/to/file.txt',
        directory: '/home/user/documents',
        normalField: 'value'
      };
      
      const result = sanitizeForLogging(data, { sanitizePaths: true });
      
      // basename extracts just the filename/dirname
      assert.ok(result.filePath);
      assert.ok(result.filePath.includes('file.txt') || result.filePath === 'file.txt');
      assert.ok(result.directory);
      assert.ok(result.directory.includes('documents') || result.directory === 'documents');
      assert.strictEqual(result.normalField, 'value');
    });

    it('should not sanitize paths when disabled', () => {
      const data = {
        filePath: '/path/to/file.txt'
      };
      
      const result = sanitizeForLogging(data, { sanitizePaths: false });
      
      assert.strictEqual(result.filePath, '/path/to/file.txt');
    });

    it('should sanitize nested objects', () => {
      const data = {
        nested: {
          apiKey: 'secret',
          value: 'normal'
        }
      };
      
      const result = sanitizeForLogging(data);
      
      assert.strictEqual(result.nested.apiKey, '[REDACTED]');
      assert.strictEqual(result.nested.value, 'normal');
    });

    it('should sanitize arrays', () => {
      const data = [
        { apiKey: 'secret1' },
        { apiKey: 'secret2' }
      ];
      
      const result = sanitizeForLogging(data);
      
      assert.strictEqual(result[0].apiKey, '[REDACTED]');
      assert.strictEqual(result[1].apiKey, '[REDACTED]');
    });

    it('should handle case-insensitive sensitive field detection', () => {
      const data = {
        apiKey: 'secret', // Direct match
        token: 'secret-token', // Direct match
        Bearer: 'token' // Should match 'bearer'
      };
      
      const result = sanitizeForLogging(data);
      
      // All should be redacted
      assert.strictEqual(result.apiKey, '[REDACTED]');
      assert.strictEqual(result.token, '[REDACTED]');
      assert.strictEqual(result.Bearer, '[REDACTED]');
    });
  });

  describe('sanitizeErrorForLogging', () => {
    it('should sanitize error object', () => {
      const error = new Error('Test error');
      error.code = 'TEST_ERROR';
      error.details = { apiKey: 'secret' };
      
      const result = sanitizeErrorForLogging(error);
      
      assert.strictEqual(result.name, 'Error');
      assert.strictEqual(result.message, 'Test error');
      assert.strictEqual(result.code, 'TEST_ERROR');
      assert.strictEqual(result.details.apiKey, '[REDACTED]');
    });

    it('should include stack trace when requested', () => {
      const error = new Error('Test error');
      
      const result = sanitizeErrorForLogging(error, { includeStack: true });
      
      assert.ok(result.stack);
    });

    it('should not include stack trace by default', () => {
      const error = new Error('Test error');
      
      const result = sanitizeErrorForLogging(error);
      
      assert.strictEqual(result.stack, undefined);
    });

    it('should truncate long stack traces', () => {
      const error = new Error('Test error');
      error.stack = 'a'.repeat(1000);
      
      const result = sanitizeErrorForLogging(error, {
        includeStack: true,
        maxStackLength: 500
      });
      
      assert.ok(result.stack.length <= 503); // 500 + '...'
    });

    it('should handle non-Error objects', () => {
      const result = sanitizeErrorForLogging(null);
      assert.strictEqual(result, null);
      
      const result2 = sanitizeErrorForLogging('string');
      assert.strictEqual(result2, 'string');
    });

    it('should sanitize nested error details', () => {
      const error = new Error('Test error');
      error.details = {
        apiKey: 'secret',
        nested: {
          token: 'secret-token'
        }
      };
      
      const result = sanitizeErrorForLogging(error);
      
      assert.strictEqual(result.details.apiKey, '[REDACTED]');
      assert.strictEqual(result.details.nested.token, '[REDACTED]');
    });
  });
});

