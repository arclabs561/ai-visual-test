#!/usr/bin/env node
/**
 * Build script for obfuscating npm package source code
 * 
 * This script:
 * 1. Copies source files to dist/
 * 2. Obfuscates all .mjs files
 * 3. Preserves file structure
 * 4. Updates package.json for publishing
 * 
 * Usage: node scripts/build-obfuscated.mjs [--skip-obfuscation]
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { readdir, copyFile, mkdir } from 'fs/promises';
import { join, dirname, relative as pathRelative, extname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');
const STAGE_DIR = join(ROOT_DIR, 'build');
const DIST_DIR = join(ROOT_DIR, 'dist');
const SRC_DIR = join(STAGE_DIR, 'src');

// Files to obfuscate (Tier 1: Core proprietary algorithms only)
const OBFUSCATE_FILES = [
  'src/temporal-orchestration.js',
  'src/cost-optimization.mjs',
  'src/model-tier-selector.mjs'
];

// Files to keep readable (API surface, validators, utilities)
const KEEP_READABLE = [
  'src/index.mjs',           // API surface
  'src/judge.js',            // API wrapper
  'src/cache.mjs',           // Cache system
  'src/validators/',         // Validators directory
  'src/utils/',              // Utilities directory
  'src/errors.mjs',          // Error handling
  'src/config.mjs',          // Configuration
];

// Obfuscation configuration (balanced protection)
const OBFUSCATION_CONFIG = {
  compact: true,
  controlFlowFlattening: false, // Can break some code
  deadCodeInjection: false, // Can cause issues
  debugProtection: false, // Breaks in Node.js
  identifierNamesGenerator: 'hexadecimal',
  log: false,
  renameGlobals: false, // Can break ESM imports
  selfDefending: true, // Protects against tampering
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 5,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayThreshold: 0.5,
  transformObjectKeys: true,
  unicodeEscapeSequence: false,
  // ESM compatibility
  target: 'node',
  // Preserve exports
  reservedNames: [
    'exports',
    'module',
    'require',
    '__dirname',
    '__filename',
    'import',
    'export'
  ]
};

/**
 * Check if javascript-obfuscator is available
 */
function checkObfuscatorAvailable() {
  try {
    // Check if installed in node_modules
    const obfuscatorPath = join(ROOT_DIR, 'node_modules', 'javascript-obfuscator');
    if (existsSync(join(obfuscatorPath, 'package.json'))) {
      return true;
    }
    // Also check if it's in package.json devDependencies
    try {
      const packageJson = JSON.parse(readFileSync(join(ROOT_DIR, 'package.json'), 'utf-8'));
      if (packageJson.devDependencies && packageJson.devDependencies['javascript-obfuscator']) {
        return true;
      }
    } catch {
      // Ignore
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Check if file should be obfuscated (selective obfuscation)
 */
function shouldObfuscate(filePath) {
  const relativePath = pathRelative(SRC_DIR, filePath);
  
  // Check if in keep-readable list
  for (const pattern of KEEP_READABLE) {
    if (relativePath === pattern || relativePath.startsWith(pattern)) {
      return false;
    }
  }
  
  // Check if in obfuscate list (remove 'src/' prefix for comparison)
  const pathWithoutSrc = relativePath.startsWith('src/') ? relativePath.substring(4) : relativePath;
  for (const pattern of OBFUSCATE_FILES) {
    const patternWithoutSrc = pattern.startsWith('src/') ? pattern.substring(4) : pattern;
    if (relativePath === pattern || relativePath.endsWith('/' + patternWithoutSrc) || pathWithoutSrc === patternWithoutSrc) {
      return true;
    }
  }
  
  // Default: don't obfuscate (keep readable for debugging)
  return false;
}

/**
 * Obfuscate a single file
 */
async function obfuscateFile(filePath, skipObfuscation = false) {
  if (skipObfuscation) {
    return readFileSync(filePath, 'utf-8');
  }

  // Selective obfuscation: only obfuscate Tier 1 files
  if (!shouldObfuscate(filePath)) {
    return readFileSync(filePath, 'utf-8');
  }

  try {
    // Dynamic import to avoid errors if not installed
    const JavaScriptObfuscator = (await import('javascript-obfuscator')).default;
    const code = readFileSync(filePath, 'utf-8');
    
    // Skip obfuscation for very small files or files that might break
    if (code.length < 100) {
      return code;
    }

    const obfuscationResult = JavaScriptObfuscator.obfuscate(code, OBFUSCATION_CONFIG);
    return obfuscationResult.getObfuscatedCode();
  } catch (error) {
    console.warn(`⚠️  Failed to obfuscate ${filePath}: ${error.message}`);
    console.warn(`   Falling back to original code`);
    return readFileSync(filePath, 'utf-8');
  }
}

/**
 * Copy and obfuscate source files
 */
async function buildSourceFiles(skipObfuscation = false) {
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

  // Recursively copy and obfuscate .mjs files
  async function processDirectory(srcPath, distPath) {
    const entries = await readdir(srcPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcEntryPath = join(srcPath, entry.name);
      const distEntryPath = join(distPath, entry.name);

      if (entry.isDirectory()) {
        await mkdir(distEntryPath, { recursive: true });
        await processDirectory(srcEntryPath, distEntryPath);
      } else if (entry.isFile()) {
        if (['.mjs', '.js'].includes(extname(entry.name))) {
          // Selective obfuscation: only obfuscate Tier 1 files
          const obfuscated = await obfuscateFile(srcEntryPath, skipObfuscation);
          writeFileSync(distEntryPath, obfuscated, 'utf-8');
          const relPath = pathRelative(ROOT_DIR, srcEntryPath);
          const isObfuscated = !skipObfuscation && shouldObfuscate(srcEntryPath);
          console.log(`   ${isObfuscated ? '🔒' : '📄'} ${relPath}${isObfuscated ? ' (obfuscated)' : ''}`);
        } else {
          // Copy other files as-is
          const content = readFileSync(srcEntryPath);
          writeFileSync(distEntryPath, content);
        }
      }
    }
  }

  await processDirectory(SRC_DIR, distSrcDir);

  // Copy other files that should be published
  const filesToCopy = [
    'index.d.ts',
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
  for (const directory of ['bin', 'types']) {
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
    'index.d.ts',
    'types/',
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
  const skipObfuscation = process.argv.includes('--skip-obfuscation');
  const obfuscatorAvailable = checkObfuscatorAvailable();

  if (!skipObfuscation && !obfuscatorAvailable) {
    console.warn('⚠️  javascript-obfuscator not found. Installing...');
    console.warn('   Run: npm install --save-dev javascript-obfuscator');
    console.warn('   Or use --skip-obfuscation to build without obfuscation\n');
    process.exit(1);
  }

  if (skipObfuscation) {
    console.log('📦 Building package (obfuscation skipped)...\n');
  } else {
    console.log('🔒 Building package with selective obfuscation...\n');
    console.log('   Obfuscating Tier 1 files (core algorithms only):');
    OBFUSCATE_FILES.forEach(file => console.log(`   - ${file}`));
    console.log('   Keeping readable (API surface, validators, utilities)\n');
  }

  await buildSourceFiles(skipObfuscation);
  updatePackageJson();

  console.log('\n✅ Build complete!');
  console.log(`   Output: ${DIST_DIR}`);
  console.log('\n   To test locally:');
  console.log(`   cd ${DIST_DIR}`);
  console.log('   npm pack');
  console.log('   npm install ./package.tgz');
}

main().catch(error => {
  console.error('❌ Build failed:', error);
  process.exit(1);
});
