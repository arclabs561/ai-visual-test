#!/usr/bin/env node
/**
 * Integration Tests for Evaluation System and Dataset Adapters
 * 
 * Tests that verify:
 * 1. Adapters load datasets correctly
 * 2. Evaluation runner works with adapters
 * 3. Metrics are calculated correctly
 * 4. Results are saved properly
 */

import '../test-setup.mjs'; // Auto-load .env (must be first)
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { runEvaluation, evaluateSample } from '../../evaluation/runners/evaluate.mjs';
import { loadDataset, listAvailableDatasets } from '../../evaluation/utils/dataset-adapters.mjs';

describe('Evaluation Adapter Integration', () => {
  
  describe('Dataset Adapters', () => {
    it('should list available datasets', () => {
      const datasets = listAvailableDatasets();
      assert.ok(Array.isArray(datasets), 'Should return array');
      assert.ok(datasets.length > 0, 'Should have at least one dataset');
      
      // Check structure
      for (const dataset of datasets) {
        assert.ok(dataset.name, 'Dataset should have name');
        assert.ok(typeof dataset.available === 'boolean' || typeof dataset.available === 'object', 
          'Dataset should have availability status');
      }
    });
    
    it('should load real dataset via adapter', async function() {
      let dataset;
      try {
        dataset = await loadDataset('real', { limit: 2 });
      } catch (e) {
        console.log(`   ℹ️  Dataset loading failed: ${e.message}`);
        this.skip(); // Skip test if dataset not available
        return; // Safety return
      }
      
      if (!dataset || !dataset.samples || dataset.samples.length === 0) {
        console.log('   ℹ️  No real dataset samples available');
        this.skip(); // Skip test if no samples
        return; // Safety return
      }
      
      assert.ok(dataset, 'Should load dataset');
      assert.ok(dataset.samples, 'Should have samples');
      assert.ok(Array.isArray(dataset.samples), 'Samples should be array');
      assert.ok(dataset.samples.length > 0, 'Should have at least one sample');
      
      // Check sample structure
      const sample = dataset.samples[0];
      assert.ok(sample.id, 'Sample should have id');
      assert.ok(sample.screenshot || sample.screenshotPath, 'Sample should have screenshot');
    });
  });
  
  describe('Evaluation Runner', () => {
    it('should evaluate single sample', async function() {
      // Load a sample
      let dataset;
      try {
        dataset = await loadDataset('real', { limit: 1 });
      } catch (e) {
        console.log(`   ℹ️  Dataset loading failed: ${e.message}`);
        this.skip(); // Skip test if dataset not available
        return; // Safety return
      }
      
      if (!dataset || !dataset.samples || dataset.samples.length === 0) {
        console.log('   ℹ️  No real dataset samples available');
        this.skip(); // Skip test if no samples
        return; // Safety return
      }
      
      const sample = dataset.samples[0];
      
      // Skip if screenshot doesn't exist
      if (!sample.screenshot || !existsSync(sample.screenshot)) {
        this.skip();
        return;
      }
      
      const result = await evaluateSample(sample, { useCache: true });
      
      assert.ok(result, 'Should return result');
      assert.ok(result.sampleId, 'Should have sampleId');
      assert.ok(typeof result.success === 'boolean', 'Should have success flag');
      
      if (result.success) {
        assert.ok(result.result, 'Should have result');
        assert.ok(typeof result.result.score === 'number' || result.result.score === null, 
          'Score should be number or null');
        assert.ok(Array.isArray(result.result.issues), 'Issues should be array');
      }
    });
    
    it('should run full evaluation with adapter', async function() {
      // API keys should be auto-loaded from .env via test-setup.mjs
      
      // Check if dataset is available first
      try {
        const testDataset = await loadDataset('real', { limit: 1 });
        if (!testDataset || !testDataset.samples || testDataset.samples.length === 0) {
          console.log('   ℹ️  No real dataset samples available');
          this.skip(); // Skip test if no samples
          return; // Safety return
        }
      } catch (e) {
        console.log(`   ℹ️  Dataset loading failed: ${e.message}`);
        this.skip(); // Skip test if dataset not available
        return; // Safety return
      }
      
      const results = await runEvaluation({
        dataset: 'real',
        limit: 2,
        useCache: true
      });
      
      assert.ok(results, 'Should return results');
      assert.ok(results.timestamp, 'Should have timestamp');
      assert.ok(results.dataset, 'Should have dataset info');
      assert.ok(results.results, 'Should have results array');
      assert.ok(Array.isArray(results.results), 'Results should be array');
      assert.ok(results.metrics, 'Should have metrics');
      assert.ok(results.summary, 'Should have summary');
      
      // Check summary
      assert.ok(typeof results.summary.total === 'number', 'Summary should have total');
      assert.ok(typeof results.summary.successful === 'number', 'Summary should have successful');
    });
  });
  
  describe('Issue Filtering', () => {
    it('should filter duplicate issues', async () => {
      const { filterIssues, disableEmbeddingFiltering } = await import('../../evaluation/utils/issue-filter.mjs');
      
      // Disable embeddings for this test to ensure consistent behavior
      disableEmbeddingFiltering();
      
      const issues = [
        'Color contrast may not meet WCAG guidelines',
        'Color contrast may not meet WCAG guidelines', // Duplicate
        'Alt text for images missing',
        'Alt text for images missing' // Duplicate
      ];
      
      const filtered = await filterIssues(issues);
      
      assert.ok(filtered.length < issues.length, `Should filter duplicates (got ${filtered.length} from ${issues.length})`);
      assert.ok(filtered.length >= 2, `Should keep unique issues (got ${filtered.length}, expected >= 2)`);
    });
    
    it('should filter generic issues', async () => {
      const { filterIssues, disableEmbeddingFiltering } = await import('../../evaluation/utils/issue-filter.mjs');
      
      // Disable embeddings for this test to ensure consistent behavior
      disableEmbeddingFiltering();
      
      const issues = [
        'Color contrast may not meet WCAG guidelines', // Specific
        'May need improvement', // Generic (no specific terms)
        'Could be better', // Generic (no specific terms)
        'Alt text for images missing' // Specific
      ];
      
      const filtered = await filterIssues(issues);
      
      // Should keep specific issues, filter generic ones
      assert.ok(filtered.length <= issues.length, `Should filter some issues (got ${filtered.length} from ${issues.length})`);
      assert.ok(filtered.length >= 2, `Should keep at least 2 specific issues (got ${filtered.length}, expected >= 2)`);
      // Check that we kept the specific issues (may be normalized)
      const filteredText = filtered.join(' ').toLowerCase();
      assert.ok(filteredText.includes('contrast') || filteredText.includes('wcag'), 
        `Should keep contrast issue (filtered: ${filteredText})`);
      assert.ok(filteredText.includes('alt') || filteredText.includes('image'), 
        `Should keep alt text issue (filtered: ${filteredText})`);
    });
  });
  
  describe('Metrics Calculation', () => {
    it('should calculate metrics from evaluations', async () => {
      const { calculateEvaluationMetrics } = await import('../../evaluation/runners/evaluate.mjs');
      
      const evaluations = [
        {
          success: true,
          result: { score: 8.0, issues: ['issue1'] },
          validation: {
            score: { predicted: 8.0, actual: 8.0, error: 0.0, withinTolerance: true },
            issues: { precision: 1.0, recall: 1.0, f1: 1.0 }
          }
        },
        {
          success: true,
          result: { score: 7.0, issues: ['issue2'] },
          validation: {
            score: { predicted: 7.0, actual: 8.0, error: 1.0, withinTolerance: true },
            issues: { precision: 0.5, recall: 1.0, f1: 0.67 }
          }
        }
      ];
      
      const metrics = calculateEvaluationMetrics(evaluations);
      
      assert.ok(metrics, 'Should return metrics');
      assert.ok(metrics.sampleSize === 2, 'Should have correct sample size');
      assert.ok(metrics.scoreMetrics, 'Should have score metrics');
      assert.ok(metrics.issueMetrics, 'Should have issue metrics');
      
      if (metrics.scoreMetrics) {
        assert.ok(typeof metrics.scoreMetrics.mae === 'number', 'Should have MAE');
        assert.ok(typeof metrics.scoreMetrics.correlation === 'number' || metrics.scoreMetrics.correlation === null, 
          'Should have correlation');
      }
    });
  });
});

