/**
 * Cost Optimization Examples
 *
 * Demonstrates tier selection, provider selection, caching, and cost tracking
 * to reduce API costs while maintaining quality.
 */

import { test, expect } from '@playwright/test';
import { validateScreenshot, createConfig, VLLMJudge } from '@arclabs561/ai-visual-test';
import {
  selectModelTier,
  selectProvider,
  selectModelTierAndProvider,
  getCostTracker
} from '@arclabs561/ai-visual-test/utils';

test.describe('Cost Optimization Examples', () => {

  test('example 1: routine tests with fast tier', async ({ page }) => {
    // Use fast tier for routine, non-critical tests
    // Saves 70-90% vs balanced tier

    await page.goto('https://example.com');
    await page.waitForLoadState('networkidle');

    const screenshotPath = `test-results/routine-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const tier = selectModelTier({
      costSensitive: true,
      testType: 'routine',
      criticality: 'low'
    });

    const config = createConfig({ modelTier: tier });
    const judge = new VLLMJudge(config);

    const result = await judge.judgeScreenshot(
      screenshotPath,
      'Evaluate accessibility',
      { testType: 'routine' }
    );

    expect(result.enabled).toBe(true);
    expect(result.score).not.toBeNull();

    console.log(`Tier: ${tier}`);
    console.log(`Cost: $${result.estimatedCost?.totalCost || '0.000000'}`);
    console.log(`Score: ${result.score}/10`);
  });

  test('example 2: critical tests with best tier', async ({ page }) => {
    // Use best tier only for critical tests

    await page.goto('https://example.com/checkout');
    await page.waitForLoadState('networkidle');

    const screenshotPath = `test-results/critical-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const tier = selectModelTier({
      criticality: 'critical',
      testType: 'payment-critical',
      qualityRequired: true
    });

    const config = createConfig({ modelTier: tier });
    const judge = new VLLMJudge(config);

    const result = await judge.judgeScreenshot(
      screenshotPath,
      'CRITICAL: Evaluate payment security and accessibility',
      { testType: 'payment-critical' }
    );

    expect(result.enabled).toBe(true);
    expect(result.score).not.toBeNull();

    console.log(`Tier: ${tier}`);
    console.log(`Cost: $${result.estimatedCost?.totalCost || '0.000000'}`);
  });

  test('example 3: high-frequency with temporal decision', async ({ page }) => {
    // Use temporal decision management for high-frequency validation

    await page.goto('https://example.com/game');
    await page.waitForLoadState('networkidle');

    const temporalNotes = [];
    for (let i = 0; i < 60; i++) {
      temporalNotes.push({
        timestamp: Date.now() - (60 - i) * 16,
        score: 8 + Math.random() * 0.5,
        observation: `Frame ${i}`,
        step: `frame_${i}`
      });
    }

    const tier = selectModelTier({
      frequency: 60,
      temporalNotes: temporalNotes.slice(-10)
    });

    const config = createConfig({ modelTier: tier });
    const judge = new VLLMJudge(config);

    const screenshotPath = `test-results/high-freq-${Date.now()}.png`;
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

    console.log(`Tier: ${tier}`);
    console.log(`Temporal notes: ${temporalNotes.length}`);
    console.log(`Cost: $${result.estimatedCost?.totalCost || '0.000000'}`);
  });

  test('example 4: provider selection for cost optimization', async ({ page }) => {
    // Auto-select cheapest provider

    await page.goto('https://example.com');
    await page.waitForLoadState('networkidle');

    const screenshotPath = `test-results/provider-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const provider = selectProvider({
      costSensitive: true,
      quality: 'good',
      env: process.env
    });

    const config = createConfig({ provider });
    const judge = new VLLMJudge(config);

    const result = await judge.judgeScreenshot(
      screenshotPath,
      'Evaluate accessibility',
      { testType: 'routine' }
    );

    expect(result.enabled).toBe(true);
    expect(result.provider).toBe(provider);

    console.log(`Provider: ${provider}`);
    console.log(`Cost: $${result.estimatedCost?.totalCost || '0.000000'}`);
  });

  test('example 5: combined optimization', async ({ page }) => {
    // Combine tier + provider selection

    await page.goto('https://example.com/game');
    await page.waitForLoadState('networkidle');

    const temporalNotes = Array.from({ length: 60 }, (_, i) => ({
      timestamp: Date.now() - (60 - i) * 16,
      score: 8,
      observation: `Frame ${i}`,
      step: `frame_${i}`
    }));

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
  });

  test('example 6: cost tracking', async ({ page }) => {
    // Track costs over time

    await page.goto('https://example.com');
    await page.waitForLoadState('networkidle');

    const screenshotPath = `test-results/tracking-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const results = [];
    for (let i = 0; i < 5; i++) {
      const tier = selectModelTier({
        costSensitive: i < 3,
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

    const tracker = getCostTracker();
    const stats = tracker.getCostStats();

    console.log(`Total cost: $${stats.totals.total}`);
    console.log(`By provider:`, stats.byProvider);
    console.log(`Average: $${stats.totals.total / results.length}`);

    expect(stats.totals.count).toBeGreaterThan(0);
  });

  test('example 7: frequency detection from temporal notes', async ({ page }) => {
    // Auto-detect frequency -> select tier

    await page.goto('https://example.com/game');
    await page.waitForLoadState('networkidle');

    const highFreqNotes = Array.from({ length: 20 }, (_, i) => ({
      timestamp: Date.now() - (20 - i) * 50,
      score: 8,
      observation: `Frame ${i}`
    }));

    const lowFreqNotes = Array.from({ length: 5 }, (_, i) => ({
      timestamp: Date.now() - (5 - i) * 2000,
      score: 8,
      observation: `State ${i}`
    }));

    const tier1 = selectModelTier({ temporalNotes: highFreqNotes });
    expect(tier1).toBe('fast');

    const tier2 = selectModelTier({ temporalNotes: lowFreqNotes });
    expect(tier2).toBe('balanced');

    console.log(`High frequency (20Hz): ${tier1}`);
    console.log(`Low frequency (0.5Hz): ${tier2}`);
  });

  test('example 8: caching reduces costs', async ({ page }) => {
    // Built-in caching: second call with same inputs is free

    await page.goto('https://example.com');
    await page.waitForLoadState('networkidle');

    const screenshotPath = `test-results/cache-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const prompt = 'Evaluate accessibility';
    const context = { testType: 'routine' };

    // First call: API request
    const result1 = await validateScreenshot(screenshotPath, prompt, context);
    const cost1 = parseFloat(result1.estimatedCost?.totalCost || '0');

    // Second call: cache hit
    const result2 = await validateScreenshot(screenshotPath, prompt, context);
    const cost2 = parseFloat(result2.estimatedCost?.totalCost || '0');

    expect(result2.cached).toBe(true);
    expect(cost2).toBe(0);

    console.log(`First call: $${cost1}`);
    console.log(`Second call: $${cost2} (cached)`);
  });
});
