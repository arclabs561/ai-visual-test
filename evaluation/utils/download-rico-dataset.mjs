#!/usr/bin/env node
/**
 * Download Rico Dataset
 * 
 * Rico dataset is required for ScreenAI screenshots.
 * This script downloads the essential parts:
 * 1. UI Screenshots and View Hierarchies (6 GB) - REQUIRED
 * 2. UI Metadata (2 MB) - Useful for mapping
 * 
 * Full dataset includes:
 * - UI Screenshots and View Hierarchies (6 GB)
 * - UI Metadata (2 MB)
 * - UI Layout Vectors (8 MB)
 * - Interaction Traces (6 GB)
 * - Animations (214 GB) - Optional
 * - Play Store Metadata (2 MB)
 * - Semantic Annotations (150 MB) - Optional
 */

import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';

const RICO_DIR = join(
  process.cwd(),
  'evaluation',
  'datasets',
  'human-annotated',
  'rico-dataset'
);

const RICO_DOWNLOADS = {
  screenshots: {
    name: 'UI Screenshots and View Hierarchies',
    url: 'https://storage.googleapis.com/crowdstf-rico-uiuc-4540/rico_dataset_v0.1/unique_uis.tar.gz',
    size: '6 GB',
    required: true,
    description: '66k+ unique UI screens with screenshots and view hierarchies'
  },
  metadata: {
    name: 'UI Metadata',
    url: 'https://storage.googleapis.com/crowdstf-rico-uiuc-4540/rico_dataset_v0.1/ui_details.csv',
    size: '2 MB',
    required: true,
    description: 'Metadata about each UI screen'
  },
  layoutVectors: {
    name: 'UI Layout Vectors',
    url: 'https://storage.googleapis.com/crowdstf-rico-uiuc-4540/rico_dataset_v0.1/ui_layout_vectors.zip',
    size: '8 MB',
    required: false,
    description: '64-dimensional layout vectors'
  },
  semanticAnnotations: {
    name: 'Semantic Annotations',
    url: 'https://storage.cloud.google.com/crowdstf-rico-uiuc-4540/rico_dataset_v0.1/semantic_annotations.zip',
    size: '150 MB',
    required: false,
    description: 'UI screens with semantic annotations'
  }
};

/**
 * Download file using curl or wget
 */
async function downloadFile(url, outputPath, description) {
  return new Promise((resolve, reject) => {
    console.log(`📥 Downloading ${description}...`);
    console.log(`   URL: ${url}`);
    console.log(`   Output: ${outputPath}`);
    
    // Try curl first, then wget
    const command = existsSync('/usr/bin/curl') ? 'curl' : 'wget';
    const args = command === 'curl' 
      ? ['-L', '-o', outputPath, url]
      : ['-O', outputPath, url];
    
    const proc = spawn(command, args, {
      stdio: 'inherit',
      shell: false
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ Downloaded: ${outputPath}`);
        resolve(true);
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
 * Generate download instructions
 */
function generateInstructions() {
  const instructions = {
    timestamp: new Date().toISOString(),
    downloads: RICO_DOWNLOADS,
    manualInstructions: [
      '1. Required Downloads (for ScreenAI screenshots):',
      '   - UI Screenshots and View Hierarchies (6 GB)',
      '   - UI Metadata (2 MB)',
      '',
      '2. Download commands:',
      `   cd ${RICO_DIR}`,
      `   curl -L -o unique_uis.tar.gz "${RICO_DOWNLOADS.screenshots.url}"`,
      `   curl -L -o ui_details.csv "${RICO_DOWNLOADS.metadata.url}"`,
      '',
      '3. Extract:',
      '   tar -xzf unique_uis.tar.gz',
      '',
      '4. Optional downloads:',
      '   - UI Layout Vectors (8 MB)',
      '   - Semantic Annotations (150 MB)',
      '   - Interaction Traces (6 GB)',
      '   - Animations (214 GB) - Very large!',
    ]
  };
  
  const instructionsPath = join(RICO_DIR, 'DOWNLOAD_INSTRUCTIONS.md');
  writeFileSync(instructionsPath, `# Rico Dataset Download Instructions

## Overview

Rico dataset contains 66k+ unique UI screens from 9.3k Android apps.
Required for ScreenAI dataset screenshots (ScreenAI references Rico via image_id).

## Required Downloads

### 1. UI Screenshots and View Hierarchies (6 GB) - REQUIRED
\`\`\`bash
cd ${RICO_DIR}
curl -L -o unique_uis.tar.gz "${RICO_DOWNLOADS.screenshots.url}"
tar -xzf unique_uis.tar.gz
\`\`\`

### 2. UI Metadata (2 MB) - REQUIRED
\`\`\`bash
curl -L -o ui_details.csv "${RICO_DOWNLOADS.metadata.url}"
\`\`\`

## Optional Downloads

### 3. UI Layout Vectors (8 MB)
\`\`\`bash
curl -L -o ui_layout_vectors.zip "${RICO_DOWNLOADS.layoutVectors.url}"
unzip ui_layout_vectors.zip
\`\`\`

### 4. Semantic Annotations (150 MB)
\`\`\`bash
curl -L -o semantic_annotations.zip "${RICO_DOWNLOADS.semanticAnnotations.url}"
unzip semantic_annotations.zip
\`\`\`

## Full Dataset

For complete dataset including interaction traces and animations, visit:
https://interactionmining.org/rico

## Integration

After downloading, update ScreenAIAdapter to map image_id to Rico screenshot paths.

## Notes

- Screenshots are in PNG format
- View hierarchies are in JSON format
- Each UI has a unique ID that ScreenAI references
- Total size: ~6 GB for required files, ~230 GB for full dataset
`);
  
  return instructions;
}

/**
 * Main function
 */
async function main() {
  console.log('📥 Rico Dataset Download Setup');
  console.log('='.repeat(70));
  console.log();
  
  // Create directory
  if (!existsSync(RICO_DIR)) {
    mkdirSync(RICO_DIR, { recursive: true });
    console.log(`✅ Created directory: ${RICO_DIR}`);
  }
  
  // Generate instructions
  const instructions = generateInstructions();
  console.log('✅ Generated download instructions');
  console.log();
  
  console.log('📋 Download Instructions:');
  console.log('='.repeat(70));
  instructions.manualInstructions.forEach(line => console.log(line));
  console.log();
  
  console.log('💡 Note:');
  console.log('   - Required files: ~6 GB (screenshots + metadata)');
  console.log('   - Full dataset: ~230 GB (includes animations)');
  console.log('   - Download may take time depending on connection');
  console.log();
  console.log(`   Instructions saved to: ${join(RICO_DIR, 'DOWNLOAD_INSTRUCTIONS.md')}`);
  console.log();
  console.log('🚀 To download now, run:');
  console.log(`   cd ${RICO_DIR}`);
  console.log(`   curl -L -o unique_uis.tar.gz "${RICO_DOWNLOADS.screenshots.url}"`);
  console.log(`   curl -L -o ui_details.csv "${RICO_DOWNLOADS.metadata.url}"`);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { RICO_DOWNLOADS, generateInstructions };



