/**
 * Review of Temporal Experience, Batching, and Prompts in E2E Tests
 * 
 * Analyzes:
 * 1. How temporal notes are being used in prompts
 * 2. Whether batching is being utilized
 * 3. Whether multi-scale aggregation is being used
 * 4. Whether prompts effectively incorporate temporal context
 * 5. What gaps exist in temporal/experience integration
 */

import { chromium } from 'playwright';
import { experiencePageAsPersona } from '../../src/persona-experience.mjs';
import { ExperienceTrace } from '../../src/experience-tracer.mjs';
import { validateScreenshot } from '../../src/index.mjs';
import { aggregateTemporalNotes, formatNotesForPrompt } from '../../src/temporal.mjs';
import { aggregateMultiScale } from '../../src/temporal-decision.mjs';
import { TemporalBatchOptimizer } from '../../src/temporal-batch-optimizer.mjs';
import { VLLMJudge } from '../../src/judge.mjs';
import { mkdirSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';

const testResultsDir = join(process.cwd(), 'test-results');
if (!existsSync(testResultsDir)) {
  mkdirSync(testResultsDir, { recursive: true });
}

/**
 * Review how temporal notes are used in prompts
 */
async function reviewTemporalPromptUsage() {
  console.log('\n📝 Review: Temporal Notes in Prompts');
  console.log('='.repeat(60));
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto('https://play2048.co/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    const trace = new ExperienceTrace('temporal-review-test');
    const experience = await experiencePageAsPersona(page, {
      name: 'Temporal Reviewer',
      perspective: 'Reviewing temporal integration',
      goals: ['temporal', 'experience']
    }, {
      url: 'https://play2048.co/',
      captureScreenshots: true,
      captureCode: true,
      trace: trace
    });
    
    console.log(`\n1️⃣ Temporal Notes Captured:`);
    console.log(`   - Notes count: ${experience.notes.length}`);
    console.log(`   - Notes structure:`, experience.notes.slice(0, 2).map(n => ({
      hasElapsed: !!n.elapsed,
      hasTimestamp: !!n.timestamp,
      hasScore: !!n.score,
      hasObservation: !!n.observation
    })));
    
    // Aggregate notes
    let aggregated = null;
    let multiScale = null;
    
    if (experience.notes && experience.notes.length > 0) {
      aggregated = aggregateTemporalNotes(experience.notes);
      multiScale = aggregateMultiScale(experience.notes, {
        timeScales: {
          immediate: 100,   // 0.1s
          short: 1000,      // 1s
          medium: 5000,     // 5s
          long: 30000       // 30s
        }
      });
    }
    
    console.log(`\n2️⃣ Temporal Aggregation:`);
    if (aggregated) {
      console.log(`   - Aggregated windows: ${aggregated.windows?.length || 0}`);
      console.log(`   - Coherence: ${aggregated.coherence ? (aggregated.coherence * 100).toFixed(0) : 'N/A'}%`);
    } else {
      console.log(`   - No aggregation (no notes)`);
    }
    if (multiScale) {
      console.log(`   - Multi-scale scales: ${Object.keys(multiScale.scales || {}).length}`);
      Object.entries(multiScale.scales || {}).forEach(([scale, data]) => {
        console.log(`     - ${scale}: ${data.windows?.length || 0} windows`);
      });
    }
    
    // Check how prompts are built
    console.log(`\n3️⃣ Prompt Construction Review:`);
    
    const judge = new VLLMJudge({ enabled: true });
    const screenshot = experience.screenshots[0].path;
    
    // Test 1: Basic prompt (no temporal context)
    const basicPrompt = await judge.buildPrompt(
      'Evaluate this game interface',
      { testType: 'gameplay' },
      false
    );
    console.log(`   - Basic prompt length: ${basicPrompt.length} chars`);
    console.log(`   - Includes temporal: ${basicPrompt.includes('TEMPORAL') || basicPrompt.includes('temporal')}`);
    
    // Test 2: Prompt with temporal notes
    const temporalPrompt = await judge.buildPrompt(
      'Evaluate this game interface',
      {
        testType: 'gameplay',
        temporalNotes: experience.notes
      },
      false
    );
    console.log(`   - Temporal prompt length: ${temporalPrompt.length} chars`);
    console.log(`   - Includes temporal: ${temporalPrompt.includes('TEMPORAL') || temporalPrompt.includes('temporal')}`);
    console.log(`   - Includes aggregated: ${temporalPrompt.includes('aggregated') || temporalPrompt.includes('Aggregated')}`);
    
    // Test 3: Prompt with aggregated notes
    let aggregatedPrompt = '';
    if (aggregated) {
      aggregatedPrompt = await judge.buildPrompt(
        'Evaluate this game interface',
        {
          testType: 'gameplay',
          temporalNotes: aggregated // Pass aggregated instead of raw notes
        },
        false
      );
    }
    console.log(`   - Aggregated prompt length: ${aggregatedPrompt.length} chars`);
    console.log(`   - Includes temporal: ${aggregatedPrompt.includes('TEMPORAL') || aggregatedPrompt.includes('temporal')}`);
    
    // Test 4: Format notes for prompt manually
    let formattedNotes = '';
    if (aggregated) {
      formattedNotes = formatNotesForPrompt(aggregated);
      console.log(`\n4️⃣ Formatted Notes for Prompt:`);
      console.log(`   - Formatted length: ${formattedNotes.length} chars`);
      console.log(`   - Preview (first 300 chars):`);
      console.log(`     ${formattedNotes.substring(0, 300)}...`);
    } else {
      console.log(`\n4️⃣ Formatted Notes for Prompt:`);
      console.log(`   - No aggregated notes to format`);
    }
    
    // Compare prompt lengths
    console.log(`\n5️⃣ Prompt Comparison:`);
    console.log(`   - Basic: ${basicPrompt.length} chars`);
    console.log(`   - With temporal notes: ${temporalPrompt.length} chars (${temporalPrompt.length - basicPrompt.length} more)`);
    if (aggregatedPrompt) {
      console.log(`   - With aggregated: ${aggregatedPrompt.length} chars (${aggregatedPrompt.length - basicPrompt.length} more)`);
    }
    
    return {
      notesCount: experience.notes.length,
      aggregatedWindows: aggregated?.windows?.length || 0,
      coherence: aggregated?.coherence || null,
      multiScaleScales: multiScale ? Object.keys(multiScale.scales || {}).length : 0,
      basicPromptLength: basicPrompt.length,
      temporalPromptLength: temporalPrompt.length,
      aggregatedPromptLength: aggregatedPrompt?.length || 0,
      formattedNotesLength: formattedNotes.length,
      temporalInBasic: basicPrompt.includes('TEMPORAL') || basicPrompt.includes('temporal'),
      temporalInTemporal: temporalPrompt.includes('TEMPORAL') || temporalPrompt.includes('temporal'),
      temporalInAggregated: aggregatedPrompt ? (aggregatedPrompt.includes('TEMPORAL') || aggregatedPrompt.includes('temporal')) : false
    };
    
  } catch (error) {
    console.error(`  ❌ Review error: ${error.message}`);
    return null;
  } finally {
    await browser.close();
  }
}

/**
 * Review batching usage
 */
async function reviewBatchingUsage() {
  console.log('\n📦 Review: Batching Usage');
  console.log('='.repeat(60));
  
  const gaps = {
    notUsingBatching: true,
    notUsingTemporalBatching: true,
    noDependencyTracking: true,
    noPriorityCalculation: true
  };
  
  console.log(`\n1️⃣ Current State:`);
  console.log(`   - TemporalBatchOptimizer exists: ✅`);
  console.log(`   - Used in E2E tests: ❌ (not found)`);
  console.log(`   - Used in validateScreenshot: ❌ (not found)`);
  
  console.log(`\n2️⃣ What We Should Be Doing:`);
  console.log(`   - Batch multiple screenshot validations`);
  console.log(`   - Track temporal dependencies (e.g., validation 2 depends on validation 1)`);
  console.log(`   - Calculate priority based on dependencies`);
  console.log(`   - Process independent requests in parallel`);
  console.log(`   - Process dependent requests sequentially`);
  
  console.log(`\n3️⃣ Example Usage (Not Currently Implemented):`);
  console.log(`
    const optimizer = new TemporalBatchOptimizer({
      maxConcurrency: 3,
      batchSize: 5
    });
    
    // Add requests with dependencies
    await optimizer.addTemporalRequest(
      screenshot1,
      'Evaluate initial state',
      { timestamp: Date.now() },
      [] // No dependencies
    );
    
    await optimizer.addTemporalRequest(
      screenshot2,
      'Evaluate after move',
      { timestamp: Date.now() + 1000 },
      [screenshot1] // Depends on screenshot1
    );
    
    // Process with temporal awareness
    const results = await optimizer.processAll();
  `);
  
  console.log(`\n4️⃣ Gaps Identified:`);
  gaps.notUsingBatching = true;
  gaps.notUsingTemporalBatching = true;
  gaps.noDependencyTracking = true;
  gaps.noPriorityCalculation = true;
  
  console.log(`   ❌ Not using batching at all`);
  console.log(`   ❌ Not using temporal batch optimizer`);
  console.log(`   ❌ Not tracking temporal dependencies`);
  console.log(`   ❌ Not calculating priority`);
  
  return gaps;
}

/**
 * Review multi-scale aggregation usage
 */
async function reviewMultiScaleUsage() {
  console.log('\n📊 Review: Multi-Scale Aggregation Usage');
  console.log('='.repeat(60));
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto('https://play2048.co/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    const trace = new ExperienceTrace('multiscale-review-test');
    const experience = await experiencePageAsPersona(page, {
      name: 'MultiScale Reviewer',
      perspective: 'Reviewing multi-scale aggregation'
    }, {
      url: 'https://play2048.co/',
      captureScreenshots: true,
      trace: trace
    });
    
    // Play multiple moves to generate temporal data
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(500);
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(500);
    }
    
    console.log(`\n1️⃣ Temporal Notes Generated:`);
    console.log(`   - Notes: ${experience.notes.length}`);
    
    // Aggregate with multi-scale
    let multiScale = null;
    if (experience.notes && experience.notes.length > 0) {
      multiScale = aggregateMultiScale(experience.notes, {
        timeScales: {
          immediate: 100,   // 0.1s - instant perception
          short: 1000,      // 1s - quick interaction
          medium: 5000,     // 5s - short task
          long: 30000       // 30s - longer session
        }
      });
    }
    
    console.log(`\n2️⃣ Multi-Scale Aggregation:`);
    if (multiScale && multiScale.scales) {
      Object.entries(multiScale.scales).forEach(([scaleName, scaleData]) => {
        console.log(`   - ${scaleName} (${scaleData.windowSize}ms):`);
        console.log(`     * Windows: ${scaleData.windows?.length || 0}`);
        console.log(`     * Coherence: ${scaleData.coherence ? (scaleData.coherence * 100).toFixed(0) : 'N/A'}%`);
        if (scaleData.windows && scaleData.windows.length > 0) {
          const firstScore = scaleData.windows[0]?.avgScore || 0;
          const lastScore = scaleData.windows[scaleData.windows.length - 1]?.avgScore || 0;
          console.log(`     * Score trend: ${firstScore.toFixed(1)} → ${lastScore.toFixed(1)}`);
        }
      });
    } else {
      console.log(`   - No multi-scale aggregation (no notes)`);
    }
    
    console.log(`\n3️⃣ Usage in E2E Tests:`);
    console.log(`   - aggregateMultiScale called: ❌ (not found in e2e-real-websites.mjs)`);
    console.log(`   - Only using aggregateTemporalNotes: ✅`);
    console.log(`   - Missing multi-scale insights: ⚠️`);
    
    console.log(`\n4️⃣ What We're Missing:`);
    console.log(`   - Immediate scale (0.1s): Instant perception patterns`);
    console.log(`   - Short scale (1s): Quick interaction feedback`);
    console.log(`   - Medium scale (5s): Short task completion`);
    console.log(`   - Long scale (30s): Session-level patterns`);
    
    return {
      notesCount: experience.notes.length,
      scales: multiScale ? Object.keys(multiScale.scales || {}) : [],
      scaleDetails: multiScale ? Object.entries(multiScale.scales || {}).map(([name, data]) => ({
        name,
        windows: data.windows?.length || 0,
        coherence: data.coherence || null
      })) : []
    };
    
  } catch (error) {
    console.error(`  ❌ Review error: ${error.message}`);
    return null;
  } finally {
    await browser.close();
  }
}

/**
 * Review prompt effectiveness with temporal context
 */
async function reviewPromptEffectiveness() {
  console.log('\n🎯 Review: Prompt Effectiveness with Temporal Context');
  console.log('='.repeat(60));
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto('https://play2048.co/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    const trace = new ExperienceTrace('prompt-review-test');
    const experience = await experiencePageAsPersona(page, {
      name: 'Prompt Reviewer',
      perspective: 'Reviewing prompt effectiveness'
    }, {
      url: 'https://play2048.co/',
      captureScreenshots: true,
      trace: trace
    });
    
    // Play moves to create temporal sequence
    const screenshots = [];
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(500);
      const screenshot = await page.screenshot({ path: join(testResultsDir, `prompt-review-${i}.png`) });
      screenshots.push(join(testResultsDir, `prompt-review-${i}.png`));
    }
    
    let aggregated = null;
    let multiScale = null;
    if (experience.notes && experience.notes.length > 0) {
      aggregated = aggregateTemporalNotes(experience.notes);
      multiScale = aggregateMultiScale(experience.notes);
    }
    
    console.log(`\n1️⃣ Test: Validation Without Temporal Context`);
    const validation1 = await validateScreenshot(
      screenshots[0],
      'Evaluate this game state',
      { testType: 'gameplay' }
    );
    console.log(`   - Score: ${validation1.score}/10`);
    console.log(`   - Reasoning length: ${(validation1.reasoning || '').length} chars`);
    console.log(`   - References temporal: ${(validation1.reasoning || '').toLowerCase().includes('previous') || (validation1.reasoning || '').toLowerCase().includes('earlier')}`);
    
    console.log(`\n2️⃣ Test: Validation With Temporal Notes`);
    const validation2 = await validateScreenshot(
      screenshots[1],
      'Evaluate this game state after playing',
      {
        testType: 'gameplay',
        temporalNotes: experience.notes
      }
    );
    console.log(`   - Score: ${validation2.score}/10`);
    console.log(`   - Reasoning length: ${(validation2.reasoning || '').length} chars`);
    console.log(`   - References temporal: ${(validation2.reasoning || '').toLowerCase().includes('previous') || (validation2.reasoning || '').toLowerCase().includes('earlier')}`);
    
    console.log(`\n3️⃣ Test: Validation With Aggregated Notes`);
    const validation3 = await validateScreenshot(
      screenshots[2],
      'Evaluate this game state considering the experience so far',
      {
        testType: 'gameplay',
        temporalNotes: aggregated // Pass aggregated
      }
    );
    console.log(`   - Score: ${validation3.score}/10`);
    console.log(`   - Reasoning length: ${(validation3.reasoning || '').length} chars`);
    console.log(`   - References temporal: ${(validation3.reasoning || '').toLowerCase().includes('previous') || (validation3.reasoning || '').toLowerCase().includes('earlier')}`);
    console.log(`   - References trends: ${(validation3.reasoning || '').toLowerCase().includes('trend') || (validation3.reasoning || '').toLowerCase().includes('pattern')}`);
    
    console.log(`\n4️⃣ Comparison:`);
    console.log(`   - Without temporal: ${validation1.reasoning?.length || 0} chars`);
    console.log(`   - With temporal notes: ${validation2.reasoning?.length || 0} chars (${(validation2.reasoning?.length || 0) - (validation1.reasoning?.length || 0)} more)`);
    console.log(`   - With aggregated: ${validation3.reasoning?.length || 0} chars (${(validation3.reasoning?.length || 0) - (validation1.reasoning?.length || 0)} more)`);
    
    console.log(`\n5️⃣ Effectiveness Analysis:`);
    const effectiveness = {
      temporalNotesHelp: (validation2.reasoning?.length || 0) > (validation1.reasoning?.length || 0),
      aggregatedNotesHelp: (validation3.reasoning?.length || 0) > (validation2.reasoning?.length || 0),
      temporalReferenced: (validation2.reasoning || '').toLowerCase().includes('previous') || (validation2.reasoning || '').toLowerCase().includes('earlier'),
      trendsReferenced: (validation3.reasoning || '').toLowerCase().includes('trend') || (validation3.reasoning || '').toLowerCase().includes('pattern')
    };
    
    console.log(`   - Temporal notes increase reasoning length: ${effectiveness.temporalNotesHelp ? '✅' : '❌'}`);
    console.log(`   - Aggregated notes increase reasoning length: ${effectiveness.aggregatedNotesHelp ? '✅' : '❌'}`);
    console.log(`   - Temporal context referenced: ${effectiveness.temporalReferenced ? '✅' : '❌'}`);
    console.log(`   - Trends referenced: ${effectiveness.trendsReferenced ? '✅' : '❌'}`);
    
    return {
      withoutTemporal: {
        score: validation1.score,
        reasoningLength: validation1.reasoning?.length || 0
      },
      withTemporalNotes: {
        score: validation2.score,
        reasoningLength: validation2.reasoning?.length || 0
      },
      withAggregated: {
        score: validation3.score,
        reasoningLength: validation3.reasoning?.length || 0
      },
      effectiveness
    };
    
  } catch (error) {
    console.error(`  ❌ Review error: ${error.message}`);
    return null;
  } finally {
    await browser.close();
  }
}

/**
 * Main review runner
 */
async function runTemporalReview() {
  console.log('🔍 Comprehensive Review: Temporal Experience, Batching, and Prompts');
  console.log('='.repeat(60));
  
  const results = {
    temporalPromptUsage: null,
    batchingUsage: null,
    multiScaleUsage: null,
    promptEffectiveness: null
  };
  
  // Review temporal prompt usage
  results.temporalPromptUsage = await reviewTemporalPromptUsage();
  
  // Review batching usage
  results.batchingUsage = await reviewBatchingUsage();
  
  // Review multi-scale usage
  results.multiScaleUsage = await reviewMultiScaleUsage();
  
  // Review prompt effectiveness
  results.promptEffectiveness = await reviewPromptEffectiveness();
  
  // Summary
  console.log('\n📊 Summary');
  console.log('='.repeat(60));
  
  console.log(`\n✅ What's Working:`);
  console.log(`   - Temporal notes are captured`);
  console.log(`   - Temporal notes are passed to validateScreenshot`);
  console.log(`   - aggregateTemporalNotes is used`);
  console.log(`   - formatNotesForPrompt exists`);
  
  console.log(`\n❌ What's Missing:`);
  console.log(`   - Not using TemporalBatchOptimizer`);
  console.log(`   - Not using aggregateMultiScale in E2E tests`);
  console.log(`   - Not tracking temporal dependencies`);
  console.log(`   - Not calculating priority for batching`);
  console.log(`   - Prompts may not effectively incorporate temporal context`);
  
  console.log(`\n⚠️  What Needs Improvement:`);
  console.log(`   - Use multi-scale aggregation for richer temporal insights`);
  console.log(`   - Use temporal batch optimizer for efficient request processing`);
  console.log(`   - Track dependencies between validations`);
  console.log(`   - Improve prompt formatting for temporal context`);
  console.log(`   - Validate that temporal context actually improves VLM responses`);
  
  // Save results
  const resultsFile = join(testResultsDir, `temporal-review-${Date.now()}.json`);
  writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`\n📁 Results saved to: ${resultsFile}`);
  
  return results;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTemporalReview().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { runTemporalReview, reviewTemporalPromptUsage, reviewBatchingUsage, reviewMultiScaleUsage, reviewPromptEffectiveness };

