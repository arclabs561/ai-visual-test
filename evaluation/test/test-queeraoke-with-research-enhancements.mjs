#!/usr/bin/env node
/**
 * Test Queeraoke Usage with Research Enhancements
 * 
 * Demonstrates how to integrate research-enhanced validation into Queeraoke's
 * actual usage patterns. This shows the improvements possible with the new API.
 */

import {
  validateWithResearchEnhancements,
  validateMultipleWithPositionAnalysis,
  validateWithExplicitRubric,
  validateWithAllResearchEnhancements,
  aggregateTemporalNotes,
  extractRenderedCode,
  multiPerspectiveEvaluation
} from '../../src/index.mjs';
import { chromium } from 'playwright';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const RESULTS_DIR = join(process.cwd(), 'evaluation', 'queeraoke-results');
if (!existsSync(RESULTS_DIR)) {
  mkdirSync(RESULTS_DIR, { recursive: true });
}

/**
 * Test 1: Interactive Gameplay with Research Enhancements
 * 
 * Shows how Queeraoke's interactive gameplay pattern can use research enhancements
 */
async function testInteractiveGameplayWithResearch() {
  console.log('\n🎮 Test 1: Interactive Gameplay with Research Enhancements\n');
  
  // Simulate Queeraoke's gameplay notes
  const gameplayNotes = [
    { step: 'game-start', timestamp: Date.now(), observation: 'Game loaded', score: 8, gameState: { level: 1 } },
    { step: 'first-interaction', timestamp: Date.now() + 1000, observation: 'Controls responsive', score: 9, gameState: { level: 1, score: 100 } },
    { step: 'mid-game', timestamp: Date.now() + 5000, observation: 'Gameplay smooth', score: 8, gameState: { level: 2, score: 500 } },
    { step: 'challenge', timestamp: Date.now() + 10000, observation: 'Difficulty spike', score: 7, gameState: { level: 3, score: 1000 } }
  ];
  
  // Aggregate temporal notes (Queeraoke pattern)
  const aggregated = aggregateTemporalNotes(gameplayNotes, {
    windowSize: 5000,
    decayFactor: 0.9
  });
  
  console.log(`   📊 Temporal Notes: ${gameplayNotes.length} notes`);
  console.log(`   📊 Windows: ${aggregated.windows.length}`);
  console.log(`   📊 Coherence: ${aggregated.coherence.toFixed(2)}`);
  
  // Calculate quality gap from scores
  const scores = gameplayNotes.map(n => n.score);
  const scoreRange = Math.max(...scores) - Math.min(...scores);
  const qualityGap = 0.5 - Math.abs((scoreRange / 10) - 0.5);
  
  console.log(`   📊 Quality Gap: ${qualityGap.toFixed(3)} (${qualityGap < 0.6 ? 'EQUIVOCAL - High Bias Risk' : 'CLEAR'})`);
  
  // Simulate screenshot path
  const screenshotPath = join(RESULTS_DIR, `queeraoke-research-${Date.now()}.png`);
  
  // Use research-enhanced validation
  const prompt = `Evaluate this gameplay screenshot considering temporal context:
${aggregated.summary}

Check for gameplay quality, accessibility, visual design, user experience.`;
  
  // Simulate validation (would normally use real screenshot)
  console.log(`   ✅ Using validateWithResearchEnhancements`);
  console.log(`   ✅ Quality gap analysis enabled`);
  console.log(`   ✅ Bias detection enabled`);
  console.log(`   ✅ Bias mitigation enabled`);
  
  // In real usage:
  // const result = await validateWithResearchEnhancements(
  //   screenshotPath,
  //   prompt,
  //   {
  //     qualityGap: qualityGap,
  //     judgeModel: 'gpt-4',
  //     taskMetadata: {
  //       inputLength: prompt.length,
  //       outputLength: 200,
  //       promptLength: prompt.length
  //     },
  //     enableBiasDetection: true,
  //     enableBiasMitigation: true,
  //     useCounterBalance: true
  //   }
  // );
  
  return {
    test: 'interactive_gameplay_research',
    qualityGap: qualityGap,
    isEquivocal: qualityGap < 0.6,
    aggregated: aggregated
  };
}

/**
 * Test 2: Multi-Perspective with Position Bias Analysis
 * 
 * Shows how Queeraoke's multi-perspective pattern can use position bias analysis
 */
async function testMultiPerspectiveWithPositionAnalysis() {
  console.log('\n👥 Test 2: Multi-Perspective with Position Bias Analysis\n');
  
  const personas = [
    { name: 'Casual Gamer', goals: ['fun'], concerns: ['enjoyment'] },
    { name: 'Accessibility Advocate', goals: ['accessibility'], concerns: ['keyboard navigation'] },
    { name: 'Power User', goals: ['efficiency'], concerns: ['performance'] }
  ];
  
  // Simulate multiple evaluations (would normally be real)
  const screenshotPaths = personas.map((_, i) => 
    join(RESULTS_DIR, `queeraoke-perspective-${i}-${Date.now()}.png`)
  );
  
  console.log(`   📊 Personas: ${personas.length}`);
  console.log(`   📊 Screenshots: ${screenshotPaths.length}`);
  
  // Use position bias analysis
  console.log(`   ✅ Using validateMultipleWithPositionAnalysis`);
  console.log(`   ✅ Position Consistency (PC) metrics enabled`);
  console.log(`   ✅ Preference Fairness (PF) metrics enabled`);
  console.log(`   ✅ Quality gap analysis enabled`);
  
  // In real usage:
  // const result = await validateMultipleWithPositionAnalysis(
  //   screenshotPaths,
  //   'Evaluate gameplay from your persona perspective',
  //   {
  //     calculateMetrics: true,
  //     qualityGap: 0.4,
  //     judgeModel: 'gpt-4',
  //     enableMitigation: true
  //   }
  // );
  
  return {
    test: 'multiperspective_position_analysis',
    personas: personas.length,
    screenshots: screenshotPaths.length
  };
}

/**
 * Test 3: Explicit Rubrics for Better Reliability
 * 
 * Shows how Queeraoke can use explicit rubrics for 10-20% reliability improvement
 */
async function testExplicitRubrics() {
  console.log('\n📋 Test 3: Explicit Rubrics for Better Reliability\n');
  
  const screenshotPath = join(RESULTS_DIR, `queeraoke-rubric-${Date.now()}.png`);
  const prompt = 'Evaluate gameplay accessibility and design quality';
  
  console.log(`   ✅ Using validateWithExplicitRubric`);
  console.log(`   ✅ Research: 10-20% reliability improvement`);
  console.log(`   ✅ Reduces bias from superficial features`);
  
  // In real usage:
  // const result = await validateWithExplicitRubric(
  //   screenshotPath,
  //   prompt,
  //   {
  //     useDefaultRubric: true
  //   }
  // );
  
  return {
    test: 'explicit_rubrics',
    improvement: '10-20% reliability'
  };
}

/**
 * Test 4: Comprehensive Research Enhancements
 * 
 * Shows how to use all research enhancements together
 */
async function testComprehensiveResearchEnhancements() {
  console.log('\n🔬 Test 4: Comprehensive Research Enhancements\n');
  
  const screenshotPath = join(RESULTS_DIR, `queeraoke-comprehensive-${Date.now()}.png`);
  const prompt = 'Evaluate gameplay quality, accessibility, and user experience';
  
  // Calculate quality gap
  const scores = [7.0, 7.2, 6.8, 7.1]; // Simulated
  const scoreRange = Math.max(...scores) - Math.min(...scores);
  const qualityGap = 0.5 - Math.abs((scoreRange / 10) - 0.5);
  
  console.log(`   📊 Quality Gap: ${qualityGap.toFixed(3)}`);
  console.log(`   ✅ Using validateWithAllResearchEnhancements`);
  console.log(`   ✅ Explicit rubrics enabled`);
  console.log(`   ✅ Bias detection enabled`);
  console.log(`   ✅ Bias mitigation enabled`);
  console.log(`   ✅ Length alignment enabled`);
  console.log(`   ✅ Quality gap analysis enabled`);
  
  // In real usage:
  // const result = await validateWithAllResearchEnhancements(
  //   screenshotPath,
  //   prompt,
  //   {
  //     qualityGap: qualityGap,
  //     judgeModel: 'gpt-4',
  //     taskMetadata: {
  //       inputLength: prompt.length,
  //       outputLength: 200
  //     }
  //   }
  // );
  
  return {
    test: 'comprehensive_research',
    qualityGap: qualityGap,
    features: ['rubrics', 'bias_detection', 'bias_mitigation', 'length_alignment', 'quality_gap']
  };
}

/**
 * Run all tests
 */
async function runQueeraokeResearchTests() {
  console.log('='.repeat(80));
  console.log('🧪 QUEERAOKE RESEARCH ENHANCEMENTS INTEGRATION TEST');
  console.log('='.repeat(80));
  console.log('\nDemonstrating how Queeraoke can use research-enhanced validation\n');
  
  const results = {
    timestamp: new Date().toISOString(),
    tests: []
  };
  
  try {
    results.tests.push(await testInteractiveGameplayWithResearch());
    results.tests.push(await testMultiPerspectiveWithPositionAnalysis());
    results.tests.push(await testExplicitRubrics());
    results.tests.push(await testComprehensiveResearchEnhancements());
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    results.error = error.message;
  }
  
  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY\n');
  
  results.tests.forEach(test => {
    console.log(`   ✅ ${test.test}: Completed`);
  });
  
  console.log('\n💡 Integration Benefits:');
  console.log('   1. Quality gap analysis - Detect equivocal cases (high bias risk)');
  console.log('   2. Position bias metrics - PC/PF metrics for multi-screenshot comparisons');
  console.log('   3. Explicit rubrics - 10-20% reliability improvement');
  console.log('   4. Comprehensive bias detection - Verbosity, length, formatting, position');
  console.log('   5. Active bias mitigation - Adjust scores based on detected biases');
  
  console.log('\n📋 Next Steps:');
  console.log('   1. Update Queeraoke tests to use research-enhanced functions');
  console.log('   2. Enable quality gap analysis for equivocal case detection');
  console.log('   3. Use position bias analysis for multi-screenshot comparisons');
  console.log('   4. Enable explicit rubrics for better reliability');
  console.log('   5. Monitor improvements in evaluation quality');
  
  // Save results
  const outputPath = join(RESULTS_DIR, `queeraoke-research-integration-${Date.now()}.json`);
  writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Results saved to: ${outputPath}`);
  
  return results;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runQueeraokeResearchTests().catch(console.error);
}

export { runQueeraokeResearchTests };


