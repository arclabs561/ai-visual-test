import { test } from 'node:test';
import assert from 'node:assert';
import { AccessibilityValidator } from '../../src/validators/accessibility-validator.mjs';

test('AccessibilityValidator.validateHybrid combines programmatic and semantic', async function() {
  let browser, page;
  try {
    const { chromium } = await import('playwright');
    browser = await chromium.launch();
    page = await browser.newPage();
  } catch (error) {
    if (error.message.includes('Executable doesn\'t exist') || error.message.includes('browserType.launch')) {
      console.log('   ℹ️  Playwright browsers not installed. Run: npx playwright install chromium');
      this.skip();
      return;
    }
    throw error;
  }
  
  try {
    // Create realistic test page with proper structure
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head><title>Accessibility Test Page</title></head>
        <body style="font-family: Arial; padding: 20px;">
          <h1>Test Page</h1>
          <img src="test.jpg" alt="Test image">
          <button>Click me</button>
          <p>Additional content for realistic testing.</p>
        </body>
      </html>
    `);

    const screenshotPath = 'test-results/accessibility-hybrid-test.png';
    await page.screenshot({ path: screenshotPath, fullPage: false });
    
    const validator = new AccessibilityValidator();
    const result = await validator.validateHybrid(page, screenshotPath, {});

    // Verify result structure
    assert.ok(result !== null && result !== undefined, 'Result should not be null/undefined');
    assert.strictEqual(result.method, 'hybrid', 'Should use hybrid method');
    
    // Verify programmatic results
    assert.ok('programmatic' in result, 'Result should have programmatic field');
    assert.ok(result.programmatic !== undefined, 'Should have programmatic results');
    if (result.programmatic) {
      assert.ok(typeof result.programmatic === 'object', 'Programmatic results should be an object');
    }
    
    // Verify semantic results
    assert.ok('semantic' in result, 'Result should have semantic field');
    assert.ok(result.semantic !== undefined, 'Should have semantic results');
    if (result.semantic) {
      assert.ok(typeof result.semantic === 'object', 'Semantic results should be an object');
      assert.ok('score' in result.semantic || 'enabled' in result.semantic, 
        'Semantic results should have score or enabled field');
    }
    
    // Verify unique issues
    assert.ok('uniqueIssues' in result, 'Result should have uniqueIssues field');
    assert.ok(Array.isArray(result.uniqueIssues), 'uniqueIssues should be an array');
    
    // Verify passed field (validateHybrid returns 'passed', not 'score')
    assert.ok('passed' in result, 'Result should have passed field');
    assert.ok(typeof result.passed === 'boolean', 'passed should be a boolean');
    
    // Verify issues array
    assert.ok('issues' in result, 'Result should have issues field');
    assert.ok(Array.isArray(result.issues), 'issues should be an array');
    
    // Score may be in semantic results, not at top level
    if (result.semantic && typeof result.semantic === 'object' && 'score' in result.semantic) {
      const semanticScore = result.semantic.score;
      if (semanticScore !== undefined && semanticScore !== null) {
        assert.ok(typeof semanticScore === 'number', 'Semantic score should be a number');
        assert.ok(semanticScore >= 0 && semanticScore <= 10, 
          `Semantic score should be 0-10, got ${semanticScore}`);
      }
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

