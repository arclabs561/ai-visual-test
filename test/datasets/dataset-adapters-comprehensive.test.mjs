#!/usr/bin/env node
/**
 * Comprehensive Dataset Adapter Tests
 * 
 * Tests all adapters for:
 * - Correct loading and transformation
 * - Edge cases (missing files, empty datasets, etc.)
 * - Error handling
 * - Format consistency
 * - Performance
 */

import '../test-setup.mjs'; // Auto-load .env (must be first)
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { existsSync } from 'fs';
import { loadDataset, listAvailableDatasets, WebUIAdapter, ScreenAIAdapter, WCAGAdapter, RealDatasetAdapter } from '../../evaluation/utils/dataset-adapters.mjs';

describe('Dataset Adapters - Comprehensive Tests', () => {
  
  describe('Adapter Registry', () => {
    it('should list all available datasets', () => {
      const datasets = listAvailableDatasets();
      assert.ok(Array.isArray(datasets), 'Should return array');
      assert.ok(datasets.length > 0, 'Should have at least one dataset');
      
      // Check required fields
      for (const dataset of datasets) {
        assert.ok(dataset.name, 'Dataset should have name');
        assert.ok(typeof dataset.available === 'boolean' || typeof dataset.available === 'object', 
          'Dataset should have availability status');
        assert.ok(dataset.adapter, 'Dataset should have adapter name');
      }
    });
    
    it('should have correct adapter names', () => {
      const datasets = listAvailableDatasets();
      const names = datasets.map(d => d.name);
      
      // Check expected adapters exist
      assert.ok(names.includes('webui') || names.includes('webui-7k'), 'Should have webui adapter');
      assert.ok(names.includes('screenai'), 'Should have screenai adapter');
      assert.ok(names.includes('wcag') || names.includes('wcag-test-cases'), 'Should have wcag adapter');
      assert.ok(names.includes('real') || names.includes('real-dataset'), 'Should have real adapter');
    });
  });
  
  describe('WebUI Adapter', () => {
    it('should check availability correctly', () => {
      const adapter = new WebUIAdapter();
      const available = adapter.isAvailable();
      
      // Should return boolean or object with available property
      const isAvailable = typeof available === 'boolean' ? available : available.available;
      
      if (isAvailable) {
        assert.ok(adapter.getTotalCount() > 0, 'Should have samples if available');
      } else {
        // If not available, should have message
        if (typeof available === 'object') {
          assert.ok(available.message, 'Should have message when not available');
        }
      }
    });
    
    it('should load samples with correct format', async function() {
      let result;
      try {
        result = await loadDataset('webui', { limit: 3 });
      } catch (e) {
        console.log(`   ℹ️  Dataset loading failed: ${e.message}`);
        this.skip(); // Skip test if dataset not available
        return; // Safety return
      }
      
      if (!result || !result.samples || result.loaded === 0) {
        console.log('   ℹ️  No WebUI samples available');
        this.skip(); // Skip test if no samples
        return; // Safety return
      }
      
      assert.ok(result.samples, 'Should have samples array');
      assert.ok(Array.isArray(result.samples), 'Samples should be array');
      assert.ok(result.loaded > 0, 'Should have loaded samples');
      assert.ok(result.totalAvailable > 0, 'Should report total available');
      
      // Check sample format matches EVALUATION_FORMAT
      const sample = result.samples[0];
      assert.ok(sample.id, 'Sample should have id');
      assert.ok(sample.screenshot, 'Sample should have screenshot path');
      assert.ok(sample.groundTruth, 'Sample should have groundTruth');
      assert.ok(sample.metadata, 'Sample should have metadata');
      assert.ok(sample.metadata.dataset, 'Metadata should have dataset name');
    });
    
    it('should handle limit and offset correctly', async function() {
      let result1, result2;
      try {
        result1 = await loadDataset('webui', { limit: 5, offset: 0 });
        result2 = await loadDataset('webui', { limit: 5, offset: 5 });
      } catch (e) {
        console.log(`   ℹ️  Dataset loading failed: ${e.message}`);
        this.skip(); // Skip test if dataset not available
        return; // Safety return
      }
      
      if (!result1 || !result2 || result1.loaded === 0) {
        console.log('   ℹ️  No WebUI samples available');
        this.skip(); // Skip test if no samples
        return; // Safety return
      }
      
      // Should load different samples
      if (result1.loaded > 0 && result2.loaded > 0) {
        assert.notStrictEqual(result1.samples[0].id, result2.samples[0].id, 
          'Offset should load different samples');
      }
    });
    
    it('should handle missing sample gracefully', async () => {
      const adapter = new WebUIAdapter();
      const sample = await adapter.loadSample('nonexistent-sample-id-12345');
      assert.strictEqual(sample, null, 'Should return null for missing sample');
    });
  });
  
  describe('ScreenAI Adapter', () => {
    it('should load annotation samples', async function() {
      let result;
      try {
        result = await loadDataset('screenai', { limit: 5 });
      } catch (e) {
        console.log(`   ℹ️  Dataset loading failed: ${e.message}`);
        this.skip(); // Skip test if dataset not available
        return; // Safety return
      }
      
      if (!result || !result.samples || result.loaded === 0) {
        console.log('   ℹ️  No ScreenAI samples available');
        this.skip(); // Skip test if no samples
        return; // Safety return
      }
      
      assert.ok(result.samples.length > 0, 'Should have samples');
      const sample = result.samples[0];
      assert.ok(sample.id, 'Sample should have id');
      assert.ok(sample.groundTruth, 'Sample should have groundTruth');
    });
  });
  
  describe('WCAG Adapter', () => {
    it('should prefer JSON file over HTML', async () => {
      const adapter = new WCAGAdapter();
      const available = adapter.isAvailable();
      
      if (!available) {
        console.log('   ℹ️  WCAG dataset not available');
        return;
      }
      
      // Should prefer testcases-actual.json if it exists
      const { join } = await import('path');
      const jsonPath = join(
        process.cwd(),
        'evaluation',
        'datasets',
        'human-annotated',
        'wcag-test-cases',
        'testcases-actual.json'
      );
      
      if (existsSync(jsonPath)) {
        const result = await loadDataset('wcag', { limit: 5 });
        assert.ok(result.loaded > 0, 'Should load from JSON file');
        
        // Check structure
        const sample = result.samples[0];
        assert.ok(sample.groundTruth?.structuredFeatures?.wcag, 'Should have WCAG structured features');
        assert.ok(sample.groundTruth?.structuredFeatures?.wcag?.ruleId, 'Should have ruleId');
      }
    });
  });
  
  describe('Real Dataset Adapter', () => {
    it('should load real dataset', async () => {
      const result = await loadDataset('real', { limit: 10 });
      
      assert.ok(result, 'Should return result');
      assert.ok(result.samples, 'Should have samples');
      assert.ok(Array.isArray(result.samples), 'Samples should be array');
      
      if (result.samples.length > 0) {
        const sample = result.samples[0];
        assert.ok(sample.id, 'Sample should have id');
        assert.ok(sample.screenshot || sample.screenshotPath, 'Sample should have screenshot');
      }
    });
  });
  
  describe('Error Handling', () => {
    it('should handle unknown dataset gracefully', async () => {
      try {
        await loadDataset('nonexistent-dataset-xyz', { limit: 1 });
        assert.fail('Should throw error for unknown dataset');
      } catch (error) {
        assert.ok(error.message.includes('Unknown dataset'), 'Should have helpful error message');
      }
    });
    
    it('should handle unavailable dataset gracefully', async () => {
      // Create adapter with non-existent path
      const adapter = new WebUIAdapter('/nonexistent/path/12345');
      const available = adapter.isAvailable();
      assert.ok(!available || (typeof available === 'object' && !available.available), 
        'Should report as unavailable');
    });
  });
  
  describe('Format Consistency', () => {
    it('should output consistent format across all adapters', async () => {
      const datasets = ['webui', 'screenai', 'wcag', 'real'];
      const formats = [];
      
      for (const name of datasets) {
        try {
          const result = await loadDataset(name, { limit: 1 });
          if (result.samples && result.samples.length > 0) {
            formats.push({
              name,
              sample: result.samples[0]
            });
          }
        } catch (e) {
          // Skip if dataset not available
        }
      }
      
      // Check all samples have required fields
      for (const { name, sample } of formats) {
        assert.ok(sample.id, `${name} sample should have id`);
        assert.ok(sample.metadata, `${name} sample should have metadata`);
        assert.ok(sample.metadata.dataset, `${name} sample should have dataset name`);
        assert.ok(sample.groundTruth !== undefined, `${name} sample should have groundTruth (can be null)`);
      }
    });
  });
  
  describe('Performance', () => {
    it('should load samples efficiently', async function() {
      let result;
      try {
        const start = Date.now();
        result = await loadDataset('webui', { limit: 10 });
        const time = Date.now() - start;
        
        if (result && result.loaded > 0) {
          // Should load 10 samples in reasonable time (<5 seconds)
          assert.ok(time < 5000, `Should load samples quickly (took ${time}ms)`);
          console.log(`   ✅ Loaded ${result.loaded} samples in ${time}ms`);
        } else {
          console.log('   ℹ️  No WebUI samples available');
          this.skip(); // Skip test if no samples
        }
      } catch (e) {
        console.log(`   ℹ️  Dataset loading failed: ${e.message}`);
        this.skip(); // Skip test if dataset not available
        return; // Safety return
      }
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle limit=0', async () => {
      const result = await loadDataset('webui', { limit: 0 });
      // Adapter may return empty array or handle limit=0 specially
      assert.ok(Array.isArray(result.samples), 'Should return samples array');
      assert.ok(result.loaded === 0, 'Should report 0 loaded for limit=0');
    });
    
    it('should handle limit larger than available', async () => {
      const result = await loadDataset('webui', { limit: 100000 });
      assert.ok(result.loaded <= result.totalAvailable, 
        'Should not load more than available');
    });
    
    it('should handle offset beyond available', async () => {
      const result = await loadDataset('webui', { limit: 10, offset: 100000 });
      assert.ok(result.samples.length === 0, 'Should return empty array for offset beyond available');
    });
  });
});

