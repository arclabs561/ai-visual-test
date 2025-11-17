import { test } from 'node:test';
import assert from 'node:assert';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { AccessibilityValidator } from '../src/validators/accessibility-validator.mjs';

test('AccessibilityValidator.validateHybrid combines programmatic and semantic', async () => {
  // Skip if no Playwright
  const playwrightAvailable = existsSync(join(process.cwd(), 'node_modules', '@playwright', 'test'));
  if (!playwrightAvailable) {
    test.skip('Playwright not available');
    return;
  }

  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    await page.setContent(`
      <html>
        <body>
          <h1>Test Page</h1>
          <img src="test.jpg" alt="Test image">
          <button>Click me</button>
        </body>
      </html>
    `);

    const screenshotPath = await page.screenshot({ path: 'test-screenshot.png' });
    
    const validator = new AccessibilityValidator();
    const result = await validator.validateHybrid(page, screenshotPath, {});

    assert.ok(result.method === 'hybrid', 'Should use hybrid method');
    assert.ok(result.programmatic !== undefined, 'Should have programmatic results');
    assert.ok(result.semantic !== undefined, 'Should have semantic results');
    assert.ok(result.uniqueIssues !== undefined, 'Should have unique issues');
  } finally {
    await browser.close();
  }
});

