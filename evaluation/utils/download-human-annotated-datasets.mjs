#!/usr/bin/env node
/**
 * Download Human-Annotated Datasets
 * 
 * Downloads and integrates known human-annotated datasets:
 * 1. WebUI Dataset - Visual UI understanding with web semantics
 * 2. Tabular Accessibility Dataset - LLM-based web accessibility auditing
 * 3. WCAG Test Cases - Official W3C test cases with known pass/fail
 * 4. Apple Screen Recognition Dataset - UI element annotations
 * 
 * These datasets have actual human annotations, not just screenshots.
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import https from 'https';
import http from 'http';

const DATASETS_DIR = join(process.cwd(), 'evaluation', 'datasets', 'human-annotated');
const METADATA_DIR = join(DATASETS_DIR, 'metadata');

if (!existsSync(DATASETS_DIR)) {
  mkdirSync(DATASETS_DIR, { recursive: true });
}
if (!existsSync(METADATA_DIR)) {
  mkdirSync(METADATA_DIR, { recursive: true });
}

/**
 * Known human-annotated datasets
 */
const HUMAN_ANNOTATED_DATASETS = [
  {
    name: 'WebUI Dataset',
    source: 'https://uimodeling.github.io/',
    description: 'Visual UI understanding with web semantics, HTML/CSS annotations, accessibility metadata',
    type: 'visual-ui-understanding',
    annotations: ['html', 'css', 'semantic', 'accessibility'],
    downloadUrl: null, // Need to find actual download link
    format: 'json',
    citation: 'WebUI Dataset for Visual UI Understanding'
  },
  {
    name: 'Tabular Accessibility Dataset',
    source: 'https://www.mdpi.com/2306-5729/10/9/149',
    description: 'Benchmark for LLM-based web accessibility auditing with WCAG compliance annotations',
    type: 'accessibility-auditing',
    annotations: ['wcag', 'violations', 'ground-truth'],
    downloadUrl: null, // Need to find actual download link
    format: 'json',
    citation: 'Tabular Accessibility Dataset (MDPI Data)'
  },
  {
    name: 'WCAG Test Cases',
    source: 'W3C WCAG Test Cases',
    description: 'Official WCAG test cases with known pass/fail outcomes',
    type: 'wcag-test-cases',
    annotations: ['pass', 'fail', 'wcag-level'],
    downloadUrl: null, // W3C test cases may be in different format
    format: 'html/json',
    citation: 'W3C WCAG Test Cases'
  },
  {
    name: 'Apple Screen Recognition Dataset',
    source: 'Apple Research',
    description: '77,637 screens from 4,068 iPhone apps with UI element annotations',
    type: 'ui-element-detection',
    annotations: ['ui-elements', 'accessibility', 'screen-annotations'],
    downloadUrl: null, // Need to find actual download link
    format: 'json',
    citation: 'Apple Screen Recognition Dataset'
  }
];

/**
 * Download file from URL
 */
async function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = createWriteStream(outputPath);
    
    protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // Handle redirect
        return downloadFile(response.headers.location, outputPath).then(resolve).catch(reject);
      }
      
      if (response.statusCode !== 200) {
        file.close();
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(outputPath);
      });
    }).on('error', (err) => {
      file.close();
      reject(err);
    });
  });
}

/**
 * Convert dataset to our format
 */
function convertToOurFormat(dataset, sourceData) {
  // Convert external dataset format to our ground truth format
  const samples = [];
  
  if (Array.isArray(sourceData)) {
    for (const item of sourceData) {
      const sample = {
        id: item.id || `sample-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: item.name || item.title || 'Unknown',
        url: item.url || null,
        category: dataset.type,
        screenshot: item.screenshot || item.image || null,
        groundTruth: {
          // Use actual human annotations from dataset
          humanScore: item.humanScore || item.score || null,
          humanIssues: item.humanIssues || item.issues || item.violations || [],
          humanReasoning: item.humanReasoning || item.reasoning || null,
          annotatorId: item.annotatorId || item.evaluatorId || 'dataset-annotator',
          timestamp: item.timestamp || new Date().toISOString(),
          // Dataset-specific annotations
          annotations: item.annotations || {},
          // Expected score (if available)
          expectedScore: item.expectedScore || null,
          // Known good/bad (if available)
          knownGood: item.knownGood || [],
          knownBad: item.knownBad || []
        },
        metadata: {
          dataset: dataset.name,
          source: dataset.source,
          citation: dataset.citation,
          originalFormat: dataset.format,
          timestamp: new Date().toISOString()
        }
      };
      
      samples.push(sample);
    }
  }
  
  return samples;
}

/**
 * Create dataset metadata
 */
function createDatasetMetadata(dataset, sampleCount) {
  return {
    name: dataset.name,
    source: dataset.source,
    description: dataset.description,
    type: dataset.type,
    annotations: dataset.annotations,
    citation: dataset.citation,
    sampleCount,
    created: new Date().toISOString(),
    format: 'ground-truth',
    hasHumanAnnotations: true
  };
}

/**
 * Download and integrate human-annotated datasets
 */
async function downloadHumanAnnotatedDatasets() {
  console.log('📥 Downloading Human-Annotated Datasets\n');
  
  const integratedDataset = {
    name: 'Integrated Human-Annotated Ground Truth Dataset',
    created: new Date().toISOString(),
    description: 'Combined dataset from multiple human-annotated sources',
    version: '1.0.0',
    datasets: [],
    samples: []
  };
  
  for (const dataset of HUMAN_ANNOTATED_DATASETS) {
    console.log(`\n📊 Processing: ${dataset.name}`);
    console.log(`   Source: ${dataset.source}`);
    console.log(`   Type: ${dataset.type}`);
    
    try {
      // For now, create placeholder structure
      // In practice, we'd download actual datasets from their sources
      const datasetDir = join(DATASETS_DIR, dataset.type);
      if (!existsSync(datasetDir)) {
        mkdirSync(datasetDir, { recursive: true });
      }
      
      // Create metadata file
      const metadataPath = join(datasetDir, 'metadata.json');
      const metadata = createDatasetMetadata(dataset, 0);
      writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
      
      // Create instructions file for manual download
      const instructionsPath = join(datasetDir, 'DOWNLOAD_INSTRUCTIONS.md');
      const instructions = `# Download Instructions: ${dataset.name}

## Source
${dataset.source}

## Description
${dataset.description}

## Annotations Included
${dataset.annotations.map(a => `- ${a}`).join('\n')}

## How to Download
1. Visit the source URL: ${dataset.source}
2. Follow their download instructions
3. Place downloaded files in this directory
4. Run the conversion script to integrate with our format

## Expected Format
The dataset should include:
- Screenshots or images
- Human annotations (scores, issues, reasoning)
- Metadata (URLs, categories, etc.)

## Conversion
After downloading, run:
\`\`\`bash
node evaluation/utils/convert-dataset.mjs --dataset ${dataset.type}
\`\`\`
`;
      writeFileSync(instructionsPath, instructions);
      
      console.log(`   ✅ Created structure for ${dataset.name}`);
      console.log(`   📝 See ${instructionsPath} for download instructions`);
      
      integratedDataset.datasets.push({
        name: dataset.name,
        type: dataset.type,
        source: dataset.source,
        status: 'pending-download',
        instructionsPath
      });
    } catch (error) {
      console.error(`   ❌ Failed: ${error.message}`);
    }
  }
  
  // Save integrated dataset metadata
  const integratedPath = join(DATASETS_DIR, 'integrated-dataset.json');
  writeFileSync(integratedPath, JSON.stringify(integratedDataset, null, 2));
  
  console.log(`\n✅ Dataset structure created!`);
  console.log(`   Datasets: ${integratedDataset.datasets.length}`);
  console.log(`   Saved: ${integratedPath}`);
  console.log(`\n📝 Next steps:`);
  console.log(`   1. Download datasets from their sources`);
  console.log(`   2. Place files in evaluation/datasets/human-annotated/{dataset-type}/`);
  console.log(`   3. Run conversion scripts to integrate`);
  
  return integratedDataset;
}

/**
 * Convert external dataset to our format
 */
async function convertExternalDataset(datasetType, sourceDataPath) {
  const dataset = HUMAN_ANNOTATED_DATASETS.find(d => d.type === datasetType);
  if (!dataset) {
    throw new Error(`Unknown dataset type: ${datasetType}`);
  }
  
  console.log(`🔄 Converting ${dataset.name}...`);
  
  // Load source data
  const sourceData = JSON.parse(readFileSync(sourceDataPath, 'utf-8'));
  
  // Convert to our format
  const samples = convertToOurFormat(dataset, sourceData);
  
  // Save converted dataset
  const outputPath = join(DATASETS_DIR, datasetType, 'converted-dataset.json');
  writeFileSync(outputPath, JSON.stringify({
    name: dataset.name,
    converted: new Date().toISOString(),
    samples
  }, null, 2));
  
  console.log(`✅ Converted ${samples.length} samples`);
  console.log(`   Saved: ${outputPath}`);
  
  return samples;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  downloadHumanAnnotatedDatasets().catch(error => {
    console.error('❌ Dataset download failed:', error);
    process.exit(1);
  });
}

export { downloadHumanAnnotatedDatasets, convertExternalDataset, HUMAN_ANNOTATED_DATASETS };

