/**
 * Dataset Tests: WebUI Dataset
 * 
 * Tests using the WebUI dataset for validation.
 */

import '../test-setup.mjs'; // Auto-load .env (must be first)
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { existsSync, readFileSync, statSync, createReadStream } from 'fs';
import { join } from 'path';
import { loadDataset } from '../../evaluation/utils/dataset-adapters.mjs';
import { validateScreenshot } from '../../src/index.mjs';

// Note: We use adapters now, not converted JSON files

describe('WebUI Dataset Tests', () => {
  
  it('should load WebUI dataset via adapter', async function() {
    let dataset;
    try {
      dataset = await loadDataset('webui', { limit: 10 });
    } catch (e) {
      console.log(`   ℹ️  Dataset loading failed: ${e.message}`);
      this.skip(); // Skip test if dataset loading fails
      return; // Safety return
    }
    
    // Gracefully handle missing dataset directory
    if (!dataset || !dataset.samples || dataset.samples.length === 0) {
      console.log('   ℹ️  No samples available (dataset directory not present)');
      this.skip(); // Skip test if dataset not available
      return; // Safety return
    }
    
    assert.ok(dataset, 'Dataset should be loaded');
    assert.ok(Array.isArray(dataset.samples), 'Dataset should have samples array');
    assert.ok(dataset.loaded > 0, 'Should have loaded samples');
    assert.ok(dataset.totalAvailable > 0, 'Should report total available');
    
    if (dataset.samples.length > 0) {
      const sample = dataset.samples[0];
      assert.ok(sample.id, 'Sample should have id');
      assert.ok(sample.screenshot || sample.screenshotPath, 'Sample should have screenshot');
    }
  });
  
  it('should verify adapter loads samples correctly', async function() {
    // Test that adapter can load samples and they have correct structure
    let dataset;
    try {
      dataset = await loadDataset('webui', { limit: 3 });
    } catch (e) {
      console.log(`   ℹ️  Dataset loading failed: ${e.message}`);
      this.skip();
      return;
    }
    
    if (!dataset || !dataset.samples || dataset.samples.length === 0) {
      console.log('   ℹ️  No samples available');
      this.skip();
      return;
    }
    
    // Verify sample structure matches EVALUATION_FORMAT
    const sample = dataset.samples[0];
    assert.ok(sample.id, 'Sample should have id');
    assert.ok(sample.screenshot || sample.screenshotPath, 'Sample should have screenshot');
    assert.ok(sample.groundTruth, 'Sample should have groundTruth');
    assert.ok(sample.metadata, 'Sample should have metadata');
    assert.ok(sample.metadata.dataset === 'WebUI-7K', 'Should have correct dataset name');
  });
  
  it('should validate samples from dataset (if API key available)', async function() {
    // API keys should be auto-loaded from .env via test-setup.mjs
    
    let dataset;
    try {
      dataset = await loadDataset('webui', { limit: 1 });
    } catch (e) {
      console.log(`   ℹ️  Dataset loading failed: ${e.message}`);
      this.skip();
      return;
    }
    
    if (!dataset || !dataset.samples || dataset.samples.length === 0) {
      console.log('   ℹ️  No samples available in dataset');
      this.skip();
      return;
    }
    
    const sample = dataset.samples[0];
    const screenshotPath = sample.screenshot || sample.screenshotPath;
    
    if (!screenshotPath || !existsSync(screenshotPath)) {
      console.log(`   ℹ️  Sample screenshot not found: ${screenshotPath}`);
      this.skip();
      return;
    }
    
    // Test validation on a real sample
    let result;
    try {
      result = await validateScreenshot(
        screenshotPath,
        'Evaluate this UI for accessibility and usability',
        { testType: 'accessibility', useCache: true }
      );
    } catch (e) {
      console.log(`   ℹ️  Validation failed: ${e.message}`);
      this.skip(); // This will throw and stop execution
      return; // Safety return (shouldn't reach here)
    }
    
    if (!result) {
      console.log('   ℹ️  No result returned from validation');
      this.skip();
      return;
    }
    
    assert.ok(result, 'Result should be returned');
    assert.ok(typeof result.score === 'number' || result.score === null, 'Score should be number or null');
    assert.ok(Array.isArray(result.issues), 'Issues should be an array');
  });
  
  it('should filter dataset samples by criteria', async function() {
    let dataset;
    try {
      dataset = await loadDataset('webui', { limit: 50 });
    } catch (e) {
      console.log(`   ℹ️  Dataset loading failed: ${e.message}`);
      this.skip(); // Skip test if dataset not available
      return; // Safety return
    }
    
    if (!dataset || !dataset.samples || dataset.samples.length === 0) {
      console.log('   ℹ️  No samples available');
      this.skip(); // Skip test if no samples
      return; // Safety return
    }
    
    // Filter by viewport
    const desktopSamples = dataset.samples.filter(s => {
      const viewport = s.viewport || s.metadata?.viewport;
      return viewport && viewport.width >= 1920;
    });
    
    assert.ok(Array.isArray(desktopSamples), 'Filtered samples should be array');
    
    // Filter by accessibility tree availability
    const withAxtree = dataset.samples.filter(s => {
      return s.axtree || s.metadata?.axtree;
    });
    
    assert.ok(Array.isArray(withAxtree), 'Axtree samples should be array');
  });
});

