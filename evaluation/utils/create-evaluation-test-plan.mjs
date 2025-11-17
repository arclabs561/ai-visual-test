#!/usr/bin/env node
/**
 * Create Evaluation Test Plan
 * 
 * Generates a comprehensive test plan mapping all 33 capabilities
 * to specific test files and evaluation scripts.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const TEST_DIR = join(process.cwd(), 'evaluation', 'test');
const RUNNERS_DIR = join(process.cwd(), 'evaluation', 'runners');
const RESULTS_DIR = join(process.cwd(), 'evaluation', 'results');

/**
 * All 33 capabilities
 */
const CAPABILITIES = [
  // Core Validation (4)
  { id: 1, name: 'Semantic Screenshot Validation', category: 'Core Validation' },
  { id: 2, name: 'Multi-Provider Support', category: 'Core Validation' },
  { id: 3, name: 'Score Extraction', category: 'Core Validation' },
  { id: 4, name: 'Issue Detection', category: 'Core Validation' },
  
  // High-Frequency Features (4)
  { id: 5, name: 'Temporal Decision Making', category: 'High-Frequency' },
  { id: 6, name: 'Latency-Aware Batching', category: 'High-Frequency' },
  { id: 7, name: 'Activity-Based Preprocessing', category: 'High-Frequency' },
  { id: 8, name: 'Model Tier Selection', category: 'High-Frequency' },
  
  // Temporal & Sequence (4)
  { id: 9, name: 'Temporal Aggregation', category: 'Temporal & Sequence' },
  { id: 10, name: 'Temporal Graph Building', category: 'Temporal & Sequence' },
  { id: 11, name: 'Screenshot Selection', category: 'Temporal & Sequence' },
  { id: 12, name: 'Coherence Analysis', category: 'Temporal & Sequence' },
  
  // Multi-Modal (3)
  { id: 13, name: 'Multi-Modal Validation', category: 'Multi-Modal' },
  { id: 14, name: 'Cross-Modal Consistency', category: 'Multi-Modal' },
  { id: 15, name: 'Rendered Code Extraction', category: 'Multi-Modal' },
  
  // Persona & Experience (3)
  { id: 16, name: 'Persona-Based Testing', category: 'Persona & Experience' },
  { id: 17, name: 'Experience Tracing', category: 'Persona & Experience' },
  { id: 18, name: 'Experience Propagation', category: 'Persona & Experience' },
  
  // Game Testing (4)
  { id: 19, name: 'Game Playing', category: 'Game Testing' },
  { id: 20, name: 'Variable Goals', category: 'Game Testing' },
  { id: 21, name: 'State Extraction', category: 'Game Testing' },
  { id: 22, name: 'Game Goal Prompts', category: 'Game Testing' },
  
  // Accessibility (3)
  { id: 23, name: 'Hybrid Accessibility', category: 'Accessibility' },
  { id: 24, name: 'WCAG Compliance', category: 'Accessibility' },
  { id: 25, name: 'Accessibility Tree Validation', category: 'Accessibility' },
  
  // Advanced Features (8)
  { id: 26, name: 'Ensemble Judging', category: 'Advanced Features' },
  { id: 27, name: 'Uncertainty Reduction', category: 'Advanced Features' },
  { id: 28, name: 'Bias Detection & Mitigation', category: 'Advanced Features' },
  { id: 29, name: 'Hallucination Detection', category: 'Advanced Features' },
  { id: 30, name: 'Calibration Tracking', category: 'Advanced Features' },
  { id: 31, name: 'Counterfactual Testing', category: 'Advanced Features' },
  { id: 32, name: 'Capability Stratification', category: 'Advanced Features' },
  { id: 33, name: 'Baseline Validation', category: 'Advanced Features' }
];

/**
 * Map capabilities to test files
 */
function mapCapabilitiesToTests() {
  const testFiles = existsSync(TEST_DIR) 
    ? readdirSync(TEST_DIR).filter(f => f.endsWith('.mjs'))
    : [];

  const runnerFiles = existsSync(RUNNERS_DIR)
    ? readdirSync(RUNNERS_DIR).filter(f => f.endsWith('.mjs'))
    : [];

  const mapping = {};

  // Map based on file names and common patterns
  testFiles.forEach(file => {
    const filePath = join(TEST_DIR, file);
    const content = readFileSync(filePath, 'utf8');
    
    // Extract capability keywords from file content
    const matchedCapabilities = [];
    
    CAPABILITIES.forEach(cap => {
      const keywords = cap.name.toLowerCase().split(/\s+/);
      const hasKeywords = keywords.some(kw => 
        content.toLowerCase().includes(kw) || 
        file.toLowerCase().includes(kw)
      );
      
      if (hasKeywords) {
        matchedCapabilities.push(cap.id);
      }
    });

    if (matchedCapabilities.length > 0) {
      mapping[file] = {
        path: filePath,
        capabilities: matchedCapabilities,
        type: 'test'
      };
    }
  });

  // Map runners
  runnerFiles.forEach(file => {
    const filePath = join(RUNNERS_DIR, file);
    const content = readFileSync(filePath, 'utf8');
    
    const matchedCapabilities = [];
    
    CAPABILITIES.forEach(cap => {
      const keywords = cap.name.toLowerCase().split(/\s+/);
      const hasKeywords = keywords.some(kw => 
        content.toLowerCase().includes(kw) || 
        file.toLowerCase().includes(kw)
      );
      
      if (hasKeywords) {
        matchedCapabilities.push(cap.id);
      }
    });

    if (matchedCapabilities.length > 0) {
      mapping[file] = {
        path: filePath,
        capabilities: matchedCapabilities,
        type: 'runner'
      };
    }
  });

  return mapping;
}

/**
 * Generate test plan
 */
function generateTestPlan() {
  const testMapping = mapCapabilitiesToTests();
  
  const plan = {
    timestamp: new Date().toISOString(),
    totalCapabilities: CAPABILITIES.length,
    capabilities: CAPABILITIES.map(cap => {
      const tests = Object.entries(testMapping)
        .filter(([file, info]) => info.capabilities.includes(cap.id))
        .map(([file, info]) => ({
          file,
          path: info.path,
          type: info.type
        }));

      return {
        ...cap,
        testFiles: tests,
        testCount: tests.length,
        hasTests: tests.length > 0
      };
    }),
    testFiles: Object.entries(testMapping).map(([file, info]) => ({
      file,
      path: info.path,
      type: info.type,
      capabilities: info.capabilities.map(id => 
        CAPABILITIES.find(c => c.id === id)?.name
      )
    })),
    statistics: {
      capabilitiesWithTests: CAPABILITIES.filter(cap => {
        const tests = Object.entries(testMapping)
          .filter(([file, info]) => info.capabilities.includes(cap.id));
        return tests.length > 0;
      }).length,
      capabilitiesWithoutTests: CAPABILITIES.filter(cap => {
        const tests = Object.entries(testMapping)
          .filter(([file, info]) => info.capabilities.includes(cap.id));
        return tests.length === 0;
      }).length,
      totalTestFiles: Object.keys(testMapping).length
    }
  };

  return plan;
}

/**
 * Print test plan
 */
function printTestPlan(plan) {
  console.log('📋 Evaluation Test Plan');
  console.log('='.repeat(70));
  console.log();
  console.log('📈 Statistics:');
  console.log(`   Total Capabilities: ${plan.totalCapabilities}`);
  console.log(`   Capabilities with Tests: ${plan.statistics.capabilitiesWithTests}`);
  console.log(`   Capabilities without Tests: ${plan.statistics.capabilitiesWithoutTests}`);
  console.log(`   Total Test Files: ${plan.statistics.totalTestFiles}`);
  console.log();

  // Group by category
  const byCategory = {};
  plan.capabilities.forEach(cap => {
    if (!byCategory[cap.category]) {
      byCategory[cap.category] = [];
    }
    byCategory[cap.category].push(cap);
  });

  console.log('📋 Capabilities by Category:');
  console.log('-'.repeat(70));
  for (const [category, caps] of Object.entries(byCategory)) {
    console.log(`\n${category}:`);
    caps.forEach(cap => {
      const icon = cap.hasTests ? '✅' : '⏳';
      console.log(`   ${icon} [${cap.id}] ${cap.name}`);
      if (cap.testFiles.length > 0) {
        cap.testFiles.forEach(test => {
          console.log(`      - ${test.file} (${test.type})`);
        });
      }
    });
  }

  console.log();
  console.log('📁 Test Files:');
  console.log('-'.repeat(70));
  plan.testFiles.forEach(test => {
    console.log(`   ${test.file} (${test.type})`);
    console.log(`      Capabilities: ${test.capabilities.join(', ')}`);
    console.log();
  });
}

/**
 * Main function
 */
async function main() {
  const plan = generateTestPlan();
  const planPath = join(RESULTS_DIR, 'evaluation-test-plan.json');
  
  writeFileSync(planPath, JSON.stringify(plan, null, 2));
  
  printTestPlan(plan);
  
  console.log(`✅ Test plan saved: ${planPath}`);
  console.log();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { generateTestPlan, printTestPlan };

