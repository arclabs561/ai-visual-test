/**
 * Auto-Optimization Examples
 * 
 * Demonstrates the new auto-optimization features:
 * - autoSelectTier: Automatically selects model tier
 * - autoSelectProvider: Automatically selects provider
 * - includeCostComparison: Shows cost savings
 * - optimizeCost: One-stop optimization helper
 */

import { test, expect } from '@playwright/test';
import {
  validateScreenshot,
  optimizeCost
} from '@arclabs561/ai-visual-test';

test.describe('Auto-Optimization Examples', () => {
  
  test('auto-select tier for routine tests', async ({ page }) => {
    // NEW: Use autoSelectTier flag - no manual tier selection needed
    await page.goto('https://example.com');
    await page.waitForLoadState('networkidle');
    
    const screenshotPath = `test-results/auto-tier-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    
    // Auto-select tier based on context
    const result = await validateScreenshot(
      screenshotPath,
      'Evaluate accessibility',
      {
        autoSelectTier: true, // NEW: Automatic tier selection
        costSensitive: true,
        testType: 'routine',
        criticality: 'low'
      }
    );
    
    expect(result.enabled).toBe(true);
    expect(result.score).not.toBeNull();
    
    console.log(`Auto-selected tier used`);
    console.log(`Cost: $${result.estimatedCost?.totalCost || '0.000000'}`);
    // Tier automatically selected as 'fast' for cost-sensitive routine tests
  });
  
  test('auto-select provider for cost optimization', async ({ page }) => {
    // NEW: Use autoSelectProvider flag
    await page.goto('https://example.com');
    await page.waitForLoadState('networkidle');
    
    const screenshotPath = `test-results/auto-provider-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    
    const result = await validateScreenshot(
      screenshotPath,
      'Evaluate accessibility',
      {
        autoSelectProvider: true, // NEW: Automatic provider selection
        costSensitive: true
      }
    );
    
    expect(result.enabled).toBe(true);
    expect(result.provider).toBeDefined();
    
    console.log(`Auto-selected provider: ${result.provider}`);
    // Provider automatically selected as cheapest available (e.g., 'gemini')
  });
  
  test('cost comparison in results', async ({ page }) => {
    // NEW: Include cost comparison in results
    await page.goto('https://example.com');
    await page.waitForLoadState('networkidle');
    
    const screenshotPath = `test-results/cost-compare-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    
    const result = await validateScreenshot(
      screenshotPath,
      'Evaluate accessibility',
      {
        includeCostComparison: true, // NEW: Include cost comparison
        modelTier: 'balanced'
      }
    );
    
    expect(result.enabled).toBe(true);
    expect(result.costComparison).toBeDefined();
    
    console.log(`Current tier: ${result.costComparison.current.tier}`);
    console.log(`Cost: $${result.costComparison.current.cost}`);
    console.log(`Savings vs fast: ${result.costComparison.savings.fast?.percent || 0}%`);
    console.log(`Recommendation: ${result.costComparison.recommendation.reason}`);
  });
  
  test('optimizeCost helper function', async ({ page }) => {
    // NEW: One-stop optimization helper
    await page.goto('https://example.com');
    await page.waitForLoadState('networkidle');
    
    // Get optimal configuration
    const optimization = optimizeCost({
      frequency: 60,
      costSensitive: true,
      budget: 0.01 // $0.01 per validation
    });
    
    expect(optimization.recommendedTier).toBeDefined();
    expect(optimization.recommendedProvider).toBeDefined();
    expect(optimization.estimatedCost).toBeGreaterThan(0);
    
    console.log(`Recommended: ${optimization.recommendedProvider} ${optimization.recommendedTier}`);
    console.log(`Estimated cost: $${optimization.estimatedCost.toFixed(6)}`);
    console.log(`Savings: ${optimization.savings.vsBalanced || 'N/A'}`);
    console.log(`Within budget: ${optimization.withinBudget}`);
    console.log(`Recommendation: ${optimization.recommendation}`);
    
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
    // NEW: Combine all auto-optimization features
    await page.goto('https://example.com');
    await page.waitForLoadState('networkidle');
    
    const screenshotPath = `test-results/combined-auto-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    
    const result = await validateScreenshot(
      screenshotPath,
      'Evaluate accessibility',
      {
        autoSelectTier: true,      // Auto-select tier
        autoSelectProvider: true,  // Auto-select provider
        includeCostComparison: true, // Include cost comparison
        costSensitive: true,
        frequency: 60
      }
    );
    
    expect(result.enabled).toBe(true);
    expect(result.costComparison).toBeDefined();
    
    console.log(`Auto-optimized validation complete`);
    console.log(`Tier: ${result.costComparison.current.tier}`);
    console.log(`Provider: ${result.provider}`);
    console.log(`Cost: $${result.estimatedCost?.totalCost || '0.000000'}`);
    console.log(`Savings: ${result.costComparison.savings.fast?.percent || 0}% vs fast tier`);
  });
});

