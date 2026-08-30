#!/usr/bin/env node

/**
 * Bounded external evaluation runner for the revision-pinned DiffSpot split.
 * Dataset pixels and generated evidence remain under ignored evaluation/.
 */

import { createHash } from 'node:crypto';
import {
  mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { basename, dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Source scripts load staged modules from build/src.  The staged copy lives
// under build/scripts, where its sibling modules are instead build/src.
const MODULE_ROOT = basename(ROOT) === 'build' ? resolve(ROOT, 'src') : resolve(ROOT, 'build/src');
const moduleImport = name => import(pathToFileURL(resolve(MODULE_ROOT, name)).href);
const [diffspotModule, registryModule, metricsModule, openRouterModule] = await Promise.all([
  moduleImport('dataset-adapters/diffspot.js'),
  moduleImport('dataset-adapters/registry.js'),
  moduleImport('dataset-evaluation-metrics.js'),
  moduleImport('openrouter-vision-evaluator.js'),
]);
const { normalizeDiffSpotRows, selectDiffSpotExamples } = diffspotModule;
const { createDatasetProvenance, preflightDatasetProviderUpload } = registryModule;
const { computeRegressionMetrics } = metricsModule;
const { aggregateOpenRouterUsage, evaluateOpenRouterVision } = openRouterModule;

const DATASET = 'tencent/DiffSpot';
const REVISION = 'c6dd79d5e1c0cbb4e7ca234c9f53c418a75e30ce';
const DEFAULT_CACHE = resolve(ROOT, 'evaluation/cache/diffspot');
const DEFAULT_RESULT_DIRECTORY = resolve(ROOT, 'evaluation/results/diffspot');
const DEFAULT_ROWS_URL = 'https://datasets-server.huggingface.co/rows';
const SPLIT = 'test';
const MAX_LIMIT = 20;
const NO_DIFF_OFFSET = 4000;
const MAX_ROWS_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const SELECTION_SEED = `diffspot-${REVISION}`;

class DiffSpotEvaluationError extends Error {
  constructor(message) { super(message); this.name = 'DiffSpotEvaluationError'; }
}

function usage() {
  return [
    'Usage: node scripts/evaluate-diffspot.mjs [--limit <1..20>] [--cache-dir <directory>] [--output-dir <directory>] [--fetch-only]',
    '   or: node scripts/evaluate-diffspot.mjs --openrouter-model <model> --openrouter-provider <endpoint-slug> [--limit <1..20>] [--cache-dir <directory>] [--output-dir <directory>]',
    '',
    'Fetches a bounded sample from revision-pinned tencent/DiffSpot. Dataset pixels and JSON evidence are written only below ignored evaluation/.',
    'Set AI_VISUAL_TEST_LIVE=1, OPENROUTER_API_KEY, an explicit --openrouter-model, and --openrouter-provider endpoint slug before hosted evaluation; --fetch-only never calls a provider.',
  ].join('\n');
}

function optionValue(argumentsList, name) {
  const indices = argumentsList.flatMap((value, index) => value === name ? [index] : []);
  if (indices.length > 1) throw new DiffSpotEvaluationError(`${name} may be specified only once`);
  if (indices.length === 0) return null;
  const value = argumentsList[indices[0] + 1];
  if (!value || value.startsWith('--')) throw new DiffSpotEvaluationError(`${name} requires a value`);
  return value;
}

function parseArguments(argumentsList) {
  const known = new Set(['--help', '--fetch-only', '--limit', '--cache-dir', '--output-dir', '--openrouter-model', '--openrouter-provider']);
  for (const argument of argumentsList) {
    if (argument.startsWith('--') && !known.has(argument)) throw new DiffSpotEvaluationError(`unknown option: ${argument}`);
  }
  const limitValue = optionValue(argumentsList, '--limit');
  const limit = limitValue === null ? 5 : Number(limitValue);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new DiffSpotEvaluationError(`--limit must be a whole number from 1 to ${MAX_LIMIT}`);
  }
  const help = argumentsList.includes('--help');
  const fetchOnly = argumentsList.includes('--fetch-only');
  const openRouterModel = optionValue(argumentsList, '--openrouter-model');
  const openRouterProvider = optionValue(argumentsList, '--openrouter-provider');
  const cacheDirectory = safeCacheDirectory(optionValue(argumentsList, '--cache-dir') ?? DEFAULT_CACHE);
  const outputDirectory = safeCacheDirectory(optionValue(argumentsList, '--output-dir') ?? DEFAULT_RESULT_DIRECTORY);
  if (!help && fetchOnly && (openRouterModel !== null || openRouterProvider !== null)) throw new DiffSpotEvaluationError('--fetch-only does not accept OpenRouter evaluator options');
  if (!help && !fetchOnly && openRouterModel === null) throw new DiffSpotEvaluationError('normal DiffSpot evaluation requires an explicit --openrouter-model');
  if (!help && !fetchOnly && openRouterProvider === null) throw new DiffSpotEvaluationError('normal DiffSpot evaluation requires an explicit --openrouter-provider');
  return {
    help,
    fetchOnly,
    openRouterModel,
    openRouterProvider,
    limit,
    cacheDirectory,
    outputDirectory,
  };
}

function within(parent, candidate) {
  return candidate === parent || candidate.startsWith(`${parent}${sep}`);
}

function safeCacheDirectory(value) {
  if (typeof value !== 'string' || value.trim() === '') throw new DiffSpotEvaluationError('--cache-dir must be a non-empty directory path');
  const directory = resolve(value);
  if (directory === resolve(sep) || directory === ROOT) throw new DiffSpotEvaluationError('--cache-dir must not be a filesystem or repository root');
  // Keep accidental tracked dataset material out of the repository. evaluation/
  // is explicitly ignored; an operator may also select a directory elsewhere.
  if (within(ROOT, directory) && !within(resolve(ROOT, 'evaluation'), directory)) {
    throw new DiffSpotEvaluationError('--cache-dir inside this repository must be below ignored evaluation/');
  }
  try {
    if (statSync(directory).isFile()) throw new DiffSpotEvaluationError('--cache-dir must be a directory, not a file');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  return directory;
}

function atomicJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  try {
    writeFileSync(temporary, jsonText(value), { mode: 0o600 });
    renameSync(temporary, path);
  } finally {
    rmSync(temporary, { force: true });
  }
}

function jsonText(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function rowsUrl(offset) {
  const override = process.env.AI_VISUAL_TEST_DIFFSPOT_ROWS_URL;
  const endpoint = new URL(override || DEFAULT_ROWS_URL);
  if (override && endpoint.protocol !== 'http:' && endpoint.protocol !== 'https:') {
    throw new DiffSpotEvaluationError('AI_VISUAL_TEST_DIFFSPOT_ROWS_URL must use HTTP(S)');
  }
  if (override && !['127.0.0.1', '::1', 'localhost'].includes(endpoint.hostname)) {
    throw new DiffSpotEvaluationError('AI_VISUAL_TEST_DIFFSPOT_ROWS_URL is restricted to a local test server');
  }
  endpoint.searchParams.set('dataset', DATASET);
  endpoint.searchParams.set('config', 'default');
  endpoint.searchParams.set('split', SPLIT);
  endpoint.searchParams.set('offset', String(offset));
  endpoint.searchParams.set('length', String(MAX_LIMIT));
  endpoint.searchParams.set('revision', REVISION);
  return endpoint;
}

function safeError(error) {
  if (error instanceof DiffSpotEvaluationError) return error.message;
  return 'DiffSpot evaluation failed safely; inspect local setup and try again.';
}

async function fetchJson(url) {
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  } catch {
    throw new DiffSpotEvaluationError('could not fetch the DiffSpot dataset rows');
  }
  if (!response.ok) throw new DiffSpotEvaluationError(`DiffSpot dataset rows request failed with HTTP ${response.status}`);
  const bytes = await boundedBytes(response, MAX_ROWS_BYTES, 'DiffSpot dataset rows');
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new DiffSpotEvaluationError('DiffSpot dataset rows response was not valid JSON');
  }
}

async function boundedBytes(response, maximum, subject) {
  const contentLength = response.headers.get('content-length');
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength) || Number(contentLength) > maximum) {
      throw new DiffSpotEvaluationError(`${subject} exceeded the ${maximum}-byte safety limit`);
    }
  }
  if (!response.body) throw new DiffSpotEvaluationError(`${subject} response had no body`);
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximum) {
        await reader.cancel();
        throw new DiffSpotEvaluationError(`${subject} exceeded the ${maximum}-byte safety limit`);
      }
      chunks.push(Buffer.from(value));
    }
  } catch (error) {
    if (error instanceof DiffSpotEvaluationError) throw error;
    throw new DiffSpotEvaluationError(`could not read ${subject}`);
  }
  return Buffer.concat(chunks, total);
}

function datasetRows(value) {
  if (value === null || typeof value !== 'object' || !Array.isArray(value.rows)) {
    throw new DiffSpotEvaluationError('DiffSpot dataset rows response must contain rows');
  }
  return value.rows.map((entry, index) => {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry) || entry.row === null || typeof entry.row !== 'object') {
      throw new DiffSpotEvaluationError(`DiffSpot dataset row ${index} was malformed`);
    }
    return entry.row;
  });
}

function imageUrl(image, subject) {
  if (image === null || typeof image !== 'object' || Array.isArray(image) || typeof image.src !== 'string') {
    throw new DiffSpotEvaluationError(`${subject} image lacks a URL`);
  }
  let url;
  try { url = new URL(image.src); } catch { throw new DiffSpotEvaluationError(`${subject} image URL was invalid`); }
  const localFixture = process.env.AI_VISUAL_TEST_DIFFSPOT_ROWS_URL !== undefined
    && ['127.0.0.1', '::1', 'localhost'].includes(url.hostname);
  if ((!localFixture && (url.protocol !== 'https:' || url.hostname !== 'datasets-server.huggingface.co')) ||
    (localFixture && (url.protocol !== 'http:' || !['127.0.0.1', '::1', 'localhost'].includes(url.hostname)))) {
    throw new DiffSpotEvaluationError(`${subject} image URL did not use the expected dataset server`);
  }
  if (!url.pathname.includes(`/${REVISION}/`)) {
    throw new DiffSpotEvaluationError(`${subject} image URL did not embed the pinned dataset revision`);
  }
  return url;
}

function extension(url) {
  const candidate = basename(url.pathname).toLowerCase();
  return /\.(png|jpe?g|webp|gif)$/.test(candidate) ? candidate.slice(candidate.lastIndexOf('.')) : '.image';
}

async function download(url, destination) {
  let response;
  try { response = await fetch(url, { signal: AbortSignal.timeout(30_000) }); } catch {
    throw new DiffSpotEvaluationError('could not download a selected DiffSpot image');
  }
  if (!response.ok) throw new DiffSpotEvaluationError(`selected DiffSpot image request failed with HTTP ${response.status}`);
  const bytes = await boundedBytes(response, MAX_IMAGE_BYTES, 'selected DiffSpot image');
  if (bytes.length === 0) throw new DiffSpotEvaluationError('selected DiffSpot image was empty');
  mkdirSync(dirname(destination), { recursive: true });
  const temporary = `${destination}.${process.pid}.tmp`;
  try {
    writeFileSync(temporary, bytes, { mode: 0o600 });
    renameSync(temporary, destination);
  } finally {
    rmSync(temporary, { force: true });
  }
  return { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}

function relativeArtifact(cacheDirectory, path) {
  const artifact = relative(cacheDirectory, path);
  if (!artifact || artifact.startsWith(`..${sep}`) || artifact === '..') throw new DiffSpotEvaluationError('selected artifact escaped the cache directory');
  return artifact;
}

async function acquire(examples, cacheDirectory) {
  const artifacts = [];
  const localExamples = [];
  for (const example of examples) {
    const beforeUrl = imageUrl(example.before, `${example.id} before`);
    const afterUrl = imageUrl(example.after, `${example.id} after`);
    const directory = resolve(cacheDirectory, 'images', example.id);
    if (!within(cacheDirectory, directory)) throw new DiffSpotEvaluationError('DiffSpot row ID produced an unsafe cache path');
    const beforePath = resolve(directory, `before${extension(beforeUrl)}`);
    const afterPath = resolve(directory, `after${extension(afterUrl)}`);
    const [before, after] = await Promise.all([
      download(beforeUrl, beforePath),
      download(afterUrl, afterPath),
    ]);
    artifacts.push(
      { path: relativeArtifact(cacheDirectory, beforePath), ...before },
      { path: relativeArtifact(cacheDirectory, afterPath), ...after },
    );
    localExamples.push({ example, beforePath, afterPath });
  }
  return { artifacts, localExamples };
}

function examplesDocument(acquisition, localExamples, selection) {
  return {
    version: 2,
    track: 'regression',
    acquisition,
    selection,
    splits: [{
      name: 'external-eval',
      examples: localExamples.map(({ example }) => ({
        id: example.id,
        groupId: example.groupId,
        sourceGroups: [example.groupId],
        taskType: example.taskType,
        difficulty: example.difficulty,
        domain: example.domain,
      })),
    }],
  };
}

function verifyBoundArtifacts(localExamples, cacheDirectory, artifacts) {
  const expected = new Map(artifacts.map(artifact => [artifact.path, artifact]));
  for (const { beforePath, afterPath } of localExamples) {
    for (const path of [beforePath, afterPath]) {
      const artifactPath = relativeArtifact(cacheDirectory, path);
      const artifact = expected.get(artifactPath);
      if (!artifact) throw new DiffSpotEvaluationError('DiffSpot evaluator image was not bound to the acquisition receipt');
      let metadata;
      try { metadata = statSync(path); } catch { throw new DiffSpotEvaluationError('DiffSpot evaluator image was unavailable after acquisition'); }
      if (!metadata.isFile()) throw new DiffSpotEvaluationError('DiffSpot evaluator image must be a regular file');
      const bytes = readFileSync(path);
      if (bytes.length !== artifact.bytes || createHash('sha256').update(bytes).digest('hex') !== artifact.sha256) {
        throw new DiffSpotEvaluationError('DiffSpot evaluator image did not match its acquisition receipt');
      }
    }
  }
}

const OPENROUTER_PROMPT = 'Compare image A (before) with image B (after). Return {"value":true} if any visible visual difference exists. Return {"value":false} only if they are visually identical. Do not infer changes that are not visible.';

function requestConfig(value, providerSlug) {
  if (value === null || typeof value !== 'object' || Array.isArray(value) ||
    Object.keys(value).length !== 3 || !Object.hasOwn(value, 'maximumOutputTokens') || !Object.hasOwn(value, 'reasoning') || !Object.hasOwn(value, 'providerRouting')) {
    throw new DiffSpotEvaluationError('a DiffSpot OpenRouter outcome lacked a storage-safe request configuration');
  }
  if (!Number.isSafeInteger(value.maximumOutputTokens) || value.maximumOutputTokens < 1 || value.maximumOutputTokens > 4_096 ||
    value.reasoning === null || typeof value.reasoning !== 'object' || Array.isArray(value.reasoning) ||
    Object.keys(value.reasoning).length !== 2 || value.reasoning.effort !== 'minimal' || value.reasoning.exclude !== true ||
    value.providerRouting === null || typeof value.providerRouting !== 'object' || Array.isArray(value.providerRouting) ||
    Object.keys(value.providerRouting).length !== 4 || !Array.isArray(value.providerRouting.only) || value.providerRouting.only.length !== 1 ||
    value.providerRouting.only[0] !== providerSlug || value.providerRouting.allow_fallbacks !== false ||
    value.providerRouting.require_parameters !== true || value.providerRouting.data_collection !== 'deny') {
    throw new DiffSpotEvaluationError('a DiffSpot OpenRouter outcome had an unsafe request configuration');
  }
  return {
    maximumOutputTokens: value.maximumOutputTokens,
    reasoning: { effort: 'minimal', exclude: true },
    providerRouting: { only: [providerSlug], allow_fallbacks: false, require_parameters: true, data_collection: 'deny' },
  };
}

/**
 * Hosted evaluation seam.  The caller supplies only verified local images and
 * may inject a no-network evaluator for unit tests; production uses the
 * canonical OpenRouter implementation.
 */
export async function evaluateDiffSpotExamples(localExamples, {
  model,
  providerSlug,
  cacheDirectory,
  artifacts,
  evaluateRemote = evaluateOpenRouterVision,
  preflight = preflightDatasetProviderUpload,
} = {}) {
  if (typeof model !== 'string' || model.trim() === '') throw new DiffSpotEvaluationError('DiffSpot OpenRouter model must be non-empty');
  if (typeof providerSlug !== 'string' || providerSlug.trim() === '') throw new DiffSpotEvaluationError('DiffSpot OpenRouter provider slug must be non-empty');
  if (typeof evaluateRemote !== 'function' || typeof preflight !== 'function') throw new DiffSpotEvaluationError('DiffSpot evaluation dependencies must be functions');
  if (!Array.isArray(localExamples) || localExamples.length === 0) throw new DiffSpotEvaluationError('DiffSpot evaluation requires at least one acquired example');
  if (!Array.isArray(artifacts) || typeof cacheDirectory !== 'string') throw new DiffSpotEvaluationError('DiffSpot evaluation requires a verified acquisition receipt');
  verifyBoundArtifacts(localExamples, cacheDirectory, artifacts);
  // This gate runs after every artifact binding check and immediately before
  // the first possible provider call, so a receipt or policy failure cannot
  // send pixels remotely.
  const uploadDecision = preflight('diffspot', { provider: 'openrouter', model: model.trim() });
  if (uploadDecision.provider !== 'openrouter' || uploadDecision.model !== model.trim()) {
    throw new DiffSpotEvaluationError('DiffSpot provider upload decision did not match the selected OpenRouter model');
  }
  const results = [];
  const evidence = [];
  const nativeModels = new Set();
  const routedProviders = new Set();
  const requestConfigs = new Set();
  const usages = [];
  for (const { example, beforePath, afterPath } of localExamples) {
    const remote = await evaluateRemote({
      imagePaths: [beforePath, afterPath],
      prompt: OPENROUTER_PROMPT,
      model: uploadDecision.model,
      providerSlug: providerSlug.trim(),
      responseKind: 'binary',
    });
    if (!remote || remote.outcome?.kind !== 'binary' || typeof remote.outcome.value !== 'boolean' ||
      typeof remote.model !== 'string' || remote.model !== uploadDecision.model || !remote.usage || remote.requestConfig === undefined) {
      throw new DiffSpotEvaluationError('a DiffSpot OpenRouter outcome lacked the selected model, binary decision, usage receipt, or request configuration');
    }
    requestConfigs.add(JSON.stringify(requestConfig(remote.requestConfig, providerSlug.trim())));
    if (remote.nativeModel !== undefined) nativeModels.add(remote.nativeModel);
    if (remote.provider !== undefined) routedProviders.add(remote.provider);
    usages.push(remote.usage);
    results.push({ id: example.id, changed: remote.outcome.value });
    // Store only the derived decision, never raw provider content or dataset URLs.
    evidence.push({ id: example.id, changed: remote.outcome.value });
  }
  if (nativeModels.size > 1 || routedProviders.size > 1) throw new DiffSpotEvaluationError('DiffSpot evaluation produced mixed routed provider identities');
  if (requestConfigs.size !== 1) throw new DiffSpotEvaluationError('DiffSpot evaluation produced mixed request configurations');
  const usage = aggregateOpenRouterUsage(usages);
  return {
    results,
    evidence,
    run: {
      evaluator: 'openrouter-vision-evaluator',
      promptVersion: 'diffspot-binary-visible-change-v1',
      provider: uploadDecision.provider,
      model: uploadDecision.model,
      ...(nativeModels.size === 0 ? {} : { nativeModel: [...nativeModels][0] }),
      ...(routedProviders.size === 0 ? {} : { routedProvider: [...routedProviders][0] }),
      requestConfig: JSON.parse([...requestConfigs][0]),
      usage,
      uploadDecision,
    },
  };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const payloads = await Promise.all([
    fetchJson(rowsUrl(0)),
    fetchJson(rowsUrl(NO_DIFF_OFFSET)),
  ]);
  const outputDirectory = options.outputDirectory;
  const normalized = normalizeDiffSpotRows(
    payloads.flatMap(datasetRows),
    createDatasetProvenance('diffspot', REVISION),
  );
  const selected = selectDiffSpotExamples(normalized, { limit: options.limit, seed: SELECTION_SEED });
  if (selected.length !== options.limit) throw new DiffSpotEvaluationError('DiffSpot returned fewer valid rows than the requested evaluation limit');
  const { artifacts, localExamples } = await acquire(selected, options.cacheDirectory);
  const acquisition = {
    version: 1,
    key: 'diffspot',
    provenance: createDatasetProvenance('diffspot', REVISION),
    retrievedAt: new Date().toISOString(),
    normalizerVersion: 'diffspot-adapter-v1',
    artifacts,
    status: 'available',
  };
  const normalizedRows = localExamples.map(({ example }) => example);
  const selection = {
    seed: SELECTION_SEED,
    acquisitionSha256: createHash('sha256').update(jsonText(acquisition)).digest('hex'),
    normalizedRowsSha256: createHash('sha256').update(jsonText(normalizedRows)).digest('hex'),
    normalizedRows,
  };
  const examples = examplesDocument(acquisition, localExamples, selection);
  atomicJson(resolve(outputDirectory, 'diffspot-examples-v2.json'), examples);
  atomicJson(resolve(outputDirectory, 'diffspot-acquisition-v1.json'), acquisition);
  if (options.fetchOnly) {
    process.stdout.write(`${JSON.stringify({ version: 2, mode: 'fetch-only', selected: selected.length, artifacts: artifacts.length, revision: REVISION }, null, 2)}\n`);
    return;
  }
  if (process.env.AI_VISUAL_TEST_LIVE !== '1') {
    throw new DiffSpotEvaluationError('normal DiffSpot evaluation requires AI_VISUAL_TEST_LIVE=1; use --fetch-only to acquire without provider calls');
  }
  const { results, evidence, run } = await evaluateDiffSpotExamples(localExamples, {
    model: options.openRouterModel,
    providerSlug: options.openRouterProvider,
    cacheDirectory: options.cacheDirectory,
    artifacts,
  });
  const metrics = computeRegressionMetrics(
    examples.splits[0].examples,
    results,
  );
  const runIdentity = {
    ...run,
    selectionSeed: selection.seed,
    acquisitionSha256: selection.acquisitionSha256,
    normalizedRowsSha256: selection.normalizedRowsSha256,
    examplesSha256: createHash('sha256').update(jsonText(examples)).digest('hex'),
  };
  const resultsDocument = { version: 2, track: 'regression', acquisition, split: 'external-eval', run: runIdentity, results };
  atomicJson(resolve(outputDirectory, 'diffspot-results-v2.json'), resultsDocument);
  atomicJson(resolve(outputDirectory, 'diffspot-evidence-v1.json'), { version: 1, track: 'regression', acquisition, run: runIdentity, evidence });
  process.stdout.write(`${JSON.stringify({ version: 2, mode: 'evaluated', selected: selected.length, revision: REVISION, metrics }, null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    process.stderr.write(`${safeError(error)}\n`);
    process.exitCode = 1;
  });
}
