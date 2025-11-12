/**
 * E2E Testing with Temporal Batching
 * 
 * Demonstrates how to use TemporalBatchOptimizer for efficient parallel processing
 * of multiple screenshot validations with temporal dependencies.
 */

import { chromium } from 'playwright';
import { experiencePageAsPersona } from '../src/persona-experience.mjs';
import { ExperienceTrace } from '../src/experience-tracer.mjs';
import { validateScreenshot } from '../src/index.mjs';
import { TemporalBatchOptimizer } from '../src/temporal-batch-optimizer.mjs';
import { aggregateTemporalNotes, aggregateMultiScale } from '../src/temporal.mjs';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const testResultsDir = join(process.cwd(), 'test-results');
if (!existsSync(testResultsDir)) {
  mkdirSync(testResultsDir, { recursive: true });
}

/**
 * Test 2048 game with temporal batching
 */
async function test2048WithBatching() {
  console.log('\n🎮 Testing 2048 Game with Temporal Batching');
  console.log('='.repeat(60));
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto('https://play2048.co/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    const trace = new ExperienceTrace('2048-batching-test');
    const experience = await experiencePageAsPersona(page, {
      name: 'Game Player',
      perspective: 'Testing with batching',
      goals: ['fun', 'accessibility']
    }, {
      url: 'https://play2048.co/',
      captureScreenshots: true,
      trace: trace
    });
    
    // Capture multiple screenshots for batching
    const screenshots = [];
    screenshots.push({
      path: await page.screenshot({ path: join(testResultsDir, '2048-batch-0.png') }),
      timestamp: Date.now(),
      step: 'initial'
    });
    
    // Play moves and capture
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(500);
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(500);
      
      screenshots.push({
        path: await page.screenshot({ path: join(testResultsDir, `2048-batch-${i + 1}.png`) }),
        timestamp: Date.now(),
        step: `move-${i + 1}`
      });
    }
    
    console.log(`\n📸 Captured ${screenshots.length} screenshots for batching`);
    
    // Use TemporalBatchOptimizer
    const optimizer = new TemporalBatchOptimizer({
      maxConcurrency: 3, // Process 3 validations in parallel
      batchSize: 5
    });
    
    console.log('\n📦 Adding requests to batch optimizer...');
    
    // Add requests with temporal dependencies
    const promises = screenshots.map((screenshot, index) => {
      const dependencies = index === 0 ? [] : [screenshots[index - 1].path];
      
      return optimizer.addTemporalRequest(
        screenshot.path,
        index === 0 
          ? 'Evaluate the initial game state. Check for: 1) Clear grid layout, 2) Score display, 3) Visual clarity'
          : `Evaluate the game state after move ${index}. Check for: 1) Game responsiveness, 2) Visual feedback, 3) State changes`,
        {
          timestamp: screenshot.timestamp,
          testType: 'gameplay',
          temporalNotes: experience.notes,
          experienceTrace: trace
        },
        dependencies
      );
    });
    
    console.log(`   ✅ Added ${promises.length} requests`);
    console.log(`   📊 Dependencies: ${screenshots.length - 1} dependent requests`);
    
    // Process all requests
    console.log('\n⚡ Processing batch...');
    const startTime = Date.now();
    const results = await Promise.all(promises);
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`   ✅ Processed ${results.length} validations in ${duration}ms`);
    console.log(`   ⚡ Average: ${(duration / results.length).toFixed(0)}ms per validation`);
    
    // Show results
    console.log('\n📊 Results:');
    results.forEach((result, i) => {
      if (result && result.score !== null) {
        console.log(`   ${i === 0 ? 'Initial' : `Move ${i}`}: ${result.score}/10`);
      }
    });
    
    // Show batching stats
    const stats = optimizer.getTemporalStats();
    console.log('\n📈 Batching Stats:');
    console.log(`   - Dependencies tracked: ${stats.dependencies || 0}`);
    console.log(`   - Cache hits: ${stats.cacheHits || 0}`);
    console.log(`   - Cache misses: ${stats.cacheMisses || 0}`);
    
    // Aggregate temporal notes with multi-scale
    const aggregated = aggregateTemporalNotes(experience.notes);
    const multiScale = aggregateMultiScale(experience.notes, {
      timeScales: {
        immediate: 100,
        short: 1000,
        medium: 5000,
        long: 30000
      }
    });
    
    console.log('\n📊 Temporal Analysis:');
    console.log(`   - Single-scale coherence: ${(aggregated.coherence * 100).toFixed(0)}%`);
    console.log(`   - Multi-scale scales: ${Object.keys(multiScale.scales).length}`);
    Object.entries(multiScale.scales).forEach(([scale, data]) => {
      console.log(`     - ${scale}: ${data.windows.length} windows, coherence: ${(data.coherence * 100).toFixed(0)}%`);
    });
    
    return {
      success: true,
      resultsCount: results.length,
      duration,
      avgTimePerValidation: duration / results.length,
      stats,
      aggregated,
      multiScale
    };
    
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  } finally {
    await browser.close();
  }
}

/**
 * Compare sequential vs. batched processing
 */
async function compareSequentialVsBatched() {
  console.log('\n⚡ Performance Comparison: Sequential vs. Batched');
  console.log('='.repeat(60));
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto('https://play2048.co/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // Capture 5 screenshots
    const screenshots = [];
    for (let i = 0; i < 5; i++) {
      if (i > 0) {
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(200);
      }
      screenshots.push(await page.screenshot({ path: join(testResultsDir, `compare-${i}.png`) }));
    }
    
    // Test 1: Sequential processing
    console.log('\n1️⃣ Sequential Processing:');
    const sequentialStart = Date.now();
    const sequentialResults = [];
    for (const screenshot of screenshots) {
      const result = await validateScreenshot(screenshot, 'Evaluate this game state', {
        testType: 'gameplay'
      });
      sequentialResults.push(result);
    }
    const sequentialDuration = Date.now() - sequentialStart;
    console.log(`   ⏱️  Duration: ${sequentialDuration}ms`);
    console.log(`   📊 Average: ${(sequentialDuration / screenshots.length).toFixed(0)}ms per validation`);
    
    // Test 2: Batched processing
    console.log('\n2️⃣ Batched Processing:');
    const optimizer = new TemporalBatchOptimizer({ maxConcurrency: 3, batchSize: 5 });
    const batchedStart = Date.now();
    const batchedPromises = screenshots.map(screenshot =>
      optimizer.addTemporalRequest(
        screenshot,
        'Evaluate this game state',
        { timestamp: Date.now(), testType: 'gameplay' },
        [] // No dependencies for this test
      )
    );
    const batchedResults = await Promise.all(batchedPromises);
    const batchedDuration = Date.now() - batchedStart;
    console.log(`   ⏱️  Duration: ${batchedDuration}ms`);
    console.log(`   📊 Average: ${(batchedDuration / screenshots.length).toFixed(0)}ms per validation`);
    
    // Comparison
    console.log('\n📊 Comparison:');
    const speedup = sequentialDuration / batchedDuration;
    console.log(`   - Sequential: ${sequentialDuration}ms`);
    console.log(`   - Batched: ${batchedDuration}ms`);
    console.log(`   - Speedup: ${speedup.toFixed(2)}x faster`);
    console.log(`   - Time saved: ${sequentialDuration - batchedDuration}ms (${((1 - batchedDuration / sequentialDuration) * 100).toFixed(0)}%)`);
    
    return {
      sequential: { duration: sequentialDuration, avg: sequentialDuration / screenshots.length },
      batched: { duration: batchedDuration, avg: batchedDuration / screenshots.length },
      speedup
    };
    
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    return null;
  } finally {
    await browser.close();
  }
}

/**
 * Main test runner
 */
async function runBatchingTests() {
  console.log('🚀 E2E Testing with Temporal Batching');
  console.log('='.repeat(60));
  
  const results = {
    batching: null,
    comparison: null
  };
  
  // Test with batching
  results.batching = await test2048WithBatching();
  
  // Compare sequential vs. batched
  results.comparison = await compareSequentialVsBatched();
  
  // Summary
  console.log('\n📊 Summary');
  console.log('='.repeat(60));
  console.log(`✅ Batching test: ${results.batching?.success ? 'Success' : 'Failed'}`);
  if (results.batching?.success) {
    console.log(`   - Processed ${results.batching.resultsCount} validations`);
    console.log(`   - Duration: ${results.batching.duration}ms`);
    console.log(`   - Average: ${results.batching.avgTimePerValidation.toFixed(0)}ms per validation`);
  }
  
  if (results.comparison) {
    console.log(`\n⚡ Performance comparison:`);
    console.log(`   - Speedup: ${results.comparison.speedup.toFixed(2)}x faster`);
    console.log(`   - Time saved: ${((1 - results.comparison.batched.duration / results.comparison.sequential.duration) * 100).toFixed(0)}%`);
  }
  
  return results;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runBatchingTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { runBatchingTests, test2048WithBatching, compareSequentialVsBatched };

