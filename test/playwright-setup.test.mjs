#!/usr/bin/env node
/**
 * Playwright Setup Test
 * 
 * Verifies Playwright is properly installed and can capture screenshots.
 * This is a prerequisite for URL-based evaluation (WCAG test cases).
 */

import { test } from '@playwright/test';
import { existsSync } from 'fs';
import { join } from 'path';

test.describe('Playwright Setup', () => {
  test('should be able to launch browser', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('https://example.com');
    await context.close();
  });

  test('should be able to capture screenshot', async ({ page }) => {
    await page.goto('https://example.com');
    const screenshotPath = join(process.cwd(), 'evaluation', 'temp-screenshots', 'test-screenshot.png');
    await page.screenshot({ path: screenshotPath });
    
    // Verify screenshot was created
    if (!existsSync(screenshotPath)) {
      throw new Error('Screenshot was not created');
    }
  });

  test('should be able to navigate to WCAG test case URL', async ({ page }) => {
    // Test with a known WCAG test case URL pattern
    const testUrl = 'https://www.w3.org/WAI/standards-guidelines/act/report/testcases/';
    await page.goto(testUrl, { waitUntil: 'networkidle', timeout: 30000 });
    
    const title = await page.title();
    if (!title || title.length === 0) {
      throw new Error('Page did not load correctly');
    }
  });
});

