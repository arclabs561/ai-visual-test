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

const playwrightExpect: playwright.PlaywrightExpect = extendableExpect;
playwright.createMatchers(playwrightExpect);
const playwrightMatchers: playwright.PlaywrightMatchers = {
  async toHaveVisualScore() { return { pass: true, message: () => 'ok' }; },
  async toBeAccessibleHybrid() { return { pass: true, message: () => 'ok' }; },
};
const playwrightMatcherResult: Promise<playwright.MatcherResult> = playwrightMatchers.toHaveVisualScore(
  'checkout.png',
  7,
);
void playwrightMatcherResult;
const screenshotOnlyPlaywrightPage = {
  async screenshot(_options: Record<string, unknown>) { return new Uint8Array(); },
};
playwright.captureStableScreenshot(screenshotOnlyPlaywrightPage, { path: 'capture.png' });
// @ts-expect-error default Playwright matcher capture needs the full page contract.
playwrightMatchers.toHaveVisualScore(screenshotOnlyPlaywrightPage, 7);
const fullPlaywrightPage: playwright.PlaywrightPage = {
  ...screenshotOnlyPlaywrightPage,
  async content() { return '<main>checkout</main>'; },
  url() { return 'https://example.test/checkout'; },
  viewportSize() { return { width: 1280, height: 720 }; },
  async evaluate(callback: (arg?: unknown) => unknown, arg?: unknown) { return await callback(arg); },
};
playwrightMatchers.toHaveVisualScore(fullPlaywrightPage, 7);
playwrightMatchers.toBeAccessibleHybrid(fullPlaywrightPage);

// Both public aliases expose the same generated, framework-neutral contract.
vitest.createMatchers(extendableExpect);
jest.createMatchers(extendableExpect);
export const matcherFactories: [typeof vitest.createMatchers, typeof jest.createMatchers] = [
  vitest.createMatchers,
  jest.createMatchers,
];

const screenshotOnlyPage: root.ScreenshotPage = {
  async screenshot(_options: Record<string, unknown>) {
    return new Uint8Array();
  },
};
const temporalCapturePage: temporal.Page = screenshotOnlyPage;
const multiModalCapturePage: multiModal.Page = screenshotOnlyPage;
export const temporalObjectCapture: Promise<temporal.TemporalScreenshot[]> = temporal.captureTemporalScreenshots(
  temporalCapturePage,
  { fps: 2, duration: 1_000 },
);
export const temporalPositionalCapture: Promise<temporal.TemporalScreenshot[]> = temporal.captureTemporalScreenshots(
  temporalCapturePage,
  2,
  1_000,
  { outputDir: 'test-results' },
);
export const multiModalObjectCapture: Promise<multiModal.TemporalScreenshot[]> = multiModal.captureTemporalScreenshots(
  multiModalCapturePage,
  { fps: 2, duration: 1_000 },
);
const fullPage: root.PageLike = {
  ...screenshotOnlyPage,
  async content() { return '<main>checkout</main>'; },
  url() { return 'https://example.test/checkout'; },
  viewportSize() { return { width: 1280, height: 720 }; },
  async evaluate(callback: (arg?: unknown) => unknown, arg?: unknown) {
    return await callback(arg);
  },
};
export const screenshotOnlyValidationResult: Promise<root.ValidationResult> = root.validatePage(
  screenshotOnlyPage,
  'Check the checkout layout',
  { captureCode: false, stability: { enabled: false } },
);
export const defaultPageValidationResult: Promise<root.ValidationResult> = root.validatePage(
  fullPage,
  'Check the checkout layout',
);
// @ts-expect-error default code capture needs content and evaluate.
root.validatePage(screenshotOnlyPage, 'Check the checkout layout');

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

export async function consumeTypedEnsemble(): Promise<void> {
  const judges: ensemble.JudgeLike[] = [
    {
      provider: 'first',
      async judgeScreenshot() {
        return { score: 8, assessment: 'pass', issues: [], reasoning: 'stable' };
      },
    },
    {
      provider: 'second',
      async judgeScreenshot() {
        return { score: 4, assessment: 'fail', issues: ['contrast'], reasoning: 'visible regression' };
      },
    },
  ];
  const review = new ensemble.EnsembleJudge({ judges, votingMethod: 'majority' });
  const result: ensemble.EnsembleResult = await review.evaluate('candidate.png', 'Review checkout');
  const availability: ensemble.Availability = result.availability;
  const disagreement: ensemble.Disagreement = result.disagreement;
  const agreement: ensemble.Agreement = result.agreement;
  void availability.availableJudges;
  void disagreement.hasDisagreement;
  void agreement.score;
}

export function consumeEnsembleHelperContracts(): void {
  const result: root.ValidationResult = {
    enabled: true,
    score: 8,
    issues: [],
    recommendations: [],
    reasoning: 'stable layout',
  };
  const bias = ensemble.detectBias('The response is very very very verbose.', { checkVerbosity: true });
  const positionBias: ensemble.PositionBiasResult = ensemble.detectPositionBias([
    { score: 8 },
    { score: 6 },
  ], { calculateMetrics: true });
  const mitigated: root.ValidationResult = ensemble.mitigateBias(result, bias, { minAdjustment: -1 });
  const applied: root.ValidationResult = ensemble.applyBiasMitigation(result, 'stable layout', { adjustScores: false });
  const positioned: root.ValidationResult[] = ensemble.mitigatePositionBias([result], { adjustScores: true });
  const enhanced: Promise<root.ValidationResult> = ensemble.validateWithResearchEnhancements(
    'candidate.png',
    'Review the checkout layout',
    { enableBiasDetection: true },
  );
  const analysis: Promise<ensemble.PositionAnalysisResult> = ensemble.validateMultipleWithPositionAnalysis(
    ['first.png', 'second.png'],
    'Compare the layout',
    { calculateMetrics: true, qualityGap: 0.5 },
  );
  const lengthAligned: Promise<root.ValidationResult> = ensemble.validateWithLengthAlignment(
    'candidate.png',
    'Review the checkout layout',
    { referenceLength: 200 },
  );
  const rubric: Promise<root.ValidationResult> = ensemble.validateWithExplicitRubric(
    'candidate.png',
    'Review the checkout layout',
    { rubric: ['contrast', 'spacing'] },
  );
  const fullyEnhanced: Promise<root.ValidationResult> = ensemble.validateWithAllResearchEnhancements(
    'candidate.png',
    'Review the checkout layout',
    { useCounterBalance: true },
  );
  void positionBias;
  void mitigated;
  void applied;
  void positioned;
  void enhanced;
  void analysis;
  void lengthAligned;
  void rubric;
  void fullyEnhanced;
}
