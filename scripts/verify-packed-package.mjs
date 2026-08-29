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
  const ensembleProgram = `const ensemble = await import(${JSON.stringify(`${installedManifest.name}/ensemble`)}); for (const name of ['evaluateWithCounterBalance', 'shouldUseCounterBalance']) { if (typeof ensemble[name] !== 'function') throw new Error('Missing packed ensemble helper: ' + name); }`;
  execFileSync(process.execPath, ['--input-type=module', '--eval', ensembleProgram], {
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
