#!/usr/bin/env node
/**
 * Extended Evaluation Scenarios
 * 
 * Additional evaluation scenarios for comprehensive testing:
 * - Multi-modal evaluation
 * - Temporal evaluation
 * - Persona-based evaluation
 * - Edge case evaluation
 */

import { validateScreenshot, multiModalValidation, experiencePageAsPersona } from '../../src/index.mjs';
import { CHALLENGING_WEBSITES, getAllWebsitesSorted } from './challenging-websites.mjs';
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const RESULTS_DIR = join(process.cwd(), 'evaluation', 'results');
if (!existsSync(RESULTS_DIR)) {
  mkdirSync(RESULTS_DIR, { recursive: true });
}

/**
 * Multi-modal evaluation scenario
 * Tests screenshot + HTML + CSS validation
 */
export async function evaluateMultiModal(websites, options = {}) {
  console.log('🔍 Multi-Modal Evaluation\n');
  
  const { limit = 5 } = options;
  const selectedWebsites = websites.slice(0, limit);
  const results = [];
  
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();
  
  for (const website of selectedWebsites) {
    console.log(`\nEvaluating: ${website.name} (${website.difficulty})`);
    
    try {
      await page.goto(website.url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      
      const screenshotPath = join(RESULTS_DIR, `multimodal-${website.id}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      
      // Multi-modal validation
      const result = await multiModalValidation(
        page,
        'Evaluate this website for accessibility and usability',
        {
          testType: 'multi-modal',
          viewport: { width: 1920, height: 1080 }
        }
      );
      
      results.push({
        website: website.id,
        name: website.name,
        difficulty: website.difficulty,
        result: result
      });
      
      console.log(`   ✅ Score: ${result.score}/10`);
      
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      results.push({
        website: website.id,
        name: website.name,
        error: error.message
      });
    }
  }
  
  await browser.close();
  
  const outputPath = join(RESULTS_DIR, `multimodal-evaluation-${Date.now()}.json`);
  writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n📊 Results saved to: ${outputPath}`);
  
  return results;
}

/**
 * Edge case evaluation
 * Tests unusual or problematic scenarios
 */
export async function evaluateEdgeCases(options = {}) {
  console.log('🔍 Edge Case Evaluation\n');
  
  const edgeCases = [
    {
      id: 'minimal-site',
      name: 'Minimal Site',
      url: 'https://example.com',
      description: 'Minimal HTML, no CSS',
      expectedScore: { min: 5, max: 8 }
    },
    {
      id: 'old-site',
      name: 'Old Design Patterns',
      url: 'https://www.craigslist.org',
      description: 'Outdated design, basic HTML',
      expectedScore: { min: 3, max: 6 }
    },
    {
      id: 'text-only',
      name: 'Text-Heavy Site',
      url: 'https://www.gutenberg.org',
      description: 'Primarily text content',
      expectedScore: { min: 6, max: 9 }
    }
  ];
  
  const results = [];
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();
  
  for (const edgeCase of edgeCases) {
    console.log(`\nEvaluating: ${edgeCase.name}`);
    
    try {
      await page.goto(edgeCase.url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      
      const screenshotPath = join(RESULTS_DIR, `edgecase-${edgeCase.id}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      
      const result = await validateScreenshot(
        screenshotPath,
        `Evaluate this ${edgeCase.description} website for accessibility`,
        {
          testType: 'edge-case',
          viewport: { width: 1280, height: 720 }
        }
      );
      
      results.push({
        edgeCase: edgeCase.id,
        name: edgeCase.name,
        result: result,
        expectedScore: edgeCase.expectedScore
      });
      
      console.log(`   ✅ Score: ${result.score}/10 (expected ${edgeCase.expectedScore.min}-${edgeCase.expectedScore.max})`);
      
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      results.push({
        edgeCase: edgeCase.id,
        name: edgeCase.name,
        error: error.message
      });
    }
  }
  
  await browser.close();
  
  const outputPath = join(RESULTS_DIR, `edgecase-evaluation-${Date.now()}.json`);
  writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n📊 Results saved to: ${outputPath}`);
  
  return results;
}

/**
 * Comprehensive evaluation across all difficulty levels
 */
export async function evaluateAllDifficulties(options = {}) {
  console.log('🔍 Comprehensive Difficulty Evaluation\n');
  
  const websites = getAllWebsitesSorted();
  const difficultyGroups = {};
  
  // Group by difficulty
  websites.forEach(w => {
    if (!difficultyGroups[w.difficulty]) {
      difficultyGroups[w.difficulty] = [];
    }
    difficultyGroups[w.difficulty].push(w);
  });
  
  const results = {};
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();
  
  for (const [difficulty, sites] of Object.entries(difficultyGroups)) {
    console.log(`\n📊 Testing ${difficulty.toUpperCase()} difficulty (${sites.length} sites)`);
    results[difficulty] = [];
    
    for (const website of sites) {
      console.log(`   ${website.name}...`);
      
      try {
        await page.goto(website.url, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(2000);
        
        const screenshotPath = join(RESULTS_DIR, `difficulty-${difficulty}-${website.id}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        
        const { buildChallengePrompt } = await import('./challenging-websites.mjs');
        const prompt = buildChallengePrompt(website);
        
        const result = await validateScreenshot(
          screenshotPath,
          prompt,
          {
            testType: 'difficulty-evaluation',
            viewport: { width: 1920, height: 1080 }
          }
        );
        
        results[difficulty].push({
          website: website.id,
          name: website.name,
          score: result.score,
          issues: result.issues,
          expectedScore: website.expectedScore
        });
        
        console.log(`      ✅ Score: ${result.score}/10`);
        
      } catch (error) {
        console.error(`      ❌ Error: ${error.message}`);
        results[difficulty].push({
          website: website.id,
          name: website.name,
          error: error.message
        });
      }
    }
  }
  
  await browser.close();
  
  const outputPath = join(RESULTS_DIR, `comprehensive-difficulty-${Date.now()}.json`);
  writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n📊 Results saved to: ${outputPath}`);
  
  return results;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const websites = getAllWebsitesSorted();
  evaluateAllDifficulties().catch(console.error);
}

export { evaluateMultiModal, evaluateEdgeCases, evaluateAllDifficulties };

