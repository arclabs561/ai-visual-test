/**
 * Tests for playwright helpers
 */

import '../test-setup.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  getPlaywrightChromium,
  isPlaywrightAvailable,
  createMockPage,
  getPlaywrightPage
} from '../../src/helpers/playwright.mjs';

describe('Playwright Helpers', () => {
  describe('getPlaywrightChromium', () => {
    it('should return object with chromium and available', async () => {
      const result = await getPlaywrightChromium();
      
      assert.ok(result);
      assert.strictEqual(typeof result.available, 'boolean');
      // chromium might be null if not installed
      assert.ok(result.chromium === null || typeof result.chromium === 'object');
    });

    it('should handle missing playwright gracefully', async () => {
      // This test verifies the function doesn't throw
      // If playwright is installed, available will be true
      // If not, available will be false
      const result = await getPlaywrightChromium();
      
      if (!result.available) {
        assert.strictEqual(result.chromium, null);
        assert.ok(result.error);
        assert.ok(result.error.includes('Playwright not installed'));
      }
    });
  });

  describe('isPlaywrightAvailable', () => {
    it('should return boolean', async () => {
      const result = await isPlaywrightAvailable();
      
      assert.strictEqual(typeof result, 'boolean');
    });
  });

  describe('createMockPage', () => {
    it('should create mock page object', () => {
      const mockPage = createMockPage();
      
      assert.ok(mockPage);
      assert.strictEqual(typeof mockPage.goto, 'function');
      assert.strictEqual(typeof mockPage.screenshot, 'function');
      assert.strictEqual(typeof mockPage.waitForLoadState, 'function');
      assert.strictEqual(typeof mockPage.waitForTimeout, 'function');
      assert.strictEqual(typeof mockPage.evaluate, 'function');
      assert.strictEqual(typeof mockPage.close, 'function');
    });

    it('should return mock screenshot path', async () => {
      const mockPage = createMockPage();
      const result = await mockPage.screenshot();
      
      assert.ok(result);
      assert.strictEqual(result.path, 'mock-screenshot.png');
    });
  });

  describe('getPlaywrightPage', () => {
    it('should return page object with isMock flag', async () => {
      const result = await getPlaywrightPage();
      
      assert.ok(result);
      assert.strictEqual(typeof result.isMock, 'boolean');
      assert.ok(result.page);
      
      // If mock, browser should be null
      if (result.isMock) {
        assert.strictEqual(result.browser, null);
      } else {
        // If real playwright, should have browser
        assert.ok(result.browser);
        // Clean up
        if (result.browser) {
          await result.browser.close();
        }
      }
    });

    it('should accept options', async () => {
      const result = await getPlaywrightPage({
        browserOptions: { headless: true }
      });
      
      assert.ok(result);
      assert.ok(result.page);
      
      // Clean up if real browser
      if (result.browser) {
        await result.browser.close();
      }
    });
  });
});

