#!/usr/bin/env node
/**
 * Use Case 3: Playwright Integration
 * 
 * Scenario: Using custom matchers in Playwright tests
 * 
 * This script demonstrates:
 * - Creating custom matchers
 * - Using validatePage() in test context
 * - Real test workflow
 */

import { test, expect } from '@playwright/test';
import { createMatchers } from '../src/integrations/playwright.mjs';
import { skipIfNoApiKey } from '../test/helpers/api-key-check.mjs';

// Extend expect with custom matchers
createMatchers(expect);

async function runPlaywrightTests() {
  // Skip if no API keys
  if (!(await import('../test/helpers/api-key-check.mjs')).hasAnyApiKey()) {
    console.log('⚠️  Skipping: No API keys configured');
    console.log('   Set GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY in .env');
    return;
  }

  console.log('🧪 Running Playwright integration tests...\n');

  test('should validate page with custom matcher', async ({ page }) => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head><title>Test Page</title></head>
      <body>
        <h1>Hello World</h1>
        <p>This is a test page with good contrast and clear layout.</p>
      </body>
      </html>
    `;

    await page.setContent(html);
    await page.waitForLoadState('networkidle');

    // Use custom matcher
    await expect(page).toHaveVisualScore(7, 'Check for visual quality and readability');
    console.log('   ✅ Visual score matcher passed');
  });

  test('should validate accessibility with hybrid matcher', async ({ page }) => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Accessible Page</title>
        <style>
          body { font-family: Arial; padding: 20px; }
          h1 { color: #000; background: #fff; } /* Good contrast */
          button { padding: 10px; background: #007bff; color: #fff; }
        </style>
      </head>
      <body>
        <h1>Accessible Page</h1>
        <button>Click Me</button>
      </body>
      </html>
    `;

    await page.setContent(html);
    await page.waitForLoadState('networkidle');

    // Use hybrid accessibility matcher
    await expect(page).toBeAccessibleHybrid(4.5);
    console.log('   ✅ Accessibility matcher passed');
  });

  // Note: In real Playwright tests, you'd use test() from @playwright/test
  // This is a demonstration script, so we'll just show the pattern
  console.log('✅ Playwright integration examples complete!');
  console.log('   To use in real tests:');
  console.log('   1. Import createMatchers from "@arclabs561/ai-visual-test/playwright"');
  console.log('   2. Call createMatchers(expect) in your test setup');
  console.log('   3. Use expect(page).toHaveVisualScore() in your tests');
}

runPlaywrightTests().catch(console.error);

