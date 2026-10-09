#!/usr/bin/env node
/**
 * Assemble the publishable package in dist/ from the staged build in build/.
 *
 * This script:
 * 1. Copies the staged source files to dist/ unchanged
 * 2. Copies the published docs and bin/
 * 3. Writes a package.json with paths relative to dist/
 *
 * Usage: node scripts/build-dist.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { readdir, copyFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');
const STAGE_DIR = join(ROOT_DIR, 'build');
const DIST_DIR = join(ROOT_DIR, 'dist');
const SRC_DIR = join(STAGE_DIR, 'src');

/**
 * Copy source files
 */
async function buildSourceFiles() {
  // Message will be printed by main() function

  // Clean dist directory
  if (existsSync(DIST_DIR)) {
    const { rmSync } = await import('fs');
    rmSync(DIST_DIR, { recursive: true, force: true });
  }
  await mkdir(DIST_DIR, { recursive: true });

  // Copy src/ to dist/src/
  const distSrcDir = join(DIST_DIR, 'src');
  mkdirSync(distSrcDir, { recursive: true });

  // Recursively copy source files
  async function processDirectory(srcPath, distPath) {
    const entries = await readdir(srcPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcEntryPath = join(srcPath, entry.name);
      const distEntryPath = join(distPath, entry.name);

      if (entry.isDirectory()) {
        await mkdir(distEntryPath, { recursive: true });
        await processDirectory(srcEntryPath, distEntryPath);
      } else if (entry.isFile()) {
        writeFileSync(distEntryPath, readFileSync(srcEntryPath));
      }
    }
  }

  await processDirectory(SRC_DIR, distSrcDir);

  // Copy other files that should be published
  const filesToCopy = [
    'README.md',
    'CHANGELOG.md',
    'CONTRIBUTING.md',
    'DEPLOYMENT.md',
    'SECURITY.md',
    'LICENSE',
    '.secretsignore.example',
    'API_QUICK_REFERENCE.md',  // Essential API guide
    'EXAMPLES.md'              // Essential examples
  ];

  // Note: api/ and public/ are excluded from npm package (deployment-only)
  // vercel.json is also excluded (deployment configuration)

  for (const file of filesToCopy) {
    const srcPath = join(STAGE_DIR, file);
    if (existsSync(srcPath)) {
      const distPath = join(DIST_DIR, file);
      const content = readFileSync(srcPath);
      writeFileSync(distPath, content);
      console.log(`   ✓ ${file}`);
    }
  }

  // Copy directories recursively
  async function copyDir(src, dest) {
    await mkdir(dest, { recursive: true });
    const entries = await readdir(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = join(src, entry.name);
      const destPath = join(dest, entry.name);
      if (entry.isDirectory()) {
        await copyDir(srcPath, destPath);
      } else {
        await copyFile(srcPath, destPath);
      }
    }
  }

  // Keep every published entry point and declaration route present in dist.
  // The publish manifest below is deliberately inherited from package.json.
  for (const directory of ['bin']) {
    const srcPath = join(STAGE_DIR, directory);
    if (existsSync(srcPath)) {
      await copyDir(srcPath, join(DIST_DIR, directory));
      console.log(`   ✓ ${directory}/`);
    }
  }
}

/**
 * Update package.json for publishing from dist/
 */
function updatePackageJson() {
  const packageJsonPath = join(STAGE_DIR, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

  // Create a publish version
  // NOTE: Paths are relative to dist/ directory (where we publish from)
  // Strip scripts (especially prepublishOnly) -- CI handles tests/build
  const { scripts: _scripts, devDependencies: _devDeps, private: _private, ...publishBase } = packageJson;
  const publishPackageJson = publishBase;

  function emittedTarget(target) {
    if (typeof target !== 'string' || !target.startsWith('./')) return target;
    if (target === './package.json') return target;
    if (existsSync(join(DIST_DIR, target))) return target;
    const alternative = target.endsWith('.mjs')
      ? `${target.slice(0, -4)}.js`
      : target.endsWith('.js')
        ? `${target.slice(0, -3)}.mjs`
        : null;
    if (alternative && existsSync(join(DIST_DIR, alternative))) return alternative;
    throw new Error(`Published target was not emitted: ${target}`);
  }

  publishPackageJson.main = emittedTarget(publishPackageJson.main);
  publishPackageJson.types = emittedTarget(publishPackageJson.types);
  publishPackageJson.bin = Object.fromEntries(
    Object.entries(publishPackageJson.bin || {}).map(([name, target]) => [name, emittedTarget(target)]),
  );
  publishPackageJson.exports = Object.fromEntries(
    Object.entries(publishPackageJson.exports || {}).map(([subpath, route]) => [
      subpath,
      typeof route === 'string'
        ? emittedTarget(route)
        : Object.fromEntries(
            Object.entries(route).map(([condition, target]) => [condition, emittedTarget(target)]),
          ),
    ]),
  );
  publishPackageJson.files = [
    'bin/',
    'src/',
    'README.md',
    'CHANGELOG.md',
    'SECURITY.md',
    'LICENSE',
  ];

  writeFileSync(join(DIST_DIR, 'package.json'), JSON.stringify(publishPackageJson, null, 2), 'utf-8');
  console.log('   ✓ package.json (updated for dist/)');
}

/**
 * Main build function
 */
async function main() {
  console.log('📦 Building package...\n');
  await buildSourceFiles();
  updatePackageJson();

  console.log('\n✅ Build complete!');
  console.log(`   Output: ${DIST_DIR}`);
}

main().catch(error => {
  console.error('❌ Build failed:', error);
  process.exit(1);
});
