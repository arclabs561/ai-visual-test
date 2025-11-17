#!/usr/bin/env node
/**
 * Enhance WebUI Dataset Evaluation with Multi-Modal Validation
 * 
 * Uses WebUI dataset's HTML/CSS/accessibility tree data for multi-modal validation.
 * Tests cross-modal consistency and multi-modal fusion.
 */

import { 
  validateScreenshot, 
  startSession, 
  endSession,
  extractRenderedCode 
} from '../../src/index.mjs';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const DATASET_FILE = join(process.cwd(), 'evaluation', 'datasets', 'webui-ground-truth.json');
const ENHANCED_DATASET_FILE = join(process.cwd(), 'evaluation', 'datasets', 'webui-ground-truth-multimodal-enhanced.json');

/**
 * Run multi-modal evaluation on WebUI dataset
 */
async function runMultiModalEvaluation() {
  console.log('🔍 Multi-Modal Evaluation: WebUI Dataset');
  console.log('='.repeat(70));
  console.log();

  const sessionId = startSession('webui-multimodal-evaluation');

  try {
    // Load enhanced dataset if available, otherwise use original
    let datasetPath = ENHANCED_DATASET_FILE;
    if (!existsSync(datasetPath)) {
      datasetPath = DATASET_FILE;
    }

    if (!existsSync(datasetPath)) {
      console.error(`❌ Dataset not found: ${datasetPath}`);
      return;
    }

    const dataset = JSON.parse(readFileSync(datasetPath, 'utf8'));
    console.log(`📊 Dataset: ${dataset.name}`);
    console.log(`📦 Samples: ${dataset.samples?.length || 0}`);
    console.log();

    // Process samples with multi-modal context
    const samplesToTest = (dataset.samples || []).slice(0, 5);
    let evaluated = 0;
    let multiModalCount = 0;

    for (const sample of samplesToTest) {
      if (!sample.screenshot || !existsSync(sample.screenshot)) {
        console.log(`⚠️  ${sample.id}: Screenshot not found`);
        continue;
      }

      console.log(`[${evaluated + 1}] ${sample.id || sample.name || 'Sample'}`);

      // Build multi-modal context
      const context = {
        sessionId: sessionId,
        testType: 'webui-multimodal',
        html: sample.html || sample.renderedHTML,
        css: sample.css || sample.renderedCSS,
        accessibilityTree: sample.accessibilityTree || sample.axtree,
        computedStyles: sample.computedStyles,
        boundingBoxes: sample.boundingBoxes || sample.bboxes,
        viewport: sample.viewport || { width: 1280, height: 720 }
      };

      // Count available modalities
      const modalities = [];
      if (context.html) modalities.push('HTML');
      if (context.css) modalities.push('CSS');
      if (context.accessibilityTree) modalities.push('Accessibility Tree');
      if (context.computedStyles) modalities.push('Computed Styles');
      if (context.boundingBoxes) modalities.push('Bounding Boxes');

      console.log(`   Modalities: ${modalities.length > 0 ? modalities.join(', ') : 'Screenshot only'}`);

      if (modalities.length > 0) {
        multiModalCount++;
      }

      try {
        const prompt = modalities.length > 0
          ? `Evaluate this webpage using all available modalities (screenshot${modalities.length > 0 ? ', ' + modalities.join(', ') : ''}). Check for consistency across modalities and identify any discrepancies.`
          : 'Evaluate this webpage screenshot for accessibility, design quality, and usability.';

        const result = await validateScreenshot(
          sample.screenshot,
          prompt,
          context
        );

        console.log(`   ✅ Score: ${result.score}/10`);
        console.log(`   📋 Issues: ${result.issues?.length || 0}`);
        if (result.cached) {
          console.log('   💾 Cached');
        }
        evaluated++;
      } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
      }
      console.log();
    }

    console.log('📊 Summary:');
    console.log(`   Evaluated: ${evaluated}/${samplesToTest.length}`);
    console.log(`   Multi-Modal: ${multiModalCount}/${evaluated}`);
    console.log();

  } finally {
    const summary = endSession(sessionId, { verbose: true });
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMultiModalEvaluation().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { runMultiModalEvaluation };

