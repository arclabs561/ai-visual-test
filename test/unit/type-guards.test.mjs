/**
 * Tests for type-guards.mjs
 * 
 * Comprehensive tests for all type guard and assertion functions.
 */

import '../test-setup.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  isObject,
  isString,
  isNumber,
  isPositiveInteger,
  isNonEmptyString,
  isArray,
  isFunction,
  isPromise,
  isValidationResult,
  isValidationContext,
  isPersona,
  isTemporalNote,
  assertObject,
  assertString,
  assertNonEmptyString,
  assertNumber,
  assertArray,
  assertFunction,
  pick,
  getProperty
} from '../../src/type-guards.mjs';
import { ValidationError } from '../../src/errors.js';

describe('Type Guards', () => {
  describe('isObject', () => {
    it('should return true for plain objects', () => {
      assert.strictEqual(isObject({}), true);
      assert.strictEqual(isObject({ a: 1 }), true);
      assert.strictEqual(isObject({ nested: { value: 1 } }), true);
    });

    it('should return false for null', () => {
      assert.strictEqual(isObject(null), false);
    });

    it('should return false for arrays', () => {
      assert.strictEqual(isObject([]), false);
      assert.strictEqual(isObject([1, 2, 3]), false);
    });

    it('should return false for primitives', () => {
      assert.strictEqual(isObject('string'), false);
      assert.strictEqual(isObject(123), false);
      assert.strictEqual(isObject(true), false);
      assert.strictEqual(isObject(undefined), false);
    });

    it('should return true for Date objects', () => {
      assert.strictEqual(isObject(new Date()), true);
    });
  });

  describe('isString', () => {
    it('should return true for strings', () => {
      assert.strictEqual(isString(''), true);
      assert.strictEqual(isString('hello'), true);
      assert.strictEqual(isString('123'), true);
    });

    it('should return false for non-strings', () => {
      assert.strictEqual(isString(123), false);
      assert.strictEqual(isString(null), false);
      assert.strictEqual(isString(undefined), false);
      assert.strictEqual(isString({}), false);
      assert.strictEqual(isString([]), false);
    });
  });

  describe('isNumber', () => {
    it('should return true for numbers', () => {
      assert.strictEqual(isNumber(0), true);
      assert.strictEqual(isNumber(123), true);
      assert.strictEqual(isNumber(-123), true);
      assert.strictEqual(isNumber(123.456), true);
    });

    it('should return false for NaN', () => {
      assert.strictEqual(isNumber(NaN), false);
    });

    it('should return true for Infinity (isNumber accepts Infinity)', () => {
      // isNumber checks typeof === 'number' && !isNaN, so Infinity passes
      assert.strictEqual(isNumber(Infinity), true);
      assert.strictEqual(isNumber(-Infinity), true);
    });

    it('should return false for non-numbers', () => {
      assert.strictEqual(isNumber('123'), false);
      assert.strictEqual(isNumber(null), false);
      assert.strictEqual(isNumber(undefined), false);
    });
  });

  describe('isPositiveInteger', () => {
    it('should return true for positive integers', () => {
      assert.strictEqual(isPositiveInteger(1), true);
      assert.strictEqual(isPositiveInteger(100), true);
    });

    it('should return false for zero', () => {
      assert.strictEqual(isPositiveInteger(0), false);
    });

    it('should return false for negative numbers', () => {
      assert.strictEqual(isPositiveInteger(-1), false);
    });

    it('should return false for floats', () => {
      assert.strictEqual(isPositiveInteger(1.5), false);
    });

    it('should return false for non-numbers', () => {
      assert.strictEqual(isPositiveInteger('1'), false);
    });
  });

  describe('isNonEmptyString', () => {
    it('should return true for non-empty strings', () => {
      assert.strictEqual(isNonEmptyString('hello'), true);
      assert.strictEqual(isNonEmptyString(' '), true);
    });

    it('should return false for empty strings', () => {
      assert.strictEqual(isNonEmptyString(''), false);
    });

    it('should return false for non-strings', () => {
      assert.strictEqual(isNonEmptyString(123), false);
      assert.strictEqual(isNonEmptyString(null), false);
    });
  });

  describe('isArray', () => {
    it('should return true for arrays', () => {
      assert.strictEqual(isArray([]), true);
      assert.strictEqual(isArray([1, 2, 3]), true);
      assert.strictEqual(isArray(['a', 'b']), true);
    });

    it('should return false for non-arrays', () => {
      assert.strictEqual(isArray({}), false);
      assert.strictEqual(isArray('string'), false);
      assert.strictEqual(isArray(123), false);
      assert.strictEqual(isArray(null), false);
    });
  });

  describe('isFunction', () => {
    it('should return true for functions', () => {
      assert.strictEqual(isFunction(() => {}), true);
      assert.strictEqual(isFunction(function() {}), true);
      assert.strictEqual(isFunction(async () => {}), true);
    });

    it('should return false for non-functions', () => {
      assert.strictEqual(isFunction({}), false);
      assert.strictEqual(isFunction('string'), false);
      assert.strictEqual(isFunction(123), false);
    });
  });

  describe('isPromise', () => {
    it('should return true for Promises', () => {
      assert.strictEqual(isPromise(Promise.resolve()), true);
      assert.strictEqual(isPromise(new Promise(() => {})), true);
    });

    it('should return true for thenable objects', () => {
      const thenable = { then: () => {} };
      assert.strictEqual(isPromise(thenable), true);
    });

    it('should return false for non-promises', () => {
      assert.strictEqual(isPromise({}), false);
      assert.strictEqual(isPromise('string'), false);
      assert.strictEqual(isPromise(123), false);
    });
  });

  describe('isValidationResult', () => {
    it('should return true for valid ValidationResult', () => {
      const result = {
        enabled: true,
        provider: 'gemini',
        score: 0.8,
        issues: []
      };
      assert.strictEqual(isValidationResult(result), true);
    });

    it('should return true with null score', () => {
      const result = {
        enabled: true,
        provider: 'gemini',
        score: null,
        issues: []
      };
      assert.strictEqual(isValidationResult(result), true);
    });

    it('should return false for invalid structure', () => {
      assert.strictEqual(isValidationResult({}), false);
      assert.strictEqual(isValidationResult({ enabled: true }), false);
      assert.strictEqual(isValidationResult({ enabled: true, provider: 'gemini' }), false);
      assert.strictEqual(isValidationResult(null), false);
      assert.strictEqual(isValidationResult('string'), false);
    });
  });

  describe('isValidationContext', () => {
    it('should return true for null/undefined', () => {
      assert.strictEqual(isValidationContext(null), true);
      assert.strictEqual(isValidationContext(undefined), true);
    });

    it('should return true for empty object', () => {
      assert.strictEqual(isValidationContext({}), true);
    });

    it('should return true for valid context', () => {
      const context = {
        viewport: { width: 1920, height: 1080 },
        timeout: 5000,
        useCache: true
      };
      assert.strictEqual(isValidationContext(context), true);
    });

    it('should return false for invalid viewport', () => {
      assert.strictEqual(isValidationContext({ viewport: {} }), false);
      assert.strictEqual(isValidationContext({ viewport: { width: 1920 } }), false);
      assert.strictEqual(isValidationContext({ viewport: 'invalid' }), false);
    });

    it('should return false for invalid timeout', () => {
      assert.strictEqual(isValidationContext({ timeout: 'invalid' }), false);
    });

    it('should return false for invalid useCache', () => {
      assert.strictEqual(isValidationContext({ useCache: 'invalid' }), false);
    });

    it('should return false for non-object', () => {
      assert.strictEqual(isValidationContext('string'), false);
      assert.strictEqual(isValidationContext(123), false);
    });
  });

  describe('isPersona', () => {
    it('should return true for valid Persona', () => {
      const persona = {
        name: 'Developer',
        perspective: 'Technical',
        focus: ['accessibility', 'performance']
      };
      assert.strictEqual(isPersona(persona), true);
    });

    it('should return false for missing required fields', () => {
      assert.strictEqual(isPersona({}), false);
      assert.strictEqual(isPersona({ name: 'Developer' }), false);
      assert.strictEqual(isPersona({ name: 'Developer', perspective: 'Technical' }), false);
    });

    it('should return false for empty strings', () => {
      assert.strictEqual(isPersona({ name: '', perspective: 'Technical', focus: [] }), false);
      assert.strictEqual(isPersona({ name: 'Developer', perspective: '', focus: [] }), false);
    });

    it('should return false for invalid focus', () => {
      assert.strictEqual(isPersona({ name: 'Developer', perspective: 'Technical', focus: 'invalid' }), false);
    });
  });

  describe('isTemporalNote', () => {
    it('should return true for valid TemporalNote', () => {
      const note = {
        timestamp: Date.now(),
        elapsed: 100,
        score: 0.8,
        observation: 'Test',
        step: 'step1'
      };
      assert.strictEqual(isTemporalNote(note), true);
    });

    it('should return true for minimal note', () => {
      assert.strictEqual(isTemporalNote({}), true);
    });

    it('should return true with null score', () => {
      const note = { score: null };
      assert.strictEqual(isTemporalNote(note), true);
    });

    it('should return false for invalid timestamp', () => {
      assert.strictEqual(isTemporalNote({ timestamp: 'invalid' }), false);
    });

    it('should return false for invalid score', () => {
      assert.strictEqual(isTemporalNote({ score: 'invalid' }), false);
    });

    it('should return false for non-object', () => {
      assert.strictEqual(isTemporalNote(null), false);
      assert.strictEqual(isTemporalNote('string'), false);
    });
  });
});

describe('Assertions', () => {
  describe('assertObject', () => {
    it('should not throw for valid objects', () => {
      assert.doesNotThrow(() => assertObject({}));
      assert.doesNotThrow(() => assertObject({ a: 1 }));
    });

    it('should throw ValidationError for null', () => {
      assert.throws(() => assertObject(null), ValidationError);
    });

    it('should throw ValidationError for arrays', () => {
      assert.throws(() => assertObject([]), ValidationError);
    });

    it('should throw ValidationError for primitives', () => {
      assert.throws(() => assertObject('string'), ValidationError);
      assert.throws(() => assertObject(123), ValidationError);
    });

    it('should include custom name in error', () => {
      try {
        assertObject(null, 'myValue');
        assert.fail('Should have thrown');
      } catch (error) {
        assert.ok(error.message.includes('myValue'));
      }
    });
  });

  describe('assertString', () => {
    it('should not throw for strings', () => {
      assert.doesNotThrow(() => assertString(''));
      assert.doesNotThrow(() => assertString('hello'));
    });

    it('should throw ValidationError for non-strings', () => {
      assert.throws(() => assertString(123), ValidationError);
      assert.throws(() => assertString(null), ValidationError);
    });
  });

  describe('assertNonEmptyString', () => {
    it('should not throw for non-empty strings', () => {
      assert.doesNotThrow(() => assertNonEmptyString('hello'));
      assert.doesNotThrow(() => assertNonEmptyString(' '));
    });

    it('should throw ValidationError for empty strings', () => {
      assert.throws(() => assertNonEmptyString(''), ValidationError);
    });

    it('should throw ValidationError for non-strings', () => {
      assert.throws(() => assertNonEmptyString(123), ValidationError);
    });
  });

  describe('assertNumber', () => {
    it('should not throw for numbers', () => {
      assert.doesNotThrow(() => assertNumber(0));
      assert.doesNotThrow(() => assertNumber(123));
      assert.doesNotThrow(() => assertNumber(-123));
    });

    it('should throw ValidationError for NaN', () => {
      assert.throws(() => assertNumber(NaN), ValidationError);
    });

    it('should throw ValidationError for non-numbers', () => {
      assert.throws(() => assertNumber('123'), ValidationError);
      assert.throws(() => assertNumber(null), ValidationError);
    });
  });

  describe('assertArray', () => {
    it('should not throw for arrays', () => {
      assert.doesNotThrow(() => assertArray([]));
      assert.doesNotThrow(() => assertArray([1, 2, 3]));
    });

    it('should throw ValidationError for non-arrays', () => {
      assert.throws(() => assertArray({}), ValidationError);
      assert.throws(() => assertArray('string'), ValidationError);
    });
  });

  describe('assertFunction', () => {
    it('should not throw for functions', () => {
      assert.doesNotThrow(() => assertFunction(() => {}));
      assert.doesNotThrow(() => assertFunction(function() {}));
    });

    it('should throw ValidationError for non-functions', () => {
      assert.throws(() => assertFunction({}), ValidationError);
      assert.throws(() => assertFunction('string'), ValidationError);
    });
  });
});

describe('Utility Functions', () => {
  describe('pick', () => {
    it('should pick specified keys', () => {
      const obj = { a: 1, b: 2, c: 3 };
      const result = pick(obj, ['a', 'c']);
      assert.deepStrictEqual(result, { a: 1, c: 3 });
    });

    it('should ignore missing keys', () => {
      const obj = { a: 1, b: 2 };
      const result = pick(obj, ['a', 'c', 'd']);
      assert.deepStrictEqual(result, { a: 1 });
    });

    it('should return empty object for no keys', () => {
      const obj = { a: 1, b: 2 };
      const result = pick(obj, []);
      assert.deepStrictEqual(result, {});
    });

    it('should throw for non-object', () => {
      assert.throws(() => pick(null, ['a']), ValidationError);
      assert.throws(() => pick('string', ['a']), ValidationError);
    });

    it('should throw for non-array keys', () => {
      assert.throws(() => pick({}, 'string'), ValidationError);
    });
  });

  describe('getProperty', () => {
    it('should return property value when exists', () => {
      const obj = { a: 1, b: 2 };
      assert.strictEqual(getProperty(obj, 'a', 0), 1);
      assert.strictEqual(getProperty(obj, 'b', 0), 2);
    });

    it('should return default when property missing', () => {
      const obj = { a: 1 };
      assert.strictEqual(getProperty(obj, 'b', 0), 0);
      assert.strictEqual(getProperty(obj, 'c', 'default'), 'default');
    });

    it('should return default when property is undefined', () => {
      const obj = { a: 1, b: undefined };
      assert.strictEqual(getProperty(obj, 'b', 'default'), 'default');
    });

    it('should return value when property is null', () => {
      const obj = { a: null };
      assert.strictEqual(getProperty(obj, 'a', 'default'), null);
    });

    it('should throw for non-object', () => {
      assert.throws(() => getProperty(null, 'a', 0), ValidationError);
    });

    it('should throw for non-string key', () => {
      assert.throws(() => getProperty({}, 123, 0), ValidationError);
    });
  });
});
