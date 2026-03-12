import { test } from 'node:test';
import assert from 'node:assert';
import { EnsembleJudge } from '../../src/ensemble-judge.mjs';

// Helper: create an EnsembleJudge with N dummy judges (no real providers)
function createJudge(options = {}) {
  const judgeCount = options.judgeCount || 3;
  // Provide lightweight stand-in objects so the constructor doesn't instantiate VLLMJudge
  const judges = Array.from({ length: judgeCount }, () => ({}));
  return new EnsembleJudge({ judges, ...options });
}

function mockResult(overrides = {}) {
  return {
    score: 8,
    assessment: 'pass',
    issues: ['minor contrast issue'],
    reasoning: 'looks good',
    provider: 'gemini',
    judgeIndex: 0,
    ...overrides
  };
}

// --- weightedAverage ---

test('weightedAverage with equal weights returns arithmetic mean', () => {
  const ej = createJudge({ judgeCount: 3 });
  const results = [
    mockResult({ score: 6, judgeIndex: 0 }),
    mockResult({ score: 8, judgeIndex: 1 }),
    mockResult({ score: 10, judgeIndex: 2 })
  ];
  const out = ej.weightedAverage(results);
  assert.strictEqual(out.score, 8); // (6+8+10)/3 = 8
  assert.strictEqual(out.assessment, 'pass');
});

test('weightedAverage with custom weights skews toward heavier judge', () => {
  // weights [3, 1, 1] -> normalized [0.6, 0.2, 0.2]
  const ej = createJudge({ judgeCount: 3, weights: [3, 1, 1] });
  const results = [
    mockResult({ score: 10, judgeIndex: 0 }),
    mockResult({ score: 4, judgeIndex: 1 }),
    mockResult({ score: 4, judgeIndex: 2 })
  ];
  const out = ej.weightedAverage(results);
  // weighted: (10*0.6 + 4*0.2 + 4*0.2) / (0.6+0.2+0.2) = 7.6
  assert.strictEqual(out.score, 7.6);
  assert.strictEqual(out.assessment, 'pass');
});

test('weightedAverage unions issues from all results', () => {
  const ej = createJudge({ judgeCount: 2 });
  const results = [
    mockResult({ score: 7, judgeIndex: 0, issues: ['contrast'] }),
    mockResult({ score: 8, judgeIndex: 1, issues: ['alignment', 'contrast'] })
  ];
  const out = ej.weightedAverage(results);
  assert.deepStrictEqual(out.issues.sort(), ['alignment', 'contrast']);
});

test('weightedAverage assessment thresholds: fail below 5', () => {
  const ej = createJudge({ judgeCount: 2 });
  const results = [
    mockResult({ score: 3, judgeIndex: 0 }),
    mockResult({ score: 4, judgeIndex: 1 })
  ];
  const out = ej.weightedAverage(results);
  assert.strictEqual(out.assessment, 'fail');
});

test('weightedAverage assessment thresholds: needs-improvement between 5 and 7', () => {
  const ej = createJudge({ judgeCount: 2 });
  const results = [
    mockResult({ score: 5, judgeIndex: 0 }),
    mockResult({ score: 6, judgeIndex: 1 })
  ];
  const out = ej.weightedAverage(results);
  assert.strictEqual(out.assessment, 'needs-improvement');
});

// --- majorityVote ---

test('majorityVote returns pass when majority passes', () => {
  const ej = createJudge({ judgeCount: 3, votingMethod: 'majority' });
  const results = [
    mockResult({ score: 8, assessment: 'pass', judgeIndex: 0 }),
    mockResult({ score: 9, assessment: 'pass', judgeIndex: 1 }),
    mockResult({ score: 3, assessment: 'fail', judgeIndex: 2 })
  ];
  const out = ej.majorityVote(results);
  assert.strictEqual(out.assessment, 'pass');
  assert.strictEqual(out.confidence, 2 / 3);
});

test('majorityVote returns fail when majority fails', () => {
  const ej = createJudge({ judgeCount: 3, votingMethod: 'majority' });
  const results = [
    mockResult({ score: 3, assessment: 'fail', judgeIndex: 0 }),
    mockResult({ score: 2, assessment: 'fail', judgeIndex: 1 }),
    mockResult({ score: 9, assessment: 'pass', judgeIndex: 2 })
  ];
  const out = ej.majorityVote(results);
  assert.strictEqual(out.assessment, 'fail');
});

// --- consensusVote ---

test('consensusVote with full consensus returns weighted average result', () => {
  const ej = createJudge({ judgeCount: 3, votingMethod: 'consensus', minAgreement: 0.7 });
  const results = [
    mockResult({ score: 8, assessment: 'pass', judgeIndex: 0, provider: 'gemini' }),
    mockResult({ score: 8, assessment: 'pass', judgeIndex: 1, provider: 'openai' }),
    mockResult({ score: 8, assessment: 'pass', judgeIndex: 2, provider: 'claude' })
  ];
  const out = ej.consensusVote(results);
  // Identical scores -> high agreement -> consensus reached -> normal weighted average
  assert.strictEqual(out.score, 8);
  assert.strictEqual(out.assessment, 'pass');
  assert.ok(!out.reasoning.includes('No consensus'));
});

test('consensusVote without consensus returns no-consensus assessment', () => {
  const ej = createJudge({ judgeCount: 3, votingMethod: 'consensus', minAgreement: 0.9 });
  const results = [
    mockResult({ score: 9, assessment: 'pass', judgeIndex: 0, provider: 'gemini' }),
    mockResult({ score: 3, assessment: 'fail', judgeIndex: 1, provider: 'openai' }),
    mockResult({ score: 5, assessment: 'needs-improvement', judgeIndex: 2, provider: 'claude' })
  ];
  const out = ej.consensusVote(results);
  assert.strictEqual(out.assessment, 'no-consensus');
  assert.ok(out.reasoning.includes('No consensus'));
});

// --- calculateAgreement ---

test('calculateAgreement with identical scores returns high agreement', () => {
  const ej = createJudge({ judgeCount: 3 });
  const results = [
    mockResult({ score: 7, assessment: 'pass', judgeIndex: 0 }),
    mockResult({ score: 7, assessment: 'pass', judgeIndex: 1 }),
    mockResult({ score: 7, assessment: 'pass', judgeIndex: 2 })
  ];
  const out = ej.calculateAgreement(results);
  assert.strictEqual(out.score, 1.0); // zero variance + same assessment
  assert.strictEqual(out.stdDev, 0);
});

test('calculateAgreement with divergent scores returns lower agreement', () => {
  const ej = createJudge({ judgeCount: 3 });
  const results = [
    mockResult({ score: 1, assessment: 'fail', judgeIndex: 0 }),
    mockResult({ score: 10, assessment: 'pass', judgeIndex: 1 }),
    mockResult({ score: 5, assessment: 'needs-improvement', judgeIndex: 2 })
  ];
  const out = ej.calculateAgreement(results);
  assert.ok(out.score < 0.7, `Expected low agreement, got ${out.score}`);
  assert.ok(out.stdDev > 2);
  assert.strictEqual(out.assessmentAgreement, 0.5); // different assessments
});

test('calculateAgreement returns single_judge for one result', () => {
  const ej = createJudge({ judgeCount: 1 });
  const results = [mockResult({ score: 7, judgeIndex: 0 })];
  const out = ej.calculateAgreement(results);
  assert.strictEqual(out.score, 1.0);
  assert.strictEqual(out.type, 'single_judge');
});

// --- analyzeDisagreement ---

test('analyzeDisagreement detects disagreement when scores diverge', () => {
  const ej = createJudge({ judgeCount: 3 });
  const results = [
    mockResult({ score: 9, assessment: 'pass', judgeIndex: 0 }),
    mockResult({ score: 3, assessment: 'fail', judgeIndex: 1 }),
    mockResult({ score: 6, assessment: 'needs-improvement', judgeIndex: 2 })
  ];
  const out = ej.analyzeDisagreement(results);
  assert.strictEqual(out.hasDisagreement, true);
  assert.strictEqual(out.scoreRange, 6);
  assert.strictEqual(out.assessmentDisagreement, true);
  assert.strictEqual(out.maxScore, 9);
  assert.strictEqual(out.minScore, 3);
});

test('analyzeDisagreement reports no disagreement for aligned results', () => {
  const ej = createJudge({ judgeCount: 2 });
  const results = [
    mockResult({ score: 8, assessment: 'pass', judgeIndex: 0 }),
    mockResult({ score: 9, assessment: 'pass', judgeIndex: 1 })
  ];
  const out = ej.analyzeDisagreement(results);
  assert.strictEqual(out.hasDisagreement, false);
  assert.strictEqual(out.scoreRange, 1);
});

// --- calculateConfidence ---

test('calculateConfidence is high for tightly clustered scores', () => {
  const ej = createJudge({ judgeCount: 3 });
  const results = [
    mockResult({ score: 8, assessment: 'pass', judgeIndex: 0 }),
    mockResult({ score: 8, assessment: 'pass', judgeIndex: 1 }),
    mockResult({ score: 8, assessment: 'pass', judgeIndex: 2 })
  ];
  const conf = ej.calculateConfidence(results, 8);
  assert.ok(conf > 0.8, `Expected high confidence, got ${conf}`);
});

test('calculateConfidence is lower for widely spread scores', () => {
  const ej = createJudge({ judgeCount: 3 });
  const results = [
    mockResult({ score: 2, assessment: 'fail', judgeIndex: 0 }),
    mockResult({ score: 9, assessment: 'pass', judgeIndex: 1 }),
    mockResult({ score: 5, assessment: 'needs-improvement', judgeIndex: 2 })
  ];
  const confWide = ej.calculateConfidence(results, 5.3);
  const confTight = ej.calculateConfidence([
    mockResult({ score: 7, assessment: 'pass', judgeIndex: 0 }),
    mockResult({ score: 7, assessment: 'pass', judgeIndex: 1 }),
    mockResult({ score: 7, assessment: 'pass', judgeIndex: 2 })
  ], 7);
  assert.ok(confWide < confTight, `Wide spread (${confWide}) should be less confident than tight cluster (${confTight})`);
});

// --- calculateOptimalWeights ---

test('calculateOptimalWeights assigns higher weight to more accurate judge', () => {
  const ej = createJudge({ judgeCount: 3 });
  const weights = ej.calculateOptimalWeights([0.9, 0.6, 0.5]);
  // The most accurate judge (0.9) should get the highest weight
  assert.ok(weights[0] > weights[1], `w0=${weights[0]} should exceed w1=${weights[1]}`);
  assert.ok(weights[1] > weights[2], `w1=${weights[1]} should exceed w2=${weights[2]}`);
});

test('calculateOptimalWeights returns [1.0] for single judge', () => {
  const ej = createJudge({ judgeCount: 1 });
  const weights = ej.calculateOptimalWeights([0.8]);
  assert.deepStrictEqual(weights, [1.0]);
});

// --- aggregateResults uses configured strategy ---

test('aggregateResults dispatches to configured voting method', () => {
  const ej = createJudge({ judgeCount: 3, votingMethod: 'majority' });
  const results = [
    mockResult({ score: 8, assessment: 'pass', judgeIndex: 0 }),
    mockResult({ score: 9, assessment: 'pass', judgeIndex: 1 }),
    mockResult({ score: 3, assessment: 'fail', judgeIndex: 2 })
  ];
  const out = ej.aggregateResults(results);
  // majority vote -> pass (2/3)
  assert.strictEqual(out.assessment, 'pass');
  assert.ok(out.reasoning.includes('Majority vote'));
});

test('aggregateResults returns error when all results have errors', () => {
  const ej = createJudge({ judgeCount: 2 });
  const results = [
    { score: null, error: 'timeout', judgeIndex: 0 },
    { score: null, error: 'rate limit', judgeIndex: 1 }
  ];
  const out = ej.aggregateResults(results);
  assert.strictEqual(out.assessment, 'error');
  assert.strictEqual(out.confidence, 0);
});
