#!/usr/bin/env node
/**
 * Playwright Integration Setup Example
 * 
 * Shows how to set up and use the Playwright integration in your tests.
 * 
 * Run this to verify your Playwright integration is working:
 * node examples/playwright-setup.mjs
 */

import { test, expect } from '@playwright/test';
import { createMatchers } from '../src/integrations/playwright.mjs';
import { hasAnyApiKey, getAvailableProviders } from '../test/helpers/api-key-check.mjs';

// Extend expect with custom matchers
createMatchers(expect);

async function runSetupTest() {
  // Check for API keys
  if (!hasAnyApiKey()) {
    console.log('⚠️  No API keys configured');
    console.log('   Set GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY in .env');
    console.log('   Example will fail without API keys.\n');
    return;
  }
  
  const providers = getAvailableProviders();
  console.log(`✅ Using providers: ${providers.join(', ')}\n`);

  console.log('🧪 Running Playwright integration setup test...\n');

  // This is a demonstration - in real tests, use test() from @playwright/test
  const { chromium } = await import('playwright');
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

    console.log('1️⃣  Testing toHaveVisualScore matcher...');
    try {
      await expect(page).toHaveVisualScore(6, 'Check for visual quality');
      console.log('   ✅ toHaveVisualScore passed');
    } catch (error) {
      console.log(`   ⚠️  toHaveVisualScore: ${error.message.substring(0, 100)}...`);
    }

    console.log('\n2️⃣  Testing toBeAccessibleHybrid matcher...');
    try {
      await expect(page).toBeAccessibleHybrid(4.5);
      console.log('   ✅ toBeAccessibleHybrid passed');
    } catch (error) {
      // Hybrid validation may fail due to AI semantic concerns, which is fine
      const message = error.message || '';
      if (message.includes('Programmatic checks should pass')) {
        console.log('   ⚠️  toBeAccessibleHybrid: AI found semantic issues (programmatic checks passed)');
      } else {
        console.log(`   ⚠️  toBeAccessibleHybrid: ${error.message.substring(0, 100)}...`);
      }
    }

    console.log('\n✅ Playwright integration setup complete!');
    console.log('\n📝 To use in your Playwright tests:');
    console.log('   1. Import: import { createMatchers } from "@arclabs561/ai-visual-test/playwright";');
    console.log('   2. Setup: createMatchers(expect);');
    console.log('   3. Use: await expect(page).toHaveVisualScore(7, "Check quality");');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

runSetupTest().catch(console.error);

