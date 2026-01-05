#!/usr/bin/env node
/**
 * Use Case 1: Enterprise QA Team
 * 
 * Scenario: Testing a payment form for accessibility and visual bugs
 * 
 * This script demonstrates:
 * - Using validatePage() for Playwright integration
 * - Hybrid accessibility validation
 * - Real-world error handling
 */

import { chromium } from 'playwright';
import { validatePage, validateAccessibilityHybrid } from '../src/index.mjs';
import { skipIfNoApiKey } from '../test/helpers/api-key-check.mjs';

async function testPaymentForm() {
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
    // Create a simple payment form HTML
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payment Form</title>
        <style>
          body { font-family: Arial; padding: 20px; }
          .form-group { margin-bottom: 15px; }
          label { display: block; margin-bottom: 5px; color: #333; }
          input { padding: 8px; width: 300px; border: 1px solid #ccc; }
          button { padding: 10px 20px; background: #007bff; color: white; border: none; cursor: pointer; }
          .error { color: #666; font-size: 12px; } /* Low contrast - intentional bug */
        </style>
      </head>
      <body>
        <h1>Payment Form</h1>
        <form>
          <div class="form-group">
            <label for="name">Name</label>
            <input type="text" id="name" name="name" />
          </div>
          <div class="form-group">
            <label for="email">Email</label>
            <input type="email" id="email" name="email" />
          </div>
          <div class="form-group">
            <label for="amount">Amount</label>
            <input type="number" id="amount" name="amount" />
            <span class="error">Enter amount in dollars</span>
          </div>
          <button type="submit">Pay Now</button>
        </form>
      </body>
      </html>
    `;

    await page.setContent(html);
    await page.waitForLoadState('networkidle');

    console.log('📸 Testing payment form...\n');

    // Test 1: Basic visual validation
    console.log('1️⃣  Basic Visual Validation');
    const visualResult = await validatePage(page, 'Check for visual bugs: overlapping elements, misaligned text, color issues');
    console.log(`   Score: ${visualResult.score}/10`);
    console.log(`   Issues: ${visualResult.issues?.length || 0}`);
    if (visualResult.issues?.length > 0) {
      console.log(`   - ${visualResult.issues.slice(0, 3).join('\n   - ')}`);
    }
    console.log();

    // Test 2: Hybrid accessibility validation
    console.log('2️⃣  Hybrid Accessibility Validation');
    const tempDir = (await import('os')).tmpdir();
    const path = (await import('path'));
    const screenshotPath = path.join(tempDir, `a11y-${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath });
    
    const a11yResult = await validateAccessibilityHybrid(page, screenshotPath, 4.5);
    console.log(`   Passed: ${a11yResult.passed}`);
    console.log(`   Programmatic Issues: ${a11yResult.programmaticData?.contrast?.violations?.length || 0} contrast, ${a11yResult.programmaticData?.keyboard?.violations?.length || 0} keyboard`);
    console.log(`   Visual Issues: ${a11yResult.issues?.length || 0}`);
    if (a11yResult.uniqueIssues?.length > 0) {
      // Issues are now normalized to strings by the library
      console.log(`   - ${a11yResult.uniqueIssues.slice(0, 3).join('\n   - ')}`);
    }
    console.log();

    // Test 3: Specific accessibility check
    console.log('3️⃣  Specific Accessibility Check');
    const contrastResult = await validatePage(page, 'Check text contrast ratios. Identify any text with contrast ratio below 4.5:1');
    console.log(`   Score: ${contrastResult.score}/10`);
    if (contrastResult.issues?.length > 0) {
      console.log(`   Issues found: ${contrastResult.issues.length}`);
      console.log(`   - ${contrastResult.issues.slice(0, 2).join('\n   - ')}`);
    }
    console.log();

    console.log('✅ Enterprise QA test complete!');
    console.log(`   Visual bugs detected: ${visualResult.issues?.length || 0}`);
    console.log(`   Accessibility issues: ${a11yResult.uniqueIssues?.length || 0}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.details) {
      console.error('   Details:', error.details);
    }
  } finally {
    await browser.close();
  }
}

testPaymentForm().catch(console.error);

