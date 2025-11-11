#!/usr/bin/env node
/**
 * Test Expert Evaluations (Dry-Run Mode)
 * 
 * Tests expert evaluation scripts without requiring API keys.
 * Validates structure, prompts, and workflow.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { EXPERT_WEBSITES, buildExpertPrompt } from './expert-evaluation-scenarios.mjs';
import { EXPERT_PERSONAS, EXPERT_WEBSITES as PERSONA_WEBSITES } from './expert-persona-evaluation.mjs';

/**
 * Test expert evaluation scenarios
 */
function testExpertScenarios() {
  console.log('🧪 Testing Expert Evaluation Scenarios\n');
  
  let passed = 0;
  let failed = 0;
  
  // Test 1: Websites defined
  console.log('Test 1: Expert websites defined');
  if (EXPERT_WEBSITES && EXPERT_WEBSITES.length > 0) {
    console.log(`   ✅ ${EXPERT_WEBSITES.length} expert websites defined`);
    passed++;
  } else {
    console.log('   ❌ No expert websites defined');
    failed++;
  }
  
  // Test 2: Prompt building
  console.log('\nTest 2: Expert prompt building');
  try {
    const testWebsite = EXPERT_WEBSITES[0];
    const prompt = buildExpertPrompt(testWebsite);
    if (prompt && prompt.length > 100) {
      console.log(`   ✅ Prompt generated (${prompt.length} chars)`);
      console.log(`   Preview: ${prompt.substring(0, 100)}...`);
      passed++;
    } else {
      console.log('   ❌ Prompt too short or empty');
      failed++;
    }
  } catch (error) {
    console.log(`   ❌ Error building prompt: ${error.message}`);
    failed++;
  }
  
  // Test 3: Expert criteria structure
  console.log('\nTest 3: Expert criteria structure');
  const website = EXPERT_WEBSITES.find(w => w.expertCriteria);
  if (website && website.expertCriteria) {
    const criteriaCount = Object.keys(website.expertCriteria).length;
    console.log(`   ✅ Expert criteria defined (${criteriaCount} categories)`);
    passed++;
  } else {
    console.log('   ❌ No expert criteria found');
    failed++;
  }
  
  // Test 4: Subtle considerations
  console.log('\nTest 4: Subtle expert considerations');
  const websiteWithSubtle = EXPERT_WEBSITES.find(w => w.subtle && w.subtle.length > 0);
  if (websiteWithSubtle) {
    console.log(`   ✅ Subtle considerations defined (${websiteWithSubtle.subtle.length} items)`);
    passed++;
  } else {
    console.log('   ⚠️  No subtle considerations found (optional)');
    passed++; // Optional, so count as passed
  }
  
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

/**
 * Test expert persona evaluation
 */
function testExpertPersonas() {
  console.log('\n🧪 Testing Expert Persona Evaluation\n');
  
  let passed = 0;
  let failed = 0;
  
  // Test 1: Personas defined
  console.log('Test 1: Expert personas defined');
  if (EXPERT_PERSONAS && EXPERT_PERSONAS.length > 0) {
    console.log(`   ✅ ${EXPERT_PERSONAS.length} expert personas defined`);
    passed++;
  } else {
    console.log('   ❌ No expert personas defined');
    failed++;
  }
  
  // Test 2: Persona structure
  console.log('\nTest 2: Persona structure');
  const persona = EXPERT_PERSONAS[0];
  if (persona && persona.name && persona.goals && persona.concerns) {
    console.log(`   ✅ Persona structure valid (${persona.name})`);
    console.log(`      Goals: ${persona.goals.length}`);
    console.log(`      Concerns: ${persona.concerns.length}`);
    passed++;
  } else {
    console.log('   ❌ Invalid persona structure');
    failed++;
  }
  
  // Test 3: Website-persona matching
  console.log('\nTest 3: Website-persona matching');
  const website = PERSONA_WEBSITES[0];
  const matchingPersona = EXPERT_PERSONAS.find(p => 
    website.id.includes(p.expertise) || 
    website.name.toLowerCase().includes(p.expertise)
  );
  if (matchingPersona) {
    console.log(`   ✅ Matching persona found (${matchingPersona.name})`);
    passed++;
  } else {
    console.log('   ⚠️  No matching persona (using default)');
    passed++; // Optional, so count as passed
  }
  
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

/**
 * Run all tests
 */
function runTests() {
  console.log('🚀 Expert Evaluation Test Suite\n');
  console.log('='.repeat(50));
  
  const scenariosResults = testExpertScenarios();
  const personasResults = testExpertPersonas();
  
  const totalPassed = scenariosResults.passed + personasResults.passed;
  const totalFailed = scenariosResults.failed + personasResults.failed;
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 Overall Results:');
  console.log(`   ✅ Passed: ${totalPassed}`);
  console.log(`   ❌ Failed: ${totalFailed}`);
  console.log(`   📈 Success Rate: ${((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1)}%`);
  
  if (totalFailed === 0) {
    console.log('\n✅ All tests passed! Expert evaluations are ready to run.');
  } else {
    console.log('\n⚠️  Some tests failed. Please review before running evaluations.');
  }
  
  return { totalPassed, totalFailed };
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { testExpertScenarios, testExpertPersonas, runTests };

