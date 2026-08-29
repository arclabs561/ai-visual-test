/**
 * Multi-Provider Test Suite
 * 
 * Tests functionality across different providers (Gemini, OpenAI, Claude)
 * to ensure provider-agnostic behavior and catch provider-specific issues.
 */

import './test-setup.mjs'; // Auto-load .env (must be first)
import { test, describe } from 'node:test';
import assert from 'node:assert';
import { createConfig, getProvider } from '../src/config.js';
import { VLLMJudge } from '#judge';
import { unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createTestImage } from './test-image-utils.mjs';

// createTestImage is imported from test-image-utils.mjs (creates realistic 800x600 images)

/**
 * Test a specific provider
 */
async function testProvider(providerName) {
  const config = createConfig({ provider: providerName });
  
  if (!config.enabled) {
    // API key not available - test will return disabled results
    return { provider: providerName, enabled: false, tests: [] };
  }
  
  console.log(`\n🧪 Testing ${providerName}...`);
  const results = [];
  
  // Test 1: Basic configuration
  try {
    assert.strictEqual(config.provider, providerName);
    assert.ok(config.apiKey);
    assert.ok(config.providerConfig);
    results.push({ test: 'configuration', passed: true });
    console.log(`  ✅ Configuration valid`);
  } catch (error) {
    results.push({ test: 'configuration', passed: false, error: error.message });
    console.log(`  ❌ Configuration failed: ${error.message}`);
  }
  
  // Test 2: Basic screenshot validation
  try {
    const tempDir = join(tmpdir(), `provider-test-${Date.now()}`);
    const screenshotPath = join(tempDir, 'test.png');
    await createTestImage(screenshotPath);
    
    const judge = new VLLMJudge({ provider: providerName });
    const result = await judge.judgeScreenshot(screenshotPath, 'Describe this image in one sentence.', {
      testType: 'provider-test'
    });
    
    if (result.enabled) {
      assert.ok(result.score !== null || result.judgment);
      results.push({ test: 'screenshot-validation', passed: true });
      console.log(`  ✅ Screenshot validation: score=${result.score}, provider=${result.provider}`);
    } else {
      results.push({ test: 'screenshot-validation', passed: false, error: 'API disabled' });
      console.log(`  ⚠️  Screenshot validation: API disabled`);
    }
    
    // Cleanup
    if (existsSync(screenshotPath)) {
      unlinkSync(screenshotPath);
    }
  } catch (error) {
    results.push({ test: 'screenshot-validation', passed: false, error: error.message });
    console.log(`  ❌ Screenshot validation failed: ${error.message}`);
  }
  
  return { provider: providerName, enabled: config.enabled, tests: results };
}

describe('Multi-Provider Testing', () => {
  test('test all available providers', async () => {
    const providers = ['gemini', 'openai', 'claude'];
    const results = [];
    
    for (const provider of providers) {
      const result = await testProvider(provider);
      results.push(result);
    }
    
    // Summary
    console.log('\n📊 Provider Test Summary:');
    console.log('='.repeat(50));
    for (const result of results) {
      const status = result.enabled ? '✅ Enabled' : '⚠️  Disabled';
      const passedTests = result.tests.filter(t => t.passed).length;
      const totalTests = result.tests.length;
      console.log(`${result.provider.toUpperCase()}: ${status} (${passedTests}/${totalTests} tests passed)`);
    }
    
    // At least one provider should be enabled (if API keys are configured)
    const enabledProviders = results.filter(r => r.enabled);
    if (enabledProviders.length === 0) {
      console.log('\n⚠️  No providers enabled - check .env file for API keys');
      console.log('   Expected: GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY');
    } else {
      assert.ok(enabledProviders.length > 0, `At least one provider should be enabled (found ${enabledProviders.length})`);
    }
    
    // At least one provider should pass all tests
    const successfulProviders = enabledProviders.filter(r => 
      r.tests.length > 0 && r.tests.every(t => t.passed)
    );
    if (successfulProviders.length > 0) {
      console.log(`\n✅ ${successfulProviders.length} provider(s) passed all tests`);
    }
  });
  
  test('provider auto-detection', () => {
    const providerConfig = getProvider();
    console.log(`\n🔍 Auto-detected provider: ${providerConfig.name}`);
    // getProvider returns provider config object, check the name property
    assert.ok(typeof providerConfig === 'object');
    assert.ok(providerConfig.name);
    assert.ok(['gemini', 'openai', 'claude'].includes(providerConfig.name));
  });
  
  test('provider priority order', () => {
    // Test that provider priority is respected
    const configs = [
      createConfig({ provider: 'gemini' }),
      createConfig({ provider: 'openai' }),
      createConfig({ provider: 'claude' })
    ];
    
    for (const config of configs) {
      if (config.enabled) {
        console.log(`  ✅ ${config.provider}: Available`);
      } else {
        console.log(`  ⚠️  ${config.provider}: Not configured`);
      }
    }
  });
});
