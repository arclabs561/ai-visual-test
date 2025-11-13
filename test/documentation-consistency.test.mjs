/**
 * Tests for documentation consistency
 * 
 * Ensures return type documentation is consistent across all API docs.
 * Specifically validates that score is documented as `number | null`.
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const docsDir = join(__dirname, '..', 'docs');

test('API_ESSENTIALS.md documents score as number | null', () => {
  const content = readFileSync(join(docsDir, 'api', 'API_ESSENTIALS.md'), 'utf-8');
  
  // Should have score: number | null
  assert(content.includes('score: number | null'), 
    'API_ESSENTIALS.md should document score as number | null');
  
  // Should not have just "score: number" without null
  const wrongPattern = /score:\s*number[^|]/;
  const matches = content.match(wrongPattern);
  if (matches) {
    // Check if it's in a context that allows null
    const context = content.substring(Math.max(0, content.indexOf(matches[0]) - 50), 
      content.indexOf(matches[0]) + 100);
    // If it's not in a type definition with | null nearby, it's wrong
    if (!context.includes('| null') && !context.includes('number | null')) {
      assert.fail(`Found "score: number" without "| null" in API_ESSENTIALS.md: ${matches[0]}`);
    }
  }
});

test('API_REVIEW_AND_ALIGNMENT.md documents score as number | null', () => {
  const content = readFileSync(join(docsDir, 'api', 'API_REVIEW_AND_ALIGNMENT.md'), 'utf-8');
  
  // Should have score: number | null
  assert(content.includes('score: number | null'), 
    'API_REVIEW_AND_ALIGNMENT.md should document score as number | null');
});

test('README.md does not contain unvalidated percentage claims', () => {
  const content = readFileSync(join(__dirname, '..', 'README.md'), 'utf-8');
  
  // Should not have unvalidated percentage claims like "10-20% improvement"
  // If it does, it should be qualified with "not validated" or similar
  const percentagePattern = /\d+[-–]\d+%/i;
  const matches = content.match(percentagePattern);
  
  if (matches) {
    // Check if it's qualified
    const context = content.substring(Math.max(0, content.indexOf(matches[0]) - 100),
      content.indexOf(matches[0]) + 200);
    const isQualified = context.includes('not validated') || 
                       context.includes('unvalidated') ||
                       context.includes('preliminary') ||
                       context.includes('estimated');
    
    if (!isQualified) {
      // Allow if it's in a context that's clearly hypothetical or example
      const isExample = context.includes('example') || 
                       context.includes('hypothetical') ||
                       context.includes('may');
      
      if (!isExample) {
        assert.fail(`Found unqualified percentage claim in README.md: ${matches[0]}. Should be qualified or removed.`);
      }
    }
  }
});

