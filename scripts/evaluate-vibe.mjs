#!/usr/bin/env node

/**
 * Bounded, opt-in evaluator for the gated Vibe pairwise datasets.
 * Source pixels and every receipt stay in an operator-controlled ignored cache.
 */

import { createHash } from 'node:crypto';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { openSync, closeSync, lstatSync, readFileSync, writeSync } from 'node:fs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// The runner is executed from source after `build:stage`, but staged unit
// tests execute its compiled copy. Resolve the same compiled modules in both.
const MODULE_ROOT = basename(ROOT) === 'build' ? resolve(ROOT, 'src') : resolve(ROOT, 'build/src');
const moduleImport = name => import(pathToFileURL(resolve(MODULE_ROOT, name)).href);
const acquisitionModule = await moduleImport('dataset-acquisition.js');
const vibeModule = await moduleImport('dataset-adapters/vibe.js');
const registryModule = await moduleImport('dataset-adapters/registry.js');
const metricsModule = await moduleImport('dataset-evaluation-metrics.js');
const acquisitionReceiptModule = await moduleImport('dataset-adapters/acquisition.js');
const { createAggregateByteBudget, createOperatorCacheDirectory, createPrivateRunDirectory, fetchBoundedArtifact, writeVerifiedCacheArtifact } = acquisitionModule;
const { normalizeVibeDesignArenaRow, normalizeVibeLandingPageArenaRow, selectStratifiedVibeExamples } = vibeModule;
const { createDatasetProvenance, preflightDatasetProviderUpload } = registryModule;
const { computePreferenceMetrics } = metricsModule;
const { verifyDatasetAcquisitionArtifacts } = acquisitionReceiptModule;
const ROWS_ORIGIN = 'https://datasets-server.huggingface.co';
const MAX_LIMIT = 20;
const MAX_ROWS_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const TIMEOUT_MS = 30_000;
const SPLIT = 'train';
const DATASETS = Object.freeze({
  design: Object.freeze({
    key: 'vibe-design-arena', dataset: 'datapointai/vibe-design-arena',
    revision: 'ee85ae467e14b1f454036544eb37eec0e2ab6368',
  }),
  landing: Object.freeze({
    key: 'vibe-landing-page-arena', dataset: 'datapointai/vibe-landing-page-arena',
    revision: '94d584034e81336fe440dcb3f62fe8d53a65f7f0',
  }),
});

export class VibeEvaluationError extends Error {
  constructor(message) { super(message); this.name = 'VibeEvaluationError'; }
}

function jsonText(value) { return `${JSON.stringify(value, null, 2)}\n`; }
function sha256(value) { return createHash('sha256').update(value).digest('hex'); }

function usage() {
  return [
    'Usage: node scripts/evaluate-vibe.mjs --dataset design|landing --fetch-only [--limit <1..20>] [--seed <value>] [--cache-dir <directory>] [--output-dir <directory>]',
    '   or: node scripts/evaluate-vibe.mjs --dataset design|landing --evaluate-existing <acquisition-output-dir> --cache-dir <directory> --output-dir <new-directory> --upload-confirmation <local JSON>',
    '',
    'Requires HF_TOKEN to read gated dataset rows. Live provider evaluation additionally requires AI_VISUAL_TEST_LIVE=1 and --upload-confirmation <local JSON>.',
  ].join('\n');
}

function optionValue(argv, name) {
  const indices = argv.flatMap((value, index) => value === name ? [index] : []);
  if (indices.length > 1) throw new VibeEvaluationError(`${name} may be specified only once`);
  if (indices.length === 0) return null;
  const value = argv[indices[0] + 1];
  if (!value || value.startsWith('--')) throw new VibeEvaluationError(`${name} requires a value`);
  return value;
}

export function parseArguments(argv) {
  const known = new Set(['--help', '--fetch-only', '--evaluate-existing', '--dataset', '--limit', '--seed', '--cache-dir', '--output-dir', '--upload-confirmation']);
  for (const argument of argv) if (argument.startsWith('--') && !known.has(argument)) throw new VibeEvaluationError(`unknown option: ${argument}`);
  const datasetName = optionValue(argv, '--dataset');
  if (datasetName !== null && !(datasetName in DATASETS)) throw new VibeEvaluationError('--dataset must be design or landing');
  const rawLimit = optionValue(argv, '--limit');
  const limit = rawLimit === null ? 5 : Number(rawLimit);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) throw new VibeEvaluationError(`--limit must be a whole number from 1 to ${MAX_LIMIT}`);
  const dataset = datasetName === null ? null : DATASETS[datasetName];
  const fetchOnly = argv.includes('--fetch-only'); const evaluateExisting = optionValue(argv, '--evaluate-existing');
  if (fetchOnly && evaluateExisting) throw new VibeEvaluationError('--fetch-only and --evaluate-existing cannot be combined');
  return {
    help: argv.includes('--help'), fetchOnly, evaluateExisting, datasetName, dataset, limit,
    seed: optionValue(argv, '--seed') ?? (dataset ? `vibe-${datasetName}-${dataset.revision}` : null),
    cacheDirectory: optionValue(argv, '--cache-dir') ?? (dataset ? resolve(ROOT, `evaluation/cache/vibe-${datasetName}`) : null),
    outputDirectory: optionValue(argv, '--output-dir') ?? (dataset ? resolve(ROOT, `evaluation/results/vibe-${datasetName}`) : null),
    explicitCacheDirectory: optionValue(argv, '--cache-dir') !== null,
    explicitOutputDirectory: optionValue(argv, '--output-dir') !== null,
    confirmationPath: optionValue(argv, '--upload-confirmation'),
  };
}

function requireDataset(options) {
  if (!options.dataset) throw new VibeEvaluationError('--dataset is required');
  return options.dataset;
}

function localOverride() {
  const raw = process.env.AI_VISUAL_TEST_VIBE_ROWS_URL;
  if (raw === undefined) return null;
  if (process.env.NODE_ENV !== 'test') throw new VibeEvaluationError('AI_VISUAL_TEST_VIBE_ROWS_URL is permitted only when NODE_ENV=test');
  let url;
  try { url = new URL(raw); } catch { throw new VibeEvaluationError('AI_VISUAL_TEST_VIBE_ROWS_URL must be an HTTP URL'); }
  if (url.protocol !== 'http:' || !['127.0.0.1', '::1', 'localhost'].includes(url.hostname) || url.pathname !== '/rows') {
    throw new VibeEvaluationError('AI_VISUAL_TEST_VIBE_ROWS_URL must be a loopback HTTP /rows URL');
  }
  return url;
}

function rowsUrl(dataset, offset) {
  const endpoint = localOverride() ?? new URL(`${ROWS_ORIGIN}/rows`);
  endpoint.searchParams.set('dataset', dataset.dataset);
  endpoint.searchParams.set('config', 'comparisons');
  endpoint.searchParams.set('split', SPLIT);
  endpoint.searchParams.set('offset', String(offset));
  endpoint.searchParams.set('length', String(MAX_LIMIT));
  endpoint.searchParams.set('revision', dataset.revision);
  return endpoint;
}

async function localBoundedFetch(url, maximumBytes, subject) {
  let response;
  try { response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS) }); } catch { throw new VibeEvaluationError(`could not fetch ${subject}`); }
  if (!response.ok) throw new VibeEvaluationError(`${subject} request failed with HTTP ${response.status}`);
  const length = response.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > maximumBytes)) throw new VibeEvaluationError(`${subject} exceeded the ${maximumBytes}-byte safety limit`);
  if (!response.body) throw new VibeEvaluationError(`${subject} response had no body`);
  const reader = response.body.getReader(); const chunks = []; let total = 0;
  while (true) {
    const next = await reader.read(); if (next.done) break;
    total += next.value.byteLength;
    if (total > maximumBytes) { await reader.cancel(); throw new VibeEvaluationError(`${subject} exceeded the ${maximumBytes}-byte safety limit`); }
    chunks.push(Buffer.from(next.value));
  }
  return { bytes: Buffer.concat(chunks, total), contentType: response.headers.get('content-type') };
}

async function fetchRows(dataset, offset, token, aggregateByteBudget) {
  const url = rowsUrl(dataset, offset);
  const bytes = localOverride()
    ? (await localBoundedFetch(url, MAX_ROWS_BYTES, 'Vibe dataset rows')).bytes
    : (await fetchBoundedArtifact({ url, maximumBytes: MAX_ROWS_BYTES, timeoutMs: TIMEOUT_MS, sourceToken: token, aggregateByteBudget, allowedSources: [{ origin: ROWS_ORIGIN, pathPrefix: '/rows', acceptsSourceToken: true, requiredRevision: dataset.revision }] })).bytes;
  try { return { payload: JSON.parse(bytes.toString('utf8')), bytes }; } catch { throw new VibeEvaluationError('Vibe dataset rows response was not valid JSON'); }
}

function rows(payload) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.rows)) throw new VibeEvaluationError('Vibe dataset rows response must contain rows');
  return payload.rows.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) || !entry.row || typeof entry.row !== 'object' || Array.isArray(entry.row)) throw new VibeEvaluationError(`Vibe dataset row ${index} was malformed`);
    return entry.row;
  });
}

function imageSource(value, dataset, subject) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value.src : undefined;
  if (typeof source !== 'string') throw new VibeEvaluationError(`${subject} image lacks a URL`);
  let url; try { url = new URL(source); } catch { throw new VibeEvaluationError(`${subject} image URL was invalid`); }
  const test = localOverride() !== null;
  const expectedDatasetPath = `/datasets/${dataset.dataset}/resolve/${dataset.revision}/`;
  const accepted = test
    ? url.protocol === 'http:' && ['127.0.0.1', '::1', 'localhost'].includes(url.hostname) && url.pathname.startsWith(`/assets/${dataset.revision}/`)
    : url.protocol === 'https:' && ((url.origin === ROWS_ORIGIN && url.pathname.startsWith('/assets/')) || (url.origin === 'https://huggingface.co' && url.pathname.startsWith(expectedDatasetPath)));
  if (!accepted || !url.pathname.includes(dataset.revision)) throw new VibeEvaluationError(`${subject} image URL did not use an approved revision-pinned dataset source`);
  return url;
}

function imageSources(dataset) {
  return [
    { origin: ROWS_ORIGIN, pathPrefix: '/assets/', requiredRevision: dataset.revision },
    { origin: 'https://huggingface.co', pathPrefix: `/datasets/${dataset.dataset}/resolve/${dataset.revision}/`, requiredRevision: dataset.revision },
  ];
}

export function sniffImage(bytes) {
  if (!Buffer.isBuffer(bytes)) throw new VibeEvaluationError('selected Vibe image was not a recognized PNG, JPEG, or WebP');
  if (bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return { extension: '.png', contentType: 'image/png' };
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { extension: '.jpg', contentType: 'image/jpeg' };
  if (bytes.subarray(0, 4).equals(Buffer.from('RIFF')) && bytes.subarray(8, 12).equals(Buffer.from('WEBP'))) return { extension: '.webp', contentType: 'image/webp' };
  throw new VibeEvaluationError('selected Vibe image was not a recognized PNG, JPEG, or WebP');
}

function opaqueImageName(example, side, extension) { return `images/${sha256(`${example.id}\u0000${side}`).slice(0, 32)}${extension}`; }

async function acquire(selected, dataset, cacheDirectory, aggregateByteBudget) {
  const local = []; const artifacts = [];
  for (const example of selected) {
    const imageAUrl = imageSource(example.imageA, dataset, `${example.id} A`);
    const imageBUrl = imageSource(example.imageB, dataset, `${example.id} B`);
    const obtain = async (url, side) => {
      const artifact = localOverride()
        ? await localBoundedFetch(url, MAX_IMAGE_BYTES, 'selected Vibe image')
        : await fetchBoundedArtifact({ url, maximumBytes: MAX_IMAGE_BYTES, timeoutMs: TIMEOUT_MS, aggregateByteBudget, allowedSources: imageSources(dataset) });
      const downloaded = artifact.bytes;
      const sourceContentType = artifact.contentType;
      if (!Buffer.isBuffer(downloaded) || downloaded.length === 0) throw new VibeEvaluationError('selected Vibe image was empty');
      const recognized = sniffImage(downloaded);
      const receipt = writeVerifiedCacheArtifact(cacheDirectory, opaqueImageName(example, side, recognized.extension), downloaded);
      return { receipt: { ...receipt, contentType: sourceContentType, recognizedContentType: recognized.contentType }, path: resolve(cacheDirectory, receipt.path) };
    };
    const [a, b] = await Promise.all([obtain(imageAUrl, 'A'), obtain(imageBUrl, 'B')]);
    artifacts.push(a.receipt, b.receipt); local.push({ example, imageAPath: a.path, imageBPath: b.path });
  }
  return { artifacts, local };
}

function privateJson(directory, filename, value) {
  const path = resolve(directory, filename);
  if (dirname(path) !== directory) throw new VibeEvaluationError('output filename escaped its private directory');
  let descriptor;
  try {
    descriptor = openSync(path, 'wx', 0o600);
    const bytes = Buffer.from(jsonText(value)); let offset = 0;
    while (offset < bytes.length) offset += writeSync(descriptor, bytes, offset, bytes.length - offset);
  } catch (error) {
    if (error?.code === 'EEXIST') throw new VibeEvaluationError(`refusing to overwrite existing output: ${filename}`);
    throw error;
  } finally { if (descriptor !== undefined) closeSync(descriptor); }
}

function reversedWinner(value) { return value === 'A' ? 'B' : value === 'B' ? 'A' : value; }

/** Convert the counterbalance receipt into exactly the two raw rendered-order choices expected by metrics. */
export function extractVibeOrderPredictions(outcome) {
  const balance = outcome?.counterBalance;
  const canonical = balance?.canonicalWinners;
  if (!balance || balance.enabled !== true || !Array.isArray(canonical) || canonical.length !== 2) throw new VibeEvaluationError('Vibe comparison must include exactly AB and BA counterbalance winners');
  const [abCanonical, baCanonical] = canonical;
  const valid = value => ['A', 'B', 'tie', 'indeterminate'].includes(value);
  if (!valid(abCanonical) || !valid(baCanonical)) throw new VibeEvaluationError('Vibe counterbalance winners were missing or ambiguous');
  const orders = [{ order: 'AB', prediction: abCanonical }, { order: 'BA', prediction: reversedWinner(baCanonical) }];
  if (new Set(orders.map(order => order.order)).size !== 2) throw new VibeEvaluationError('Vibe comparison had duplicate or ambiguous rendered orders');
  return orders;
}

export async function evaluateVibeExamples(localExamples, evaluator, providerContext = {}) {
  const compare = evaluator ?? (await moduleImport('page-validation.js')).validateComparison;
  const prompt = 'Choose the visually stronger screenshot for overall interface quality. Consider layout, hierarchy, readability, polish, and usability. Return only your visual judgment; do not use, infer, or mention source captions, prompts, labels, tools, votes, or dataset metadata.';
  const results = []; const identities = new Set();
  for (const { example, imageAPath, imageBPath } of localExamples) {
    const outcome = await compare(imageAPath, imageBPath, prompt, { testType: 'vibe-preference', ...providerContext });
    if (outcome?.enabled === false || typeof outcome?.provider !== 'string' || !outcome.provider || typeof outcome?.model !== 'string' || !outcome.model) throw new VibeEvaluationError('a Vibe provider outcome lacked a successful provider/model identity');
    const orders = extractVibeOrderPredictions(outcome);
    const prediction = outcome.winner;
    if (!['A', 'B', 'tie', 'indeterminate'].includes(prediction)) throw new VibeEvaluationError('Vibe comparison lacked a canonical winner');
    identities.add(JSON.stringify({ provider: outcome.provider, model: outcome.model }));
    results.push({ id: example.id, prediction, orders });
  }
  if (identities.size !== 1) throw new VibeEvaluationError('Vibe evaluation produced mixed provider/model identities');
  return { results, run: { evaluator: 'validateComparison', promptVersion: 'vibe-visual-quality-v1', provider: JSON.parse([...identities][0]) } };
}

function confirmation(path) {
  if (!path) throw new VibeEvaluationError('live Vibe evaluation requires --upload-confirmation <local JSON>');
  let entry;
  try { entry = lstatSync(path); } catch { throw new VibeEvaluationError('upload confirmation must be a readable regular file'); }
  if (entry.isSymbolicLink() || !entry.isFile() || entry.size > 64 * 1024 || (entry.mode & 0o077) !== 0) throw new VibeEvaluationError('upload confirmation must be a private regular non-symlink file no larger than 64KiB');
  let raw; try { raw = JSON.parse(readFileSync(path, 'utf8')); } catch { throw new VibeEvaluationError('upload confirmation must be readable JSON'); }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new VibeEvaluationError('upload confirmation must be a JSON object');
  if (typeof raw.provider !== 'string' || raw.provider.trim() === '' || typeof raw.model !== 'string' || raw.model.trim() === '') throw new VibeEvaluationError('upload confirmation must bind non-empty provider and model');
  return raw;
}

export function assertRunMatchesUploadDecision(run, uploadDecision) {
  if (run?.provider?.provider !== uploadDecision?.provider) throw new VibeEvaluationError('Vibe provider result does not match the confirmed upload provider');
  if (run?.provider?.model !== uploadDecision?.confirmation?.model) throw new VibeEvaluationError('Vibe provider result does not match the confirmed upload model');
}

function safeError(error) { return error instanceof VibeEvaluationError ? error.message : 'Vibe evaluation failed safely; inspect local setup and try again.'; }

function readJson(directory, filename) {
  try { return JSON.parse(readFileSync(resolve(directory, filename), 'utf8')); } catch { throw new VibeEvaluationError(`could not read ${filename} from the acquisition output directory`); }
}

function requireNewOutputDirectory(path) {
  try { lstatSync(path); } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw new VibeEvaluationError('could not inspect the requested evaluation output directory');
  }
  throw new VibeEvaluationError('--evaluate-existing requires a new, non-existent --output-dir');
}

function blockedReceipt(dataset, outputDirectory, blockedReason) {
  const acquisition = { version: 1, key: dataset.key, provenance: createDatasetProvenance(dataset.key, dataset.revision), retrievedAt: new Date().toISOString(), normalizerVersion: 'vibe-adapter-v1', artifacts: [], status: 'blocked', blockedReason };
  privateJson(outputDirectory, 'vibe-acquisition-v1.json', acquisition);
}

function unavailableReceipt(dataset, outputDirectory, reason) {
  const acquisition = { version: 1, key: dataset.key, provenance: createDatasetProvenance(dataset.key, dataset.revision), retrievedAt: new Date().toISOString(), normalizerVersion: 'vibe-adapter-v1', artifacts: [], status: 'metadata-only' };
  privateJson(outputDirectory, 'vibe-acquisition-v1.json', acquisition);
  privateJson(outputDirectory, 'vibe-acquisition-error-v1.json', { version: 1, status: 'unavailable', reason });
}

function loadExistingEvaluation(inputDirectory, cacheDirectory, expectedKey) {
  const acquisition = readJson(inputDirectory, 'vibe-acquisition-v1.json');
  const examples = readJson(inputDirectory, 'vibe-examples-v2.json');
  const mapping = readJson(inputDirectory, 'vibe-artifact-map-v1.json');
  const verified = verifyDatasetAcquisitionArtifacts(acquisition, cacheDirectory);
  const selection = examples?.selection;
  if (verified.key !== expectedKey || examples?.acquisition?.key !== expectedKey || examples?.track !== 'preference' || !Array.isArray(examples?.splits) || !Array.isArray(mapping?.entries) || !selection || typeof selection.seed !== 'string' || typeof selection.acquisitionSha256 !== 'string' || typeof selection.normalizedRowsSha256 !== 'string') throw new VibeEvaluationError('existing Vibe acquisition does not match the requested dataset');
  const split = examples.splits.find(candidate => candidate?.name === 'external-eval');
  if (!split || !Array.isArray(split.examples)) throw new VibeEvaluationError('existing Vibe examples lack the external-eval split');
  if (selection.acquisitionSha256 !== sha256(jsonText(acquisition)) || selection.normalizedRowsSha256 !== sha256(jsonText(selection.normalizedRows))) throw new VibeEvaluationError('existing Vibe selection digests do not match its acquisition or normalized examples');
  const normalizedIds = new Set(selection.normalizedRows.map(row => row?.id));
  if (normalizedIds.size !== split.examples.length || split.examples.some(example => !normalizedIds.has(example?.id))) throw new VibeEvaluationError('existing Vibe normalized examples do not match the evaluation split');
  const expectedSplit = selection.normalizedRows.map(example => ({ id: example.id, groupId: example.groupId, sourceGroups: example.sourceGroups, votes: example.votes, ...(example.dimension ? { dimension: example.dimension } : {}) }));
  if (JSON.stringify(split.examples) !== JSON.stringify(expectedSplit)) throw new VibeEvaluationError('existing Vibe evaluation split was modified after selection');
  const artifacts = new Set(verified.artifacts.map(artifact => artifact.path));
  const entries = new Map();
  for (const item of mapping.entries) {
    if (!item || typeof item.id !== 'string' || typeof item.imageAArtifact !== 'string' || typeof item.imageBArtifact !== 'string' || entries.has(item.id) || !artifacts.has(item.imageAArtifact) || !artifacts.has(item.imageBArtifact)) throw new VibeEvaluationError('existing Vibe artifact mapping is incomplete or unsafe');
    entries.set(item.id, item);
  }
  const local = split.examples.map(example => {
    const item = entries.get(example.id);
    if (!item) throw new VibeEvaluationError('existing Vibe artifact mapping omitted an evaluation example');
    return { example, imageAPath: resolve(cacheDirectory, item.imageAArtifact), imageBPath: resolve(cacheDirectory, item.imageBArtifact) };
  });
  if (entries.size !== local.length) throw new VibeEvaluationError('existing Vibe artifact mapping contains unexpected examples');
  return { acquisition: verified, examples, selection, split, local };
}

/** Local-only evaluation seam: tests can inject a comparer without loading any provider. */
export async function evaluateExistingRun({ dataset, inputDirectory, cacheDirectory, outputDirectory, uploadConfirmation, evaluator }) {
  const { acquisition, examples, selection, split, local } = loadExistingEvaluation(inputDirectory, cacheDirectory, dataset.key);
  const uploadDecision = preflightDatasetProviderUpload(dataset.key, { provider: uploadConfirmation.provider, model: uploadConfirmation.model, confirmation: uploadConfirmation });
  const { results, run } = await evaluateVibeExamples(local, evaluator, { provider: uploadDecision.provider, model: uploadDecision.model });
  assertRunMatchesUploadDecision(run, uploadDecision);
  const metrics = computePreferenceMetrics(split.examples, results);
  const runIdentity = { ...run, uploadDecision, selectionSeed: selection.seed, acquisitionSha256: selection.acquisitionSha256, normalizedRowsSha256: selection.normalizedRowsSha256, examplesSha256: sha256(jsonText(examples)) };
  privateJson(outputDirectory, 'vibe-results-v2.json', { version: 2, track: 'preference', acquisition, split: 'external-eval', run: runIdentity, results });
  return { selected: local.length, metrics, runIdentity };
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  if (options.help) { process.stdout.write(`${usage()}\n`); return; }
  const dataset = requireDataset(options);
  if (!options.fetchOnly && !options.evaluateExisting) throw new VibeEvaluationError('choose --fetch-only to acquire or --evaluate-existing to run a local evaluation');
  if (options.evaluateExisting && (!options.explicitCacheDirectory || !options.explicitOutputDirectory)) throw new VibeEvaluationError('--evaluate-existing requires explicit --cache-dir and a new --output-dir');
  if (options.fetchOnly) {
  const outputParent = createOperatorCacheDirectory({ cacheDirectory: options.outputDirectory, repositoryRoot: ROOT });
  const outputDirectory = createPrivateRunDirectory({ parentDirectory: outputParent, prefix: 'vibe-acquisition' });
  const token = process.env.HF_TOKEN;
  if (!localOverride() && (typeof token !== 'string' || token.length === 0)) {
    blockedReceipt(dataset, outputDirectory, 'HF_TOKEN was not provided for gated dataset access');
    throw new VibeEvaluationError(`HF_TOKEN is required to read gated Vibe dataset rows; blocked receipt: ${outputDirectory}`);
  }
  const cacheDirectory = createOperatorCacheDirectory({ cacheDirectory: options.cacheDirectory, repositoryRoot: ROOT });
  const aggregateByteBudget = createAggregateByteBudget(MAX_ROWS_BYTES + (MAX_IMAGE_BYTES * 2 * options.limit));
  let downloadedRows;
  try { downloadedRows = await fetchRows(dataset, 0, token, aggregateByteBudget); } catch (error) {
    const detail = error instanceof Error ? error.message : '';
    if (/HTTP (401|403)/.test(detail)) {
      blockedReceipt(dataset, outputDirectory, 'gated dataset access was denied by the source');
      throw new VibeEvaluationError(`gated Vibe dataset access was denied; blocked receipt: ${outputDirectory}`);
    }
    unavailableReceipt(dataset, outputDirectory, 'dataset rows could not be acquired or parsed');
    throw new VibeEvaluationError(`Vibe dataset rows were unavailable or malformed; receipt: ${outputDirectory}`);
  }
  let rawRows;
  try { rawRows = rows(downloadedRows.payload); } catch {
    unavailableReceipt(dataset, outputDirectory, 'dataset rows were malformed');
    throw new VibeEvaluationError(`Vibe dataset rows were unavailable or malformed; receipt: ${outputDirectory}`);
  }
  const rowsReceipt = writeVerifiedCacheArtifact(cacheDirectory, `rows/${sha256(downloadedRows.bytes).slice(0, 32)}.json`, downloadedRows.bytes);
  let selected; let artifacts; let local;
  try {
    const normalized = rawRows.map(row => dataset.key === 'vibe-design-arena'
      ? normalizeVibeDesignArenaRow(row, createDatasetProvenance(dataset.key, dataset.revision))
      : normalizeVibeLandingPageArenaRow(row, createDatasetProvenance(dataset.key, dataset.revision)));
    selected = selectStratifiedVibeExamples(normalized, { limit: options.limit, seed: options.seed });
    if (selected.length !== options.limit) throw new VibeEvaluationError('Vibe returned fewer valid rows than the requested evaluation limit');
    ({ artifacts, local } = await acquire(selected, dataset, cacheDirectory, aggregateByteBudget));
  } catch {
    unavailableReceipt(dataset, outputDirectory, 'dataset rows or selected images were malformed or unavailable');
    throw new VibeEvaluationError(`Vibe acquisition was unavailable or malformed; receipt: ${outputDirectory}`);
  }
  const acquisition = { version: 1, key: dataset.key, provenance: createDatasetProvenance(dataset.key, dataset.revision), retrievedAt: new Date().toISOString(), normalizerVersion: 'vibe-adapter-v1', artifacts: [rowsReceipt, ...artifacts], status: 'available' };
  const normalizedRows = selected.map(({ imageA, imageB, ...rest }) => rest);
  const selection = { seed: options.seed, acquisitionSha256: sha256(jsonText(acquisition)), normalizedRowsSha256: sha256(jsonText(normalizedRows)), normalizedRows };
  const examples = { version: 2, track: 'preference', acquisition, selection, splits: [{ name: 'external-eval', examples: selected.map(example => ({ id: example.id, groupId: example.groupId, sourceGroups: example.sourceGroups, votes: example.votes, ...(example.dimension ? { dimension: example.dimension } : {}) })) }] };
  const mapping = { version: 1, acquisitionSha256: selection.acquisitionSha256, entries: local.map(({ example, imageAPath, imageBPath }) => ({ id: example.id, imageAArtifact: imageAPath.slice(cacheDirectory.length + 1), imageBArtifact: imageBPath.slice(cacheDirectory.length + 1) })) };
  privateJson(outputDirectory, 'vibe-examples-v2.json', examples);
  privateJson(outputDirectory, 'vibe-acquisition-v1.json', acquisition);
  privateJson(outputDirectory, 'vibe-artifact-map-v1.json', mapping);
  process.stdout.write(`${JSON.stringify({ version: 2, mode: 'fetch-only', dataset: dataset.key, selected: selected.length, artifacts: acquisition.artifacts.length, revision: dataset.revision }, null, 2)}\n`); return;
  }
  if (process.env.AI_VISUAL_TEST_LIVE !== '1') throw new VibeEvaluationError('normal Vibe evaluation requires AI_VISUAL_TEST_LIVE=1; use --fetch-only to acquire without provider calls');
  requireNewOutputDirectory(options.outputDirectory);
  const cacheDirectory = createOperatorCacheDirectory({ cacheDirectory: options.cacheDirectory, repositoryRoot: ROOT });
  const outputDirectory = createOperatorCacheDirectory({ cacheDirectory: options.outputDirectory, repositoryRoot: ROOT });
  const uploadConfirmation = confirmation(options.confirmationPath);
  const completed = await evaluateExistingRun({ dataset, inputDirectory: options.evaluateExisting, cacheDirectory, outputDirectory, uploadConfirmation });
  process.stdout.write(`${JSON.stringify({ version: 2, mode: 'evaluated', dataset: dataset.key, selected: completed.selected, revision: dataset.revision, metrics: completed.metrics }, null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { process.stderr.write(`${safeError(error)}\n`); process.exitCode = 1; });
}
