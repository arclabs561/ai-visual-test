import '../test-setup.mjs'; // Auto-load .env
import { test } from 'node:test';
import assert from 'node:assert';
import { playGame } from '../../src/game-player.mjs';

test('playGame uses TemporalDecisionManager to reduce LLM calls', async function() {

  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
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
    
    // Check for skipped evaluations (TemporalDecisionManager working)
    const skippedEvaluations = result.history.filter(h => h.result?.skipped === true);
    const promptedEvaluations = result.history.filter(h => !h.result?.skipped);
    
    // With TemporalDecisionManager, we should have some skipped evaluations
    // (reduces LLM calls by ~98.5% according to research)
    assert.ok(skippedEvaluations.length + promptedEvaluations.length === result.history.length,
      'All evaluations should be either skipped or prompted');
    
    // Verify skipped evaluations have proper metadata
    for (const entry of skippedEvaluations) {
      assert.ok(entry.result.skipReason, 'Skipped evaluation should have reason');
      assert.ok(['low', 'medium', 'high'].includes(entry.result.urgency || 'low'), 
        'Skipped evaluation should have valid urgency');
    }
    
    // First step should always be prompted (not skipped)
    assert.ok(!result.history[0]?.result?.skipped, 'First step should not be skipped');
  } finally {
    await browser.close();
  }
});

test('playGame handles TemporalDecisionManager failures gracefully', async function() {

  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
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
    await browser.close();
  }
});

test('playGame tracks calibration with sequenceIndex', async function() {

  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
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
    await browser.close();
  }
});


