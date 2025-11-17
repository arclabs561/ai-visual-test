#!/usr/bin/env node
/**
 * Download MultiUI Dataset from HuggingFace
 * 
 * Downloads MultiUI dataset (7.3M samples) from HuggingFace.
 * Since it's a large dataset, this script can download a subset for testing.
 */

import { spawn } from 'child_process';
import { mkdirSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';

const DATASETS_DIR = join(process.cwd(), 'evaluation', 'datasets', 'research', 'multiui');
const HUGGINGFACE_DATASET = 'neulab/MultiUI';

/**
 * Check if huggingface-cli is available
 */
function checkHuggingFaceCLI() {
  return new Promise((resolve) => {
    const proc = spawn('huggingface-cli', ['--version'], { shell: true });
    proc.on('close', (code) => {
      resolve(code === 0);
    });
    proc.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Download using huggingface-cli
 */
async function downloadWithCLI(subset = null) {
  if (!existsSync(DATASETS_DIR)) {
    mkdirSync(DATASETS_DIR, { recursive: true });
  }

  const args = ['download', HUGGINGFACE_DATASET, '--local-dir', DATASETS_DIR];
  
  if (subset) {
    args.push('--repo-type', 'dataset');
    console.log(`📥 Downloading subset: ${subset}`);
  } else {
    console.log('📥 Downloading full MultiUI dataset (7.3M samples - this may take a while)...');
  }

  return new Promise((resolve, reject) => {
    const proc = spawn('huggingface-cli', args, {
      stdio: 'inherit',
      shell: true
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        resolve({ success: false, code });
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Generate download instructions
 */
function generateInstructions() {
  const instructions = {
    method: 'huggingface-cli',
    dataset: HUGGINGFACE_DATASET,
    url: 'https://huggingface.co/datasets/neulab/MultiUI',
    steps: [
      '1. Install huggingface-cli:',
      '   pip install huggingface_hub',
      '',
      '2. Download full dataset:',
      `   huggingface-cli download ${HUGGINGFACE_DATASET} --local-dir ${DATASETS_DIR}`,
      '',
      '3. Or download specific splits:',
      `   huggingface-cli download ${HUGGINGFACE_DATASET} --local-dir ${DATASETS_DIR} --repo-type dataset`,
      '',
      '4. Alternative: Use Python:',
      '   from datasets import load_dataset',
      `   dataset = load_dataset("${HUGGINGFACE_DATASET}")`,
      `   dataset.save_to_disk("${DATASETS_DIR}")`
    ],
    note: 'Dataset is 7.3M samples - consider downloading a subset initially for testing'
  };

  const instructionsPath = join(DATASETS_DIR, 'DOWNLOAD_INSTRUCTIONS.md');
  if (!existsSync(DATASETS_DIR)) {
    mkdirSync(DATASETS_DIR, { recursive: true });
  }
  writeFileSync(instructionsPath, `# MultiUI Dataset Download Instructions

## HuggingFace Dataset

**Dataset**: ${HUGGINGFACE_DATASET}
**URL**: ${instructions.url}
**Size**: 7.3M samples

## Download Methods

### Method 1: HuggingFace CLI

\`\`\`bash
# Install huggingface-cli
pip install huggingface_hub

# Download full dataset
huggingface-cli download ${HUGGINGFACE_DATASET} --local-dir ${DATASETS_DIR}

# Or download specific splits
huggingface-cli download ${HUGGINGFACE_DATASET} --local-dir ${DATASETS_DIR} --repo-type dataset
\`\`\`

### Method 2: Python

\`\`\`python
from datasets import load_dataset

# Load dataset
dataset = load_dataset("${HUGGINGFACE_DATASET}")

# Save to disk
dataset.save_to_disk("${DATASETS_DIR}")
\`\`\`

### Method 3: Web Interface

Visit: ${instructions.url}
Click "Files and versions" to download specific files.

## Integration

After downloading, run:
\`\`\`bash
node evaluation/utils/integrate-research-datasets.mjs
\`\`\`

## Note

The dataset is large (7.3M samples). Consider downloading a subset initially for testing.
`);

  return instructions;
}

/**
 * Main function
 */
async function main() {
  console.log('📥 MultiUI Dataset Download');
  console.log('='.repeat(70));
  console.log();

  const hasCLI = await checkHuggingFaceCLI();
  
  if (hasCLI) {
    console.log('✅ HuggingFace CLI detected');
    console.log();
    
    const result = await downloadWithCLI();
    if (result.success) {
      console.log('✅ Download completed');
    } else {
      console.log('⚠️  Download failed, see instructions below');
    }
  } else {
    console.log('⚠️  HuggingFace CLI not found');
    console.log();
    console.log('📋 Download Instructions:');
    console.log('-'.repeat(70));
    
    const instructions = generateInstructions();
    instructions.steps.forEach(step => console.log(step));
    
    console.log();
    console.log(`✅ Instructions saved: ${join(DATASETS_DIR, 'DOWNLOAD_INSTRUCTIONS.md')}`);
    console.log();
    console.log('💡 Quick start:');
    console.log('   pip install huggingface_hub');
    console.log(`   huggingface-cli download ${HUGGINGFACE_DATASET} --local-dir ${DATASETS_DIR}`);
  }

  console.log();
  console.log('='.repeat(70));
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { downloadWithCLI, generateInstructions };

