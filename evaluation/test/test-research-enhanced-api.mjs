#!/usr/bin/env node
/**
 * Test Research-Enhanced API
 * 
 * Tests the new research-enhanced validation functions to ensure they work correctly.
 */

import {
  validateWithResearchEnhancements,
  validateMultipleWithPositionAnalysis,
  validateWithLengthAlignment,
  validateWithExplicitRubric,
  validateWithAllResearchEnhancements,
  detectPositionBias
} from '../../src/index.mjs';

async function testAPIExports() {
  console.log('🧪 Testing Research-Enhanced API Exports\n');
  
  const functions = [
    'validateWithResearchEnhancements',
    'validateMultipleWithPositionAnalysis',
    'validateWithLengthAlignment',
    'validateWithExplicitRubric',
    'validateWithAllResearchEnhancements'
  ];
  
  const api = await import('../src/index.mjs');
  const results = {};
  
  for (const fnName of functions) {
    const exists = typeof api[fnName] === 'function';
    results[fnName] = exists;
    console.log(`   ${exists ? '✅' : '❌'} ${fnName}: ${exists ? 'EXPORTED' : 'MISSING'}`);
  }
  
  const allExported = Object.values(results).every(v => v === true);
  console.log(`\n   ${allExported ? '✅ All functions exported' : '❌ Some functions missing'}`);
  
  return allExported;
}

async function testPositionBiasAPI() {
  console.log('\n🧪 Testing Position Bias API\n');
  
  // Test with mock judgments
  const judgments = [
    { score: 7.0 },
    { score: 6.8 },
    { score: 7.2 },
    { score: 6.5 }
  ];
  
  const result = detectPositionBias(judgments, {
    qualityGap: 0.45,  // Equivocal case
    judgeModel: 'gpt-4',
    taskMetadata: {
      inputLength: 500,
      outputLength: 200,
      promptLength: 300
    }
  });
  
  console.log(`   Quality Gap: ${result.qualityGap?.value?.toFixed(3) || 'N/A'}`);
  console.log(`   Is Equivocal: ${result.qualityGap?.isEquivocal ? '✅ YES' : '❌ NO'}`);
  console.log(`   Bias Detected: ${result.detected ? '✅ YES' : '❌ NO'}`);
  console.log(`   Judge Model: ${result.factors?.judgeModel || 'N/A'}`);
  console.log(`   Task Metadata: ${JSON.stringify(result.factors?.taskMetadata || {})}`);
  
  return result.qualityGap !== undefined && result.factors !== undefined;
}

async function testResearchMetadata() {
  console.log('\n🧪 Testing Research Metadata Structure\n');
  
  const judgments = [
    { score: 7.0 },
    { score: 6.8 }
  ];
  
  const result = detectPositionBias(judgments, {
    qualityGap: 0.5,  // Exact equivocal
    judgeModel: 'gpt-4'
  });
  
  // Check research metadata structure
  const hasQualityGap = result.qualityGap !== undefined;
  const hasFactors = result.factors !== undefined;
  const isEquivocal = result.qualityGap?.isEquivocal === true;
  
  console.log(`   Has Quality Gap: ${hasQualityGap ? '✅ YES' : '❌ NO'}`);
  console.log(`   Has Factors: ${hasFactors ? '✅ YES' : '❌ NO'}`);
  console.log(`   Is Equivocal: ${isEquivocal ? '✅ YES (correct)' : '❌ NO'}`);
  console.log(`   Quality Gap Note: ${result.qualityGap?.note || 'N/A'}`);
  
  return hasQualityGap && hasFactors && isEquivocal;
}

async function runTests() {
  console.log('='.repeat(80));
  console.log('🧪 RESEARCH-ENHANCED API TESTS');
  console.log('='.repeat(80));
  
  const results = {
    exports: await testAPIExports(),
    positionBias: await testPositionBiasAPI(),
    metadata: await testResearchMetadata()
  };
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY\n');
  
  const passed = Object.values(results).filter(v => v === true).length;
  const total = Object.keys(results).length;
  
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`   ${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
  });
  
  console.log(`\n   Total: ${passed}/${total} passed (${((passed/total)*100).toFixed(1)}%)`);
  
  if (passed === total) {
    console.log('\n   ✅ All API tests passed!');
  } else {
    console.log('\n   ⚠️  Some tests failed - check implementation');
  }
  
  return results;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}

export { runTests };

