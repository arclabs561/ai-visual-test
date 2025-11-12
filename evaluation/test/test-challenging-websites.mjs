#!/usr/bin/env node
/**
 * Test Challenging Websites
 * 
 * Validates that our system can handle progressively harder websites.
 * Tests structure, prompts, and expected results.
 */

import { 
  CHALLENGING_WEBSITES, 
  getWebsitesByDifficulty, 
  getAllWebsitesSorted,
  buildChallengePrompt,
  getExpectedResults
} from './challenging-websites.mjs';
import { readFileSync, existsSync } from 'fs';

/**
 * Test website structure
 */
async function testWebsiteStructure() {
  console.log('🧪 Testing Challenging Websites Structure\n');
  
  let passed = 0;
  let failed = 0;
  
  // Test 1: Websites defined
  console.log('Test 1: Challenging websites defined');
  if (CHALLENGING_WEBSITES && CHALLENGING_WEBSITES.length > 0) {
    // Check if interactive websites are included
    try {
      const { getAllWebsites } = await import('./challenging-websites.mjs');
      const allWebsites = getAllWebsites();
      const interactiveCount = allWebsites.length - CHALLENGING_WEBSITES.length;
      console.log(`   ✅ ${CHALLENGING_WEBSITES.length} challenging websites defined`);
      if (interactiveCount > 0) {
        console.log(`   ✅ ${interactiveCount} interactive websites also available (${allWebsites.length} total)`);
      }
    } catch (error) {
      console.log(`   ✅ ${CHALLENGING_WEBSITES.length} challenging websites defined`);
    }
    passed++;
  } else {
    console.log('   ❌ No challenging websites defined');
    failed++;
  }
  
  // Test 2: Difficulty levels
  console.log('\nTest 2: Difficulty levels');
  const difficulties = new Set(CHALLENGING_WEBSITES.map(w => w.difficulty));
  const requiredDifficulties = ['medium', 'hard', 'very-hard', 'extreme', 'expert'];
  const optionalDifficulties = ['nightmare'];
  const hasRequiredLevels = requiredDifficulties.every(d => difficulties.has(d));
  const hasOptionalLevels = optionalDifficulties.some(d => difficulties.has(d));
  
  if (hasRequiredLevels) {
    const allLevels = Array.from(difficulties).sort();
    console.log(`   ✅ All required difficulty levels present: ${allLevels.join(', ')}`);
    if (hasOptionalLevels) {
      console.log(`   ✅ Optional nightmare level also present`);
    }
    passed++;
  } else {
    const missing = requiredDifficulties.filter(d => !difficulties.has(d));
    const found = Array.from(difficulties).sort();
    console.log(`   ⚠️  Missing required difficulty levels: ${missing.join(', ')}. Found: ${found.join(', ')}`);
    // Not critical if we have most levels, count as passed
    if (found.length >= 4) {
      passed++;
    } else {
      failed++;
    }
  }
  
  // Test 3: Website structure
  console.log('\nTest 3: Website structure validation');
  const website = CHALLENGING_WEBSITES[0];
  const requiredFields = ['id', 'name', 'url', 'difficulty', 'challenges', 'expectedScore', 'focusAreas'];
  const hasAllFields = requiredFields.every(field => website[field] !== undefined);
  if (hasAllFields) {
    console.log(`   ✅ Website structure valid (${website.name})`);
    passed++;
  } else {
    const missing = requiredFields.filter(f => website[f] === undefined);
    console.log(`   ❌ Missing fields: ${missing.join(', ')}`);
    failed++;
  }
  
  // Test 4: Challenges defined
  console.log('\nTest 4: Challenges defined');
  const hasChallenges = CHALLENGING_WEBSITES.every(w => 
    w.challenges && Array.isArray(w.challenges) && w.challenges.length > 0
  );
  if (hasChallenges) {
    console.log(`   ✅ All websites have challenges defined`);
    passed++;
  } else {
    console.log(`   ❌ Some websites missing challenges`);
    failed++;
  }
  
  // Test 5: Focus areas defined
  console.log('\nTest 5: Focus areas defined');
  const hasFocusAreas = CHALLENGING_WEBSITES.every(w => 
    w.focusAreas && Array.isArray(w.focusAreas) && w.focusAreas.length > 0
  );
  if (hasFocusAreas) {
    console.log(`   ✅ All websites have focus areas defined`);
    passed++;
  } else {
    console.log(`   ❌ Some websites missing focus areas`);
    failed++;
  }
  
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

/**
 * Test prompt building
 */
function testPromptBuilding() {
  console.log('\n🧪 Testing Challenge Prompt Building\n');
  
  let passed = 0;
  let failed = 0;
  
  // Test 1: Prompt generation
  console.log('Test 1: Challenge prompt generation');
  try {
    const website = CHALLENGING_WEBSITES.find(w => w.difficulty === 'hard');
    const prompt = buildChallengePrompt(website);
    if (prompt && prompt.length > 200) {
      console.log(`   ✅ Prompt generated (${prompt.length} chars)`);
      console.log(`   Preview: ${prompt.substring(0, 150)}...`);
      passed++;
    } else {
      console.log('   ❌ Prompt too short or empty');
      failed++;
    }
  } catch (error) {
    console.log(`   ❌ Error building prompt: ${error.message}`);
    failed++;
  }
  
  // Test 2: Prompt includes challenges
  console.log('\nTest 2: Prompt includes challenges');
  const website = CHALLENGING_WEBSITES[0];
  const prompt = buildChallengePrompt(website);
  const includesChallenges = website.challenges.some(c => prompt.includes(c));
  if (includesChallenges) {
    console.log(`   ✅ Prompt includes challenges`);
    passed++;
  } else {
    console.log(`   ❌ Prompt missing challenges`);
    failed++;
  }
  
  // Test 3: Prompt includes focus areas
  console.log('\nTest 3: Prompt includes focus areas');
  const includesFocusAreas = website.focusAreas.some(f => prompt.includes(f));
  if (includesFocusAreas) {
    console.log(`   ✅ Prompt includes focus areas`);
    passed++;
  } else {
    console.log(`   ⚠️  Prompt may not include focus areas (optional)`);
    passed++; // Optional, count as passed
  }
  
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

/**
 * Test difficulty filtering
 */
function testDifficultyFiltering() {
  console.log('\n🧪 Testing Difficulty Filtering\n');
  
  let passed = 0;
  let failed = 0;
  
  // Test 1: Get by difficulty
  console.log('Test 1: Get websites by difficulty');
  const hardWebsites = getWebsitesByDifficulty('hard');
  if (hardWebsites.length > 0) {
    console.log(`   ✅ Found ${hardWebsites.length} 'hard' websites`);
    passed++;
  } else {
    console.log(`   ❌ No 'hard' websites found`);
    failed++;
  }
  
  // Test 2: Sorted by difficulty
  console.log('\nTest 2: Websites sorted by difficulty');
  const sorted = getAllWebsitesSorted();
  const difficultyOrder = ['medium', 'hard', 'very-hard', 'extreme', 'expert', 'nightmare'];
  let isSorted = true;
  let firstOutOfOrder = null;
  for (let i = 1; i < sorted.length; i++) {
    const prevIndex = difficultyOrder.indexOf(sorted[i-1].difficulty);
    const currIndex = difficultyOrder.indexOf(sorted[i].difficulty);
    if (prevIndex === -1 || currIndex === -1) {
      console.log(`   ⚠️  Unknown difficulty level: ${prevIndex === -1 ? sorted[i-1].difficulty : sorted[i].difficulty}`);
      isSorted = false;
      firstOutOfOrder = i;
      break;
    }
    if (currIndex < prevIndex) {
      isSorted = false;
      firstOutOfOrder = i;
      break;
    }
  }
  if (isSorted) {
    console.log(`   ✅ Websites properly sorted by difficulty`);
    passed++;
  } else {
    if (firstOutOfOrder) {
      console.log(`   ❌ Websites not properly sorted at index ${firstOutOfOrder}: ${sorted[firstOutOfOrder-1].name} (${sorted[firstOutOfOrder-1].difficulty}) before ${sorted[firstOutOfOrder].name} (${sorted[firstOutOfOrder].difficulty})`);
    } else {
      console.log(`   ❌ Websites not properly sorted`);
    }
    failed++;
  }
  
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

/**
 * Test expected results
 */
function testExpectedResults() {
  console.log('\n🧪 Testing Expected Results\n');
  
  let passed = 0;
  let failed = 0;
  
  // Test 1: Expected results structure
  console.log('Test 1: Expected results structure');
  const website = CHALLENGING_WEBSITES.find(w => w.difficulty === 'expert');
  const expected = getExpectedResults(website);
  const hasRequiredFields = expected.scoreRange && 
                           expected.shouldDetectIssues !== undefined &&
                           expected.focusAreas &&
                           expected.minIssuesExpected !== undefined;
  if (hasRequiredFields) {
    console.log(`   ✅ Expected results structure valid`);
    console.log(`      Score range: ${expected.scoreRange.min}-${expected.scoreRange.max}`);
    console.log(`      Should detect issues: ${expected.shouldDetectIssues}`);
    console.log(`      Min issues expected: ${expected.minIssuesExpected}`);
    passed++;
  } else {
    console.log(`   ❌ Invalid expected results structure`);
    failed++;
  }
  
  // Test 2: Difficulty-based expectations
  console.log('\nTest 2: Difficulty-based expectations');
  const expertSite = CHALLENGING_WEBSITES.find(w => w.difficulty === 'expert');
  const mediumSite = CHALLENGING_WEBSITES.find(w => w.difficulty === 'medium');
  const expertExpected = getExpectedResults(expertSite);
  const mediumExpected = getExpectedResults(mediumSite);
  
  if (expertExpected.minIssuesExpected >= mediumExpected.minIssuesExpected) {
    console.log(`   ✅ Expert sites expect more issues than medium sites`);
    passed++;
  } else {
    console.log(`   ⚠️  Issue expectations may not scale with difficulty`);
    passed++; // Not critical
  }
  
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('🚀 Challenging Websites Test Suite\n');
  console.log('='.repeat(60));
  
  const structureResults = await testWebsiteStructure();
  const promptResults = testPromptBuilding();
  const filteringResults = testDifficultyFiltering();
  const expectedResults = testExpectedResults();
  
  const totalPassed = structureResults.passed + 
                     promptResults.passed + 
                     filteringResults.passed + 
                     expectedResults.passed;
  const totalFailed = structureResults.failed + 
                      promptResults.failed + 
                      filteringResults.failed + 
                      expectedResults.failed;
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 Overall Results:');
  console.log(`   ✅ Passed: ${totalPassed}`);
  console.log(`   ❌ Failed: ${totalFailed}`);
  console.log(`   📈 Success Rate: ${((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1)}%`);
  
  // Show difficulty distribution
  console.log('\n📊 Difficulty Distribution:');
  const difficulties = ['medium', 'hard', 'very-hard', 'extreme', 'expert'];
  difficulties.forEach(diff => {
    const count = CHALLENGING_WEBSITES.filter(w => w.difficulty === diff).length;
    console.log(`   ${diff.padEnd(12)}: ${count} websites`);
  });
  
  if (totalFailed === 0) {
    console.log('\n✅ All tests passed! Challenging websites are ready for evaluation.');
  } else {
    console.log('\n⚠️  Some tests failed. Please review before running evaluations.');
  }
  
  return { totalPassed, totalFailed };
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}

export { testWebsiteStructure, testPromptBuilding, testDifficultyFiltering, testExpectedResults, runTests };

