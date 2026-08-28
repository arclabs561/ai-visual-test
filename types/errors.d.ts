export class AIBrowserTestError extends Error { constructor(message: string, details?: Record<string, unknown>); }
export class CacheError extends AIBrowserTestError {}
export class ConfigError extends AIBrowserTestError {}
export class FileError extends AIBrowserTestError { filePath: string; }
export class ProviderError extends AIBrowserTestError { provider: string; }
export class StateMismatchError extends AIBrowserTestError {}
export class TimeoutError extends AIBrowserTestError {}
export class ValidationError extends AIBrowserTestError {}
export function calculateBackoff(attempt: number, options?: Record<string, unknown>): number;
export function enhanceErrorMessage(error: unknown, context?: Record<string, unknown>): Error;
export function initErrorHandlers(options?: Record<string, unknown>): void;
export function isAIBrowserTestError(error: unknown): error is AIBrowserTestError;
export function isErrorType(error: unknown, ErrorClass: new (...args: never[]) => Error): boolean;
export function isRetryableError(error: unknown): boolean;
export function retryWithBackoff<T>(fn: () => Promise<T>, options?: Record<string, unknown>): Promise<T>;
