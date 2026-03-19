#!/usr/bin/env node
/**
 * Use Case 3: Playwright Integration
 *
 * Using custom matchers in Playwright tests.
 *
 * NOTE: This file demonstrates the pattern. The test() blocks require
 * Playwright's test runner (`npx playwright test`), not `node`.
 * Run this script with `node` for the standalone demo at the bottom.
 *
 * Run: node examples/use-case-3-playwright-integration.mjs
 * Requires: GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY
 */

// --- Pattern for Playwright test files ---
//
// import { test, expect } from '@playwright/test';
// import { createMatchers } from '@arclabs561/ai-visual-test/playwright';
//
// createMatchers(expect);
//
// test('visual quality', async ({ page }) => {
//   await page.goto('https://example.com');
//   await expect(page).toHaveVisualScore(7, 'Check visual quality');
//   await expect(page).toBeAccessibleHybrid(4.5);
// });

// --- Standalone demo (runs with node) ---

import { createMatchers } from '@arclabs561/ai-visual-test/playwright';

async function runDemo() {
  if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY && !process.env.GROQ_API_KEY) {
    console.log('No API keys configured.');
    console.log('Set GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY in .env');
    process.exit(1);
  }

  const { chromium } = await import('playwright');
  // Playwright's expect for standalone usage
  const { expect } = await import('@playwright/test');

  createMatchers(expect);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Test Page</title>
        <style>
          body { font-family: Arial; padding: 20px; background: #fff; color: #000; }
          h1 { color: #000; background: #fff; }
          button { padding: 10px; background: #007bff; color: #fff; }
        </style>
      </head>
      <body>
        <h1>Playwright Integration Test</h1>
        <p>This page tests the Playwright custom matchers.</p>
        <button>Test Button</button>
      </body>
      </html>
    `;

    await page.setContent(html);
    await page.waitForLoadState('networkidle');

    console.log('Testing toHaveVisualScore matcher...');
    try {
      await expect(page).toHaveVisualScore(6, 'Check for visual quality');
      console.log('  PASSED');
    } catch (error) {
      console.log(`  FAILED: ${error.message.substring(0, 100)}...`);
    }

    console.log('Testing toBeAccessibleHybrid matcher...');
    try {
      await expect(page).toBeAccessibleHybrid(4.5);
      console.log('  PASSED');
    } catch (error) {
      const message = error.message || '';
      if (message.includes('Programmatic checks should pass')) {
        console.log('  AI found semantic issues (programmatic checks passed)');
      } else {
        console.log(`  FAILED: ${error.message.substring(0, 100)}...`);
      }
    }

    console.log();
    console.log('To use in Playwright tests:');
    console.log('  1. import { createMatchers } from "@arclabs561/ai-visual-test/playwright"');
    console.log('  2. createMatchers(expect)');
    console.log('  3. await expect(page).toHaveVisualScore(7, "prompt")');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runDemo().catch(console.error);
