#!/usr/bin/env node
/**
 * Test Fast-Changing Pages
 * 
 * Tests system capabilities with:
 * - High frame rate content (60fps, 120fps)
 * - Rapidly changing pages
 * - Render change detection
 * - Adaptive frame rate
 */

import { 
  captureTemporalScreenshots,
  captureOnRenderChanges,
  captureAdaptiveTemporalScreenshots,
  detectRenderChanges,
  calculateOptimalFPS
} from '../src/index.mjs';
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const RESULTS_DIR = join(process.cwd(), 'evaluation', 'results');
if (!existsSync(RESULTS_DIR)) {
  mkdirSync(RESULTS_DIR, { recursive: true });
}

// Fast-changing test pages
const FAST_CHANGING_PAGES = [
  {
    name: 'CSS Animations (60fps)',
    url: 'data:text/html,<html><head><style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } } .spinner { animation: spin 1s linear infinite; width: 100px; height: 100px; background: red; }</style></head><body><div class="spinner"></div></body></html>',
    description: 'CSS animation at 60fps',
    expectedFPS: 60,
    changeType: 'animation'
  },
  {
    name: 'Rapid DOM Changes',
    url: 'data:text/html,<html><head><script>setInterval(() => { document.body.innerHTML = "<div>Time: " + Date.now() + "</div>"; }, 16);</script></head><body><div>Loading...</div></body></html>',
    description: 'DOM changes every 16ms (~60fps)',
    expectedFPS: 60,
    changeType: 'dom'
  },
  {
    name: 'Canvas Animation (60fps)',
    url: 'data:text/html,<html><body><canvas id="canvas" width="800" height="600"></canvas><script>const canvas = document.getElementById("canvas"); const ctx = canvas.getContext("2d"); let angle = 0; function animate() { ctx.clearRect(0, 0, 800, 600); ctx.fillStyle = "red"; ctx.beginPath(); ctx.arc(400 + Math.cos(angle) * 200, 300 + Math.sin(angle) * 200, 50, 0, Math.PI * 2); ctx.fill(); angle += 0.1; requestAnimationFrame(animate); } animate();</script></body></html>',
    description: 'Canvas animation using requestAnimationFrame',
    expectedFPS: 60,
    changeType: 'canvas'
  },
  {
    name: 'High Frequency Updates (120fps)',
    url: 'data:text/html,<html><head><script>setInterval(() => { document.body.innerHTML = "<div>Frame: " + (window.frameCount = (window.frameCount || 0) + 1) + "</div>"; }, 8);</script></head><body><div>Loading...</div></body></html>',
    description: 'Updates every 8ms (~120fps)',
    expectedFPS: 120,
    changeType: 'dom'
  }
];

/**
 * Test temporal screenshot capture at different frame rates
 */
async function testTemporalCapture(page, testPage, fps) {
  console.log(`   📸 Testing ${fps}fps capture`);
  
  const startTime = Date.now();
  const screenshots = await captureTemporalScreenshots(page, fps, 2000); // 2 seconds
  const duration = Date.now() - startTime;
  
  const actualFPS = screenshots.length / (duration / 1000);
  const expectedInterval = 1000 / fps;
  const avgInterval = duration / screenshots.length;
  
  console.log(`      ✅ Captured: ${screenshots.length} screenshots`);
  console.log(`      ✅ Duration: ${duration}ms`);
  console.log(`      ✅ Actual FPS: ${actualFPS.toFixed(1)}`);
  console.log(`      ✅ Expected interval: ${expectedInterval.toFixed(1)}ms`);
  console.log(`      ✅ Avg interval: ${avgInterval.toFixed(1)}ms`);
  
  return {
    fps,
    screenshots: screenshots.length,
    duration,
    actualFPS,
    expectedInterval,
    avgInterval,
    efficiency: (actualFPS / fps) * 100 // How close to target FPS
  };
}

/**
 * Test render change detection
 */
async function testRenderChangeDetection(page, testPage) {
  console.log(`   🔍 Testing render change detection`);
  
  const changes = [];
  const cleanup = await detectRenderChanges(page, (changeInfo) => {
    changes.push(changeInfo);
  }, {
    pollInterval: 50 // Check every 50ms
  });
  
  // Wait 2 seconds
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  await cleanup();
  
  const changeRate = changes.length / 2; // changes per second
  const expectedRate = testPage.expectedFPS || 1;
  
  console.log(`      ✅ Detected: ${changes.length} changes in 2s`);
  console.log(`      ✅ Change rate: ${changeRate.toFixed(1)}/s`);
  console.log(`      ✅ Expected: ${expectedRate}/s`);
  
  return {
    changes: changes.length,
    changeRate,
    expectedRate,
    detectionAccuracy: (changeRate / expectedRate) * 100
  };
}

/**
 * Test adaptive frame rate
 */
async function testAdaptiveFrameRate(page, testPage) {
  console.log(`   🎯 Testing adaptive frame rate`);
  
  const screenshots = await captureAdaptiveTemporalScreenshots(page, {
    minFPS: 1,
    maxFPS: 60,
    duration: 3000, // 3 seconds
    adaptationInterval: 500 // Recalculate every 500ms
  });
  
  const fpsHistory = screenshots.map(s => s.fps);
  const avgFPS = fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length;
  const minFPS = Math.min(...fpsHistory);
  const maxFPS = Math.max(...fpsHistory);
  
  console.log(`      ✅ Captured: ${screenshots.length} screenshots`);
  console.log(`      ✅ Avg FPS: ${avgFPS.toFixed(1)}`);
  console.log(`      ✅ FPS range: ${minFPS}-${maxFPS}`);
  
  return {
    screenshots: screenshots.length,
    avgFPS,
    minFPS,
    maxFPS,
    fpsHistory
  };
}

/**
 * Test capture on render changes
 */
async function testCaptureOnRenderChanges(page, testPage) {
  console.log(`   📷 Testing capture on render changes`);
  
  const screenshots = await captureOnRenderChanges(page, {
    maxScreenshots: 50,
    duration: 2000, // 2 seconds
    visualDiff: false // Disable for speed
  });
  
  console.log(`      ✅ Captured: ${screenshots.length} screenshots`);
  console.log(`      ✅ Changes detected: ${screenshots.filter(s => s.changeInfo).length}`);
  
  return {
    screenshots: screenshots.length,
    changesDetected: screenshots.filter(s => s.changeInfo).length
  };
}

/**
 * Run all fast-changing page tests
 */
async function runFastChangingTests() {
  console.log('🚀 Fast-Changing Pages Test\n');
  console.log('Testing system capabilities with high frame rates and rapid changes\n');
  console.log('='.repeat(70));
  
  const browser = await chromium.launch({ headless: true });
  const allResults = [];
  
  // CRITICAL: Check browser health
  const checkBrowserHealth = () => {
    try {
      return browser.isConnected();
    } catch (error) {
      return false;
    }
  };
  
  for (const testPage of FAST_CHANGING_PAGES) {
    // CRITICAL: Check browser health before each test
    if (!checkBrowserHealth()) {
      console.error(`❌ Browser closed unexpectedly, cannot continue testing`);
      break;
    }
    
    console.log(`\n📄 Testing: ${testPage.name}`);
    console.log(`   Description: ${testPage.description}`);
    console.log(`   Expected FPS: ${testPage.expectedFPS}`);
    
    let page;
    try {
      page = await browser.newPage();
    } catch (error) {
      console.error(`   ❌ Failed to create page: ${error.message}`);
      break;
    }
    const results = {
      page: testPage.name,
      url: testPage.url,
      expectedFPS: testPage.expectedFPS,
      changeType: testPage.changeType,
      tests: {}
    };
    
    try {
      await page.goto(testPage.url, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500); // Wait for animations to start
      
      // Test 1: Temporal capture at different frame rates
      console.log(`\n   Test 1: Temporal Capture`);
      results.tests.temporal1fps = await testTemporalCapture(page, testPage, 1);
      results.tests.temporal10fps = await testTemporalCapture(page, testPage, 10);
      results.tests.temporal30fps = await testTemporalCapture(page, testPage, 30);
      results.tests.temporal60fps = await testTemporalCapture(page, testPage, 60);
      
      // Test 2: Render change detection
      // NOTE: CSS animations don't trigger DOM mutations, so detection will be 0 for CSS-only animations
      console.log(`\n   Test 2: Render Change Detection`);
      console.log(`      ⚠️  Note: CSS animations don't trigger DOM mutations (visual-only)`);
      results.tests.renderDetection = await testRenderChangeDetection(page, testPage);
      
      // Test 3: Adaptive frame rate
      console.log(`\n   Test 3: Adaptive Frame Rate`);
      results.tests.adaptive = await testAdaptiveFrameRate(page, testPage);
      
      // Test 4: Capture on render changes
      console.log(`\n   Test 4: Capture on Render Changes`);
      results.tests.renderCapture = await testCaptureOnRenderChanges(page, testPage);
      
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      results.error = error.message;
    } finally {
      // CRITICAL: Only close page, not browser - browser must stay open
      try {
        if (page && !page.isClosed()) {
          await page.close();
        }
      } catch (closeError) {
        // Silently fail - page may already be closed
      }
    }
    
    allResults.push(results);
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  await browser.close();
  
  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 Test Summary\n');
  
  allResults.forEach(result => {
    console.log(`\n${result.page}:`);
    if (result.tests.temporal60fps) {
      console.log(`  60fps efficiency: ${result.tests.temporal60fps.efficiency.toFixed(1)}%`);
    }
    if (result.tests.renderDetection) {
      console.log(`  Change detection: ${result.tests.renderDetection.detectionAccuracy.toFixed(1)}%`);
    }
    if (result.tests.adaptive) {
      console.log(`  Adaptive FPS: ${result.tests.adaptive.avgFPS.toFixed(1)} (range: ${result.tests.adaptive.minFPS}-${result.tests.adaptive.maxFPS})`);
    }
  });
  
  // Save results
  const resultsFile = join(RESULTS_DIR, `fast-changing-tests-${Date.now()}.json`);
  writeFileSync(resultsFile, JSON.stringify(allResults, null, 2));
  console.log(`\n📁 Results saved to: ${resultsFile}`);
  
  return allResults;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runFastChangingTests().catch(console.error);
}

export { runFastChangingTests };

