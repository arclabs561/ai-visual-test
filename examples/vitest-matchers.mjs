#!/usr/bin/env node
/**
 * Vitest/Jest Matchers Setup
 *
 * Demonstrates how to set up and use the Vitest/Jest matchers.
 * This file shows the pattern -- in a real project, put the setup
 * in vitest.setup.js and the matchers in your test files.
 *
 * Run: node examples/vitest-matchers.mjs
 * Requires: GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY
 * Requires: a screenshot file (creates a test one if missing)
 */

import { validateScreenshot } from '@arclabs561/ai-visual-test';

// -- Pattern for vitest.setup.js --
//
// import { expect } from 'vitest';
// import { createMatchers } from '@arclabs561/ai-visual-test/vitest';
// createMatchers(expect);
//
// -- Pattern for test files --
//
// test('page passes visual check', async () => {
//   await expect('screenshot.png').toPassVisualCheck('Login form is accessible');
// });
//
// test('score meets threshold', async () => {
//   await expect('screenshot.png').toHaveVisualScore(7, 'Check quality');
// });
//
// test('redesign preserved layout', async () => {
//   await expect('before.png').toMatchVisually('after.png', 'Layout equivalent');
// });

async function demo() {
  if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY && !process.env.GROQ_API_KEY) {
    console.log('No API keys configured.');
    console.log('Set GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY in .env');
    process.exit(1);
  }

  // Create a test screenshot using Playwright
  const { chromium } = await import('playwright');
  const path = await import('path');
  const os = await import('os');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const html = `
    <!DOCTYPE html>
    <html>
    <head><title>Test</title>
    <style>
      body { font-family: Arial; padding: 20px; background: #fff; color: #000; }
      h1 { margin-bottom: 10px; }
      .form-group { margin-bottom: 12px; }
      label { display: block; margin-bottom: 4px; }
      input { padding: 6px; width: 250px; border: 1px solid #ccc; }
      button { padding: 8px 16px; background: #007bff; color: #fff; border: none; }
    </style>
    </head>
    <body>
      <h1>Login</h1>
      <div class="form-group"><label for="user">Username</label><input id="user" type="text" /></div>
      <div class="form-group"><label for="pass">Password</label><input id="pass" type="password" /></div>
      <button type="submit">Sign In</button>
    </body>
    </html>
  `;

  await page.setContent(html);
  await page.waitForLoadState('networkidle');

  const screenshotPath = path.join(os.tmpdir(), `vitest-demo-${Date.now()}.png`);
  await page.screenshot({ path: screenshotPath });
  await browser.close();

  // Demonstrate what the matchers do under the hood
  console.log('Vitest/Jest matchers demo\n');

  console.log('toPassVisualCheck -- validates screenshot against a prompt');
  const result1 = await validateScreenshot(screenshotPath, 'Login form is complete and accessible');
  console.log(`  Score: ${result1.score}/10`);
  console.log(`  Issues: ${result1.issues?.length || 0}`);
  console.log(`  Pass (score >= 7): ${(result1.score ?? 0) >= 7}`);
  console.log();

  console.log('toHaveVisualScore -- checks score meets a threshold');
  const result2 = await validateScreenshot(screenshotPath, 'Check visual quality');
  console.log(`  Score: ${result2.score}/10`);
  console.log(`  Threshold: 7`);
  console.log(`  Pass: ${(result2.score ?? 0) >= 7}`);
  console.log();

  console.log('Done.');
  console.log('In your project:');
  console.log('  1. npm install @arclabs561/ai-visual-test');
  console.log('  2. In vitest.setup.js: createMatchers(expect)');
  console.log('  3. In tests: await expect("shot.png").toPassVisualCheck("prompt")');
}

demo().catch(console.error);
