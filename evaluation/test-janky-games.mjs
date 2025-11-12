#!/usr/bin/env node
/**
 * Test Janky Games and Hard Web Pages
 * 
 * Stress test the system with challenging online games and problematic websites.
 * Be critical about robustness and integration issues.
 */

import { testGameplay, testBrowserExperience, validateWithGoals } from '../src/index.mjs';
import { experiencePageAsPersona, experiencePageWithPersonas } from '../src/index.mjs';
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { warn } from '../src/logger.mjs';

const RESULTS_DIR = join(process.cwd(), 'evaluation', 'results');
if (!existsSync(RESULTS_DIR)) {
  mkdirSync(RESULTS_DIR, { recursive: true });
}

// Janky/problematic games and websites
const JANKY_GAMES = [
  {
    name: 'Asteroids (Old School)',
    url: 'https://www.free80sarcade.com/asteroids.php',
    description: 'Old Flash-based game, likely janky',
    expectedIssues: ['Flash', 'old', 'loading', 'compatibility']
  },
  {
    name: '2048 (Clone)',
    url: 'https://play2048.co/',
    description: 'Simple but can be janky on mobile',
    expectedIssues: ['touch', 'mobile', 'responsive']
  },
  {
    name: 'Snake Game',
    url: 'https://playsnake.org/',
    description: 'Simple game, test basic gameplay',
    expectedIssues: []
  },
  {
    name: 'Pacman (Web)',
    url: 'https://www.webpacman.com/',
    description: 'Web-based Pacman, may have issues',
    expectedIssues: ['loading', 'controls', 'performance']
  },
  {
    name: 'Tetris (Web)',
    url: 'https://tetris.com/play-tetris',
    description: 'Official Tetris, test complex game',
    expectedIssues: ['complex', 'state', 'performance']
  }
];

// Hard/janky web pages
const JANKY_PAGES = [
  {
    name: 'CSS Zen Garden (Complex)',
    url: 'https://www.csszengarden.com/',
    description: 'Complex CSS layouts',
    expectedIssues: ['css', 'layout', 'rendering']
  },
  {
    name: 'The Website is Down',
    url: 'https://www.thewebsiteisdown.com/',
    description: 'Intentionally problematic',
    expectedIssues: ['errors', 'broken', 'timeout']
  },
  {
    name: 'Motherfucking Website',
    url: 'https://motherfuckingwebsite.com/',
    description: 'Minimal, test basic rendering',
    expectedIssues: []
  },
  {
    name: 'Ebay (Heavy)',
    url: 'https://www.ebay.com/',
    description: 'Heavy page, lots of elements',
    expectedIssues: ['performance', 'elements', 'loading']
  },
  {
    name: 'Craigslist (Old Design)',
    url: 'https://craigslist.org',
    description: 'Old design, minimal styling',
    expectedIssues: ['old', 'minimal', 'accessibility']
  }
];

/**
 * Test a janky game with critical analysis
 */
async function testJankyGame(game, browser) {
  console.log(`\n🎮 Testing: ${game.name}`);
  console.log(`   URL: ${game.url}`);
  console.log(`   Expected Issues: ${game.expectedIssues.join(', ') || 'none'}`);
  
  const page = await browser.newPage();
  const results = {
    game: game.name,
    url: game.url,
    success: false,
    errors: [],
    warnings: [],
    issues: [],
    temporalIssues: [],
    integrationIssues: [],
    robustnessIssues: []
  };
  
  try {
    // Test 1: Basic navigation
    console.log('   📍 Step 1: Navigation');
    try {
      await page.goto(game.url, { 
        waitUntil: 'domcontentloaded', 
        timeout: 30000 
      });
      console.log('      ✅ Navigation successful');
    } catch (error) {
      results.errors.push(`Navigation failed: ${error.message}`);
      results.robustnessIssues.push('Navigation timeout or failure');
      console.log(`      ❌ Navigation failed: ${error.message}`);
      await page.close();
      return results;
    }
    
    // Test 2: Gameplay experience with personas
    console.log('   🎯 Step 2: Gameplay Experience');
    try {
      // Add timeout wrapper to prevent hangs
      const experiencePromise = experiencePageAsPersona(page, {
        name: 'Game Tester',
        perspective: 'Testing janky game',
        focus: ['gameplay', 'performance', 'accessibility'],
        goals: ['play game', 'understand controls', 'test performance']
      }, {
        captureScreenshots: true,
        captureCode: true,
        captureState: true
      });
      
      const experience = await Promise.race([
        experiencePromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Experience timeout (60s)')), 60000)
        )
      ]);
      
      console.log(`      ✅ Experience captured: ${experience.notes.length} notes`);
      console.log(`      ✅ Screenshots: ${experience.screenshots.length}`);
      console.log(`      ✅ Duration: ${experience.duration}ms`);
      
      // CRITICAL: Check temporal aggregation
      if (!experience.aggregated) {
        results.temporalIssues.push('Missing temporal aggregation');
        console.log(`      ⚠️  Missing temporal aggregation`);
      } else {
        console.log(`      ✅ Temporal aggregation: ${experience.aggregated.windows.length} windows, coherence: ${experience.aggregated.coherence.toFixed(2)}`);
        if (experience.aggregated.coherence < 0.5) {
          results.temporalIssues.push(`Low coherence: ${experience.aggregated.coherence.toFixed(2)}`);
        }
      }
      
      if (!experience.aggregatedMultiScale) {
        results.temporalIssues.push('Missing multi-scale aggregation');
        console.log(`      ⚠️  Missing multi-scale aggregation`);
      } else {
        const scales = Object.keys(experience.aggregatedMultiScale.scales || {});
        console.log(`      ✅ Multi-scale: ${scales.length} scales`);
      }
      
      // CRITICAL: Check consistency
      if (experience.consistency && !experience.consistency.isConsistent) {
        results.integrationIssues.push(`Cross-modal inconsistency: ${experience.consistency.issues.join(', ')}`);
        console.log(`      ⚠️  Cross-modal inconsistency: ${experience.consistency.issues.join(', ')}`);
      }
      
      results.experience = experience;
    } catch (error) {
      results.errors.push(`Experience failed: ${error.message}`);
      results.robustnessIssues.push(`Experience capture failed: ${error.message}`);
      console.log(`      ❌ Experience failed: ${error.message}`);
    }
    
    // Test 3: Gameplay validation with goals
    console.log('   🔍 Step 3: Gameplay Validation');
    try {
      if (results.experience && results.experience.screenshots.length > 0) {
        const screenshotPath = results.experience.screenshots[results.experience.screenshots.length - 1].path;
        
        // Add timeout wrapper to prevent hangs
        const validationPromise = validateWithGoals(screenshotPath, {
          goal: 'fun',
          gameState: results.experience.pageState,
          renderedCode: results.experience.renderedCode,
          context: {
            temporalNotes: results.experience.aggregated
          }
        });
        
        const validation = await Promise.race([
          validationPromise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Validation timeout (45s)')), 45000)
          )
        ]);
        
        // CRITICAL: Check validation result structure
        if (!validation) {
          results.errors.push('Validation returned null/undefined');
          console.log(`      ❌ Validation returned null/undefined`);
        } else if (!validation.result) {
          results.errors.push('Validation missing result property');
          console.log(`      ❌ Validation missing result property`);
        } else {
          const result = validation.result;
          console.log(`      ✅ Validation: ${result.score || 'N/A'}/10`);
          console.log(`      ✅ Issues found: ${(result.issues || []).length}`);
          
          // Check for robustness issues (result is now normalized, but check for empty results)
          if (result.score === null && result.issues.length === 0) {
            results.robustnessIssues.push('Validation returned empty result (no score or issues)');
            console.log(`      ⚠️  Validation returned empty result`);
          }
          // Note: score can be null (explicit), but structure should always be consistent
        }
        
        results.validation = validation;
      } else {
        results.warnings.push('No screenshots for validation');
        console.log(`      ⚠️  No screenshots available`);
      }
    } catch (error) {
      results.errors.push(`Validation failed: ${error.message}`);
      results.robustnessIssues.push(`Validation failed: ${error.message}`);
      console.log(`      ❌ Validation failed: ${error.message}`);
    }
    
    // Test 4: TestGameplay convenience function
    console.log('   🎮 Step 4: TestGameplay Convenience');
    try {
      // Add timeout wrapper to prevent hangs
      const gameplayPromise = testGameplay(page, {
        url: game.url,
        goals: ['fun', 'accessibility', 'performance'],
        captureTemporal: true,
        captureCode: true,
        checkConsistency: true
      });
      
      const gameplayResult = await Promise.race([
        gameplayPromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('TestGameplay timeout (90s)')), 90000)
        )
      ]);
      
      console.log(`      ✅ TestGameplay: ${gameplayResult.experiences.length} experiences`);
      console.log(`      ✅ Evaluations: ${gameplayResult.evaluations.length}`);
      
      // CRITICAL: Check integration
      if (!gameplayResult.aggregated || !gameplayResult.aggregated.windows) {
        results.integrationIssues.push('TestGameplay missing aggregated notes structure');
        console.log(`      ⚠️  Missing aggregated notes structure`);
      } else {
        const windowCount = Array.isArray(gameplayResult.aggregated.windows) 
          ? gameplayResult.aggregated.windows.length 
          : 0;
        console.log(`      ✅ Aggregated: ${windowCount} windows`);
        if (windowCount === 0 && gameplayResult.experiences.length > 0) {
          results.integrationIssues.push('TestGameplay has experiences but no aggregated windows');
          console.log(`      ⚠️  No aggregated windows despite ${gameplayResult.experiences.length} experiences`);
        }
      }
      
      if (!gameplayResult.aggregatedMultiScale || !gameplayResult.aggregatedMultiScale.scales) {
        results.integrationIssues.push('TestGameplay missing multi-scale aggregation structure');
        console.log(`      ⚠️  Missing multi-scale aggregation structure`);
      } else {
        const scales = Object.keys(gameplayResult.aggregatedMultiScale.scales || {});
        console.log(`      ✅ Multi-scale: ${scales.length} scales`);
        if (scales.length === 0 && gameplayResult.experiences.length > 0) {
          // This is expected if notes don't span multiple time windows
          console.log(`      ℹ️  No multi-scale windows (notes may be within same time window)`);
        }
      }
      
      if (gameplayResult.checkConsistency && !gameplayResult.consistency) {
        results.integrationIssues.push('TestGameplay missing consistency check (requested but not returned)');
        console.log(`      ⚠️  Missing consistency check (requested)`);
      } else if (gameplayResult.consistency) {
        console.log(`      ✅ Consistency: ${gameplayResult.consistency.isConsistent ? 'consistent' : 'inconsistent'}`);
      }
      
      results.gameplayResult = gameplayResult;
    } catch (error) {
      results.errors.push(`TestGameplay failed: ${error.message}`);
      results.robustnessIssues.push(`TestGameplay failed: ${error.message}`);
      console.log(`      ❌ TestGameplay failed: ${error.message}`);
    }
    
    results.success = results.errors.length === 0;
    
  } catch (error) {
    results.errors.push(`Unexpected error: ${error.message}`);
    results.robustnessIssues.push(`Unexpected error: ${error.message}`);
    console.log(`   ❌ Unexpected error: ${error.message}`);
  } finally {
    // CRITICAL: Only close page, not browser - browser must stay open for other tests
    try {
      await page.close();
    } catch (closeError) {
      // Silently fail - page may already be closed
      if (closeError.message.includes('Target closed')) {
        // Expected - page was already closed
      } else {
        warn(`[Test] Error closing page: ${closeError.message}`);
      }
    }
  }
  
  return results;
}

/**
 * Test a janky web page with critical analysis
 */
async function testJankyPage(pageInfo, browser) {
  console.log(`\n🌐 Testing: ${pageInfo.name}`);
  console.log(`   URL: ${pageInfo.url}`);
  console.log(`   Expected Issues: ${pageInfo.expectedIssues.join(', ') || 'none'}`);
  
  const page = await browser.newPage();
  const results = {
    page: pageInfo.name,
    url: pageInfo.url,
    success: false,
    errors: [],
    warnings: [],
    issues: [],
    temporalIssues: [],
    integrationIssues: [],
    robustnessIssues: []
  };
  
  try {
    // Test browser experience
    console.log('   📍 Step 1: Browser Experience');
    try {
      // Add timeout wrapper to prevent hangs
      const browserResultPromise = testBrowserExperience(page, {
        url: pageInfo.url,
        stages: ['initial'],
        captureCode: true
      });
      
      const browserResult = await Promise.race([
        browserResultPromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Browser experience timeout (60s)')), 60000)
        )
      ]);
      
      console.log(`      ✅ Browser experience: ${browserResult.experiences.length} experiences`);
      
      // CRITICAL: Check integration
      if (browserResult.experiences.length > 0) {
        const exp = browserResult.experiences[0];
        if (!exp.aggregated) {
          results.integrationIssues.push('Browser experience missing aggregated notes');
          console.log(`      ⚠️  Missing aggregated notes`);
        }
        
        if (!exp.aggregatedMultiScale) {
          results.integrationIssues.push('Browser experience missing multi-scale aggregation');
          console.log(`      ⚠️  Missing multi-scale aggregation`);
        }
      }
      
      results.browserResult = browserResult;
    } catch (error) {
      results.errors.push(`Browser experience failed: ${error.message}`);
      results.robustnessIssues.push(`Browser experience failed: ${error.message}`);
      console.log(`      ❌ Browser experience failed: ${error.message}`);
    }
    
    results.success = results.errors.length === 0;
    
  } catch (error) {
    results.errors.push(`Unexpected error: ${error.message}`);
    results.robustnessIssues.push(`Unexpected error: ${error.message}`);
    console.log(`   ❌ Unexpected error: ${error.message}`);
  } finally {
    // CRITICAL: Only close page, not browser - browser must stay open for other tests
    try {
      if (page && !page.isClosed()) {
        await page.close();
      }
    } catch (closeError) {
      // Silently fail - page may already be closed
      if (closeError.message.includes('Target closed')) {
        // Expected - page was already closed
      } else {
        warn(`[Test] Error closing page: ${closeError.message}`);
      }
    }
  }
  
  return results;
}

/**
 * Run all janky tests
 */
async function runJankyTests() {
  console.log('🚀 Janky Games and Hard Web Pages Test\n');
  console.log('Testing robustness and integration with challenging scenarios\n');
  console.log('='.repeat(70));
  
  const browser = await chromium.launch({ headless: true }); // Use headless for stability
  
  // CRITICAL: Add browser health check
  const checkBrowserHealth = () => {
    try {
      return browser.isConnected();
    } catch (error) {
      return false;
    }
  };
  
  const allResults = {
    games: [],
    pages: [],
    summary: {
      total: 0,
      success: 0,
      failed: 0,
      temporalIssues: 0,
      integrationIssues: 0,
      robustnessIssues: 0
    }
  };
  
  // Test janky games
  console.log('\n🎮 Testing Janky Games\n');
  for (const game of JANKY_GAMES) {
    // CRITICAL: Check browser health before each test
    if (!checkBrowserHealth()) {
      console.error(`❌ Browser closed unexpectedly, cannot continue testing`);
      allResults.summary.failed++;
      break;
    }
    
    try {
      const result = await testJankyGame(game, browser);
      allResults.games.push(result);
      allResults.summary.total++;
      
      if (result.success) {
        allResults.summary.success++;
      } else {
        allResults.summary.failed++;
      }
      
      allResults.summary.temporalIssues += result.temporalIssues.length;
      allResults.summary.integrationIssues += result.integrationIssues.length;
      allResults.summary.robustnessIssues += result.robustnessIssues.length;
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`❌ Error testing ${game.name}: ${error.message}`);
      allResults.games.push({
        game: game.name,
        url: game.url,
        success: false,
        errors: [error.message]
      });
      allResults.summary.total++;
      allResults.summary.failed++;
    }
  }
  
  // Test janky pages
  console.log('\n🌐 Testing Janky Pages\n');
  for (const pageInfo of JANKY_PAGES) {
    // CRITICAL: Check browser health before each test
    if (!checkBrowserHealth()) {
      console.error(`❌ Browser closed unexpectedly, cannot continue testing`);
      allResults.summary.failed++;
      break;
    }
    
    try {
      const result = await testJankyPage(pageInfo, browser);
      allResults.pages.push(result);
      allResults.summary.total++;
      
      if (result.success) {
        allResults.summary.success++;
      } else {
        allResults.summary.failed++;
      }
      
      allResults.summary.temporalIssues += result.temporalIssues.length;
      allResults.summary.integrationIssues += result.integrationIssues.length;
      allResults.summary.robustnessIssues += result.robustnessIssues.length;
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`❌ Error testing ${pageInfo.name}: ${error.message}`);
      allResults.pages.push({
        page: pageInfo.name,
        url: pageInfo.url,
        success: false,
        errors: [error.message]
      });
      allResults.summary.total++;
      allResults.summary.failed++;
    }
  }
  
  await browser.close();
  
  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 Test Summary\n');
  console.log(`   Total Tests: ${allResults.summary.total}`);
  console.log(`   ✅ Successful: ${allResults.summary.success}`);
  console.log(`   ❌ Failed: ${allResults.summary.failed}`);
  console.log(`   ⚠️  Temporal Issues: ${allResults.summary.temporalIssues}`);
  console.log(`   ⚠️  Integration Issues: ${allResults.summary.integrationIssues}`);
  console.log(`   ⚠️  Robustness Issues: ${allResults.summary.robustnessIssues}`);
  
  // Print critical issues
  console.log('\n🔍 Critical Issues Found:\n');
  
  const allTemporalIssues = [...allResults.games, ...allResults.pages]
    .flatMap(r => r.temporalIssues || []);
  if (allTemporalIssues.length > 0) {
    console.log('   Temporal Issues:');
    allTemporalIssues.forEach(issue => console.log(`      - ${issue}`));
  }
  
  const allIntegrationIssues = [...allResults.games, ...allResults.pages]
    .flatMap(r => r.integrationIssues || []);
  if (allIntegrationIssues.length > 0) {
    console.log('   Integration Issues:');
    allIntegrationIssues.forEach(issue => console.log(`      - ${issue}`));
  }
  
  const allRobustnessIssues = [...allResults.games, ...allResults.pages]
    .flatMap(r => r.robustnessIssues || []);
  if (allRobustnessIssues.length > 0) {
    console.log('   Robustness Issues:');
    allRobustnessIssues.forEach(issue => console.log(`      - ${issue}`));
  }
  
  // Save results
  const resultsFile = join(RESULTS_DIR, `janky-tests-${Date.now()}.json`);
  writeFileSync(resultsFile, JSON.stringify(allResults, null, 2));
  console.log(`\n📁 Results saved to: ${resultsFile}`);
  
  return allResults;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runJankyTests().catch(console.error);
}

export { runJankyTests, testJankyGame, testJankyPage };

