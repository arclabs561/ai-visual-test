/** Retry helpers with exponential backoff. */

import { ProviderError, TimeoutError } from '#errors';
import { warn } from './logger.js';
import { RETRY_CONSTANTS } from './constants.js';

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  onRetry?: ((error: Error, attempt: number, delay: number) => void) | null;
  retryable?: (error: Error) => boolean;
}

function normalizeError(caught: unknown): Error {
  if (caught instanceof Error) return caught;
  try {
    return new Error(typeof caught === 'string' ? caught : String(caught));
  } catch {
    return new Error('Unknown error');
  }
}

function assertRetryCount(maxRetries: number): void {
  if (!Number.isInteger(maxRetries) || maxRetries < 0) {
    throw new RangeError('maxRetries must be a non-negative integer');
  }
}

/** Check whether an error represents a transient failure. */
export function isRetryableError(error: Error): boolean {
  if (error instanceof TimeoutError) return true;
  if (error.name === 'AbortError' || error.name === 'NetworkError') return true;
  if (error.message?.includes('timeout') || error.message?.includes('network')) return true;

  if (error instanceof ProviderError && error.details.statusCode === 429) return true;
  if (error.message?.includes('rate limit') || error.message?.includes('429')) return true;

  if (error instanceof ProviderError) {
    const status = error.details.statusCode as number | undefined;
    if (status !== undefined && status >= 500 && status < 600) return true;
  }

  return error.message?.includes('temporarily unavailable')
    || error.message?.includes('service unavailable')
    || error.message?.includes('internal server error')
    || false;
}

/** Calculate an exponential-backoff delay, optionally with symmetric jitter. */
export function calculateBackoff(
  attempt: number,
  baseDelay: number = RETRY_CONSTANTS.DEFAULT_BASE_DELAY_MS,
  maxDelay: number = RETRY_CONSTANTS.DEFAULT_MAX_DELAY_MS,
  jitter: boolean = true,
): number {
  const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  if (!jitter) return exponentialDelay;

  const jitterAmount = exponentialDelay * RETRY_CONSTANTS.JITTER_PERCENTAGE;
  const jitterValue = (Math.random() * 2 - 1) * jitterAmount;
  return Math.max(0, exponentialDelay + jitterValue);
}

/** Retry an asynchronous operation until it succeeds or reaches its retry limit. */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxRetries = RETRY_CONSTANTS.DEFAULT_MAX_RETRIES,
    baseDelay = RETRY_CONSTANTS.DEFAULT_BASE_DELAY_MS,
    maxDelay = RETRY_CONSTANTS.DEFAULT_MAX_DELAY_MS,
    onRetry = null,
    retryable = isRetryableError,
  } = options;

  assertRetryCount(maxRetries);

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (caught: unknown) {
      const error = normalizeError(caught);
      lastError = error;
      if (!retryable(error)) throw error;
      if (attempt >= maxRetries) break;

      const delay = calculateBackoff(attempt, baseDelay, maxDelay);
      if (onRetry) {
        onRetry(error, attempt + 1, delay);
      } else {
        warn(`[Retry] Attempt ${attempt + 1}/${maxRetries} failed: ${error.message}. Retrying in ${delay}ms...`);
      }
      await new Promise<void>(resolve => setTimeout(resolve, delay));
    }
  }

  const enhancedMessage = enhanceErrorMessage(lastError as Error, maxRetries + 1, 'retryWithBackoff');
  if (lastError instanceof Error) {
    lastError.message = enhancedMessage;
  } else {
    lastError = new Error(enhancedMessage);
  }
  throw lastError;
}

/** Add retry context to an error message. */
export function enhanceErrorMessage(error: Error, attempts: number, operation: string): string {
  const baseMessage = error.message || 'Unknown error';
  const context = [`Operation: ${operation}`, `Attempts: ${attempts}`];

  if (error instanceof ProviderError) {
    context.push(`Provider: ${error.provider}`);
    if (error.details.statusCode) context.push(`HTTP Status: ${error.details.statusCode}`);
  }
  if (error instanceof TimeoutError) context.push(`Timeout: ${error.timeout}ms`);
  return `${baseMessage} (${context.join(', ')})`;
}
