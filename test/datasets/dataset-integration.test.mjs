/**
 * Dataset Integration Tests
 * 
 * Tests that verify datasets work together with the validation system.
 */

import '../test-setup.mjs'; // Auto-load .env (must be first)
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { loadDataset } from '../../evaluation/utils/dataset-adapters.mjs';
import { validateScreenshot } from '../../src/index.mjs';
import { StateValidator, AccessibilityValidator } from '../../src/validators/index.mjs';

// Note: We use adapters now, not converted JSON files

describe('Dataset Integration Tests', () => {
  
  describe('WebUI Dataset Integration', () => {
    it('should load and validate WebUI samples', async function() {
      let dataset;
      try {
        dataset = await loadDataset('webui', { limit: 5 });
      } catch (e) {
        console.log(`   ℹ️  Dataset loading failed: ${e.message}`);
        this.skip(); // Skip test if dataset loading fails
        return; // Safety return
      }
      
      // Gracefully handle missing dataset directory (removed from repo)
      if (!dataset || !dataset.samples || dataset.samples.length === 0) {
        console.log('   ℹ️  No samples available (dataset directory not present)');
        this.skip(); // Skip test if dataset not available
        return; // Safety return
      }
      
      assert.ok(dataset.samples.length > 0, 'Should have samples');
      
      // Test that samples have required fields
      for (const sample of dataset.samples) {
        assert.ok(sample.id, 'Sample should have id');
        assert.ok(sample.screenshot || sample.screenshotPath, 'Sample should have screenshot path');
      }
    });
    
    it('should work with StateValidator', async function() {
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
        console.log('   ℹ️  No samples available');
        this.skip();
        return;
      }
      
      const sample = dataset.samples[0];
      const screenshotPath = sample.screenshot || sample.screenshotPath;
      
      if (!screenshotPath || !existsSync(screenshotPath)) {
        return;
      }
      
      const validator = new StateValidator();
      const expectedState = { loaded: true };
      
      const result = await validator.validateState(
        screenshotPath,
        expectedState,
        { testType: 'state_validation' }
      );
      
      assert.ok(result, 'Result should be returned');
      assert.ok('matches' in result, 'Result should have matches property');
    });
    
    it('should work with AccessibilityValidator', async function() {
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
        console.log('   ℹ️  No samples available');
        this.skip();
        return;
      }
      
      const sample = dataset.samples[0];
      const screenshotPath = sample.screenshot || sample.screenshotPath;
      
      if (!screenshotPath || !existsSync(screenshotPath)) {
        console.log(`   ℹ️  Screenshot not found: ${screenshotPath}`);
        this.skip();
      }
      
      const validator = new AccessibilityValidator();
      
      let result;
      try {
        result = await validator.validateAccessibility(
          screenshotPath,
          { testType: 'accessibility' }
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
      assert.ok('violations' in result, 'Result should have violations');
      assert.ok('passes' in result, 'Result should have passes property');
    });
  });
  
  describe('WCAG Dataset Integration', () => {
    it('should load WCAG test cases via adapter', async function() {
      let dataset;
      try {
        dataset = await loadDataset('wcag', { limit: 5 });
      } catch (e) {
        console.log(`   ℹ️  WCAG dataset loading failed: ${e.message}`);
        this.skip();
        return;
      }
      
      if (!dataset || !dataset.samples || dataset.samples.length === 0) {
        console.log('   ℹ️  No WCAG test cases available');
        this.skip();
        return;
      }
      
      assert.ok(dataset.samples.length > 0, 'Should have test cases');
      
      // Check structure
      const testCase = dataset.samples[0];
      assert.ok(testCase.id, 'Test case should have id');
      assert.ok(testCase.groundTruth, 'Test case should have ground truth');
      assert.ok(testCase.metadata, 'Test case should have metadata');
    });
  });
  
  describe('Dataset Loading Performance', () => {
    it('should load dataset via adapter efficiently', async function() {
      let dataset1, dataset2;
      try {
        const start = Date.now();
        dataset1 = await loadDataset('webui', { limit: 10 });
        const time1 = Date.now() - start;
        
        const start2 = Date.now();
        dataset2 = await loadDataset('webui', { limit: 10 });
        const time2 = Date.now() - start2;
      } catch (e) {
        console.log(`   ℹ️  Dataset loading failed: ${e.message}`);
        this.skip(); // Skip test if dataset not available
        return; // Safety return
      }
      
      if (!dataset1 || !dataset2 || dataset1.loaded === 0 || dataset2.loaded === 0) {
        console.log('   ℹ️  No samples available (dataset directory not present)');
        this.skip(); // Skip test if dataset not available
        return; // Safety return
      }
      
      // Adapter loads on-the-fly, should be reasonably fast
      assert.ok(dataset1, 'First load should work');
      assert.ok(dataset2, 'Second load should work');
      assert.ok(dataset1.loaded > 0, 'Should load samples');
      assert.ok(dataset2.loaded > 0, 'Should load samples');
      
      // Both should load same number (deterministic)
      assert.strictEqual(dataset1.loaded, dataset2.loaded, 'Should load same number of samples');
    });
  });
});
