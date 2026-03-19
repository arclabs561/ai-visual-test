#!/usr/bin/env node
/**
 * Use Case 4: Real Website Testing
 *
 * Testing a real website (public URL) for visual quality and accessibility.
 *
 * Demonstrates:
 * - validatePage() with real URLs
 * - Network error handling
 *
 * Run: node examples/use-case-4-real-website.mjs
 * Requires: GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY
 */

import { validatePage } from '@arclabs561/ai-visual-test';

async function testRealWebsite() {
  if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY && !process.env.GROQ_API_KEY) {
    console.log('No API keys configured.');
    console.log('Set GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY in .env');
    process.exit(1);
  }

  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    const url = 'https://example.com';
    console.log(`Testing: ${url}\n`);

    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    console.log('Visual Quality Check');
    const visualResult = await validatePage(page, 'Evaluate the visual design: layout, typography, spacing, color scheme');
    console.log(`  Score: ${visualResult.score}/10`);
    console.log(`  Issues: ${visualResult.issues?.length || 0}`);
    if (visualResult.issues?.length > 0) {
      console.log(`  - ${visualResult.issues.slice(0, 3).join('\n  - ')}`);
    }
    console.log();

    console.log('Accessibility Check');
    const a11yResult = await validatePage(page, 'Check accessibility: contrast, labels, keyboard navigation, semantic HTML');
    console.log(`  Score: ${a11yResult.score}/10`);
    console.log(`  Issues: ${a11yResult.issues?.length || 0}`);
    if (a11yResult.issues?.length > 0) {
      console.log(`  - ${a11yResult.issues.slice(0, 2).join('\n  - ')}`);
    }
    console.log();

    console.log('Done.');
    console.log(`  Visual quality: ${visualResult.score}/10`);
    console.log(`  Accessibility: ${a11yResult.score}/10`);

  } catch (error) {
    console.error('Error:', error.message);
    if (error.details) {
      console.error('  Details:', error.details);
    }
    process.exit(1);
  } finally {
    await browser.close();
  }
}

testRealWebsite().catch(console.error);
