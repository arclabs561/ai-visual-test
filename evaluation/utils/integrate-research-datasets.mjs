#!/usr/bin/env node
/**
 * Integrate Research Datasets
 * 
 * Integrates downloaded research datasets into the evaluation suite.
 * Converts datasets to our standard format and creates evaluation scripts.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { mkdirSync } from 'fs';

const DATASETS_DIR = join(process.cwd(), 'evaluation', 'datasets', 'research');
const INTEGRATED_DIR = join(process.cwd(), 'evaluation', 'datasets', 'integrated');

// Ensure directories exist
if (!existsSync(INTEGRATED_DIR)) {
  mkdirSync(INTEGRATED_DIR, { recursive: true });
}

/**
 * Check if dataset is downloaded
 */
function checkDatasetStatus(datasetName, expectedPaths) {
  const status = {
    name: datasetName,
    downloaded: false,
    paths: {},
    missing: []
  };

  for (const [key, path] of Object.entries(expectedPaths)) {
    const fullPath = join(DATASETS_DIR, path);
    if (existsSync(fullPath)) {
      status.paths[key] = fullPath;
      status.downloaded = true;
    } else {
      status.missing.push(key);
    }
  }

  return status;
}

/**
 * Parse ScreenAI annotation text to extract elements
 * Format: TYPE text x1 y1 x2 y2 (nested elements)
 */
function parseScreenAnnotation(annotation) {
  // Simple parser - extracts element types and bounding boxes
  // Format: TYPE text x1 y1 x2 y2
  const elements = [];
  const regex = /(\w+)\s+([^(]+?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/g;
  let match;
  
  while ((match = regex.exec(annotation)) !== null) {
    elements.push({
      type: match[1],
      text: match[2].trim(),
      bounds: {
        left: parseInt(match[3]),
        top: parseInt(match[4]),
        right: parseInt(match[5]),
        bottom: parseInt(match[6])
      }
    });
  }
  
  return elements;
}

/**
 * Convert ScreenAI Screen Annotation dataset (CSV format)
 */
function convertScreenAnnotationDataset(datasetDir) {
  // ScreenAI format: CSV files (train.csv, valid.csv, test.csv)
  // Our format: { id, screenshot, groundTruth: { elements: [...] } }
  
  if (!existsSync(datasetDir)) {
    return null;
  }

  try {
    const converted = {
      name: 'ScreenAI Screen Annotation',
      source: 'ScreenAI (2402.04615)',
      samples: []
    };

    // Read CSV files
    const csvFiles = ['train.csv', 'valid.csv', 'test.csv'];
    let sampleIndex = 0;

    for (const csvFile of csvFiles) {
      const csvPath = join(datasetDir, csvFile);
      if (!existsSync(csvPath)) continue;

      const csvContent = readFileSync(csvPath, 'utf8');
      const lines = csvContent.split('\n').filter(line => line.trim());
      
      // ScreenAI format: screen_id,screen_annotation
      // screen_annotation is a text description of UI elements with bounding boxes
      for (let i = 1; i < lines.length && i < 100; i++) { // Limit to 100 per file for now
        const line = lines[i];
        // CSV parsing: screen_id is first field, annotation is second (may contain commas)
        const firstComma = line.indexOf(',');
        if (firstComma === -1) continue;
        
        const screenId = line.substring(0, firstComma).trim();
        const annotation = line.substring(firstComma + 1).trim();
        
        // Note: Screenshots need to be retrieved from Rico dataset using screen_id
        // For now, we store the screen_id and annotation
        converted.samples.push({
          id: `screenai-annotation-${sampleIndex++}`,
          screenId: screenId,
          screenshot: null, // Will need to be fetched from Rico dataset
          groundTruth: {
            annotation: annotation,
            // Parse annotation to extract elements (format: TYPE text x1 y1 x2 y2)
            elements: parseScreenAnnotation(annotation)
          },
          metadata: {
            source: 'ScreenAI',
            paper: '2402.04615',
            split: csvFile.replace('.csv', ''),
            note: 'Screenshot needs to be fetched from Rico dataset using screen_id'
          }
        });
      }
    }

    return converted.samples.length > 0 ? converted : null;
  } catch (error) {
    console.warn(`Failed to convert ScreenAI annotation dataset: ${error.message}`);
    return null;
  }
}

/**
 * Convert ScreenAI ScreenQA dataset (JSON format)
 */
function convertScreenQADataset(datasetDir) {
  if (!existsSync(datasetDir)) {
    return null;
  }

  try {
    const converted = {
      name: 'ScreenAI ScreenQA',
      source: 'ScreenAI (2402.04615)',
      samples: []
    };

    // Read JSON files from short_answers and complex_qa
    const jsonFiles = [
      { path: join(datasetDir, 'short_answers', 'train.json'), type: 'short', split: 'train' },
      { path: join(datasetDir, 'short_answers', 'validation.json'), type: 'short', split: 'validation' },
      { path: join(datasetDir, 'short_answers', 'test.json'), type: 'short', split: 'test' },
      { path: join(datasetDir, 'complex_qa', 'data.json'), type: 'complex', split: 'all' }
    ];

    let sampleIndex = 0;

    for (const { path, type, split } of jsonFiles) {
      if (!existsSync(path)) continue;

      const data = JSON.parse(readFileSync(path, 'utf8'));
      const items = Array.isArray(data) ? data : (data.samples || data.data || []);

      // Limit to 100 per file for initial integration
      for (let i = 0; i < Math.min(items.length, 100); i++) {
        const item = items[i];
        // Handle ground_truth format (can be array of strings or array of objects)
        let answers = [];
        if (item.ground_truth) {
          if (Array.isArray(item.ground_truth)) {
            answers = item.ground_truth.map(gt => 
              typeof gt === 'string' ? gt : (gt.full_answer || gt.answer || gt)
            );
          }
        } else {
          answers = item.answers || item.short_answers || (item.answer ? [item.answer] : []);
        }

        converted.samples.push({
          id: `screenai-qa-${type}-${sampleIndex++}`,
          screenshot: null, // Will need to be fetched from Rico dataset using image_id
          imageId: item.image_id,
          question: item.question || item.query || '',
          groundTruth: {
            answers: answers.filter(a => a && a !== '<no answer>' && a !== 'null'),
            expectedScore: item.score || null
          },
          metadata: {
            source: 'ScreenAI',
            paper: '2402.04615',
            task: 'question-answering',
            type: type,
            split: split
          }
        });
      }
    }

    return converted.samples.length > 0 ? converted : null;
  } catch (error) {
    console.warn(`Failed to convert ScreenQA dataset: ${error.message}`);
    return null;
  }
}

/**
 * Check all datasets
 */
function checkAllDatasets() {
  const statuses = {
    screenai: checkDatasetStatus('ScreenAI', {
      annotation: 'screenai/screen_annotation',
      qa: 'screenai/screen_qa'
    }),
    multiui: checkDatasetStatus('MultiUI', {
      dataset: 'multiui'
    }),
    a11yn: checkDatasetStatus('A11YN', {
      uireq: 'a11yn/UIReq-6.8K',
      realuireq: 'a11yn/RealUIReq-300'
    })
  };

  return statuses;
}

/**
 * Main integration function
 */
async function integrateDatasets() {
  console.log('🔄 Integrating Research Datasets');
  console.log('='.repeat(70));
  console.log();

  // Check dataset status
  const statuses = checkAllDatasets();
  
  console.log('📊 Dataset Status:');
  console.log('-'.repeat(70));
  
  let integratedCount = 0;
  
  for (const [key, status] of Object.entries(statuses)) {
    const icon = status.downloaded ? '✅' : '❌';
    console.log(`${icon} ${status.name}:`);
    console.log(`   Downloaded: ${status.downloaded ? 'Yes' : 'No'}`);
    
    if (status.downloaded) {
      console.log(`   Paths: ${Object.keys(status.paths).join(', ')}`);
      
      // Try to convert and integrate
      if (key === 'screenai') {
        // Convert Screen Annotation (CSV format)
        if (status.paths.annotation) {
          const converted = convertScreenAnnotationDataset(status.paths.annotation);
          if (converted && converted.samples.length > 0) {
            const outputPath = join(INTEGRATED_DIR, 'screenai-annotation.json');
            writeFileSync(outputPath, JSON.stringify(converted, null, 2));
            console.log(`   ✅ Integrated: ${outputPath} (${converted.samples.length} samples)`);
            integratedCount++;
          } else {
            console.log(`   ⚠️  No samples converted from annotation dataset`);
          }
        }
        
        // Convert ScreenQA (JSON format)
        if (status.paths.qa) {
          const converted = convertScreenQADataset(status.paths.qa);
          if (converted && converted.samples.length > 0) {
            const outputPath = join(INTEGRATED_DIR, 'screenai-qa.json');
            writeFileSync(outputPath, JSON.stringify(converted, null, 2));
            console.log(`   ✅ Integrated: ${outputPath} (${converted.samples.length} samples)`);
            integratedCount++;
          } else {
            console.log(`   ⚠️  No samples converted from QA dataset`);
          }
        }
      }
    } else {
      console.log(`   Missing: ${status.missing.join(', ')}`);
      console.log(`   💡 Run: bash ${join(DATASETS_DIR, 'download-datasets.sh')}`);
    }
    console.log();
  }

  console.log('='.repeat(70));
  console.log(`✅ Integrated ${integratedCount} dataset(s)`);
  console.log(`📁 Integrated datasets: ${INTEGRATED_DIR}`);
  console.log();

  // Create evaluation script template
  if (integratedCount > 0) {
    createEvaluationScript();
  }
}

/**
 * Create evaluation script for integrated datasets
 */
function createEvaluationScript() {
  const script = `#!/usr/bin/env node
/**
 * Evaluate Research Datasets
 * 
 * Runs evaluation on integrated research datasets.
 */

import { validateScreenshot, startSession, endSession } from '../../src/index.mjs';
import { readFileSync } from 'fs';
import { join } from 'path';

const INTEGRATED_DIR = join(process.cwd(), 'evaluation', 'datasets', 'integrated');

async function evaluateResearchDatasets() {
  const sessionId = startSession('research-datasets-evaluation');
  
  try {
    // ScreenAI Screen Annotation
    const annotationPath = join(INTEGRATED_DIR, 'screenai-annotation.json');
    if (existsSync(annotationPath)) {
      const dataset = JSON.parse(readFileSync(annotationPath, 'utf8'));
      console.log(\`Evaluating \${dataset.name} (\${dataset.samples.length} samples)...\`);
      
      // Evaluate first 10 samples
      for (const sample of dataset.samples.slice(0, 10)) {
        if (sample.screenshot && existsSync(sample.screenshot)) {
          const result = await validateScreenshot(sample.screenshot, 
            'Detect and annotate all UI elements with bounding boxes',
            { sessionId }
          );
          console.log(\`Sample \${sample.id}: Score \${result.score}\`);
        }
      }
    }
    
    // ScreenAI ScreenQA
    const qaPath = join(INTEGRATED_DIR, 'screenai-qa.json');
    if (existsSync(qaPath)) {
      const dataset = JSON.parse(readFileSync(qaPath, 'utf8'));
      console.log(\`Evaluating \${dataset.name} (\${dataset.samples.length} samples)...\`);
      
      // Evaluate first 10 samples
      for (const sample of dataset.samples.slice(0, 10)) {
        if (sample.screenshot && existsSync(sample.screenshot)) {
          const result = await validateScreenshot(sample.screenshot,
            sample.question,
            { sessionId }
          );
          console.log(\`Q: \${sample.question}\`);
          console.log(\`A: \${result.reasoning}\`);
        }
      }
    }
  } finally {
    const summary = endSession(sessionId, { verbose: true });
  }
}

evaluateResearchDatasets().catch(console.error);
`;

  const scriptPath = join(process.cwd(), 'evaluation', 'runners', 'run-research-datasets-evaluation.mjs');
  writeFileSync(scriptPath, script);
  console.log(`✅ Created evaluation script: ${scriptPath}`);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  integrateDatasets().catch(console.error);
}

export { integrateDatasets, checkAllDatasets };

