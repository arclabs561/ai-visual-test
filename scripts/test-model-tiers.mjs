/**
 * Test Model Tier Performance
 * 
 * Measures actual latency and quality across different model tiers
 * to understand the speed/quality Pareto frontier
 */

import { createConfig } from '../src/config.mjs';
import { VLLMJudge } from '../src/judge.mjs';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const TEST_IMAGE_PATH = join(tmpdir(), 'test-tier-image.png');

// Create a minimal test image if it doesn't exist
if (!existsSync(TEST_IMAGE_PATH)) {
  // Create a 1x1 PNG (minimal valid PNG)
  const minimalPNG = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
    0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
    0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xDD, 0x8D, 0xB4, 0x00, 0x00, 0x00,
    0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
  ]);
  writeFileSync(TEST_IMAGE_PATH, minimalPNG);
}

const TEST_PROMPT = 'Is there a visible button on this screenshot? Answer with a simple yes or no.';

const PROVIDERS = ['gemini', 'openai', 'claude', 'groq'];
const TIERS = ['fast', 'balanced', 'best'];

const results = [];

async function testModel(provider, tier) {
  try {
    const config = createConfig({ 
      provider, 
      modelTier: tier,
      verbose: false 
    });
    
    if (!config.enabled || !config.apiKey) {
      return { provider, tier, error: 'No API key configured' };
    }
    
    const model = config.providerConfig.model;
    console.log(`Testing ${provider} ${tier} (${model})...`);
    
    const judge = new VLLMJudge({ provider, modelTier: tier });
    
    const startTime = Date.now();
    const result = await judge.judgeScreenshot(TEST_IMAGE_PATH, TEST_PROMPT, {
      testType: `tier-test-${provider}-${tier}`
    });
    const latency = Date.now() - startTime;
    
    // Extract quality indicators
    const judgment = result.judgment || '';
    const hasReasoning = judgment.length > 10;
    const responseLength = judgment.length;
    const score = result.score !== null ? result.score : null;
    const hasIssues = result.issues && result.issues.length > 0;
    
    return {
      provider,
      tier,
      model,
      latency,
      enabled: result.enabled,
      hasResponse: !!judgment,
      responseLength,
      hasReasoning,
      score,
      hasIssues,
      error: result.error || null,
      cost: result.estimatedCost || null
    };
  } catch (error) {
    return {
      provider,
      tier,
      error: error.message
    };
  }
}

async function runTests() {
  console.log('\n🔬 Testing Model Tier Performance\n');
  console.log('=' .repeat(80));
  console.log(`Test image: ${TEST_IMAGE_PATH}`);
  console.log(`Test prompt: "${TEST_PROMPT}"\n`);
  
  for (const provider of PROVIDERS) {
    for (const tier of TIERS) {
      const result = await testModel(provider, tier);
      results.push(result);
      
      if (result.error) {
        console.log(`  ❌ ${provider} ${tier}: ${result.error}`);
      } else {
        console.log(`  ✅ ${provider} ${tier} (${result.model}): ${result.latency}ms`);
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // Analyze results
  console.log('\n\n📊 Results Analysis\n');
  console.log('=' .repeat(80));
  
  const successful = results.filter(r => !r.error && r.enabled);
  
  if (successful.length === 0) {
    console.log('❌ No successful API calls. Check API keys in .env');
    return;
  }
  
  // Group by tier
  const byTier = {
    fast: successful.filter(r => r.tier === 'fast'),
    balanced: successful.filter(r => r.tier === 'balanced'),
    best: successful.filter(r => r.tier === 'best')
  };
  
  // Calculate averages
  console.log('\nAverage Latency by Tier:');
  Object.entries(byTier).forEach(([tier, tests]) => {
    if (tests.length > 0) {
      const avgLatency = tests.reduce((sum, t) => sum + t.latency, 0) / tests.length;
      const minLatency = Math.min(...tests.map(t => t.latency));
      const maxLatency = Math.max(...tests.map(t => t.latency));
      console.log(`  ${tier.padEnd(10)}: ${avgLatency.toFixed(0)}ms (min: ${minLatency}ms, max: ${maxLatency}ms)`);
    }
  });
  
  // Speed/Quality Pareto
  console.log('\nSpeed/Quality Pareto Frontier:');
  console.log('(Lower latency = faster, Higher response length = more detailed)\n');
  
  successful.sort((a, b) => a.latency - b.latency);
  
  successful.forEach(r => {
    const latencyBar = '█'.repeat(Math.min(50, Math.floor(r.latency / 50)));
    const qualityBar = '█'.repeat(Math.min(20, Math.floor(r.responseLength / 10)));
    console.log(`${r.provider.padEnd(10)} ${r.tier.padEnd(10)} ${r.model.padEnd(30)}`);
    console.log(`  Latency: ${r.latency.toString().padStart(5)}ms ${latencyBar}`);
    console.log(`  Quality: ${r.responseLength.toString().padStart(5)} chars ${qualityBar}`);
    if (r.cost) {
      console.log(`  Cost:    $${parseFloat(r.cost.totalCost).toFixed(6)}`);
    }
    console.log('');
  });
  
  // Find Pareto-optimal points
  console.log('\nPareto-Optimal Models (fastest for given quality level):');
  const paretoOptimal = [];
  
  for (const result of successful) {
    const isParetoOptimal = successful.every(other => {
      if (other === result) return true;
      // If other is both slower AND lower quality, result is better
      if (other.latency >= result.latency && other.responseLength <= result.responseLength) {
        return other.latency === result.latency && other.responseLength === result.responseLength;
      }
      return true;
    });
    
    if (isParetoOptimal) {
      paretoOptimal.push(result);
    }
  }
  
  paretoOptimal.sort((a, b) => a.latency - b.latency);
  paretoOptimal.forEach(r => {
    console.log(`  ✅ ${r.provider} ${r.tier} (${r.model}): ${r.latency}ms, ${r.responseLength} chars`);
  });
  
  // Cost analysis
  console.log('\nCost per Request:');
  const withCost = successful.filter(r => r.cost);
  if (withCost.length > 0) {
    withCost.sort((a, b) => parseFloat(a.cost.totalCost) - parseFloat(b.cost.totalCost));
    withCost.forEach(r => {
      console.log(`  ${r.provider.padEnd(10)} ${r.tier.padEnd(10)}: $${parseFloat(r.cost.totalCost).toFixed(6)}`);
    });
  }
}

runTests().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});

