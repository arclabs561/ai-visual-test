#!/usr/bin/env node
/**
 * Create Dataset Summary
 * 
 * Generates a comprehensive summary of all available datasets,
 * their capabilities, and integration status.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const DATASETS_DIR = join(process.cwd(), 'evaluation', 'datasets');
const INTEGRATED_DIR = join(DATASETS_DIR, 'integrated');
const RESEARCH_DIR = join(DATASETS_DIR, 'research');

/**
 * Get dataset information
 */
function getDatasetInfo(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const data = JSON.parse(readFileSync(filePath, 'utf8'));
    const stats = statSync(filePath);
    
    return {
      name: data.name || 'Unknown',
      source: data.source || 'Unknown',
      sampleCount: Array.isArray(data.samples) ? data.samples.length : 'unknown',
      size: (stats.size / 1024).toFixed(2) + ' KB',
      path: filePath,
      hasScreenshots: data.samples?.some(s => s.screenshot) || false,
      hasHTML: data.samples?.some(s => s.html || s.renderedHTML) || false,
      hasCSS: data.samples?.some(s => s.css || s.renderedCSS) || false,
      hasAccessibilityTree: data.samples?.some(s => s.accessibilityTree || s.axtree) || false,
      hasGroundTruth: data.samples?.some(s => s.groundTruth) || false
    };
  } catch (error) {
    return {
      name: 'Error reading',
      error: error.message,
      path: filePath
    };
  }
}

/**
 * Generate summary
 */
function generateSummary() {
  const summary = {
    timestamp: new Date().toISOString(),
    integrated: [],
    research: [],
    statistics: {
      totalDatasets: 0,
      totalSamples: 0,
      datasetsWithScreenshots: 0,
      datasetsWithHTML: 0,
      datasetsWithCSS: 0,
      datasetsWithAccessibilityTree: 0,
      datasetsWithGroundTruth: 0
    }
  };

  // Integrated datasets
  if (existsSync(INTEGRATED_DIR)) {
    const files = readdirSync(INTEGRATED_DIR).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const info = getDatasetInfo(join(INTEGRATED_DIR, file));
      if (info) {
        summary.integrated.push(info);
        summary.statistics.totalDatasets++;
        if (typeof info.sampleCount === 'number') {
          summary.statistics.totalSamples += info.sampleCount;
        }
        if (info.hasScreenshots) summary.statistics.datasetsWithScreenshots++;
        if (info.hasHTML) summary.statistics.datasetsWithHTML++;
        if (info.hasCSS) summary.statistics.datasetsWithCSS++;
        if (info.hasAccessibilityTree) summary.statistics.datasetsWithAccessibilityTree++;
        if (info.hasGroundTruth) summary.statistics.datasetsWithGroundTruth++;
      }
    }
  }

  // Research datasets (check for downloaded status)
  if (existsSync(RESEARCH_DIR)) {
    const subdirs = readdirSync(RESEARCH_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const subdir of subdirs) {
      const subdirPath = join(RESEARCH_DIR, subdir);
      const files = readdirSync(subdirPath, { recursive: true })
        .filter(f => f.endsWith('.json') || f.endsWith('.csv') || f.endsWith('.md'));
      
      if (files.length > 0) {
        summary.research.push({
          name: subdir,
          path: subdirPath,
          files: files.length,
          downloaded: true
        });
      } else {
        summary.research.push({
          name: subdir,
          path: subdirPath,
          files: 0,
          downloaded: false
        });
      }
    }
  }

  return summary;
}

/**
 * Print summary
 */
function printSummary(summary) {
  console.log('📊 Dataset Summary');
  console.log('='.repeat(70));
  console.log();
  console.log('📈 Statistics:');
  console.log(`   Total Datasets: ${summary.statistics.totalDatasets}`);
  console.log(`   Total Samples: ${summary.statistics.totalSamples.toLocaleString()}`);
  console.log(`   With Screenshots: ${summary.statistics.datasetsWithScreenshots}`);
  console.log(`   With HTML: ${summary.statistics.datasetsWithHTML}`);
  console.log(`   With CSS: ${summary.statistics.datasetsWithCSS}`);
  console.log(`   With Accessibility Tree: ${summary.statistics.datasetsWithAccessibilityTree}`);
  console.log(`   With Ground Truth: ${summary.statistics.datasetsWithGroundTruth}`);
  console.log();

  if (summary.integrated.length > 0) {
    console.log('✅ Integrated Datasets:');
    console.log('-'.repeat(70));
    summary.integrated.forEach(ds => {
      console.log(`   ${ds.name}`);
      console.log(`      Samples: ${ds.sampleCount}`);
      console.log(`      Size: ${ds.size}`);
      console.log(`      Source: ${ds.source}`);
      const features = [];
      if (ds.hasScreenshots) features.push('Screenshots');
      if (ds.hasHTML) features.push('HTML');
      if (ds.hasCSS) features.push('CSS');
      if (ds.hasAccessibilityTree) features.push('A11y Tree');
      if (ds.hasGroundTruth) features.push('Ground Truth');
      if (features.length > 0) {
        console.log(`      Features: ${features.join(', ')}`);
      }
      console.log();
    });
  }

  if (summary.research.length > 0) {
    console.log('📚 Research Datasets:');
    console.log('-'.repeat(70));
    summary.research.forEach(ds => {
      const icon = ds.downloaded ? '✅' : '⏳';
      console.log(`   ${icon} ${ds.name}`);
      console.log(`      Downloaded: ${ds.downloaded ? 'Yes' : 'No'}`);
      console.log(`      Files: ${ds.files}`);
      console.log();
    });
  }
}

/**
 * Main function
 */
async function main() {
  const summary = generateSummary();
  const summaryPath = join(process.cwd(), 'evaluation', 'results', 'dataset-summary.json');
  
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  
  printSummary(summary);
  
  console.log(`✅ Summary saved: ${summaryPath}`);
  console.log();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { generateSummary, printSummary };

