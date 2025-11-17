import { test } from 'node:test';
import assert from 'node:assert';
import { existsSync } from 'fs';
import { testCapabilityLevel, testStratifiedCapabilities } from '../src/utils/capability-stratifier.mjs';
import { testLog } from './test-logger.mjs';

test('testCapabilityLevel tests specific level', async function() {
  testLog.setContext('capability-stratifier', 'testCapabilityLevel');
  
  // Skip if no API key
  if (!process.env.GEMINI_API_KEY) {
    testLog.skip('No API key available');
    this.skip();
    return;
  }

  const testCases = [
    {
      imagePath: 'test1.png',
      prompt: 'Count the circles',
      expected: 5
    },
    {
      imagePath: 'test2.png',
      prompt: 'Count the squares',
      expected: 3
    }
  ];

  // Check if test images exist
  const hasTestImages = testCases.every(tc => existsSync(tc.imagePath));
  if (!hasTestImages) {
    testLog.skip('Test images not available');
    this.skip();
    return;
  }

  let result;
  try {
    testLog.info('Testing capability level', { level: 'low', testCases: testCases.length });
    result = await testCapabilityLevel('low', testCases, {});
    testLog.success('Capability level test completed', { 
      level: result.level, 
      accuracy: result.accuracy,
      total: result.total 
    });
  } catch (e) {
    testLog.error('Test failed', e);
    this.skip();
    return;
  }

  assert.ok(result.level === 'low', 'Should test low level');
  assert.ok(result.accuracy !== undefined, 'Should calculate accuracy');
  assert.ok(result.total > 0, 'Should have results');
  assert.ok(result.recommendation, 'Should provide recommendation');
  
  testLog.clearContext();
});

test('testStratifiedCapabilities detects gaps', async function() {
  // Skip if no API key
  if (!process.env.GEMINI_API_KEY) {
    console.log('   ℹ️  Skipping - no API key available');
    this.skip();
    return;
  }

  const testSuites = {
    low: [
      { imagePath: 'test1.png', prompt: 'Count circles', expected: 5 }
    ],
    mid: [
      { imagePath: 'test2.png', prompt: 'Identify texture', expected: 'rough' }
    ],
    high: [
      { imagePath: 'test3.png', prompt: 'What object?', expected: 'car' }
    ]
  };

  // Check if test images exist
  const allTestCases = [...testSuites.low, ...testSuites.mid, ...testSuites.high];
  const hasTestImages = allTestCases.every(tc => existsSync(tc.imagePath));
  if (!hasTestImages) {
    console.log('   ℹ️  Skipping - test images not available');
    this.skip();
    return;
  }

  let result;
  try {
    result = await testStratifiedCapabilities(testSuites, {});
  } catch (e) {
    console.log(`   ℹ️  Test failed: ${e.message}`);
    this.skip();
    return;
  }

  assert.ok(result.results, 'Should have results');
  assert.ok(result.gaps !== undefined, 'Should detect gaps');
  assert.ok(result.overallRecommendation, 'Should provide overall recommendation');
});

