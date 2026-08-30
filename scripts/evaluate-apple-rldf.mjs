#!/usr/bin/env node

/**
 * Acquire the public Apple ML-RLDF archive with a private provenance chain.
 * Local evaluation is always available; hosted OpenRouter evaluation is only
 * available after an operator confirms the dataset terms and narrow
 * noncommercial-research purpose. Such a confirmation remains rightsGrant:false.
 */

import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import { closeSync, lstatSync, openSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MODULE_ROOT = basename(ROOT) === 'build' ? resolve(ROOT, 'src') : resolve(ROOT, 'build/src');
const moduleImport = name => import(pathToFileURL(resolve(MODULE_ROOT, name)).href);
const [acquisitionModule, registryModule, adapterModule, metricsModule] = await Promise.all([
  moduleImport('dataset-acquisition.js'), moduleImport('dataset-adapters/registry.js'),
  moduleImport('dataset-adapters/apple-rldf.js'), moduleImport('dataset-evaluation-metrics.js'),
]);
const { createAggregateByteBudget, createOperatorCacheDirectory, createPrivateRunDirectory, fetchBoundedArtifact, verifyCachedArtifact, writeVerifiedCacheArtifact } = acquisitionModule;
const { createDatasetProvenance, preflightDatasetProviderUpload } = registryModule;
const { normalizeAppleRldfRankingRow, normalizeAppleRldfRevisionRow } = adapterModule;
const { computePreferenceMetrics } = metricsModule;

export const APPLE_RLDF_REVISION = 'be0d7f816ded6fa5111035f34f69b077072ba9a3';
export const APPLE_RLDF_ZIP_URL = 'https://ml-site.cdn-apple.com/datasets/rldf/rldf.zip';
export const APPLE_RLDF_ZIP_SHA256 = 'ad88f731540568f5e854e7f51c5942033621845f19c42e544d8478e09640c9b3';
const DEFAULT_CACHE = resolve(ROOT, 'evaluation/cache/apple-rldf');
const DEFAULT_OUTPUT = resolve(ROOT, 'evaluation/results/apple-rldf');
const MAX_ZIP_BYTES = 128 * 1024 * 1024;
const MAX_ENTRY_BYTES = 192 * 1024 * 1024;
const MAX_TOTAL_UNCOMPRESSED_BYTES = 320 * 1024 * 1024;
const MAX_ENTRIES = 64;
const MAX_LIMIT = 100;
const ALLOWED_ARROW = new Set([
  'rldf_suppl_new/rldf_dataset/ranking_training_dataset_hf/data-00000-of-00001.arrow',
  'rldf_suppl_new/rldf_dataset/revision_training_dataset_hf/data-00000-of-00001.arrow',
]);

export class AppleRldfEvaluationError extends Error { constructor(message) { super(message); this.name = 'AppleRldfEvaluationError'; } }
const fail = message => { throw new AppleRldfEvaluationError(message); };
const jsonText = value => `${JSON.stringify(value, null, 2)}\n`;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const contained = (parent, candidate) => candidate === parent || candidate.startsWith(`${parent}${sep}`);

function usage() {
  return [
    'Usage: node scripts/evaluate-apple-rldf.mjs --fetch-only [--cache-dir <directory>] [--output-dir <directory>]',
    '       node scripts/evaluate-apple-rldf.mjs --evaluate-existing <acquisition-dir> --records <private-normalized-records.json> --normalization <private-normalization.json> (--local-model <name> | --openrouter-model <name> --openrouter-provider <endpoint-slug> --upload-confirmation <private.json>) [--limit <1..100>] [--output-dir <directory>]',
    '',
    'Apple ML-RLDF pixels stay in ignored evaluation/. Local evaluation needs no upload acknowledgement; hosted OpenRouter evaluation is opt-in only with a private exact-model, noncommercial-research confirmation (rightsGrant:false).',
    'Prepare records first: uv run scripts/normalize-apple-rldf.py --acquisition <acquisition-dir>/apple-rldf-acquisition-v1.json --cache-dir <cache-dir> --output-dir <private-output-dir> --limit <1..20>.',
  ].join('\n');
}

function optionValue(args, name) {
  const matches = args.flatMap((value, index) => value === name ? [index] : []);
  if (matches.length > 1) fail(`${name} may be specified only once`);
  if (matches.length === 0) return null;
  const value = args[matches[0] + 1];
  if (!value || value.startsWith('--')) fail(`${name} requires a value`);
  return value;
}

function parseArguments(args) {
  const known = new Set(['--help', '--fetch-only', '--evaluate-existing', '--records', '--normalization', '--local-model', '--openrouter-model', '--openrouter-provider', '--upload-confirmation', '--limit', '--cache-dir', '--output-dir']);
  for (const arg of args) if (arg.startsWith('--') && !known.has(arg)) fail(`unknown option: ${arg}`);
  const help = args.includes('--help');
  const fetchOnly = args.includes('--fetch-only');
  const existing = optionValue(args, '--evaluate-existing');
  if (!help && fetchOnly === (existing !== null)) fail('choose exactly one of --fetch-only or --evaluate-existing');
  const limitText = optionValue(args, '--limit'); const limit = limitText === null ? 20 : Number(limitText);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) fail(`--limit must be a whole number from 1 to ${MAX_LIMIT}`);
  const records = optionValue(args, '--records'); const normalization = optionValue(args, '--normalization'); const localModel = optionValue(args, '--local-model'); const openrouterModel = optionValue(args, '--openrouter-model'); const openrouterProvider = optionValue(args, '--openrouter-provider'); const uploadConfirmation = optionValue(args, '--upload-confirmation');
  if (!help && fetchOnly && (records !== null || normalization !== null || localModel !== null || openrouterModel !== null || openrouterProvider !== null || uploadConfirmation !== null)) fail('--fetch-only does not accept evaluation options');
  if (!help && !fetchOnly && (records === null || normalization === null || (localModel === null) === (openrouterModel === null) || (localModel !== null && openrouterProvider !== null) || (openrouterModel !== null && (uploadConfirmation === null || openrouterProvider === null)))) fail('--evaluate-existing requires records/normalization and exactly one model; OpenRouter also requires --openrouter-provider and --upload-confirmation');
  return { help, fetchOnly, existing, records, normalization, localModel, openrouterModel, openrouterProvider, uploadConfirmation, limit,
    cacheDirectory: optionValue(args, '--cache-dir') ?? DEFAULT_CACHE,
    outputDirectory: optionValue(args, '--output-dir') ?? DEFAULT_OUTPUT };
}

function archiveUrl() {
  const override = process.env.AI_VISUAL_TEST_APPLE_RLDF_ZIP_URL;
  if (override === undefined) return new URL(APPLE_RLDF_ZIP_URL);
  if (process.env.NODE_ENV !== 'test') fail('AI_VISUAL_TEST_APPLE_RLDF_ZIP_URL is permitted only when NODE_ENV=test');
  let url; try { url = new URL(override); } catch { fail('AI_VISUAL_TEST_APPLE_RLDF_ZIP_URL must be a loopback HTTP URL'); }
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '::1'].includes(url.hostname) || url.pathname !== '/rldf.zip') fail('AI_VISUAL_TEST_APPLE_RLDF_ZIP_URL must be a loopback HTTP /rldf.zip URL');
  return url;
}

function expectedZipHash() {
  const override = process.env.AI_VISUAL_TEST_APPLE_RLDF_ZIP_SHA256;
  if (override === undefined) return APPLE_RLDF_ZIP_SHA256;
  if (process.env.NODE_ENV !== 'test' || !/^[a-f0-9]{64}$/i.test(override)) fail('AI_VISUAL_TEST_APPLE_RLDF_ZIP_SHA256 is permitted only as a test SHA-256');
  return override.toLowerCase();
}

function archiveFetchOptions(url) {
  if (url.protocol === 'http:') return null;
  return { url: url.toString(), allowedSources: [{ origin: 'https://ml-site.cdn-apple.com', pathPrefix: '/datasets/rldf/' }] };
}

async function fetchTestArchive(url) {
  let response;
  try { response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(120_000) }); } catch { fail('Apple RLDF test archive could not be fetched'); }
  if (!response.ok || !response.body) fail(`Apple RLDF test archive request failed with HTTP ${response.status}`);
  const length = response.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_ZIP_BYTES)) fail('Apple RLDF ZIP exceeded the safety limit');
  const reader = response.body.getReader(); const chunks = []; let total = 0;
  while (true) { const next = await reader.read(); if (next.done) break; total += next.value.byteLength; if (total > MAX_ZIP_BYTES) { await reader.cancel(); fail('Apple RLDF ZIP exceeded the safety limit'); } chunks.push(Buffer.from(next.value)); }
  const bytes = Buffer.concat(chunks, total); return { bytes, sha256: sha256(bytes), sourceUrl: url.toString() };
}

function u16(bytes, offset) { if (offset + 2 > bytes.length) fail('Apple RLDF ZIP was truncated'); return bytes.readUInt16LE(offset); }
function u32(bytes, offset) { if (offset + 4 > bytes.length) fail('Apple RLDF ZIP was truncated'); return bytes.readUInt32LE(offset); }
function safeArchiveName(value) {
  const normalized = value.endsWith('/') ? value.slice(0, -1) : value;
  if (!normalized || value.includes('\0') || value.startsWith('/') || value.includes('\\') || normalized.split('/').some(part => !part || part === '.' || part === '..')) fail('Apple RLDF ZIP contains an unsafe entry path');
  return value;
}

/** Extract only expected Arrow members from a non-ZIP64 archive with bounded output. */
export function extractAppleRldfArrow(zip) {
  if (!Buffer.isBuffer(zip) || zip.length < 22 || zip.length > MAX_ZIP_BYTES) fail('Apple RLDF ZIP exceeded the safety limit');
  const scanStart = Math.max(0, zip.length - 65_557); let end = -1;
  for (let index = zip.length - 22; index >= scanStart; index -= 1) if (zip.readUInt32LE(index) === 0x06054b50) { end = index; break; }
  if (end < 0) fail('Apple RLDF ZIP has no end-of-central-directory record');
  const entries = u16(zip, end + 10); const centralBytes = u32(zip, end + 12); const centralOffset = u32(zip, end + 16);
  if (entries > MAX_ENTRIES || centralOffset + centralBytes > end) fail('Apple RLDF ZIP central directory exceeded safety limits');
  let cursor = centralOffset; let total = 0; const found = new Map();
  for (let index = 0; index < entries; index += 1) {
    if (u32(zip, cursor) !== 0x02014b50) fail('Apple RLDF ZIP central directory was malformed');
    const flags = u16(zip, cursor + 8); const method = u16(zip, cursor + 10); const compressed = u32(zip, cursor + 20); const uncompressed = u32(zip, cursor + 24);
    const nameLength = u16(zip, cursor + 28); const extraLength = u16(zip, cursor + 30); const commentLength = u16(zip, cursor + 32); const localOffset = u32(zip, cursor + 42);
    const next = cursor + 46 + nameLength + extraLength + commentLength; if (next > centralOffset + centralBytes) fail('Apple RLDF ZIP central directory was truncated');
    // Bit 3 is the ordinary ZIP data-descriptor flag.  We do not trust its
    // trailing values: central-directory sizes bound all reads below.
    if ((flags & 1) !== 0 || (flags & 0x40) !== 0 || method !== 0 && method !== 8) fail('Apple RLDF ZIP uses an unsupported encrypted or compression format');
    const name = safeArchiveName(zip.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8'));
    if (compressed > MAX_ZIP_BYTES) fail('Apple RLDF ZIP exceeds its archive-bomb limits');
    if (ALLOWED_ARROW.has(name)) {
      if (uncompressed > MAX_ENTRY_BYTES || total + uncompressed > MAX_TOTAL_UNCOMPRESSED_BYTES) fail('Apple RLDF ZIP exceeds its archive-bomb limits');
      total += uncompressed;
      if (found.has(name) || u32(zip, localOffset) !== 0x04034b50) fail('Apple RLDF ZIP has duplicate or malformed Arrow entries');
      const localName = u16(zip, localOffset + 26); const localExtra = u16(zip, localOffset + 28); const start = localOffset + 30 + localName + localExtra; const stop = start + compressed;
      if (stop > zip.length) fail('Apple RLDF ZIP Arrow data was truncated');
      let bytes;
      try { bytes = method === 0 ? Buffer.from(zip.subarray(start, stop)) : inflateRawSync(zip.subarray(start, stop), { maxOutputLength: MAX_ENTRY_BYTES }); } catch { fail('Apple RLDF ZIP Arrow data could not be safely decompressed'); }
      if (bytes.length !== uncompressed || bytes.length === 0) fail('Apple RLDF ZIP Arrow entry had an invalid size');
      found.set(name, bytes);
    }
    cursor = next;
  }
  if (cursor !== centralOffset + centralBytes || found.size !== ALLOWED_ARROW.size) fail('Apple RLDF ZIP did not contain the expected Arrow datasets');
  return found;
}

function privateDirectory(path) { return createOperatorCacheDirectory({ cacheDirectory: path, repositoryRoot: ROOT }); }
function writeJson(directory, name, value) {
  const root = privateDirectory(directory); const destination = resolve(root, name); if (!contained(root, destination)) fail('Apple RLDF receipt path escaped private output');
  let descriptor; try { descriptor = openSync(destination, 'wx', 0o600); writeFileSync(descriptor, jsonText(value)); }
  catch (error) { if (error?.code === 'EEXIST') fail(`refusing to overwrite existing Apple RLDF receipt: ${name}`); throw error; }
  finally { if (descriptor !== undefined) closeSync(descriptor); }
}

async function acquire(cacheDirectory) {
  const expectedHash = expectedZipHash(); const url = archiveUrl(); const fetchOptions = archiveFetchOptions(url);
  const result = fetchOptions === null
    ? await fetchTestArchive(url)
    : await fetchBoundedArtifact({ ...fetchOptions, maximumBytes: MAX_ZIP_BYTES, timeoutMs: 120_000, aggregateByteBudget: createAggregateByteBudget(MAX_ZIP_BYTES) });
  if (result.sha256 !== expectedHash) fail('Apple RLDF ZIP SHA-256 did not match the pinned archive');
  const cache = privateDirectory(cacheDirectory); const arrows = extractAppleRldfArrow(result.bytes);
  const artifacts = [writeVerifiedCacheArtifact(cache, 'source/rldf.zip', result.bytes)];
  for (const [name, bytes] of arrows) artifacts.push(writeVerifiedCacheArtifact(cache, `arrow/${name.split('/').at(-2)}.arrow`, bytes));
  return { cache, artifacts, sourceUrl: result.sourceUrl };
}

function readPrivateRecords(path) {
  const entry = lstatSync(path); if (entry.isSymbolicLink() || !entry.isFile() || entry.size > 8 * 1024 * 1024 || (statSync(path).mode & 0o077) !== 0) fail('--records must be a private regular JSON file no larger than 8 MiB');
  let records; try { records = JSON.parse(readFileSync(path, 'utf8')); } catch { fail('--records was not valid JSON'); }
  if (!Array.isArray(records) || records.length === 0) fail('--records must be a non-empty JSON array');
  return records;
}

function privateJson(path, subject, maximumBytes = 8 * 1024 * 1024) {
  const entry = lstatSync(path); if (entry.isSymbolicLink() || !entry.isFile() || entry.size > maximumBytes || (statSync(path).mode & 0o077) !== 0) fail(`${subject} must be a private regular JSON file`);
  let value; try { value = JSON.parse(readFileSync(path, 'utf8')); } catch { fail(`${subject} was not valid JSON`); }
  return { value, sha256: sha256(readFileSync(path)), path: realpathSync(path) };
}

/** Validate every local record/image against the normalizer's immutable receipt before model import. */
export function verifyAppleRldfPreparedRecords({ acquisitionPath, recordsPath, normalizationPath, cacheDirectory }) {
  const acquisition = privateJson(acquisitionPath, 'Apple RLDF acquisition receipt', 1024 * 1024);
  const normalization = privateJson(normalizationPath, 'Apple RLDF normalization receipt', 8 * 1024 * 1024);
  const records = privateJson(recordsPath, 'Apple RLDF records', 8 * 1024 * 1024);
  const receipt = normalization.value;
  if (receipt?.version !== 1 || receipt?.key !== 'apple-rldf' || receipt?.revision !== APPLE_RLDF_REVISION) fail('Apple RLDF normalization receipt did not retain the expected provenance');
  if (receipt.acquisition?.sha256 !== acquisition.sha256) fail('Apple RLDF normalization receipt does not bind this acquisition');
  const parent = realpathSync(dirname(normalization.path));
  if (records.path !== resolve(parent, 'apple-rldf-records-v1.json') || receipt.records?.path !== 'apple-rldf-records-v1.json' || receipt.records?.sha256 !== records.sha256) fail('Apple RLDF records are not the exact normalizer output');
  const cache = privateDirectory(cacheDirectory);
  const arrowArtifacts = new Map((Array.isArray(receipt.arrowArtifacts) ? receipt.arrowArtifacts : []).map(item => [item?.path, item?.sha256]));
  for (const relative of ['arrow/ranking_training_dataset_hf.arrow', 'arrow/revision_training_dataset_hf.arrow']) {
    if (typeof arrowArtifacts.get(relative) !== 'string' || verifyCachedArtifact(cache, relative).sha256 !== arrowArtifacts.get(relative)) fail('Apple RLDF cached Arrow artifact did not match normalization receipt');
  }
  if (!Array.isArray(records.value) || !Array.isArray(receipt.images)) fail('Apple RLDF normalization receipt was malformed');
  const imageHashes = new Map();
  for (const image of receipt.images) {
    if (!image || typeof image.path !== 'string' || !/^[a-f0-9]{64}$/.test(image.sha256) || !Number.isSafeInteger(image.bytes)) fail('Apple RLDF normalization receipt image was malformed');
    const requested = resolve(image.path); const entry = lstatSync(requested); const path = realpathSync(requested);
    if (!contained(cache, path) || imageHashes.has(path)) fail('Apple RLDF normalization image escaped cache or was duplicated');
    if (entry.isSymbolicLink() || !entry.isFile() || entry.size !== image.bytes || sha256(readFileSync(path)) !== image.sha256) fail('Apple RLDF normalization image did not match receipt');
    imageHashes.set(path, image.sha256);
  }
  for (const record of records.value) for (const role of ['chosen_image', 'rejected_image']) {
    const path = record?.[role]?.path; if (typeof path !== 'string' || !imageHashes.has(realpathSync(path))) fail('Apple RLDF record image was not bound by normalization receipt');
  }
  return records.value;
}

function normalizedExamples(records, limit) {
  const provenance = createDatasetProvenance('apple-rldf', APPLE_RLDF_REVISION);
  const examples = []; const ids = new Set();
  for (const record of records) {
    if (examples.length === limit) break;
    if (record === null || typeof record !== 'object' || Array.isArray(record) || !['ranking', 'revision'].includes(record.kind)) fail('each --records entry needs kind "ranking" or "revision"');
    const row = { ...record }; delete row.kind;
    const example = record.kind === 'ranking'
      ? normalizeAppleRldfRankingRow(row, provenance, { chosenPosition: examples.length % 2 === 0 ? 'A' : 'B' })
      : normalizeAppleRldfRevisionRow(row, provenance, { chosenPosition: examples.length % 2 === 0 ? 'A' : 'B' });
    if (ids.has(example.id)) fail('Apple RLDF normalized records must have unique IDs'); ids.add(example.id); examples.push(example);
  }
  if (examples.length === 0) fail('no Apple RLDF records were selected'); return examples;
}

function prediction(value) { if (!['A', 'B', 'tie', 'indeterminate'].includes(value)) fail('local evaluator must return A, B, tie, or indeterminate'); return value; }

/** Testable no-network seam. Evaluator receives local paths/records, never a provider configuration. */
export async function evaluateAppleRldfExamples(examples, evaluator) {
  if (typeof evaluator !== 'function') fail('Apple RLDF evaluation needs an injected local evaluator');
  const results = [];
  for (const example of examples) {
    const orders = [];
    for (const order of ['AB', 'BA']) {
      const outcome = await evaluator(order === 'AB' ? example.imageA : example.imageB, order === 'AB' ? example.imageB : example.imageA, example.description, { order, example });
      orders.push({ order, prediction: prediction(outcome?.prediction) });
    }
    const canonical = orders[0].prediction === 'A' ? 'A' : orders[0].prediction === 'B' ? 'B' : orders[0].prediction;
    const reverse = orders[1].prediction === 'A' ? 'B' : orders[1].prediction === 'B' ? 'A' : orders[1].prediction;
    results.push({ id: example.id, prediction: canonical === reverse ? canonical : 'indeterminate', orders });
  }
  return results;
}

async function localEvaluator(model) {
  // Local mode never has an upload confirmation, so this preflight must keep
  // the hosted path closed before a local evaluator is imported.
  try { preflightDatasetProviderUpload('apple-rldf', { provider: 'openrouter', model }); } catch { /* denial is the required boundary */ }
  let local;
  try { local = await moduleImport('local-vision-evaluator.js'); } catch { fail('local Apple RLDF evaluation requires build/src/local-vision-evaluator.js'); }
  const evaluate = local.evaluateLocalVision;
  if (typeof evaluate !== 'function') fail('local vision evaluator must export evaluateLocalVision');
  return async (a, b, description, context) => {
    const imagePaths = [a, b].map((image, index) => {
      if (typeof image === 'string') return image;
      if (image !== null && typeof image === 'object' && typeof image.path === 'string') return image.path;
      fail(`Apple RLDF local record image ${index === 0 ? 'A' : 'B'} must be a local path or { path }`);
    });
    const outcome = await evaluate({
      imagePaths,
      prompt: `Choose the better designed UI for this description: ${description}. Return only A or B.`,
      model,
      responseKind: 'pairwise',
    });
    if (outcome?.kind !== 'pairwise') fail('local vision evaluator did not return a pairwise outcome');
    return { prediction: outcome.winner };
  };
}

async function openRouterEvaluator(model, providerSlug, confirmationPath) {
  const confirmation = privateJson(confirmationPath, 'Apple RLDF upload confirmation', 64 * 1024).value;
  // This exact preflight validates dataset, canonical provider, model, purpose,
  // and all three Apple acknowledgements before the OpenRouter module/key is read.
  try { preflightDatasetProviderUpload('apple-rldf', { provider: 'openrouter', model, confirmation }); }
  catch (error) { fail(error instanceof Error ? error.message : 'Apple RLDF OpenRouter upload was not authorized'); }
  let remote;
  try { remote = await moduleImport('openrouter-vision-evaluator.js'); } catch { fail('OpenRouter vision evaluator is unavailable'); }
  return createOpenRouterEvaluator(model, providerSlug, confirmation, remote);
}

/** Injection seam: the policy preflight happens before a remote evaluator is callable. */
export function createOpenRouterEvaluator(model, providerSlug, confirmation, remote) {
  try { preflightDatasetProviderUpload('apple-rldf', { provider: 'openrouter', model, confirmation }); }
  catch (error) { fail(error instanceof Error ? error.message : 'Apple RLDF OpenRouter upload was not authorized'); }
  if (typeof remote.evaluateOpenRouterVision !== 'function') fail('OpenRouter vision evaluator is unavailable');
  const calls = []; let requestConfig = null; let responseIdentity = null; const evaluator = async (a, b, description, context) => {
    const imagePaths = [a, b].map(image => typeof image === 'string' ? image : image?.path);
    if (imagePaths.some(path => typeof path !== 'string')) fail('Apple RLDF OpenRouter images must be verified local paths');
    const response = await remote.evaluateOpenRouterVision({ imagePaths, prompt: `Choose the better designed UI for this description: ${description}. Return only A or B.`, model, providerSlug, responseKind: 'pairwise' });
    const routing = response?.requestConfig?.providerRouting;
    const usage = response?.usage;
    if (response?.outcome?.kind !== 'pairwise' || response.model !== model || typeof response.provider !== 'string' || !response.provider || !usage || !Number.isSafeInteger(usage.promptTokens) || usage.promptTokens < 0 || !Number.isSafeInteger(usage.completionTokens) || usage.completionTokens < 0 || !Number.isSafeInteger(usage.totalTokens) || usage.totalTokens !== usage.promptTokens + usage.completionTokens || (usage.cost !== undefined && (typeof usage.cost !== 'number' || !Number.isFinite(usage.cost) || usage.cost < 0)) || !routing || !Array.isArray(routing.only) || routing.only.length !== 1 || routing.only[0] !== providerSlug || routing.allow_fallbacks !== false || routing.require_parameters !== true || routing.data_collection !== 'deny') {
      fail('OpenRouter pairwise receipt did not preserve the exact requested provider routing');
    }
    const identity = JSON.stringify({ provider: response.provider, model: response.model, nativeModel: response.nativeModel ?? null });
    if (responseIdentity === null) responseIdentity = identity;
    else if (responseIdentity !== identity) fail('OpenRouter AB/BA calls returned inconsistent provider/model identity');
    const encodedConfig = JSON.stringify(response.requestConfig);
    if (requestConfig === null) requestConfig = { encoded: encodedConfig, value: response.requestConfig };
    else if (requestConfig.encoded !== encodedConfig) fail('OpenRouter AB/BA calls used inconsistent request configuration');
    calls.push({ order: context.order, provider: 'openrouter', model, nativeModel: response.nativeModel ?? null, routedModel: response.model, usage: response.usage });
    return { prediction: response.outcome.winner };
  };
  return { evaluator, calls, confirmation, aggregateUsage: () => remote.aggregateOpenRouterUsage(calls.map(call => call.usage)), requestConfig: () => { if (requestConfig === null) fail('OpenRouter evaluation made no calls'); return requestConfig.value; } };
}

async function main() {
  const options = parseArguments(process.argv.slice(2)); if (options.help) return process.stdout.write(`${usage()}\n`);
  if (options.fetchOnly) {
    const output = createPrivateRunDirectory({ parentDirectory: privateDirectory(options.outputDirectory), prefix: 'apple-rldf-acquisition' });
    try {
      const { artifacts, sourceUrl } = await acquire(options.cacheDirectory);
      const acquisition = { version: 1, key: 'apple-rldf', provenance: createDatasetProvenance('apple-rldf', APPLE_RLDF_REVISION), retrievedAt: new Date().toISOString(), normalizerVersion: 'apple-rldf-archive-v1', status: 'available', sourceUrl, artifacts };
      writeJson(output, 'apple-rldf-acquisition-v1.json', acquisition); process.stdout.write(`${JSON.stringify({ version: 2, mode: 'fetch-only', artifacts: artifacts.length, revision: APPLE_RLDF_REVISION }, null, 2)}\n`); return;
    } catch (error) {
      const reason = error instanceof AppleRldfEvaluationError ? error.message.slice(0, 512) : 'Apple RLDF acquisition was unavailable or malformed';
      writeJson(output, 'apple-rldf-acquisition-v1.json', {
        version: 1, key: 'apple-rldf', provenance: createDatasetProvenance('apple-rldf', APPLE_RLDF_REVISION), retrievedAt: new Date().toISOString(),
        normalizerVersion: 'apple-rldf-archive-v1', status: 'metadata-only', blockedReason: reason, artifacts: [],
      });
      throw error;
    }
  }
  const acquisitionPath = resolve(options.existing, 'apple-rldf-acquisition-v1.json'); const acquisition = JSON.parse(readFileSync(acquisitionPath, 'utf8'));
  if (acquisition?.status !== 'available' || acquisition?.key !== 'apple-rldf') fail('--evaluate-existing must name an available Apple RLDF acquisition');
  const verifiedRecords = verifyAppleRldfPreparedRecords({ acquisitionPath, recordsPath: options.records, normalizationPath: options.normalization, cacheDirectory: options.cacheDirectory });
  const examples = normalizedExamples(verifiedRecords, options.limit);
  const remote = options.openrouterModel === null ? null : await openRouterEvaluator(options.openrouterModel, options.openrouterProvider, options.uploadConfirmation);
  const evaluator = remote === null ? await localEvaluator(options.localModel) : remote.evaluator;
  const results = await evaluateAppleRldfExamples(examples, evaluator);
  const output = createPrivateRunDirectory({ parentDirectory: privateDirectory(options.outputDirectory), prefix: 'apple-rldf-evaluation' });
  const selection = { seed: `apple-rldf-${APPLE_RLDF_REVISION}`, examplesSha256: sha256(Buffer.from(jsonText(examples))) };
  const examplesDoc = { version: 2, track: 'preference', acquisition, selection, splits: [{ name: 'external-eval', examples }] };
  const run = remote === null
    ? { evaluator: 'local-vision-evaluator', localModel: options.localModel, counterbalanced: true, selectionSeed: selection.seed }
    : { evaluator: 'openrouter-vision-evaluator', provider: 'openrouter', model: options.openrouterModel, counterbalanced: true, selectionSeed: selection.seed, uploadConfirmation: remote.confirmation, requestConfig: remote.requestConfig(), calls: remote.calls, usage: remote.aggregateUsage() };
  writeJson(output, 'apple-rldf-examples-v2.json', examplesDoc); writeJson(output, 'apple-rldf-results-v2.json', { version: 2, track: 'preference', acquisition, split: 'external-eval', run, results });
  process.stdout.write(`${JSON.stringify({ version: 2, mode: remote === null ? 'evaluated-local' : 'evaluated-openrouter', selected: examples.length, revision: APPLE_RLDF_REVISION, metrics: computePreferenceMetrics(examples, results) }, null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { process.stderr.write(`${error instanceof AppleRldfEvaluationError ? error.message : 'Apple RLDF evaluation failed safely'}\n`); process.exitCode = 1; });
