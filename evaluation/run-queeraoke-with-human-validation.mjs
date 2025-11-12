#!/usr/bin/env node
/**
 * Run Queeraoke Test with Human Validation
 * 
 * This script runs a Queeraoke test with human validation enabled.
 * It demonstrates the integration in a real test scenario.
 */

import { initHumanValidation, getHumanValidationManager } from '../src/index.mjs';
import { validateScreenshot } from '../src/index.mjs';
import { chromium } from 'playwright';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const RESULTS_DIR = join(process.cwd(), 'evaluation', 'queeraoke-results');
if (!existsSync(RESULTS_DIR)) {
  mkdirSync(RESULTS_DIR, { recursive: true });
}

/**
 * Queeraoke-style human validator
 */
async function queeraokeHumanValidator(vllmJudgment) {
  console.log(`\n   📸 [Queeraoke] Human Validation Requested`);
  console.log(`      Test: ${vllmJudgment.context?.testType || 'unknown'}`);
  console.log(`      VLLM Score: ${vllmJudgment.vllmScore}/10`);
  console.log(`      VLLM Issues: ${vllmJudgment.vllmIssues.join(', ') || 'None'}`);
  console.log(`      Screenshot: ${vllmJudgment.screenshot}`);
  
  // In real usage, you would:
  // 1. Display screenshot in UI
  // 2. Show VLLM judgment
  // 3. Collect human input
  // 4. Return human judgment
  
  // For demo: simulate with variation
  const humanScore = Math.max(0, Math.min(10, 
    Math.round(vllmJudgment.vllmScore + (Math.random() - 0.5) * 1.5)
  ));
  
  const humanIssues = [...vllmJudgment.vllmIssues];
  if (Math.random() > 0.7 && vllmJudgment.vllmIssues.length > 0) {
    humanIssues.push('Additional human-identified issue');
  }
  
  console.log(`      👤 Human Score: ${humanScore}/10`);
  console.log(`      👤 Human Issues: ${humanIssues.length} issues`);
  
  return {
    score: humanScore,
    issues: humanIssues,
    reasoning: `Human evaluation: ${humanScore}/10`,
    evaluatorId: 'queeraoke-reviewer'
  };
}

/**
 * Run Queeraoke-style interactive game test
 */
async function runQueeraokeInteractiveTest() {
  console.log('🎮 Running Queeraoke Interactive Game Test with Human Validation\n');
  console.log('='.repeat(60));
  
  // Initialize human validation
  console.log('\n📋 Initializing Human Validation...');
  const manager = initHumanValidation({
    enabled: true,
    autoCollect: true,
    smartSampling: true,
    humanValidatorFn: queeraokeHumanValidator
  });
  
  console.log('   ✅ Human validation enabled\n');
  
  // Simulate Queeraoke test pattern
  const browser = await chromium.launch();
  const page = await browser.newContext().then(ctx => ctx.newPage());
  
  try {
    // Navigate to a test page (or use Queeraoke's actual game)
    console.log('📸 Step 1: Capturing Screenshot');
    await page.goto('about:blank');
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head><title>Test Game</title></head>
        <body>
          <h1>Test Game Interface</h1>
          <canvas id="game" width="800" height="600" style="border: 1px solid #000;"></canvas>
          <div id="score">Score: 0</div>
        </body>
      </html>
    `);
    await page.waitForTimeout(1000);
    
    const screenshotPath = join(RESULTS_DIR, `queeraoke-test-${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`   ✅ Screenshot captured: ${screenshotPath}\n`);
    
    // Step 2: Extract rendered code (Queeraoke pattern)
    console.log('📋 Step 2: Extracting Rendered Code');
    const { extractRenderedCode } = await import('../src/index.mjs');
    const renderedCode = await extractRenderedCode(page);
    console.log(`   ✅ Extracted: ${renderedCode.domStructure ? 'DOM structure' : 'Code'}\n`);
    
    // Step 3: Simulate game state
    const gameState = {
      level: 1,
      score: 100,
      lives: 3,
      gameActive: true
    };
    
    // Step 4: Multi-perspective evaluation (Queeraoke pattern)
    console.log('👥 Step 3: Multi-Perspective Evaluation');
    const personas = [
      { name: 'Casual Gamer', goals: ['fun'], concerns: ['enjoyment'] },
      { name: 'Accessibility Advocate', goals: ['accessibility'], concerns: ['keyboard navigation'] }
    ];
    
    const { multiPerspectiveEvaluation } = await import('../src/index.mjs');
    const perspectives = await multiPerspectiveEvaluation(
      async (path, prompt, context) => {
        return await validateScreenshot(path, prompt, {
          ...context,
          enableHumanValidation: true // Human validation collected automatically
        });
      },
      screenshotPath,
      renderedCode,
      gameState,
      personas.map(p => ({
        name: p.name,
        perspective: p.goals ? `Goals: ${p.goals.join(', ')}. Concerns: ${p.concerns.join(', ')}.` : p.name,
        focus: [...(p.goals || []), ...(p.concerns || [])],
        device: p.device || 'desktop'
      }))
    );
    
    console.log(`   ✅ Evaluated with ${perspectives.length} personas`);
    perspectives.forEach(p => {
      console.log(`      ${p.persona.name}: ${p.evaluation?.score || 'N/A'}/10`);
    });
    console.log();
    
    // Step 5: Temporal aggregation (Queeraoke pattern)
    // CRITICAL: Use fixed temporal aggregation system with multi-scale
    console.log('📊 Step 4: Temporal Aggregation');
    const notes = perspectives.map((p, i) => ({
      step: `persona-${i}`,
      timestamp: Date.now() + i * 1000,
      elapsed: i * 1000,
      observation: p.evaluation?.reasoning || '',
      score: p.evaluation?.score || 0,
      gameState: gameState
    }));
    
    const { aggregateTemporalNotes, aggregateMultiScale } = await import('../src/index.mjs');
    
    // Standard temporal aggregation
    const aggregated = aggregateTemporalNotes(notes, {
      windowSize: 2000, // 2s windows for persona perspectives
      decayFactor: 0.9
    });
    
    // Multi-scale aggregation for richer analysis
    const aggregatedMultiScale = aggregateMultiScale(notes, {
      attentionWeights: true
    });
    
    console.log(`   ✅ Aggregated ${notes.length} notes into ${aggregated.windows.length} windows`);
    console.log(`   ✅ Coherence: ${aggregated.coherence.toFixed(2)}`);
    console.log(`   ✅ Multi-scale: ${Object.keys(aggregatedMultiScale.scales || {}).length} scales`);
    console.log(`   ✅ Conflicts: ${aggregated.conflicts.length}\n`);
    
    // Step 5: Final evaluation with temporal context
    // CRITICAL: Use formatted temporal notes in prompt
    console.log('🔍 Step 5: Final Evaluation with Temporal Context');
    const { formatNotesForPrompt } = await import('../src/index.mjs');
    const temporalContext = formatNotesForPrompt(aggregated);
    
    const finalPrompt = `Evaluate this gameplay screenshot considering the temporal context:

${temporalContext}

Check for:
- Gameplay quality
- Accessibility
- Visual design
- User experience`;
    
    // CRITICAL: Include temporal notes in context for prompt composition
    const finalResult = await validateScreenshot(
      screenshotPath,
      finalPrompt,
      {
        testType: 'queeraoke-interactive-game',
        temporalNotes: aggregated, // CRITICAL: Include aggregated notes
        viewport: { width: 1280, height: 720 },
        enableHumanValidation: true,
        gameState: gameState
      }
    );
    
    console.log(`   ✅ Final Score: ${finalResult.score}/10`);
    if (finalResult.calibrated) {
      console.log(`   📊 Original Score: ${finalResult.originalScore}/10 (calibrated)`);
    }
    if (finalResult.issues && finalResult.issues.length > 0) {
      console.log(`   ⚠️  Issues: ${finalResult.issues.join(', ')}`);
    }
    console.log();
    
    // Step 6: Show calibration status
    console.log('📊 Step 6: Calibration Status');
    const status = manager.getCalibrationStatus();
    console.log(`   📝 VLLM judgments: ${manager.vllmJudgments.length}`);
    console.log(`   👤 Human judgments: ${status.calibrated ? 'Available' : 'Collecting...'}`);
    
    if (status.calibrated) {
      console.log(`   ✅ Calibrated: Yes`);
      console.log(`   📈 Correlation: ${status.correlation.toFixed(3)}`);
      console.log(`   📈 Kappa: ${status.kappa.toFixed(3)}`);
      console.log(`   ${status.isGood ? '✅' : '⚠️'} Status: ${status.isGood ? 'Good' : 'Needs Improvement'}`);
    } else {
      console.log(`   ⏳ Not yet calibrated (need 10+ human judgments)`);
    }
    
    // Save results
    const resultsPath = join(RESULTS_DIR, `queeraoke-test-results-${Date.now()}.json`);
    writeFileSync(resultsPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      perspectives,
      aggregated,
      finalResult,
      calibrationStatus: status,
      vllmJudgmentsCount: manager.vllmJudgments.length
    }, null, 2));
    
    console.log(`\n💾 Results saved to: ${resultsPath}`);
    console.log('\n✅ Queeraoke test with human validation complete!\n');
    
    return {
      perspectives,
      aggregated,
      finalResult,
      status
    };
    
  } finally {
    await browser.close();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runQueeraokeInteractiveTest().catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
}

export { runQueeraokeInteractiveTest };

