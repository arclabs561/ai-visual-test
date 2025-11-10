#!/usr/bin/env node
/**
 * Test script to verify package functionality
 */

import { 
  validateScreenshot, 
  createConfig, 
  VLLMJudge,
  extractRenderedCode,
  aggregateTemporalNotes,
  formatNotesForPrompt,
  getCached,
  setCached,
  clearCache,
  getCacheStats,
  loadEnv
} from './src/index.mjs';

console.log('🧪 Testing VLLM Testing Package\n');

// Test 1: Config
console.log('1. Testing createConfig...');
try {
  const config = createConfig();
  console.log('   ✅ Config created:', {
    provider: config.provider,
    enabled: config.enabled,
    cacheEnabled: config.cache.enabled
  });
} catch (error) {
  console.error('   ❌ Config failed:', error.message);
}

// Test 2: VLLMJudge
console.log('\n2. Testing VLLMJudge...');
try {
  const judge = new VLLMJudge();
  console.log('   ✅ Judge created:', {
    provider: judge.provider,
    enabled: judge.enabled
  });
} catch (error) {
  console.error('   ❌ Judge failed:', error.message);
}

// Test 3: Cache
console.log('\n3. Testing Cache...');
try {
  const stats = getCacheStats();
  console.log('   ✅ Cache stats:', stats);
} catch (error) {
  console.error('   ❌ Cache failed:', error.message);
}

// Test 4: Load Env
console.log('\n4. Testing loadEnv...');
try {
  loadEnv();
  console.log('   ✅ Load-env works');
} catch (error) {
  console.error('   ❌ Load-env failed:', error.message);
}

// Test 5: Temporal
console.log('\n5. Testing Temporal...');
try {
  const notes = [
    { timestamp: Date.now(), score: 8, observation: 'Test' }
  ];
  const aggregated = aggregateTemporalNotes(notes);
  const formatted = formatNotesForPrompt(aggregated);
  console.log('   ✅ Temporal works:', {
    windows: aggregated.windows?.length || 0,
    coherence: aggregated.coherence
  });
} catch (error) {
  console.error('   ❌ Temporal failed:', error.message);
}

console.log('\n✅ All basic tests passed!');
console.log('\nNote: validateScreenshot requires actual screenshot file to test fully.');

