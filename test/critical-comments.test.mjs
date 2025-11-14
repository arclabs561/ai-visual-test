/**
 * Tests for CRITICAL comment usage
 * 
 * Ensures CRITICAL comments are only used for actual critical bugs/security issues.
 * Most important notes should use "NOTE:" instead.
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const srcDir = join(__dirname, '..', 'src');

function getAllMjsFiles(dir, fileList = []) {
  const files = readdirSync(dir);
  files.forEach(file => {
    const filePath = join(dir, file);
    if (statSync(filePath).isDirectory()) {
      getAllMjsFiles(filePath, fileList);
    } else if (file.endsWith('.mjs')) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

test('CRITICAL comments are only used for actual critical issues', () => {
  const files = getAllMjsFiles(srcDir).map(f => f.replace(srcDir + '/', ''));
  const violations = [];
  
  for (const file of files) {
    const content = readFileSync(join(srcDir, file), 'utf-8');
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      // Check for CRITICAL comments
      if (line.includes('CRITICAL') && !line.includes('severity === \'CRITICAL\'')) {
        // Allow legitimate uses:
        // - "CRITICAL BUG FIX" in comments (historical bug fixes)
        // - "CRITICAL:" for actual security/critical bugs
        // - But not for general notes or implementation details
        
        const isLegitimate = 
          line.includes('CRITICAL BUG FIX') ||
          line.includes('CRITICAL BUGS FIXED') ||
          line.includes('CRITICAL FIX:') ||  // Allow "CRITICAL FIX:" for bug fixes
          (line.includes('CRITICAL:') && (
            line.includes('security') ||
            line.includes('vulnerability') ||
            line.includes('data loss') ||
            line.includes('corruption')
          ));
        
        if (!isLegitimate && !line.includes('// NOTE:')) {
          violations.push({
            file,
            line: index + 1,
            content: line.trim()
          });
        }
      }
    });
  }
  
  if (violations.length > 0) {
    const message = `Found ${violations.length} CRITICAL comments that should be "NOTE:" instead:\n` +
      violations.map(v => `  ${v.file}:${v.line}: ${v.content}`).join('\n');
    assert.fail(message);
  }
});

test('No excessive CRITICAL comment noise', () => {
  const files = getAllMjsFiles(srcDir).map(f => f.replace(srcDir + '/', ''));
  let totalCritical = 0;
  
  for (const file of files) {
    const content = readFileSync(join(srcDir, file), 'utf-8');
    // Count CRITICAL comments (excluding data structure fields)
    const matches = content.match(/CRITICAL(?!.*severity)/g);
    if (matches) {
      totalCritical += matches.length;
    }
  }
  
  // Should have very few CRITICAL comments (only for actual critical issues)
  // After cleanup, we expect < 10 legitimate CRITICAL comments
  assert(totalCritical < 15, 
    `Too many CRITICAL comments found: ${totalCritical}. Should be < 15 after cleanup.`);
});

