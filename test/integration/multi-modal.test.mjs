/**
 * Tests for multi-modal.mjs
 * Requires mocking Playwright Page objects
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { 
  extractRenderedCode, 
  captureTemporalScreenshots,
  multiPerspectiveEvaluation,
  multiModalValidation
} from '../../src/multi-modal.mjs';
import { ValidationError } from '../../src/errors.mjs';
import { createMockPage } from '../helpers/mock-page.mjs';
import { validateScreenshot } from '../../src/judge.mjs';

describe('extractRenderedCode', () => {
  it('should extract rendered code from mock page', async () => {
    const mockPage = createMockPage({
      html: '<html><body><div id="test">Content</div></body></html>'
    });
    
    const result = await extractRenderedCode(mockPage);
    
    assert.ok(typeof result === 'object');
    assert.ok('html' in result);
    assert.ok('criticalCSS' in result);
    assert.ok('domStructure' in result);
    assert.ok('timestamp' in result);
  });

  it('should throw ValidationError for invalid page object', async () => {
    await assert.rejects(
      () => extractRenderedCode(null),
      ValidationError
    );
    
    await assert.rejects(
      () => extractRenderedCode({}),
      ValidationError
    );
  });
});

describe('captureTemporalScreenshots', () => {
  it('should capture temporal screenshots', async () => {
    const mockPage = createMockPage();
    
    const screenshots = await captureTemporalScreenshots(mockPage, 2, 1000);
    
    assert.ok(Array.isArray(screenshots));
    assert.ok(screenshots.length > 0);
    assert.ok(screenshots[0].path);
    assert.ok(typeof screenshots[0].frame === 'number');
    assert.ok(typeof screenshots[0].timestamp === 'number');
  });

  it('should respect fps and duration', async () => {
    const mockPage = createMockPage();
    
    const screenshots = await captureTemporalScreenshots(mockPage, 5, 1000);
    
    // 5 fps for 1 second = 5 frames
    assert.ok(screenshots.length >= 4 && screenshots.length <= 6);
  });

  it('accepts the options-object capture form', async () => {
    const mockPage = createMockPage();

    const screenshots = await captureTemporalScreenshots(mockPage, {
      fps: 2,
      duration: 1000,
      outputDir: 'object-form-results'
    });

    assert.strictEqual(screenshots.length, 2);
    assert.match(screenshots[0].path, /^object-form-results\/temporal-/);
  });

  it('should throw ValidationError for invalid page object', async () => {
    await assert.rejects(
      () => captureTemporalScreenshots(null),
      ValidationError
    );
  });

  it('rejects non-finite and non-positive capture timing', async () => {
    const mockPage = createMockPage();

    for (const options of [
      { fps: 0 },
      { fps: Number.POSITIVE_INFINITY },
      { duration: 0 },
      { duration: Number.NaN }
    ]) {
      await assert.rejects(
        () => captureTemporalScreenshots(mockPage, options),
        ValidationError
      );
    }
  });

  it('does not pass JPEG-only quality to PNG screenshots', async () => {
    const screenshotOptions = [];
    const page = {
      screenshot: async (options) => { screenshotOptions.push(options); },
      waitForTimeout: async () => {}
    };

    await captureTemporalScreenshots(page, {
      fps: 60,
      duration: 20,
      optimizeForSpeed: true
    });

    assert.strictEqual(screenshotOptions.length, 1);
    assert.strictEqual(screenshotOptions[0].type, 'png');
    assert.ok(!('quality' in screenshotOptions[0]));
  });

  it('supports screenshot-only page duck types with a native timer fallback', async () => {
    const screenshotOptions = [];
    const page = {
      screenshot: async (options) => { screenshotOptions.push(options); }
    };

    const screenshots = await captureTemporalScreenshots(page, { fps: 1000, duration: 1 });

    assert.strictEqual(screenshots.length, 1);
    assert.strictEqual(screenshotOptions.length, 1);
  });

  it('uses distinct output paths for same-tick parallel captures', async () => {
    const screenshotOptions = [];
    const page = {
      screenshot: async (options) => { screenshotOptions.push(options); },
      waitForTimeout: async () => {}
    };

    const [first, second] = await Promise.all([
      captureTemporalScreenshots(page, { fps: 1000, duration: 1 }),
      captureTemporalScreenshots(page, { fps: 1000, duration: 1 })
    ]);

    assert.strictEqual(first.length, 1);
    assert.strictEqual(second.length, 1);
    assert.strictEqual(new Set(screenshotOptions.map(options => options.path)).size, 2);
  });
});

describe('multiPerspectiveEvaluation', () => {
  it('should evaluate from multiple perspectives', async () => {
    const mockValidateFn = async (path, prompt, context) => {
      return {
        enabled: false,
        provider: 'gemini',
        score: 8,
        issues: [],
        assessment: 'Good'
      };
    };
    
    const result = await multiPerspectiveEvaluation(
      mockValidateFn,
      'test-screenshot.png',
      { html: '<html></html>' },
      {},
      [
        {
          name: 'Test Persona',
          perspective: 'Test perspective',
          focus: ['test']
        }
      ]
    );
    
    assert.ok(Array.isArray(result));
    assert.ok(result.length > 0);
    assert.ok(result[0].persona);
    assert.ok(result[0].evaluation);
  });

  it('should use default personas if not provided', async () => {
    const mockValidateFn = async (path, prompt, context) => {
      return {
        enabled: false,
        provider: 'gemini',
        score: 8,
        issues: [],
        assessment: 'Good'
      };
    };
    
    const result = await multiPerspectiveEvaluation(
      mockValidateFn,
      'test-screenshot.png',
      { html: '<html></html>' }
    );
    
    assert.ok(Array.isArray(result));
    assert.ok(result.length >= 3); // At least 3 default personas
  });

  it('should throw ValidationError for invalid validate function', async () => {
    await assert.rejects(
      () => multiPerspectiveEvaluation(null, 'test.png', {}),
      ValidationError
    );
  });
});

describe('multiModalValidation', () => {
  it('should perform multi-modal validation', async () => {
    const mockPage = createMockPage();
    const mockValidateFn = async (path, prompt, context) => {
      return {
        enabled: false,
        provider: 'gemini',
        score: 8,
        issues: [],
        assessment: 'Good'
      };
    };
    
    const result = await multiModalValidation(
      mockValidateFn,
      mockPage,
      'test-validation',
      {
        fps: 1,
        duration: 500,
        captureCode: true,
        captureState: true,
        multiPerspective: false
      }
    );
    
    assert.ok(typeof result === 'object');
    assert.ok('screenshotPath' in result);
    assert.ok('renderedCode' in result);
    assert.ok('gameState' in result);
  });

  it('should throw ValidationError for invalid page object', async () => {
    const mockValidateFn = async () => ({ enabled: false });
    
    await assert.rejects(
      () => multiModalValidation(mockValidateFn, null, 'test'),
      ValidationError
    );
  });
});
