#!/usr/bin/env node
/**
 * Dataset Converter
 * 
 * Converts external dataset formats to our ground truth format.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Convert WebUI dataset format to our format
 */
function convertWebUIDataset(webuiData) {
  // WebUI format: { screenshots, accessibility_trees, layouts, computed_styles }
  // Our format: { samples: [{ id, screenshot, groundTruth: { humanAnnotations: {...} } }] }
  
  const samples = [];
  
  // Convert each WebUI sample
  for (const item of webuiData) {
    const sample = {
      id: item.id || `webui-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: item.url || 'WebUI Sample',
      url: item.url,
      category: 'web-ui',
      screenshot: item.screenshot_path,
      groundTruth: {
        // WebUI has accessibility trees - these are human-verified structures
        humanAnnotations: {
          accessibilityTree: item.accessibility_tree,
          layouts: item.layouts,
          computedStyles: item.computed_styles,
          // These are structural annotations, not scores
          annotatorId: 'webui-dataset',
          timestamp: item.timestamp || new Date().toISOString()
        },
        annotations: {
          accessibility: 'annotated', // Has accessibility tree
          layout: 'annotated', // Has layout info
          styles: 'annotated' // Has computed styles
        }
      },
      metadata: {
        dataset: 'WebUI',
        source: 'https://github.com/js0nwu/webui',
        originalFormat: 'webui'
      }
    };
    
    samples.push(sample);
  }
  
  return { samples };
}

/**
 * Convert Tabular Accessibility dataset
 */
function convertTabularAccessibilityDataset(tabularData) {
  // Tabular format: { url, violations, wcag_level, ground_truth }
  // Our format: { samples: [{ groundTruth: { humanAnnotations: { humanIssues, ... } } }] }
  
  const samples = [];
  
  for (const item of tabularData) {
    const sample = {
      id: item.id || `tabular-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: item.url || 'Tabular Sample',
      url: item.url,
      category: 'accessibility',
      screenshot: item.screenshot_path,
      groundTruth: {
        humanAnnotations: {
          humanScore: item.ground_truth?.score || null,
          humanIssues: item.violations || [],
          humanReasoning: item.ground_truth?.reasoning || null,
          annotatorId: 'tabular-dataset',
          timestamp: item.timestamp || new Date().toISOString()
        },
        annotations: {
          wcagLevel: item.wcag_level,
          violations: item.violations,
          accessibility: 'annotated'
        }
      },
      metadata: {
        dataset: 'Tabular Accessibility',
        source: 'MDPI Data 2024',
        originalFormat: 'tabular'
      }
    };
    
    samples.push(sample);
  }
  
  return { samples };
}

/**
 * Convert WCAG test cases
 */
function convertWCAGTestCases(wcagData) {
  // WCAG format: { test_case, expected_outcome, rule_id, wcag_level }
  // Our format: { samples: [{ groundTruth: { expectedScore, knownGood/Bad } }] }
  
  const samples = [];
  
  for (const item of wcagData) {
    const sample = {
      id: item.id || `wcag-${item.rule_id || 'test'}-${Date.now()}`,
      name: item.test_case?.name || 'WCAG Test Case',
      url: item.test_case?.url,
      category: 'wcag-test',
      screenshot: item.screenshot_path,
      groundTruth: {
        // WCAG test cases have known outcomes (pass/fail)
        expectedScore: item.expected_outcome === 'passed' ? { min: 7, max: 10 } : { min: 0, max: 3 },
        expectedIssues: item.expected_outcome === 'failed' ? [item.rule_id] : [],
        knownGood: item.expected_outcome === 'passed' ? ['WCAG compliant'] : [],
        knownBad: item.expected_outcome === 'failed' ? [`WCAG violation: ${item.rule_id}`] : [],
        annotations: {
          wcagLevel: item.wcag_level,
          ruleId: item.rule_id,
          expectedOutcome: item.expected_outcome,
          accessibility: item.expected_outcome === 'passed' ? 'good' : 'bad'
        },
        // These are ground truth, not human annotations
        humanAnnotations: {
          humanScore: item.expected_outcome === 'passed' ? 8 : 2, // Ground truth score
          humanIssues: item.expected_outcome === 'failed' ? [item.rule_id] : [],
          humanReasoning: `WCAG test case: expected ${item.expected_outcome}`,
          annotatorId: 'w3c-wcag',
          timestamp: new Date().toISOString()
        }
      },
      metadata: {
        dataset: 'WCAG Test Cases',
        source: 'W3C',
        originalFormat: 'wcag-test-case'
      }
    };
    
    samples.push(sample);
  }
  
  return { samples };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const datasetType = process.argv[2];
  const inputPath = process.argv[3];
  const outputPath = process.argv[4] || join(process.cwd(), 'evaluation', 'datasets', 'human-annotated', datasetType, 'converted-dataset.json');
  
  if (!datasetType || !inputPath) {
    console.log('Usage: node convert-dataset.mjs <type> <input> [output]');
    console.log('Types: webui, tabular, wcag');
    process.exit(1);
  }
  
  const inputData = JSON.parse(readFileSync(inputPath, 'utf-8'));
  
  let converted;
  if (datasetType === 'webui') {
    converted = convertWebUIDataset(inputData);
  } else if (datasetType === 'tabular') {
    converted = convertTabularAccessibilityDataset(inputData);
  } else if (datasetType === 'wcag') {
    converted = convertWCAGTestCases(inputData);
  } else {
    console.error(`Unknown dataset type: ${datasetType}`);
    process.exit(1);
  }
  
  writeFileSync(outputPath, JSON.stringify(converted, null, 2));
  console.log(`✅ Converted ${converted.samples.length} samples`);
  console.log(`   Saved: ${outputPath}`);
}
