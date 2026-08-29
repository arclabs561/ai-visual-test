#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STAGE = join(ROOT, 'build');
const TSC = join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');

rmSync(STAGE, { recursive: true, force: true });
execFileSync(process.execPath, [TSC, '-p', join(ROOT, 'tsconfig.build.json')], {
  cwd: ROOT,
  stdio: 'inherit',
});
execFileSync(process.execPath, [TSC, '-p', join(ROOT, 'tsconfig.contract.json')], {
  cwd: ROOT,
  stdio: 'inherit',
});

for (const file of ['package.json', 'package-lock.json', 'index.d.ts', 'README.md', 'CHANGELOG.md', 'SECURITY.md', 'LICENSE']) {
  const source = join(ROOT, file);
  if (!existsSync(source)) continue;
  mkdirSync(dirname(join(STAGE, file)), { recursive: true });
  cpSync(source, join(STAGE, file));
}

for (const directory of ['types', 'docs/adr', 'docs/api', 'public']) {
  const source = join(ROOT, directory);
  if (existsSync(source)) cpSync(source, join(STAGE, directory), { recursive: true });
}

function copyTestAssets(source, destination) {
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const sourcePath = join(source, entry.name);
    const destinationPath = join(destination, entry.name);
    if (entry.isDirectory()) {
      mkdirSync(destinationPath, { recursive: true });
      copyTestAssets(sourcePath, destinationPath);
      continue;
    }
    if (['.js', '.mjs', '.ts', '.map'].includes(extname(entry.name))) continue;
    mkdirSync(dirname(destinationPath), { recursive: true });
    cpSync(sourcePath, destinationPath);
  }
}

copyTestAssets(join(ROOT, 'test'), join(STAGE, 'test'));

const packageJson = JSON.parse(readFileSync(join(STAGE, 'package.json'), 'utf8'));
packageJson.private = true;
for (const subpath of ['./temporal', './ensemble', './game', './playwright', './vitest', './jest']) {
  const route = packageJson.exports?.[subpath];
  if (!route || typeof route !== 'object') {
    throw new Error(`Missing staged package route: ${subpath}`);
  }
  if (subpath === './temporal') {
    route.import = './src/temporal/index.js';
    route.types = './src/temporal/index.d.ts';
  } else if (subpath === './game') {
    route.import = './src/game/index.js';
    route.types = './src/game/index.d.ts';
  } else if (subpath === './ensemble') {
    route.import = './src/ensemble/index.js';
    route.types = './types/ensemble-barrel.d.ts';
  } else {
    const integration = subpath === './playwright' ? 'playwright' : 'vitest-jest';
    route.import = `./src/integrations/${integration}.js`;
    route.types = `./src/integrations/${integration}.d.ts`;
  }
}
packageJson.imports = {
  ...(packageJson.imports || {}),
  '#provider-adapters': './src/provider-adapters.js',
  '#dataset-evaluation-metrics': './src/dataset-evaluation-metrics.js',
  '#ensemble-judge': './src/ensemble-judge.js',
  '#game-action-contract': './src/game-action-contract.js',
  '#game-convenience': './src/game-convenience.js',
  '#game-goal-prompts': './src/game-goal-prompts.js',
  '#game-player': './src/game-player.js',
  '#pairwise-fixture-metrics': './src/pairwise-fixture-metrics.js',
  '#page-validation': './src/page-validation.js',
  '#playwright-integration': './src/integrations/playwright.js',
  '#position-counterbalance': './src/position-counterbalance.js',
  '#public-contract': './src/public-contract.js',
  '#review-contract': './src/review-contract.js',
  '#structured-output': './src/structured-output.js',
  '#structured-task': './src/structured-task.js',
  '#temporal-capture': './src/temporal-capture.js',
  '#temporal-core': './src/temporal-core.js',
  '#temporal-multi-scale': './src/temporal-multi-scale.js',
  '#temporal-orchestration': './src/temporal-orchestration.js',
  '#temporal-prompt-formatting': './src/temporal-prompt-formatting.js',
  '#validation-result-normalizer': './src/validation-result-normalizer.js',
};
writeFileSync(join(STAGE, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`);

// The source manifest intentionally references build/ for migrated modules.
// Prove Node can self-import each public alias after this mandatory stage.
const sourceMatcherProgram = `const packageName = ${JSON.stringify(packageJson.name)}; for (const route of ['vitest', 'jest']) { const integration = await import(packageName + '/' + route); const registered = {}; integration.createMatchers({ extend(matchers) { Object.assign(registered, matchers); } }); for (const name of ['toPassVisualCheck', 'toHaveVisualScore', 'toMatchVisually']) { if (typeof registered[name] !== 'function') throw new Error('Missing source ' + route + ' matcher: ' + name); } const outcome = await registered.toPassVisualCheck(123, 'source package check'); if (outcome.pass !== false || !outcome.message().includes('string')) throw new Error('Unexpected source ' + route + ' matcher outcome'); } const temporal = await import(packageName + '/temporal'); if (typeof temporal.aggregateTemporalNotes !== 'function' || typeof temporal.buildTemporalGraph !== 'function' || typeof temporal.captureTemporalScreenshots !== 'function') throw new Error('Missing source temporal exports'); const multiModal = await import(packageName + '/multi-modal'); if (multiModal.captureTemporalScreenshots !== temporal.captureTemporalScreenshots) throw new Error('Temporal capture exports are not identical'); const ensemble = await import(packageName + '/ensemble'); if (typeof ensemble.EnsembleJudge !== 'function' || typeof ensemble.createEnsembleJudge !== 'function') throw new Error('Missing source ensemble constructor exports'); const game = await import(packageName + '/game'); for (const name of ['playGame', 'GameGym', 'generateGamePrompt', 'testGameplay']) { if (typeof game[name] !== 'function') throw new Error('Missing source game export: ' + name); } const root = await import(packageName); const playwright = await import(packageName + '/playwright'); if (root.createMatchers !== playwright.createMatchers) throw new Error('Root createMatchers is not the source Playwright adapter export'); const registered = {}; playwright.createMatchers({ extend(matchers) { Object.assign(registered, matchers); } }); for (const name of ['toHaveVisualScore', 'toBeAccessibleHybrid']) { if (typeof registered[name] !== 'function') throw new Error('Missing source Playwright matcher: ' + name); }`;
execFileSync(process.execPath, ['--input-type=module', '--eval', sourceMatcherProgram], {
  cwd: ROOT,
  stdio: 'inherit',
});
