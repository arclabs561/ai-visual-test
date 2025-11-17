#!/usr/bin/env node
/**
 * Dataset Adapters
 * 
 * Adapter pattern for reading datasets in their original formats.
 * No manual JSON files - adapters read directly from source data.
 * 
 * Each adapter:
 * - Reads from original dataset format
 * - Transforms to common evaluation format on-the-fly
 * - Never writes duplicate JSON files
 * - Preserves original data as source of truth
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { readGzippedJson } from './gzip-utils.mjs';

/**
 * Common evaluation format (what adapters output)
 */
export const EVALUATION_FORMAT = {
  id: 'string',
  screenshot: 'string (path)',
  groundTruth: {
    preciseScore: 'number (optional)',
    scoreTolerance: 'number (optional)',
    structuredIssues: 'array (optional)',
    structuredFeatures: 'object (optional)',
    humanAnnotations: 'object (optional)'
  },
  metadata: {
    dataset: 'string',
    source: 'string',
    originalFormat: 'string'
  }
};

/**
 * WebUI Dataset Adapter
 * Reads from original WebUI-7K format
 */
export class WebUIAdapter {
  constructor(basePath) {
    this.basePath = basePath || join(
      process.cwd(),
      'evaluation',
      'datasets',
      'human-annotated',
      'visual-ui-understanding',
      'webui-dataset',
      'webui-7k'
    );
  }

  /**
   * Check if dataset is available
   * Returns { available: boolean, needsExtraction: boolean, message?: string }
   */
  isAvailable() {
    if (!existsSync(this.basePath)) {
      return false;
    }
    
    // Check if zip files exist but not extracted
    const zip1 = existsSync(join(this.basePath, 'train_split_web7k.zip.001'));
    const zip2 = existsSync(join(this.basePath, 'train_split_web7k.zip.002'));
    const hasZip = zip1 || zip2;
    
    // Check if sample directories exist (check train_split_web7k subdirectory)
    const scanPath = existsSync(join(this.basePath, 'train_split_web7k'))
      ? join(this.basePath, 'train_split_web7k')
      : this.basePath;
    
    const hasDirectories = existsSync(scanPath) && readdirSync(scanPath).some(item => {
      const itemPath = join(scanPath, item);
      return statSync(itemPath).isDirectory() && !item.startsWith('.');
    });
    
    if (hasZip && !hasDirectories) {
      return {
        available: false,
        needsExtraction: true,
        message: 'WebUI dataset is downloaded but not extracted. Run: node evaluation/utils/extract-webui-dataset.mjs'
      };
    }
    
    return hasDirectories || existsSync(join(this.basePath, 'train_split_web7k.json'));
  }

  /**
   * Load sample from WebUI format
   * WebUI format: Each sample is a directory with:
   * - screenshot_*.webp files
   * - axtree_*.json.gz (accessibility tree)
   * - box_*.json.gz (bounding boxes)
   * - style_*.json.gz (computed styles)
   * - html.html
   * - url.txt
   * 
   * Samples are in train_split_web7k/ subdirectory
   */
  async loadSample(sampleId) {
    // Check both base path and train_split_web7k subdirectory
    const sampleDir = existsSync(join(this.basePath, 'train_split_web7k'))
      ? join(this.basePath, 'train_split_web7k', sampleId)
      : join(this.basePath, sampleId);
    
    if (!existsSync(sampleDir) || !statSync(sampleDir).isDirectory()) {
      return null;
    }

    const files = readdirSync(sampleDir);
    const screenshot = files.find(f => f.includes('screenshot') && f.endsWith('.webp'));
    const urlFile = files.find(f => f.includes('url') && f.endsWith('.txt'));
    const axtree = files.find(f => f.includes('axtree') && f.endsWith('.json.gz'));
    
    if (!screenshot) {
      return null;
    }

    const url = urlFile ? readFileSync(join(sampleDir, urlFile), 'utf-8').trim() : null;
    const axtreeData = axtree ? await readGzippedJson(join(sampleDir, axtree)) : null;

    return {
      id: sampleId,
      screenshot: join(sampleDir, screenshot),
      groundTruth: {
        // WebUI has accessibility trees - these are structural annotations
        structuredFeatures: {
          accessibility: {
            hasAccessibilityTree: !!axtreeData,
            accessibilityTree: axtreeData
          }
        },
        humanAnnotations: {
          annotatorId: 'webui-dataset',
          source: 'WebUI Dataset (CHI 2023)',
          timestamp: null // Extract from sample if available
        }
      },
      metadata: {
        dataset: 'WebUI-7K',
        source: 'https://github.com/js0nwu/webui',
        originalFormat: 'webui-directory',
        url
      }
    };
  }

  /**
   * List all available sample IDs
   * Reads from train_split_web7k.json if available, otherwise scans directories
   */
  listSamples() {
    const availability = this.isAvailable();
    if (!availability || (typeof availability === 'object' && !availability.available)) {
      return [];
    }
    
    // Try to read from train_split_web7k.json first (official split)
    const splitFile = join(this.basePath, 'train_split_web7k.json');
    if (existsSync(splitFile)) {
      try {
        const content = readFileSync(splitFile, 'utf-8');
        // File contains JSON array of sample IDs (timestamps)
        const sampleIds = JSON.parse(content);
        return Array.isArray(sampleIds) ? sampleIds.map(String) : [];
      } catch (error) {
        console.warn(`Failed to parse ${splitFile}, falling back to directory scan: ${error.message}`);
      }
    }
    
    // Fallback: scan directories (check train_split_web7k subdirectory first)
    const scanPath = existsSync(join(this.basePath, 'train_split_web7k'))
      ? join(this.basePath, 'train_split_web7k')
      : this.basePath;
    
    return readdirSync(scanPath)
      .filter(item => {
        const itemPath = join(scanPath, item);
        return statSync(itemPath).isDirectory();
      });
  }

  /**
   * Load multiple samples with flexible scaling options
   * 
   * @param {Object} options - Loading options
   * @param {number|null} options.limit - Maximum number of samples (null = all)
   * @param {number} options.offset - Skip first N samples (for pagination)
   * @param {string} options.strategy - 'sequential', 'random', 'stratified'
   * @param {number} options.seed - Random seed for reproducible sampling
   */
  async loadSamples(options = {}) {
    const {
      limit = null,
      offset = 0,
      strategy = 'sequential',
      seed = null
    } = typeof options === 'number' ? { limit: options } : options; // Backward compat
    
    let sampleIds = this.listSamples();
    
    // Apply strategy
    if (strategy === 'random') {
      if (seed !== null) {
        // Simple seeded shuffle (not cryptographically secure, but reproducible)
        let rng = seed;
        const random = () => {
          rng = (rng * 9301 + 49297) % 233280;
          return rng / 233280;
        };
        sampleIds = [...sampleIds].sort(() => random() - 0.5);
      } else {
        sampleIds = [...sampleIds].sort(() => Math.random() - 0.5);
      }
    }
    // 'sequential' and 'stratified' use original order
    
    // Apply offset and limit
    const ids = sampleIds.slice(offset, limit ? offset + limit : undefined);
    
    const samples = [];
    for (const id of ids) {
      const sample = await this.loadSample(id);
      if (sample) {
        samples.push(sample);
      }
    }
    
    return samples;
  }
  
  /**
   * Get total available sample count
   */
  getTotalCount() {
    return this.listSamples().length;
  }
}

/**
 * ScreenAI Dataset Adapter
 * Reads from original ScreenAI CSV/JSON format
 */
export class ScreenAIAdapter {
  constructor(basePath) {
    this.basePath = basePath || join(
      process.cwd(),
      'evaluation',
      'datasets',
      'research',
      'screenai'
    );
  }

  /**
   * Check if dataset is available
   */
  isAvailable() {
    return existsSync(join(this.basePath, 'screen_annotation', 'train.csv')) ||
           existsSync(join(this.basePath, 'screen_qa', 'short_answers', 'train.json'));
  }

  /**
   * Load from ScreenAI annotation format (CSV)
   * 
   * Note: ScreenAI CSV has quoted fields that may contain commas.
   * Format: screen_id,"screen_annotation" where annotation may contain commas.
   * Screenshots are referenced by screen_id in Rico dataset.
   */
  loadAnnotationSamples(limit = null) {
    const csvPath = join(this.basePath, 'screen_annotation', 'train.csv');
    if (!existsSync(csvPath)) {
      return [];
    }

    const csv = readFileSync(csvPath, 'utf-8');
    const lines = csv.split('\n').filter(l => l.trim());
    const headers = lines[0].split(',');
    
    // Skip header, apply limit
    const dataLines = limit ? lines.slice(1, limit + 1) : lines.slice(1);
    
    // Parse CSV with proper handling of quoted fields
    return dataLines.map((line, index) => {
      // Simple CSV parsing - handles quoted fields
      // For production, should use proper CSV library (e.g., papaparse)
      const values = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim()); // Last value
      
      const row = {};
      headers.forEach((header, i) => {
        row[header.trim()] = values[i] || '';
      });
      
      // ScreenAI annotation CSV has screen_id and screen_annotation
      // Screenshots are referenced by screen_id (Rico dataset)
      const screenId = row.screen_id || null;
      
      return {
        id: `screenai-annotation-${screenId || index}`,
        screenshot: null, // Screenshots are in Rico dataset, not ScreenAI
        screenId: screenId, // Store screen_id for Rico lookup
        groundTruth: {
          structuredFeatures: {
            annotations: row.screen_annotation || row.annotations || '',
            taskType: row.task_type || 'annotation'
          },
          humanAnnotations: {
            annotatorId: 'screenai-dataset',
            source: 'ScreenAI Research Dataset',
            timestamp: row.timestamp || null
          }
        },
        metadata: {
          dataset: 'ScreenAI-Annotation',
          source: 'ScreenAI Research Dataset',
          originalFormat: 'screenai-csv',
          split: 'train',
          note: 'Screenshots require Rico dataset. screen_id references Rico dataset images.',
          ricoScreenId: screenId
        }
      };
    });
    // Don't filter by screenshot - ScreenAI annotation data is valid without screenshots
  }

  /**
   * Load from ScreenAI QA format (JSON)
   * 
   * Note: ScreenAI uses image_id which references Rico dataset images.
   * Screenshots are not included in ScreenAI dataset - need Rico dataset.
   * This adapter loads the QA data but screenshot will be null.
   */
  loadQASamples(limit = null) {
    const jsonPath = join(this.basePath, 'screen_qa', 'short_answers', 'train.json');
    if (!existsSync(jsonPath)) {
      return [];
    }

    const data = JSON.parse(readFileSync(jsonPath, 'utf-8'));
    const samples = Array.isArray(data) ? data : (data.samples || []);
    const limited = limit ? samples.slice(0, limit) : samples;
    
    return limited.map((item, index) => {
      // ScreenAI uses image_id to reference Rico dataset
      // Screenshots are not in ScreenAI - need to download Rico separately
      const imageId = item.image_id;
      
      return {
        id: `screenai-qa-${imageId}-${index}`,
        screenshot: null, // Screenshots are in Rico dataset, not ScreenAI
        imageId: imageId, // Store image_id for Rico lookup
        groundTruth: {
          structuredFeatures: {
            question: item.question,
            answer: Array.isArray(item.ground_truth) ? item.ground_truth[0] : (item.ground_truth || item.answer || null),
            allAnswers: Array.isArray(item.ground_truth) ? item.ground_truth : [item.ground_truth || item.answer].filter(Boolean),
            imageWidth: item.image_width || null,
            imageHeight: item.image_height || null,
            taskType: 'qa'
          },
          humanAnnotations: {
            annotatorId: 'screenai-dataset',
            source: 'ScreenAI Research Dataset',
            timestamp: null
          }
        },
        metadata: {
          dataset: 'ScreenAI-QA',
          source: 'ScreenAI Research Dataset',
          originalFormat: 'screenai-json',
          split: 'train',
          note: 'Screenshots require Rico dataset. image_id references Rico dataset images.',
          ricoImageId: imageId
        }
      };
    });
    // Don't filter by screenshot - ScreenAI QA data is valid without screenshots
  }

  /**
   * Load all ScreenAI samples with flexible options
   */
  loadSamples(options = {}) {
    const { limit = null, offset = 0 } = typeof options === 'number' 
      ? { limit: options } 
      : options;
    
    const annotation = this.loadAnnotationSamples(limit ? Math.floor(limit / 2) : null);
    const qa = this.loadQASamples(limit ? Math.ceil(limit / 2) : null);
    const all = [...annotation, ...qa];
    
    return all.slice(offset, limit ? offset + limit : undefined);
  }
  
  /**
   * Get total available sample count
   */
  getTotalCount() {
    const annotation = this.loadAnnotationSamples();
    const qa = this.loadQASamples();
    return annotation.length + qa.length;
  }
}

/**
 * WCAG Test Cases Adapter
 * Reads from original W3C HTML/JSON format
 */
export class WCAGAdapter {
  constructor(basePath) {
    this.basePath = basePath || join(
      process.cwd(),
      'evaluation',
      'datasets',
      'human-annotated',
      'wcag-test-cases'
    );
  }

  /**
   * Check if dataset is available
   */
  isAvailable() {
    return existsSync(join(this.basePath, 'testcases.json'));
  }

  /**
   * Parse WCAG test cases from HTML
   * W3C format: HTML page with test case references
   */
  loadSamples(options = {}) {
    const { limit = null, offset = 0 } = typeof options === 'number' 
      ? { limit: options } 
      : options;
    const htmlPath = join(this.basePath, 'testcases.json');
    if (!existsSync(htmlPath)) {
      return [];
    }

    // Check if it's actually HTML (W3C downloads HTML, not JSON)
    const content = readFileSync(htmlPath, 'utf-8');
    
    if (content.trim().startsWith('<!DOCTYPE') || content.trim().startsWith('<html')) {
      // Parse HTML to extract test cases
      return this.parseHTMLTestCases(content, limit);
    } else {
      // Try to parse as JSON
      try {
        const data = JSON.parse(content);
        return Array.isArray(data) ? data.slice(0, limit || data.length) : [];
      } catch {
        return [];
      }
    }
  }

  /**
   * Parse test cases from HTML
   */
  parseHTMLTestCases(html, limit = null) {
    // Extract test case links/IDs from HTML
    // W3C format: Links to test cases with IDs
    const testCaseRegex = /testcase[^"']*["']([^"']+)["']/gi;
    const matches = [...html.matchAll(testCaseRegex)];
    const uniqueIds = [...new Set(matches.map(m => m[1]))];
    const limited = limit ? uniqueIds.slice(0, limit) : uniqueIds;
    
    const all = limited.map((id, index) => ({
      id: `wcag-${id}`,
      screenshot: null, // WCAG test cases don't have screenshots
      url: `https://www.w3.org/WAI/standards-guidelines/act/report/testcases/${id}`,
      groundTruth: {
        structuredFeatures: {
          wcag: {
            testCaseId: id,
            source: 'W3C ACT Test Cases'
          }
        },
        humanAnnotations: {
          annotatorId: 'w3c-wcag',
          source: 'W3C Official Test Cases',
          timestamp: null
        }
      },
      metadata: {
        dataset: 'WCAG-TestCases',
        source: 'https://www.w3.org/WAI/standards-guidelines/act/report/testcases/',
        originalFormat: 'w3c-html',
        testCaseId: id
      }
    }));
    
    return all.slice(offset, limit ? offset + limit : undefined);
  }
  
  /**
   * Get total available sample count
   */
  getTotalCount() {
    if (!this.isAvailable()) {
      return 0;
    }
    const htmlPath = join(this.basePath, 'testcases.json');
    if (!existsSync(htmlPath)) {
      return 0;
    }
    const content = readFileSync(htmlPath, 'utf-8');
    if (content.trim().startsWith('<!DOCTYPE') || content.trim().startsWith('<html')) {
      const testCaseRegex = /testcase[^"']*["']([^"']+)["']/gi;
      const matches = [...content.matchAll(testCaseRegex)];
      return new Set(matches.map(m => m[1])).size;
    }
    return 0;
  }
}

/**
 * Real Dataset Adapter
 * Reads from screenshots + metadata (not manually written JSON)
 * 
 * Hand-crafted datasets are valuable and trustworthy - this adapter supports them
 * while keeping original data as source of truth
 */
export class RealDatasetAdapter {
  constructor(basePath) {
    this.basePath = basePath || join(
      process.cwd(),
      'evaluation',
      'datasets',
      'screenshots'
    );
    // Also check for real-dataset.json as fallback (hand-crafted, trustworthy)
    this.jsonPath = join(process.cwd(), 'evaluation', 'datasets', 'real-dataset.json');
  }

  /**
   * Check if dataset is available
   */
  isAvailable() {
    return existsSync(this.basePath) || existsSync(this.jsonPath);
  }

  /**
   * Load from screenshot directory + separate metadata, or from JSON if available
   * Hand-crafted JSON files are trusted and used when available
   */
  loadSamples(options = {}) {
    const { limit = null, offset = 0 } = typeof options === 'number' 
      ? { limit: options } 
      : options;
    
    // Prefer hand-crafted JSON if it exists (trustworthy, manually curated)
    if (existsSync(this.jsonPath)) {
      try {
        const data = JSON.parse(readFileSync(this.jsonPath, 'utf-8'));
        const samples = data.samples || [];
        const limited = samples.slice(offset, limit ? offset + limit : undefined);
        
        return limited.map(sample => ({
          ...sample,
          metadata: {
            ...sample.metadata,
            dataset: 'Real-World-Screenshots',
            source: 'Hand-crafted dataset (trustworthy)',
            originalFormat: 'hand-crafted-json'
          }
        }));
      } catch (error) {
        console.warn(`Failed to load ${this.jsonPath}, falling back to directory scan: ${error.message}`);
      }
    }
    
    // Fallback: scan screenshot directory
    if (!existsSync(this.basePath)) {
      return [];
    }

    const files = readdirSync(this.basePath)
      .filter(f => f.endsWith('.png') || f.endsWith('.webp') || f.endsWith('.jpg'));
    
    // Try to load metadata from separate file
    const metadataPath = join(this.basePath, '..', 'real-dataset-metadata.json');
    let metadata = {};
    if (existsSync(metadataPath)) {
      try {
        metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));
      } catch {
        // Ignore metadata parse errors
      }
    }

    const allSamples = files.map((file, index) => {
      const id = file.replace(/\.(png|webp|jpg)$/i, '');
      const fileMetadata = metadata[id] || metadata[file] || {};
      
      return {
        id: id || `real-${index}`,
        screenshot: join(this.basePath, file),
        groundTruth: fileMetadata.groundTruth || {
          note: 'Ground truth not available - manual annotation required'
        },
        metadata: {
          dataset: 'Real-World-Screenshots',
          source: 'Captured screenshots',
          originalFormat: 'screenshot-files',
          filename: file,
          ...fileMetadata.metadata
        }
      };
    });
    
    return allSamples.slice(offset, limit ? offset + limit : undefined);
  }
  
  /**
   * Get total available sample count
   */
  getTotalCount() {
    if (existsSync(this.jsonPath)) {
      try {
        const data = JSON.parse(readFileSync(this.jsonPath, 'utf-8'));
        return (data.samples || []).length;
      } catch {
        // Fall through to directory scan
      }
    }
    
    if (existsSync(this.basePath)) {
      return readdirSync(this.basePath)
        .filter(f => f.endsWith('.png') || f.endsWith('.webp') || f.endsWith('.jpg')).length;
    }
    
    return 0;
  }
}

/**
 * Dataset Adapter Registry
 * Maps dataset names to adapters
 */
export const DATASET_ADAPTERS = {
  'webui': WebUIAdapter,
  'webui-7k': WebUIAdapter,
  'screenai': ScreenAIAdapter,
  'wcag': WCAGAdapter,
  'wcag-test-cases': WCAGAdapter,
  'real': RealDatasetAdapter,
  'real-dataset': RealDatasetAdapter
};

/**
 * Load dataset using appropriate adapter
 * 
 * Supports flexible scaling via options:
 * - limit: Maximum samples to load (null = all)
 * - offset: Skip first N samples
 * - strategy: 'sequential', 'random', 'stratified'
 * - seed: Random seed for reproducible sampling
 * 
 * Examples:
 *   loadDataset('webui', { limit: 100 })  // First 100
 *   loadDataset('webui', { limit: 1000, offset: 500 })  // Samples 500-1500
 *   loadDataset('webui', { limit: 500, strategy: 'random', seed: 42 })  // Random 500
 */
export async function loadDataset(datasetName, options = {}) {
  const { basePath = null, ...loadOptions } = typeof options === 'number' 
    ? { limit: options }  // Backward compat: loadDataset('webui', 100)
    : options;
  
  const AdapterClass = DATASET_ADAPTERS[datasetName.toLowerCase()];
  if (!AdapterClass) {
    throw new Error(`Unknown dataset: ${datasetName}. Available: ${Object.keys(DATASET_ADAPTERS).join(', ')}`);
  }

  const adapter = basePath ? new AdapterClass(basePath) : new AdapterClass();
  
  const availability = adapter.isAvailable();
  if (!availability || (typeof availability === 'object' && !availability.available)) {
    const message = typeof availability === 'object' && availability.message 
      ? availability.message 
      : `Dataset ${datasetName} is not available. Check dataset location.`;
    throw new Error(message);
  }

  const samples = await adapter.loadSamples(loadOptions);
  const totalAvailable = adapter.getTotalCount ? adapter.getTotalCount() : 
                         (adapter.listSamples ? adapter.listSamples().length : samples.length);
  
  return {
    name: datasetName,
    adapter: adapter.constructor.name,
    samples,
    totalAvailable,
    loaded: samples.length,
    options: loadOptions
  };
}

/**
 * List all available datasets
 * Returns array of { name, available, adapter }
 */
export function listAvailableDatasets() {
  return Object.keys(DATASET_ADAPTERS).map(name => {
    const AdapterClass = DATASET_ADAPTERS[name];
    const adapter = new AdapterClass();
    const availability = adapter.isAvailable();
    const isAvailable = typeof availability === 'boolean' ? availability : availability.available;
    return {
      name,
      available: isAvailable,
      adapter: AdapterClass.name,
      message: typeof availability === 'object' ? availability.message : null,
      needsExtraction: typeof availability === 'object' ? availability.needsExtraction : false
    };
  });
}

