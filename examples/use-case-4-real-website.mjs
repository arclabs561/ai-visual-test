#!/usr/bin/env node
/**
 * Use Case 4: Real Website Testing
 * 
 * Scenario: Testing a real website (e.g., a public URL) for visual quality
 * 
 * This script demonstrates:
 * - Testing real websites
 * - Using validatePage() with real URLs
 * - Handling network errors gracefully
 */

import { chromium } from 'playwright';
import { validatePage } from '../src/index.mjs';

async function testRealWebsite() {
  // Check for API keys (informational only - examples will work if keys are set)
  const { hasAnyApiKey, getAvailableProviders } = await import('../test/helpers/api-key-check.mjs');
  if (!hasAnyApiKey()) {
    console.log('⚠️  No API keys configured');
    console.log('   Set GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY in .env');
    console.log('   Example will fail without API keys.\n');
    return;
  }
  const providers = getAvailableProviders();
  console.log(`✅ Using providers: ${providers.join(', ')}\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    // Test a simple, reliable website
    const url = 'https://example.com';
    console.log(`🌐 Testing real website: ${url}\n`);

    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    console.log('1️⃣  Visual Quality Check');
    const visualResult = await validatePage(page, 'Evaluate the visual design: layout, typography, spacing, color scheme');
    console.log(`   Score: ${visualResult.score}/10`);
    console.log(`   Issues: ${visualResult.issues?.length || 0}`);
    if (visualResult.issues?.length > 0) {
      // Issues are now normalized to strings by the library
      console.log(`   - ${visualResult.issues.slice(0, 3).join('\n   - ')}`);
    }
    console.log();

    console.log('2️⃣  Accessibility Check');
    const a11yResult = await validatePage(page, 'Check accessibility: contrast, labels, keyboard navigation, semantic HTML');
    console.log(`   Score: ${a11yResult.score}/10`);
    console.log(`   Issues: ${a11yResult.issues?.length || 0}`);
    if (a11yResult.issues?.length > 0) {
      // Issues are now normalized to strings by the library
      console.log(`   - ${a11yResult.issues.slice(0, 2).join('\n   - ')}`);
    }
    console.log();

    console.log('✅ Real website test complete!');
    console.log(`   Visual quality: ${visualResult.score}/10`);
    console.log(`   Accessibility: ${a11yResult.score}/10`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.details) {
      console.error('   Details:', error.details);
    }
  } finally {
    await browser.close();
  }
}

testRealWebsite().catch(console.error);

