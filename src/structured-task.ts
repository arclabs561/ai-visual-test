import { ProviderError } from './errors.js';
import { retryWithBackoff, isRetryableError } from './retry.js';
import type {
  ParsedProviderResponse,
  ProviderAdapter,
  ProviderCall,
  StructuredOutputSpec,
} from './provider-adapters.js';

export interface StructuredTaskParseResult<T> {
  outcome: T;
  format: string;
  diagnostics: string[];
}

export class StructuredTaskContractError extends Error {
  diagnostics: string[];

  constructor(message: string, diagnostics: string[]) {
    super(message);
    this.name = 'StructuredTaskContractError';
    this.diagnostics = diagnostics;
  }
}

export interface StructuredTaskDefinition<T> {
  name: string;
  schema: object;
  invalidOutputDescription: string;
  parse(input: unknown): StructuredTaskParseResult<T>;
  buildRepairInstruction(diagnostics: string[]): string;
}

export interface ExecuteStructuredTaskInput<T> {
  adapter: ProviderAdapter;
  call: Omit<ProviderCall, 'structuredOutput' | 'prompt'>;
  prompt: string;
  task: StructuredTaskDefinition<T>;
  structuredOutput: StructuredOutputSpec;
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  onAttempt?: (attempt: number) => void;
  onRetry?: (error: Error, attempt: number, delay: number) => void;
}

export interface StructuredTaskExecution<T> extends ParsedProviderResponse, StructuredTaskParseResult<T> {
  attempts: number;
  structuredOutput: StructuredOutputSpec;
}

function diagnosticsFrom(error: unknown): string[] {
  const candidate = error !== null && typeof error === 'object'
    ? (error as { diagnostics?: unknown }).diagnostics
    : undefined;
  const diagnostics = Array.isArray(candidate)
    ? candidate.filter((value): value is string => typeof value === 'string' && value.length > 0)
    : [];
  return [...new Set(diagnostics)].slice(0, 8).length > 0
    ? [...new Set(diagnostics)].slice(0, 8)
    : ['invalid_output'];
}

/**
 * Execute a private structured task. The caller owns prompt composition,
 * caching, deadlines, rate limits, and interpretation of the typed outcome.
 */
export async function executeStructuredTask<T>({
  adapter,
  call,
  prompt,
  task,
  structuredOutput,
  maxRetries,
  baseDelay,
  maxDelay,
  onAttempt,
  onRetry,
}: ExecuteStructuredTaskInput<T>): Promise<StructuredTaskExecution<T>> {
  if (structuredOutput.name !== task.name || structuredOutput.schema !== task.schema) {
    throw new TypeError('Structured output specification does not match the task contract');
  }
  let attempts = 0;
  let effectivePrompt = prompt;
  const result = await retryWithBackoff(async () => {
    attempts++;
    onAttempt?.(attempts);
    const response = await adapter.call({ ...call, prompt: effectivePrompt, structuredOutput });
    const parsedResponse = await adapter.parseResponse(response);
    try {
      const parsedTask = task.parse(parsedResponse.judgment);
      return { ...parsedResponse, ...parsedTask };
    } catch (error) {
      if (!(error instanceof StructuredTaskContractError)) throw error;
      const diagnostics = diagnosticsFrom(error);
      effectivePrompt = `${prompt}\n\n${task.buildRepairInstruction(diagnostics)}`;
      throw new ProviderError(
        `${adapter.provider} returned an invalid ${task.invalidOutputDescription}`,
        adapter.provider,
        { retryable: true, diagnostics, failureKind: 'output_contract' },
      );
    }
  }, {
    maxRetries,
    baseDelay,
    maxDelay,
    ...(onRetry ? { onRetry } : {}),
    retryable: error => (error as { details?: { retryable?: boolean } }).details?.retryable === true
      || isRetryableError(error),
  });
  return { ...result, attempts, structuredOutput };
}
