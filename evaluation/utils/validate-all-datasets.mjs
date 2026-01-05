#!/usr/bin/env node
/**
 * Comprehensive Dataset Validation
 * 
 * Validates all available datasets and reports status.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { WebUIAdapter } from './dataset-adapters.mjs';

const DATASETS_DIR = join(process.cwd(), 'evaluation', 'datasets');

/**
 * Validate a dataset file
 */
function validateDatasetFile(filePath, name) {
  console.log(`\n📊 ${name}`);
  console.log('-'.repeat(70));
  
  if (!existsSync(filePath)) {
    console.log('   ❌ File not found');
    return { valid: false, error: 'File not found' };
  }
  
  try {
    const data = JSON.parse(readFileSync(filePath, 'utf-8'));
    const sampleCount = data.samples?.length || 0;
    console.log(`   ✅ File exists`);
    console.log(`   📦 Samples: ${sampleCount}`);
    console.log(`   📝 Name: ${data.name || 'Unknown'}`);
    console.log(`   🔗 Source: ${data.source || 'Unknown'}`);
    
    // Check first sample structure
    if (sampleCount > 0) {
      const first = data.samples[0];
      const hasScreenshot = !!first.screenshot;
      const hasGroundTruth = !!first.groundTruth;
      const hasMetadata = !!first.metadata;
      
      console.log(`   📸 Has screenshots: ${hasScreenshot ? '✅' : '❌'}`);
      console.log(`   🎯 Has ground truth: ${hasGroundTruth ? '✅' : '❌'}`);
      console.log(`   📋 Has metadata: ${hasMetadata ? '✅' : '❌'}`);
    }
    
    return { valid: true, sampleCount, data };
  } catch (error) {
    console.log(`   ❌ Parse error: ${error.message}`);
    return { valid: false, error: error.message };
  }
}

/**
 * Validate adapter-based datasets
 */
function validateAdapterDataset(adapter, name) {
  console.log(`\n📊 ${name} (Adapter)`);
  console.log('-'.repeat(70));
  
  try {
    const available = adapter.isAvailable();
    if (available === false || (typeof available === 'object' && !available.available)) {
      console.log('   ❌ Dataset not available');
      if (typeof available === 'object' && available.message) {
        console.log(`   💡 ${available.message}`);
      }
      return { valid: false };
    }
    
    const samples = adapter.listSamples();
    console.log(`   ✅ Dataset available`);
    console.log(`   📦 Samples: ${samples.length}`);
    console.log(`   🔍 First 3 IDs: ${samples.slice(0, 3).join(', ')}`);
    
    return { valid: true, sampleCount: samples.length };
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return { valid: false, error: error.message };
  }
}

/**
 * Main validation
 */
async function validateAllDatasets() {
  console.log('🔍 Comprehensive Dataset Validation');
  console.log('='.repeat(70));
  
  const results = {
    files: {},
    adapters: {},
    summary: {
      total: 0,
      valid: 0,
      invalid: 0
    }
  };
  
  // Validate file-based datasets
  console.log('\n📁 File-Based Datasets:');
  
  results.files.screenaiAnnotation = validateDatasetFile(
    join(DATASETS_DIR, 'integrated', 'screenai-annotation.json'),
    'ScreenAI Annotation'
  );
  
  results.files.screenaiQA = validateDatasetFile(
    join(DATASETS_DIR, 'integrated', 'screenai-qa.json'),
    'ScreenAI QA'
  );
  
  results.files.webui = validateDatasetFile(
    join(DATASETS_DIR, 'webui-ground-truth.json'),
    'WebUI Ground Truth'
  );
  
  results.files.real = validateDatasetFile(
    join(DATASETS_DIR, 'real-dataset.json'),
    'Real-World Dataset'
  );
  
  results.files.naturalLanguageSpecs = validateDatasetFile(
    join(DATASETS_DIR, 'natural-language-specs-dataset.json'),
    'Natural Language Specs'
  );
  
  results.files.wcag = validateDatasetFile(
    join(DATASETS_DIR, 'wcag-ground-truth.json'),
    'WCAG Test Cases'
  );
  
  // Validate adapter-based datasets
  console.log('\n🔌 Adapter-Based Datasets:');
  
  const webuiAdapter = new WebUIAdapter();
  results.adapters.webui = validateAdapterDataset(webuiAdapter, 'WebUI (Adapter)');
  
  // Summary
  console.log('\n📈 Summary');
  console.log('='.repeat(70));
  
  const allResults = [
    ...Object.values(results.files),
    ...Object.values(results.adapters)
  ].filter(r => r !== undefined);
  
  results.summary.total = allResults.length;
  results.summary.valid = allResults.filter(r => r.valid).length;
  results.summary.invalid = allResults.filter(r => !r.valid).length;
  
  console.log(`   Total Datasets: ${results.summary.total}`);
  console.log(`   ✅ Valid: ${results.summary.valid}`);
  console.log(`   ❌ Invalid: ${results.summary.invalid}`);
  
  // Sample counts
  const totalSamples = allResults
    .filter(r => r.sampleCount)
    .reduce((sum, r) => sum + (r.sampleCount || 0), 0);
  console.log(`   📦 Total Samples: ${totalSamples.toLocaleString()}`);
  
  return results;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  validateAllDatasets().catch(console.error);
}

export { validateAllDatasets };

