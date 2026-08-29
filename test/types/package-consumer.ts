import * as root from '@arclabs561/ai-visual-test';
import * as validators from '@arclabs561/ai-visual-test/validators';
import * as temporal from '@arclabs561/ai-visual-test/temporal';
import * as multiModal from '@arclabs561/ai-visual-test/multi-modal';
import * as ensemble from '@arclabs561/ai-visual-test/ensemble';
import * as video from '@arclabs561/ai-visual-test/video';
import * as extractors from '@arclabs561/ai-visual-test/extractors';
import * as persona from '@arclabs561/ai-visual-test/persona';
import * as utils from '@arclabs561/ai-visual-test/utils';
import * as game from '@arclabs561/ai-visual-test/game';
import * as errors from '@arclabs561/ai-visual-test/errors';
import * as playwright from '@arclabs561/ai-visual-test/playwright';
import * as vitest from '@arclabs561/ai-visual-test/vitest';
import * as jest from '@arclabs561/ai-visual-test/jest';
import * as perception from '@arclabs561/ai-visual-test/perception';

export const publicModules = {
  root, validators, temporal, multiModal, ensemble, video, extractors,
  persona, utils, game, errors, playwright, vitest, jest, perception,
};

// Scalar counter-balance helpers remain part of the supported ensemble route.
export const ensembleScalarHelpers = [
  ensemble.evaluateWithCounterBalance,
  ensemble.shouldUseCounterBalance,
];

const extendableExpect = {
  extend(matchers: Record<string, unknown>) {
    void matchers;
  },
};

// Both public aliases expose the same generated, framework-neutral contract.
vitest.createMatchers(extendableExpect);
jest.createMatchers(extendableExpect);
export const matcherFactories: [typeof vitest.createMatchers, typeof jest.createMatchers] = [
  vitest.createMatchers,
  jest.createMatchers,
];

export async function consumeEnsembleCounterBalance(): Promise<void> {
  const result = await ensemble.evaluateWithCounterBalance(
    async () => ({
      enabled: true,
      score: 8,
      issues: [],
      recommendations: [],
      reasoning: 'stable layout',
    }),
    'candidate.png',
    'Check the layout',
    { baseline: 'baseline.png' },
    { baselinePath: 'baseline.png' },
  );

  const score: number | null = result.score;
  const status = result.counterBalance?.status;
  const counterBalanced: unknown = result.counterBalanced;
  const shouldCounterBalance: boolean = ensemble.shouldUseCounterBalance({ baseline: 'baseline.png' });
  void score;
  void status;
  void counterBalanced;
  void shouldCounterBalance;
}
