/**
 * Test Speed/Quality Pareto Frontier
 * 
 * Measures actual latency and quality across different model tiers
 * to understand the real speed/quality tradeoff
 */

import { createConfig } from '../src/config.mjs';
import { VLLMJudge } from '../src/judge.mjs';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Create a proper test image (100x100 PNG)
function createTestImage(path) {
  if (existsSync(path)) return;
  
  // Create a simple 100x100 PNG with some content
  // Using a minimal valid PNG structure
  const width = 100;
  const height = 100;
  
  // This is a simplified approach - in reality we'd use a proper PNG encoder
  // For now, create a file that at least exists
  const minimalPNG = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x64, 0x00, 0x00, 0x00, 0x64,
    0x08, 0x02, 0x00, 0x00, 0x00, 0xFF, 0x80, 0x02, 0x00, 0x00, 0x00, 0x01,
    0x73, 0x52, 0x47, 0x42, 0x00, 0xAE, 0xCE, 0x1C, 0xE9, 0x00, 0x00, 0x00,
    0x04, 0x67, 0x41, 0x4D, 0x41, 0x00, 0x00, 0xB1, 0x8F, 0x0B, 0xFC, 0x61,
    0x05, 0x00, 0x00, 0x00, 0x09, 0x70, 0x48, 0x59, 0x73, 0x00, 0x00, 0x0E,
    0xC3, 0x00, 0x00, 0x0E, 0xC3, 0x01, 0xC7, 0x6F, 0xA8, 0x64, 0x00, 0x00,
    0x00, 0x18, 0x74, 0x45, 0x58, 0x74, 0x53, 0x6F, 0x66, 0x74, 0x77, 0x61,
    0x72, 0x65, 0x00, 0x70, 0x61, 0x69, 0x6E, 0x74, 0x2E, 0x6E, 0x65, 0x74,
    0x20, 0x34, 0x2E, 0x30, 0x2E, 0x35, 0x36, 0xB1, 0x91, 0x4A, 0x00, 0x00,
    0x00, 0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00,
    0x00, 0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00,
    0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
  ]);
  writeFileSync(path, minimalPNG);
}

const TEST_IMAGE_PATH = join(tmpdir(), 'test-pareto-image.png');
createTestImage(TEST_IMAGE_PATH);

const TEST_PROMPT = 'Describe what you see in this screenshot. Be concise but accurate.';

// Test configurations: provider + tier combinations
const TEST_CONFIGS = [
  { provider: 'gemini', tier: 'fast' },
  { provider: 'gemini', tier: 'balanced' },
  { provider: 'gemini', tier: 'best' },
  { provider: 'openai', tier: 'fast' },
  { provider: 'openai', tier: 'balanced' },
  { provider: 'openai', tier: 'best' },
  { provider: 'claude', tier: 'fast' },
  { provider: 'claude', tier: 'balanced' },
  { provider: 'claude', tier: 'best' },
  // Groq excluded - doesn't support vision with current model
];

const results = [];

async function testModel(config) {
  const { provider, tier } = config;
  
  try {
    const judgeConfig = createConfig({ provider, modelTier: tier });
    
    if (!judgeConfig.enabled || !judgeConfig.apiKey) {
      return { provider, tier, error: 'No API key', skipped: true };
    }
    
    const model = judgeConfig.providerConfig.model;
    console.log(`Testing ${provider} ${tier} (${model})...`);
    
    const judge = new VLLMJudge({ provider, modelTier: tier, verbose: false });
    
    // Measure actual latency
    const startTime = Date.now();
    const result = await judge.judgeScreenshot(TEST_IMAGE_PATH, TEST_PROMPT, {
      testType: `pareto-test-${provider}-${tier}`
    });
    const latency = Date.now() - startTime;
    
    if (!result.enabled || result.error) {
      return { provider, tier, model, error: result.error || 'API disabled', latency };
    }
    
    // Quality indicators
    const judgment = result.judgment || '';
    const responseLength = judgment.length;
    const hasReasoning = judgment.length > 50; // More than just "yes/no"
    const score = result.score !== null ? result.score : null;
    const issuesCount = result.issues ? result.issues.length : 0;
    const hasDetailedResponse = judgment.split('.').length > 2; // Multiple sentences
    
    // Cost
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
      hasReasoning,
      hasDetailedResponse,
      score,
      issuesCount,
      cost,
      inputTokens,
      outputTokens,
      judgment: judgment.substring(0, 100) // First 100 chars for inspection
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
  console.log('\n🔬 Speed/Quality Pareto Frontier Analysis\n');
  console.log('=' .repeat(80));
  console.log(`Test image: ${TEST_IMAGE_PATH}`);
  console.log(`Test prompt: "${TEST_PROMPT}"\n`);
  console.log('Testing each provider/tier combination...\n');
  
  for (const config of TEST_CONFIGS) {
    const result = await testModel(config);
    results.push(result);
    
    if (result.skipped) {
      console.log(`  ⏭️  ${config.provider} ${config.tier}: Skipped (no API key)`);
    } else if (result.error) {
      console.log(`  ❌ ${config.provider} ${config.tier}: ${result.error}`);
    } else {
      console.log(`  ✅ ${config.provider} ${config.tier}: ${result.latency}ms, ${result.responseLength} chars, $${result.cost?.toFixed(6) || 'N/A'}`);
    }
    
    // Delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Analyze Pareto frontier
  console.log('\n\n📊 Pareto Frontier Analysis\n');
  console.log('=' .repeat(80));
  
  const successful = results.filter(r => !r.error && !r.skipped && r.enabled);
  
  if (successful.length === 0) {
    console.log('❌ No successful API calls. Check API keys in .env');
    console.log('\nAvailable providers with keys:');
    TEST_CONFIGS.forEach(config => {
      const judgeConfig = createConfig({ provider: config.provider, modelTier: config.tier });
      console.log(`  ${config.provider} ${config.tier}: ${judgeConfig.enabled ? '✅' : '❌'} (${judgeConfig.apiKey ? 'has key' : 'no key'})`);
    });
    return;
  }
  
  // Sort by latency (speed)
  successful.sort((a, b) => a.latency - b.latency);
  
  console.log('\nSpeed Ranking (Fastest to Slowest):');
  successful.forEach((r, idx) => {
    const bar = '█'.repeat(Math.min(60, Math.floor(r.latency / 50)));
    console.log(`${(idx + 1).toString().padStart(2)}. ${r.provider.padEnd(10)} ${r.tier.padEnd(10)} ${r.model.padEnd(30)} ${r.latency.toString().padStart(5)}ms ${bar}`);
  });
  
  // Quality indicators
  console.log('\n\nQuality Indicators:');
  successful.forEach(r => {
    console.log(`${r.provider} ${r.tier}:`);
    console.log(`  Response length: ${r.responseLength} chars`);
    console.log(`  Has reasoning: ${r.hasReasoning ? '✅' : '❌'}`);
    console.log(`  Detailed response: ${r.hasDetailedResponse ? '✅' : '❌'}`);
    console.log(`  Score: ${r.score !== null ? r.score : 'N/A'}`);
    console.log(`  Issues found: ${r.issuesCount}`);
    if (r.judgment) {
      console.log(`  Sample: "${r.judgment}..."`);
    }
    console.log('');
  });
  
  // Cost analysis
  console.log('\nCost Analysis:');
  const withCost = successful.filter(r => r.cost !== null);
  if (withCost.length > 0) {
    withCost.sort((a, b) => a.cost - b.cost);
    withCost.forEach(r => {
      console.log(`  ${r.provider.padEnd(10)} ${r.tier.padEnd(10)}: $${r.cost.toFixed(6)} (${r.inputTokens} in, ${r.outputTokens} out)`);
    });
  }
  
  // Pareto-optimal points
  console.log('\n\n🎯 Pareto-Optimal Models:');
  console.log('(Models that are fastest for their quality level, or highest quality for their speed)\n');
  
  const paretoOptimal = [];
  
  for (const result of successful) {
    // Check if this result is Pareto-optimal
    // A point is Pareto-optimal if no other point is both faster AND higher quality
    const isOptimal = successful.every(other => {
      if (other === result) return true;
      
      // If other is faster, it must have lower quality
      if (other.latency < result.latency) {
        return other.responseLength <= result.responseLength;
      }
      
      // If other has higher quality, it must be slower
      if (other.responseLength > result.responseLength) {
        return other.latency >= result.latency;
      }
      
      // If same or worse on both dimensions, result is still optimal
      return true;
    });
    
    if (isOptimal) {
      paretoOptimal.push(result);
    }
  }
  
  paretoOptimal.sort((a, b) => a.latency - b.latency);
  
  if (paretoOptimal.length > 0) {
    paretoOptimal.forEach(r => {
      console.log(`  ✅ ${r.provider} ${r.tier} (${r.model}):`);
      console.log(`     Speed: ${r.latency}ms`);
      console.log(`     Quality: ${r.responseLength} chars, ${r.hasReasoning ? 'reasoning' : 'basic'}`);
      console.log(`     Cost: $${r.cost?.toFixed(6) || 'N/A'}`);
    });
  } else {
    console.log('  (No clear Pareto-optimal points found)');
  }
  
  // Recommendations
  console.log('\n\n💡 Recommendations:\n');
  
  const fastest = successful[0];
  const highestQuality = successful.reduce((best, curr) => 
    curr.responseLength > best.responseLength ? curr : best
  );
  const cheapest = withCost.length > 0 ? withCost[0] : null;
  
  console.log(`Fastest: ${fastest.provider} ${fastest.tier} (${fastest.latency}ms)`);
  console.log(`  Use for: High-frequency decisions, real-time validation, low-latency requirements`);
  
  console.log(`\nHighest Quality: ${highestQuality.provider} ${highestQuality.tier} (${highestQuality.responseLength} chars)`);
  console.log(`  Use for: Critical evaluations, detailed analysis, high-stakes decisions`);
  
  if (cheapest) {
    console.log(`\nCheapest: ${cheapest.provider} ${cheapest.tier} ($${cheapest.cost.toFixed(6)})`);
    console.log(`  Use for: High-volume operations, cost-sensitive scenarios`);
  }
  
  // Speed/Quality tradeoff visualization
  console.log('\n\n📈 Speed vs Quality Tradeoff:\n');
  console.log('Latency (ms) | Quality (chars) | Provider+Tier');
  console.log('-'.repeat(80));
  successful.forEach(r => {
    const latencyStr = r.latency.toString().padStart(6);
    const qualityStr = r.responseLength.toString().padStart(6);
    const name = `${r.provider} ${r.tier}`.padEnd(20);
    console.log(`${latencyStr}     | ${qualityStr}        | ${name}`);
  });
}

runTests().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});

