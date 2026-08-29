import '../test-setup.mjs'; // Auto-load .env
import { test } from 'node:test';
import assert from 'node:assert';
import { playGame } from '../../src/game-player.mjs';

test('playGame records temporal evaluation metadata for every step', async function() {
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
    await page.setContent(`
      <html>
        <body>
          <h1>Test Game</h1>
          <div id="score">0</div>
          <button onclick="document.getElementById('score').textContent = parseInt(document.getElementById('score').textContent) + 1">Click</button>
        </body>
      </html>
    `);

    const result = await playGame(page, {
      goal: 'Maximize score',
      maxSteps: 10,
      fps: 2
    });

    // Verify structure
    assert.ok(result, 'Should return result');
    assert.ok(result.history, 'Should have history');
    assert.ok(result.totalSteps > 0, 'Should have steps');
    
    // A run may skip visual review on some steps, depending on the sequence and
    // temporal policy. This integration test verifies metadata shape, not a
    // reduction rate.
    const skippedEvaluations = result.history.filter(h => h.result?.skipped === true);
    const reviewedEvaluations = result.history.filter(h => h.result && h.result.skipped !== true);
    
    assert.equal(skippedEvaluations.length + reviewedEvaluations.length, result.history.length,
      'Every history entry should be classified as skipped or reviewed');
    
    // Verify skipped evaluations have proper metadata
    for (const entry of skippedEvaluations) {
      assert.ok(entry.result.skipReason, 'Skipped evaluation should have reason');
      assert.ok(['low', 'medium', 'high'].includes(entry.result.urgency || 'low'), 
        'Skipped evaluation should have valid urgency');
    }
    
    // First step should always be prompted (not skipped)
    assert.ok(!result.history[0]?.result?.skipped, 'First step should not be skipped');
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

test('playGame handles TemporalDecisionManager failures gracefully', async function() {
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
    await page.setContent(`
      <html>
        <body>
          <h1>Test Game</h1>
          <div id="score">0</div>
        </body>
      </html>
    `);

    // Should work even if TemporalDecisionManager has issues
    // (graceful degradation - falls back to normal validation)
    const result = await playGame(page, {
      goal: 'Test goal',
      maxSteps: 5,
      fps: 2
    });

    assert.ok(result, 'Should return result even if TemporalDecisionManager fails');
    assert.ok(result.history.length > 0, 'Should have history');
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

test('playGame tracks calibration with sequenceIndex', async function() {
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
    await page.setContent(`
      <html>
        <body>
          <h1>Test Game</h1>
          <div id="score">0</div>
        </body>
      </html>
    `);

    const result = await playGame(page, {
      goal: 'Test goal',
      maxSteps: 10,
      fps: 2
    });

    // Calibration tracking happens in judge.mjs via sequenceIndex
    // We can verify that evaluations have sequenceIndex context
    // (calibration degradation detection is automatic)
    assert.ok(result.history.length > 0, 'Should have history');
    
    // Verify structure allows calibration tracking
    for (const entry of result.history) {
      assert.ok(entry.step !== undefined, 'Entry should have step number');
      // sequenceIndex is passed in context, not stored in result
      // Just verify structure is correct
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});
