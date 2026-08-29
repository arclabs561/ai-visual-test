/** Tracks test scores over time for regression detection and improvement tracking. */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { warn } from './logger.mjs';

export interface ScoreTrackerOptions {
  baselineDir?: string;
  autoSave?: boolean;
}

export interface ScoreEntry {
  score: number;
  timestamp: string;
  metadata: Record<string, unknown>;
}

interface BaselineEntry {
  history: ScoreEntry[];
  current: number | null;
  baseline: number | null;
  firstRecorded: string;
  lastUpdated: string;
  baselineSetAt?: string;
}

type Baselines = Record<string, BaselineEntry>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isScoreEntry(value: unknown): value is ScoreEntry {
  return isRecord(value)
    && typeof value.score === 'number'
    && typeof value.timestamp === 'string'
    && isRecord(value.metadata);
}

function isBaselineEntry(value: unknown): value is BaselineEntry {
  if (!isRecord(value)
    || !Array.isArray(value.history)
    || !value.history.every(isScoreEntry)
    || (typeof value.current !== 'number' && value.current !== null)
    || (typeof value.baseline !== 'number' && value.baseline !== null)
    || typeof value.firstRecorded !== 'string'
    || typeof value.lastUpdated !== 'string') {
    return false;
  }

  return value.baselineSetAt === undefined || typeof value.baselineSetAt === 'string';
}

/**
 * JSON baselines are persisted across runs, so parse them at the storage boundary.
 * Invalid entries are ignored while independently valid entries remain usable.
 */
function parseBaselines(value: unknown): Baselines {
  if (!isRecord(value)) {
    return {};
  }

  const baselines: Baselines = {};
  for (const [testName, entry] of Object.entries(value)) {
    if (isBaselineEntry(entry)) {
      baselines[testName] = entry;
    }
  }
  return baselines;
}

export type ScoreTrend = 'unknown' | 'improving' | 'declining' | 'stable';

export interface ScoreComparisonWithoutBaseline {
  hasBaseline: false;
  baseline: null;
  current: number;
  delta: null;
  regression: false;
  improvement: false;
  trend: 'unknown';
}

export interface ScoreComparisonWithBaseline {
  hasBaseline: true;
  baseline: number;
  current: number;
  delta: number;
  regression: boolean;
  improvement: boolean;
  trend: ScoreTrend;
  history: ScoreEntry[];
}

/** The actual runtime shape returned by {@link ScoreTracker.compare}. */
export type ScoreComparison = ScoreComparisonWithoutBaseline | ScoreComparisonWithBaseline;

export interface DetailedScoreTrackerStats {
  totalTests: number;
  testsWithBaselines: number;
  testsWithRegressions: number;
  testsWithImprovements: number;
  averageScore: number;
  averageBaseline: number;
}

/**
 * Tracks test scores over time for regression detection and improvement tracking.
 * Baselines are stored as JSON so instances can share them across runs.
 */
export class ScoreTracker {
  readonly baselineDir: string;
  readonly autoSave: boolean;
  readonly baselineFile: string;

  constructor(options: ScoreTrackerOptions = {}) {
    const {
      baselineDir = join(process.cwd(), 'test-results', 'baselines'),
      autoSave = true,
    } = options;

    this.baselineDir = baselineDir;
    this.autoSave = autoSave;
    this.baselineFile = join(baselineDir, 'scores.json');

    if (!existsSync(baselineDir)) {
      mkdirSync(baselineDir, { recursive: true });
    }
  }

  private _loadBaselines(): Baselines {
    if (!existsSync(this.baselineFile)) {
      return {};
    }

    try {
      const content = readFileSync(this.baselineFile, 'utf8');
      if (!content || content.trim().length === 0) {
        return {};
      }
      return parseBaselines(JSON.parse(content) as unknown);
    } catch (error: unknown) {
      warn(`[ScoreTracker] Failed to load baselines: ${error instanceof SyntaxError ? 'Invalid JSON format' : 'File read error'}`);
      return {};
    }
  }

  private _saveBaselines(baselines: Baselines): void {
    if (!this.autoSave) return;

    try {
      writeFileSync(this.baselineFile, JSON.stringify(baselines, null, 2), 'utf8');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      warn(`[ScoreTracker] Failed to save baselines: ${message}`);
    }
  }

  record(testName: string, score: number, metadata: Record<string, unknown> = {}): ScoreEntry {
    const baselines = this._loadBaselines();
    const now = new Date().toISOString();

    const testData = baselines[testName] ?? {
      history: [],
      current: null,
      baseline: null,
      firstRecorded: now,
      lastUpdated: now,
    };
    baselines[testName] = testData;

    const entry: ScoreEntry = { score, timestamp: now, metadata };
    testData.history.push(entry);
    testData.current = score;
    testData.lastUpdated = now;

    if (testData.baseline === null) {
      testData.baseline = score;
      testData.baselineSetAt = now;
    }

    if (testData.history.length > 100) {
      testData.history = testData.history.slice(-100);
    }

    this._saveBaselines(baselines);
    return entry;
  }

  getBaseline(testName: string): number | null {
    return this._loadBaselines()[testName]?.baseline ?? null;
  }

  getCurrent(testName: string): number | null {
    return this._loadBaselines()[testName]?.current ?? null;
  }

  /**
   * Compare a supplied score to the stored baseline.
   *
   * This never returns null: unknown tests return the explicit no-baseline result,
   * while known tests include their last ten recorded entries.
   */
  compare(testName: string, currentScore: number): ScoreComparison {
    const testData = this._loadBaselines()[testName];

    if (!testData || testData.baseline === null) {
      return {
        hasBaseline: false,
        baseline: null,
        current: currentScore,
        delta: null,
        regression: false,
        improvement: false,
        trend: 'unknown',
      };
    }

    const baseline = testData.baseline;
    const delta = currentScore - baseline;
    const regression = delta < -1;
    const improvement = delta > 1;
    const recentScores = testData.history.slice(-10).map((entry) => entry.score);
    const firstRecentScore = recentScores[0];
    const lastRecentScore = recentScores.at(-1);
    const trend: ScoreTrend = recentScores.length >= 3 && firstRecentScore !== undefined && lastRecentScore !== undefined
      ? lastRecentScore > firstRecentScore ? 'improving'
        : lastRecentScore < firstRecentScore ? 'declining'
          : 'stable'
      : 'unknown';

    return {
      hasBaseline: true,
      baseline,
      current: currentScore,
      delta,
      regression,
      improvement,
      trend,
      history: testData.history.slice(-10),
    };
  }

  updateBaseline(testName: string, newBaseline: number | null = null): boolean {
    const baselines = this._loadBaselines();
    const testData = baselines[testName];
    if (!testData) {
      return false;
    }

    testData.baseline = newBaseline === null ? testData.current : newBaseline;
    testData.baselineSetAt = new Date().toISOString();
    this._saveBaselines(baselines);
    return true;
  }

  getAll(): Baselines {
    return this._loadBaselines();
  }

  getStats(): DetailedScoreTrackerStats {
    const baselines = this._loadBaselines();
    const stats: DetailedScoreTrackerStats = {
      totalTests: Object.keys(baselines).length,
      testsWithBaselines: 0,
      testsWithRegressions: 0,
      testsWithImprovements: 0,
      averageScore: 0,
      averageBaseline: 0,
    };

    let totalScore = 0;
    let totalBaseline = 0;
    let count = 0;

    for (const [testName, testData] of Object.entries(baselines)) {
      if (testData.baseline !== null) {
        stats.testsWithBaselines++;
        totalBaseline += testData.baseline;

        if (testData.current !== null) {
          totalScore += testData.current;
          count++;
          const comparison = this.compare(testName, testData.current);
          if (comparison.regression) stats.testsWithRegressions++;
          if (comparison.improvement) stats.testsWithImprovements++;
        }
      }
    }

    if (count > 0) {
      stats.averageScore = totalScore / count;
      stats.averageBaseline = totalBaseline / stats.testsWithBaselines;
    }

    return stats;
  }
}
