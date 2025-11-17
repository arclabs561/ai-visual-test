import { test } from 'node:test';
import assert from 'node:assert';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { testGameplay } from '../src/convenience.mjs';

test('testGameplay uses temporal preprocessing by default', async function() {
  // Skip if no Playwright
  const playwrightAvailable = existsSync(join(process.cwd(), 'node_modules', '@playwright', 'test'));
  if (!playwrightAvailable) {
    console.log('   ℹ️  Skipping - Playwright not available');
    this.skip();
    return;
  }

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

    const result = await testGameplay(page, {
      url: 'about:blank',
      goals: ['Test goal'],
      captureTemporal: true,
      fps: 2,
      duration: 2000
      // Note: useTemporalPreprocessing is now default (not needed)
    });

    // Verify temporal preprocessing was used (processedTemporalNotes should exist)
    if (result.temporalScreenshots && result.temporalScreenshots.length > 0) {
      assert.ok(result.processedTemporalNotes !== undefined, 
        'Should process temporal notes by default (temporal preprocessing enabled)');
      
      if (result.processedTemporalNotes) {
        assert.ok(Array.isArray(result.processedTemporalNotes), 
          'Processed temporal notes should be an array');
      }
    }
  } finally {
    await browser.close();
  }
});

test('testGameplay temporal preprocessing handles high activity', async function() {
  // Skip if no Playwright
  const playwrightAvailable = existsSync(join(process.cwd(), 'node_modules', '@playwright', 'test'));
  if (!playwrightAvailable) {
    console.log('   ℹ️  Skipping - Playwright not available');
    this.skip();
    return;
  }

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

    // High frequency (simulating 60Hz scenario)
    const result = await testGameplay(page, {
      url: 'about:blank',
      goals: ['Test goal'],
      captureTemporal: true,
      fps: 10, // Higher frequency
      duration: 1000
    });

    // Temporal preprocessing should handle high activity (use cache)
    if (result.temporalScreenshots && result.temporalScreenshots.length > 0) {
      assert.ok(result.processedTemporalNotes !== undefined, 
        'Should process temporal notes even at high frequency');
    }
  } finally {
    await browser.close();
  }
});

test('testGameplay temporal preprocessing handles low activity', async function() {
  // Skip if no Playwright
  const playwrightAvailable = existsSync(join(process.cwd(), 'node_modules', '@playwright', 'test'));
  if (!playwrightAvailable) {
    console.log('   ℹ️  Skipping - Playwright not available');
    this.skip();
    return;
  }

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

    // Low frequency (analysis mode)
    const result = await testGameplay(page, {
      url: 'about:blank',
      goals: ['Test goal'],
      captureTemporal: true,
      fps: 0.5, // Low frequency
      duration: 4000
    });

    // Temporal preprocessing should handle low activity (do expensive preprocessing)
    if (result.temporalScreenshots && result.temporalScreenshots.length > 0) {
      assert.ok(result.processedTemporalNotes !== undefined, 
        'Should process temporal notes at low frequency (expensive preprocessing)');
    }
  } finally {
    await browser.close();
  }
});


