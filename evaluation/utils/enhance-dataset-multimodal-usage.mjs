#!/usr/bin/env node
/**
 * Enhance Dataset Usage for Multi-Modal Validation
 * 
 * Enhances existing datasets to use multi-modal validation capabilities:
 * - Screenshot + HTML + CSS + rendered code
 * - Cross-modal consistency checks
 * - Multi-perspective evaluation
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { validateScreenshot, extractRenderedCode, multiModalValidation } from '../../src/index.mjs';
import { startSession, endSession } from '../../src/index.mjs';

const DATASETS_DIR = join(process.cwd(), 'evaluation', 'datasets');
const RESULTS_DIR = join(process.cwd(), 'evaluation', 'results');

/**
 * Enhance WebUI dataset with multi-modal validation
 */
async function enhanceWebUIDataset() {
  const datasetPath = join(DATASETS_DIR, 'webui-ground-truth.json');
  
  if (!existsSync(datasetPath)) {
    console.log('⚠️  WebUI dataset not found');
    return null;
  }

  console.log('📊 Enhancing WebUI Dataset for Multi-Modal Validation');
  console.log('-'.repeat(70));

  const dataset = JSON.parse(readFileSync(datasetPath, 'utf8'));
  const enhanced = {
    ...dataset,
    name: `${dataset.name} (Multi-Modal Enhanced)`,
    enhanced: true,
    enhancementDate: new Date().toISOString(),
    samples: []
  };

  // Process first 10 samples as example
  const samplesToProcess = (dataset.samples || []).slice(0, 10);
  
  console.log(`Processing ${samplesToProcess.length} samples...`);
  console.log();

  for (const sample of samplesToProcess) {
    const enhancedSample = {
      ...sample,
      multiModal: {
        hasHTML: !!sample.html || !!sample.renderedHTML,
        hasCSS: !!sample.css || !!sample.renderedCSS,
        hasAccessibilityTree: !!sample.accessibilityTree || !!sample.axtree,
        hasComputedStyles: !!sample.computedStyles,
        hasBoundingBoxes: !!sample.boundingBoxes || !!sample.bboxes,
        modalities: []
      }
    };

    // Identify available modalities
    if (sample.html || sample.renderedHTML) {
      enhancedSample.multiModal.modalities.push('html');
    }
    if (sample.css || sample.renderedCSS) {
      enhancedSample.multiModal.modalities.push('css');
    }
    if (sample.accessibilityTree || sample.axtree) {
      enhancedSample.multiModal.modalities.push('accessibility-tree');
    }
    if (sample.screenshot) {
      enhancedSample.multiModal.modalities.push('screenshot');
    }
    if (sample.computedStyles) {
      enhancedSample.multiModal.modalities.push('computed-styles');
    }

    enhanced.samples.push(enhancedSample);
  }

  const outputPath = join(DATASETS_DIR, 'webui-ground-truth-multimodal-enhanced.json');
  writeFileSync(outputPath, JSON.stringify(enhanced, null, 2));
  
  console.log(`✅ Enhanced dataset saved: ${outputPath}`);
  console.log(`   Samples: ${enhanced.samples.length}`);
  console.log(`   Modalities detected: ${[...new Set(enhanced.samples.flatMap(s => s.multiModal.modalities))].join(', ')}`);
  console.log();

  return enhanced;
}

/**
 * Create multi-modal evaluation script
 */
async function createMultiModalEvaluation() {
  const sessionId = startSession('multimodal-dataset-evaluation');
  
  try {
    const datasetPath = join(DATASETS_DIR, 'webui-ground-truth-multimodal-enhanced.json');
    
    if (!existsSync(datasetPath)) {
      console.log('⚠️  Enhanced dataset not found, creating it...');
      await enhanceWebUIDataset();
    }

    const dataset = JSON.parse(readFileSync(datasetPath, 'utf8'));
    console.log(`🧪 Multi-Modal Evaluation: ${dataset.name}`);
    console.log(`📦 Samples: ${dataset.samples.length}`);
    console.log();

    // Evaluate samples with multi-modal context
    for (let i = 0; i < Math.min(dataset.samples.length, 5); i++) {
      const sample = dataset.samples[i];
      
      if (!sample.screenshot || !existsSync(sample.screenshot)) {
        console.log(`[${i + 1}] ${sample.id}: ⚠️  Screenshot not found`);
        continue;
      }

      console.log(`[${i + 1}] ${sample.id}`);
      console.log(`   Modalities: ${sample.multiModal.modalities.join(', ')}`);

      // Build multi-modal context
      const context = {
        sessionId: sessionId,
        testType: 'multimodal-evaluation',
        html: sample.html || sample.renderedHTML,
        css: sample.css || sample.renderedCSS,
        accessibilityTree: sample.accessibilityTree || sample.axtree,
        viewport: sample.viewport || { width: 1280, height: 720 }
      };

      const result = await validateScreenshot(
        sample.screenshot,
        'Evaluate this webpage using all available modalities (screenshot, HTML, CSS, accessibility tree). Check for consistency across modalities.',
        context
      );

      console.log(`   Score: ${result.score}/10`);
      console.log(`   Issues: ${result.issues?.length || 0}`);
      console.log();
    }

  } finally {
    const summary = endSession(sessionId, { verbose: true });
  }
}

/**
 * Generate capability coverage report
 */
function generateCapabilityCoverageReport() {
  const capabilities = [
    // Core Validation (4)
    { id: 1, name: 'Semantic Screenshot Validation', datasets: ['WebUI', 'Real-World', 'ScreenAI'] },
    { id: 2, name: 'Multi-Provider Support', datasets: ['All'] },
    { id: 3, name: 'Score Extraction', datasets: ['All'] },
    { id: 4, name: 'Issue Detection', datasets: ['WebUI', 'WCAG', 'Real-World'] },
    
    // High-Frequency Features (4)
    { id: 5, name: 'Temporal Decision Making', datasets: ['Temporal Graph'] },
    { id: 6, name: 'Latency-Aware Batching', datasets: ['Screenshot Selection'] },
    { id: 7, name: 'Activity-Based Preprocessing', datasets: ['Temporal Graph'] },
    { id: 8, name: 'Model Tier Selection', datasets: ['All'] },
    
    // Temporal & Sequence (4)
    { id: 9, name: 'Temporal Aggregation', datasets: ['Temporal Graph'] },
    { id: 10, name: 'Temporal Graph Building', datasets: ['Temporal Graph'] },
    { id: 11, name: 'Screenshot Selection', datasets: ['Screenshot Selection'] },
    { id: 12, name: 'Coherence Analysis', datasets: ['Temporal Graph', 'Calibration Degradation'] },
    
    // Multi-Modal (3)
    { id: 13, name: 'Multi-Modal Validation', datasets: ['WebUI', 'ScreenAI'] },
    { id: 14, name: 'Cross-Modal Consistency', datasets: ['WebUI'] },
    { id: 15, name: 'Rendered Code Extraction', datasets: ['WebUI'] },
    
    // Persona & Experience (3)
    { id: 16, name: 'Persona-Based Testing', datasets: ['Real-World'] },
    { id: 17, name: 'Experience Tracing', datasets: ['Temporal Graph'] },
    { id: 18, name: 'Experience Propagation', datasets: ['Temporal Graph'] },
    
    // Game Testing (4)
    { id: 19, name: 'Game Playing', datasets: ['Sample Dataset'] },
    { id: 20, name: 'Variable Goals', datasets: ['Sample Dataset'] },
    { id: 21, name: 'State Extraction', datasets: ['Sample Dataset'] },
    { id: 22, name: 'Game Goal Prompts', datasets: ['Sample Dataset'] },
    
    // Accessibility (3)
    { id: 23, name: 'Hybrid Accessibility', datasets: ['WCAG', 'WebUI'] },
    { id: 24, name: 'WCAG Compliance', datasets: ['WCAG'] },
    { id: 25, name: 'Accessibility Tree Validation', datasets: ['WebUI', 'ScreenAI'] },
    
    // Advanced Features (8)
    { id: 26, name: 'Ensemble Judging', datasets: ['All'] },
    { id: 27, name: 'Uncertainty Reduction', datasets: ['Calibration Degradation'] },
    { id: 28, name: 'Bias Detection & Mitigation', datasets: ['Ablation Test'] },
    { id: 29, name: 'Hallucination Detection', datasets: ['All'] },
    { id: 30, name: 'Calibration Tracking', datasets: ['Calibration Degradation'] },
    { id: 31, name: 'Counterfactual Testing', datasets: ['Ablation Test'] },
    { id: 32, name: 'Capability Stratification', datasets: ['Ablation Test'] },
    { id: 33, name: 'Baseline Validation', datasets: ['All'] }
  ];

  const datasets = {
    'WebUI': { samples: 400000, hasHTML: true, hasCSS: true, hasAccessibilityTree: true },
    'WCAG': { samples: 1000, hasHTML: false, hasCSS: false, hasAccessibilityTree: false },
    'Real-World': { samples: 4, hasHTML: false, hasCSS: false, hasAccessibilityTree: false },
    'ScreenAI': { samples: 697, hasHTML: false, hasCSS: false, hasAccessibilityTree: true },
    'Temporal Graph': { samples: 'variable', hasHTML: false, hasCSS: false, hasAccessibilityTree: false },
    'Screenshot Selection': { samples: 'variable', hasHTML: false, hasCSS: false, hasAccessibilityTree: false },
    'Calibration Degradation': { samples: 'variable', hasHTML: false, hasCSS: false, hasAccessibilityTree: false },
    'Ablation Test': { samples: 'variable', hasHTML: false, hasCSS: false, hasAccessibilityTree: false },
    'Sample Dataset': { samples: 'variable', hasHTML: false, hasCSS: false, hasAccessibilityTree: false }
  };

  const report = {
    timestamp: new Date().toISOString(),
    totalCapabilities: capabilities.length,
    capabilities: capabilities.map(cap => ({
      ...cap,
      datasetCount: cap.datasets.length,
      datasets: cap.datasets,
      coverage: cap.datasets.includes('All') ? 'Universal' : 'Partial'
    })),
    datasetCoverage: Object.keys(datasets).map(datasetName => ({
      name: datasetName,
      ...datasets[datasetName],
      capabilities: capabilities.filter(cap => 
        cap.datasets.includes(datasetName) || cap.datasets.includes('All')
      ).map(cap => cap.id)
    })),
    gaps: capabilities.filter(cap => 
      !cap.datasets.includes('All') && cap.datasets.length === 0
    ),
    summary: {
      fullyCovered: capabilities.filter(cap => cap.datasets.includes('All')).length,
      partiallyCovered: capabilities.filter(cap => !cap.datasets.includes('All') && cap.datasets.length > 0).length,
      notCovered: capabilities.filter(cap => cap.datasets.length === 0).length
    }
  };

  const reportPath = join(RESULTS_DIR, 'capability-coverage-report.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('📊 Capability Coverage Report');
  console.log('='.repeat(70));
  console.log(`Total Capabilities: ${report.totalCapabilities}`);
  console.log(`Fully Covered (All datasets): ${report.summary.fullyCovered}`);
  console.log(`Partially Covered: ${report.summary.partiallyCovered}`);
  console.log(`Not Covered: ${report.summary.notCovered}`);
  console.log();
  console.log(`✅ Report saved: ${reportPath}`);
  console.log();

  return report;
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Enhancing Dataset Usage for Multi-Modal Validation');
  console.log('='.repeat(70));
  console.log();

  // 1. Enhance WebUI dataset
  await enhanceWebUIDataset();

  // 2. Generate capability coverage report
  generateCapabilityCoverageReport();

  // 3. Create multi-modal evaluation (if Playwright available)
  console.log('💡 To run multi-modal evaluation:');
  console.log('   node evaluation/utils/enhance-dataset-multimodal-usage.mjs --evaluate');
  console.log();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes('--evaluate')) {
    createMultiModalEvaluation().catch(console.error);
  } else {
    main().catch(console.error);
  }
}

export { enhanceWebUIDataset, createMultiModalEvaluation, generateCapabilityCoverageReport };

