#!/usr/bin/env node
/**
 * Playwright Setup Test
 * 
 * Verifies Playwright is properly installed and can capture screenshots.
 * This is a prerequisite for URL-based evaluation (WCAG test cases).
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

test('Playwright Setup - should be able to launch browser', async function() {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('https://example.com', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await context.close();
    assert.ok(true, 'Browser launched and page loaded successfully');
  } finally {
    await browser.close();
  }
});

test('Playwright Setup - should be able to capture screenshot', async function() {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  
  try {
    const page = await browser.newPage();
    await page.goto('https://example.com', { waitUntil: 'domcontentloaded', timeout: 10000 });
    
    const screenshotPath = join(process.cwd(), 'test-results', 'playwright-test-screenshot.png');
    const dir = dirname(screenshotPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    
    await page.screenshot({ path: screenshotPath });
    
    // Verify screenshot was created
    assert.ok(existsSync(screenshotPath), 'Screenshot should be created');
  } finally {
    await browser.close();
  }
});

test('Playwright Setup - should be able to navigate to WCAG test case URL', async function() {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  
  try {
    const page = await browser.newPage();
    // Test with a known WCAG test case URL pattern
    const testUrl = 'https://www.w3.org/WAI/standards-guidelines/act/report/testcases/';
    await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    const title = await page.title();
    assert.ok(title && title.length > 0, 'Page should have a title');
  } finally {
    await browser.close();
  }
});

