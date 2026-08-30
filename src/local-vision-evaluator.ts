/**
 * A deliberately small boundary for evaluating local images with a local
 * Ollama vision model. It never accepts credentials and rejects every endpoint
 * other than a literal loopback Ollama `/api/generate` URL.
 */
import { lstatSync, readFileSync } from 'node:fs';
import type {
  VisionBinaryOutcome,
  VisionEvaluationOutcome,
  VisionEvaluationRequest,
  VisionEvaluationResponseKind,
  VisionGroundingOutcome,
  VisionPairwiseOutcome,
  VisionScalarOutcome,
} from './vision-evaluation-contract.js';

export const DEFAULT_LOCAL_OLLAMA_ENDPOINT = 'http://127.0.0.1:11434/api/generate';

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAXIMUM_IMAGE_BYTES = 20 * 1024 * 1024;
const DEFAULT_MAXIMUM_RESPONSE_BYTES = 256 * 1024;
/** Keeps a tiny compressed raster from expanding into an unbounded local-model input. */
const MAXIMUM_IMAGE_PIXELS = 16_000_000;
const MAX_IMAGES = 2;
const MAX_PROMPT_CHARACTERS = 16_000;
const MAX_MODEL_CHARACTERS = 256;

/** @deprecated Use VisionEvaluationResponseKind from vision-evaluation-contract. */
export type LocalVisionResponseKind = VisionEvaluationResponseKind;

/** @deprecated Use VisionEvaluationRequest plus local transport options. */
export interface LocalVisionEvaluationRequest extends VisionEvaluationRequest {
  /** Must remain a literal loopback `/api/generate` endpoint. */
  endpoint?: URL | string;
  /** Test seam; production callers should leave this unset. */
  fetchImplementation?: typeof fetch;
}

export interface LocalVisionImage {
  path: string;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
  byteLength: number;
  /** Header-declared original raster dimensions, before any model resizing. */
  width: number;
  height: number;
  base64: string;
}

/** @deprecated Use VisionScalarOutcome from vision-evaluation-contract. */
export type LocalVisionScalarOutcome = VisionScalarOutcome;
/** @deprecated Use VisionPairwiseOutcome from vision-evaluation-contract. */
export type LocalVisionPairwiseOutcome = VisionPairwiseOutcome;
/** @deprecated Use VisionGroundingOutcome from vision-evaluation-contract. */
export type LocalVisionGroundingOutcome = VisionGroundingOutcome;
/** @deprecated Use VisionBinaryOutcome from vision-evaluation-contract. */
export type LocalVisionBinaryOutcome = VisionBinaryOutcome;
/** @deprecated Use VisionEvaluationOutcome from vision-evaluation-contract. */
export type LocalVisionOutcome = VisionEvaluationOutcome;

export class LocalVisionEvaluatorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LocalVisionEvaluatorError';
  }
}

function fail(message: string): never {
  throw new LocalVisionEvaluatorError(message);
}

function positiveSafeInteger(value: number, subject: string): void {
  if (!Number.isSafeInteger(value) || value < 1) fail(`${subject} must be a positive safe integer`);
}

function finiteNumber(value: number, subject: string): void {
  if (!Number.isFinite(value)) fail(`${subject} must be finite`);
}

function boundedText(value: string, subject: string, maximumCharacters: number): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maximumCharacters || value.includes('\0')) {
    fail(`${subject} must be a non-empty string no longer than ${maximumCharacters} characters`);
  }
  return value;
}

/** Reject DNS names so a hosts-file or resolver change cannot turn local evaluation into egress. */
export function localOllamaEndpoint(value: URL | string = DEFAULT_LOCAL_OLLAMA_ENDPOINT): URL {
  let endpoint: URL;
  try {
    endpoint = new URL(value);
  } catch {
    return fail('local Ollama endpoint must be an absolute URL');
  }
  if (
    endpoint.protocol !== 'http:'
    || !['127.0.0.1', '[::1]'].includes(endpoint.hostname)
    || endpoint.pathname !== '/api/generate'
    || endpoint.search
    || endpoint.hash
    || endpoint.username
    || endpoint.password
  ) {
    fail('local Ollama endpoint must be a literal loopback HTTP /api/generate URL');
  }
  return endpoint;
}

function imageMimeType(bytes: Buffer): LocalVisionImage['mimeType'] {
  if (bytes.byteLength >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (bytes.byteLength >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.byteLength >= 12 && bytes.subarray(0, 4).equals(Buffer.from('RIFF')) && bytes.subarray(8, 12).equals(Buffer.from('WEBP'))) return 'image/webp';
  if (bytes.byteLength >= 6 && (bytes.subarray(0, 6).equals(Buffer.from('GIF87a')) || bytes.subarray(0, 6).equals(Buffer.from('GIF89a')))) return 'image/gif';
  return fail('local vision image must be a PNG, JPEG, WebP, or GIF file');
}

interface ImageDimensions { width: number; height: number; }

function dimensions(width: number, height: number, format: string): ImageDimensions {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) {
    fail(`local vision ${format} image has invalid dimensions`);
  }
  if (width * height > MAXIMUM_IMAGE_PIXELS) {
    fail(`local vision ${format} image exceeds the ${MAXIMUM_IMAGE_PIXELS}-pixel limit`);
  }
  return { width, height };
}

function pngDimensions(bytes: Buffer): ImageDimensions {
  if (bytes.byteLength < 24 || !bytes.subarray(12, 16).equals(Buffer.from('IHDR')) || bytes.readUInt32BE(8) !== 13) {
    return fail('local vision PNG image has a malformed IHDR header');
  }
  return dimensions(bytes.readUInt32BE(16), bytes.readUInt32BE(20), 'PNG');
}

function jpegDimensions(bytes: Buffer): ImageDimensions {
  let cursor = 2;
  while (cursor < bytes.byteLength) {
    if (bytes[cursor] !== 0xff) return fail('local vision JPEG image has a malformed marker stream');
    while (cursor < bytes.byteLength && bytes[cursor] === 0xff) cursor += 1;
    if (cursor >= bytes.byteLength || bytes[cursor] === 0x00) return fail('local vision JPEG image has a malformed marker stream');
    const marker = bytes[cursor];
    if (marker === undefined) return fail('local vision JPEG image has a truncated marker stream');
    cursor += 1;
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (cursor + 2 > bytes.byteLength) return fail('local vision JPEG image has a truncated segment');
    const length = bytes.readUInt16BE(cursor);
    if (length < 2 || cursor + length > bytes.byteLength) return fail('local vision JPEG image has a malformed segment length');
    const isStartOfFrame = (marker >= 0xc0 && marker <= 0xc3)
      || (marker >= 0xc5 && marker <= 0xc7)
      || (marker >= 0xc9 && marker <= 0xcb)
      || (marker >= 0xcd && marker <= 0xcf);
    if (isStartOfFrame) {
      if (length < 8) return fail('local vision JPEG image has a truncated frame header');
      return dimensions(bytes.readUInt16BE(cursor + 5), bytes.readUInt16BE(cursor + 3), 'JPEG');
    }
    if (marker === 0xda) return fail('local vision JPEG image has no frame dimensions');
    cursor += length;
  }
  return fail('local vision JPEG image has no frame dimensions');
}

function webpDimensions(bytes: Buffer): ImageDimensions {
  let cursor = 12;
  while (cursor + 8 <= bytes.byteLength) {
    const chunk = bytes.subarray(cursor, cursor + 4).toString('ascii');
    const length = bytes.readUInt32LE(cursor + 4);
    const payload = cursor + 8;
    if (length > bytes.byteLength - payload) return fail('local vision WebP image has a truncated chunk');
    if (chunk === 'VP8X') {
      if (length < 10) return fail('local vision WebP image has a truncated VP8X header');
      const width = 1 + bytes.readUIntLE(payload + 4, 3);
      const height = 1 + bytes.readUIntLE(payload + 7, 3);
      return dimensions(width, height, 'WebP');
    }
    if (chunk === 'VP8 ') {
      if (length < 10 || !bytes.subarray(payload + 3, payload + 6).equals(Buffer.from([0x9d, 0x01, 0x2a]))) {
        return fail('local vision WebP image has a malformed VP8 frame header');
      }
      return dimensions(bytes.readUInt16LE(payload + 6) & 0x3fff, bytes.readUInt16LE(payload + 8) & 0x3fff, 'WebP');
    }
    if (chunk === 'VP8L') {
      if (length < 5 || bytes[payload] !== 0x2f) return fail('local vision WebP image has a malformed VP8L header');
      const byte1 = bytes[payload + 1];
      const byte2 = bytes[payload + 2];
      const byte3 = bytes[payload + 3];
      const byte4 = bytes[payload + 4];
      if (byte1 === undefined || byte2 === undefined || byte3 === undefined || byte4 === undefined) return fail('local vision WebP image has a truncated VP8L header');
      return dimensions(1 + byte1 + ((byte2 & 0x3f) << 8), 1 + ((byte2 & 0xc0) >> 6) + (byte3 << 2) + ((byte4 & 0x0f) << 10), 'WebP');
    }
    cursor = payload + length + (length % 2);
  }
  return fail('local vision WebP image has no supported frame dimensions');
}

function gifDimensions(bytes: Buffer): ImageDimensions {
  if (bytes.byteLength < 10) return fail('local vision GIF image has a truncated logical screen descriptor');
  return dimensions(bytes.readUInt16LE(6), bytes.readUInt16LE(8), 'GIF');
}

function imageDimensions(bytes: Buffer, mimeType: LocalVisionImage['mimeType']): ImageDimensions {
  switch (mimeType) {
    case 'image/png': return pngDimensions(bytes);
    case 'image/jpeg': return jpegDimensions(bytes);
    case 'image/webp': return webpDimensions(bytes);
    case 'image/gif': return gifDimensions(bytes);
  }
}

/** Read one regular local image after bounding its actual byte content and magic type. */
export function readLocalVisionImage(path: string, maximumBytes = DEFAULT_MAXIMUM_IMAGE_BYTES): LocalVisionImage {
  boundedText(path, 'local image path', 4_096);
  positiveSafeInteger(maximumBytes, 'maximum image bytes');
  let entry;
  try {
    entry = lstatSync(path);
  } catch {
    return fail('local vision image could not be inspected');
  }
  if (entry.isSymbolicLink() || !entry.isFile() || entry.size < 1 || entry.size > maximumBytes) {
    fail(`local vision image must be a regular non-symlink file no larger than ${maximumBytes} bytes`);
  }
  let bytes: Buffer;
  try {
    bytes = readFileSync(path);
  } catch {
    return fail('local vision image could not be read');
  }
  if (bytes.byteLength < 1 || bytes.byteLength > maximumBytes) {
    fail(`local vision image exceeds the ${maximumBytes}-byte limit`);
  }
  const mimeType = imageMimeType(bytes);
  const { width, height } = imageDimensions(bytes, mimeType);
  return { path, mimeType, byteLength: bytes.byteLength, width, height, base64: bytes.toString('base64') };
}

function plainObject(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail('local Ollama response must be a JSON object');
  return value as Record<string, unknown>;
}

function jsonFromModelContent(value: unknown): unknown {
  const outer = plainObject(value);
  const content = typeof outer.response === 'string'
    ? outer.response
    : (plainObject(outer.message ?? {}).content as unknown);
  if (typeof content !== 'string' || content.trim().length === 0 || content.length > MAX_PROMPT_CHARACTERS) {
    fail('local Ollama response did not contain bounded text output');
  }
  const clean = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try {
    return JSON.parse(clean) as unknown;
  } catch {
    return fail('local Ollama model output was not valid JSON');
  }
}

/** Parse the narrow response envelopes used by local scalar and AB/BA evaluation. */
export function parseLocalVisionResponse(kind: LocalVisionResponseKind, value: unknown, integerScore = false): LocalVisionOutcome {
  const parsed = jsonFromModelContent(value);
  const result = plainObject(parsed);
  if (kind === 'binary') {
    if (Object.keys(result).length !== 1 || typeof result.value !== 'boolean') {
      fail('local binary response must be exactly { "value": boolean }');
    }
    return { kind, value: result.value };
  }
  if (kind === 'scalar') {
    if (Object.keys(result).length !== 1 || typeof result.score !== 'number' || !Number.isFinite(result.score) || (integerScore && !Number.isInteger(result.score))) {
      fail(`local scalar response must be exactly { "score": finite-${integerScore ? 'integer' : 'number'} }`);
    }
    return { kind, score: result.score };
  }
  if (kind === 'grounding') {
    if (
      Object.keys(result).length !== 2
      || typeof result.x !== 'number' || !Number.isFinite(result.x) || result.x < 0 || result.x > 1000
      || typeof result.y !== 'number' || !Number.isFinite(result.y) || result.y < 0 || result.y > 1000
    ) {
      fail('local grounding response must be exactly { "x": finite-number 0 through 1000, "y": finite-number 0 through 1000 } in normalized coordinates');
    }
    return { kind, x: result.x, y: result.y };
  }
  if (
    Object.keys(result).length !== 1
    || (result.winner !== 'A' && result.winner !== 'B')
  ) {
    fail('local pairwise response must be exactly { "winner": "A" | "B" }');
  }
  const point: 0 | 1 = result.winner === 'A' ? 1 : 0;
  return { kind, winner: result.winner, point };
}

function responseFormat(kind: LocalVisionResponseKind, integerScore: boolean): Record<string, unknown> {
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

async function readBoundedResponse(response: Response, maximumBytes: number): Promise<unknown> {
  const advertised = response.headers.get('content-length');
  if (advertised !== null && (!/^\d+$/.test(advertised) || Number(advertised) > maximumBytes)) {
    fail(`local Ollama response exceeds the ${maximumBytes}-byte limit`);
  }
  if (response.body === null) fail('local Ollama response had no body');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    let next: ReadableStreamReadResult<Uint8Array>;
    try {
      next = await reader.read();
    } catch {
      return fail('local Ollama response body could not be read');
    }
    if (next.done) break;
    total += next.value.byteLength;
    if (total > maximumBytes) {
      try { await reader.cancel(); } catch { /* best-effort stop after the hard bound */ }
      fail(`local Ollama response exceeds the ${maximumBytes}-byte limit`);
    }
    chunks.push(next.value);
  }
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks.map(chunk => Buffer.from(chunk)), total));
    return JSON.parse(text) as unknown;
  } catch {
    return fail('local Ollama response was not valid UTF-8 JSON');
  }
}

/**
 * Submit a bounded local-image evaluation to a literal loopback Ollama daemon.
 * The generated payload contains only the caller's fixed prompt, model id, and
 * base64 image bytes; no environment variables or credentials are consulted.
 */
export async function evaluateLocalVision(request: LocalVisionEvaluationRequest): Promise<LocalVisionOutcome> {
  boundedText(request.prompt, 'local vision prompt', MAX_PROMPT_CHARACTERS);
  boundedText(request.model, 'local vision model', MAX_MODEL_CHARACTERS);
  if (request.responseKind !== 'scalar' && request.responseKind !== 'pairwise' && request.responseKind !== 'grounding' && request.responseKind !== 'binary') {
    fail('local vision responseKind must be scalar, pairwise, grounding, or binary');
  }
  if (!Array.isArray(request.imagePaths) || request.imagePaths.length < 1 || request.imagePaths.length > MAX_IMAGES) {
    fail(`local vision evaluation requires from 1 through ${MAX_IMAGES} images`);
  }
  if ((request.responseKind === 'pairwise' || request.responseKind === 'binary') && request.imagePaths.length !== 2) {
    fail(`local ${request.responseKind} evaluation requires exactly two images`);
  }
  if (request.integerScore !== undefined && typeof request.integerScore !== 'boolean') fail('local integerScore must be a boolean');
  if (request.integerScore === true && request.responseKind !== 'scalar') fail('local integerScore is valid only for scalar responses');
  const integerScore = request.integerScore === true;
  const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maximumImageBytes = request.maximumImageBytes ?? DEFAULT_MAXIMUM_IMAGE_BYTES;
  const maximumResponseBytes = request.maximumResponseBytes ?? DEFAULT_MAXIMUM_RESPONSE_BYTES;
  positiveSafeInteger(timeoutMs, 'local vision timeout');
  positiveSafeInteger(maximumImageBytes, 'maximum image bytes');
  positiveSafeInteger(maximumResponseBytes, 'maximum response bytes');
  if (timeoutMs > 5 * 60_000) fail('local vision timeout must not exceed 300000 milliseconds');
  if (maximumImageBytes > DEFAULT_MAXIMUM_IMAGE_BYTES) fail(`maximum image bytes must not exceed ${DEFAULT_MAXIMUM_IMAGE_BYTES}`);
  if (maximumResponseBytes > DEFAULT_MAXIMUM_RESPONSE_BYTES) fail(`maximum response bytes must not exceed ${DEFAULT_MAXIMUM_RESPONSE_BYTES}`);
  if (request.minimumScore !== undefined) finiteNumber(request.minimumScore, 'minimum score');
  if (request.maximumScore !== undefined) finiteNumber(request.maximumScore, 'maximum score');
  if (request.minimumScore !== undefined && request.maximumScore !== undefined && request.minimumScore > request.maximumScore) {
    fail('minimum score must not exceed maximum score');
  }
  const endpoint = localOllamaEndpoint(request.endpoint);
  const images = request.imagePaths.map(path => readLocalVisionImage(path, maximumImageBytes));
  const executeFetch = request.fetchImplementation ?? fetch;
  let response: Response;
  try {
    response = await executeFetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ model: request.model, prompt: request.prompt, images: images.map(image => image.base64), stream: false, format: responseFormat(request.responseKind, integerScore) }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return fail('local Ollama request failed before a response was received');
  }
  if (!response.ok) fail(`local Ollama request failed with HTTP ${response.status}`);
  const outcome = parseLocalVisionResponse(request.responseKind, await readBoundedResponse(response, maximumResponseBytes), integerScore);
  if (outcome.kind === 'scalar') {
    if (request.minimumScore !== undefined && outcome.score < request.minimumScore) fail('local scalar score was below the requested minimum');
    if (request.maximumScore !== undefined && outcome.score > request.maximumScore) fail('local scalar score was above the requested maximum');
  }
  return outcome;
}
