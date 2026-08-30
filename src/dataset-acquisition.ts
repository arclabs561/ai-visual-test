import { createHash, randomUUID } from 'node:crypto';
import {
  chmodSync,
  closeSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  statSync,
  unlinkSync,
  writeSync,
} from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

/** A deliberately narrow error surface for external dataset acquisition. */
export class DatasetAcquisitionBoundaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatasetAcquisitionBoundaryError';
  }
}

export interface ApprovedDatasetSource {
  /** Exact HTTPS origin, for example https://datasets-server.huggingface.co. */
  origin: string;
  /** A pathname prefix; the URL must remain below it, including redirects. */
  pathPrefix: string;
  /** Opt in only for the origin that is permitted to receive a source token. */
  acceptsSourceToken?: boolean;
  /** Require this immutable revision in every request and redirect URL. */
  requiredRevision?: string;
}

/** A run-scoped byte ceiling shared by every acquisition request in that run. */
export class AggregateByteBudget {
  readonly maximumBytes: number;
  #consumedBytes = 0;

  constructor(maximumBytes: number) {
    boundedPositiveInteger(maximumBytes, 'aggregate byte budget');
    this.maximumBytes = maximumBytes;
  }

  get consumedBytes(): number { return this.#consumedBytes; }

  get remainingBytes(): number { return this.maximumBytes - this.#consumedBytes; }

  charge(bytes: number): void {
    boundedPositiveInteger(bytes, 'aggregate byte charge');
    if (bytes > this.remainingBytes) fail(`dataset run exceeds the ${this.maximumBytes}-byte aggregate limit`);
    this.#consumedBytes += bytes;
  }

  assertCanReceive(bytes: number): void {
    if (!Number.isSafeInteger(bytes) || bytes < 0) fail('aggregate byte check must be a non-negative safe integer');
    if (bytes > this.remainingBytes) fail(`dataset run exceeds the ${this.maximumBytes}-byte aggregate limit`);
  }
}

export function createAggregateByteBudget(maximumBytes: number): AggregateByteBudget {
  return new AggregateByteBudget(maximumBytes);
}

export interface FetchBoundedArtifactOptions {
  url: URL | string;
  allowedSources: readonly ApprovedDatasetSource[];
  maximumBytes: number;
  timeoutMs: number;
  sourceToken?: string;
  aggregateByteBudget?: AggregateByteBudget;
  fetchImplementation?: typeof fetch;
  maxRedirects?: number;
}

export interface AcquiredArtifact {
  bytes: Buffer;
  byteLength: number;
  sha256: string;
  contentType: string | null;
  sourceUrl: string;
}

export interface CachedArtifactReceipt {
  path: string;
  bytes: number;
  sha256: string;
}

export interface CreateOperatorCacheDirectoryOptions {
  cacheDirectory: string;
  repositoryRoot: string;
  /** The only permitted repository-internal cache parent. Defaults to evaluation/. */
  ignoredEvaluationDirectory?: string;
}

export interface CreatePrivateRunDirectoryOptions {
  /** A directory already accepted as an operator cache or ignored results parent. */
  parentDirectory: string;
  /** A short, filesystem-safe label for the unique child directory. */
  prefix?: string;
}

function fail(message: string): never {
  throw new DatasetAcquisitionBoundaryError(message);
}

function contained(parent: string, candidate: string): boolean {
  return candidate === parent || candidate.startsWith(`${parent}${sep}`);
}

function asUrl(value: URL | string, subject: string): URL {
  try {
    return new URL(value);
  } catch {
    return fail(`${subject} must be an absolute URL`);
  }
}

function normalizedSource(source: ApprovedDatasetSource): ApprovedDatasetSource {
  const origin = asUrl(source.origin, 'approved source origin');
  if (origin.protocol !== 'https:' || origin.pathname !== '/' || origin.search || origin.hash) {
    fail('approved source origins must be exact HTTPS origins without a path, query, or fragment');
  }
  if (!source.pathPrefix.startsWith('/') || source.pathPrefix.includes('\\') || source.pathPrefix.includes('..')) {
    fail('approved source pathPrefix must be an absolute, traversal-free URL path');
  }
  const pathPrefix = source.pathPrefix.endsWith('/') ? source.pathPrefix : `${source.pathPrefix}/`;
  if (source.requiredRevision !== undefined && !/^[a-f0-9]{40}$/i.test(source.requiredRevision)) {
    fail('approved source requiredRevision must be an exact 40-character hexadecimal commit SHA');
  }
  const normalized: ApprovedDatasetSource = { origin: origin.origin, pathPrefix };
  if (source.acceptsSourceToken !== undefined) normalized.acceptsSourceToken = source.acceptsSourceToken;
  if (source.requiredRevision !== undefined) normalized.requiredRevision = source.requiredRevision;
  return normalized;
}

function containsRequiredRevision(url: URL, revision: string): boolean {
  const pathContainsRevision = url.pathname.split('/').some((segment) => {
    try { return decodeURIComponent(segment) === revision; } catch { return false; }
  });
  return pathContainsRevision || [...url.searchParams.values()].some((value) => value === revision);
}

function matchingSource(url: URL, allowedSources: readonly ApprovedDatasetSource[]): ApprovedDatasetSource {
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) {
    fail('dataset URL must be an HTTPS URL without credentials or a fragment');
  }
  const source = allowedSources.map(normalizedSource).find((candidate) =>
    url.origin === candidate.origin && (url.pathname === candidate.pathPrefix.slice(0, -1) || url.pathname.startsWith(candidate.pathPrefix)),
  );
  if (!source) fail('dataset URL is not on an approved HTTPS source path');
  if (source.requiredRevision !== undefined && !containsRequiredRevision(url, source.requiredRevision)) {
    fail('dataset URL does not bind the approved immutable revision');
  }
  return source;
}

function boundedPositiveInteger(value: number, subject: string): void {
  if (!Number.isSafeInteger(value) || value < 1) fail(`${subject} must be a positive safe integer`);
}

function contentLength(response: Response, maximumBytes: number, aggregateByteBudget: AggregateByteBudget | undefined): void {
  const raw = response.headers.get('content-length');
  if (raw === null) return;
  if (!/^\d+$/.test(raw)) fail('dataset response Content-Length must be an unsigned decimal integer');
  const length = Number(raw);
  if (!Number.isSafeInteger(length) || length > maximumBytes) {
    fail(`dataset response exceeds the ${maximumBytes}-byte limit`);
  }
  aggregateByteBudget?.assertCanReceive(length);
}

async function readBounded(
  response: Response,
  maximumBytes: number,
  aggregateByteBudget: AggregateByteBudget | undefined,
): Promise<Buffer> {
  contentLength(response, maximumBytes, aggregateByteBudget);
  if (response.body === null) fail('dataset response did not include a body');
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        fail(`dataset response exceeds the ${maximumBytes}-byte limit`);
      }
      aggregateByteBudget?.charge(next.value.byteLength);
      chunks.push(Buffer.from(next.value));
    }
  } catch (error) {
    if (error instanceof DatasetAcquisitionBoundaryError) throw error;
    fail('dataset response body could not be read safely');
  }
  return Buffer.concat(chunks, total);
}

/**
 * Fetch a small external artifact while validating every redirect ourselves.
 * `fetch` receives `redirect: manual`; credentials are never forwarded by it.
 */
export async function fetchBoundedArtifact(options: FetchBoundedArtifactOptions): Promise<AcquiredArtifact> {
  boundedPositiveInteger(options.maximumBytes, 'maximumBytes');
  boundedPositiveInteger(options.timeoutMs, 'timeoutMs');
  const maxRedirects = options.maxRedirects ?? 3;
  if (!Number.isSafeInteger(maxRedirects) || maxRedirects < 0 || maxRedirects > 10) {
    fail('maxRedirects must be a safe integer from 0 through 10');
  }
  if (options.sourceToken !== undefined && options.sourceToken.length === 0) fail('sourceToken must not be empty');
  const approved = options.allowedSources.map(normalizedSource);
  if (approved.length === 0) fail('at least one approved dataset source is required');
  if (options.sourceToken !== undefined && approved.filter((source) => source.acceptsSourceToken).length !== 1) {
    fail('a source token requires exactly one approved source with acceptsSourceToken');
  }

  const executeFetch = options.fetchImplementation ?? fetch;
  let current = asUrl(options.url, 'dataset URL');
  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const source = matchingSource(current, approved);
    const headers = new Headers();
    if (options.sourceToken !== undefined && source.acceptsSourceToken === true) {
      headers.set('authorization', `Bearer ${options.sourceToken}`);
    }
    let response: Response;
    try {
      response = await executeFetch(current, {
        headers,
        redirect: 'manual',
        signal: AbortSignal.timeout(options.timeoutMs),
      });
    } catch {
      fail('dataset request failed before a safe response was received');
    }
    if (response.status >= 300 && response.status < 400) {
      if (redirectCount === maxRedirects) fail('dataset request exceeded its redirect limit');
      const location = response.headers.get('location');
      if (location === null || location.length === 0) fail('dataset redirect did not include a Location header');
      current = asUrl(new URL(location, current), 'dataset redirect URL');
      matchingSource(current, approved);
      continue;
    }
    if (!response.ok) fail(`dataset request failed with HTTP ${response.status}`);
    const bytes = await readBounded(response, options.maximumBytes, options.aggregateByteBudget);
    return {
      bytes,
      byteLength: bytes.byteLength,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      contentType: response.headers.get('content-type'),
      sourceUrl: current.toString(),
    };
  }
  return fail('dataset request could not complete safely');
}

function ensureDirectory(path: string, mode: number): void {
  try {
    const entry = lstatSync(path);
    if (entry.isSymbolicLink() || !entry.isDirectory()) fail('operator cache directories must be real directories, never symlinks');
  } catch (error) {
    if (error instanceof DatasetAcquisitionBoundaryError) throw error;
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code !== 'ENOENT') fail('could not inspect operator cache directory');
    mkdirSync(path, { recursive: true, mode });
    const created = lstatSync(path);
    if (created.isSymbolicLink() || !created.isDirectory()) fail('operator cache directories must be real directories, never symlinks');
  }
  chmodSync(path, mode);
  if ((statSync(path).mode & 0o777) !== mode) fail('operator cache directory has unsafe permissions');
}

function assertRealDirectory(path: string, subject: string): void {
  try {
    const entry = lstatSync(path);
    if (entry.isSymbolicLink() || !entry.isDirectory()) fail(`${subject} must be a real directory, never a symlink`);
  } catch (error) {
    if (error instanceof DatasetAcquisitionBoundaryError) throw error;
    fail(`could not inspect ${subject}`);
  }
}

/** Create a private cache, refusing tracked-repository locations outside evaluation/. */
export function createOperatorCacheDirectory(options: CreateOperatorCacheDirectoryOptions): string {
  const cacheDirectory = resolve(options.cacheDirectory);
  const repositoryRoot = resolve(options.repositoryRoot);
  const evaluationDirectory = resolve(options.ignoredEvaluationDirectory ?? resolve(repositoryRoot, 'evaluation'));
  if (cacheDirectory === resolve(sep) || cacheDirectory === repositoryRoot) {
    fail('operator cache directory must not be a filesystem or repository root');
  }
  if (contained(repositoryRoot, cacheDirectory) && !contained(evaluationDirectory, cacheDirectory)) {
    fail('repository-internal dataset caches must be below ignored evaluation/');
  }
  ensureDirectory(cacheDirectory, 0o700);
  const realCache = realpathSync(cacheDirectory);
  if (contained(repositoryRoot, cacheDirectory)) {
    assertRealDirectory(evaluationDirectory, 'ignored evaluation directory');
    if (!contained(realpathSync(evaluationDirectory), realCache)) {
      fail('operator cache resolved outside the ignored evaluation directory');
    }
  }
  return realCache;
}

/** Create a unique private child directory without relying on overwrite-prone names. */
export function createPrivateRunDirectory(options: CreatePrivateRunDirectoryOptions): string {
  const requestedParent = resolve(options.parentDirectory);
  const parentEntry = lstatSync(requestedParent);
  if (parentEntry.isSymbolicLink() || !parentEntry.isDirectory()) fail('private run parent must be a real directory');
  if ((statSync(requestedParent).mode & 0o777) !== 0o700) fail('private run parent must have mode 0700');
  const parent = realpathSync(requestedParent);
  const prefix = options.prefix ?? 'run';
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(prefix)) {
    fail('private run directory prefix must be a short filesystem-safe label');
  }
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const destination = resolve(parent, `${prefix}-${randomUUID()}`);
    if (!contained(parent, destination)) fail('private run directory escaped its approved parent');
    try {
      mkdirSync(destination, { mode: 0o700 });
      const entry = lstatSync(destination);
      if (entry.isSymbolicLink() || !entry.isDirectory()) fail('private run directory must be a real directory');
      chmodSync(destination, 0o700);
      if ((statSync(destination).mode & 0o777) !== 0o700) fail('private run directory has unsafe permissions');
      const realDestination = realpathSync(destination);
      if (!contained(parent, realDestination)) fail('private run directory resolved outside its approved parent');
      return realDestination;
    } catch (error) {
      if (error instanceof DatasetAcquisitionBoundaryError) throw error;
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code !== 'EEXIST') fail('could not create private run directory');
    }
  }
  return fail('could not allocate a unique private run directory');
}

/** Turn an untrusted receipt path into a portable relative cache path. */
export function safeCacheRelativePath(value: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.includes('\0') || isAbsolute(value) || value.includes('\\')) {
    fail('cache artifact path must be a non-empty portable relative path');
  }
  const parts = value.split('/');
  if (parts.some((part) => part.length === 0 || part === '.' || part === '..' || part.includes(':'))) {
    fail('cache artifact path must be a traversal-free portable relative path');
  }
  return parts.join('/');
}

function safeDestination(cacheDirectory: string, relativePath: string): string {
  const root = realpathSync(cacheDirectory);
  const destination = resolve(root, ...safeCacheRelativePath(relativePath).split('/'));
  if (!contained(root, destination)) fail('cache artifact path escaped the operator cache directory');
  return destination;
}

function verifiedCacheRoot(cacheDirectory: string): string {
  const requested = resolve(cacheDirectory);
  const requestedEntry = lstatSync(requested);
  if (requestedEntry.isSymbolicLink() || !requestedEntry.isDirectory()) fail('operator cache must be a real directory');
  if ((statSync(requested).mode & 0o777) !== 0o700) fail('operator cache directory must have mode 0700');
  return realpathSync(requested);
}

function ensureArtifactParent(cacheDirectory: string, destination: string): void {
  const root = realpathSync(cacheDirectory);
  const parent = dirname(destination);
  if (!contained(root, parent)) fail('cache artifact parent escaped the operator cache directory');
  mkdirSync(parent, { recursive: true, mode: 0o700 });
  const actualParent = realpathSync(parent);
  if (!contained(root, actualParent)) fail('cache artifact parent resolved outside the operator cache directory');
  const parentEntry = lstatSync(parent);
  if (parentEntry.isSymbolicLink() || !parentEntry.isDirectory()) fail('cache artifact parent must be a real directory');
  chmodSync(parent, 0o700);
}

function writeAll(descriptor: number, bytes: Uint8Array): void {
  let offset = 0;
  while (offset < bytes.byteLength) {
    const written = writeSync(descriptor, bytes, offset, bytes.byteLength - offset);
    if (written < 1) fail('could not write complete cache artifact');
    offset += written;
  }
}

/**
 * Atomically create a mode-0600 cache artifact. An existing byte-identical
 * artifact is reused; a conflicting artifact is never replaced.
 */
export function writeVerifiedCacheArtifact(
  cacheDirectory: string,
  relativePath: string,
  bytes: Uint8Array,
): CachedArtifactReceipt {
  const root = verifiedCacheRoot(cacheDirectory);
  const destination = safeDestination(root, relativePath);
  ensureArtifactParent(root, destination);
  const temporary = `${destination}.partial-${process.pid}-${Date.now()}`;
  let descriptor: number | undefined;
  try {
    descriptor = openSync(temporary, 'wx', 0o600);
    writeAll(descriptor, bytes);
    closeSync(descriptor);
    descriptor = undefined;
    // `link` atomically fails when destination already exists, unlike rename.
    linkSync(temporary, destination);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === 'EEXIST') {
      const existing = verifyCachedArtifact(root, relativePath);
      const expectedSha256 = createHash('sha256').update(bytes).digest('hex');
      if (existing.bytes === bytes.byteLength && existing.sha256 === expectedSha256) return existing;
      fail(`refusing to overwrite existing cache artifact: ${relativePath}`);
    }
    if (error instanceof DatasetAcquisitionBoundaryError) throw error;
    fail('could not atomically write cache artifact');
  } finally {
    if (descriptor !== undefined) {
      closeSync(descriptor);
    }
    try { unlinkSync(temporary); } catch { /* temporary may not exist */ }
  }
  return verifyCachedArtifact(root, relativePath);
}

/** Verify that a local receipt still names a regular, non-symlink cache artifact. */
export function verifyCachedArtifact(cacheDirectory: string, relativePath: string): CachedArtifactReceipt {
  const root = verifiedCacheRoot(cacheDirectory);
  const destination = safeDestination(root, relativePath);
  const entry = lstatSync(destination);
  if (entry.isSymbolicLink() || !entry.isFile()) fail('cache artifact must be a regular non-symlink file');
  const realArtifact = realpathSync(destination);
  if (!contained(root, realArtifact)) fail('cache artifact resolved outside the operator cache directory');
  const bytes = readFileSync(destination);
  return {
    path: safeCacheRelativePath(relativePath),
    bytes: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}
