/**
 * Auto-Optimization Examples
 *
 * Demonstrates auto-optimization features:
 * - autoSelectTier: automatic model tier selection
 * - autoSelectProvider: automatic provider selection
 * - includeCostComparison: cost comparison in results
 * - optimizeCost: one-stop optimization helper
 */

import { test, expect } from '@playwright/test';
import { validateScreenshot } from '@arclabs561/ai-visual-test';
import { optimizeCost } from '@arclabs561/ai-visual-test/utils';

test.describe('Auto-Optimization Examples', () => {

  test('auto-select tier for routine tests', async ({ page }) => {
    await page.goto('https://example.com');
    await page.waitForLoadState('networkidle');

    const screenshotPath = `test-results/auto-tier-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const result = await validateScreenshot(
      screenshotPath,
      'Evaluate accessibility',
      {
        autoSelectTier: true,
        costSensitive: true,
        testType: 'routine',
        criticality: 'low'
      }
    );

    expect(result.enabled).toBe(true);
    expect(result.score).not.toBeNull();

    console.log(`Cost: $${result.estimatedCost?.totalCost || '0.000000'}`);
  });

  test('auto-select provider for cost optimization', async ({ page }) => {
    await page.goto('https://example.com');
    await page.waitForLoadState('networkidle');

    const screenshotPath = `test-results/auto-provider-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const result = await validateScreenshot(
      screenshotPath,
      'Evaluate accessibility',
      {
        autoSelectProvider: true,
        costSensitive: true
      }
    );

    expect(result.enabled).toBe(true);
    expect(result.provider).toBeDefined();

    console.log(`Provider: ${result.provider}`);
  });

  test('cost comparison in results', async ({ page }) => {
    await page.goto('https://example.com');
    await page.waitForLoadState('networkidle');

    const screenshotPath = `test-results/cost-compare-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const result = await validateScreenshot(
      screenshotPath,
      'Evaluate accessibility',
      {
        includeCostComparison: true,
        modelTier: 'balanced'
      }
    );

    expect(result.enabled).toBe(true);
    expect(result.costComparison).toBeDefined();

    console.log(`Tier: ${result.costComparison.current.tier}`);
    console.log(`Cost: $${result.costComparison.current.cost}`);
    console.log(`Savings vs fast: ${result.costComparison.savings.fast?.percent || 0}%`);
    console.log(`Recommendation: ${result.costComparison.recommendation.reason}`);
  });

  test('optimizeCost helper function', async ({ page }) => {
    await page.goto('https://example.com');
    await page.waitForLoadState('networkidle');

    const optimization = optimizeCost({
      frequency: 60,
      costSensitive: true,
      budget: 0.01
    });

    expect(optimization.recommendedTier).toBeDefined();
    expect(optimization.recommendedProvider).toBeDefined();
    expect(optimization.estimatedCost).toBeGreaterThan(0);

    console.log(`Recommended: ${optimization.recommendedProvider} ${optimization.recommendedTier}`);
    console.log(`Estimated cost: $${optimization.estimatedCost.toFixed(6)}`);
    console.log(`Within budget: ${optimization.withinBudget}`);

    // Use the recommended config
    const screenshotPath = `test-results/optimized-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const result = await validateScreenshot(
      screenshotPath,
      'Evaluate accessibility',
      {
        ...optimization.config,
        testType: 'routine'
      }
    );

    expect(result.enabled).toBe(true);
  });

  test('combined auto-optimization', async ({ page }) => {
    await page.goto('https://example.com');
    await page.waitForLoadState('networkidle');

    const screenshotPath = `test-results/combined-auto-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const result = await validateScreenshot(
      screenshotPath,
      'Evaluate accessibility',
      {
        autoSelectTier: true,
        autoSelectProvider: true,
        includeCostComparison: true,
        costSensitive: true,
        frequency: 60
      }
    );

    expect(result.enabled).toBe(true);
    expect(result.costComparison).toBeDefined();

    console.log(`Tier: ${result.costComparison.current.tier}`);
    console.log(`Provider: ${result.provider}`);
    console.log(`Cost: $${result.estimatedCost?.totalCost || '0.000000'}`);
  });
});
