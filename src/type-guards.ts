/** Runtime type checks and assertion helpers. */

import { ValidationError } from '#errors';
import type { Persona, ValidationContext, ValidationResult } from '#public-contract';
import type { TemporalNote } from '#temporal-core';

type UnknownRecord = Record<string, unknown>;
type UnknownFunction = (...args: never[]) => unknown;
export type Thenable = { then: UnknownFunction };

/** Check whether a value is a non-null, non-array object. */
export function isObject<T = unknown>(value: unknown): value is Record<string, T> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Check whether a value is a string. */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/** Check whether a value is a number other than `NaN`. */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

/** Check whether a value is a positive integer. */
export function isPositiveInteger(value: unknown): value is number {
  return isNumber(value) && Number.isInteger(value) && value > 0;
}

/** Check whether a value is a non-empty string. */
export function isNonEmptyString(value: unknown): value is string {
  return isString(value) && value.length > 0;
}

/** Check whether a value is an array. */
export function isArray<T = unknown>(value: unknown): value is T[] {
  return Array.isArray(value);
}

/** Check whether a value is callable. */
export function isFunction(value: unknown): value is UnknownFunction {
  return typeof value === 'function';
}

/** Preserve an existing `PromiseLike<T>` narrowing. */
export function isPromise<T>(value: PromiseLike<T>): value is PromiseLike<T>;
/** Check whether an unknown value is a promise or thenable. */
export function isPromise(value: unknown): value is Thenable;
export function isPromise(value: unknown): value is Thenable {
  return value instanceof Promise || (isObject(value) && isFunction(value.then));
}

/** Check whether a value has the required validation-result shape. */
export function isValidationResult(value: unknown): value is ValidationResult {
  if (!isObject(value)) return false;
  return (
    typeof value.enabled === 'boolean'
    && typeof value.provider === 'string'
    && (value.score === null || isNumber(value.score))
    && isArray(value.issues) && value.issues.every(isString)
    && isArray(value.recommendations) && value.recommendations.every(isString)
  );
}

/** Check whether a value is an optional validation context. */
export function isValidationContext(value: unknown): value is ValidationContext | null | undefined {
  if (value === null || value === undefined) return true;
  if (!isObject(value)) return false;

  if (value.viewport !== undefined) {
    if (
      !isObject(value.viewport)
      || !isNumber(value.viewport.width)
      || !isNumber(value.viewport.height)
    ) {
      return false;
    }
  }

  if (value.timeout !== undefined && !isNumber(value.timeout)) return false;
  if (value.useCache !== undefined && typeof value.useCache !== 'boolean') return false;
  if (value.promptBuilder !== undefined && !isFunction(value.promptBuilder)) return false;
  return true;
}

/** Check whether a value has the required persona shape. */
export function isPersona(value: unknown): value is Persona {
  return isObject(value)
    && isNonEmptyString(value.name)
    && isNonEmptyString(value.perspective)
    && isArray(value.focus) && value.focus.every(isString);
}

/** Check whether optional temporal-note fields have valid runtime types. */
export function isTemporalNote(value: unknown): value is TemporalNote {
  if (!isObject(value)) return false;
  if (value.timestamp !== undefined && !isNumber(value.timestamp)) return false;
  if (value.elapsed !== undefined && !isNumber(value.elapsed)) return false;
  if (value.score !== undefined && !isNumber(value.score)) return false;
  if (value.observation !== undefined && !isString(value.observation)) return false;
  if (value.step !== undefined && !isString(value.step)) return false;
  return true;
}

/** Assert that a value is a non-null, non-array object. */
export function assertObject<T = unknown>(value: unknown, name = 'value'): asserts value is Record<string, T> {
  if (!isObject<T>(value)) {
    throw new ValidationError(`${name} must be an object`, { received: typeof value });
  }
}

/** Assert that a value is a string. */
export function assertString(value: unknown, name = 'value'): asserts value is string {
  if (!isString(value)) {
    throw new ValidationError(`${name} must be a string`, { received: typeof value });
  }
}

/** Assert that a value is a non-empty string. */
export function assertNonEmptyString(value: unknown, name = 'value'): asserts value is string {
  assertString(value, name);
  if (value.length === 0) throw new ValidationError(`${name} cannot be empty`);
}

/** Assert that a value is a number other than `NaN`. */
export function assertNumber(value: unknown, name = 'value'): asserts value is number {
  if (!isNumber(value)) {
    throw new ValidationError(`${name} must be a number`, { received: typeof value });
  }
}

/** Assert that a value is an array. */
export function assertArray<T = unknown>(value: unknown, name = 'value'): asserts value is T[] {
  if (!isArray<T>(value)) {
    throw new ValidationError(`${name} must be an array`, { received: typeof value });
  }
}

/** Assert that a value is callable. */
export function assertFunction(value: unknown, name = 'value'): asserts value is UnknownFunction {
  if (!isFunction(value)) {
    throw new ValidationError(`${name} must be a function`, { received: typeof value });
  }
}

/** Return the requested keys that are present on an object. */
export function pick<T extends UnknownRecord, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K> {
  assertObject(obj, 'obj');
  assertArray<K>(keys, 'keys');

  const result: Partial<Pick<T, K>> = {};
  for (const key of keys) {
    if (key in obj) result[key] = obj[key];
  }
  return result as Pick<T, K>;
}

/** Return an object property when it is present and defined, otherwise a default. */
export function getProperty<T extends UnknownRecord, D>(
  obj: T,
  key: string,
  defaultValue: D,
): T[keyof T] | D {
  assertObject(obj, 'obj');
  assertString(key, 'key');
  const source = obj as T;
  const value = source[key as keyof T];
  return key in obj && value !== undefined ? value : defaultValue;
}
