#!/usr/bin/env node
/**
 * Download WebUI Dataset
 * 
 * Downloads the WebUI-7K dataset from HuggingFace to the correct location.
 * Falls back to manual instructions if download fails.
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const DATASET_DIR = join(process.cwd(), 'evaluation', 'datasets', 'human-annotated', 'visual-ui-understanding', 'webui-dataset', 'webui-7k');

async function downloadDataset() {
  console.log('📥 Downloading WebUI-7K Dataset...\n');
  
  // Create directory
  mkdirSync(DATASET_DIR, { recursive: true });
  
  // Check if already downloaded
  if (existsSync(DATASET_DIR) && existsSync(join(DATASET_DIR, '.git'))) {
    console.log('✅ Dataset already downloaded (git repository detected)');
    return { success: true, skipped: true };
  }
  
  // Try using Python with huggingface_hub
  try {
    console.log('Attempting download via Python huggingface_hub...');
    const pythonScript = `
from huggingface_hub import snapshot_download
import sys
try:
    snapshot_download(
        repo_id='biglab/webui-7k',
        repo_type='dataset',
        local_dir='${DATASET_DIR}',
        local_dir_use_symlinks=False
    )
    print("✅ Download successful")
except Exception as e:
    print(f"❌ Download failed: {e}")
    sys.exit(1)
`;
    
    // Try with system python3 first
    try {
      execSync(`python3 -c "${pythonScript}"`, { stdio: 'inherit' });
      console.log('\n✅ Dataset downloaded successfully!');
      return { success: true };
    } catch (e) {
      // Try with venv python
      if (existsSync('.venv/bin/python')) {
        console.log('Trying with virtual environment...');
        execSync(`.venv/bin/python -c "${pythonScript}"`, { stdio: 'inherit' });
        console.log('\n✅ Dataset downloaded successfully!');
        return { success: true };
      }
      throw e;
    }
  } catch (error) {
    console.log('\n⚠️  Automated download failed');
    console.log('\n📋 Manual Download Instructions:');
    console.log('  1. Install: pip install huggingface_hub');
    console.log('  2. Run:');
    console.log(`     python3 -c "from huggingface_hub import snapshot_download; snapshot_download(repo_id='biglab/webui-7k', repo_type='dataset', local_dir='${DATASET_DIR}')"`);
    console.log('  3. OR download from Google Drive:');
    console.log('     https://drive.google.com/drive/folders/1hcO75W2FjsZoibsj2TIbKz67hy9JkOBz');
    console.log(`  4. Extract to: ${DATASET_DIR}`);
    return { success: false, error: error.message, manual: true };
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  downloadDataset().catch(console.error);
}

export { downloadDataset };

