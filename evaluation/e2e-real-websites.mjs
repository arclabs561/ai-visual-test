/**
 * E2E Testing on Real Websites and Games
 * 
 * Tests real websites and games where we have known expectations about the experience.
 * Uses enhanced temporal/experience features and late interaction.
 * 
 * Websites tested:
 * - Simple games (2048, Snake) - known gameplay patterns
 * - Well-known sites (GitHub, Wikipedia) - known UI patterns
 * - Interactive demos - known interaction patterns
 */

import { chromium } from 'playwright';
import { 
  testGameplay,
  testBrowserExperience 
} from '../src/convenience.mjs';
import { experiencePageAsPersona } from '../src/persona-experience.mjs';
import { ExperienceTrace } from '../src/experience-tracer.mjs';
import { aggregateTemporalNotes, formatNotesForPrompt } from '../src/temporal.mjs';
import { aggregateMultiScale } from '../src/temporal-decision.mjs';
import { validateScreenshot } from '../src/index.mjs';
import { TemporalBatchOptimizer } from '../src/temporal-batch-optimizer.mjs';
import { createAdaptiveTemporalProcessor } from '../src/temporal-preprocessor.mjs';
import { getExplanationManager } from '../src/explanation-manager.mjs';
import { HumanValidationManager } from '../src/human-validation-manager.mjs';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// Ensure test-results directory exists
const testResultsDir = join(process.cwd(), 'test-results');
if (!existsSync(testResultsDir)) {
  mkdirSync(testResultsDir, { recursive: true });
}

/**
 * Test a simple game (2048) - we know it should:
 * - Have a grid of numbers
 * - Be playable with arrow keys
 * - Show score
 * - Have clear visual feedback
 */
async function test2048Game() {
  console.log('\n🎮 Testing 2048 Game (https://play2048.co/)');
  console.log('Expected: Grid-based puzzle game with clear UI, score display, arrow key controls');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Create adaptive temporal processor for activity-based preprocessing
  const temporalProcessor = createAdaptiveTemporalProcessor({
    preprocessInterval: 2000,
    cacheMaxAge: 5000
  });
  
  try {
    // Create experience trace
    const trace = new ExperienceTrace('2048-game-test');
    
    // Navigate to game
    await page.goto('https://play2048.co/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000); // Wait for game to load
    
    // Experience as a game player persona
    const persona = {
      name: 'Game Player',
      perspective: 'Testing gameplay experience and visual clarity',
      goals: ['fun', 'accessibility', 'visual clarity'],
      focus: ['gameplay', 'UI clarity', 'controls']
    };
    
    // Experience the initial state
    const experience = await experiencePageAsPersona(page, persona, {
      url: 'https://play2048.co/',
      captureScreenshots: true,
      captureCode: true,
      captureState: true,
      trace: trace
    });
    
    console.log(`  ✅ Captured ${experience.screenshots.length} screenshots`);
    console.log(`  ✅ Generated ${experience.notes.length} temporal notes`);
    
    // Validate initial state
    let initialValidation = null;
    if (experience.screenshots.length > 0) {
      const initialScreenshot = experience.screenshots[0].path;
      initialValidation = await validateScreenshot(initialScreenshot, 
        'Evaluate the 2048 game interface. Check for: 1) Clear grid layout, 2) Score display, 3) Visual clarity, 4) Accessibility',
        {
          testType: 'gameplay',
          temporalNotes: experience.notes,
          experienceTrace: trace
        }
      );
      
      console.log(`  📊 Initial state score: ${initialValidation.score}/10`);
      console.log(`  📝 Issues: ${initialValidation.issues?.join(', ') || 'None'}`);
      
      // Test late interaction with temporal context
      if (initialValidation.score !== null) {
        const explanationManager = getExplanationManager();
        // Use preprocessing for aggregated notes
        const initialProcessed = await temporalProcessor.processNotes(experience.notes);
        
        const judgment = {
          id: '2048-initial',
          vllmScore: initialValidation.score,
          vllmIssues: initialValidation.issues || [],
          vllmReasoning: initialValidation.reasoning || '',
          screenshot: initialScreenshot,
          prompt: 'Evaluate the 2048 game interface',
          temporalNotes: experience.notes,
          aggregatedNotes: initialProcessed.aggregated,
          experienceTrace: trace
        };
        
        const explanation = await explanationManager.explainJudgment(
          judgment,
          'Why did you score the game interface this way? What specific visual elements influenced your score?',
          {
            temporalNotes: experience.notes,
            aggregatedNotes: initialProcessed.aggregated,
            experienceTrace: trace
          }
        );
        
        console.log(`  💬 Explanation: ${explanation.answer.substring(0, 200)}...`);
      }
    }
    
    // Play a few moves and capture screenshots for batching
    console.log('  🎮 Playing a few moves...');
    const moveScreenshots = [];
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(500);
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(500);
      
      // Capture state after move
      const screenshotPath = join(testResultsDir, `2048-move-${i + 1}.png`);
      await page.screenshot({ path: screenshotPath });
      moveScreenshots.push({
        path: screenshotPath,
        timestamp: Date.now(),
        move: i + 1
      });
      
      trace.addEvent('game-move', {
        move: i + 1,
        action: 'ArrowRight then ArrowDown'
      });
    }
    
    // Use temporal batching for multiple validations
    console.log('  📦 Using temporal batching for move validations...');
    const optimizer = new TemporalBatchOptimizer({
      maxConcurrency: 3,
      batchSize: 5
    });
    
    // Use adaptive temporal processor for activity-based preprocessing
    const processed = await temporalProcessor.processNotes(experience.notes, {
      windowSize: 10000,
      decayFactor: 0.9
    });
    
    // Keep backward compatibility variables
    const aggregated = processed.aggregated;
    const multiScale = processed.multiScale;
    
    // Add move validations to batch
    const moveValidations = moveScreenshots.map((screenshot, index) => {
      return optimizer.addTemporalRequest(
        screenshot.path,
        `Evaluate the game state after move ${screenshot.move}. Check for: 1) Game responsiveness, 2) Visual feedback, 3) State changes`,
        {
          timestamp: screenshot.timestamp,
          testType: 'gameplay',
          temporalNotes: multiScale, // Use multi-scale for richer context
          experienceTrace: trace
        },
        index === 0 ? [] : [moveScreenshots[index - 1].path] // Each move depends on previous
      );
    });
    
    // Process batch
    const moveResults = await Promise.all(moveValidations);
    console.log(`  ✅ Processed ${moveResults.length} move validations with batching`);
    
    // Final evaluation (separate, not batched)
    const finalScreenshot = await page.screenshot({ 
      path: join(testResultsDir, '2048-final.png') 
    });
    
    const finalValidation = await validateScreenshot(join(testResultsDir, '2048-final.png'),
      'Evaluate the game state after playing. Check for: 1) Game responsiveness, 2) Visual feedback, 3) State changes',
      {
        testType: 'gameplay',
        temporalNotes: multiScale, // Use multi-scale
        experienceTrace: trace
      }
    );
    
    console.log(`  📊 Final state score: ${finalValidation.score}/10`);
    if (moveResults.length > 0 && moveResults[0] && moveResults[0].score !== null) {
      console.log(`  📊 Move validations: ${moveResults.filter(r => r && r.score !== null).length}/${moveResults.length} successful`);
    }
    
    // Show temporal analysis (already aggregated above)
    console.log(`  📈 Temporal coherence: ${(aggregated.coherence * 100).toFixed(0)}%`);
    console.log(`  📊 Windows analyzed: ${aggregated.windows.length}`);
    console.log(`  📊 Multi-scale scales: ${Object.keys(multiScale.scales).length}`);
    Object.entries(multiScale.scales).forEach(([scale, data]) => {
      console.log(`     - ${scale}: ${data.windows.length} windows, coherence: ${(data.coherence * 100).toFixed(0)}%`);
    });
    
    return {
      success: true,
      initialScore: initialValidation ? initialValidation.score : null,
      finalScore: finalValidation ? finalValidation.score : null,
      coherence: aggregated.coherence,
      trace: trace
    };
  } catch (error) {
    console.error(`  ❌ Error testing 2048: ${error.message}`);
    return { success: false, error: error.message };
  } finally {
    await browser.close();
  }
}

/**
 * Test GitHub homepage - we know it should:
 * - Have clear navigation
 * - Show repositories
 * - Be accessible
 * - Have good visual hierarchy
 */
async function testGitHubHomepage() {
  console.log('\n🐙 Testing GitHub Homepage (https://github.com)');
  console.log('Expected: Clear navigation, repository listings, good accessibility, professional design');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    const trace = new ExperienceTrace('github-homepage-test');
    
    await page.goto('https://github.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000); // Give more time for GitHub to load
    
    const persona = {
      name: 'Developer',
      perspective: 'Evaluating developer experience and accessibility',
      goals: ['accessibility', 'usability', 'visual clarity'],
      focus: ['navigation', 'content clarity', 'accessibility']
    };
    
    const experience = await experiencePageAsPersona(page, persona, {
      url: 'https://github.com',
      captureScreenshots: true,
      captureCode: true,
      trace: trace
    });
    
    console.log(`  ✅ Captured ${experience.screenshots.length} screenshots`);
    
    if (experience.screenshots.length > 0) {
      const screenshot = experience.screenshots[0].path;
      const validation = await validateScreenshot(screenshot,
        'Evaluate the GitHub homepage. Check for: 1) Clear navigation, 2) Visual hierarchy, 3) Accessibility, 4) Professional design',
        {
          testType: 'accessibility',
          temporalNotes: experience.notes,
          experienceTrace: trace
        }
      );
      
      console.log(`  📊 Score: ${validation.score}/10`);
      console.log(`  📝 Issues: ${validation.issues?.join(', ') || 'None'}`);
      
      // Test scrolling and interaction
      console.log('  📜 Scrolling and interacting...');
      await page.evaluate(() => window.scrollTo(0, 500));
      await page.waitForTimeout(1000);
      
      const scrolledScreenshot = await page.screenshot({ 
        path: join(testResultsDir, 'github-scrolled.png') 
      });
      
      trace.addEvent('scroll', { position: 500 });
      
      const scrolledValidation = await validateScreenshot(join(testResultsDir, 'github-scrolled.png'),
        'Evaluate the scrolled GitHub page. Check for: 1) Content visibility, 2) Navigation accessibility, 3) Visual consistency',
        {
          testType: 'accessibility',
          temporalNotes: experience.notes,
          experienceTrace: trace
        }
      );
      
      console.log(`  📊 Scrolled state score: ${scrolledValidation.score}/10`);
      
      // Use adaptive temporal processor for activity-based preprocessing
      const processed = await temporalProcessor.processNotes(experience.notes, {
        windowSize: 10000,
        decayFactor: 0.9
      });
      
      const aggregated = processed.aggregated;
      const multiScale = processed.multiScale;
      
      console.log(`  📈 Temporal coherence: ${(aggregated.coherence * 100).toFixed(0)}%`);
      console.log(`  📊 Processing: ${processed.source} (${processed.latency})`);
      console.log(`  📊 Multi-scale insights: ${Object.keys(multiScale.scales).length} scales analyzed`);
      
      return {
        success: true,
        initialScore: validation ? validation.score : null,
        scrolledScore: scrolledValidation ? scrolledValidation.score : null,
        coherence: aggregated.coherence,
        trace: trace
      };
    }
    
    return { success: false, error: 'No screenshots captured' };
  } catch (error) {
    console.error(`  ❌ Error testing GitHub: ${error.message}`);
    return { success: false, error: error.message };
  } finally {
    await browser.close();
  }
}

/**
 * Test Wikipedia - we know it should:
 * - Have clear article layout
 * - Be highly accessible
 * - Have good typography
 * - Support multiple languages
 */
async function testWikipedia() {
  console.log('\n📚 Testing Wikipedia (https://en.wikipedia.org/wiki/Artificial_intelligence)');
  console.log('Expected: Clear article layout, excellent accessibility, good typography, readable content');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Create adaptive temporal processor for activity-based preprocessing
  const temporalProcessor = createAdaptiveTemporalProcessor({
    preprocessInterval: 2000,
    cacheMaxAge: 5000
  });
  
  // Ensure page is ready
  if (page.isClosed()) {
    throw new Error('Page closed before test started');
  }
  
  try {
    const trace = new ExperienceTrace('wikipedia-test');
    
    // Set viewport first to avoid full-page screenshot issues
    await page.setViewportSize({ width: 1280, height: 720 });
    
    await page.goto('https://en.wikipedia.org/wiki/Artificial_intelligence', { 
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });
    await page.waitForTimeout(2000);
    
    const persona = {
      name: 'Reader',
      perspective: 'Evaluating reading experience and accessibility',
      goals: ['accessibility', 'readability', 'content clarity'],
      focus: ['typography', 'layout', 'accessibility']
    };
    
    const experience = await experiencePageAsPersona(page, persona, {
      url: 'https://en.wikipedia.org/wiki/Artificial_intelligence',
      captureScreenshots: true,
      captureCode: true,
      trace: trace
    });
    
    console.log(`  ✅ Captured ${experience.screenshots.length} screenshots`);
    
    if (experience.screenshots.length > 0) {
      // Use viewport screenshot to avoid image processing issues with very long pages
      const viewportScreenshot = await page.screenshot({ 
        path: join(testResultsDir, 'wikipedia-viewport.png'),
        fullPage: false // Viewport only
      });
      
      let validation;
      try {
        validation = await validateScreenshot(join(testResultsDir, 'wikipedia-viewport.png'),
          'Evaluate the Wikipedia article page. Check for: 1) Typography quality, 2) Layout clarity, 3) Accessibility, 4) Readability, 5) Content organization',
          {
            testType: 'accessibility',
            temporalNotes: experience.notes,
            experienceTrace: trace
          }
        );
      } catch (error) {
        console.error(`  ⚠️  Validation error: ${error.message}`);
        validation = { score: null, issues: [], reasoning: 'Validation failed' };
      }
      
      console.log(`  📊 Score: ${validation.score}/10`);
      console.log(`  📝 Issues: ${validation.issues?.join(', ') || 'None'}`);
      
      // Test table of contents interaction
      console.log('  🔗 Testing table of contents...');
      const tocLink = await page.locator('a[href="#History"]').first();
      if (await tocLink.count() > 0) {
        await tocLink.click();
        await page.waitForTimeout(1000);
        
        const tocScreenshot = await page.screenshot({ 
          path: join(testResultsDir, 'wikipedia-toc.png') 
        });
        
        trace.addEvent('navigation', { target: 'History section' });
        
        const tocValidation = await validateScreenshot(join(testResultsDir, 'wikipedia-toc.png'),
          'Evaluate the Wikipedia page after navigating to a section. Check for: 1) Smooth navigation, 2) Content visibility, 3) Accessibility maintained',
          {
            testType: 'accessibility',
            temporalNotes: experience.notes,
            experienceTrace: trace
          }
        );
        
        console.log(`  📊 After navigation score: ${tocValidation.score}/10`);
      }
      
      // Use adaptive temporal processor for activity-based preprocessing
      const processed = await temporalProcessor.processNotes(experience.notes, {
        windowSize: 10000,
        decayFactor: 0.9
      });
      
      const aggregated = processed.aggregated;
      const multiScale = processed.multiScale;
      
      console.log(`  📈 Temporal coherence: ${(aggregated.coherence * 100).toFixed(0)}%`);
      console.log(`  📊 Processing: ${processed.source} (${processed.latency})`);
      console.log(`  📊 Multi-scale insights: ${Object.keys(multiScale.scales).length} scales analyzed`);
      
      return {
        success: true,
        initialScore: validation ? validation.score : null,
        coherence: aggregated.coherence,
        trace: trace
      };
    }
    
    return { success: false, error: 'No screenshots captured' };
  } catch (error) {
    console.error(`  ❌ Error testing Wikipedia: ${error.message}`);
    return { success: false, error: error.message };
  } finally {
    await browser.close();
  }
}

/**
 * Main test runner
 */
async function runE2ETests() {
  console.log('🚀 Starting E2E Tests on Real Websites');
  console.log('=' .repeat(60));
  
  const results = {
    '2048 Game': null,
    'GitHub': null,
    'Wikipedia': null
  };
  
  // Test 2048 game
  try {
    results['2048 Game'] = await test2048Game();
  } catch (error) {
    console.error(`Failed to test 2048: ${error.message}`);
    results['2048 Game'] = { success: false, error: error.message };
  }
  
  // Test GitHub
  try {
    results['GitHub'] = await testGitHubHomepage();
  } catch (error) {
    console.error(`Failed to test GitHub: ${error.message}`);
    results['GitHub'] = { success: false, error: error.message };
  }
  
  // Test Wikipedia
  try {
    results['Wikipedia'] = await testWikipedia();
  } catch (error) {
    console.error(`Failed to test Wikipedia: ${error.message}`);
    results['Wikipedia'] = { success: false, error: error.message };
  }
  
  // Summary
  console.log('\n📊 Test Summary');
  console.log('=' .repeat(60));
  for (const [name, result] of Object.entries(results)) {
    if (result && result.success) {
      console.log(`✅ ${name}: Success`);
      if (result.initialScore !== null) {
        console.log(`   Initial Score: ${result.initialScore}/10`);
      }
      if (result.finalScore !== null) {
        console.log(`   Final Score: ${result.finalScore}/10`);
      }
      if (result.coherence !== null) {
        console.log(`   Temporal Coherence: ${(result.coherence * 100).toFixed(0)}%`);
      }
    } else {
      console.log(`❌ ${name}: Failed`);
      if (result && result.error) {
        console.log(`   Error: ${result.error}`);
      }
    }
  }
  
  return results;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runE2ETests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { runE2ETests, test2048Game, testGitHubHomepage, testWikipedia };

