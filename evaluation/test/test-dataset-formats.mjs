#!/usr/bin/env node
/**
 * Test Dataset Format Compatibility
 * 
 * Tests that all datasets have correct formats and can be loaded/evaluated.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { WebUIAdapter, ScreenAIAdapter, loadDataset } from '../utils/dataset-adapters.mjs';

const DATASETS_DIR = join(process.cwd(), 'evaluation', 'datasets');

/**
 * Test WebUI dataset format
 */
async function testWebUIDataset() {
  console.log('\n📊 Testing WebUI Dataset Format');
  console.log('-'.repeat(70));
  
  try {
    // Test adapter
    const adapter = new WebUIAdapter();
    const available = adapter.isAvailable();
    if (!available) {
      console.log('   ⚠️  WebUI adapter not available');
      return { passed: false, reason: 'adapter_not_available' };
    }
    
    const sample = await adapter.loadSample('1655885421832');
    if (!sample) {
      console.log('   ❌ Failed to load sample');
      return { passed: false, reason: 'sample_load_failed' };
    }
    
    // Check format
    const checks = {
      hasId: !!sample.id,
      hasScreenshot: !!sample.screenshot,
      screenshotExists: sample.screenshot ? existsSync(sample.screenshot) : false,
      hasGroundTruth: !!sample.groundTruth,
      hasEvaluationType: sample.groundTruth?.evaluationType === 'accessibility-tree' || 
                        sample.groundTruth?.hasAccessibilityTree !== undefined,
      hasStructuredFeatures: !!sample.groundTruth?.structuredFeatures,
      hasAccessibilityTree: !!sample.groundTruth?.structuredFeatures?.accessibility ||
                           !!sample.groundTruth?.hasAccessibilityTree,
      hasMetadata: !!sample.metadata
    };
    
    const allPassed = Object.values(checks).every(v => v === true);
    
    console.log('   Format checks:');
    Object.entries(checks).forEach(([key, value]) => {
      console.log(`      ${value ? '✅' : '❌'} ${key}: ${value}`);
    });
    
    if (allPassed) {
      console.log('   ✅ WebUI dataset format is correct');
      return { passed: true, checks };
    } else {
      console.log('   ❌ WebUI dataset format has issues');
      return { passed: false, checks };
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return { passed: false, error: error.message };
  }
}

/**
 * Test ScreenAI dataset format
 */
async function testScreenAIDataset() {
  console.log('\n📊 Testing ScreenAI Dataset Format');
  console.log('-'.repeat(70));
  
  try {
    const adapter = new ScreenAIAdapter();
    const available = adapter.isAvailable();
    if (!available) {
      console.log('   ⚠️  ScreenAI adapter not available');
      return { passed: false, reason: 'adapter_not_available' };
    }
    
    const samples = adapter.loadSamples({ limit: 5 });
    if (samples.length === 0) {
      console.log('   ❌ No samples loaded');
      return { passed: false, reason: 'no_samples' };
    }
    
    const sample = samples[0];
    const checks = {
      hasId: !!sample.id,
      hasGroundTruth: !!sample.groundTruth,
      hasMetadata: !!sample.metadata,
      hasDatasetNote: sample.metadata?.note?.includes('Rico') || 
                     sample.metadata?.note?.includes('screenshot') ||
                     sample.screenshot === null
    };
    
    // ScreenAI samples may not have screenshots (they reference Rico)
    const hasScreenshot = !!sample.screenshot;
    const hasRicoNote = sample.metadata?.note?.includes('Rico') || 
                       sample.metadata?.ricoImageId;
    
    console.log('   Format checks:');
    Object.entries(checks).forEach(([key, value]) => {
      console.log(`      ${value ? '✅' : '❌'} ${key}: ${value}`);
    });
    console.log(`      ${hasScreenshot ? '✅' : '⚠️ '} Has screenshot: ${hasScreenshot}`);
    console.log(`      ${hasRicoNote ? '✅' : '⚠️ '} Has Rico dataset note: ${hasRicoNote}`);
    
    const allPassed = Object.values(checks).every(v => v === true);
    
    if (allPassed) {
      console.log('   ✅ ScreenAI dataset format is correct');
      console.log('   ⚠️  Note: Screenshots require Rico dataset (expected)');
      return { passed: true, checks, note: 'requires_rico_dataset' };
    } else {
      console.log('   ❌ ScreenAI dataset format has issues');
      return { passed: false, checks };
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return { passed: false, error: error.message };
  }
}

/**
 * Test converted WebUI dataset format
 */
function testConvertedWebUIDataset() {
  console.log('\n📊 Testing Converted WebUI Dataset Format');
  console.log('-'.repeat(70));
  
  const filePath = join(DATASETS_DIR, 'webui-ground-truth.json');
  if (!existsSync(filePath)) {
    console.log('   ⚠️  Converted WebUI dataset not found');
    return { passed: false, reason: 'file_not_found' };
  }
  
  try {
    const data = JSON.parse(readFileSync(filePath, 'utf-8'));
    if (!data.samples || data.samples.length === 0) {
      console.log('   ❌ No samples in dataset');
      return { passed: false, reason: 'no_samples' };
    }
    
    const sample = data.samples[0];
    const checks = {
      hasId: !!sample.id,
      hasScreenshot: !!sample.screenshot,
      screenshotExists: sample.screenshot ? existsSync(sample.screenshot) : false,
      hasGroundTruth: !!sample.groundTruth,
      hasEvaluationType: sample.groundTruth?.evaluationType === 'accessibility-tree' ||
                        sample.groundTruth?.hasAccessibilityTree !== undefined,
      hasStructuredFeatures: !!sample.groundTruth?.structuredFeatures ||
                            !!sample.groundTruth?.structuredFeatures?.accessibility,
      hasMetadata: !!sample.metadata,
      hasAnnotations: !!sample.annotations
    };
    
    console.log('   Format checks:');
    Object.entries(checks).forEach(([key, value]) => {
      console.log(`      ${value ? '✅' : '❌'} ${key}: ${value}`);
    });
    
    const allPassed = Object.values(checks).every(v => v === true);
    
    if (allPassed) {
      console.log('   ✅ Converted WebUI dataset format is correct');
      return { passed: true, checks, sampleCount: data.samples.length };
    } else {
      console.log('   ❌ Converted WebUI dataset format has issues');
      return { passed: false, checks };
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return { passed: false, error: error.message };
  }
}

/**
 * Test real dataset format
 */
function testRealDataset() {
  console.log('\n📊 Testing Real Dataset Format');
  console.log('-'.repeat(70));
  
  const filePath = join(DATASETS_DIR, 'real-dataset.json');
  if (!existsSync(filePath)) {
    console.log('   ⚠️  Real dataset not found');
    return { passed: false, reason: 'file_not_found' };
  }
  
  try {
    const data = JSON.parse(readFileSync(filePath, 'utf-8'));
    if (!data.samples || data.samples.length === 0) {
      console.log('   ❌ No samples in dataset');
      return { passed: false, reason: 'no_samples' };
    }
    
    const sample = data.samples[0];
    const checks = {
      hasId: !!sample.id,
      hasScreenshot: !!sample.screenshot,
      screenshotExists: sample.screenshot ? existsSync(sample.screenshot) : false,
      hasGroundTruth: !!sample.groundTruth,
      hasPreciseScore: sample.groundTruth?.preciseScore !== undefined,
      hasStructuredIssues: Array.isArray(sample.groundTruth?.structuredIssues),
      hasStructuredFeatures: !!sample.groundTruth?.structuredFeatures,
      hasMetadata: !!sample.metadata
    };
    
    console.log('   Format checks:');
    Object.entries(checks).forEach(([key, value]) => {
      console.log(`      ${value ? '✅' : '❌'} ${key}: ${value}`);
    });
    
    const allPassed = Object.values(checks).every(v => v === true);
    
    if (allPassed) {
      console.log('   ✅ Real dataset format is correct (score-based)');
      return { passed: true, checks, sampleCount: data.samples.length };
    } else {
      console.log('   ❌ Real dataset format has issues');
      return { passed: false, checks };
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return { passed: false, error: error.message };
  }
}

/**
 * Test dataset loading via loadDataset function
 */
async function testDatasetLoading() {
  console.log('\n📊 Testing Dataset Loading');
  console.log('-'.repeat(70));
  
  const tests = [
    { name: 'webui', expectedAdapter: true },
    { name: 'screenai', expectedAdapter: true },
    { name: 'real-dataset.json', expectedAdapter: false }
  ];
  
  const results = [];
  
  for (const test of tests) {
    try {
      console.log(`\n   Testing: ${test.name}`);
      const result = await loadDataset(test.name, { limit: 2 });
      
      const checks = {
        loaded: !!result,
        hasSamples: !!result.samples && result.samples.length > 0,
        hasAdapter: !!result.adapter,
        sampleCount: result.samples?.length || 0
      };
      
      console.log(`      ${checks.loaded ? '✅' : '❌'} Loaded: ${checks.loaded}`);
      console.log(`      ${checks.hasSamples ? '✅' : '❌'} Has samples: ${checks.hasSamples}`);
      console.log(`      ${checks.hasAdapter ? '✅' : '⚠️ '} Via adapter: ${checks.hasAdapter}`);
      console.log(`      📦 Sample count: ${checks.sampleCount}`);
      
      results.push({ name: test.name, passed: checks.loaded && checks.hasSamples, checks });
    } catch (error) {
      console.log(`      ❌ Error: ${error.message}`);
      results.push({ name: test.name, passed: false, error: error.message });
    }
  }
  
  return results;
}

/**
 * Main test function
 */
async function runTests() {
  console.log('🧪 Dataset Format Compatibility Tests');
  console.log('='.repeat(70));
  
  const results = {
    webuiAdapter: await testWebUIDataset(),
    screenaiAdapter: await testScreenAIDataset(),
    webuiConverted: testConvertedWebUIDataset(),
    realDataset: testRealDataset(),
    datasetLoading: await testDatasetLoading()
  };
  
  console.log('\n📈 Test Summary');
  console.log('='.repeat(70));
  
  const allPassed = Object.values(results).every(r => 
    Array.isArray(r) ? r.every(item => item.passed !== false) : r.passed !== false
  );
  
  Object.entries(results).forEach(([name, result]) => {
    if (Array.isArray(result)) {
      const passed = result.filter(r => r.passed).length;
      const total = result.length;
      console.log(`   ${name}: ${passed}/${total} passed`);
    } else {
      console.log(`   ${name}: ${result.passed ? '✅' : '❌'}`);
    }
  });
  
  console.log(`\n${allPassed ? '✅' : '❌'} Overall: ${allPassed ? 'All tests passed' : 'Some tests failed'}`);
  
  return results;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}

export { runTests };

