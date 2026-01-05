#!/usr/bin/env node
/**
 * Comprehensive WebUI Evaluation
 * 
 * Runs multiple evaluation methods on WebUI dataset and compares results.
 */

import { loadEnv } from '../../src/load-env.mjs';

// Auto-load .env for API keys
loadEnv();

import { loadWebUIDataset, getRandomWebUISamples } from '../utils/load-webui-dataset.mjs';
import { validateScreenshot } from '../../src/index.mjs';
import { createConfig } from '../../src/config.mjs';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Run comprehensive evaluation
 */
async function runComprehensiveEvaluation(options = {}) {
  const {
    limit = 20,
    provider = null
  } = options;
  
  console.log('🚀 Comprehensive WebUI Evaluation\n');
  
  const config = createConfig({ provider });
  if (!config.enabled) {
    console.error('❌ VLLM validation is disabled. Set GEMINI_API_KEY or OPENAI_API_KEY');
    process.exit(1);
  }
  
  console.log(`✅ Using provider: ${config.provider}`);
  console.log(`📊 Sample limit: ${limit}\n`);
  
  // Load dataset
  const dataset = await loadWebUIDataset({ limit: null, cache: true });
  if (!dataset || !dataset.samples || dataset.samples.length === 0) {
    console.error('❌ No samples available. Run: node evaluation/utils/convert-webui-dataset.mjs first');
    process.exit(1);
  }
  
  const samples = getRandomWebUISamples(dataset, limit);
  console.log(`📊 Evaluating ${samples.length} random samples\n`);
  
  // Different evaluation prompts
  const prompts = {
    general: 'Evaluate this webpage screenshot for overall quality, design, and usability. Provide a score 0-10.',
    accessibility: 'Evaluate this webpage screenshot for WCAG accessibility compliance. Check color contrast, keyboard navigation, screen reader support. Provide a score 0-10.',
    design: 'Evaluate this webpage screenshot for visual design quality, layout, typography, and aesthetics. Provide a score 0-10.',
    usability: 'Evaluate this webpage screenshot for usability, clarity, and user experience. Provide a score 0-10.'
  };
  
  const results = {
    timestamp: new Date().toISOString(),
    dataset: dataset.name,
    provider: config.provider,
    totalSamples: samples.length,
    methods: {}
  };
  
  // Evaluate with each prompt
  for (const [methodName, prompt] of Object.entries(prompts)) {
    console.log(`📊 Method: ${methodName}`);
    const methodResults = [];
    
    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      process.stdout.write(`  [${i + 1}/${samples.length}] ${sample.id}... `);
      
      try {
        const result = await validateScreenshot(
          sample.screenshot,
          prompt,
          {
            provider: config.provider,
            apiKey: config.apiKey,
            testType: methodName,
            viewport: sample.viewport
          }
        );
        
        methodResults.push({
          sampleId: sample.id,
          url: sample.url,
          score: result.score,
          reasoning: result.reasoning,
          issues: result.issues || []
        });
        
        console.log(`✅ ${result.score}/10`);
      } catch (error) {
        methodResults.push({
          sampleId: sample.id,
          url: sample.url,
          error: error.message
        });
        console.log(`❌ Error`);
      }
    }
    
    const scores = methodResults
      .filter(r => r.score !== undefined)
      .map(r => r.score);
    
    results.methods[methodName] = {
      total: methodResults.length,
      success: scores.length,
      averageScore: scores.length > 0 
        ? scores.reduce((a, b) => a + b, 0) / scores.length 
        : 0,
      results: methodResults
    };
    
    console.log(`   Average: ${results.methods[methodName].averageScore.toFixed(2)}/10\n`);
  }
  
  // Compare methods
  console.log('📊 Method Comparison:\n');
  Object.entries(results.methods).forEach(([method, data]) => {
    console.log(`  ${method}: ${data.averageScore.toFixed(2)}/10 (${data.success}/${data.total} successful)`);
  });
  
  // Save results
  const resultsDir = join(process.cwd(), 'evaluation', 'results');
  mkdirSync(resultsDir, { recursive: true });
  const resultsFile = join(resultsDir, `comprehensive-webui-${Date.now()}.json`);
  writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  
  console.log(`\n💾 Results saved: ${resultsFile}`);
  
  return results;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const limit = parseInt(process.argv[2]) || 20;
  const provider = process.argv[3] || null;
  runComprehensiveEvaluation({ limit, provider }).catch(console.error);
}

export { runComprehensiveEvaluation };

