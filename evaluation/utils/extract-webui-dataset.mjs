#!/usr/bin/env node
/**
 * WebUI Dataset Extraction Helper
 * 
 * Extracts WebUI dataset from split zip files.
 * WebUI dataset comes as train_split_web7k.zip.001 and train_split_web7k.zip.002
 */

import { existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const WEBUI_BASE = join(
  process.cwd(),
  'evaluation',
  'datasets',
  'human-annotated',
  'visual-ui-understanding',
  'webui-dataset',
  'webui-7k'
);

/**
 * Check if extraction is needed
 */
function needsExtraction() {
  if (!existsSync(WEBUI_BASE)) {
    return { needed: false, reason: 'Dataset directory does not exist' };
  }
  
  const zip1 = join(WEBUI_BASE, 'train_split_web7k.zip.001');
  const zip2 = join(WEBUI_BASE, 'train_split_web7k.zip.002');
  
  const hasZip1 = existsSync(zip1);
  const hasZip2 = existsSync(zip2);
  
  if (!hasZip1 && !hasZip2) {
    return { needed: false, reason: 'No zip files found' };
  }
  
  // Check if already extracted
  const files = readdirSync(WEBUI_BASE);
  const hasDirectories = files.some(item => {
    const itemPath = join(WEBUI_BASE, item);
    return statSync(itemPath).isDirectory() && !item.startsWith('.') && !item.endsWith('.zip');
  });
  
  if (hasDirectories) {
    return { needed: false, reason: 'Already extracted' };
  }
  
  return { needed: true, zip1: hasZip1, zip2: hasZip2 };
}

/**
 * Extract WebUI dataset
 * Uses zip command to combine split files and extract
 */
async function extractWebUIDataset() {
  console.log('📦 Extracting WebUI Dataset...\n');
  
  const check = needsExtraction();
  if (!check.needed) {
    console.log(`ℹ️  ${check.reason}`);
    return { success: false, reason: check.reason };
  }
  
  const zip1 = join(WEBUI_BASE, 'train_split_web7k.zip.001');
  const zip2 = join(WEBUI_BASE, 'train_split_web7k.zip.002');
  const outputZip = join(WEBUI_BASE, 'train_split_web7k.zip');
  
  try {
    // Combine split zip files
    if (check.zip1 && check.zip2) {
      console.log('📎 Combining split zip files...');
      console.log(`   ${zip1}`);
      console.log(`   ${zip2}`);
      
      // Use cat to combine split files (works for zip files)
      execSync(`cat "${zip1}" "${zip2}" > "${outputZip}"`, { 
        cwd: WEBUI_BASE,
        stdio: 'inherit'
      });
      
      console.log('✅ Combined zip files\n');
    } else if (check.zip1) {
      // Only one file, just copy it
      execSync(`cp "${zip1}" "${outputZip}"`, { 
        cwd: WEBUI_BASE,
        stdio: 'inherit'
      });
    } else {
      throw new Error('No zip files found');
    }
    
    // Extract combined zip
    console.log('📂 Extracting zip file...');
    console.log(`   This may take several minutes (large dataset)...`);
    
    execSync(`unzip -q "${outputZip}" -d "${WEBUI_BASE}"`, {
      cwd: WEBUI_BASE,
      stdio: 'inherit'
    });
    
    console.log('✅ Extraction complete\n');
    
    // Clean up combined zip (optional - saves space)
    console.log('🧹 Cleaning up combined zip file...');
    try {
      execSync(`rm "${outputZip}"`, { cwd: WEBUI_BASE });
      console.log('✅ Cleanup complete\n');
    } catch (e) {
      console.log('⚠️  Could not remove combined zip (you can delete it manually)\n');
    }
    
    return { success: true };
    
  } catch (error) {
    console.error('❌ Extraction failed:', error.message);
    console.error('\n💡 Manual extraction:');
    console.error(`   1. cd ${WEBUI_BASE}`);
    if (check.zip1 && check.zip2) {
      console.error(`   2. cat train_split_web7k.zip.001 train_split_web7k.zip.002 > train_split_web7k.zip`);
    }
    console.error(`   3. unzip train_split_web7k.zip`);
    console.error(`   4. rm train_split_web7k.zip (optional, saves space)`);
    
    return { success: false, error: error.message };
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  extractWebUIDataset().then(result => {
    if (result.success) {
      console.log('✅ WebUI dataset is now ready to use');
      console.log(`   Run: node evaluation/runners/evaluate-cli.mjs --dataset webui --limit 10`);
    } else {
      process.exit(1);
    }
  }).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { extractWebUIDataset, needsExtraction };

