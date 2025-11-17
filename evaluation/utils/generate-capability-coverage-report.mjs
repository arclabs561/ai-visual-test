#!/usr/bin/env node
/**
 * Generate Capability Coverage Report
 * 
 * Analyzes which datasets test which of the 33 system capabilities.
 * Identifies gaps and provides recommendations.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const DATASETS_DIR = join(process.cwd(), 'evaluation', 'datasets');
const RESULTS_DIR = join(process.cwd(), 'evaluation', 'results');

/**
 * All 33 system capabilities
 */
const CAPABILITIES = [
  // Core Validation (4)
  { id: 1, name: 'Semantic Screenshot Validation', category: 'Core Validation' },
  { id: 2, name: 'Multi-Provider Support', category: 'Core Validation' },
  { id: 3, name: 'Score Extraction', category: 'Core Validation' },
  { id: 4, name: 'Issue Detection', category: 'Core Validation' },
  
  // High-Frequency Features (4)
  { id: 5, name: 'Temporal Decision Making', category: 'High-Frequency' },
  { id: 6, name: 'Latency-Aware Batching', category: 'High-Frequency' },
  { id: 7, name: 'Activity-Based Preprocessing', category: 'High-Frequency' },
  { id: 8, name: 'Model Tier Selection', category: 'High-Frequency' },
  
  // Temporal & Sequence (4)
  { id: 9, name: 'Temporal Aggregation', category: 'Temporal & Sequence' },
  { id: 10, name: 'Temporal Graph Building', category: 'Temporal & Sequence' },
  { id: 11, name: 'Screenshot Selection', category: 'Temporal & Sequence' },
  { id: 12, name: 'Coherence Analysis', category: 'Temporal & Sequence' },
  
  // Multi-Modal (3)
  { id: 13, name: 'Multi-Modal Validation', category: 'Multi-Modal' },
  { id: 14, name: 'Cross-Modal Consistency', category: 'Multi-Modal' },
  { id: 15, name: 'Rendered Code Extraction', category: 'Multi-Modal' },
  
  // Persona & Experience (3)
  { id: 16, name: 'Persona-Based Testing', category: 'Persona & Experience' },
  { id: 17, name: 'Experience Tracing', category: 'Persona & Experience' },
  { id: 18, name: 'Experience Propagation', category: 'Persona & Experience' },
  
  // Game Testing (4)
  { id: 19, name: 'Game Playing', category: 'Game Testing' },
  { id: 20, name: 'Variable Goals', category: 'Game Testing' },
  { id: 21, name: 'State Extraction', category: 'Game Testing' },
  { id: 22, name: 'Game Goal Prompts', category: 'Game Testing' },
  
  // Accessibility (3)
  { id: 23, name: 'Hybrid Accessibility', category: 'Accessibility' },
  { id: 24, name: 'WCAG Compliance', category: 'Accessibility' },
  { id: 25, name: 'Accessibility Tree Validation', category: 'Accessibility' },
  
  // Advanced Features (8)
  { id: 26, name: 'Ensemble Judging', category: 'Advanced Features' },
  { id: 27, name: 'Uncertainty Reduction', category: 'Advanced Features' },
  { id: 28, name: 'Bias Detection & Mitigation', category: 'Advanced Features' },
  { id: 29, name: 'Hallucination Detection', category: 'Advanced Features' },
  { id: 30, name: 'Calibration Tracking', category: 'Advanced Features' },
  { id: 31, name: 'Counterfactual Testing', category: 'Advanced Features' },
  { id: 32, name: 'Capability Stratification', category: 'Advanced Features' },
  { id: 33, name: 'Baseline Validation', category: 'Advanced Features' }
];

/**
 * Map capabilities to datasets
 */
function mapCapabilitiesToDatasets() {
  const mapping = {
    'webui-ground-truth.json': [1, 3, 4, 13, 14, 15, 25],
    'wcag-ground-truth.json': [4, 23, 24],
    'real-dataset.json': [1, 3, 4, 16],
    'screenai-annotation.json': [1, 4, 25],
    'screenai-qa.json': [1, 3],
    'temporal-graph.json': [5, 7, 9, 10, 12, 17, 18],
    'screenshot-selection.json': [6, 11],
    'calibration-degradation.json': [12, 27, 30],
    'ablation-test-dataset.json': [28, 31, 32],
    'sample-dataset.json': [19, 20, 21, 22]
  };

  // Universal capabilities (testable with any dataset)
  const universalCapabilities = [2, 8, 26, 29, 33];

  return { mapping, universalCapabilities };
}

/**
 * Generate report
 */
function generateReport() {
  const { mapping, universalCapabilities } = mapCapabilitiesToDatasets();
  
  // Find all datasets
  const datasetFiles = readdirSync(DATASETS_DIR).filter(f => 
    f.endsWith('.json') && existsSync(join(DATASETS_DIR, f))
  );

  const datasetInfo = {};
  const capabilityCoverage = {};

  // Initialize capability coverage
  CAPABILITIES.forEach(cap => {
    capabilityCoverage[cap.id] = {
      capability: cap,
      testedBy: [],
      coverage: 'none'
    };
  });

  // Process each dataset
  for (const file of datasetFiles) {
    const filePath = join(DATASETS_DIR, file);
    try {
      const data = JSON.parse(readFileSync(filePath, 'utf8'));
      const samples = data.samples || [];
      
      datasetInfo[file] = {
        name: data.name || file,
        sampleCount: Array.isArray(samples) ? samples.length : 'unknown',
        capabilities: mapping[file] || []
      };

      // Mark capabilities as tested
      (mapping[file] || []).forEach(capId => {
        if (capabilityCoverage[capId]) {
          capabilityCoverage[capId].testedBy.push(file);
          capabilityCoverage[capId].coverage = 'partial';
        }
      });
    } catch (error) {
      console.warn(`⚠️  Failed to process ${file}: ${error.message}`);
    }
  }

  // Mark universal capabilities
  universalCapabilities.forEach(capId => {
    if (capabilityCoverage[capId]) {
      capabilityCoverage[capId].coverage = 'universal';
      capabilityCoverage[capId].testedBy = ['All datasets'];
    }
  });

  // Calculate statistics
  const stats = {
    totalCapabilities: CAPABILITIES.length,
    fullyCovered: Object.values(capabilityCoverage).filter(c => c.coverage === 'universal').length,
    partiallyCovered: Object.values(capabilityCoverage).filter(c => c.coverage === 'partial').length,
    notCovered: Object.values(capabilityCoverage).filter(c => c.coverage === 'none').length
  };

  const report = {
    timestamp: new Date().toISOString(),
    statistics: stats,
    capabilities: Object.values(capabilityCoverage).map(c => ({
      id: c.capability.id,
      name: c.capability.name,
      category: c.capability.category,
      coverage: c.coverage,
      testedBy: c.testedBy,
      datasetCount: c.testedBy.length
    })),
    datasets: Object.entries(datasetInfo).map(([file, info]) => ({
      file,
      ...info,
      capabilityCount: info.capabilities.length
    })),
    gaps: Object.values(capabilityCoverage)
      .filter(c => c.coverage === 'none')
      .map(c => ({
        id: c.capability.id,
        name: c.capability.name,
        category: c.capability.category
      })),
    recommendations: generateRecommendations(capabilityCoverage, datasetInfo)
  };

  return report;
}

/**
 * Generate recommendations
 */
function generateRecommendations(capabilityCoverage, datasetInfo) {
  const recommendations = [];

  // Find capabilities with no coverage
  const notCovered = Object.values(capabilityCoverage).filter(c => c.coverage === 'none');
  if (notCovered.length > 0) {
    recommendations.push({
      priority: 'high',
      issue: `${notCovered.length} capabilities have no test coverage`,
      capabilities: notCovered.map(c => c.capability.name),
      action: 'Create test datasets or enhance existing ones'
    });
  }

  // Find capabilities with limited coverage
  const limitedCoverage = Object.values(capabilityCoverage).filter(
    c => c.coverage === 'partial' && c.testedBy.length === 1
  );
  if (limitedCoverage.length > 0) {
    recommendations.push({
      priority: 'medium',
      issue: `${limitedCoverage.length} capabilities tested by only one dataset`,
      capabilities: limitedCoverage.map(c => c.capability.name),
      action: 'Add additional datasets to improve coverage'
    });
  }

  return recommendations;
}

/**
 * Print report
 */
function printReport(report) {
  console.log('📊 Capability Coverage Report');
  console.log('='.repeat(70));
  console.log();
  console.log('📈 Statistics:');
  console.log(`   Total Capabilities: ${report.statistics.totalCapabilities}`);
  console.log(`   Fully Covered (Universal): ${report.statistics.fullyCovered}`);
  console.log(`   Partially Covered: ${report.statistics.partiallyCovered}`);
  console.log(`   Not Covered: ${report.statistics.notCovered}`);
  console.log();

  // Group by category
  const byCategory = {};
  report.capabilities.forEach(cap => {
    if (!byCategory[cap.category]) {
      byCategory[cap.category] = [];
    }
    byCategory[cap.category].push(cap);
  });

  console.log('📋 Coverage by Category:');
  console.log('-'.repeat(70));
  for (const [category, caps] of Object.entries(byCategory)) {
    const covered = caps.filter(c => c.coverage !== 'none').length;
    console.log(`   ${category}: ${covered}/${caps.length} covered`);
  }
  console.log();

  // Show gaps
  if (report.gaps.length > 0) {
    console.log('⚠️  Gaps (No Coverage):');
    console.log('-'.repeat(70));
    report.gaps.forEach(gap => {
      console.log(`   [${gap.id}] ${gap.name} (${gap.category})`);
    });
    console.log();
  }

  // Show recommendations
  if (report.recommendations.length > 0) {
    console.log('💡 Recommendations:');
    console.log('-'.repeat(70));
    report.recommendations.forEach(rec => {
      console.log(`   [${rec.priority.toUpperCase()}] ${rec.issue}`);
      console.log(`      Action: ${rec.action}`);
    });
    console.log();
  }

  // Dataset summary
  console.log('📁 Dataset Summary:');
  console.log('-'.repeat(70));
  report.datasets.forEach(ds => {
    console.log(`   ${ds.file}:`);
    console.log(`      Samples: ${ds.sampleCount}`);
    console.log(`      Capabilities: ${ds.capabilityCount}`);
  });
  console.log();
}

/**
 * Main function
 */
async function main() {
  const report = generateReport();
  const reportPath = join(RESULTS_DIR, 'capability-coverage-report.json');
  
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  printReport(report);
  
  console.log(`✅ Report saved: ${reportPath}`);
  console.log();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { generateReport, printReport };

