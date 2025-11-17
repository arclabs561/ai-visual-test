#!/usr/bin/env node
/**
 * Integrate A11YN Dataset
 * 
 * Converts A11YN datasets (UIReq-6.8K, RealUIReq-300) to our standard format.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const A11YN_DIR = join(process.cwd(), 'evaluation', 'datasets', 'research', 'a11yn');
const INTEGRATED_DIR = join(process.cwd(), 'evaluation', 'datasets', 'integrated');

/**
 * Check if A11YN datasets are downloaded
 */
function checkA11YNDatasets() {
  const status = {
    uireq: { downloaded: false, path: null },
    realuireq: { downloaded: false, path: null }
  };

  if (!existsSync(A11YN_DIR)) {
    return status;
  }

  // Look for dataset files
  const files = readdirSync(A11YN_DIR, { recursive: true });
  
  // UIReq-6.8K - look for files with "uireq" or "6.8k" in name
  const uireqFile = files.find(f => 
    f.toLowerCase().includes('uireq') || 
    f.toLowerCase().includes('6.8k') ||
    f.toLowerCase().includes('6800')
  );
  if (uireqFile) {
    status.uireq = {
      downloaded: true,
      path: join(A11YN_DIR, uireqFile)
    };
  }

  // RealUIReq-300 - look for files with "realuireq" or "300" in name
  const realuireqFile = files.find(f => 
    f.toLowerCase().includes('realuireq') || 
    f.toLowerCase().includes('real') && f.toLowerCase().includes('300')
  );
  if (realuireqFile) {
    status.realuireq = {
      downloaded: true,
      path: join(A11YN_DIR, realuireqFile)
    };
  }

  return status;
}

/**
 * Convert UIReq-6.8K dataset
 */
function convertUIReqDataset(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const data = JSON.parse(readFileSync(filePath, 'utf8'));
    const converted = {
      name: 'A11YN UIReq-6.8K',
      source: 'A11YN (2510.13914)',
      samples: []
    };

    // Handle different possible formats
    const items = Array.isArray(data) 
      ? data 
      : (data.samples || data.instructions || data.data || []);

    items.slice(0, 1000).forEach((item, index) => {
      converted.samples.push({
        id: `a11yn-uireq-${index}`,
        instruction: item.instruction || item.query || item.request || item.prompt || '',
        metadata: {
          source: 'A11YN',
          paper: '2510.13914',
          dataset: 'UIReq-6.8K',
          category: item.category || item.domain || null,
          pageType: item.page_type || item.pageType || null
        }
      });
    });

    return converted;
  } catch (error) {
    console.warn(`Failed to convert UIReq dataset: ${error.message}`);
    return null;
  }
}

/**
 * Convert RealUIReq-300 dataset
 */
function convertRealUIReqDataset(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const data = JSON.parse(readFileSync(filePath, 'utf8'));
    const converted = {
      name: 'A11YN RealUIReq-300',
      source: 'A11YN (2510.13914)',
      samples: []
    };

    // Handle different possible formats
    const items = Array.isArray(data) 
      ? data 
      : (data.samples || data.requests || data.data || []);

    items.forEach((item, index) => {
      converted.samples.push({
        id: `a11yn-realuireq-${index}`,
        instruction: item.instruction || item.query || item.request || item.prompt || '',
        screenshot: item.screenshot || item.image || null,
        metadata: {
          source: 'A11YN',
          paper: '2510.13914',
          dataset: 'RealUIReq-300',
          purpose: item.purpose || null,
          pageType: item.page_type || item.pageType || null,
          domain: item.domain || item.application_domain || null,
          components: item.required_components || item.components || null
        }
      });
    });

    return converted;
  } catch (error) {
    console.warn(`Failed to convert RealUIReq dataset: ${error.message}`);
    return null;
  }
}

/**
 * Main integration function
 */
async function integrateA11YNDatasets() {
  console.log('🔄 Integrating A11YN Datasets');
  console.log('='.repeat(70));
  console.log();

  const status = checkA11YNDatasets();
  let integratedCount = 0;

  // UIReq-6.8K
  if (status.uireq.downloaded) {
    console.log('✅ UIReq-6.8K found');
    const converted = convertUIReqDataset(status.uireq.path);
    if (converted && converted.samples.length > 0) {
      const outputPath = join(INTEGRATED_DIR, 'a11yn-uireq-6.8k.json');
      writeFileSync(outputPath, JSON.stringify(converted, null, 2));
      console.log(`   ✅ Integrated: ${outputPath} (${converted.samples.length} samples)`);
      integratedCount++;
    }
  } else {
    console.log('❌ UIReq-6.8K not found');
    console.log('   💡 Check: evaluation/datasets/research/a11yn/A11YN_DATASET_INFO.json');
  }
  console.log();

  // RealUIReq-300
  if (status.realuireq.downloaded) {
    console.log('✅ RealUIReq-300 found');
    const converted = convertRealUIReqDataset(status.realuireq.path);
    if (converted && converted.samples.length > 0) {
      const outputPath = join(INTEGRATED_DIR, 'a11yn-realuireq-300.json');
      writeFileSync(outputPath, JSON.stringify(converted, null, 2));
      console.log(`   ✅ Integrated: ${outputPath} (${converted.samples.length} samples)`);
      integratedCount++;
    }
  } else {
    console.log('❌ RealUIReq-300 not found');
    console.log('   💡 Check: evaluation/datasets/research/a11yn/A11YN_DATASET_INFO.json');
  }
  console.log();

  console.log('='.repeat(70));
  console.log(`✅ Integrated ${integratedCount} dataset(s)`);
  console.log();

  if (integratedCount === 0) {
    console.log('💡 Next Steps:');
    console.log('   1. Download datasets (check paper supplement or HuggingFace)');
    console.log('   2. Place in: evaluation/datasets/research/a11yn/');
    console.log('   3. Run this script again');
    console.log();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  integrateA11YNDatasets().catch(console.error);
}

export { checkA11YNDatasets, integrateA11YNDatasets };

