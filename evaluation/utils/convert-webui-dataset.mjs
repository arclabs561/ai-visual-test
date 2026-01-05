#!/usr/bin/env node
/**
 * Convert WebUI Dataset to Ground Truth Format
 * 
 * Converts WebUI dataset samples to our standardized ground truth format
 * for use in evaluations.
 */

import { readdirSync, readFileSync, existsSync, statSync, writeFileSync, mkdirSync, createWriteStream } from 'fs';
import { join, dirname } from 'path';
import { readGzippedJson } from './gzip-utils.mjs';

const WEBUI_DATASET_DIR = join(process.cwd(), 'evaluation', 'datasets', 'human-annotated', 'visual-ui-understanding', 'webui-dataset', 'webui-7k');
const OUTPUT_FILE = join(process.cwd(), 'evaluation', 'datasets', 'webui-ground-truth.json');


/**
 * Read regular JSON file
 */
function readJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch (e) {
    return null;
  }
}

/**
 * Read text file
 */
function readText(filePath) {
  try {
    return readFileSync(filePath, 'utf-8').trim();
  } catch (e) {
    return null;
  }
}

/**
 * Convert a single WebUI sample to ground truth format
 */
async function convertSample(sampleDir) {
  const sampleId = sampleDir.split('/').pop();
  const files = readdirSync(sampleDir);
  
  // Find key files - collect ALL viewports/devices
  const screenshots = files.filter(f => f.includes('screenshot') && f.endsWith('.webp'));
  const html = files.find(f => f.includes('html') && f.endsWith('.html'));
  const urlFile = files.find(f => f.includes('url') && f.endsWith('.txt'));
  const axtrees = files.filter(f => f.includes('axtree') && f.endsWith('.json.gz'));
  const boxes = files.filter(f => f.includes('box') && !f.includes('bb') && f.endsWith('.json.gz'));
  const styles = files.filter(f => f.includes('style') && f.endsWith('.json.gz'));
  const links = files.find(f => f.includes('links') && f.endsWith('.json'));
  const classes = files.filter(f => f.includes('class') && f.endsWith('.json.gz'));
  const viewports = files.filter(f => f.includes('viewport') && f.endsWith('.json.gz'));
  
  // Primary screenshot (prefer default_1920-1080, fallback to first)
  const screenshot = screenshots.find(f => f.includes('default_1920-1080')) || screenshots[0];
  
  if (!screenshot) {
    return null; // Skip samples without screenshots
  }
  
  const screenshotPath = join(sampleDir, screenshot);
  const url = urlFile ? readText(join(sampleDir, urlFile)) : null;
  
  // Extract viewport from primary screenshot filename
  const viewportMatch = screenshot ? screenshot.match(/(\d+)[-x](\d+)/) : null;
  const viewport = viewportMatch ? {
    width: parseInt(viewportMatch[1]),
    height: parseInt(viewportMatch[2])
  } : null;
  
  // Load metadata
  const metadata = {
    sampleId,
    url,
    viewport,
    screenshot: screenshotPath,
    timestamp: parseInt(sampleId) || null,
    availableViewports: screenshots.length,
    availableDevices: new Set(screenshots.map(s => {
      if (s.includes('iPad')) return 'tablet';
      if (s.includes('iPhone')) return 'mobile';
      return 'desktop';
    })).size
  };
  
  // Load structured data if available - use primary/default viewport files
  const annotations = {};
  
  // Primary accessibility tree (prefer default_1920-1080)
  const primaryAxtree = axtrees.find(f => f.includes('default_1920-1080')) || axtrees[0];
  if (primaryAxtree) {
    const axtreeData = await readGzippedJson(join(sampleDir, primaryAxtree));
    if (axtreeData) annotations.accessibilityTree = axtreeData;
  }
  
  // Primary bounding boxes
  const primaryBox = boxes.find(f => f.includes('default_1920-1080')) || boxes[0];
  if (primaryBox) {
    const boxData = await readGzippedJson(join(sampleDir, primaryBox));
    if (boxData) annotations.boundingBoxes = boxData;
  }
  
  // Primary styles
  const primaryStyle = styles.find(f => f.includes('default_1920-1080')) || styles[0];
  if (primaryStyle) {
    const styleData = await readGzippedJson(join(sampleDir, primaryStyle));
    if (styleData) annotations.styles = styleData;
  }
  
  // Element classes (if available)
  const primaryClass = classes.find(f => f.includes('default_1920-1080')) || classes[0];
  if (primaryClass) {
    const classData = await readGzippedJson(join(sampleDir, primaryClass));
    if (classData) annotations.classes = classData;
  }
  
  // Viewport metadata
  const primaryViewport = viewports.find(f => f.includes('default_1920-1080')) || viewports[0];
  if (primaryViewport) {
    const viewportData = await readGzippedJson(join(sampleDir, primaryViewport));
    if (viewportData) annotations.viewportMetadata = viewportData;
  }
  
  if (links) {
    const linksData = readJson(join(sampleDir, links));
    if (linksData) annotations.links = linksData;
  }
  
  if (html) {
    const htmlPath = join(sampleDir, html);
    if (existsSync(htmlPath)) {
      annotations.html = readFileSync(htmlPath, 'utf-8').substring(0, 50000); // Limit size
    }
  }
  
  // Store all available viewports for multi-viewport evaluation
  annotations.availableViewports = screenshots.map(s => {
    const match = s.match(/(\d+)[-x](\d+)/);
    const deviceMatch = s.match(/(iPad-Pro|iPhone-13 Pro|default)/i);
    return {
      device: deviceMatch ? deviceMatch[1] : 'default',
      viewport: match ? { width: parseInt(match[1]), height: parseInt(match[2]) } : null,
      screenshot: join(sampleDir, s)
    };
  });
  
  return {
    id: sampleId,
    url,
    screenshot: screenshotPath,
    viewport,
    metadata,
    annotations: Object.keys(annotations).length > 0 ? annotations : undefined,
    // Ground truth fields for evaluation
    // WebUI dataset is for accessibility tree validation, not score validation
    groundTruth: {
      evaluationType: 'accessibility-tree', // Indicates this is for accessibility validation, not score validation
      structuredFeatures: {
        accessibility: {
          hasAccessibilityTree: !!annotations.accessibilityTree,
          accessibilityTree: annotations.accessibilityTree ? { _note: 'Use adapter to load full tree' } : null,
          hasBoundingBoxes: !!annotations.boundingBoxes,
          hasStyles: !!annotations.styles,
          hasHtml: !!annotations.html,
          hasClasses: !!annotations.classes,
          hasViewportMetadata: !!annotations.viewportMetadata,
          multiViewport: screenshots.length > 1,
          viewportCount: screenshots.length
        }
      },
      // Metadata about what's available (for compatibility)
      hasScreenshot: true,
      hasAccessibilityTree: !!annotations.accessibilityTree,
      hasBoundingBoxes: !!annotations.boundingBoxes,
      hasStyles: !!annotations.styles,
      hasHtml: !!annotations.html,
      hasClasses: !!annotations.classes,
      hasViewportMetadata: !!annotations.viewportMetadata,
      multiViewport: screenshots.length > 1,
      viewportCount: screenshots.length
    }
  };
}

/**
 * Main conversion function
 */
async function convertWebUIDataset(options = {}) {
  const { limit = null, outputFile = OUTPUT_FILE } = options;
  
  console.log('🔄 Converting WebUI Dataset to Ground Truth Format\n');
  console.log(`📁 Source: ${WEBUI_DATASET_DIR}`);
  console.log(`📄 Output: ${outputFile}\n`);
  
  if (!existsSync(WEBUI_DATASET_DIR)) {
    throw new Error(`Dataset directory not found: ${WEBUI_DATASET_DIR}`);
    console.error(`❌ Dataset directory not found: ${WEBUI_DATASET_DIR}`);
    process.exit(1);
  }
  
  // Get all sample directories - check train_split_web7k subdirectory first
  const trainSplitDir = join(WEBUI_DATASET_DIR, 'train_split_web7k');
  const scanDir = existsSync(trainSplitDir) ? trainSplitDir : WEBUI_DATASET_DIR;
  
  const sampleDirs = readdirSync(scanDir)
    .filter(item => {
      const itemPath = join(scanDir, item);
      return statSync(itemPath).isDirectory() && !item.startsWith('.');
    })
    .map(item => join(scanDir, item));
  
  const totalSamples = limit ? Math.min(limit, sampleDirs.length) : sampleDirs.length;
  console.log(`📊 Found ${sampleDirs.length} samples, processing ${totalSamples}...\n`);
  
  const convertedSamples = [];
  let processed = 0;
  let skipped = 0;
  
  for (const sampleDir of sampleDirs.slice(0, totalSamples)) {
    try {
      const sample = await convertSample(sampleDir);
      if (sample) {
        convertedSamples.push(sample);
        processed++;
        if (processed % 100 === 0) {
          console.log(`   Processed ${processed}/${totalSamples} samples...`);
        }
      } else {
        skipped++;
      }
    } catch (error) {
      console.error(`   ⚠️  Error processing ${sampleDir}: ${error.message}`);
      skipped++;
    }
  }
  
  // Write output incrementally to avoid JSON stringify limits
  const outputDir = dirname(outputFile);
  mkdirSync(outputDir, { recursive: true });
  
  // Write header
  const header = {
    name: 'WebUI Ground Truth Dataset',
    source: 'WebUI Dataset (webui-7k)',
    version: '1.0.0',
    created: new Date().toISOString(),
    totalSamples: convertedSamples.length
  };
  
  // Write as streaming JSON to handle large files
  const stream = createWriteStream(outputFile);
  stream.write(JSON.stringify(header, null, 2).replace(/\}$/, ''));
  stream.write(',\n  "samples": [\n');
  
  // Write samples one by one
  for (let i = 0; i < convertedSamples.length; i++) {
    const sample = convertedSamples[i];
    // Limit annotation size to prevent huge files
    if (sample.annotations) {
      // Truncate large HTML/accessibility trees
      if (sample.annotations.html && sample.annotations.html.length > 10000) {
        sample.annotations.html = sample.annotations.html.substring(0, 10000) + '... [truncated]';
      }
      if (sample.annotations.accessibilityTree) {
        const treeStr = JSON.stringify(sample.annotations.accessibilityTree);
        if (treeStr.length > 50000) {
          // For converted files, we truncate to save space
          // But keep enough structure to indicate it exists
          // Note: For validation, use adapter which loads full tree
          const originalTree = sample.annotations.accessibilityTree;
          sample.annotations.accessibilityTree = {
            _truncated: true,
            _note: 'Accessibility tree truncated for file size. Use adapter to load full tree.',
            nodeCount: originalTree.nodes?.length || 
                      (Array.isArray(originalTree) ? originalTree.length : 0),
            _hasTree: true, // Indicate tree exists (just truncated)
            _useAdapter: true // Flag to use adapter for validation
          };
        }
      }
    }
    
    const sampleJson = JSON.stringify(sample, null, 2);
    const indented = sampleJson.split('\n').map((line, idx) => idx === 0 ? '    ' + line : '    ' + line).join('\n');
    stream.write(indented);
    if (i < convertedSamples.length - 1) {
      stream.write(',\n');
    } else {
      stream.write('\n');
    }
  }
  
  stream.write('  ]\n}');
  stream.end();
  
  // Wait for stream to finish
  await new Promise((resolve) => stream.on('finish', resolve));
  
  // Get file size
  const fileSize = statSync(outputFile).size;
  
  console.log(`\n✅ Conversion completed!`);
  console.log(`   Processed: ${processed}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Output: ${outputFile}`);
  console.log(`   Size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
  
  return {
    ...header,
    samples: convertedSamples
  };
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const limit = process.argv[2] ? parseInt(process.argv[2]) : null;
  convertWebUIDataset({ limit }).catch(console.error);
}

export { convertWebUIDataset, convertSample };

