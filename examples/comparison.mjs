#!/usr/bin/env node
/**
 * Before/After Screenshot Comparison
 *
 * Demonstrates validateComparison() for comparing two screenshots.
 * Use this to verify that a redesign, fix, or deploy didn't break anything.
 *
 * Run: node examples/comparison.mjs
 * Requires: GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY
 */

import { validateComparison } from '@arclabs561/ai-visual-test';

async function demo() {
  if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY && !process.env.GROQ_API_KEY) {
    console.log('No API keys configured.');
    console.log('Set GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY in .env');
    process.exit(1);
  }

  const { chromium } = await import('playwright');
  const path = await import('path');
  const os = await import('os');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // "Before" -- page with low-contrast text
  const beforeHtml = `
    <!DOCTYPE html>
    <html>
    <head><title>Before</title>
    <style>
      body { font-family: Arial; padding: 20px; background: #fff; }
      h1 { color: #333; }
      .help { color: #aaa; font-size: 14px; } /* low contrast */
      button { padding: 8px 16px; background: #ccc; color: #666; border: none; }
    </style>
    </head>
    <body>
      <h1>Settings</h1>
      <p class="help">Adjust your preferences below.</p>
      <button>Save</button>
    </body>
    </html>
  `;

  await page.setContent(beforeHtml);
  await page.waitForLoadState('networkidle');
  const beforePath = path.join(os.tmpdir(), `before-${Date.now()}.png`);
  await page.screenshot({ path: beforePath });

  // "After" -- same page with contrast fixed
  const afterHtml = `
    <!DOCTYPE html>
    <html>
    <head><title>After</title>
    <style>
      body { font-family: Arial; padding: 20px; background: #fff; }
      h1 { color: #111; }
      .help { color: #555; font-size: 14px; } /* fixed contrast */
      button { padding: 8px 16px; background: #007bff; color: #fff; border: none; }
    </style>
    </head>
    <body>
      <h1>Settings</h1>
      <p class="help">Adjust your preferences below.</p>
      <button>Save</button>
    </body>
    </html>
  `;

  await page.setContent(afterHtml);
  await page.waitForLoadState('networkidle');
  const afterPath = path.join(os.tmpdir(), `after-${Date.now()}.png`);
  await page.screenshot({ path: afterPath });

  await browser.close();

  // Compare
  console.log('Comparing before/after screenshots\n');

  const result = await validateComparison(
    beforePath,
    afterPath,
    'Did the redesign fix the contrast issues? Is the button more visible?'
  );

  console.log(`Score: ${result.score}/10`);
  console.log(`Issues: ${result.issues?.length || 0}`);
  if (result.issues?.length > 0) {
    console.log(`  - ${result.issues.join('\n  - ')}`);
  }
  console.log(`Reasoning: ${result.reasoning?.substring(0, 200)}`);
  console.log();
  console.log('Done.');
}

demo().catch(console.error);
