#!/usr/bin/env node
/**
 * Find A11YN Dataset Download Links
 * 
 * Searches for A11YN dataset (UIReq-6.8K, RealUIReq-300) download links.
 */

import { writeFileSync } from 'fs';
import { join } from 'path';

const DATASETS_DIR = join(process.cwd(), 'evaluation', 'datasets', 'research', 'a11yn');

/**
 * Generate A11YN dataset information
 */
function generateA11YNInfo() {
  const info = {
    paper: {
      title: 'A11YN: Aligning LLMs for Accessible Web UI Code Generation',
      arxivId: '2510.13914',
      url: 'https://arxiv.org/abs/2510.13914',
      openReview: 'https://openreview.net/forum?id=yaL9vBuJpD'
    },
    datasets: {
      'UIReq-6.8K': {
        description: '6,800 diverse instructions for web UI generation',
        size: '6,800 samples',
        format: 'JSON with instructions and generated UIs',
        downloadLinks: [
          'Check paper supplement',
          'Check OpenReview supplement',
          'Check GitHub repository (if available)',
          'Check HuggingFace (search for "a11yn" or "uireq")'
        ]
      },
      'RealUIReq-300': {
        description: '300 real-world web UI requests from public web pages',
        size: '300 samples',
        format: 'JSON with real-world UI requests',
        downloadLinks: [
          'Check paper supplement',
          'Check OpenReview supplement',
          'Check GitHub repository (if available)'
        ]
      }
    },
    searchQueries: [
      'A11YN dataset download',
      'UIReq-6.8K dataset',
      'RealUIReq-300 dataset',
      'a11yn huggingface',
      'accessible web UI dataset'
    ],
    nextSteps: [
      '1. Check paper supplement: https://arxiv.org/abs/2510.13914',
      '2. Check OpenReview: https://openreview.net/forum?id=yaL9vBuJpD',
      '3. Search HuggingFace: https://huggingface.co/datasets?search=a11yn',
      '4. Check paper authors\' GitHub repositories',
      '5. Contact paper authors if dataset not publicly available'
    ]
  };

  const infoPath = join(DATASETS_DIR, 'A11YN_DATASET_INFO.json');
  writeFileSync(infoPath, JSON.stringify(info, null, 2));

  console.log('📋 A11YN Dataset Information');
  console.log('='.repeat(70));
  console.log();
  console.log(`Paper: ${info.paper.title}`);
  console.log(`arXiv: ${info.paper.url}`);
  console.log();
  console.log('📊 Datasets:');
  console.log('-'.repeat(70));
  for (const [name, dataset] of Object.entries(info.datasets)) {
    console.log(`\n${name}:`);
    console.log(`   Description: ${dataset.description}`);
    console.log(`   Size: ${dataset.size}`);
    console.log(`   Format: ${dataset.format}`);
    console.log(`   Download Links:`);
    dataset.downloadLinks.forEach(link => console.log(`     - ${link}`));
  }
  console.log();
  console.log('🔍 Search Queries:');
  info.searchQueries.forEach(query => console.log(`   - ${query}`));
  console.log();
  console.log('💡 Next Steps:');
  info.nextSteps.forEach(step => console.log(`   ${step}`));
  console.log();
  console.log(`✅ Info saved: ${infoPath}`);
  console.log();

  return info;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateA11YNInfo();
}

export { generateA11YNInfo };

