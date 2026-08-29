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
import { fileURLToPath } from 'node:url';

import {
  normalizeDiffSpotRows,
  selectDiffSpotExamples,
} from '../build/src/dataset-adapters/diffspot.js';
import { createDatasetProvenance } from '../build/src/dataset-adapters/registry.js';
import { computeRegressionMetrics } from '../build/src/dataset-evaluation-metrics.js';
import { validateComparison } from '../build/src/page-validation.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
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
    '',
    'Fetches a bounded sample from revision-pinned tencent/DiffSpot. Dataset pixels and JSON evidence are written only below ignored evaluation/.',
    'Set AI_VISUAL_TEST_LIVE=1 plus provider credentials before normal evaluation; --fetch-only never calls a provider.',
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
  const known = new Set(['--help', '--fetch-only', '--limit', '--cache-dir', '--output-dir']);
  for (const argument of argumentsList) {
    if (argument.startsWith('--') && !known.has(argument)) throw new DiffSpotEvaluationError(`unknown option: ${argument}`);
  }
  const limitValue = optionValue(argumentsList, '--limit');
  const limit = limitValue === null ? 5 : Number(limitValue);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new DiffSpotEvaluationError(`--limit must be a whole number from 1 to ${MAX_LIMIT}`);
  }
  return {
    help: argumentsList.includes('--help'),
    fetchOnly: argumentsList.includes('--fetch-only'),
    limit,
    cacheDirectory: safeCacheDirectory(optionValue(argumentsList, '--cache-dir') ?? DEFAULT_CACHE),
    outputDirectory: safeCacheDirectory(optionValue(argumentsList, '--output-dir') ?? DEFAULT_RESULT_DIRECTORY),
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

async function evaluate(localExamples) {
  const prompt = 'Determine whether there are any visual differences between the before and after images. If the images are identical, report no differences and return an empty differences list. Do not infer changes that are not visible.';
  const results = [];
  const evidence = [];
  const identities = new Set();
  for (const { example, beforePath, afterPath } of localExamples) {
    const outcome = await validateComparison(beforePath, afterPath, prompt, { testType: 'diffspot-regression' });
    if (outcome.enabled === false || typeof outcome.provider !== 'string' || outcome.provider.length === 0 ||
      typeof outcome.model !== 'string' || outcome.model.length === 0) {
      throw new DiffSpotEvaluationError('a DiffSpot provider outcome lacked a successful provider/model identity');
    }
    identities.add(JSON.stringify({ provider: outcome.provider, model: outcome.model }));
    const differences = Array.isArray(outcome.differences) ? outcome.differences.filter(value => typeof value === 'string' && value.trim() !== '') : [];
    results.push({ id: example.id, changed: differences.length > 0 });
    // Store only the derived decision, never a provider response or dataset URLs.
    evidence.push({ id: example.id, changed: differences.length > 0, differenceCount: differences.length });
  }
  if (identities.size !== 1) throw new DiffSpotEvaluationError('DiffSpot evaluation produced mixed provider/model identities');
  return {
    results,
    evidence,
    run: {
      evaluator: 'validateComparison',
      promptVersion: 'diffspot-empty-differences-v1',
      provider: JSON.parse([...identities][0]),
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
  const { results, evidence, run } = await evaluate(localExamples);
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

main().catch(error => {
  process.stderr.write(`${safeError(error)}\n`);
  process.exitCode = 1;
});
