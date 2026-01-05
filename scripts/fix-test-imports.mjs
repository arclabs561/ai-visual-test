#!/usr/bin/env node
/**
 * Fix test import paths after test organization
 * Updates relative imports to test-setup.mjs and other test utilities
 */

import { readdir, readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';

const TEST_DIR = 'test';

async function fixImportsInFile(filePath) {
  const content = await readFile(filePath, 'utf8');
  const dir = dirname(filePath);
  const relativeToTestRoot = dir.replace(TEST_DIR + '/', '');
  const depth = relativeToTestRoot.split('/').length;
  const prefix = '../'.repeat(depth);
  
  let modified = false;
  let newContent = content;
  
  // Fix test-setup.mjs imports (handle all variations)
  const testSetupPatterns = [
    [/from '\.\/test-setup\.mjs'/g, `from '${prefix}test-setup.mjs'`],
    [/from "\.\/test-setup\.mjs"/g, `from "${prefix}test-setup.mjs"`],
    [/import '\.\/test-setup\.mjs'/g, `import '${prefix}test-setup.mjs'`],
    [/import "\.\/test-setup\.mjs"/g, `import "${prefix}test-setup.mjs"`]
  ];
  
  for (const [pattern, replacement] of testSetupPatterns) {
    if (pattern.test(content)) {
      newContent = newContent.replace(pattern, replacement);
      modified = true;
    }
  }
  
  // Fix test-image-utils.mjs imports
  if (content.includes("from './test-image-utils.mjs'") || content.includes('from "./test-image-utils.mjs"')) {
    newContent = newContent
      .replace(/from '\.\/test-image-utils\.mjs'/g, `from '${prefix}test-image-utils.mjs'`)
      .replace(/from "\.\/test-image-utils\.mjs"/g, `from "${prefix}test-image-utils.mjs"`);
    modified = true;
  }
  
  // Fix test-logger.mjs imports
  if (content.includes("from './test-logger.mjs'") || content.includes('from "./test-logger.mjs"')) {
    newContent = newContent
      .replace(/from '\.\/test-logger\.mjs'/g, `from '${prefix}test-logger.mjs'`)
      .replace(/from "\.\/test-logger\.mjs"/g, `from "${prefix}test-logger.mjs"`);
    modified = true;
  }
  
  // Fix helpers imports (they're in test/helpers/)
  if (content.includes("from './helpers/") || content.includes('from "./helpers/')) {
    newContent = newContent
      .replace(/from '\.\/helpers\//g, `from '${prefix}helpers/`)
      .replace(/from "\.\/helpers\//g, `from "${prefix}helpers/`);
    modified = true;
  }
  
  if (modified) {
    await writeFile(filePath, newContent, 'utf8');
    return true;
  }
  
  return false;
}

async function fixAllTestImports() {
  const subdirs = ['unit', 'integration', 'e2e', 'security', 'performance', 'datasets'];
  let fixed = 0;
  
  for (const subdir of subdirs) {
    const dir = join(TEST_DIR, subdir);
    if (!existsSync(dir)) continue;
    
    const files = await readdir(dir);
    for (const file of files) {
      if (file.endsWith('.test.mjs') || file.endsWith('.test.js')) {
        const filePath = join(dir, file);
        if (await fixImportsInFile(filePath)) {
          console.log(`Fixed: ${subdir}/${file}`);
          fixed++;
        }
      }
    }
  }
  
  console.log(`\n✅ Fixed imports in ${fixed} files`);
}

fixAllTestImports().catch(console.error);

