/**
 * A deliberately narrow OpenRouter boundary for dataset evaluation.
 *
 * It accepts only verified local image files, posts only to OpenRouter's
 * completions endpoint, and returns parsed outcomes plus aggregate usage. It
 * never persists or returns the provider's raw response or an API credential.
 */
import { readLocalVisionImage } from './local-vision-evaluator.js';
import type {
  VisionBinaryOutcome,
  VisionEvaluationOutcome,
  VisionEvaluationReceipt,
  VisionEvaluationRequest,
  VisionEvaluationResponseKind,
} from './vision-evaluation-contract.js';

export const DEFAULT_OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

const DEFAULT_TIMEOUT_MS = 90_000;
const DEFAULT_MAXIMUM_IMAGE_BYTES = 20 * 1024 * 1024;
const DEFAULT_MAXIMUM_RESPONSE_BYTES = 256 * 1024;
/** Leaves room for required model reasoning while staying bounded for a JSON verdict. */
export const DEFAULT_OPENROUTER_MAXIMUM_OUTPUT_TOKENS = 1_024;
const MAX_IMAGES = 2;
const MAX_PROMPT_CHARACTERS = 16_000;
const MAX_MODEL_CHARACTERS = 256;
const MAXIMUM_TIMEOUT_MS = 5 * 60_000;
const MAXIMUM_OUTPUT_TOKENS = 4_096;
const MAX_PROVIDER_SLUG_CHARACTERS = 256;

/**
 * Gemini reasoning-mandatory models otherwise consume the completion allowance
 * before emitting the structured verdict. `exclude` keeps reasoning out of
 * persisted provider content while preserving the model's minimal reasoning.
 */
export const OPENROUTER_EVALUATION_REASONING = Object.freeze({ effort: 'minimal', exclude: true } as const);

export interface OpenRouterVisionRequestConfig {
  maximumOutputTokens: number;
  reasoning: typeof OPENROUTER_EVALUATION_REASONING;
  integerScore?: true;
  providerRouting?: OpenRouterProviderRouting;
}

/** Exact provider pinning for reproducible model routing. */
export interface OpenRouterProviderRouting {
  only: readonly string[];
  allow_fallbacks: false;
  require_parameters: true;
  data_collection: 'deny';
}

/** @deprecated Use VisionEvaluationResponseKind from vision-evaluation-contract. */
export type OpenRouterVisionResponseKind = VisionEvaluationResponseKind;
/** @deprecated Use VisionBinaryOutcome from vision-evaluation-contract. */
export type OpenRouterVisionBinaryOutcome = VisionBinaryOutcome;
/** @deprecated Use VisionEvaluationOutcome from vision-evaluation-contract. */
export type OpenRouterVisionOutcome = VisionEvaluationOutcome;

/** @deprecated Use VisionEvaluationRequest plus OpenRouter transport options. */
export interface OpenRouterVisionEvaluationRequest extends VisionEvaluationRequest {
  /** Optional non-persisted override; otherwise OPENROUTER_API_KEY is resolved at call time. */
  apiKey?: string;
  /** Optional exact OpenRouter provider endpoint slug; aliases and fallback routes are rejected. */
  providerSlug?: string;
  maximumOutputTokens?: number;
  /** Test seam; production callers should leave this unset. */
  fetchImplementation?: typeof fetch;
  /** Test seam; production callers should leave this unset. */
  environment?: Readonly<Record<string, string | undefined>>;
}

export interface OpenRouterUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** OpenRouter-reported credits, when the provider includes them. */
  cost?: number;
}

/**
 * Cost availability is explicit: a partial subtotal is never a run total, and
 * an absent provider cost is never converted to zero.
 */
export type OpenRouterCostSummary =
  | { status: 'not-applicable'; reportedCalls: 0; missingCalls: 0 }
  | { status: 'unavailable'; reportedCalls: 0; missingCalls: number }
  | { status: 'partial'; reportedCalls: number; missingCalls: number; reportedCost: number }
  | { status: 'complete'; reportedCalls: number; missingCalls: 0; reportedCost: number };

export interface OpenRouterUsageSummary {
  calls: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: OpenRouterCostSummary;
}

export interface OpenRouterVisionEvaluation extends VisionEvaluationReceipt {
  usage: OpenRouterUsage;
  /** Storage-safe request controls required to reproduce the completed call. */
  requestConfig: OpenRouterVisionRequestConfig;
}

export class OpenRouterVisionEvaluatorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenRouterVisionEvaluatorError';
  }
}

function fail(message: string): never {
  throw new OpenRouterVisionEvaluatorError(message);
}

function positiveSafeInteger(value: number, subject: string): void {
  if (!Number.isSafeInteger(value) || value < 1) fail(`${subject} must be a positive safe integer`);
}

function nonNegativeSafeInteger(value: unknown, subject: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    fail(`OpenRouter usage ${subject} must be a non-negative safe integer`);
  }
  return value;
}

function finiteNumber(value: number, subject: string): void {
  if (!Number.isFinite(value)) fail(`${subject} must be finite`);
}

function boundedText(value: unknown, subject: string, maximumCharacters: number): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maximumCharacters || value.includes('\0')) {
    fail(`${subject} must be a non-empty string no longer than ${maximumCharacters} characters`);
  }
  return value;
}

function providerRouting(providerSlug: string | undefined): OpenRouterProviderRouting | undefined {
  if (providerSlug === undefined) return undefined;
  const slug = boundedText(providerSlug, 'OpenRouter provider slug', MAX_PROVIDER_SLUG_CHARACTERS);
  if (!/^[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)*$/.test(slug)) {
    fail('OpenRouter provider slug must be a lowercase endpoint slug with optional slash-separated segments');
  }
  return Object.freeze({
    only: Object.freeze([slug]),
    allow_fallbacks: false,
    require_parameters: true,
    data_collection: 'deny',
  });
}

function plainObject(value: unknown, subject: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(`${subject} must be a JSON object`);
  return value as Record<string, unknown>;
}

/** Reject aliases, query strings, and userinfo so evaluation cannot be redirected to another host. */
export function openRouterEndpoint(value: URL | string = DEFAULT_OPENROUTER_ENDPOINT): URL {
  let endpoint: URL;
  try {
    endpoint = new URL(value);
  } catch {
    return fail('OpenRouter endpoint must be an absolute URL');
  }
  if (
    endpoint.protocol !== 'https:'
    || endpoint.hostname !== 'openrouter.ai'
    || endpoint.port
    || endpoint.pathname !== '/api/v1/chat/completions'
    || endpoint.search
    || endpoint.hash
    || endpoint.username
    || endpoint.password
  ) {
    fail('OpenRouter endpoint must be the canonical HTTPS chat completions URL');
  }
  return endpoint;
}

/** Resolve credentials without ever incorporating their value into an error or result. */
export function resolveOpenRouterApiKey(
  explicitApiKey: string | undefined,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const apiKey = explicitApiKey ?? environment.OPENROUTER_API_KEY;
  if (typeof apiKey !== 'string' || apiKey.trim().length === 0 || apiKey.length > 4_096 || apiKey.includes('\0')) {
    fail('OpenRouter API key must be supplied or configured in OPENROUTER_API_KEY');
  }
  return apiKey;
}

function responseSchema(kind: OpenRouterVisionResponseKind, integerScore: boolean): Record<string, unknown> {
  if (kind === 'binary') {
    return {
      type: 'object', properties: { value: { type: 'boolean' } }, required: ['value'], additionalProperties: false,
    };
  }
  if (kind === 'scalar') {
    return {
      type: 'object', properties: { score: { type: integerScore ? 'integer' : 'number' } }, required: ['score'], additionalProperties: false,
    };
  }
  if (kind === 'grounding') {
    return {
      type: 'object', properties: { x: { type: 'number', minimum: 0, maximum: 1000 }, y: { type: 'number', minimum: 0, maximum: 1000 } },
      required: ['x', 'y'], additionalProperties: false,
    };
  }
  return {
    type: 'object', properties: { winner: { type: 'string', enum: ['A', 'B'] } },
    required: ['winner'], additionalProperties: false,
  };
}

function parseModelJson(content: unknown): Record<string, unknown> {
  const text = boundedText(content, 'OpenRouter model content', MAX_PROMPT_CHARACTERS);
  const clean = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try {
    return plainObject(JSON.parse(clean) as unknown, 'OpenRouter model output');
  } catch (error) {
    if (error instanceof OpenRouterVisionEvaluatorError) throw error;
    return fail('OpenRouter model output was not valid JSON');
  }
}

/** Parse the narrow scalar, pairwise, and grounding response envelopes. */
export function parseOpenRouterVisionOutcome(kind: OpenRouterVisionResponseKind, content: unknown, integerScore = false): OpenRouterVisionOutcome {
  const result = parseModelJson(content);
  if (kind === 'binary') {
    if (Object.keys(result).length !== 1 || typeof result.value !== 'boolean') {
      fail('OpenRouter binary response must be exactly { "value": boolean }');
    }
    return { kind, value: result.value };
  }
  if (kind === 'scalar') {
    if (Object.keys(result).length !== 1 || typeof result.score !== 'number' || !Number.isFinite(result.score) || (integerScore && !Number.isInteger(result.score))) {
      fail(`OpenRouter scalar response must be exactly { "score": finite-${integerScore ? 'integer' : 'number'} }`);
    }
    return { kind, score: result.score };
  }
  if (kind === 'grounding') {
    if (
      Object.keys(result).length !== 2
      || typeof result.x !== 'number' || !Number.isFinite(result.x) || result.x < 0 || result.x > 1000
      || typeof result.y !== 'number' || !Number.isFinite(result.y) || result.y < 0 || result.y > 1000
    ) {
      fail('OpenRouter grounding response must be exactly { "x": finite-number 0 through 1000, "y": finite-number 0 through 1000 } in normalized coordinates');
    }
    return { kind, x: result.x, y: result.y };
  }
  if (
    Object.keys(result).length !== 1
    || (result.winner !== 'A' && result.winner !== 'B')
  ) {
    fail('OpenRouter pairwise response must be exactly { "winner": "A" | "B" }');
  }
  const point: 0 | 1 = result.winner === 'A' ? 1 : 0;
  return { kind, winner: result.winner, point };
}

async function readBoundedResponse(response: Response, maximumBytes: number): Promise<unknown> {
  const advertised = response.headers.get('content-length');
  if (advertised !== null && (!/^\d+$/.test(advertised) || Number(advertised) > maximumBytes)) {
    fail(`OpenRouter response exceeds the ${maximumBytes}-byte limit`);
  }
  if (response.body === null) fail('OpenRouter response had no body');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    let next: ReadableStreamReadResult<Uint8Array>;
    try {
      next = await reader.read();
    } catch {
      return fail('OpenRouter response body could not be read');
    }
    if (next.done) break;
    total += next.value.byteLength;
    if (total > maximumBytes) {
      try { await reader.cancel(); } catch { /* best-effort stop after the hard bound */ }
      fail(`OpenRouter response exceeds the ${maximumBytes}-byte limit`);
    }
    chunks.push(next.value);
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks.map(chunk => Buffer.from(chunk)), total))) as unknown;
  } catch {
    return fail('OpenRouter response was not valid UTF-8 JSON');
  }
}

function parseUsage(value: unknown): OpenRouterUsage {
  const usage = plainObject(value, 'OpenRouter usage');
  const promptTokens = nonNegativeSafeInteger(usage.prompt_tokens, 'prompt_tokens');
  const completionTokens = nonNegativeSafeInteger(usage.completion_tokens, 'completion_tokens');
  const totalTokens = nonNegativeSafeInteger(usage.total_tokens, 'total_tokens');
  if (totalTokens !== promptTokens + completionTokens) fail('OpenRouter usage total_tokens must equal prompt_tokens plus completion_tokens');
  if (usage.cost === undefined) return { promptTokens, completionTokens, totalTokens };
  if (typeof usage.cost !== 'number' || !Number.isFinite(usage.cost) || usage.cost < 0) {
    fail('OpenRouter usage cost must be a non-negative finite number when provided');
  }
  return { promptTokens, completionTokens, totalTokens, cost: usage.cost };
}

function checkedUsageRecord(value: unknown): OpenRouterUsage {
  const usage = plainObject(value, 'OpenRouter usage record');
  const promptTokens = nonNegativeSafeInteger(usage.promptTokens, 'record promptTokens');
  const completionTokens = nonNegativeSafeInteger(usage.completionTokens, 'record completionTokens');
  const totalTokens = nonNegativeSafeInteger(usage.totalTokens, 'record totalTokens');
  if (totalTokens !== promptTokens + completionTokens) {
    fail('OpenRouter usage record totalTokens must equal promptTokens plus completionTokens');
  }
  if (usage.cost === undefined) return { promptTokens, completionTokens, totalTokens };
  if (typeof usage.cost !== 'number' || !Number.isFinite(usage.cost) || usage.cost < 0) {
    fail('OpenRouter usage record cost must be a non-negative finite number when provided');
  }
  return { promptTokens, completionTokens, totalTokens, cost: usage.cost };
}

/** Aggregate run receipts without manufacturing a cost for calls that lack one. */
export function aggregateOpenRouterUsage(records: readonly OpenRouterUsage[]): OpenRouterUsageSummary {
  if (!Array.isArray(records)) fail('OpenRouter usage records must be an array');
  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;
  let reportedCalls = 0;
  let reportedCost = 0;
  for (const record of records) {
    const usage = checkedUsageRecord(record);
    promptTokens += usage.promptTokens;
    completionTokens += usage.completionTokens;
    totalTokens += usage.totalTokens;
    if (usage.cost !== undefined) {
      reportedCalls += 1;
      reportedCost += usage.cost;
    }
  }
  if (!Number.isSafeInteger(promptTokens) || !Number.isSafeInteger(completionTokens) || !Number.isSafeInteger(totalTokens)) {
    fail('OpenRouter usage aggregate exceeds safe integer token precision');
  }
  const calls = records.length;
  const missingCalls = calls - reportedCalls;
  if (calls === 0) {
    return { calls, promptTokens, completionTokens, totalTokens, cost: { status: 'not-applicable', reportedCalls: 0, missingCalls: 0 } };
  }
  if (reportedCalls === 0) {
    return { calls, promptTokens, completionTokens, totalTokens, cost: { status: 'unavailable', reportedCalls: 0, missingCalls } };
  }
  if (missingCalls > 0) {
    return { calls, promptTokens, completionTokens, totalTokens, cost: { status: 'partial', reportedCalls, missingCalls, reportedCost } };
  }
  return { calls, promptTokens, completionTokens, totalTokens, cost: { status: 'complete', reportedCalls, missingCalls: 0, reportedCost } };
}

function optionalIdentity(value: unknown, subject: string): string | undefined {
  if (value === undefined) return undefined;
  return boundedText(value, subject, MAX_MODEL_CHARACTERS);
}

function parseCompletion(
  value: unknown,
  responseKind: OpenRouterVisionResponseKind,
  requestConfig: OpenRouterVisionRequestConfig,
  integerScore: boolean,
  requestedModel: string,
): OpenRouterVisionEvaluation {
  const body = plainObject(value, 'OpenRouter response');
  const choices = body.choices;
  if (!Array.isArray(choices) || choices.length !== 1) fail('OpenRouter response must contain exactly one choice');
  const choice = plainObject(choices[0], 'OpenRouter response choice');
  if (choice.finish_reason === 'length') fail('OpenRouter response was truncated by the maximum output token limit');
  const message = plainObject(choice.message, 'OpenRouter response choice message');
  const model = boundedText(body.model, 'OpenRouter response model', MAX_MODEL_CHARACTERS);
  if (model !== requestedModel) fail('OpenRouter response model did not exactly match the requested model');
  const provider = optionalIdentity(body.provider, 'OpenRouter response provider');
  const nativeModel = optionalIdentity(body.native_model, 'OpenRouter response native model');
  return {
    outcome: parseOpenRouterVisionOutcome(responseKind, message.content, integerScore),
    model,
    ...(provider === undefined ? {} : { provider }),
    ...(nativeModel === undefined ? {} : { nativeModel }),
    usage: parseUsage(body.usage),
    requestConfig,
  };
}

/**
 * Submit a bounded, non-streaming remote evaluation to OpenRouter.
 * The result contains only the parsed judgment, routed model ID, and numeric
 * usage/cost fields, never pixel bytes, provider text, headers, or credentials.
 */
export async function evaluateOpenRouterVision(request: OpenRouterVisionEvaluationRequest): Promise<OpenRouterVisionEvaluation> {
  boundedText(request.prompt, 'OpenRouter vision prompt', MAX_PROMPT_CHARACTERS);
  boundedText(request.model, 'OpenRouter vision model', MAX_MODEL_CHARACTERS);
  if (request.responseKind !== 'scalar' && request.responseKind !== 'pairwise' && request.responseKind !== 'grounding' && request.responseKind !== 'binary') {
    fail('OpenRouter vision responseKind must be scalar, pairwise, grounding, or binary');
  }
  if (!Array.isArray(request.imagePaths) || request.imagePaths.length < 1 || request.imagePaths.length > MAX_IMAGES) {
    fail(`OpenRouter vision evaluation requires from 1 through ${MAX_IMAGES} images`);
  }
  if ((request.responseKind === 'pairwise' || request.responseKind === 'binary') && request.imagePaths.length !== 2) {
    fail(`OpenRouter ${request.responseKind} evaluation requires exactly two images`);
  }
  if (request.integerScore !== undefined && typeof request.integerScore !== 'boolean') fail('OpenRouter integerScore must be a boolean');
  if (request.integerScore === true && request.responseKind !== 'scalar') fail('OpenRouter integerScore is valid only for scalar responses');
  const integerScore = request.integerScore === true;
  const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maximumImageBytes = request.maximumImageBytes ?? DEFAULT_MAXIMUM_IMAGE_BYTES;
  const maximumResponseBytes = request.maximumResponseBytes ?? DEFAULT_MAXIMUM_RESPONSE_BYTES;
  const maximumOutputTokens = request.maximumOutputTokens ?? DEFAULT_OPENROUTER_MAXIMUM_OUTPUT_TOKENS;
  positiveSafeInteger(timeoutMs, 'OpenRouter vision timeout');
  positiveSafeInteger(maximumImageBytes, 'maximum image bytes');
  positiveSafeInteger(maximumResponseBytes, 'maximum response bytes');
  positiveSafeInteger(maximumOutputTokens, 'maximum output tokens');
  if (timeoutMs > MAXIMUM_TIMEOUT_MS) fail(`OpenRouter vision timeout must not exceed ${MAXIMUM_TIMEOUT_MS} milliseconds`);
  if (maximumImageBytes > DEFAULT_MAXIMUM_IMAGE_BYTES) fail(`maximum image bytes must not exceed ${DEFAULT_MAXIMUM_IMAGE_BYTES}`);
  if (maximumResponseBytes > DEFAULT_MAXIMUM_RESPONSE_BYTES) fail(`maximum response bytes must not exceed ${DEFAULT_MAXIMUM_RESPONSE_BYTES}`);
  if (maximumOutputTokens > MAXIMUM_OUTPUT_TOKENS) fail(`maximum output tokens must not exceed ${MAXIMUM_OUTPUT_TOKENS}`);
  if (request.minimumScore !== undefined) finiteNumber(request.minimumScore, 'minimum score');
  if (request.maximumScore !== undefined) finiteNumber(request.maximumScore, 'maximum score');
  if (request.minimumScore !== undefined && request.maximumScore !== undefined && request.minimumScore > request.maximumScore) {
    fail('minimum score must not exceed maximum score');
  }
  const endpoint = openRouterEndpoint();
  const apiKey = resolveOpenRouterApiKey(request.apiKey, request.environment);
  const requestedProviderRouting = providerRouting(request.providerSlug);
  const requestConfig: OpenRouterVisionRequestConfig = {
    maximumOutputTokens,
    reasoning: OPENROUTER_EVALUATION_REASONING,
    ...(integerScore ? { integerScore: true as const } : {}),
    ...(requestedProviderRouting === undefined ? {} : { providerRouting: requestedProviderRouting }),
  };
  const images = request.imagePaths.map(path => readLocalVisionImage(path, maximumImageBytes));
  const executeFetch = request.fetchImplementation ?? fetch;
  let response: Response;
  try {
    response = await executeFetch(endpoint, {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        model: request.model,
        temperature: 0,
        max_tokens: maximumOutputTokens,
        reasoning: OPENROUTER_EVALUATION_REASONING,
        stream: false,
        usage: { include: true },
        ...(requestedProviderRouting === undefined ? {} : { provider: requestedProviderRouting }),
        response_format: { type: 'json_schema', json_schema: { name: `dataset_${request.responseKind}_evaluation`, strict: true, schema: responseSchema(request.responseKind, integerScore) } },
        messages: [{ role: 'user', content: [
          { type: 'text', text: request.prompt },
          ...images.map(image => ({ type: 'image_url', image_url: { url: `data:${image.mimeType};base64,${image.base64}` } })),
        ] }],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return fail('OpenRouter request failed before a response was received');
  }
  if (!response.ok) fail(`OpenRouter request failed with HTTP ${response.status}`);
  const evaluation = parseCompletion(await readBoundedResponse(response, maximumResponseBytes), request.responseKind, requestConfig, integerScore, request.model);
  if (evaluation.outcome.kind === 'scalar') {
    if (request.minimumScore !== undefined && evaluation.outcome.score < request.minimumScore) fail('OpenRouter scalar score was below the requested minimum');
    if (request.maximumScore !== undefined && evaluation.outcome.score > request.maximumScore) fail('OpenRouter scalar score was above the requested maximum');
  }
  return evaluation;
}
