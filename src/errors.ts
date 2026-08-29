/** Serializable representation of an ai-visual-test error. */
interface SerializedAIBrowserTestError {
  name: string;
  code: string;
  message: string;
  details: Record<string, unknown>;
  stack?: string | undefined;
}

type ErrorDetails = Record<string, unknown>;

/** Base error class for all ai-visual-test errors. */
export class AIBrowserTestError extends Error {
  readonly code: string;
  readonly details: ErrorDetails;

  constructor(message: string, code: string, details: ErrorDetails = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /** Convert this error to its safe serialized representation. */
  toJSON(): SerializedAIBrowserTestError {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      ...(process.env.NODE_ENV === 'development' || process.env.INCLUDE_STACK_TRACES === 'true'
        ? { stack: this.stack }
        : {}),
    };
  }
}

/** Validation error thrown when validation fails. */
export class ValidationError extends AIBrowserTestError {
  constructor(message: string, details: ErrorDetails = {}) {
    super(message, 'VALIDATION_ERROR', details);
  }
}

/** Cache error thrown when cache operations fail. */
export class CacheError extends AIBrowserTestError {
  constructor(message: string, details: ErrorDetails = {}) {
    super(message, 'CACHE_ERROR', details);
  }
}

/** Configuration error thrown when configuration is invalid. */
export class ConfigError extends AIBrowserTestError {
  constructor(message: string, details: ErrorDetails = {}) {
    super(message, 'CONFIG_ERROR', details);
  }
}

/** Provider error thrown when VLLM provider operations fail. */
export class ProviderError extends AIBrowserTestError {
  readonly provider: string;

  constructor(message: string, provider: string, details: ErrorDetails = {}) {
    super(message, 'PROVIDER_ERROR', { provider, ...details });
    this.provider = provider;
  }
}

/** Timeout error thrown when operations time out. */
export class TimeoutError extends AIBrowserTestError {
  readonly timeout: number;

  constructor(message: string, timeout: number, details: ErrorDetails = {}) {
    super(message, 'TIMEOUT_ERROR', { timeout, ...details });
    this.timeout = timeout;
  }
}

/** File error thrown when file operations fail. */
export class FileError extends AIBrowserTestError {
  readonly filePath: string;

  constructor(message: string, filePath: string, details: ErrorDetails = {}) {
    super(message, 'FILE_ERROR', { filePath, ...details });
    this.filePath = filePath;
  }
}

/** State mismatch error thrown when extracted and expected state diverge. */
export class StateMismatchError extends ValidationError {
  readonly discrepancies: string[];
  readonly extracted: unknown;
  readonly expected: unknown;

  constructor(discrepancies: string[], extracted: unknown, expected: unknown, message?: string) {
    const defaultMessage = `State mismatch: ${discrepancies.length} discrepancy(ies) found`;
    super(message || defaultMessage, {
      discrepancies,
      extracted,
      expected,
      discrepancyCount: discrepancies.length,
    });
    this.discrepancies = discrepancies;
    this.extracted = extracted;
    this.expected = expected;
  }
}

/** Check whether an unknown value is an ai-visual-test error. */
export function isAIBrowserTestError(error: unknown): error is AIBrowserTestError {
  return error instanceof AIBrowserTestError;
}

/** Check whether an unknown error has a specific ai-visual-test error type. */
export function isErrorType<T extends AIBrowserTestError>(
  error: unknown,
  errorClass: abstract new (...args: any[]) => T,
): error is T {
  return error instanceof errorClass;
}
