#!/usr/bin/env node
/**
 * Dataset Adapters
 * 
 * ADAPTER PATTERN FOR DATASET LOADING
 * 
 * DESIGN DECISION: Adapter pattern instead of manual JSON files
 * - Why: Original datasets are the source of truth, not our JSON copies
 * - Why this way: Adapters read directly from source, transform on-the-fly
 * - Alternative considered: Manual JSON files for each dataset
 *   - Rejected: Duplicates data, creates maintenance burden, can drift from source
 *   - Our approach: Adapters preserve original data, transform when needed
 * 
 * BENEFITS:
 * - No data duplication: Original datasets remain source of truth
 * - Flexible scaling: Can load 1 sample or 1000 via --limit flag
 * - Easy updates: Update adapter when dataset format changes, not JSON files
 * - Preserves metadata: Original format information retained
 * 
 * EACH ADAPTER:
 * - Reads from original dataset format (CSV, JSON, directories, etc.)
 * - Transforms to common evaluation format on-the-fly
 * - Never writes duplicate JSON files
 * - Preserves original data as source of truth
 * - Supports limit/offset for flexible sampling
 * 
 * COMMON FORMAT: All adapters output EVALUATION_FORMAT
 * - Standardizes evaluation across different dataset formats
 * - Allows evaluation runner to work with any dataset
 * - Makes it easy to add new datasets (just create adapter)
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, resolve, normalize, relative, isAbsolute } from 'path';
import { readGzippedJson } from './gzip-utils.mjs';
import { validatePagination, validatePath } from './path-security.mjs';

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
 * 
 * DESIGN DECISION: Read from original WebUI-7K format (directories + JSON)
 * - Why: WebUI-7K stores samples as directories with multiple files
 *   - screenshot_*.webp (screenshots)
 *   - axtree_*.json.gz (accessibility trees)
 *   - box_*.json.gz (bounding boxes)
 *   - style_*.json.gz (computed styles)
 *   - html.html, url.txt
 * - Why this way: Preserves original structure, no data loss
 * - Alternative considered: Extract to single JSON file
 *   - Rejected: Loses structure, creates maintenance burden
 * - Extraction: Dataset comes as split zip files (train_split_web7k.zip.001, .002)
 *   - Why split: Large dataset (7K samples), split for easier download
 *   - Extraction helper: extract-webui-dataset.mjs combines and extracts
 * 
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
    // Sanitize sampleId to prevent path traversal
    if (!sampleId || typeof sampleId !== 'string') {
      return null;
    }
    
    // Check both base path and train_split_web7k subdirectory
    const baseDir = existsSync(join(this.basePath, 'train_split_web7k'))
      ? join(this.basePath, 'train_split_web7k')
      : this.basePath;
    
    // Validate path to prevent traversal - join sampleId to baseDir and validate
    const sampleDirPath = join(baseDir, sampleId);
    const validatedPath = validatePath(sampleId, baseDir);
    if (!validatedPath) {
      console.warn(`Path traversal detected for sampleId: ${sampleId}`);
      return null;
    }
    
    const sampleDir = validatedPath;
    
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
        evaluationType: 'accessibility-tree', // Indicates this is for accessibility validation, not score validation
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
        },
        // Compatibility fields
        hasAccessibilityTree: !!axtreeData
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
    
    // Validate pagination parameters
    const pagination = validatePagination(limit, offset, 100000); // Max 100k samples
    if (!pagination.valid) {
      throw new Error(`Invalid pagination: ${pagination.error}`);
    }
    const validatedLimit = pagination.limit;
    const validatedOffset = pagination.offset;
    
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
    
    // Apply offset and limit (using validated values)
    const ids = sampleIds.slice(validatedOffset, validatedLimit ? validatedOffset + validatedLimit : undefined);
    
    const samples = [];
    const missing = [];
    for (const id of ids) {
      const sample = await this.loadSample(id);
      if (sample) {
        samples.push(sample);
      } else {
        missing.push(id);
      }
    }
    
    // Warn if samples are missing (but don't fail - partial results are useful)
    if (missing.length > 0) {
      console.warn(`⚠️  ${missing.length} WebUI samples could not be loaded: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '...' : ''}`);
      if (missing.length > ids.length * 0.1) {
        console.warn(`   ⚠️  Warning: More than 10% of requested samples are missing. Results may be incomplete.`);
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
  loadAnnotationSamples(limit = null, split = 'train') {
    // Validate limit
    if (limit !== null && (typeof limit !== 'number' || limit < 0 || !Number.isInteger(limit))) {
      throw new Error(`Invalid limit: must be non-negative integer or null, got ${limit}`);
    }
    
    const csvPath = join(this.basePath, 'screen_annotation', `${split}.csv`);
    if (!existsSync(csvPath)) {
      // Fallback to train.csv for backward compatibility
      const trainPath = join(this.basePath, 'screen_annotation', 'train.csv');
      if (!existsSync(trainPath)) {
        return [];
      }
      // Use train.csv if split file doesn't exist
      const csv = readFileSync(trainPath, 'utf-8');
      const lines = csv.split('\n').filter(l => l.trim());
      if (lines.length === 0) return [];
      // Parse header with proper quote handling (same as data lines)
      const headerLine = lines[0];
      const headers = this._parseCSVLine(headerLine);
      
    // Fix: Off-by-one bug - slice(1, maxLimit + 1) includes header in count
    // Should be: skip header (slice(1)), then take limit samples
    const maxLimit = limit ? Math.min(limit, 10000) : null;
    const dataLines = maxLimit ? lines.slice(1).slice(0, maxLimit) : lines.slice(1);
    
      return this._parseAnnotationCSV(dataLines, headers, split);
    }

    const csv = readFileSync(csvPath, 'utf-8');
    const lines = csv.split('\n').filter(l => l.trim());
    if (lines.length === 0) return [];
    // Parse header with proper quote handling (same as data lines)
    const headerLine = lines[0];
    const headers = this._parseCSVLine(headerLine);
    
    // Fix: Off-by-one bug - slice(1, maxLimit + 1) includes header in count
    // Should be: skip header (slice(1)), then take limit samples
    const maxLimit = limit ? Math.min(limit, 10000) : null;
    const dataLines = maxLimit ? lines.slice(1).slice(0, maxLimit) : lines.slice(1);
    
    return this._parseAnnotationCSV(dataLines, headers, split);
  }
  
  /**
   * Parse a single CSV line into values (handles quoted fields)
   * @private
   */
  _parseCSVLine(line) {
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
    
    return values;
  }
  
  /**
   * Parse CSV lines into annotation samples
   * @private
   */
  _parseAnnotationCSV(dataLines, headers, split = 'train') {
    // Parse CSV with proper handling of quoted fields
    return dataLines.map((line, index) => {
      // Use shared CSV parsing logic
      const values = this._parseCSVLine(line);
      
      // Warn if unclosed quotes detected (check by counting quotes)
      const quoteCount = (line.match(/"/g) || []).length;
      if (quoteCount % 2 !== 0) {
        console.warn(`⚠️  CSV line ${index + 1} has unclosed quotes - parsing may be incorrect`);
      }
      
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
          split: split,
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
  loadQASamples(limit = null, split = 'train') {
    const jsonPath = join(this.basePath, 'screen_qa', 'short_answers', `${split}.json`);
    if (!existsSync(jsonPath)) {
      // Fallback to train.json for backward compatibility
      const trainPath = join(this.basePath, 'screen_qa', 'short_answers', 'train.json');
      if (!existsSync(trainPath)) {
        return [];
      }
      const data = JSON.parse(readFileSync(trainPath, 'utf-8'));
      const samples = Array.isArray(data) ? data : (data.samples || []);
      const limited = limit ? samples.slice(0, limit) : samples;
      
      return this._parseQASamples(limited, split);
    }

    const data = JSON.parse(readFileSync(jsonPath, 'utf-8'));
    const samples = Array.isArray(data) ? data : (data.samples || []);
    const limited = limit ? samples.slice(0, limit) : samples;
    
    return this._parseQASamples(limited, split);
  }
  
  /**
   * Parse QA samples from JSON data
   * @private
   */
  _parseQASamples(limited, split = 'train') {
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
          split: split,
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
    const { limit = null, offset = 0, split = 'train' } = typeof options === 'number' 
      ? { limit: options } 
      : options;
    
    // Validate pagination parameters
    const pagination = validatePagination(limit, offset, 100000);
    if (!pagination.valid) {
      throw new Error(`Invalid pagination: ${pagination.error}`);
    }
    const validatedLimit = pagination.limit;
    const validatedOffset = pagination.offset;
    
    // Handle limit=0 explicitly (return empty array)
    if (validatedLimit === 0) {
      return [];
    }
    
    // Fix: Load enough samples to satisfy offset+limit, not just limit
    // This ensures pagination works correctly
    const totalNeeded = validatedLimit ? validatedOffset + validatedLimit : null;
    
    // Load annotation and QA samples proportionally
    // If we need 100 samples starting at offset 50, we need to load 150 total
    const annotation = this.loadAnnotationSamples(totalNeeded ? Math.floor(totalNeeded / 2) : null, split);
    const qa = this.loadQASamples(totalNeeded ? Math.ceil(totalNeeded / 2) : null, split);
    const all = [...annotation, ...qa];
    
    // Apply offset and limit to the combined array
    return all.slice(validatedOffset, validatedLimit ? validatedOffset + validatedLimit : undefined);
  }
  
  /**
   * Get total available sample count
   */
  getTotalCount() {
    // Performance fix: Count lines/files without loading all samples
    // This avoids loading potentially thousands of samples just to count them
    if (!this.isAvailable()) {
      return 0;
    }
    
    let annotationCount = 0;
    let qaCount = 0;
    
    // Count annotation samples by reading CSV file line count
    try {
      const csvPath = join(this.basePath, 'screen_annotation', 'train.csv');
      if (existsSync(csvPath)) {
        const csv = readFileSync(csvPath, 'utf-8');
        const lines = csv.split('\n').filter(l => l.trim());
        annotationCount = Math.max(0, lines.length - 1); // Subtract header
      }
    } catch {
      // If CSV read fails, fall back to loading (but this is slower)
      annotationCount = this.loadAnnotationSamples().length;
    }
    
    // Count QA samples by reading JSON file
    try {
      const jsonPath = join(this.basePath, 'screen_qa', 'short_answers', 'train.json');
      if (existsSync(jsonPath)) {
        const data = JSON.parse(readFileSync(jsonPath, 'utf-8'));
        qaCount = Array.isArray(data) ? data.length : (data.samples?.length || 0);
      }
    } catch {
      // If JSON read fails, fall back to loading (but this is slower)
      qaCount = this.loadQASamples().length;
    }
    
    return annotationCount + qaCount;
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
   * Prefers JSON file (testcases-actual.json) over HTML (testcases.json)
   */
  isAvailable() {
    return existsSync(join(this.basePath, 'testcases-actual.json')) ||
           existsSync(join(this.basePath, 'testcases.json'));
  }

  /**
   * Load WCAG test cases
   * Prefers JSON file (testcases-actual.json) over HTML (testcases.json)
   */
  loadSamples(options = {}) {
    const { limit = null, offset = 0 } = typeof options === 'number' 
      ? { limit: options } 
      : options;
    
    // Validate pagination parameters
    const pagination = validatePagination(limit, offset, 100000);
    if (!pagination.valid) {
      throw new Error(`Invalid pagination: ${pagination.error}`);
    }
    const validatedLimit = pagination.limit;
    const validatedOffset = pagination.offset;
    
    // Handle limit=0 explicitly (return empty array)
    if (validatedLimit === 0) {
      return [];
    }
    
    // Prefer JSON file (downloaded from W3C)
    const jsonPath = join(this.basePath, 'testcases-actual.json');
    if (existsSync(jsonPath)) {
      return this.parseJSONTestCases(jsonPath, validatedLimit, validatedOffset);
    }
    
    // Fallback to HTML file
    const htmlPath = join(this.basePath, 'testcases.json');
    if (!existsSync(htmlPath)) {
      return [];
    }

    // Check if it's actually HTML (W3C downloads HTML, not JSON)
    const content = readFileSync(htmlPath, 'utf-8');
    
    if (content.trim().startsWith('<!DOCTYPE') || content.trim().startsWith('<html')) {
      // Parse HTML to extract test cases
      return this.parseHTMLTestCases(content, validatedLimit, validatedOffset);
    } else {
      // Try to parse as JSON (legacy support)
      try {
        const data = JSON.parse(content);
        // Fix: Use validated pagination values
        return Array.isArray(data) ? data.slice(validatedOffset, validatedLimit ? validatedOffset + validatedLimit : undefined) : [];
      } catch {
        return [];
      }
    }
  }
  
  /**
   * Parse WCAG test cases from JSON file (preferred method)
   */
  parseJSONTestCases(jsonPath, limit = null, offset = 0) {
    // Validate pagination
    const pagination = validatePagination(limit, offset, 100000);
    if (!pagination.valid) {
      throw new Error(`Invalid pagination: ${pagination.error}`);
    }
    
    try {
      const data = JSON.parse(readFileSync(jsonPath, 'utf-8'));
      const testCases = [];
      
      if (data.testcases && Array.isArray(data.testcases)) {
        const withOffset = data.testcases.slice(pagination.offset);
        const limited = pagination.limit ? withOffset.slice(0, pagination.limit) : withOffset;
        
        limited.forEach((tc, index) => {
          testCases.push({
            id: tc.id || `wcag-${tc.ruleId || index}`,
            screenshot: null, // WCAG test cases don't have screenshots
            url: tc.url || `https://www.w3.org/WAI/standards-guidelines/act/rules/${tc.ruleId}/testcases/${tc.id}`,
            groundTruth: {
              structuredFeatures: {
                wcag: {
                  ruleId: tc.ruleId,
                  ruleName: tc.ruleName,
                  testCaseId: tc.id,
                  description: tc.description,
                  expectedOutcome: tc.expectedOutcome,
                  testCaseType: tc.testCaseType,
                  accessibilityRequirements: tc.ruleAccessibilityRequirements || {},
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
              source: data.website || 'W3C WCAG ACT Rules',
              originalFormat: 'w3c-json',
              license: data.license
            }
          });
        });
      }
      
      return testCases;
    } catch (error) {
      console.warn(`Failed to parse WCAG JSON file: ${error.message}`);
      return [];
    }
  }

  /**
   * Parse test cases from HTML
   */
  parseHTMLTestCases(html, limit = null, offset = 0) {
    // Validate pagination
    const pagination = validatePagination(limit, offset, 100000);
    if (!pagination.valid) {
      throw new Error(`Invalid pagination: ${pagination.error}`);
    }
    // Extract test case links/IDs from HTML
    // W3C format: Links like testcases/97a4e1/a4cc71b0434f71f4ea0069c409f73e0207dfb403.html
    // or href="/WAI/standards-guidelines/act/report/testcases/..."
    const testCasePatterns = [
      /testcases\/([a-f0-9]+\/[a-f0-9]+\.html)/gi,  // testcases/97a4e1/a4cc71b0434f71f4ea0069c409f73e0207dfb403.html
      /\/WAI\/standards-guidelines\/act\/report\/testcases\/([^"'\s]+)/gi,  // Full URL path
      /testcase[_-]?id["']?\s*[:=]\s*["']([^"']+)["']/gi  // testcase-id: "..." or testcase_id="..."
    ];
    
    const allIds = new Set();
    for (const pattern of testCasePatterns) {
      const matches = [...html.matchAll(pattern)];
      for (const match of matches) {
        const id = match[1] || match[0];
        if (id && id.length > 5 && !id.includes('testcases.json')) {
          // Clean up the ID (remove .html, extract just the hash part)
          const cleanId = id.replace(/\.html$/, '').split('/').pop();
          if (cleanId && cleanId.length > 10) {
            allIds.add(cleanId);
          }
        }
      }
    }
    
    const uniqueIds = Array.from(allIds);
    // Fix: Use validated pagination values
    const validatedLimit = pagination.limit;
    const validatedOffset = pagination.offset;
    const withOffset = uniqueIds.slice(validatedOffset);
    const limited = validatedLimit ? withOffset.slice(0, validatedLimit) : withOffset;
    
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
    
    return all;
  }
  
  /**
   * Get total available sample count
   */
  getTotalCount() {
    if (!this.isAvailable()) {
      return 0;
    }
    
    // Prefer JSON file
    const jsonPath = join(this.basePath, 'testcases-actual.json');
    if (existsSync(jsonPath)) {
      try {
        const data = JSON.parse(readFileSync(jsonPath, 'utf-8'));
        return data.count || (data.testcases?.length || 0);
      } catch {
        // Fall through to HTML
      }
    }
    
    // Fallback to HTML
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
    
    // Validate pagination parameters
    const pagination = validatePagination(limit, offset, 100000);
    if (!pagination.valid) {
      throw new Error(`Invalid pagination: ${pagination.error}`);
    }
    const validatedLimit = pagination.limit;
    const validatedOffset = pagination.offset;
    
    // Handle limit=0 explicitly (return empty array)
    if (validatedLimit === 0) {
      return [];
    }
    
    // Prefer hand-crafted JSON if it exists (trustworthy, manually curated)
    if (existsSync(this.jsonPath)) {
      try {
        const data = JSON.parse(readFileSync(this.jsonPath, 'utf-8'));
        const samples = data.samples || [];
        // Fix: Use validatedOffset and validatedLimit instead of raw offset/limit
        const limited = samples.slice(validatedOffset, validatedLimit ? validatedOffset + validatedLimit : undefined);
        
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
    
    // Fix: Use validated pagination values
    return allSamples.slice(validatedOffset, validatedLimit ? validatedOffset + validatedLimit : undefined);
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
 * MultiUI Dataset Adapter
 * 
 * Source: HuggingFace - neulab/MultiUI
 * Paper: arXiv:2410.13824
 * Size: 7.3M samples from 1M websites
 * 
 * Format: JSON with screenshots and multimodal instructions
 */
export class MultiUIAdapter {
  constructor(basePath) {
    this.basePath = basePath || join(
      process.cwd(),
      'evaluation',
      'datasets',
      'research',
      'multiui'
    );
  }

  isAvailable() {
    return existsSync(this.basePath) && 
           (existsSync(join(this.basePath, 'dataset_info.json')) ||
            existsSync(join(this.basePath, 'train')) ||
            existsSync(join(this.basePath, 'data')));
  }

  async loadSample(sampleId) {
    // MultiUI format: Need to check actual structure after download
    // This is a placeholder - will be updated after dataset is downloaded
    throw new Error('MultiUIAdapter not yet implemented - dataset structure needs inspection');
  }

  async loadSamples(options = {}) {
    const { limit = null, offset = 0 } = options;
    
    if (!this.isAvailable()) {
      return { samples: [], loaded: 0, totalAvailable: 0 };
    }
    
    // TODO: Implement after downloading and inspecting dataset structure
    return { samples: [], loaded: 0, totalAvailable: 0 };
  }

  getTotalCount() {
    // TODO: Implement after downloading
    return 0;
  }
}


/**
 * GUIOdyssey Dataset Adapter
 * 
 * Source: HuggingFace - hflqf88888/GUIOdyssey
 * Paper: arXiv:2406.08451
 * Size: 8,334 episodes, 15.3 steps/episode average
 * 
 * Format: Cross-app navigation with temporal sequences
 */
export class GUIOdysseyAdapter {
  constructor(basePath) {
    this.basePath = basePath || join(
      process.cwd(),
      'evaluation',
      'datasets',
      'research',
      'guiodyssey'
    );
  }

  isAvailable() {
    return existsSync(this.basePath) && 
           (existsSync(join(this.basePath, 'dataset_info.json')) ||
            existsSync(join(this.basePath, 'train')) ||
            existsSync(join(this.basePath, 'data')));
  }

  async loadSample(sampleId) {
    // GUIOdyssey format: Need to check actual structure after download
    // This is a placeholder - will be updated after dataset is downloaded
    throw new Error('GUIOdysseyAdapter not yet implemented - dataset structure needs inspection');
  }

  async loadSamples(options = {}) {
    const { limit = null, offset = 0 } = options;
    
    if (!this.isAvailable()) {
      return { samples: [], loaded: 0, totalAvailable: 0 };
    }
    
    // TODO: Implement after downloading and inspecting dataset structure
    return { samples: [], loaded: 0, totalAvailable: 0 };
  }

  getTotalCount() {
    // TODO: Implement after downloading
    return 0;
  }
}

/**
 * AutomotiveUI-Bench-4K Dataset Adapter
 * 
 * Source: HuggingFace - sparks-solutions/AutomotiveUI-Bench-4K
 * Paper: arXiv:2505.05895
 * Size: 998 images, 4,208 annotations
 * 
 * Format: Automotive UI understanding with visual grounding
 */
export class AutomotiveUIAdapter {
  constructor(basePath) {
    this.basePath = basePath || join(
      process.cwd(),
      'evaluation',
      'datasets',
      'research',
      'automotiveui-bench-4k'
    );
  }

  isAvailable() {
    return existsSync(this.basePath) && 
           (existsSync(join(this.basePath, 'dataset_info.json')) ||
            existsSync(join(this.basePath, 'train')) ||
            existsSync(join(this.basePath, 'data')));
  }

  async loadSample(sampleId) {
    // AutomotiveUI format: Need to check actual structure after download
    throw new Error('AutomotiveUIAdapter not yet implemented - dataset structure needs inspection');
  }

  async loadSamples(options = {}) {
    const { limit = null, offset = 0 } = options;
    
    if (!this.isAvailable()) {
      return { samples: [], loaded: 0, totalAvailable: 0 };
    }
    
    // TODO: Implement after downloading and inspecting dataset structure
    return { samples: [], loaded: 0, totalAvailable: 0 };
  }

  getTotalCount() {
    // TODO: Implement after downloading
    return 0;
  }
}

/**
 * Dataset Adapter Registry
 * Maps dataset names to adapters
 * 
 * NOTE: Must be defined after all adapter classes are declared
 */
export const DATASET_ADAPTERS = {
  'webui': WebUIAdapter,
  'webui-7k': WebUIAdapter,
  'screenai': ScreenAIAdapter,
  'wcag': WCAGAdapter,
  'wcag-test-cases': WCAGAdapter,
  'real': RealDatasetAdapter,
  'real-dataset': RealDatasetAdapter,
  'multiui': MultiUIAdapter,
  'multiui-dataset': MultiUIAdapter,
  'guiodyssey': GUIOdysseyAdapter,
  'gui-odyssey': GUIOdysseyAdapter,
  'automotiveui': AutomotiveUIAdapter,
  'automotiveui-bench-4k': AutomotiveUIAdapter,
};

export async function loadDataset(datasetName, options = {}) {
  const { basePath = null, ...loadOptions } = typeof options === 'number' 
    ? { limit: options }  // Backward compat: loadDataset('webui', 100)
    : options;
  
  // Handle limit=0 explicitly (return empty result)
  if (loadOptions.limit === 0) {
    return {
      name: datasetName,
      samples: [],
      loaded: 0,
      totalAvailable: 0,
      adapter: null,
      options: loadOptions
    };
  }
  
  // Check if it's a file path (contains / or ends with .json)
  const isFilePath = datasetName.includes('/') || datasetName.includes('\\') || datasetName.endsWith('.json');
  
  if (isFilePath) {
    // Try to load as JSON file
    const { readFileSync, existsSync } = await import('fs');
    const { join } = await import('path');
    
    // Resolve and validate path to prevent traversal attacks
    const baseDir = join(process.cwd(), 'evaluation', 'datasets');
    let filePath;
    
    if (datasetName.includes('/') || datasetName.includes('\\')) {
      // User provided a path - validate it's within allowed directory
      const validated = validatePath(datasetName, baseDir);
      if (!validated) {
        throw new Error(`Invalid file path: path traversal detected or path outside allowed directory`);
      }
      filePath = validated;
    } else {
      // Simple filename - safe to join
      filePath = join(baseDir, datasetName);
    }
    
    if (!existsSync(filePath)) {
      throw new Error(`Dataset file not found: ${filePath}`);
    }
    
    try {
      const data = JSON.parse(readFileSync(filePath, 'utf-8'));
      // Validate pagination
      const pagination = validatePagination(loadOptions.limit, loadOptions.offset || 0, 100000);
      if (!pagination.valid) {
        throw new Error(`Invalid pagination: ${pagination.error}`);
      }
      
      const samples = (data.samples || []).slice(
        pagination.offset, 
        pagination.limit ? pagination.offset + pagination.limit : undefined
      );
      
      return {
        adapter: null, // File-based, not adapter
        samples,
        loaded: samples.length,
        totalAvailable: data.samples?.length || 0,
        name: data.name,
        source: data.source,
        options: loadOptions
      };
    } catch (error) {
      throw new Error(`Failed to load dataset file ${filePath}: ${error.message}`);
    }
  }
  
  // Try adapter lookup
  const AdapterClass = DATASET_ADAPTERS[datasetName.toLowerCase()];
  if (!AdapterClass) {
    throw new Error(`Unknown dataset: ${datasetName}. Available adapters: ${Object.keys(DATASET_ADAPTERS).join(', ')}, or provide file path`);
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

