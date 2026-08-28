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
packageJson.imports = {
  ...(packageJson.imports || {}),
  '#provider-adapters': './src/provider-adapters.js',
  '#pairwise-fixture-metrics': './src/pairwise-fixture-metrics.js',
  '#public-contract': './src/public-contract.js',
  '#review-contract': './src/review-contract.js',
  '#structured-output': './src/structured-output.js',
};
writeFileSync(join(STAGE, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`);

// The checkout still exposes source entry points. Verify their private import
// aliases resolve through the freshly compiled staging tree.
execFileSync(process.execPath, ['--input-type=module', '--eval', "await import('./src/judge.mjs')"], {
  cwd: ROOT,
  stdio: 'inherit',
});
