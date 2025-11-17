#!/usr/bin/env node
/**
 * Integrate MultiUI Dataset
 * 
 * Converts MultiUI dataset from HuggingFace format to our standard format.
 * MultiUI has 7.3M samples across 9 task types.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const MULTIUI_DIR = join(process.cwd(), 'evaluation', 'datasets', 'research', 'multiui');
const INTEGRATED_DIR = join(process.cwd(), 'evaluation', 'datasets', 'integrated');

/**
 * Check if MultiUI dataset is downloaded
 */
function checkMultiUIDataset() {
  if (!existsSync(MULTIUI_DIR)) {
    return { downloaded: false, message: 'MultiUI dataset not found. Run download script first.' };
  }

  // Check for HuggingFace dataset structure
  const files = readdirSync(MULTIUI_DIR);
  const hasData = files.some(f => 
    f.includes('.parquet') || 
    f.includes('.json') || 
    f.includes('train') || 
    f.includes('validation') ||
    f.includes('test')
  );

  return {
    downloaded: hasData,
    files: files.slice(0, 10),
    message: hasData ? 'MultiUI dataset found' : 'MultiUI directory exists but no data files found'
  };
}

/**
 * Convert MultiUI dataset to our format
 * 
 * MultiUI format: HuggingFace dataset with 9 task types:
 * - Web Caption
 * - Img Caption
 * - Web QA
 * - Img QA
 * - Act. Pred. (Action Prediction)
 * - Action (Action Grounding)
 * - Elem. (Element Grounding)
 * - Head (Heading OCR)
 * - Elem. (Element OCR)
 */
async function convertMultiUIDataset(options = {}) {
  const { limit = 1000, taskTypes = null } = options;
  
  const status = checkMultiUIDataset();
  if (!status.downloaded) {
    console.error(`❌ ${status.message}`);
    return null;
  }

  console.log('🔄 Converting MultiUI Dataset');
  console.log('-'.repeat(70));

  // Try to load using Python datasets library if available
  // Otherwise, try to read parquet/json files directly
  const converted = {
    name: 'MultiUI Dataset',
    source: 'MultiUI (2410.13824)',
    samples: [],
    taskTypes: []
  };

  // Check if we can use Python to load the dataset
  const pythonScript = `
import json
import sys
from datasets import load_dataset

try:
    dataset = load_dataset("neulab/MultiUI", streaming=False)
    samples = []
    
    # Process each split
    for split_name, split_data in dataset.items():
        for i, item in enumerate(split_data):
            if i >= ${limit}:
                break
            samples.append({
                "id": f"multiui-{split_name}-{i}",
                "image": item.get("image", None),
                "instruction": item.get("instruction", ""),
                "output": item.get("output", ""),
                "task_type": item.get("task_type", "unknown"),
                "split": split_name,
                "metadata": {
                    "source": "MultiUI",
                    "paper": "2410.13824"
                }
            })
    
    print(json.dumps({"samples": samples[:${limit}]}, indent=2))
except Exception as e:
    print(json.dumps({"error": str(e)}), file=sys.stderr)
    sys.exit(1)
`;

  const pythonPath = join(MULTIUI_DIR, 'convert.py');
  writeFileSync(pythonPath, pythonScript);

  console.log('💡 To convert MultiUI dataset:');
  console.log('   1. Install: pip install datasets pillow');
  console.log('   2. Run: python evaluation/datasets/research/multiui/convert.py');
  console.log('   3. Or use HuggingFace datasets library directly');
  console.log();

  // Create integration guide
  const guide = `# MultiUI Dataset Integration Guide

## Dataset Information
- **Source**: HuggingFace - neulab/MultiUI
- **Size**: 7.3M samples
- **Paper**: 2410.13824
- **Tasks**: 9 task types (Web Caption, Img Caption, Web QA, Img QA, Action Prediction, Action Grounding, Element Grounding, Heading OCR, Element OCR)

## Integration Steps

### Method 1: Using Python datasets library

\`\`\`python
from datasets import load_dataset
import json

# Load dataset
dataset = load_dataset("neulab/MultiUI")

# Convert to our format
samples = []
for split_name, split_data in dataset.items():
    for i, item in enumerate(split_data):
        if i >= 1000:  # Limit for initial integration
            break
        samples.append({
            "id": f"multiui-{split_name}-{i}",
            "image": item.get("image", None),
            "instruction": item.get("instruction", ""),
            "output": item.get("output", ""),
            "task_type": item.get("task_type", "unknown"),
            "split": split_name,
            "metadata": {
                "source": "MultiUI",
                "paper": "2410.13824"
            }
        })

# Save
with open("evaluation/datasets/integrated/multiui.json", "w") as f:
    json.dump({"name": "MultiUI Dataset", "samples": samples}, f, indent=2)
\`\`\`

### Method 2: Using HuggingFace CLI

\`\`\`bash
# Download specific splits
huggingface-cli download neulab/MultiUI --local-dir evaluation/datasets/research/multiui

# Then process the files
\`\`\`

## Task Types

1. **Web Caption** - Webpage captioning
2. **Img Caption** - Image captioning
3. **Web QA** - Webpage question answering
4. **Img QA** - Image question answering
5. **Action Prediction** - Predict next action
6. **Action Grounding** - Ground actions to UI elements
7. **Element Grounding** - Ground elements
8. **Heading OCR** - Extract headings
9. **Element OCR** - Extract element text

## Usage in Evaluations

After integration, use with:
\`\`\`javascript
import { validateScreenshot } from 'ai-visual-test';

const result = await validateScreenshot(
  sample.image,
  sample.instruction,
  { sessionId, testType: 'multiui-' + sample.task_type }
);
\`\`\`
`;

  const guidePath = join(MULTIUI_DIR, 'INTEGRATION_GUIDE.md');
  writeFileSync(guidePath, guide);

  console.log(`✅ Integration guide created: ${guidePath}`);
  console.log();

  return { guidePath, status };
}

/**
 * Main function
 */
async function main() {
  const status = checkMultiUIDataset();
  console.log('📊 MultiUI Dataset Status');
  console.log('='.repeat(70));
  console.log(`Status: ${status.downloaded ? '✅ Downloaded' : '❌ Not Downloaded'}`);
  console.log(`Message: ${status.message}`);
  console.log();

  if (status.downloaded) {
    await convertMultiUIDataset({ limit: 1000 });
  } else {
    console.log('💡 Download instructions:');
    console.log('   node evaluation/utils/download-multiui-from-huggingface.mjs');
    console.log();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { checkMultiUIDataset, convertMultiUIDataset };

