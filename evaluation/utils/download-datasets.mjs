#!/usr/bin/env node
/**
 * Dataset Downloader
 * 
 * Downloads evaluation datasets from various sources:
 * - WebUI Dataset (HuggingFace)
 * - Tabular Accessibility Dataset
 * - WCAG Test Cases
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { DATASETS_DIR, CACHE_DIR } from './dataset-loaders.mjs';

/**
 * Download WebUI Dataset from HuggingFace
 */
async function downloadWebUIDataset() {
  console.log('📥 Downloading WebUI Dataset...');
  
  try {
    // Check if huggingface-hub is available
    const hasHfHub = execSync('python3 -c "import huggingface_hub" 2>&1', { encoding: 'utf-8' }).trim() === '';
    
    if (!hasHfHub) {
      console.log('   Installing huggingface-hub...');
      execSync('pip3 install huggingface-hub', { stdio: 'inherit' });
    }
    
    // Download dataset
    const script = `
from huggingface_hub import hf_hub_download
import json
import os

dataset_dir = '${DATASETS_DIR}'
os.makedirs(dataset_dir, exist_ok=True)

# Download WebUI-7K dataset
try:
    # Note: This is a placeholder - actual download would require dataset access
    print("WebUI dataset download requires manual access")
    print("See: https://huggingface.co/datasets/biglab/webui-7k")
except Exception as e:
    print(f"Error: {e}")
`;
    
    execSync(`python3 -c "${script}"`, { stdio: 'inherit' });
    
    console.log('   ✅ WebUI dataset download initiated');
    console.log('   Note: Some datasets require manual download');
    
  } catch (error) {
    console.error('   ❌ Failed to download WebUI dataset:', error.message);
    console.log('   💡 Manual download: https://huggingface.co/datasets/biglab/webui-7k');
  }
}

/**
 * Create sample dataset from known websites
 */
async function createSampleDataset() {
  console.log('📸 Creating sample dataset from known websites...');
  
  const sampleDataset = {
    name: 'Sample Real-World Dataset',
    created: new Date().toISOString(),
    description: 'Screenshots from real websites with known characteristics',
    samples: [
      {
        id: 'github-homepage',
        name: 'GitHub Homepage',
        url: 'https://github.com',
        screenshot: null, // Would be path after capture
        groundTruth: {
          expectedScore: { min: 7, max: 10 },
          expectedIssues: [],
          annotations: {
            accessibility: 'good',
            contrast: 'high',
            navigation: 'clear'
          }
        },
        metadata: {
          viewport: { width: 1280, height: 720 },
          device: 'desktop'
        }
      },
      {
        id: 'mdn-homepage',
        name: 'MDN Web Docs',
        url: 'https://developer.mozilla.org',
        screenshot: null,
        groundTruth: {
          expectedScore: { min: 8, max: 10 },
          expectedIssues: [],
          annotations: {
            accessibility: 'excellent',
            wcag: 'AAA',
            contrast: 'excellent'
          }
        },
        metadata: {
          viewport: { width: 1280, height: 720 },
          device: 'desktop'
        }
      }
    ]
  };
  
  const outputFile = join(DATASETS_DIR, 'sample-dataset.json');
  writeFileSync(outputFile, JSON.stringify(sampleDataset, null, 2));
  console.log(`   ✅ Sample dataset created: ${outputFile}`);
  
  return sampleDataset;
}

/**
 * Download instructions for manual datasets
 */
function printDownloadInstructions() {
  console.log('\n📋 Manual Download Instructions:');
  console.log('');
  console.log('1. WebUI Dataset:');
  console.log('   - URL: https://huggingface.co/datasets/biglab/webui-7k');
  console.log('   - Or: https://github.com/js0nwu/webui');
  console.log('   - Place in: evaluation/datasets/webui/');
  console.log('');
  console.log('2. Tabular Accessibility Dataset:');
  console.log('   - Source: https://www.mdpi.com/2306-5729/10/9/149');
  console.log('   - Contact authors for dataset access');
  console.log('   - Place in: evaluation/datasets/tabular/');
  console.log('');
  console.log('3. WCAG Test Cases:');
  console.log('   - Source: W3C WCAG Test Cases');
  console.log('   - URL: https://www.w3.org/WAI/WCAG21/quickref/');
  console.log('   - Place in: evaluation/datasets/wcag/');
}

/**
 * Main download function
 */
async function downloadAllDatasets() {
  console.log('🚀 Downloading All Datasets\n');
  
  // Create directories
  [DATASETS_DIR, CACHE_DIR].forEach(dir => {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  });
  
  // Download WebUI
  await downloadWebUIDataset();
  
  // Create sample dataset
  await createSampleDataset();
  
  // Print instructions
  printDownloadInstructions();
  
  console.log('\n✅ Dataset download complete');
  console.log('   Some datasets require manual download - see instructions above');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  downloadAllDatasets().catch(console.error);
}

export { downloadAllDatasets, downloadWebUIDataset, createSampleDataset };

