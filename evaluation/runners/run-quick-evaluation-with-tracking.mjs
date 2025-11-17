#!/usr/bin/env node
/**
 * Quick Evaluation with Cost Tracking
 * 
 * Runs a quick evaluation on a small subset to test cost tracking.
 * Uses existing datasets to validate the system works.
 */

import { 
  startSession, 
  endSession, 
  validateScreenshot 
} from '../../src/index.mjs';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const DATASET_FILE = join(process.cwd(), 'evaluation', 'datasets', 'real-dataset.json');

async function runQuickEvaluation() {
  console.log('🚀 Quick Evaluation with Cost Tracking');
  console.log('='.repeat(70));
  console.log();

  // Start session
  const sessionId = startSession('quick-evaluation', { verbose: false });

  try {
    // Load dataset
    if (!existsSync(DATASET_FILE)) {
      console.error(`❌ Dataset not found: ${DATASET_FILE}`);
      return;
    }

    const dataset = JSON.parse(readFileSync(DATASET_FILE, 'utf8'));
    console.log(`📊 Dataset: ${dataset.name}`);
    console.log(`📦 Samples: ${dataset.samples?.length || 0}`);
    console.log();

    // Evaluate first 3 samples
    const samplesToTest = (dataset.samples || []).slice(0, 3);
    
    if (samplesToTest.length === 0) {
      console.log('⚠️  No samples to evaluate');
      return;
    }

    console.log(`🧪 Evaluating ${samplesToTest.length} sample(s)...`);
    console.log();

    for (let i = 0; i < samplesToTest.length; i++) {
      const sample = samplesToTest[i];
      console.log(`[${i + 1}/${samplesToTest.length}] ${sample.name || sample.id}`);

      if (!sample.screenshot || !existsSync(sample.screenshot)) {
        console.log('   ⚠️  Screenshot not found, skipping');
        continue;
      }

      try {
        const result = await validateScreenshot(
          sample.screenshot,
          'Evaluate this webpage for accessibility, design quality, and usability',
          {
            sessionId: sessionId,
            testType: 'quick-evaluation'
          }
        );

        console.log(`   ✅ Score: ${result.score}/10`);
        if (result.issues && result.issues.length > 0) {
          console.log(`   📋 Issues: ${result.issues.length}`);
        }
        if (result.cached) {
          console.log('   💾 Cached');
        }
      } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
      }
      console.log();
    }

  } finally {
    // End session and get summary
    console.log('📊 Session Summary:');
    console.log('-'.repeat(70));
    const summary = endSession(sessionId, { verbose: true });
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runQuickEvaluation().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { runQuickEvaluation };

