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
  const ensembleProgram = `const ensemble = await import(${JSON.stringify(`${installedManifest.name}/ensemble`)}); for (const name of ['evaluateWithCounterBalance', 'shouldUseCounterBalance']) { if (typeof ensemble[name] !== 'function') throw new Error('Missing packed ensemble helper: ' + name); } const judge = new ensemble.EnsembleJudge({ judges: [{ provider: 'packed', async judgeScreenshot() { return { score: 8, assessment: 'pass', issues: [], reasoning: 'packed route' }; } }] }); const result = await judge.evaluate('packed.png', 'verify package route'); if (result.score !== 8 || result.availability.availableJudges !== 1 || result.disagreement.type !== 'insufficient_scores') throw new Error('Packed ensemble constructor route failed');`;
  execFileSync(process.execPath, ['--input-type=module', '--eval', ensembleProgram], {
    cwd: consumer,
    stdio: 'inherit',
  });
  const ensembleTypeConsumer = `import { EnsembleJudge, type Availability, type Disagreement, type EnsembleResult, type JudgeLike, evaluateWithCounterBalance } from ${JSON.stringify(`${installedManifest.name}/ensemble`)}; const judges: JudgeLike[] = [{ provider: 'packed-types', async judgeScreenshot() { return { score: 8, issues: [], reasoning: 'typed' }; } }]; const result: EnsembleResult = await new EnsembleJudge({ judges }).evaluate('packed.png', 'typed package route'); const availability: Availability = result.availability; const disagreement: Disagreement = result.disagreement; const counterBalanced = await evaluateWithCounterBalance(async () => ({ enabled: true, score: 8, issues: [], recommendations: [], reasoning: 'typed' }), 'packed.png', 'typed package route', { baseline: 'baseline.png' }, { baselinePath: 'baseline.png' }); const status = counterBalanced.counterBalance?.status; void availability; void disagreement; void status;`;
  const typeConsumerPath = join(consumer, 'ensemble-consumer.ts');
  writeFileSync(typeConsumerPath, ensembleTypeConsumer);
  execFileSync(process.execPath, [join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc'), '--noEmit', '--strict', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--skipLibCheck', 'false', typeConsumerPath], {
    cwd: consumer,
    stdio: 'inherit',
  });

  const temporalCaptureTypeConsumer = `import { captureTemporalScreenshots as temporalCapture, type Page as TemporalPage, type TemporalScreenshot as TemporalScreenshot } from ${JSON.stringify(`${installedManifest.name}/temporal`)}; import { captureTemporalScreenshots as multiModalCapture, type Page as MultiModalPage, type TemporalScreenshot as MultiModalScreenshot } from ${JSON.stringify(`${installedManifest.name}/multi-modal`)}; const page = { async screenshot(_options: { type: 'png'; path: string }) { return new Uint8Array(); } }; const temporalPage: TemporalPage = page; const multiModalPage: MultiModalPage = page; const temporalScreenshots: Promise<TemporalScreenshot[]> = temporalCapture(temporalPage, { fps: 2, duration: 1000 }); const multiModalScreenshots: Promise<MultiModalScreenshot[]> = multiModalCapture(multiModalPage, 2, 1000, { outputDir: 'typed-results' }); void temporalScreenshots; void multiModalScreenshots;`;
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
  const cli = join(installedRoot, binTarget);
  const cliResult = spawnSync(process.execPath, [cli, 'check', image, 'check package wiring'], {
    cwd: consumer,
    env: { PATH: process.env.PATH || '' },
    encoding: 'utf8',
  });
  if (cliResult.status === 0 || !cliResult.stderr.includes('No provider detected')) {
    throw new Error(`Packed CLI check path failed unexpectedly: ${cliResult.stderr.trim()}`);
  }

  process.stdout.write(`Packed package verified: ${specifiers.length} runtime routes and CLI check path\n`);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
