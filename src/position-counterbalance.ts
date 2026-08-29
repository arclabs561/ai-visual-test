/** Position counter-balancing for scalar and pairwise visual reviews. */

import { normalizeValidationResult } from '#validation-result-normalizer';

type Winner = 'A' | 'B' | 'tie' | 'indeterminate';
type ScorePair = { A: number; B: number };
type EvaluationContext = Record<string, unknown>;
type EvaluationResult = Record<string, unknown> & {
  enabled?: boolean;
  kind?: string;
  winner?: Winner;
  scores?: ScorePair;
  score?: number | null;
  comparisonConfidence?: number;
  differences?: unknown[];
  issues?: unknown[];
  reasoning?: unknown;
  metadata?: Record<string, unknown>;
};
type PairwiseEvaluate = (
  images: string[],
  prompt: string,
  context: EvaluationContext,
) => Promise<unknown>;
type ScalarEvaluate = (
  imagePath: string,
  prompt: string,
  context: EvaluationContext,
) => Promise<EvaluationResult>;

function reverseWinner(winner: Winner): Winner {
  if (winner === 'A') return 'B';
  if (winner === 'B') return 'A';
  return winner;
}

function isPairwiseResult(result: unknown): result is EvaluationResult & {
  enabled: boolean;
  kind: 'comparison';
  winner: Winner;
  scores: ScorePair;
} {
  if (result === null || typeof result !== 'object' || Array.isArray(result)) return false;
  const candidate = result as EvaluationResult;
  return candidate.enabled !== false
    && candidate.kind === 'comparison'
    && typeof candidate.winner === 'string'
    && ['A', 'B', 'tie', 'indeterminate'].includes(candidate.winner)
    && typeof candidate.scores?.A === 'number'
    && typeof candidate.scores?.B === 'number';
}

function average(a: unknown, b: unknown): number | unknown {
  if (typeof a === 'number' && typeof b === 'number') return (a + b) / 2;
  return typeof a === 'number' ? a : b;
}

function uniqueStrings(...values: unknown[][]): string[] {
  return [...new Set(values.flat().filter((value): value is string => typeof value === 'string' && value.length > 0))];
}

/**
 * Evaluate a comparison in both image orders and reconcile both passes back to
 * the caller's canonical before=A / after=B identity.
 */
export async function evaluatePairwiseCounterBalance(
  evaluateFn: PairwiseEvaluate,
  beforePath: string,
  afterPath: string,
  prompt: string,
  context: EvaluationContext = {},
  options: { enabled?: boolean } = {},
): Promise<unknown> {
  const original = await evaluateFn(
    [beforePath, afterPath],
    prompt,
    { ...context, comparisonOrder: 'AB' },
  );

  if (options.enabled === false || !isPairwiseResult(original)) return original;

  const reversed = await evaluateFn(
    [afterPath, beforePath],
    prompt,
    { ...context, comparisonOrder: 'BA' },
  );
  if (!isPairwiseResult(reversed)) {
    return {
      ...original,
      winner: 'indeterminate',
      assessment: 'indeterminate',
      comparisonConfidence: 0,
      counterBalance: {
        enabled: true,
        status: 'incomplete',
        canonicalWinners: [original.winner, null],
      },
    };
  }

  const reversedWinner = reverseWinner(reversed.winner);
  const scores = {
    A: average(original.scores.A, reversed.scores.B),
    B: average(original.scores.B, reversed.scores.A),
  } as ScorePair;
  const agrees = original.winner === reversedWinner;
  const winner = agrees ? original.winner : 'indeterminate';
  const originalConfidence = original.comparisonConfidence;
  const reversedConfidence = reversed.comparisonConfidence;
  const comparisonConfidence = agrees
    ? Math.min(
        typeof originalConfidence === 'number' ? originalConfidence : 1,
        typeof reversedConfidence === 'number' ? reversedConfidence : 1,
      )
    : 0;

  return normalizeValidationResult({
    ...original,
    winner,
    assessment: winner,
    scores,
    score: scores.B,
    comparisonConfidence,
    differences: uniqueStrings(original.differences || [], reversed.differences || []),
    issues: uniqueStrings(original.issues || [], reversed.issues || []),
    reasoning: `Order-counterbalanced comparison:\nA/B: ${original.reasoning || 'N/A'}\nB/A: ${reversed.reasoning || 'N/A'}\nVerdict: ${winner}`,
    counterBalance: {
      enabled: true,
      status: agrees ? 'agree' : 'conflict',
      canonicalWinners: [original.winner, reversedWinner],
      orderConfidence: [originalConfidence ?? null, reversedConfidence ?? null],
      orderScores: {
        AB: original.scores,
        BA: reversed.scores,
      },
    },
  }, 'evaluatePairwiseCounterBalance') as EvaluationResult;
}

/** Run a scalar evaluation twice when baseline or context order may bias it. */
export async function evaluateWithCounterBalance(
  evaluateFn: ScalarEvaluate,
  imagePath: string,
  prompt: string,
  context: EvaluationContext = {},
  options: {
    enabled?: boolean;
    baselinePath?: string | null;
    contextOrder?: 'original' | 'reversed';
  } = {},
): Promise<EvaluationResult> {
  const {
    enabled = true,
    baselinePath = null,
    contextOrder = 'original',
  } = options;

  if (!enabled) return await evaluateFn(imagePath, prompt, context);
  if (!baselinePath && !context.contextOrder) return await evaluateFn(imagePath, prompt, context);

  const originalContext = { ...context, contextOrder: 'original' };
  const reversedContext = { ...context, contextOrder: 'reversed' };

  let firstResult: EvaluationResult;
  let secondResult: EvaluationResult;
  if (baselinePath) {
    firstResult = await evaluateFn(imagePath, prompt, {
      ...originalContext,
      baseline: baselinePath,
      comparisonOrder: 'image-first',
    });
    secondResult = await evaluateFn(baselinePath, prompt, {
      ...reversedContext,
      baseline: imagePath,
      comparisonOrder: 'baseline-first',
    });
  } else {
    firstResult = await evaluateFn(imagePath, prompt, originalContext);
    secondResult = await evaluateFn(imagePath, prompt, reversedContext);
  }

  const avgScore = firstResult.score !== null && secondResult.score !== null
    ? ((firstResult.score as number) + (secondResult.score as number)) / 2
    : firstResult.score ?? secondResult.score;
  const uniqueIssues = [...new Set([...(firstResult.issues || []), ...(secondResult.issues || [])])];
  const combinedReasoning = `Counter-balanced evaluation:\nOriginal: ${firstResult.reasoning || 'N/A'}\nReversed: ${secondResult.reasoning || 'N/A'}\nAverage score: ${typeof avgScore === 'number' ? avgScore.toFixed(2) : 'N/A'}`;

  return normalizeValidationResult({
    ...firstResult,
    score: avgScore,
    issues: uniqueIssues,
    reasoning: combinedReasoning,
    counterBalanced: true,
    originalScore: firstResult.score,
    reversedScore: secondResult.score,
    scoreDifference: firstResult.score !== null && secondResult.score !== null
      ? Math.abs((firstResult.score as number) - (secondResult.score as number))
      : null,
    metadata: {
      ...firstResult.metadata,
      counterBalancing: {
        enabled: true,
        originalResult: firstResult,
        reversedResult: secondResult,
        positionBiasDetected: firstResult.score !== null && secondResult.score !== null
          ? Math.abs((firstResult.score as number) - (secondResult.score as number)) > 1.0
          : false,
      },
    },
  }, 'evaluateWithCounterBalance') as EvaluationResult;
}

/** Check whether scalar evaluation context requires order counter-balancing. */
export function shouldUseCounterBalance(context: EvaluationContext): boolean {
  return Boolean(
    context.baseline
    || context.contextOrder
    || (Array.isArray(context.images) && context.images.length > 1),
  );
}
