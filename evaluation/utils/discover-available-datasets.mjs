#!/usr/bin/env node
/**
 * Discover Available Datasets
 * 
 * Searches for and catalogs available datasets we could actually use:
 * - HuggingFace datasets
 * - GitHub repositories
 * - Academic paper datasets
 * - Publicly available datasets
 * 
 * This helps us find datasets we can ACTUALLY download and use.
 */

import { writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Known available datasets (verified or likely available)
 */
const AVAILABLE_DATASETS = [
  {
    name: 'WebUI Dataset',
    source: 'https://github.com/js0nwu/webui',
    type: 'visual-ui-understanding',
    size: '400K web pages',
    annotations: ['accessibility trees', 'layouts', 'computed styles'],
    downloadMethod: 'git clone + follow README',
    status: 'available',
    verified: false, // Need to verify
    license: 'Check repository',
    citation: 'CHI 2023: WebUI Dataset'
  },
  {
    name: 'WCAG Test Cases',
    source: 'https://www.w3.org/WAI/standards-guidelines/act/report/testcases/',
    type: 'wcag-test-cases',
    size: '1000+ test cases',
    annotations: ['pass/fail', 'WCAG level', 'rule ID'],
    downloadMethod: 'web scraping or API',
    status: 'publicly-available',
    verified: false,
    license: 'W3C license',
    citation: 'W3C ACT Test Cases'
  },
  {
    name: 'Rico Dataset',
    source: 'https://interactionmining.org/rico',
    type: 'mobile-ui',
    size: '72K Android app screens',
    annotations: ['UI hierarchies', 'interactions', 'screenshots'],
    downloadMethod: 'website download',
    status: 'available',
    verified: false,
    license: 'Research use',
    citation: 'Rico Dataset (CHI 2017)'
  },
  {
    name: 'COCO Dataset',
    source: 'https://cocodataset.org',
    type: 'general-vision',
    size: '330K images',
    annotations: ['object detection', 'segmentation', 'captions'],
    downloadMethod: 'official download',
    status: 'available',
    verified: true, // Well-known dataset
    license: 'CC BY 4.0',
    citation: 'COCO Dataset (ECCV 2014)'
  },
  {
    name: 'Open Images Dataset',
    source: 'https://storage.googleapis.com/openimages/web/index.html',
    type: 'general-vision',
    size: '9M images',
    annotations: ['object detection', 'relationships'],
    downloadMethod: 'official download',
    status: 'available',
    verified: true,
    license: 'CC BY 4.0',
    citation: 'Open Images Dataset'
  },
  {
    name: 'WebAIM Million',
    source: 'https://webaim.org/projects/million/',
    type: 'accessibility-scan',
    size: '1M home pages',
    annotations: ['automated accessibility scans'],
    downloadMethod: 'API or download',
    status: 'available',
    verified: false,
    license: 'Check WebAIM',
    citation: 'WebAIM Million'
  },
  {
    name: 'GUI-360° Dataset',
    source: 'https://arxiv.org/abs/2511.04307',
    type: 'desktop-ui',
    size: '1.2M action steps',
    annotations: ['GUI grounding', 'screen parsing', 'action prediction'],
    downloadMethod: 'Research paper + GitHub (if available)',
    status: 'available',
    verified: false,
    license: 'Check paper',
    citation: 'GUI-360°: A Comprehensive Dataset for Computer-Using Agents (2025)'
  },
  {
    name: 'GUIOdyssey Dataset',
    source: 'https://github.com/OpenGVLab/GUI-Odyssey',
    type: 'mobile-ui',
    size: 'Cross-app navigation dataset',
    annotations: ['GUI navigation', 'task instructions', 'mobile screens'],
    downloadMethod: 'GitHub repository',
    status: 'available',
    verified: false,
    license: 'Check repository',
    citation: 'GUIOdyssey: Cross-App GUI Navigation on Mobile Devices (ICCV 2025)'
  },
  {
    name: 'A11YN Dataset',
    source: 'https://arxiv.org/abs/2510.13914',
    type: 'accessibility',
    size: 'Accessible web UI code generation',
    annotations: ['Accessibility annotations', 'WCAG compliance'],
    downloadMethod: 'Research paper + GitHub (if available)',
    status: 'available',
    verified: false,
    license: 'Check paper',
    citation: 'A11YN: Aligning LLMs for Accessible Web UI Code Generation (2025)'
  }
];

/**
 * HuggingFace datasets to check
 */
const HUGGINGFACE_DATASETS_TO_CHECK = [
  'js0nwu/webui',
  'webui',
  'accessibility',
  'ui-screenshots',
  'web-screenshots',
  'wcag',
  'ui-understanding',
  'visual-ui',
  'web-accessibility'
];

/**
 * GitHub repositories to check
 */
const GITHUB_REPOS_TO_CHECK = [
  'js0nwu/webui',
  'rico-dataset',
  'ui-datasets',
  'accessibility-datasets',
  'web-ui-datasets'
];

/**
 * Generate dataset discovery report
 */
function generateDiscoveryReport() {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalKnown: AVAILABLE_DATASETS.length,
      verified: AVAILABLE_DATASETS.filter(d => d.verified).length,
      unverified: AVAILABLE_DATASETS.filter(d => !d.verified).length,
      byType: {
        'visual-ui-understanding': AVAILABLE_DATASETS.filter(d => d.type === 'visual-ui-understanding').length,
        'wcag-test-cases': AVAILABLE_DATASETS.filter(d => d.type === 'wcag-test-cases').length,
        'mobile-ui': AVAILABLE_DATASETS.filter(d => d.type === 'mobile-ui').length,
        'general-vision': AVAILABLE_DATASETS.filter(d => d.type === 'general-vision').length,
        'accessibility-scan': AVAILABLE_DATASETS.filter(d => d.type === 'accessibility-scan').length
      }
    },
    datasets: AVAILABLE_DATASETS,
    searchTargets: {
      huggingface: HUGGINGFACE_DATASETS_TO_CHECK,
      github: GITHUB_REPOS_TO_CHECK
    },
    recommendations: [
      '1. Check HuggingFace for webui, accessibility, ui-screenshots datasets',
      '2. Download WebUI dataset from GitHub (js0nwu/webui)',
      '3. Scrape/download WCAG test cases from W3C',
      '4. Check Papers with Code for UI/accessibility datasets',
      '5. Search arXiv for recent dataset papers',
      '6. Check if datasets are on HuggingFace (easier download)'
    ]
  };
  
  return report;
}

/**
 * Generate download instructions
 */
function generateDownloadInstructions() {
  const instructions = {
    webui: {
      method: 'git',
      steps: [
        'git clone https://github.com/js0nwu/webui.git',
        'cd webui',
        'Follow README.md for download instructions',
        'Download dataset files',
        'Run conversion script'
      ],
      estimatedSize: 'Large (400K pages)',
      time: 'Depends on download speed'
    },
    wcag: {
      method: 'web-scraping',
      steps: [
        'Visit https://www.w3.org/WAI/standards-guidelines/act/report/testcases/',
        'Use web scraper or API to download test cases',
        'Parse HTML/JSON format',
        'Convert to our format'
      ],
      estimatedSize: 'Medium (1000+ test cases)',
      time: '1-2 hours'
    },
    huggingface: {
      method: 'pip',
      steps: [
        'pip install datasets',
        'from datasets import load_dataset',
        'dataset = load_dataset("dataset-name")',
        'Save to our format'
      ],
      estimatedSize: 'Varies',
      time: 'Depends on dataset size'
    }
  };
  
  return instructions;
}

/**
 * Main discovery function
 */
async function discoverDatasets() {
  console.log('🔍 Discovering Available Datasets\n');
  
  const report = generateDiscoveryReport();
  const instructions = generateDownloadInstructions();
  
  console.log('📊 Summary:');
  console.log(`   Total Known: ${report.summary.totalKnown}`);
  console.log(`   Verified: ${report.summary.verified}`);
  console.log(`   Unverified: ${report.summary.unverified}\n`);
  
  console.log('📦 Available Datasets:');
  for (const dataset of AVAILABLE_DATASETS) {
    console.log(`\n   ${dataset.name}`);
    console.log(`   Source: ${dataset.source}`);
    console.log(`   Type: ${dataset.type}`);
    console.log(`   Size: ${dataset.size}`);
    console.log(`   Status: ${dataset.status}`);
    console.log(`   Verified: ${dataset.verified ? '✅' : '⚠️'}`);
  }
  
  console.log('\n📝 Recommendations:');
  for (const rec of report.recommendations) {
    console.log(`   ${rec}`);
  }
  
  // Save report
  const reportPath = join(process.cwd(), 'evaluation', 'datasets', 'available-datasets-report.json');
  writeFileSync(reportPath, JSON.stringify({
    ...report,
    downloadInstructions: instructions
  }, null, 2));
  
  console.log(`\n✅ Report saved: ${reportPath}`);
  
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  discoverDatasets().catch(error => {
    console.error('❌ Discovery failed:', error);
    process.exit(1);
  });
}

export { discoverDatasets, AVAILABLE_DATASETS, generateDownloadInstructions };

