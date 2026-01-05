/**
 * Cost Optimization Examples
 * 
 * Demonstrates how to use ai-visual-test's built-in cost optimization features
 * to reduce API costs by 70-95% while maintaining quality.
 */

import { test, expect } from '@playwright/test';
import {
  validateScreenshot,
  selectModelTier,
  selectProvider,
  selectModelTierAndProvider,
  createConfig,
  VLLMJudge,
  getCostTracker
} from '@arclabs561/ai-visual-test';

test.describe('Cost Optimization Examples', () => {
  
  test('example 1: routine tests with fast tier', async ({ page }) => {
    // Strategy: Use fast tier for routine, non-critical tests
    // Cost Savings: 70-90% vs balanced tier
    
    await page.goto('https://example.com');
    await page.waitForLoadState('networkidle');
    
    const screenshotPath = `test-results/routine-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    
    // Select fast tier for routine tests
    const tier = selectModelTier({
      costSensitive: true,
      testType: 'routine',
      criticality: 'low'
    });
    // Returns: 'fast'
    
    // Create config with selected tier
    const config = createConfig({ modelTier: tier });
    const judge = new VLLMJudge(config);
    
    // Validate with fast tier
    const result = await judge.judgeScreenshot(
      screenshotPath,
      'Evaluate accessibility',
      { testType: 'routine' }
    );
    
    expect(result.enabled).toBe(true);
    expect(result.score).not.toBeNull();
    
    console.log(`Tier used: ${tier}`);
    console.log(`Cost: $${result.estimatedCost?.totalCost || '0.000000'}`);
    console.log(`Score: ${result.score}/10`);
    // Expected: ~$0.001 (vs ~$0.01 for balanced)
  });
  
  test('example 2: critical tests with best tier', async ({ page }) => {
    // Strategy: Use best tier only for critical tests
    // Cost Savings: Use expensive models only when needed
    
    await page.goto('https://example.com/checkout');
    await page.waitForLoadState('networkidle');
    
    const screenshotPath = `test-results/critical-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    
    // Select best tier for critical tests
    const tier = selectModelTier({
      criticality: 'critical',
      testType: 'payment-critical',
      qualityRequired: true
    });
    // Returns: 'best'
    
    const config = createConfig({ modelTier: tier });
    const judge = new VLLMJudge(config);
    
    const result = await judge.judgeScreenshot(
      screenshotPath,
      'CRITICAL: Evaluate payment security and accessibility',
      { testType: 'payment-critical' }
    );
    
    expect(result.enabled).toBe(true);
    expect(result.score).not.toBeNull();
    
    console.log(`Tier used: ${tier}`);
    console.log(`Cost: $${result.estimatedCost?.totalCost || '0.000000'}`);
    // Expected: ~$0.05 (best tier, but only for critical tests)
  });
  
  test('example 3: high-frequency with temporal decision', async ({ page }) => {
    // Strategy: Use temporal decision management for high-frequency validation
    // Cost Savings: 98.5% reduction in LLM calls
    
    await page.goto('https://example.com/game');
    await page.waitForLoadState('networkidle');
    
    // Simulate high-frequency temporal notes (60Hz)
    const temporalNotes = [];
    for (let i = 0; i < 60; i++) {
      temporalNotes.push({
        timestamp: Date.now() - (60 - i) * 16, // 16ms intervals (60Hz)
        score: 8 + Math.random() * 0.5,
        observation: `Frame ${i}`,
        step: `frame_${i}`
      });
    }
    
    // Select fast tier for high-frequency
    const tier = selectModelTier({
      frequency: 60,
      temporalNotes: temporalNotes.slice(-10) // Last 10 for frequency detection
    });
    // Returns: 'fast'
    
    const config = createConfig({ modelTier: tier });
    const judge = new VLLMJudge(config);
    
    const screenshotPath = `test-results/high-freq-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    
    // Use temporal decision management
    const result = await judge.judgeScreenshot(
      screenshotPath,
      'Is the game playable?',
      {
        useTemporalDecision: true,
        temporalNotes: temporalNotes,
        testType: 'gameplay'
      }
    );
    
    expect(result.enabled).toBe(true);
    
    console.log(`Tier used: ${tier}`);
    console.log(`Temporal notes: ${temporalNotes.length}`);
    console.log(`Cost: $${result.estimatedCost?.totalCost || '0.000000'}`);
    // Expected: ~$0.0001 (98.5% reduction from temporal decision)
  });
  
  test('example 4: provider selection for cost optimization', async ({ page }) => {
    // Strategy: Auto-select cheapest provider
    // Cost Savings: 50-80% by using cheaper providers
    
    await page.goto('https://example.com');
    await page.waitForLoadState('networkidle');
    
    const screenshotPath = `test-results/provider-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    
    // Select provider based on requirements
    const provider = selectProvider({
      costSensitive: true,
      quality: 'good',
      env: process.env
    });
    // Returns: 'gemini' (cheapest, if GEMINI_API_KEY available)
    
    const config = createConfig({ provider });
    const judge = new VLLMJudge(config);
    
    const result = await judge.judgeScreenshot(
      screenshotPath,
      'Evaluate accessibility',
      { testType: 'routine' }
    );
    
    expect(result.enabled).toBe(true);
    expect(result.provider).toBe(provider);
    
    console.log(`Provider used: ${provider}`);
    console.log(`Cost: $${result.estimatedCost?.totalCost || '0.000000'}`);
    // Expected: Lower cost with Gemini vs OpenAI/Claude
  });
  
  test('example 5: combined optimization strategy', async ({ page }) => {
    // Strategy: Combine tier selection + provider selection + temporal decision
    // Cost Savings: 95%+ for routine, high-frequency cases
    
    await page.goto('https://example.com/game');
    await page.waitForLoadState('networkidle');
    
    // High-frequency temporal notes
    const temporalNotes = Array.from({ length: 60 }, (_, i) => ({
      timestamp: Date.now() - (60 - i) * 16,
      score: 8,
      observation: `Frame ${i}`,
      step: `frame_${i}`
    }));
    
    // Combined selection: tier + provider
    const { tier, provider } = selectModelTierAndProvider({
      frequency: 60,
      costSensitive: true,
      requirements: {
        costSensitive: true,
        env: process.env
      }
    });
    
    const config = createConfig({ 
      modelTier: tier,
      provider 
    });
    const judge = new VLLMJudge(config);
    
    const screenshotPath = `test-results/combined-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    
    const result = await judge.judgeScreenshot(
      screenshotPath,
      'Is the game playable?',
      {
        useTemporalDecision: true,
        temporalNotes: temporalNotes,
        testType: 'gameplay'
      }
    );
    
    expect(result.enabled).toBe(true);
    
    console.log(`Tier: ${tier}, Provider: ${provider}`);
    console.log(`Cost: $${result.estimatedCost?.totalCost || '0.000000'}`);
    // Expected: ~$0.0001 (95%+ reduction)
  });
  
  test('example 6: cost tracking and analysis', async ({ page }) => {
    // Strategy: Track costs over time to optimize further
    
    await page.goto('https://example.com');
    await page.waitForLoadState('networkidle');
    
    const screenshotPath = `test-results/tracking-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    
    // Run multiple validations
    const results = [];
    for (let i = 0; i < 5; i++) {
      const tier = selectModelTier({
        costSensitive: i < 3, // First 3 are cost-sensitive
        criticality: i >= 3 ? 'critical' : 'low'
      });
      
      const config = createConfig({ modelTier: tier });
      const judge = new VLLMJudge(config);
      
      const result = await judge.judgeScreenshot(
        screenshotPath,
        `Evaluate test ${i}`,
        { testType: i < 3 ? 'routine' : 'critical' }
      );
      
      results.push(result);
    }
    
    // Get cost statistics
    const tracker = getCostTracker();
    const stats = tracker.getCostStats();
    
    console.log(`Total cost: $${stats.totals.total}`);
    console.log(`By provider:`, stats.byProvider);
    console.log(`Average cost per validation: $${stats.totals.total / results.length}`);
    
    expect(stats.totals.count).toBeGreaterThan(0);
  });
  
  test('example 7: frequency detection from temporal notes', async ({ page }) => {
    // Strategy: Auto-detect frequency from temporal notes
    
    await page.goto('https://example.com/game');
    await page.waitForLoadState('networkidle');
    
    // Simulate different frequency patterns
    const highFreqNotes = Array.from({ length: 20 }, (_, i) => ({
      timestamp: Date.now() - (20 - i) * 50, // 50ms intervals (20Hz)
      score: 8,
      observation: `Frame ${i}`
    }));
    
    const lowFreqNotes = Array.from({ length: 5 }, (_, i) => ({
      timestamp: Date.now() - (5 - i) * 2000, // 2s intervals (0.5Hz)
      score: 8,
      observation: `State ${i}`
    }));
    
    // High frequency → fast tier
    const tier1 = selectModelTier({ temporalNotes: highFreqNotes });
    expect(tier1).toBe('fast');
    
    // Low frequency → balanced tier
    const tier2 = selectModelTier({ temporalNotes: lowFreqNotes });
    expect(tier2).toBe('balanced');
    
    console.log(`High frequency (20Hz): ${tier1}`);
    console.log(`Low frequency (0.5Hz): ${tier2}`);
  });
  
  test('example 8: caching reduces costs', async ({ page }) => {
    // Strategy: Leverage built-in caching (automatic)
    // Cost Savings: 100% for cached results
    
    await page.goto('https://example.com');
    await page.waitForLoadState('networkidle');
    
    const screenshotPath = `test-results/cache-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    
    const prompt = 'Evaluate accessibility';
    const context = { testType: 'routine' };
    
    // First call: API request
    const result1 = await validateScreenshot(screenshotPath, prompt, context);
    const cost1 = parseFloat(result1.estimatedCost?.totalCost || '0');
    
    // Second call: Cache hit (same inputs)
    const result2 = await validateScreenshot(screenshotPath, prompt, context);
    const cost2 = parseFloat(result2.estimatedCost?.totalCost || '0');
    
    expect(result2.cached).toBe(true);
    expect(cost2).toBe(0); // Cached = $0
    
    console.log(`First call cost: $${cost1}`);
    console.log(`Second call cost: $${cost2} (cached)`);
    console.log(`Cache savings: 100%`);
  });
});

