import { test } from 'node:test';
import assert from 'node:assert';
import { detectActionHallucination, batchDetectActionHallucinations } from '../../src/utils/action-hallucination-detector.mjs';

test('detectActionHallucination detects missing selector', async function() {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    await page.setContent(`
      <html>
        <body>
          <h1>Test Page</h1>
        </body>
      </html>
    `);

    const action = { type: 'click' }; // Missing selector
    const result = await detectActionHallucination(action, page);
    
    assert.ok(result.hasHallucination, 'Should detect hallucination for missing selector');
    assert.ok(result.confidence >= 0.9, 'Should have high confidence');
  } finally {
    await browser.close();
  }
});

test('detectActionHallucination detects non-existent element', async function() {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    await page.setContent(`
      <html>
        <body>
          <h1>Test Page</h1>
        </body>
      </html>
    `);

    const action = { type: 'click', selector: '#non-existent-button' };
    const result = await detectActionHallucination(action, page);
    
    assert.ok(result.hasHallucination, 'Should detect hallucination for non-existent element');
    assert.ok(result.elementExists === false, 'Should detect element does not exist');
    assert.ok(result.confidence >= 0.9, 'Should have high confidence');
  } finally {
    await browser.close();
  }
});

test('detectActionHallucination verifies existing element', async function() {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    await page.setContent(`
      <html>
        <body>
          <h1>Test Page</h1>
          <button id="submit-button">Submit</button>
        </body>
      </html>
    `);

    const action = { type: 'click', selector: '#submit-button' };
    const result = await detectActionHallucination(action, page);
    
    assert.ok(!result.hasHallucination, 'Should not detect hallucination for existing element');
    assert.ok(result.elementExists === true, 'Should verify element exists');
    assert.ok(result.elementVisible === true, 'Should verify element is visible');
    assert.ok(result.elementEnabled === true, 'Should verify element is enabled');
  } finally {
    await browser.close();
  }
});

test('detectActionHallucination handles keyboard actions', async function() {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    await page.setContent(`
      <html>
        <body>
          <h1>Test Page</h1>
        </body>
      </html>
    `);

    const action = { type: 'keyboard', key: 'ArrowRight' };
    const result = await detectActionHallucination(action, page);
    
    // Keyboard actions are harder to verify, but should not report hallucination
    assert.ok(!result.hasHallucination || result.confidence < 0.7, 
      'Should not report high-confidence hallucination for keyboard actions');
  } finally {
    await browser.close();
  }
});

test('batchDetectActionHallucinations aggregates results', async function() {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    await page.setContent(`
      <html>
        <body>
          <h1>Test Page</h1>
          <button id="button1">Button 1</button>
        </body>
      </html>
    `);

    const actions = [
      { type: 'click', selector: '#button1' }, // Exists
      { type: 'click', selector: '#non-existent' }, // Doesn't exist
      { type: 'click' } // Missing selector
    ];
    
    const result = await batchDetectActionHallucinations(actions, page);
    
    assert.ok(result.total === 3, 'Should process all actions');
    assert.ok(result.hallucinationCount >= 2, 'Should detect at least 2 hallucinations');
    assert.ok(result.hallucinationRate < 1.0, 'Should not have 100% hallucination rate');
    assert.ok(result.recommendation, 'Should provide recommendation');
  } finally {
    await browser.close();
  }
});


