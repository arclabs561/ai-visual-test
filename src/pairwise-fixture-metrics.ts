/**
 * Offline measurements for a human-reviewed pairwise fixture set.
 *
 * This module deliberately measures agreement only. It neither calls a model
 * nor interprets the numbers as a claim of model quality.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { isAbsolute, resolve, sep } from 'node:path';

export const PAIRWISE_FIXTURE_MANIFEST_VERSION = 1;

export const PAIRWISE_WINNERS = ['A', 'B', 'tie', 'indeterminate'] as const;
export type PairwiseWinner = typeof PAIRWISE_WINNERS[number];
export type DecidedPairwiseWinner = Exclude<PairwiseWinner, 'indeterminate'>;

export interface FixtureAsset {
  path: string;
  sha256: string;
}

export interface HumanPairwiseReview {
  reviewer: string;
  winner: PairwiseWinner;
  rationale: string;
}

export interface PairwiseCaptureMetadata {
  viewport: { width: number; height: number };
  browser: string;
  deviceScaleFactor: number;
  colorScheme: 'light' | 'dark';
  fullPage: boolean;
  stable: true;
  animations: 'disabled';
  caret: 'hide';
}

export interface PairwiseFixture {
  id: string;
  prompt: string;
  rubricVersion: string;
  before: FixtureAsset;
  after: FixtureAsset;
  capture: PairwiseCaptureMetadata;
  humanReviews: HumanPairwiseReview[];
}

export interface PairwiseFixtureManifest {
  version: number;
  fixtures: PairwiseFixture[];
}

export type HumanLabelStatus = 'consensus' | 'abstained' | 'insufficient' | 'conflict';

export interface ValidatedPairwiseFixture extends PairwiseFixture {
  labelStatus: HumanLabelStatus;
  consensusWinner: PairwiseWinner | null;
}

export interface ValidatedPairwiseFixtureManifest {
  version: number;
  fixtures: ValidatedPairwiseFixture[];
}

export interface PairwiseFixtureResult {
  id: string;
  winner: PairwiseWinner;
  counterBalance?: { status?: 'agree' | 'conflict' | 'incomplete' };
}

export interface PairwiseFixtureMetrics {
  totalFixtures: number;
  labeled: number;
  decided: number;
  abstained: number;
  exactAgreement: { matches: number; compared: number; rate: number | null };
  rates: {
    abstention: number | null;
    conflict: number | null;
    incomplete: number | null;
  };
  confusion: Record<DecidedPairwiseWinner, Record<DecidedPairwiseWinner, number>>;
  missingResults: string[];
  missingLabels: string[];
  excludedNonConsensus: string[];
}

export class PairwiseFixtureManifestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PairwiseFixtureManifestError';
  }
}

function record(value: unknown, subject: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new PairwiseFixtureManifestError(`${subject} must be an object`);
  }
  return value as Record<string, unknown>;
}

function string(value: unknown, subject: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new PairwiseFixtureManifestError(`${subject} must be a non-empty string`);
  }
  return value;
}

function winner(value: unknown, subject: string): PairwiseWinner {
  if (typeof value !== 'string' || !PAIRWISE_WINNERS.includes(value as PairwiseWinner)) {
    throw new PairwiseFixtureManifestError(`${subject} must be one of ${PAIRWISE_WINNERS.join(', ')}`);
  }
  return value as PairwiseWinner;
}

function safeRelativePath(value: unknown, subject: string): string {
  const path = string(value, subject);
  if (isAbsolute(path) || path.split(/[\\/]+/).includes('..')) {
    throw new PairwiseFixtureManifestError(`${subject} must be a safe relative path`);
  }
  return path;
}

function asset(value: unknown, subject: string): FixtureAsset {
  const candidate = record(value, subject);
  const sha256 = string(candidate.sha256, `${subject}.sha256`);
  if (!/^[a-f0-9]{64}$/.test(sha256)) {
    throw new PairwiseFixtureManifestError(`${subject}.sha256 must be a lowercase SHA-256 digest`);
  }
  return { path: safeRelativePath(candidate.path, `${subject}.path`), sha256 };
}

function reviews(value: unknown, subject: string): HumanPairwiseReview[] {
  if (!Array.isArray(value)) throw new PairwiseFixtureManifestError(`${subject} must be an array`);
  const seenReviewers = new Set<string>();
  return value.map((entry, index) => {
    const candidate = record(entry, `${subject}[${index}]`);
    const reviewer = string(candidate.reviewer, `${subject}[${index}].reviewer`);
    if (seenReviewers.has(reviewer)) {
      throw new PairwiseFixtureManifestError(`${subject} reviewers must be distinct`);
    }
    seenReviewers.add(reviewer);
    return {
      reviewer,
      winner: winner(candidate.winner, `${subject}[${index}].winner`),
      rationale: string(candidate.rationale, `${subject}[${index}].rationale`),
    };
  });
}

function positiveNumber(value: unknown, subject: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new PairwiseFixtureManifestError(`${subject} must be a positive number`);
  }
  return value;
}

function capture(value: unknown, subject: string): PairwiseCaptureMetadata {
  const candidate = record(value, subject);
  const allowed = new Set([
    'viewport', 'browser', 'deviceScaleFactor', 'colorScheme',
    'fullPage', 'stable', 'animations', 'caret',
  ]);
  const unknown = Object.keys(candidate).filter(key => !allowed.has(key));
  if (unknown.length) {
    throw new PairwiseFixtureManifestError(`${subject} has unknown fields: ${unknown.join(', ')}`);
  }
  const viewport = record(candidate.viewport, `${subject}.viewport`);
  if (candidate.colorScheme !== 'light' && candidate.colorScheme !== 'dark') {
    throw new PairwiseFixtureManifestError(`${subject}.colorScheme must be light or dark`);
  }
  if (typeof candidate.fullPage !== 'boolean') {
    throw new PairwiseFixtureManifestError(`${subject}.fullPage must be boolean`);
  }
  if (candidate.stable !== true || candidate.animations !== 'disabled' || candidate.caret !== 'hide') {
    throw new PairwiseFixtureManifestError(`${subject} must record stable capture with animations disabled and caret hidden`);
  }
  return {
    viewport: {
      width: positiveNumber(viewport.width, `${subject}.viewport.width`),
      height: positiveNumber(viewport.height, `${subject}.viewport.height`),
    },
    browser: string(candidate.browser, `${subject}.browser`),
    deviceScaleFactor: positiveNumber(candidate.deviceScaleFactor, `${subject}.deviceScaleFactor`),
    colorScheme: candidate.colorScheme,
    fullPage: candidate.fullPage,
    stable: true,
    animations: 'disabled',
    caret: 'hide',
  };
}

function humanLabel(reviewsToClassify: HumanPairwiseReview[]): Pick<ValidatedPairwiseFixture, 'labelStatus' | 'consensusWinner'> {
  if (reviewsToClassify.length < 2) return { labelStatus: 'insufficient', consensusWinner: null };
  const firstWinner = reviewsToClassify[0]!.winner;
  if (!reviewsToClassify.every(review => review.winner === firstWinner)) {
    return { labelStatus: 'conflict', consensusWinner: null };
  }
  if (firstWinner === 'indeterminate') return { labelStatus: 'abstained', consensusWinner: firstWinner };
  return { labelStatus: 'consensus', consensusWinner: firstWinner };
}

/** Parse structural requirements while retaining incomplete/conflicting labels for reporting. */
export function validatePairwiseFixtureManifest(value: unknown): ValidatedPairwiseFixtureManifest {
  const candidate = record(value, 'manifest');
  if (candidate.version !== PAIRWISE_FIXTURE_MANIFEST_VERSION) {
    throw new PairwiseFixtureManifestError(`manifest.version must be ${PAIRWISE_FIXTURE_MANIFEST_VERSION}`);
  }
  if (!Array.isArray(candidate.fixtures)) throw new PairwiseFixtureManifestError('manifest.fixtures must be an array');

  const fixtureIds = new Set<string>();
  const fixtures = candidate.fixtures.map((entry, index) => {
    const subject = `manifest.fixtures[${index}]`;
    const fixture = record(entry, subject);
    const id = string(fixture.id, `${subject}.id`);
    if (fixtureIds.has(id)) throw new PairwiseFixtureManifestError(`${subject}.id must be unique`);
    fixtureIds.add(id);
    const humanReviews = reviews(fixture.humanReviews, `${subject}.humanReviews`);
    return {
      id,
      prompt: string(fixture.prompt, `${subject}.prompt`),
      rubricVersion: string(fixture.rubricVersion, `${subject}.rubricVersion`),
      before: asset(fixture.before, `${subject}.before`),
      after: asset(fixture.after, `${subject}.after`),
      capture: capture(fixture.capture, `${subject}.capture`),
      humanReviews,
      ...humanLabel(humanReviews),
    };
  });
  return { version: PAIRWISE_FIXTURE_MANIFEST_VERSION, fixtures };
}

/** Assert that declared fixture hashes match files below the manifest directory. */
export function verifyPairwiseFixtureAssets(
  manifest: ValidatedPairwiseFixtureManifest,
  fixtureRoot: string,
): void {
  const root = resolve(fixtureRoot);
  for (const fixture of manifest.fixtures) {
    for (const [role, source] of [['before', fixture.before], ['after', fixture.after]] as const) {
      const assetPath = resolve(root, source.path);
      if (assetPath !== root && !assetPath.startsWith(`${root}${sep}`)) {
        throw new PairwiseFixtureManifestError(`${fixture.id}.${role} escapes fixture root`);
      }
      let bytes: Buffer;
      try {
        bytes = readFileSync(assetPath);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new PairwiseFixtureManifestError(`${fixture.id}.${role} asset is unavailable: ${detail}`);
      }
      const actual = createHash('sha256').update(bytes).digest('hex');
      if (actual !== source.sha256) {
        throw new PairwiseFixtureManifestError(`${fixture.id}.${role} SHA-256 does not match manifest`);
      }
    }
  }
}

function emptyConfusion(): PairwiseFixtureMetrics['confusion'] {
  return {
    A: { A: 0, B: 0, tie: 0 },
    B: { A: 0, B: 0, tie: 0 },
    tie: { A: 0, B: 0, tie: 0 },
  };
}

function rate(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

/**
 * Compute agreement over consensus human labels only. `indeterminate` is an
 * abstention, and review disagreement is excluded rather than force-resolved.
 */
export function computePairwiseFixtureMetrics(
  manifestValue: unknown,
  resultValues: readonly PairwiseFixtureResult[],
): PairwiseFixtureMetrics {
  const manifest = validatePairwiseFixtureManifest(manifestValue);
  const results = new Map<string, PairwiseFixtureResult>();
  const fixtureIds = new Set(manifest.fixtures.map(fixture => fixture.id));
  for (const result of resultValues) {
    if (!fixtureIds.has(result.id)) throw new PairwiseFixtureManifestError(`result id is not in manifest: ${result.id}`);
    if (results.has(result.id)) throw new PairwiseFixtureManifestError(`duplicate result id: ${result.id}`);
    winner(result.winner, `result ${result.id}.winner`);
    results.set(result.id, result);
  }

  const missingResults: string[] = [];
  const missingLabels: string[] = [];
  const excludedNonConsensus: string[] = [];
  const confusion = emptyConfusion();
  let labeled = 0;
  let decided = 0;
  let abstained = 0;
  let matches = 0;
  let observed = 0;
  let conflicts = 0;
  let incomplete = 0;

  for (const fixture of manifest.fixtures) {
    if (fixture.labelStatus === 'insufficient' || fixture.labelStatus === 'abstained') {
      missingLabels.push(fixture.id);
      continue;
    }
    if (fixture.labelStatus === 'conflict') {
      excludedNonConsensus.push(fixture.id);
      continue;
    }

    const label = fixture.consensusWinner! as DecidedPairwiseWinner;
    labeled++;
    const result = results.get(fixture.id);
    if (!result) {
      missingResults.push(fixture.id);
      continue;
    }
    observed++;
    if (result.counterBalance?.status === 'conflict') conflicts++;
    if (result.counterBalance?.status === 'incomplete') incomplete++;
    if (result.winner === 'indeterminate') {
      abstained++;
      continue;
    }

    const prediction = result.winner as DecidedPairwiseWinner;
    decided++;
    confusion[label][prediction]++;
    if (label === prediction) matches++;
  }

  return {
    totalFixtures: manifest.fixtures.length,
    labeled,
    decided,
    abstained,
    exactAgreement: { matches, compared: decided, rate: rate(matches, decided) },
    rates: {
      abstention: rate(abstained, observed),
      conflict: rate(conflicts, observed),
      incomplete: rate(incomplete, observed),
    },
    confusion,
    missingResults,
    missingLabels,
    excludedNonConsensus,
  };
}
