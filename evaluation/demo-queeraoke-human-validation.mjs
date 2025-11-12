#!/usr/bin/env node
/**
 * Queeraoke Human Validation Demonstration
 * 
 * Demonstrates human validation system using Queeraoke's actual usage patterns:
 * - Interactive gameplay testing
 * - Temporal aggregation
 * - Multi-perspective evaluation
 * - Reactive gameplay testing
 */

import { 
  initHumanValidation, 
  getHumanValidationManager,
  validateScreenshot,
  aggregateTemporalNotes,
  captureTemporalScreenshots,
  extractRenderedCode,
  multiPerspectiveEvaluation
} from '../src/index.mjs';
import { chromium } from 'playwright';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const DEMO_DIR = join(process.cwd(), 'evaluation', 'demo-queeraoke');
if (!existsSync(DEMO_DIR)) {
  mkdirSync(DEMO_DIR, { recursive: true });
}

/**
 * Simulate human validator for Queeraoke evaluations
 */
async function queeraokeHumanValidator(vllmJudgment) {
  console.log(`\n   📸 Human Validation Requested`);
  console.log(`      Test: ${vllmJudgment.context?.testType || 'unknown'}`);
  console.log(`      VLLM Score: ${vllmJudgment.vllmScore}/10`);
  console.log(`      VLLM Issues: ${vllmJudgment.vllmIssues.length} issues`);
  
  // Simulate human judgment with realistic variation
  // Humans might be slightly more lenient or strict
  const variation = (Math.random() - 0.5) * 1.5; // ±0.75 points
  const humanScore = Math.max(0, Math.min(10, 
    Math.round(vllmJudgment.vllmScore + variation)
  ));
  
  // Humans might catch additional issues or miss some
  let humanIssues = [...vllmJudgment.vllmIssues];
  if (Math.random() > 0.7 && vllmJudgment.vllmIssues.length > 0) {
    // Sometimes human finds additional issue
    humanIssues.push('Additional human-identified issue');
  } else if (Math.random() > 0.8 && vllmJudgment.vllmIssues.length > 2) {
    // Sometimes human misses a minor issue
    humanIssues = humanIssues.slice(0, -1);
  }
  
  console.log(`      👤 Human Score: ${humanScore}/10`);
  console.log(`      👤 Human Issues: ${humanIssues.length} issues`);
  
  return {
    score: humanScore,
    issues: humanIssues,
    reasoning: `Human evaluation: ${humanScore}/10. ${vllmJudgment.vllmReasoning.substring(0, 50)}...`,
    evaluatorId: 'queeraoke-reviewer'
  };
}

/**
 * Simulate Queeraoke's interactive gameplay test
 */
async function simulateInteractiveGameplayTest(manager) {
  console.log('\n🎮 Queeraoke Pattern: Interactive Gameplay Testing');
  console.log('   (Multi-perspective evaluation with temporal aggregation)\n');
  
  // Simulate gameplay notes over time
  const gameplayNotes = [
    { step: 'game-start', timestamp: Date.now(), observation: 'Game loaded successfully', score: 8, gameState: { level: 1 } },
    { step: 'first-interaction', timestamp: Date.now() + 1000, observation: 'Controls responsive', score: 9, gameState: { level: 1, score: 100 } },
    { step: 'mid-game', timestamp: Date.now() + 5000, observation: 'Gameplay smooth', score: 8, gameState: { level: 2, score: 500 } },
    { step: 'challenge', timestamp: Date.now() + 10000, observation: 'Difficulty spike noticed', score: 7, gameState: { level: 3, score: 1000 } },
    { step: 'completion', timestamp: Date.now() + 15000, observation: 'Level completed', score: 9, gameState: { level: 4, score: 2000 } }
  ];
  
  // Aggregate temporal notes (Queeraoke pattern)
  const aggregated = aggregateTemporalNotes(gameplayNotes, {
    windowSize: 5000, // 5 second windows
    decayFactor: 0.9
  });
  
  console.log(`   📊 Temporal Notes: ${gameplayNotes.length} notes aggregated`);
  console.log(`   📊 Windows: ${aggregated.windows.length}`);
  console.log(`   📊 Coherence: ${aggregated.coherence.toFixed(2)}`);
  
  // Simulate final evaluation with temporal context
  const finalScreenshot = `demo-queeraoke-gameplay-${Date.now()}.png`;
  const prompt = `Evaluate this gameplay screenshot considering the temporal context:
${aggregated.summary}

Check for:
- Gameplay quality
- Accessibility
- Visual design
- User experience`;
  
  // Simulate VLLM evaluation (would normally call validateScreenshot)
  const vllmResult = {
    score: 8,
    issues: ['minor contrast issue'],
    reasoning: 'Good gameplay overall with minor accessibility concerns',
    assessment: 'Good',
    provider: 'demo',
    screenshotPath: finalScreenshot
  };
  
  // Collect for human validation (automatic in real usage)
  await manager.collectVLLMJudgment(
    vllmResult,
    finalScreenshot,
    prompt,
    {
      testType: 'queeraoke-interactive-gameplay',
      temporalNotes: aggregated,
      gameState: gameplayNotes[gameplayNotes.length - 1].gameState
    }
  );
  
  console.log(`   ✅ Final Evaluation: ${vllmResult.score}/10`);
  console.log(`   ✅ Human validation collected`);
  
  return { vllmResult, aggregated, gameplayNotes };
}

/**
 * Simulate Queeraoke's reactive gameplay test
 */
async function simulateReactiveGameplayTest(manager, page) {
  console.log('\n⚡ Queeraoke Pattern: Reactive Gameplay Testing');
  console.log('   (Continuous screenshots with temporal analysis)\n');
  
  if (!page) {
    console.log('   ⚠️  No page available, simulating...');
    // Simulate temporal screenshots
    const temporalScreenshots = [];
    for (let i = 0; i < 5; i++) {
      temporalScreenshots.push({
        path: `demo-queeraoke-reactive-${i}.png`,
        timestamp: Date.now() + i * 500,
        elapsed: i * 500
      });
    }
    
    // Simulate evaluations for each screenshot
    const notes = [];
    for (let i = 0; i < temporalScreenshots.length; i++) {
      const vllmResult = {
        score: 7 + Math.floor(Math.random() * 2), // 7-8
        issues: i === 2 ? ['frame drop'] : [],
        reasoning: `Frame ${i}: ${i === 2 ? 'Minor performance issue' : 'Smooth'}`,
        provider: 'demo',
        screenshotPath: temporalScreenshots[i].path
      };
      
      notes.push({
        step: `frame-${i}`,
        timestamp: temporalScreenshots[i].timestamp,
        elapsed: temporalScreenshots[i].elapsed,
        observation: vllmResult.reasoning,
        score: vllmResult.score,
        gameState: { frame: i, fps: i === 2 ? 55 : 60 }
      });
      
      await manager.collectVLLMJudgment(
        vllmResult,
        temporalScreenshots[i].path,
        'Evaluate gameplay frame',
        {
          testType: 'queeraoke-reactive-gameplay',
          frame: i,
          fps: i === 2 ? 55 : 60
        }
      );
    }
    
    const aggregated = aggregateTemporalNotes(notes);
    console.log(`   📊 Frames evaluated: ${temporalScreenshots.length}`);
    console.log(`   📊 Temporal aggregation: ${aggregated.windows.length} windows`);
    console.log(`   ✅ Human validation collected for all frames`);
    
    return { notes, aggregated };
  }
  
  // Real implementation would use captureTemporalScreenshots
  console.log('   📸 Capturing temporal screenshots...');
  const temporalScreenshots = await captureTemporalScreenshots(page, 2, 5000); // 2 fps, 5 seconds
  
  console.log(`   ✅ Captured ${temporalScreenshots.length} screenshots`);
  
  // Evaluate each screenshot
  const notes = [];
  for (const screenshot of temporalScreenshots) {
    const result = await validateScreenshot(
      screenshot.path,
      'Evaluate gameplay frame',
      {
        testType: 'queeraoke-reactive-gameplay',
        enableHumanValidation: true
      }
    );
    
    notes.push({
      step: `frame-${screenshot.elapsed}`,
      timestamp: screenshot.timestamp,
      elapsed: screenshot.elapsed,
      observation: result.reasoning || result.assessment || '',
      score: result.score,
      gameState: { elapsed: screenshot.elapsed }
    });
  }
  
  const aggregated = aggregateTemporalNotes(notes);
  console.log(`   📊 Temporal aggregation: ${aggregated.windows.length} windows`);
  
  return { notes, aggregated, temporalScreenshots };
}

/**
 * Simulate Queeraoke's multi-perspective evaluation
 */
async function simulateMultiPerspectiveTest(manager) {
  console.log('\n👥 Queeraoke Pattern: Multi-Perspective Evaluation');
  console.log('   (Multiple personas evaluating same game state)\n');
  
  const personas = [
    { name: 'Casual Gamer', goals: ['fun', 'easy to play'], concerns: ['enjoyment'] },
    { name: 'Accessibility Advocate', goals: ['keyboard navigation', 'screen reader'], concerns: ['accessibility'] },
    { name: 'Power User', goals: ['efficiency', 'shortcuts'], concerns: ['performance'] }
  ];
  
  const screenshot = `demo-queeraoke-multiperspective-${Date.now()}.png`;
  const basePrompt = 'Evaluate this gameplay screenshot from your perspective';
  
  const evaluations = [];
  
  for (const persona of personas) {
    const prompt = `${basePrompt}. You are a ${persona.name}. Your goals: ${persona.goals.join(', ')}. Your concerns: ${persona.concerns.join(', ')}.`;
    
    // Simulate VLLM evaluation
    const vllmResult = {
      score: 7 + Math.floor(Math.random() * 2), // 7-8
      issues: persona.name === 'Accessibility Advocate' ? ['keyboard navigation'] : [],
      reasoning: `${persona.name} perspective: ${persona.concerns[0]} is ${persona.name === 'Accessibility Advocate' ? 'concerning' : 'acceptable'}`,
      assessment: 'Good',
      provider: 'demo',
      screenshotPath: screenshot
    };
    
    evaluations.push({
      persona: persona.name,
      evaluation: vllmResult
    });
    
    // Collect for human validation
    await manager.collectVLLMJudgment(
      vllmResult,
      screenshot,
      prompt,
      {
        testType: 'queeraoke-multiperspective',
        persona: persona
      }
    );
    
    console.log(`   👤 ${persona.name}: ${vllmResult.score}/10`);
  }
  
  // Aggregate perspectives
  const avgScore = evaluations.reduce((sum, e) => sum + e.evaluation.score, 0) / evaluations.length;
  const allIssues = [...new Set(evaluations.flatMap(e => e.evaluation.issues))];
  
  console.log(`   📊 Average Score: ${avgScore.toFixed(1)}/10`);
  console.log(`   📊 All Issues: ${allIssues.join(', ') || 'None'}`);
  console.log(`   ✅ Human validation collected for all personas`);
  
  return { evaluations, avgScore, allIssues };
}

/**
 * Main demonstration
 */
async function demonstrateQueeraokeHumanValidation() {
  console.log('🎯 Queeraoke Human Validation Demonstration\n');
  console.log('='.repeat(60));
  console.log('Demonstrating human validation with Queeraoke usage patterns\n');
  
  // Step 1: Initialize human validation
  console.log('📋 Step 1: Initializing Human Validation for Queeraoke');
  const manager = initHumanValidation({
    enabled: true,
    autoCollect: true,
    smartSampling: true,
    humanValidatorFn: queeraokeHumanValidator
  });
  
  console.log('   ✅ Human validation enabled');
  console.log('   ✅ Smart sampling enabled (focuses on interesting cases)');
  console.log('   ✅ Queeraoke-specific validator configured\n');
  
  // Step 2: Interactive gameplay test
  const gameplayResult = await simulateInteractiveGameplayTest(manager);
  
  // Step 3: Reactive gameplay test
  let browser = null;
  let page = null;
  try {
    browser = await chromium.launch();
    page = await browser.newPage();
    await page.goto('about:blank'); // Just for demo structure
  } catch (error) {
    // Continue without browser
  }
  
  const reactiveResult = await simulateReactiveGameplayTest(manager, page);
  
  if (browser) {
    await browser.close();
  }
  
  // Step 4: Multi-perspective test
  const perspectiveResult = await simulateMultiPerspectiveTest(manager);
  
  // Step 5: Show calibration status
  console.log('\n📊 Step 5: Calibration Status');
  const status = manager.getCalibrationStatus();
  
  console.log(`   📝 VLLM judgments collected: ${manager.vllmJudgments.length}`);
  console.log(`   👤 Human judgments: ${status.calibrated ? 'Available' : 'Collecting...'}`);
  
  if (status.calibrated) {
    console.log(`   ✅ Calibrated: Yes`);
    console.log(`   📈 Correlation: ${status.correlation.toFixed(3)}`);
    console.log(`   📈 Kappa: ${status.kappa.toFixed(3)}`);
    console.log(`   📈 MAE: ${status.mae.toFixed(2)} points`);
    console.log(`   ${status.isGood ? '✅' : '⚠️'} Status: ${status.isGood ? 'Good' : 'Needs Improvement'}`);
  } else {
    console.log(`   ⏳ Not yet calibrated`);
    console.log(`   💡 Need 10+ human judgments for calibration`);
    console.log(`   💡 System will auto-calibrate when ready`);
  }
  
  // Step 6: Summary
  console.log('\n📋 Step 6: Summary');
  console.log(`   ✅ Interactive gameplay test: Completed`);
  console.log(`   ✅ Reactive gameplay test: Completed`);
  console.log(`   ✅ Multi-perspective test: Completed`);
  console.log(`   📊 Total VLLM judgments: ${manager.vllmJudgments.length}`);
  console.log(`   📊 Test types: queeraoke-interactive-gameplay, queeraoke-reactive-gameplay, queeraoke-multiperspective`);
  
  // Save results
  const resultsPath = join(DEMO_DIR, `queeraoke-demo-${Date.now()}.json`);
  writeFileSync(resultsPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    gameplay: gameplayResult,
    reactive: reactiveResult,
    perspectives: perspectiveResult,
    calibrationStatus: status,
    vllmJudgmentsCount: manager.vllmJudgments.length
  }, null, 2));
  
  console.log(`\n💾 Results saved to: ${resultsPath}`);
  
  console.log('\n💡 Next Steps:');
  console.log('   1. Provide human judgments for collected VLLM evaluations');
  console.log('   2. System will auto-calibrate after 10+ human judgments');
  console.log('   3. Calibrated scores will improve Queeraoke test accuracy');
  console.log('   4. Check status: manager.getCalibrationStatus()');
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Queeraoke Human Validation Demonstration Complete!\n');
  
  console.log('💡 Integration:');
  console.log('   - Human validation works automatically with Queeraoke tests');
  console.log('   - No code changes needed in Queeraoke');
  console.log('   - Just enable with: initHumanValidation()');
  console.log('   - All validateScreenshot() calls will collect data\n');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateQueeraokeHumanValidation().catch(error => {
    console.error('❌ Demonstration failed:', error);
    process.exit(1);
  });
}

export { demonstrateQueeraokeHumanValidation };

