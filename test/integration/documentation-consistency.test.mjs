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
const docsDir = join(__dirname, '..', '..', 'docs');

test('API_ESSENTIALS.md documents score as number | null', () => {
  const content = readFileSync(join(docsDir, 'api', 'API_ESSENTIALS.md'), 'utf-8');
  
  // Should have score: number | null
  assert(content.includes('score: number | null'), 
    'API_ESSENTIALS.md should document score as number | null');
  
  // Should not have just "score: number" without null in type definitions
  // But allow it in example code (e.g., "result.score" or "score: 7.5")
  const wrongPattern = /score:\s*number[^|]/g;
  const matches = [...content.matchAll(wrongPattern)];
  if (matches.length > 0) {
    for (const match of matches) {
      const context = content.substring(Math.max(0, match.index - 50), 
        match.index + 100);
      // Allow if it's in example code (JavaScript/TypeScript code blocks, not type definitions)
      const isInExample = context.includes('console.log') || 
                         context.includes('result.score') ||
                         context.includes('score: 7') ||
                         context.includes('score: 8') ||
                         context.includes('//') ||
                         context.includes('*') ||
                         context.includes('```javascript') ||
                         context.includes('```typescript');
      // Only fail if it's in a type definition context without | null
      if (!isInExample && !context.includes('| null') && !context.includes('number | null')) {
        // Check if it's actually in a type definition (has interface, type, or similar)
        const isTypeDef = context.includes('interface') || 
                         context.includes('type ') ||
                         context.includes('ValidationResult') ||
                         context.includes('{') && context.includes('}');
        if (isTypeDef) {
          assert.fail(`Found "score: number" without "| null" in type definition in API_ESSENTIALS.md: ${match[0]}`);
        }
      }
    }
  }
});

test('API_REVIEW_AND_ALIGNMENT.md documents score as number | null', () => {
  const content = readFileSync(join(docsDir, 'api', 'API_REVIEW_AND_ALIGNMENT.md'), 'utf-8');
  
  // Should have score: number | null
  assert(content.includes('score: number | null') || content.includes('score?: number | null'), 
    'API_REVIEW_AND_ALIGNMENT.md should document score as number | null');
  
  // Should not have just "score: number" without null in type definitions
  // But allow it in example code
  const wrongPattern = /score:\s*number[^|]/g;
  const matches = [...content.matchAll(wrongPattern)];
  if (matches.length > 0) {
    for (const match of matches) {
      const context = content.substring(Math.max(0, match.index - 50), 
        match.index + 100);
      // Allow if it's in example code
      const isInExample = context.includes('console.log') || 
                         context.includes('result.score') ||
                         context.includes('score: 7') ||
                         context.includes('score: 8') ||
                         context.includes('//') ||
                         context.includes('*') ||
                         context.includes('```javascript') ||
                         context.includes('```typescript');
      // Only fail if it's in a type definition context without | null
      if (!isInExample && !context.includes('| null') && !context.includes('number | null')) {
        const isTypeDef = context.includes('interface') || 
                         context.includes('type ') ||
                         context.includes('ValidationResult') ||
                         (context.includes('{') && context.includes('}'));
        if (isTypeDef) {
          assert.fail(`Found "score: number" without "| null" in type definition in API_REVIEW_AND_ALIGNMENT.md: ${match[0]}`);
        }
      }
    }
  }
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

