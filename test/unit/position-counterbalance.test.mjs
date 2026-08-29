import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  evaluatePairwiseCounterBalance,
  evaluateWithCounterBalance,
  shouldUseCounterBalance,
} from '../../src/position-counterbalance.js';

describe('Position Counter-Balance', () => {
  it('should return single result when disabled', async () => {
    let callCount = 0;
    const mockEvaluate = async () => {
      callCount++;
      return { score: 8, reasoning: 'Test' };
    };
    
    const result = await evaluateWithCounterBalance(
      mockEvaluate,
      'test.png',
      'Test prompt',
      {},
      { enabled: false }
    );
    
    assert.strictEqual(callCount, 1);
    assert.strictEqual(result.score, 8);
    assert.strictEqual(result.counterBalanced, undefined);
  });
  
  it('should run twice and average when baseline provided', async () => {
    let callCount = 0;
    const mockEvaluate = async (imagePath, prompt, context) => {
      callCount++;
      // Return different scores to test averaging
      return {
        score: callCount === 1 ? 8 : 6,
        reasoning: `Call ${callCount}`,
        issues: ['issue1']
      };
    };
    
    const result = await evaluateWithCounterBalance(
      mockEvaluate,
      'test.png',
      'Test',
      {},
      { enabled: true, baselinePath: 'baseline.png' }
    );
    
    assert.strictEqual(callCount, 2);
    assert.strictEqual(result.score, 7); // (8 + 6) / 2
    assert.strictEqual(result.counterBalanced, true);
    assert.strictEqual(result.originalScore, 8);
    assert.strictEqual(result.reversedScore, 6);
    assert.ok(result.metadata.counterBalancing);
  });
  
  it('should detect position bias when scores differ significantly', async () => {
    const mockEvaluate = async (imagePath, prompt, context) => {
      // Simulate position bias: first call scores higher
      return {
        score: context.comparisonOrder === 'image-first' ? 9 : 5,
        reasoning: 'Test'
      };
    };
    
    const result = await evaluateWithCounterBalance(
      mockEvaluate,
      'test.png',
      'Test',
      {},
      { enabled: true, baselinePath: 'baseline.png' }
    );
    
    assert.ok(result.metadata.counterBalancing.positionBiasDetected);
    assert.strictEqual(result.scoreDifference, 4);
  });
  
  it('should determine if counter-balancing is needed', () => {
    assert.strictEqual(shouldUseCounterBalance({}), false);
    assert.strictEqual(shouldUseCounterBalance({ baseline: 'test.png' }), true);
    assert.strictEqual(shouldUseCounterBalance({ contextOrder: 'original' }), true);
    assert.strictEqual(shouldUseCounterBalance({ images: ['a.png', 'b.png'] }), true);
  });
});

describe('Pairwise Counter-Balance', () => {
  it('maps the reversed order back to canonical A/B identities and averages candidate scores', async () => {
    const calls = [];
    const results = [
      {
        enabled: true, kind: 'comparison', winner: 'B', score: 8,
        scores: { A: 4, B: 8 }, comparisonConfidence: 0.9,
        differences: ['B has clearer hierarchy'], issues: [], reasoning: 'B is stronger',
      },
      {
        enabled: true, kind: 'comparison', winner: 'A', score: 5,
        scores: { A: 9, B: 5 }, comparisonConfidence: 0.8,
        differences: ['A has clearer hierarchy'], issues: [], reasoning: 'A is stronger',
      },
    ];
    const evaluate = async (images, prompt, context) => {
      calls.push({ images, prompt, context });
      return results[calls.length - 1];
    };

    const result = await evaluatePairwiseCounterBalance(
      evaluate, 'before.png', 'after.png', 'Compare', { provider: 'openai' },
    );

    assert.deepStrictEqual(calls.map(call => call.images), [
      ['before.png', 'after.png'],
      ['after.png', 'before.png'],
    ]);
    assert.deepStrictEqual(result.scores, { A: 4.5, B: 8.5 });
    assert.strictEqual(result.score, 8.5);
    assert.strictEqual(result.winner, 'B');
    assert.strictEqual(result.comparisonConfidence, 0.8);
    assert.strictEqual(result.counterBalance.status, 'agree');
    assert.deepStrictEqual(result.counterBalance.canonicalWinners, ['B', 'B']);
  });

  it('returns indeterminate with zero confidence when order changes the canonical winner', async () => {
    const results = [
      { enabled: true, kind: 'comparison', winner: 'B', scores: { A: 4, B: 8 }, comparisonConfidence: 0.9, differences: [], issues: [] },
      { enabled: true, kind: 'comparison', winner: 'B', scores: { A: 6, B: 7 }, comparisonConfidence: 0.9, differences: [], issues: [] },
    ];
    let call = 0;

    const result = await evaluatePairwiseCounterBalance(
      async () => results[call++], 'before.png', 'after.png', 'Compare', {},
    );

    assert.strictEqual(result.winner, 'indeterminate');
    assert.strictEqual(result.assessment, 'indeterminate');
    assert.strictEqual(result.comparisonConfidence, 0);
    assert.strictEqual(result.counterBalance.status, 'conflict');
    assert.deepStrictEqual(result.counterBalance.canonicalWinners, ['B', 'A']);
  });

  it('preserves a shared tie verdict', async () => {
    const tied = { enabled: true, kind: 'comparison', winner: 'tie', scores: { A: 7, B: 7 }, comparisonConfidence: 0.7, differences: [], issues: [] };
    const result = await evaluatePairwiseCounterBalance(
      async () => tied, 'before.png', 'after.png', 'Compare', {},
    );
    assert.strictEqual(result.winner, 'tie');
    assert.strictEqual(result.counterBalance.status, 'agree');
  });

  it('uses one request when disabled or when the first result is unavailable', async () => {
    let disabledCalls = 0;
    const single = { enabled: true, kind: 'comparison', winner: 'B', scores: { A: 5, B: 8 }, score: 8 };
    const disabled = await evaluatePairwiseCounterBalance(
      async () => { disabledCalls++; return single; },
      'before.png', 'after.png', 'Compare', {}, { enabled: false },
    );
    assert.strictEqual(disabledCalls, 1);
    assert.strictEqual(disabled, single);

    let unavailableCalls = 0;
    const unavailable = await evaluatePairwiseCounterBalance(
      async () => { unavailableCalls++; return { enabled: false, score: null, issues: [] }; },
      'before.png', 'after.png', 'Compare', {},
    );
    assert.strictEqual(unavailableCalls, 1);
    assert.strictEqual(unavailable.enabled, false);

    let nullCalls = 0;
    const nullResult = await evaluatePairwiseCounterBalance(
      async () => { nullCalls++; return null; },
      'before.png', 'after.png', 'Compare', {},
    );
    assert.strictEqual(nullCalls, 1);
    assert.strictEqual(nullResult, null);
  });
});
