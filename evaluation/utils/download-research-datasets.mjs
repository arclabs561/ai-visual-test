#!/usr/bin/env node
/**
 * Download Research Datasets
 * 
 * Downloads datasets identified from arXiv research:
 * - ScreenAI datasets (Screen Annotation, ScreenQA Short, Complex ScreenQA)
 * - MultiUI dataset (7.3M samples)
 * - A11YN dataset (UIReq-6.8K, RealUIReq-300)
 * 
 * Based on findings from ARXIV_DATASET_FINDINGS.md
 */

import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';

const DATASETS_DIR = join(process.cwd(), 'evaluation', 'datasets', 'research');
const METADATA_FILE = join(DATASETS_DIR, 'download-metadata.json');

// Ensure datasets directory exists
if (!existsSync(DATASETS_DIR)) {
  mkdirSync(DATASETS_DIR, { recursive: true });
}

/**
 * Dataset information from research papers
 */
const DATASETS = {
  screenai: {
    name: 'ScreenAI Datasets',
    paper: 'ScreenAI: A Vision-Language Model for UI and Infographics Understanding',
    paperId: '2402.04615',
    datasets: [
      {
        name: 'Screen Annotation',
        description: '4.2K screenshots from Rico dataset with UI element annotations',
        url: 'https://github.com/google-research-datasets/screen_annotation',
        type: 'object-detection',
        size: '4.2K screenshots',
        format: 'JSON with bounding boxes and UI classes'
      },
      {
        name: 'ScreenQA Short',
        description: 'Short answer QA pairs from ScreenQA dataset',
        url: 'https://github.com/google-research-datasets/screen_qa?tab=readme-ov-file#screenqa-short',
        type: 'question-answering',
        size: '86K QA pairs',
        format: 'JSON with questions and short answers'
      },
      {
        name: 'Complex ScreenQA',
        description: 'Complex questions (counting, arithmetic, comparison)',
        url: 'https://github.com/google-research-datasets/screen_qa?tab=readme-ov-file#complexqa',
        type: 'question-answering',
        size: 'Complex QA pairs',
        format: 'JSON with complex questions and answers'
      }
    ]
  },
  multiui: {
    name: 'MultiUI Dataset',
    paper: 'Harnessing Webpage UIs for Text-Rich Visual Understanding',
    paperId: '2410.13824',
    datasets: [
      {
        name: 'MultiUI',
        description: '7.3M multimodal instructions from 1M websites',
        url: 'https://neulab.github.io/MultiUI/',
        type: 'multimodal-instructions',
        size: '7.3M samples',
        format: 'JSON with screenshots and instructions',
        note: 'Large dataset - may need to download subset initially'
      }
    ]
  },
  a11yn: {
    name: 'A11YN Dataset',
    paper: 'A11YN: aligning LLMs for accessible web UI code generation',
    paperId: '2510.13914',
    datasets: [
      {
        name: 'UIReq-6.8K',
        description: '6,800 diverse instructions for web UI generation',
        url: 'Paper mentions dataset but download link may be in paper/supplement',
        type: 'ui-generation',
        size: '6,800 instructions',
        format: 'JSON with instructions and generated UIs'
      },
      {
        name: 'RealUIReq-300',
        description: '300 real-world web UI requests from public web pages',
        url: 'Paper mentions dataset but download link may be in paper/supplement',
        type: 'ui-generation',
        size: '300 requests',
        format: 'JSON with real-world UI requests'
      }
    ]
  }
};

/**
 * Download instructions generator
 */
function generateDownloadInstructions() {
  const instructions = {
    timestamp: new Date().toISOString(),
    datasets: DATASETS,
    downloadSteps: []
  };

  // ScreenAI datasets
  instructions.downloadSteps.push({
    name: 'ScreenAI Datasets',
    steps: [
      '1. Clone the ScreenAI repository:',
      '   git clone https://github.com/google-research-datasets/screen_annotation.git',
      '   git clone https://github.com/google-research-datasets/screen_qa.git',
      '',
      '2. Follow instructions in each repository README',
      '',
      '3. Download datasets to:',
      `   ${join(DATASETS_DIR, 'screenai')}`
    ]
  });

  // MultiUI dataset
  instructions.downloadSteps.push({
    name: 'MultiUI Dataset',
    steps: [
      '1. Visit: https://neulab.github.io/MultiUI/',
      '2. Check for download links or HuggingFace dataset',
      '3. Download dataset (may be large - 7.3M samples)',
      '4. Extract to:',
      `   ${join(DATASETS_DIR, 'multiui')}`,
      '',
      'Note: Consider downloading a subset initially for testing'
    ]
  });

  // A11YN dataset
  instructions.downloadSteps.push({
    name: 'A11YN Dataset',
    steps: [
      '1. Check paper supplement: https://arxiv.org/abs/2510.13914',
      '2. Look for dataset download link in paper or GitHub',
      '3. Download UIReq-6.8K and RealUIReq-300 datasets',
      '4. Extract to:',
      `   ${join(DATASETS_DIR, 'a11yn')}`,
      '',
      'Note: Dataset may be available on HuggingFace or paper website'
    ]
  });

  return instructions;
}

/**
 * Create download script
 */
function createDownloadScript() {
  const script = `#!/bin/bash
# Download Research Datasets
# Generated: ${new Date().toISOString()}

set -e

DATASETS_DIR="${DATASETS_DIR}"

echo "📥 Downloading Research Datasets"
echo "=================================="
echo ""

# Create directories
mkdir -p "$DATASETS_DIR/screenai"
mkdir -p "$DATASETS_DIR/multiui"
mkdir -p "$DATASETS_DIR/a11yn"

# ScreenAI - Screen Annotation
echo "📊 Downloading ScreenAI Screen Annotation dataset..."
if [ ! -d "$DATASETS_DIR/screenai/screen_annotation" ]; then
  git clone https://github.com/google-research-datasets/screen_annotation.git "$DATASETS_DIR/screenai/screen_annotation" || echo "⚠️  Git clone failed - check URL"
else
  echo "✅ Screen Annotation already exists"
fi

# ScreenAI - ScreenQA
echo "📊 Downloading ScreenAI ScreenQA dataset..."
if [ ! -d "$DATASETS_DIR/screenai/screen_qa" ]; then
  git clone https://github.com/google-research-datasets/screen_qa.git "$DATASETS_DIR/screenai/screen_qa" || echo "⚠️  Git clone failed - check URL"
else
  echo "✅ ScreenQA already exists"
fi

# MultiUI - Check for HuggingFace or direct download
echo "📊 MultiUI dataset (7.3M samples) - Manual download required"
echo "   Visit: https://neulab.github.io/MultiUI/"
echo "   Check for HuggingFace dataset or download link"

# A11YN - Check paper for download link
echo "📊 A11YN dataset - Check paper for download link"
echo "   Paper: https://arxiv.org/abs/2510.13914"
echo "   Look for dataset in paper supplement or GitHub"

echo ""
echo "✅ Download script completed"
echo "📁 Datasets will be in: $DATASETS_DIR"
`;

  const scriptPath = join(DATASETS_DIR, 'download-datasets.sh');
  writeFileSync(scriptPath, script, { mode: 0o755 });
  return scriptPath;
}

/**
 * Main function
 */
async function main() {
  console.log('📥 Research Dataset Download Instructions');
  console.log('='.repeat(70));
  console.log();

  // Generate instructions
  const instructions = generateDownloadInstructions();
  
  // Save metadata
  writeFileSync(METADATA_FILE, JSON.stringify(instructions, null, 2));
  console.log(`✅ Metadata saved: ${METADATA_FILE}`);
  
  // Create download script
  const scriptPath = createDownloadScript();
  console.log(`✅ Download script created: ${scriptPath}`);
  console.log();
  
  // Print instructions
  console.log('📋 Download Instructions:');
  console.log('='.repeat(70));
  console.log();
  
  instructions.downloadSteps.forEach((step, index) => {
    console.log(`${index + 1}. ${step.name}`);
    console.log('-'.repeat(70));
    step.steps.forEach(line => console.log(line));
    console.log();
  });
  
  console.log('='.repeat(70));
  console.log();
  console.log('💡 Next Steps:');
  console.log('1. Run the download script:');
  console.log(`   bash ${scriptPath}`);
  console.log();
  console.log('2. Or manually download datasets following instructions above');
  console.log();
  console.log('3. After downloading, run dataset integration:');
  console.log('   node evaluation/utils/integrate-research-datasets.mjs');
  console.log();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { DATASETS, generateDownloadInstructions };

