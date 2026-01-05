#!/usr/bin/env node
/**
 * Download and Integrate Research Datasets
 * 
 * Downloads accessible datasets and integrates them into the evaluation system:
 * - MultiUI (HuggingFace: neulab/MultiUI)
 * - GUIOdyssey (HuggingFace: hflqf88888/GUIOdyssey)
 * 
 * Creates adapters for each dataset automatically.
 */

import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';
import { promisify } from 'util';

// Load environment variables from .env file
try {
  const { config } = await import('dotenv');
  config();
} catch (e) {
  // dotenv not available, continue without it
}

const DATASETS_DIR = join(process.cwd(), 'evaluation', 'datasets', 'research');

// Ensure datasets directory exists
if (!existsSync(DATASETS_DIR)) {
  mkdirSync(DATASETS_DIR, { recursive: true });
}

/**
 * Check if Python and huggingface_hub are available
 */
async function checkDependencies() {
  return new Promise((resolve) => {
    const proc = spawn('python3', ['-c', 'import huggingface_hub; print("ok")'], {
      stdio: 'pipe'
    });
    
    let output = '';
    proc.stdout.on('data', (data) => { output += data.toString(); });
    proc.stderr.on('data', (data) => { output += data.toString(); });
    
    proc.on('close', (code) => {
      if (code === 0 && output.includes('ok')) {
        resolve({ available: true });
      } else {
        resolve({ 
          available: false, 
          message: 'huggingface_hub not installed. Install with: pip install huggingface_hub' 
        });
      }
    });
    
    proc.on('error', () => {
      resolve({ available: false, message: 'Python3 not found' });
    });
  });
}

/**
 * Install huggingface_hub if needed
 */
async function installHuggingFaceHub() {
  console.log('📦 Installing huggingface_hub...');
  return new Promise((resolve, reject) => {
    // Try --user flag first (safer for externally managed environments)
    const proc = spawn('pip3', ['install', '--user', 'huggingface_hub'], {
      stdio: 'inherit'
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        console.log('✅ huggingface_hub installed');
        resolve(true);
      } else {
        // Try with --break-system-packages as fallback
        console.log('⚠️  --user install failed, trying --break-system-packages...');
        const proc2 = spawn('pip3', ['install', '--break-system-packages', 'huggingface_hub'], {
          stdio: 'inherit'
        });
        
        proc2.on('close', (code2) => {
          if (code2 === 0) {
            console.log('✅ huggingface_hub installed');
            resolve(true);
          } else {
            reject(new Error(`pip install failed. Please install manually: pip3 install --user huggingface_hub`));
          }
        });
        
        proc2.on('error', (err) => {
          reject(err);
        });
      }
    });
    
    proc.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Download dataset from HuggingFace using Python
 */
async function downloadFromHuggingFace(datasetId, localDir, subset = null) {
  // Get HF_TOKEN from environment
  const hfToken = process.env.HF_TOKEN || process.env.HUGGINGFACE_TOKEN;
  
  const pythonScript = `
import os
import sys
from huggingface_hub import snapshot_download

try:
    repo_id = "${datasetId}"
    local_dir = "${localDir}"
    hf_token = "${hfToken || ''}"
    
    # Create directory if it doesn't exist
    os.makedirs(local_dir, exist_ok=True)
    
    print(f"📥 Downloading {repo_id} to {local_dir}...")
    ${hfToken ? 'print("✅ Using HuggingFace token for authentication")' : 'print("⚠️  No HF_TOKEN found - may hit rate limits")'}
    
    # Download dataset
    snapshot_download(
        repo_id=repo_id,
        repo_type="dataset",
        local_dir=local_dir,
        local_dir_use_symlinks=False,
        token=hf_token if hf_token else None
    )
    
    print(f"✅ Successfully downloaded {repo_id}")
    sys.exit(0)
except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)
`;

  return new Promise((resolve, reject) => {
    const proc = spawn('python3', ['-c', pythonScript], {
      stdio: 'inherit',
      shell: false
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        reject(new Error(`Download failed with code ${code}`));
      }
    });
    
    proc.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Create adapter for MultiUI dataset
 */
function createMultiUIAdapter() {
  const adapterPath = join(process.cwd(), 'evaluation', 'utils', 'dataset-adapters.mjs');
  
  // Read existing adapters file
  let adapterContent = readFileSync(adapterPath, 'utf-8');
  
  // Check if MultiUIAdapter already exists
  if (adapterContent.includes('class MultiUIAdapter')) {
    console.log('✅ MultiUIAdapter already exists');
    return;
  }
  
  const multiUIAdapter = `
/**
 * MultiUI Dataset Adapter
 * 
 * Source: HuggingFace - neulab/MultiUI
 * Paper: arXiv:2410.13824
 * Size: 7.3M samples from 1M websites
 * 
 * Format: JSON with screenshots and multimodal instructions
 */
export class MultiUIAdapter {
  constructor(basePath) {
    this.basePath = basePath || join(
      process.cwd(),
      'evaluation',
      'datasets',
      'research',
      'multiui'
    );
  }

  isAvailable() {
    return existsSync(this.basePath) && 
           (existsSync(join(this.basePath, 'dataset_info.json')) ||
            existsSync(join(this.basePath, 'train')) ||
            existsSync(join(this.basePath, 'data')));
  }

  async loadSample(sampleId) {
    // MultiUI format: Need to check actual structure after download
    // This is a placeholder - will be updated after dataset is downloaded
    throw new Error('MultiUIAdapter not yet implemented - dataset structure needs inspection');
  }

  async loadSamples(options = {}) {
    const { limit = null, offset = 0 } = options;
    
    if (!this.isAvailable()) {
      return { samples: [], loaded: 0, totalAvailable: 0 };
    }
    
    // TODO: Implement after downloading and inspecting dataset structure
    return { samples: [], loaded: 0, totalAvailable: 0 };
  }

  getTotalCount() {
    // TODO: Implement after downloading
    return 0;
  }
}
`;

  // Find where to insert (after WCAGAdapter, before exports)
  const insertPoint = adapterContent.indexOf('export async function loadDataset');
  if (insertPoint === -1) {
    console.log('⚠️  Could not find insertion point for MultiUIAdapter');
    return;
  }
  
  // Insert before loadDataset function
  adapterContent = adapterContent.slice(0, insertPoint) + 
                   multiUIAdapter + '\n' + 
                   adapterContent.slice(insertPoint);
  
  // Also add to DATASET_ADAPTERS object
  if (adapterContent.includes('const DATASET_ADAPTERS = {')) {
    adapterContent = adapterContent.replace(
      /(const DATASET_ADAPTERS = \{[\s\S]*?)(\};)/,
      (match, before, after) => {
        // Add multiui entry
        const entry = `  'multiui': MultiUIAdapter,\n  'multiui-dataset': MultiUIAdapter,\n`;
        return before + entry + after;
      }
    );
  }
  
  writeFileSync(adapterPath, adapterContent);
  console.log('✅ Created MultiUIAdapter');
}

/**
 * Create adapter for AutomotiveUI-Bench-4K dataset
 */
function createAutomotiveUIAdapter() {
  const adapterPath = join(process.cwd(), 'evaluation', 'utils', 'dataset-adapters.mjs');
  
  let adapterContent = readFileSync(adapterPath, 'utf-8');
  
  if (adapterContent.includes('class AutomotiveUIAdapter')) {
    console.log('✅ AutomotiveUIAdapter already exists');
    return;
  }
  
  const automotiveUIAdapter = `
/**
 * AutomotiveUI-Bench-4K Dataset Adapter
 * 
 * Source: HuggingFace - alexanderrich/AutomotiveUI-Bench-4K
 * Paper: arXiv:2505.05895
 * Size: 998 images, 4,208 annotations
 * 
 * Format: Automotive UI understanding with visual grounding
 */
export class AutomotiveUIAdapter {
  constructor(basePath) {
    this.basePath = basePath || join(
      process.cwd(),
      'evaluation',
      'datasets',
      'research',
      'automotiveui-bench-4k'
    );
  }

  isAvailable() {
    return existsSync(this.basePath) && 
           (existsSync(join(this.basePath, 'dataset_info.json')) ||
            existsSync(join(this.basePath, 'train')) ||
            existsSync(join(this.basePath, 'data')));
  }

  async loadSample(sampleId) {
    // AutomotiveUI format: Need to check actual structure after download
    throw new Error('AutomotiveUIAdapter not yet implemented - dataset structure needs inspection');
  }

  async loadSamples(options = {}) {
    const { limit = null, offset = 0 } = options;
    
    if (!this.isAvailable()) {
      return { samples: [], loaded: 0, totalAvailable: 0 };
    }
    
    // TODO: Implement after downloading and inspecting dataset structure
    return { samples: [], loaded: 0, totalAvailable: 0 };
  }

  getTotalCount() {
    // TODO: Implement after downloading
    return 0;
  }
}
`;

  const insertPoint = adapterContent.indexOf('export async function loadDataset');
  if (insertPoint === -1) {
    console.log('⚠️  Could not find insertion point for AutomotiveUIAdapter');
    return;
  }
  
  adapterContent = adapterContent.slice(0, insertPoint) + 
                   automotiveUIAdapter + '\n' + 
                   adapterContent.slice(insertPoint);
  
  if (adapterContent.includes('const DATASET_ADAPTERS = {')) {
    adapterContent = adapterContent.replace(
      /(const DATASET_ADAPTERS = \{[\s\S]*?)(\};)/,
      (match, before, after) => {
        const entry = `  'automotiveui': AutomotiveUIAdapter,\n  'automotiveui-bench-4k': AutomotiveUIAdapter,\n`;
        return before + entry + after;
      }
    );
  }
  
  writeFileSync(adapterPath, adapterContent);
  console.log('✅ Created AutomotiveUIAdapter');
}

/**
 * Create adapter for GUIOdyssey dataset
 */
function createGUIOdysseyAdapter() {
  const adapterPath = join(process.cwd(), 'evaluation', 'utils', 'dataset-adapters.mjs');
  
  let adapterContent = readFileSync(adapterPath, 'utf-8');
  
  if (adapterContent.includes('class GUIOdysseyAdapter')) {
    console.log('✅ GUIOdysseyAdapter already exists');
    return;
  }
  
  const guiOdysseyAdapter = `
/**
 * GUIOdyssey Dataset Adapter
 * 
 * Source: HuggingFace - hflqf88888/GUIOdyssey
 * Paper: arXiv:2406.08451
 * Size: 8,334 episodes, 15.3 steps/episode average
 * 
 * Format: Cross-app navigation with temporal sequences
 */
export class GUIOdysseyAdapter {
  constructor(basePath) {
    this.basePath = basePath || join(
      process.cwd(),
      'evaluation',
      'datasets',
      'research',
      'guiodyssey'
    );
  }

  isAvailable() {
    return existsSync(this.basePath) && 
           (existsSync(join(this.basePath, 'dataset_info.json')) ||
            existsSync(join(this.basePath, 'train')) ||
            existsSync(join(this.basePath, 'data')));
  }

  async loadSample(sampleId) {
    // GUIOdyssey format: Need to check actual structure after download
    // This is a placeholder - will be updated after dataset is downloaded
    throw new Error('GUIOdysseyAdapter not yet implemented - dataset structure needs inspection');
  }

  async loadSamples(options = {}) {
    const { limit = null, offset = 0 } = options;
    
    if (!this.isAvailable()) {
      return { samples: [], loaded: 0, totalAvailable: 0 };
    }
    
    // TODO: Implement after downloading and inspecting dataset structure
    return { samples: [], loaded: 0, totalAvailable: 0 };
  }

  getTotalCount() {
    // TODO: Implement after downloading
    return 0;
  }
}
`;

  const insertPoint = adapterContent.indexOf('export async function loadDataset');
  if (insertPoint === -1) {
    console.log('⚠️  Could not find insertion point for GUIOdysseyAdapter');
    return;
  }
  
  adapterContent = adapterContent.slice(0, insertPoint) + 
                   guiOdysseyAdapter + '\n' + 
                   adapterContent.slice(insertPoint);
  
  if (adapterContent.includes('const DATASET_ADAPTERS = {')) {
    adapterContent = adapterContent.replace(
      /(const DATASET_ADAPTERS = \{[\s\S]*?)(\};)/,
      (match, before, after) => {
        const entry = `  'guiodyssey': GUIOdysseyAdapter,\n  'gui-odyssey': GUIOdysseyAdapter,\n`;
        return before + entry + after;
      }
    );
  }
  
  writeFileSync(adapterPath, adapterContent);
  console.log('✅ Created GUIOdysseyAdapter');
}

/**
 * Main download function
 */
async function downloadDatasets() {
  console.log('📥 Downloading Research Datasets');
  console.log('='.repeat(70));
  console.log();
  
  // Check dependencies
  const deps = await checkDependencies();
  if (!deps.available) {
    console.log(`⚠️  ${deps.message}`);
    console.log('📦 Installing huggingface_hub...');
    try {
      await installHuggingFaceHub();
    } catch (error) {
      console.error('❌ Failed to install huggingface_hub:', error.message);
      console.log('\n💡 Please install manually: pip install huggingface_hub');
      process.exit(1);
    }
  }
  
  const datasets = [
    {
      id: 'neulab/MultiUI',
      name: 'MultiUI',
      localDir: join(DATASETS_DIR, 'multiui'),
      description: '7.3M multimodal instructions from 1M websites',
      requiresAccess: true // Gated repository
    },
    {
      id: 'hflqf88888/GUIOdyssey',
      name: 'GUIOdyssey',
      localDir: join(DATASETS_DIR, 'guiodyssey'),
      description: '8,334 cross-app navigation episodes',
      resume: true // Can resume partial download
    },
    {
      id: 'sparks-solutions/AutomotiveUI-Bench-4K',
      name: 'AutomotiveUI-Bench-4K',
      localDir: join(DATASETS_DIR, 'automotiveui-bench-4k'),
      description: '998 images, 4,208 annotations for automotive UI understanding'
    }
  ];
  
  const results = [];
  
  for (const dataset of datasets) {
    console.log(`\n📊 ${dataset.name}`);
    console.log('-'.repeat(70));
    console.log(`   Description: ${dataset.description}`);
    console.log(`   HuggingFace: ${dataset.id}`);
    console.log(`   Local: ${dataset.localDir}`);
    
    // Check if already downloaded (or partially downloaded for resume)
    const hasData = existsSync(dataset.localDir) && 
        (existsSync(join(dataset.localDir, 'dataset_info.json')) ||
         existsSync(join(dataset.localDir, 'train')) ||
         existsSync(join(dataset.localDir, 'data')) ||
         existsSync(join(dataset.localDir, 'annotations')));
    
    if (hasData && !dataset.resume) {
      console.log('   ✅ Already downloaded');
      results.push({ name: dataset.name, status: 'already_exists' });
      continue;
    }
    
    if (hasData && dataset.resume) {
      console.log('   ⚠️  Partially downloaded - resuming...');
    }
    
    if (dataset.requiresAccess) {
      console.log('   ⚠️  Note: This dataset requires access approval');
      console.log('      Visit: https://huggingface.co/datasets/' + dataset.id);
    }
    
    try {
      console.log('   📥 Downloading... (this may take a while)');
      await downloadFromHuggingFace(dataset.id, dataset.localDir);
      console.log(`   ✅ Successfully downloaded ${dataset.name}`);
      results.push({ name: dataset.name, status: 'success' });
    } catch (error) {
      console.error(`   ❌ Failed to download ${dataset.name}:`, error.message);
      results.push({ name: dataset.name, status: 'failed', error: error.message });
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('\n📋 Download Summary:');
  results.forEach(result => {
    const icon = result.status === 'success' ? '✅' : 
                 result.status === 'already_exists' ? 'ℹ️' : '❌';
    console.log(`   ${icon} ${result.name}: ${result.status}`);
    if (result.error) {
      console.log(`      Error: ${result.error}`);
    }
  });
  
  return results;
}

/**
 * Integrate downloaded datasets
 */
async function integrateDatasets() {
  console.log('\n🔧 Creating Dataset Adapters');
  console.log('='.repeat(70));
  
  try {
    createMultiUIAdapter();
  } catch (error) {
    console.error('⚠️  Failed to create MultiUIAdapter:', error.message);
  }
  
  try {
    createGUIOdysseyAdapter();
  } catch (error) {
    console.error('⚠️  Failed to create GUIOdysseyAdapter:', error.message);
  }
  
  try {
    createAutomotiveUIAdapter();
  } catch (error) {
    console.error('⚠️  Failed to create AutomotiveUIAdapter:', error.message);
  }
  
  console.log('\n✅ Adapter creation complete');
  console.log('\n💡 Next Steps:');
  console.log('   1. Inspect downloaded datasets to understand their structure');
  console.log('   2. Update adapters with actual data loading logic');
  console.log('   3. Test adapters with: listAvailableDatasets()');
}

/**
 * Main function
 */
async function main() {
  try {
    const results = await downloadDatasets();
    await integrateDatasets();
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ Download and integration complete!');
    console.log('\n📝 Note: Adapters are placeholders and need implementation');
    console.log('   after inspecting the actual dataset structures.');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { downloadDatasets, integrateDatasets, checkDependencies };

