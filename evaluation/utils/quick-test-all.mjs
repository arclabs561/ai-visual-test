#!/usr/bin/env node
/**
 * Quick Test All
 * 
 * Runs all test suites to validate the entire evaluation system.
 */

import { runTests as testChallenging } from './test-challenging-websites.mjs';
import { runTests as testExpert } from './test-expert-evaluations.mjs';

async function runAllTests() {
  console.log('🚀 Running All Evaluation Tests\n');
  console.log('='.repeat(60));
  
  const results = {
    challenging: null,
    expert: null,
    overall: { passed: 0, failed: 0 }
  };
  
  // Test challenging websites
  console.log('\n📊 Testing Challenging Websites...\n');
  try {
    results.challenging = testChallenging();
    results.overall.passed += results.challenging.totalPassed;
    results.overall.failed += results.challenging.totalFailed;
  } catch (error) {
    console.error(`❌ Error testing challenging websites: ${error.message}`);
    results.overall.failed++;
  }
  
  // Test expert evaluations
  console.log('\n📊 Testing Expert Evaluations...\n');
  try {
    results.expert = testExpert();
    results.overall.passed += results.expert.totalPassed || 0;
    results.overall.failed += results.expert.totalFailed || 0;
  } catch (error) {
    console.error(`❌ Error testing expert evaluations: ${error.message}`);
    results.overall.failed++;
  }
  
  // Overall summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Overall Test Results\n');
  console.log(`   ✅ Total Passed: ${results.overall.passed}`);
  console.log(`   ❌ Total Failed: ${results.overall.failed}`);
  const total = results.overall.passed + results.overall.failed;
  if (total > 0) {
    console.log(`   📈 Success Rate: ${((results.overall.passed / total) * 100).toFixed(1)}%`);
  }
  
  if (results.overall.failed === 0) {
    console.log('\n✅ All tests passed! System is ready for evaluation.');
  } else {
    console.log('\n⚠️  Some tests failed. Please review before running evaluations.');
  }
  
  return results;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}

export { runAllTests };

