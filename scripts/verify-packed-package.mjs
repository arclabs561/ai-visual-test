#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const scratch = mkdtempSync(join(tmpdir(), 'ai-visual-pack-'));
const consumer = join(scratch, 'consumer');

try {
  const tarballName = execFileSync('npm', ['pack', '--silent', '--pack-destination', scratch], {
    cwd: DIST,
    encoding: 'utf8',
  }).trim().split('\n').at(-1);
  if (!tarballName) throw new Error('npm pack did not return a tarball name');

  mkdirSync(consumer);
  writeFileSync(join(consumer, 'package.json'), '{"private":true,"type":"module"}\n');
  execFileSync('npm', [
    'install',
    join(scratch, tarballName),
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
  ], { cwd: consumer, stdio: 'inherit' });

  const installedRoot = join(consumer, 'node_modules', '@arclabs561', 'ai-visual-test');
  const installedManifest = JSON.parse(readFileSync(join(installedRoot, 'package.json'), 'utf8'));
  const specifiers = Object.keys(installedManifest.exports)
    .filter(subpath => subpath !== './package.json')
    .map(subpath => subpath === '.'
      ? installedManifest.name
      : `${installedManifest.name}/${subpath.slice(2)}`);
  const importProgram = `for (const specifier of ${JSON.stringify(specifiers)}) { const loaded = await import(specifier); if (Object.keys(loaded).length === 0) throw new Error(specifier + ' has no exports'); }`;
  execFileSync(process.execPath, ['--input-type=module', '--eval', importProgram], {
    cwd: consumer,
    stdio: 'inherit',
  });
  const matcherProgram = `for (const route of ['vitest', 'jest']) { const integration = await import(${JSON.stringify(installedManifest.name)} + '/' + route); const registered = {}; integration.createMatchers({ extend(matchers) { Object.assign(registered, matchers); } }); for (const name of ['toPassVisualCheck', 'toHaveVisualScore', 'toMatchVisually']) { if (typeof registered[name] !== 'function') throw new Error('Missing ' + route + ' matcher: ' + name); } const outcome = await registered.toPassVisualCheck(123, 'type check'); if (outcome.pass !== false || !outcome.message().includes('string')) throw new Error('Unexpected ' + route + ' matcher outcome'); }`;
  execFileSync(process.execPath, ['--input-type=module', '--eval', matcherProgram], {
    cwd: consumer,
    stdio: 'inherit',
  });
  const playwrightProgram = `const packageName = ${JSON.stringify(installedManifest.name)}; const root = await import(packageName); const integration = await import(packageName + '/playwright'); if (root.createMatchers !== integration.createMatchers) throw new Error('Root createMatchers is not the Playwright adapter export'); const registered = {}; integration.createMatchers({ extend(matchers) { Object.assign(registered, matchers); } }); for (const name of ['toHaveVisualScore', 'toBeAccessibleHybrid']) { if (typeof registered[name] !== 'function') throw new Error('Missing packed Playwright matcher: ' + name); }`;
  execFileSync(process.execPath, ['--input-type=module', '--eval', playwrightProgram], {
    cwd: consumer,
    stdio: 'inherit',
  });
  const ensembleProgram = `const ensemble = await import(${JSON.stringify(`${installedManifest.name}/ensemble`)}); for (const name of ['EnsembleJudge', 'createEnsembleJudge', 'detectBias', 'detectPositionBias', 'applyBiasMitigation', 'mitigateBias', 'mitigatePositionBias', 'evaluateWithCounterBalance', 'shouldUseCounterBalance', 'validateWithResearchEnhancements', 'validateMultipleWithPositionAnalysis', 'validateWithLengthAlignment', 'validateWithExplicitRubric', 'validateWithAllResearchEnhancements']) { if (typeof ensemble[name] !== 'function') throw new Error('Missing packed ensemble helper: ' + name); } const judge = new ensemble.EnsembleJudge({ judges: [{ provider: 'packed', async judgeScreenshot() { return { score: 8, assessment: 'pass', issues: [], reasoning: 'packed route' }; } }] }); const result = await judge.evaluate('packed.png', 'verify package route'); if (result.score !== 8 || result.availability.availableJudges !== 1 || result.disagreement.type !== 'insufficient_scores') throw new Error('Packed ensemble constructor route failed');`;
  execFileSync(process.execPath, ['--input-type=module', '--eval', ensembleProgram], {
    cwd: consumer,
    stdio: 'inherit',
  });
  const gameProgram = `const game = await import(${JSON.stringify(`${installedManifest.name}/game`)}); for (const name of ['playGame', 'GameGym', 'decideGameAction', 'executeGameAction', 'generateGamePrompt', 'createGameGoal', 'createGameGoals', 'testGameplay', 'testBrowserExperience', 'validateWithGoals']) { if (typeof game[name] !== 'function') throw new Error('Missing packed game export: ' + name); } const goal = game.createGameGoal('fun'); if (!goal.description || !Array.isArray(goal.criteria)) throw new Error('Packed game goal contract failed');`;
  execFileSync(process.execPath, ['--input-type=module', '--eval', gameProgram], {
    cwd: consumer,
    stdio: 'inherit',
  });
  const perceptionProgram = `const perception = await import(${JSON.stringify(`${installedManifest.name}/perception`)}); for (const name of ['samplePerceptions', 'aggregate', 'formatReport']) { if (typeof perception[name] !== 'function') throw new Error('Missing packed perception export: ' + name); } const result = await perception.samplePerceptions({ vision: async () => ({ headline: 'Checkout total lacks context', category: 'minor', target: 'order summary', why: 'The total has no explanatory label.', suggestion: 'Add a concise explanatory label.', confidence: 0.8 }), personas: [{ id: 'shopper', who: 'A shopper reviewing their order.' }], contexts: [{ id: 'checkout', ctx: 'The checkout review screen.' }], modes: ['problem'], n: 1, concurrency: 1, topK: 1, verify: false }); if (result.samples.length !== 1 || result.diagnostics.status !== 'ok' || result.diagnostics.sampling.accepted !== 1 || result.diagnostics.failures.length !== 0) throw new Error('Packed perception sampling route failed');`;
  execFileSync(process.execPath, ['--input-type=module', '--eval', perceptionProgram], {
    cwd: consumer,
    stdio: 'inherit',
  });
  const videoProgram = `const packageName = ${JSON.stringify(installedManifest.name)}; const root = await import(packageName); const video = await import(packageName + '/video'); if (root.VideoJudge !== video.VideoJudge || root.judgeVideo !== video.judgeVideo) throw new Error('Packed root/video exports are not identical'); const judge = new video.VideoJudge({ enabled: false, provider: 'gemini' }); if (!(judge instanceof video.VideoJudge)) throw new Error('Packed VideoJudge constructor failed');`;
  execFileSync(process.execPath, ['--input-type=module', '--eval', videoProgram], {
    cwd: consumer,
    stdio: 'inherit',
  });
  const ensembleTypeConsumer = `import type { ValidationResult } from ${JSON.stringify(installedManifest.name)}; import { EnsembleJudge, type Availability, type BiasDetection, type Disagreement, type EnsembleResult, type JudgeLike, evaluateWithCounterBalance, mitigateBias } from ${JSON.stringify(`${installedManifest.name}/ensemble`)}; const judges: JudgeLike[] = [{ provider: 'packed-types', async judgeScreenshot() { return { score: 8, issues: [], reasoning: 'typed' }; } }]; const result: EnsembleResult = await new EnsembleJudge({ judges }).evaluate('packed.png', 'typed package route'); const availability: Availability = result.availability; const disagreement: Disagreement = result.disagreement; const compatibleBias: BiasDetection = { hasBias: true, biases: [{ type: 'verbosity', score: 0.5 }], severity: 'medium', recommendations: [] }; const validation: ValidationResult = { enabled: true, score: 8, issues: [], recommendations: [], reasoning: 'typed' }; const mitigated = mitigateBias(validation, compatibleBias); const counterBalanced = await evaluateWithCounterBalance(async () => ({ enabled: true, score: 8, issues: [], recommendations: [], reasoning: 'typed' }), 'packed.png', 'typed package route', { baseline: 'baseline.png' }, { baselinePath: 'baseline.png' }); const status = counterBalanced.counterBalance?.status; void availability; void disagreement; void mitigated; void status;`;
  const typeConsumerPath = join(consumer, 'ensemble-consumer.ts');
  writeFileSync(typeConsumerPath, ensembleTypeConsumer);
  execFileSync(process.execPath, [join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc'), '--noEmit', '--strict', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--skipLibCheck', 'false', typeConsumerPath], {
    cwd: consumer,
    stdio: 'inherit',
  });

  const gameTypeConsumer = `import { GameGym, createGameGoal, executeGameAction, generateGamePrompt, type GameActionExecutionResult, type GameGoal, type GameOptions, type GamePage } from ${JSON.stringify(`${installedManifest.name}/game`)}; const locator = { async count() { return 1; }, async click() {}, locator() { return locator; } }; const page: GamePage = { keyboard: { async press() {} }, async screenshot() { return new Uint8Array(); }, locator() { return locator; }, async waitForTimeout() {}, async waitForSelector() {}, async evaluate() { return {}; }, async goto() {}, async waitForLoadState() {} }; const options: GameOptions = { goal: 'reach the exit', maxSteps: 2 }; const result: Promise<GameActionExecutionResult> = executeGameAction(page, { type: 'wait', duration: 1 }); const goal: GameGoal = createGameGoal('fun'); const prompt: string = generateGamePrompt(goal, { gameState: { score: 0 } }); const gym = new GameGym(page, options); void result; void prompt; void gym;`;
  const gameConsumerPath = join(consumer, 'game-consumer.ts');
  writeFileSync(gameConsumerPath, gameTypeConsumer);
  execFileSync(process.execPath, [join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc'), '--noEmit', '--strict', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--skipLibCheck', 'false', gameConsumerPath], {
    cwd: consumer,
    stdio: 'inherit',
  });

  const perceptionTypeConsumer = `import { samplePerceptions, type CritiqueDisposition, type PanelJudge, type PerceptionSection, type SamplePerceptionsOptions, type SamplePerceptionsResult } from ${JSON.stringify(`${installedManifest.name}/perception`)}; const judge: PanelJudge = { id: 'packed-types', async vision() { return { headline: 'Checkout total lacks context', category: 'minor', target: 'order summary', why: 'The total has no explanatory label.', suggestion: 'Add a concise explanatory label.', confidence: 0.8 }; } }; const options: SamplePerceptionsOptions = { panel: [judge], personas: [{ id: 'shopper', who: 'A shopper reviewing their order.' }], contexts: [{ id: 'checkout', ctx: 'The checkout review screen.' }], modes: ['problem'], n: 1, concurrency: 1, topK: 1, verify: false }; const result: Promise<SamplePerceptionsResult> = samplePerceptions(options); const section: PerceptionSection = { mode: 'problem', ranked: [], top: [], suppressed: [] }; const disposition: CritiqueDisposition = { target: 'order summary', disposition: 'operator-critique', reason: 'Needs review.' }; void result; void section; void disposition;`;
  const perceptionConsumerPath = join(consumer, 'perception-consumer.ts');
  writeFileSync(perceptionConsumerPath, perceptionTypeConsumer);
  execFileSync(process.execPath, [join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc'), '--noEmit', '--strict', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--skipLibCheck', 'false', perceptionConsumerPath], {
    cwd: consumer,
    stdio: 'inherit',
  });

  const videoTypeConsumer = `import { VideoJudge, judgeVideo, type VideoContext, type VideoInput, type VideoJudgeOptions } from ${JSON.stringify(`${installedManifest.name}/video`)}; const input: VideoInput = [{ path: 'clip.mp4', label: 'checkout flow', mime: 'video/mp4' }]; const options: VideoJudgeOptions = { enabled: false, provider: 'gemini', maxMB: 12, maxTotalMB: 20 }; const context: VideoContext = { maxTokens: 512, attempts: 2, timeout: 5000 }; const judge: VideoJudge = new VideoJudge(options); const result = judgeVideo(input, 'Review checkout', { ...options, ...context }); const screenshot = judge.judgeScreenshot('checkout.png', 'Review screenshot'); void result; void screenshot;`;
  const videoConsumerPath = join(consumer, 'video-consumer.ts');
  writeFileSync(videoConsumerPath, videoTypeConsumer);
  execFileSync(process.execPath, [join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc'), '--noEmit', '--strict', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--skipLibCheck', 'false', videoConsumerPath], {
    cwd: consumer,
    stdio: 'inherit',
  });

  const rootTypeConsumer = `import { type ExtractedIssue, type VideoContext, type VideoInput, type VideoInputEntry, type VideoJudgeOptions, type VideoTranscodeOptions } from ${JSON.stringify(installedManifest.name)}; const context: VideoContext = { maxTokens: 256 }; const input: VideoInput = [{ path: 'clip.mp4', mime: 'video/mp4' }]; const entry: VideoInputEntry = input[0]; const options: VideoJudgeOptions = { enabled: false, maxMB: 8 }; const transcode: VideoTranscodeOptions = { scale: '1280:-2', fps: 2, crf: 28 }; const issue: ExtractedIssue = { severity: 'major', timestamp: '00:01', desc: 'Checkout total shifts' }; void context; void entry; void options; void transcode; void issue;`;
  const rootConsumerPath = join(consumer, 'root-consumer.ts');
  writeFileSync(rootConsumerPath, rootTypeConsumer);
  execFileSync(process.execPath, [join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc'), '--noEmit', '--strict', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--skipLibCheck', 'false', rootConsumerPath], {
    cwd: consumer,
    stdio: 'inherit',
  });

  const temporalCaptureTypeConsumer = `import { aggregateMultiScale, aggregateTemporalNotes, captureTemporalScreenshots as temporalCapture, formatTemporalForPrompt, type AggregatedTemporalNotes, type MultiScaleAggregation, type Page as TemporalPage, type TemporalNote, type TemporalPromptScreenshot, type TemporalScreenshot as TemporalScreenshot } from ${JSON.stringify(`${installedManifest.name}/temporal`)}; import { captureTemporalScreenshots as multiModalCapture, type Page as MultiModalPage, type TemporalScreenshot as MultiModalScreenshot } from ${JSON.stringify(`${installedManifest.name}/multi-modal`)}; const notes: TemporalNote[] = [{ timestamp: 0, score: 8, observation: 'initial' }]; const aggregate: Promise<AggregatedTemporalNotes> = aggregateTemporalNotes(notes, { temporalReference: 0 }); const multiScale: MultiScaleAggregation = aggregateMultiScale(notes); const prompt: string = formatTemporalForPrompt(multiScale, { includeMultiScale: true }); const promptScreenshot: TemporalPromptScreenshot = { path: 'prompt.png', timestamp: 0 }; const page = { async screenshot(_options: { type: 'png'; path: string }) { return new Uint8Array(); } }; const temporalPage: TemporalPage = page; const multiModalPage: MultiModalPage = page; const temporalScreenshots: Promise<TemporalScreenshot[]> = temporalCapture(temporalPage, { fps: 2, duration: 1000 }); const multiModalScreenshots: Promise<MultiModalScreenshot[]> = multiModalCapture(multiModalPage, 2, 1000, { outputDir: 'typed-results' }); void aggregate; void prompt; void promptScreenshot; void temporalScreenshots; void multiModalScreenshots;`;
  const temporalCaptureConsumerPath = join(consumer, 'temporal-capture-consumer.ts');
  writeFileSync(temporalCaptureConsumerPath, temporalCaptureTypeConsumer);
  execFileSync(process.execPath, [join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc'), '--noEmit', '--strict', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--skipLibCheck', 'false', temporalCaptureConsumerPath], {
    cwd: consumer,
    stdio: 'inherit',
  });

  const image = join(consumer, 'pixel.png');
  writeFileSync(image, Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  ));
  const [binTarget] = Object.values(installedManifest.bin);
  if (typeof binTarget !== 'string' || !binTarget.endsWith('/ai-visual-test.js')) {
    throw new Error(`Unexpected packed CLI target: ${String(binTarget)}`);
  }
  const cli = join(consumer, 'node_modules', '.bin', 'ai-visual-test');
  const cliHelp = spawnSync(cli, ['--help'], {
    cwd: consumer,
    env: { PATH: process.env.PATH || '', AI_VISUAL_TEST_DISABLE_ENV_FILE: '1' },
    encoding: 'utf8',
  });
  if (cliHelp.status !== 0 || !cliHelp.stdout.includes('USAGE')) {
    throw new Error(`Packed CLI help failed: ${cliHelp.error?.message || cliHelp.stderr.trim()}`);
  }
  const cliVersion = spawnSync(cli, ['--version'], {
    cwd: consumer,
    env: { PATH: process.env.PATH || '', AI_VISUAL_TEST_DISABLE_ENV_FILE: '1' },
    encoding: 'utf8',
  });
  if (cliVersion.status !== 0 || cliVersion.stdout.trim() !== installedManifest.version) {
    throw new Error(`Packed CLI version failed: ${cliVersion.stdout.trim()}`);
  }
  const cliResult = spawnSync(cli, ['check', image, 'check package wiring', '--json'], {
    cwd: consumer,
    env: { PATH: process.env.PATH || '', AI_VISUAL_TEST_DISABLE_ENV_FILE: '1' },
    encoding: 'utf8',
  });
  let cliError;
  try {
    cliError = JSON.parse(cliResult.stdout);
  } catch {
    throw new Error(`Packed CLI JSON failure was not JSON: ${cliResult.stdout.trim()}`);
  }
  if (cliResult.status === 0 || cliError.code !== 'provider_not_configured' || typeof cliError.error !== 'string') {
    throw new Error(`Packed CLI check path failed unexpectedly: ${cliResult.stdout.trim()}`);
  }

  process.stdout.write(`Packed package verified: ${specifiers.length} runtime routes and CLI check path\n`);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
