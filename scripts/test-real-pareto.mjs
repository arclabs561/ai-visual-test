/**
 * Real Pareto Frontier Test
 * 
 * Tests actual API calls with real images to measure speed/quality tradeoff
 */

import { createConfig } from '../src/config.mjs';
import { VLLMJudge } from '../src/judge.mjs';
import { selectModelTier } from '../src/model-tier-selector.mjs';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load real dataset
const DATASET_FILE = join(__dirname, '..', 'evaluation', 'datasets', 'real-dataset.json');
const SCREENSHOTS_DIR = join(__dirname, '..', 'evaluation', 'datasets', 'screenshots');

let realDataset = null;
try {
  const datasetContent = readFileSync(DATASET_FILE, 'utf-8');
  realDataset = JSON.parse(datasetContent);
} catch (error) {
  console.error(`Failed to load dataset: ${error.message}`);
  process.exit(1);
}

// Use real screenshots from dataset
const realSamples = realDataset.samples || [];
if (realSamples.length === 0) {
  console.error('No samples found in dataset');
  process.exit(1);
}

// Test with multiple real screenshots for comprehensive analysis
// Use first sample as primary, but can iterate through all
const firstSample = realSamples[0];
const TEST_IMAGE_PATH = firstSample.screenshot || join(SCREENSHOTS_DIR, `${firstSample.id}.png`);

// Also prepare to test with other samples
const otherSamples = realSamples.slice(1);

if (!existsSync(TEST_IMAGE_PATH)) {
  console.error(`Screenshot not found: ${TEST_IMAGE_PATH}`);
  process.exit(1);
}

const TEST_PROMPT = `Evaluate this webpage screenshot for accessibility, design quality, and user experience. 
This is a screenshot of ${firstSample.name} (${firstSample.url}).
Provide a brief assessment of what you see.`;

const TEST_CONFIGS = [
  { provider: 'gemini', tier: 'fast', context: { frequency: 'high' } },
  { provider: 'gemini', tier: 'balanced', context: {} },
  { provider: 'gemini', tier: 'best', context: { criticality: 'critical' } },
  { provider: 'openai', tier: 'fast', context: { frequency: 'high' } },
  { provider: 'openai', tier: 'balanced', context: {} },
  { provider: 'openai', tier: 'best', context: { criticality: 'critical' } },
  { provider: 'claude', tier: 'fast', context: { frequency: 'high' } },
  { provider: 'claude', tier: 'balanced', context: {} },
  { provider: 'claude', tier: 'best', context: { criticality: 'critical' } },
  { provider: 'groq', tier: 'fast', context: { frequency: 'high' } },
  { provider: 'groq', tier: 'balanced', context: {} },
  { provider: 'groq', tier: 'best', context: { criticality: 'critical' } },
];

const results = [];

async function testModel(config) {
  const { provider, tier, context } = config;
  
  try {
    const judgeConfig = createConfig({ provider, modelTier: tier });
    
    if (!judgeConfig.enabled || !judgeConfig.apiKey) {
      return { provider, tier, error: 'No API key', skipped: true };
    }
    
    const model = judgeConfig.providerConfig.model;
    console.log(`Testing ${provider} ${tier} (${model})...`);
    
    const judge = new VLLMJudge({ provider, modelTier: tier, verbose: false });
    
    const startTime = Date.now();
    const result = await judge.judgeScreenshot(TEST_IMAGE_PATH, TEST_PROMPT, {
      testType: `pareto-${provider}-${tier}`,
      ...context
    });
    const latency = Date.now() - startTime;
    
    if (!result.enabled || result.error) {
      return { provider, tier, model, error: result.error || 'API disabled', latency };
    }
    
    const judgment = result.judgment || '';
    const responseLength = judgment.length;
    const cost = result.estimatedCost ? parseFloat(result.estimatedCost.totalCost) : null;
    const inputTokens = result.estimatedCost?.inputTokens || 0;
    const outputTokens = result.estimatedCost?.outputTokens || 0;
    
    return {
      provider,
      tier,
      model,
      latency,
      enabled: true,
      responseLength,
      cost,
      inputTokens,
      outputTokens,
      judgment: judgment.substring(0, 150),
      score: result.score
    };
  } catch (error) {
    return {
      provider,
      tier,
      error: error.message,
      latency: null
    };
  }
}

async function runTests() {
  console.log('\n🔬 Real Pareto Frontier Test (Using Real Dataset Images)\n');
  console.log('=' .repeat(80));
  console.log(`Dataset: ${realDataset.name}`);
  console.log(`Test image: ${firstSample.name} (${TEST_IMAGE_PATH})`);
  console.log(`Source URL: ${firstSample.url}`);
  console.log(`Test prompt: "${TEST_PROMPT.substring(0, 100)}..."\n`);
  
  for (const config of TEST_CONFIGS) {
    const result = await testModel(config);
    results.push(result);
    
    if (result.skipped) {
      console.log(`  ⏭️  ${config.provider} ${config.tier}: Skipped`);
    } else if (result.error) {
      console.log(`  ❌ ${config.provider} ${config.tier}: ${result.error}`);
    } else {
      console.log(`  ✅ ${config.provider} ${config.tier}: ${result.latency}ms, ${result.responseLength} chars, $${result.cost?.toFixed(6) || 'N/A'}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000)); // Rate limiting
  }
  
  // Analysis
  console.log('\n\n📊 Results\n');
  console.log('=' .repeat(80));
  
  const successful = results.filter(r => !r.error && !r.skipped && r.enabled);
  
  if (successful.length === 0) {
    console.log('❌ No successful API calls');
    return;
  }
  
  // Sort by latency
  successful.sort((a, b) => a.latency - b.latency);
  
  console.log('\nSpeed Ranking:');
  successful.forEach((r, idx) => {
    console.log(`${(idx + 1).toString().padStart(2)}. ${r.provider.padEnd(10)} ${r.tier.padEnd(10)} ${r.model.substring(0, 30).padEnd(30)} ${r.latency.toString().padStart(5)}ms ${r.responseLength.toString().padStart(5)} chars`);
  });
  
  // Cost analysis
  const withCost = successful.filter(r => r.cost !== null);
  if (withCost.length > 0) {
    console.log('\nCost Ranking:');
    withCost.sort((a, b) => a.cost - b.cost);
    withCost.forEach((r, idx) => {
      console.log(`${(idx + 1).toString().padStart(2)}. ${r.provider.padEnd(10)} ${r.tier.padEnd(10)}: $${r.cost.toFixed(6)} (${r.inputTokens} in, ${r.outputTokens} out)`);
    });
  }
  
  // Test automatic tier selection
  console.log('\n\n🎯 Automatic Tier Selection Test\n');
  console.log('=' .repeat(80));
  
  const testContexts = [
    { name: 'High frequency', context: { frequency: 'high' } },
    { name: 'Critical', context: { criticality: 'critical' } },
    { name: 'Cost sensitive', context: { costSensitive: true } },
    { name: 'Standard', context: {} },
  ];
  
  testContexts.forEach(({ name, context }) => {
    const tier = selectModelTier(context);
    console.log(`${name.padEnd(20)}: ${tier}`);
  });
}

runTests().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});

