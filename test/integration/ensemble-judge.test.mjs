import { test } from 'node:test';
import assert from 'node:assert';
import { EnsembleJudge, createEnsembleJudge } from '../../src/ensemble-judge.mjs';
import { VLLMJudge } from '../../src/judge.mjs';

test('EnsembleJudge aggregates results with weighted average', async () => {
  // Create mock judges
  const judge1 = new VLLMJudge({ enabled: false });
  const judge2 = new VLLMJudge({ enabled: false });
  
  // Mock judgeScreenshot to return test results
  judge1.judgeScreenshot = async () => ({
    score: 8,
    assessment: 'pass',
    issues: ['minor issue'],
    reasoning: 'Judge 1 reasoning',
    provider: 'gemini'
  });
  
  judge2.judgeScreenshot = async () => ({
    score: 7,
    assessment: 'pass',
    issues: ['another issue'],
    reasoning: 'Judge 2 reasoning',
    provider: 'openai'
  });
  
  const ensemble = new EnsembleJudge({
    judges: [judge1, judge2],
    votingMethod: 'weighted_average'
  });
  
  const result = await ensemble.evaluate('test.png', 'Evaluate this');
  
  assert.ok(result.score !== null);
  assert.ok(result.score >= 7 && result.score <= 8);
  assert.ok(result.individualJudgments.length === 2);
  assert.ok(result.agreement);
});

test('EnsembleJudge calculates agreement correctly', async () => {
  const judge1 = new VLLMJudge({ enabled: false });
  const judge2 = new VLLMJudge({ enabled: false });
  
  judge1.judgeScreenshot = async () => ({ score: 8, assessment: 'pass', provider: 'gemini' });
  judge2.judgeScreenshot = async () => ({ score: 8, assessment: 'pass', provider: 'openai' });
  
  const ensemble = new EnsembleJudge({ judges: [judge1, judge2] });
  const result = await ensemble.evaluate('test.png', 'Evaluate');
  
  assert.ok(result.agreement.score > 0.8); // High agreement
});

test('EnsembleJudge detects disagreement', async () => {
  const judge1 = new VLLMJudge({ enabled: false });
  const judge2 = new VLLMJudge({ enabled: false });
  
  judge1.judgeScreenshot = async () => ({ score: 9, assessment: 'pass', provider: 'gemini' });
  judge2.judgeScreenshot = async () => ({ score: 4, assessment: 'fail', provider: 'openai' });
  
  const ensemble = new EnsembleJudge({ judges: [judge1, judge2] });
  const result = await ensemble.evaluate('test.png', 'Evaluate');
  
  assert.ok(result.disagreement.hasDisagreement);
  assert.ok(result.disagreement.scoreRange > 2);
});

test('EnsembleJudge reports failed providers as availability, not disagreement', async () => {
  const judge1 = new VLLMJudge({ enabled: false });
  const judge2 = new VLLMJudge({ enabled: false });
  judge1.judgeScreenshot = async () => ({ score: 8, assessment: 'pass', provider: 'gemini' });
  judge2.judgeScreenshot = async () => { throw new Error('rate limit'); };

  const ensemble = new EnsembleJudge({ judges: [judge1, judge2] });
  const result = await ensemble.evaluate('test.png', 'Evaluate');

  assert.strictEqual(result.score, 8);
  assert.strictEqual(result.agreement.type, 'single_judge');
  assert.strictEqual(result.disagreement.type, 'insufficient_scores');
  assert.deepStrictEqual(result.availability, {
    totalJudges: 2,
    availableJudges: 1,
    unavailableJudges: 1,
    failures: [{ judgeIndex: 1, provider: judge2.provider, reason: 'rate limit' }]
  });
});

test('EnsembleJudge normalizes non-Error rejection reasons without masking availability', async () => {
  const judges = Array.from({ length: 4 }, () => new VLLMJudge({ enabled: false }));
  judges[0].judgeScreenshot = async () => ({ score: 8, assessment: 'pass', provider: 'gemini' });
  judges[1].judgeScreenshot = async () => Promise.reject(null);
  judges[2].judgeScreenshot = async () => Promise.reject(undefined);
  judges[3].judgeScreenshot = async () => Promise.reject({ message: 'object rejection' });

  const result = await new EnsembleJudge({ judges }).evaluate('test.png', 'Evaluate');

  assert.deepStrictEqual(result.availability.failures.map(failure => failure.reason), [
    'unknown_rejection',
    'unknown_rejection',
    'object rejection'
  ]);
});

test('EnsembleJudge excludes unavailable scores from position-bias diagnostics', async () => {
  const judges = Array.from({ length: 3 }, () => new VLLMJudge({ enabled: false }));
  judges[0].judgeScreenshot = async () => ({ score: 8, assessment: 'pass', provider: 'gemini' });
  judges[1].judgeScreenshot = async () => ({ score: 100, error: 'malformed provider response', provider: 'openai' });
  judges[2].judgeScreenshot = async () => ({ score: 8, assessment: 'pass', provider: 'claude' });

  const result = await new EnsembleJudge({ judges }).evaluate('test.png', 'Evaluate');

  assert.deepStrictEqual(result.biasDetection.position.evidence.allScores, [8, 8]);
});

test('createEnsembleJudge creates judge with multiple providers', () => {
  const ensemble = createEnsembleJudge(['gemini', 'openai']);
  assert.ok(ensemble.judges.length === 2);
  assert.strictEqual(ensemble.judges[0].provider, 'gemini');
  assert.strictEqual(ensemble.judges[1].provider, 'openai');
});



