#!/usr/bin/env node
/**
 * Organize test files into subdirectories based on test type
 * 
 * This script helps organize the flat test/ directory into a pyramid structure:
 * - unit/ - Fast, isolated tests
 * - integration/ - Component interaction tests
 * - e2e/ - Full workflow tests
 * - security/ - Security-focused tests
 * - performance/ - Performance tests
 */

import { readdir, mkdir, stat } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const TEST_DIR = 'test';
const TEST_CATEGORIES = {
  unit: [
    'config.test.mjs',
    'logger.test.mjs',
    'constants.test.mjs',
    'errors.test.mjs',
    'load-env.test.mjs',
    'type-guards.test.mjs',
    'metrics.test.mjs',
    'rubrics.test.mjs',
    'bias-detector.test.mjs',
    'pair-comparison.test.mjs',
    'hallucination-detection.test.mjs',
    'position-counterbalance.test.mjs',
    'dynamic-few-shot.test.mjs',
    'context-compressor.test.mjs',
    'feedback-aggregator.test.mjs',
    'data-extractor.test.mjs',
    'score-tracker.test.mjs',
    'cache.test.mjs',
    'cached-llm.test.mjs',
    'baseline-validator.test.mjs',
    'capability-stratifier.test.mjs',
    'counterfactual-tester.test.mjs',
    'explainability-scorer.test.mjs',
    'intent-recognition.test.mjs',
    'error-recovery.test.mjs',
    'exported-functions.test.mjs',
    'api-submodules.test.mjs'
  ],
  integration: [
    'integration-',
    'spec-',
    'temporal-',
    'ensemble-',
    'batch-optimizer',
    'temporal-batch-optimizer',
    'temporal-preprocessor',
    'temporal-decision',
    'temporal-context',
    'multi-modal',
    'persona-experience',
    'convenience',
    'natural-language-specs',
    'spec-templates',
    'validators',
    'game-player',
    'testgameplay-integration',
    'calibration-degradation',
    'embeddings',
    'ablation-tests',
    'documentation-consistency',
    'library-best-practices',
    'verifiability-validation',
    'deep-edge-case-validation',
    'entity-extraction-performance',
    'llm-vs-regex-comparison',
    'exploratory-automation',
    'explanation-temporal',
    'integration-downstream-complexity',
    'integration-goals-cohesive',
    'integration-uncertainty-goals',
    'integration-v0.3-features',
    'spec-holistic-integration',
    'spec-integration-trace',
    'temporal-decision-manager-integration',
    'temporal-decision-improvements',
    'temporal-graph',
    'temporal-comprehensive-validation',
    'end-to-end-temporal',
    'temporal-preprocessing-default',
    'game-player-temporal-decision',
    'validation-annotation-quality',
    'validation-gameplay-temporal',
    'validation-temporal-perception',
    'validation-vllm-accuracy',
    'validators-edge-cases',
    'validators-hybrid',
    'validators-programmatic',
    'validators-template-features',
    'accessibility-hybrid',
    'screenshot-selection',
    'research-enhanced-validation',
    'research-features-validation',
    'evaluation-improvements', // Add missing patterns
    'explainability-scoring' // Add missing patterns
  ],
  e2e: [
    'game-playing',
    'validation-human-ground-truth',
    'evaluation-adapter-integration',
    'playwright-setup'
  ],
  security: [
    'path-security',
    'red-team-security',
    'cache-race-conditions',
    'action-hallucination-detection'
  ],
  performance: [
    'performance-latency',
    'high-frequency-features',
    'batch-optimizer-queue-limits'
  ],
  datasets: [
    'dataset-',
    'embeddings-dataset-validation'
  ]
};

async function organizeTests() {
  console.log('Organizing test files...\n');
  
  // Create subdirectories
  for (const category of Object.keys(TEST_CATEGORIES)) {
    const dir = join(TEST_DIR, category);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
      console.log(`Created ${dir}/`);
    }
  }
  
  // Read all test files
  const files = await readdir(TEST_DIR);
  const testFiles = files.filter(f => f.endsWith('.test.mjs') || f.endsWith('.test.js'));
  
  let moved = 0;
  let skipped = 0;
  
  for (const file of testFiles) {
    let movedTo = null;
    
    // Check each category
    for (const [category, patterns] of Object.entries(TEST_CATEGORIES)) {
      for (const pattern of patterns) {
        if (file.includes(pattern)) {
          movedTo = category;
          break;
        }
      }
      if (movedTo) break;
    }
    
    if (movedTo) {
      const src = join(TEST_DIR, file);
      const dest = join(TEST_DIR, movedTo, file);
      
      // Check if already in correct location
      if (src === dest) {
        skipped++;
        continue;
      }
      
      // Check if destination exists
      if (existsSync(dest)) {
        console.log(`⚠️  ${file} already exists in ${movedTo}/, skipping`);
        skipped++;
        continue;
      }
      
      // In dry-run mode, just log
      if (process.argv.includes('--dry-run')) {
        console.log(`Would move: ${file} → ${movedTo}/`);
        moved++;
      } else {
        // Actually move the file
        const { rename } = await import('fs/promises');
        await rename(src, dest);
        console.log(`Moved: ${file} → ${movedTo}/`);
        moved++;
      }
    } else {
      // Default to integration for unmatched files (safer than leaving in root)
      // These are likely integration tests that didn't match patterns
      movedTo = 'integration';
      const src = join(TEST_DIR, file);
      const dest = join(TEST_DIR, movedTo, file);
      
      if (src === dest) {
        skipped++;
        continue;
      }
      
      if (existsSync(dest)) {
        console.log(`⚠️  ${file} already exists in ${movedTo}/, skipping`);
        skipped++;
        continue;
      }
      
      if (process.argv.includes('--dry-run')) {
        console.log(`Would move (default): ${file} → ${movedTo}/`);
        moved++;
      } else {
        const { rename } = await import('fs/promises');
        await rename(src, dest);
        console.log(`Moved (default): ${file} → ${movedTo}/`);
        moved++;
      }
    }
  }
  
  console.log(`\n✅ Organization complete:`);
  console.log(`   Moved: ${moved} files`);
  console.log(`   Skipped: ${skipped} files`);
  
  if (process.argv.includes('--dry-run')) {
    console.log(`\n⚠️  Dry-run mode: No files were actually moved`);
    console.log(`   Run without --dry-run to actually move files`);
  }
}

organizeTests().catch(console.error);

