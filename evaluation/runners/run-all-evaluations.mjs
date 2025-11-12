#!/usr/bin/env node
/**
 * Run All Evaluations
 * 
 * Comprehensive evaluation script that:
 * 1. Downloads/loads all datasets
 * 2. Runs evaluations with standard metrics
 * 3. Compares with other methods
 * 4. Generates comprehensive reports
 */

import { runComprehensiveEvaluation } from './evaluation-rig.mjs';
import { downloadAllDatasets } from './download-datasets.mjs';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Main execution
 */
async function main() {
  console.log('🎯 Comprehensive Evaluation Suite');
  console.log('=====================================\n');
  
  // Step 1: Download/load datasets
  console.log('Step 1: Preparing datasets...');
  try {
    await downloadAllDatasets();
  } catch (error) {
    console.error('⚠️  Dataset download had issues:', error.message);
    console.log('   Continuing with available datasets...\n');
  }
  
  // Step 2: Run evaluations
  console.log('Step 2: Running evaluations...');
  const results = await runComprehensiveEvaluation({
    datasets: ['synthetic'], // Start with synthetic, add others as available
    limit: null, // No limit for now
    provider: null // Auto-detect
  });
  
  // Step 3: Generate reports
  console.log('\nStep 3: Generating reports...');
  
  // Analysis and recommendations will be in the results
  console.log('\n✅ Evaluation complete!');
  console.log(`   Results: evaluation/results/comprehensive-evaluation-*.json`);
  
  return results;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main };

