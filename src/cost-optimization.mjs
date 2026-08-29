/**
 * Cost Optimization Utilities
 * 
 * Helper functions for cost optimization and comparison.
 * Extends existing cost tracking with comparison and optimization recommendations.
 */

import { selectModelTier, selectProvider, selectModelTierAndProvider } from './model-tier-selector.mjs';
import { createConfig, getProvider } from './config.js';

/**
 * Calculate cost comparison across tiers
 * 
 * @param {Object} context - Validation context
 * @param {Object} currentResult - Current validation result
 * @returns {Object} Cost comparison with savings information
 */
export function calculateCostComparison(context = {}, currentResult = {}) {
  const currentCost = parseFloat(currentResult.estimatedCost?.totalCost || '0');
  const currentTier = context.modelTier || 'balanced';
  const currentProvider = currentResult.provider || 'gemini';
  
  // Get pricing for current provider
  const providerInfo = getProvider(currentProvider);
  const currentPricing = providerInfo?.pricing || { input: 0, output: 0 };
  
  // Estimate costs for other tiers (rough estimate based on typical token usage)
  // Typical: ~1000 input tokens, ~500 output tokens
  const typicalInputTokens = 1000;
  const typicalOutputTokens = 500;
  
  // Get tier costs (simplified - assumes same pricing per provider)
  // In reality, different models have different pricing, but this gives rough comparison
  const tierCosts = {};
  for (const tier of ['fast', 'balanced', 'best']) {
    // Simplified: use current provider pricing for all tiers
    // Real implementation would look up actual model pricing
    const inputCost = (typicalInputTokens / 1_000_000) * currentPricing.input;
    const outputCost = (typicalOutputTokens / 1_000_000) * currentPricing.output;
    tierCosts[tier] = inputCost + outputCost;
  }
  
  // Calculate savings
  const savings = {};
  for (const tier of ['fast', 'balanced', 'best']) {
    if (tierCosts[tier] && currentCost > 0) {
      const diff = currentCost - tierCosts[tier];
      const percent = (diff / currentCost) * 100;
      savings[tier] = {
        absolute: diff,
        percent: percent,
        cost: tierCosts[tier]
      };
    }
  }
  
  return {
    current: {
      tier: currentTier,
      provider: currentProvider,
      cost: currentCost
    },
    tiers: tierCosts,
    savings: savings,
    recommendation: getCostOptimizationRecommendation(context, currentCost, tierCosts)
  };
}

/**
 * Get cost optimization recommendation
 * 
 * @param {Object} context - Validation context
 * @param {number} currentCost - Current cost
 * @param {Object} tierCosts - Costs for each tier
 * @returns {Object} Recommendation with tier, provider, and expected savings
 */
function getCostOptimizationRecommendation(context, currentCost, tierCosts) {
  const { frequency, criticality, costSensitive } = context;
  
  // Determine optimal tier
  let recommendedTier = 'balanced';
  if (frequency === 'high' || frequency >= 10 || costSensitive) {
    recommendedTier = 'fast';
  } else if (criticality === 'critical') {
    recommendedTier = 'best';
  }
  
  // Get recommended cost
  const recommendedCost = tierCosts[recommendedTier] || currentCost;
  const savings = currentCost - recommendedCost;
  const savingsPercent = currentCost > 0 ? (savings / currentCost) * 100 : 0;
  
  return {
    tier: recommendedTier,
    cost: recommendedCost,
    savings: savings,
    savingsPercent: savingsPercent,
    reason: getRecommendationReason(context, recommendedTier)
  };
}

/**
 * Get reason for recommendation
 */
function getRecommendationReason(context, tier) {
  if (tier === 'fast') {
    if (context.frequency === 'high' || context.frequency >= 10) {
      return 'High-frequency validation requires fast tier';
    }
    if (context.costSensitive) {
      return 'Cost-sensitive operation, use fast tier';
    }
  }
  if (tier === 'best') {
    return 'Critical evaluation requires best tier for quality';
  }
  return 'Balanced tier provides speed/quality tradeoff';
}

/**
 * Optimize cost configuration
 * 
 * Function to get configuration for cost optimization.
 * 
 * @param {Object} options - Optimization options
 * @param {string|number} [options.frequency] - Decision frequency ('high'|'medium'|'low' or Hz)
 * @param {string} [options.criticality] - Criticality level ('critical'|'high'|'medium'|'low')
 * @param {boolean} [options.costSensitive] - Cost-sensitive operation
 * @param {number} [options.budget] - Budget per validation (optional)
 * @param {Object} [options.requirements] - Provider requirements
 * @returns {Object} Optimization result with config, recommendations, and cost estimates
 */
export function optimizeCost(options = {}) {
  const {
    frequency,
    criticality,
    costSensitive,
    budget,
    requirements = {}
  } = options;
  
  // Select tier and provider
  const { tier, provider, reason } = selectModelTierAndProvider({
    frequency,
    criticality,
    costSensitive,
    requirements: {
      ...requirements,
      costSensitive,
      env: process.env
    }
  });
  
  // Create config
  const config = createConfig({
    modelTier: tier,
    provider
  });
  
  // Estimate cost (rough estimate)
  const providerInfo = getProvider(provider);
  const pricing = providerInfo?.pricing || { input: 0, output: 0 };
  const typicalInputTokens = 1000;
  const typicalOutputTokens = 500;
  const estimatedCost = (typicalInputTokens / 1_000_000) * pricing.input + 
                        (typicalOutputTokens / 1_000_000) * pricing.output;
  
  // Compare with other tiers (simplified - assumes same pricing)
  // Real implementation would look up actual model pricing for each tier
  const comparisons = {};
  for (const otherTier of ['fast', 'balanced', 'best']) {
    if (otherTier !== tier) {
      // Simplified: use same pricing (in reality, different models have different pricing)
      const otherCost = estimatedCost; // Placeholder - would use actual model pricing
      comparisons[otherTier] = {
        cost: otherCost,
        savings: estimatedCost - otherCost,
        savingsPercent: estimatedCost > 0 ? ((estimatedCost - otherCost) / estimatedCost) * 100 : 0
      };
    }
  }
  
  // Check if within budget
  const withinBudget = budget ? estimatedCost <= budget : null;
  
  return {
    recommendedTier: tier,
    recommendedProvider: provider,
    estimatedCost: estimatedCost,
    savings: getSavingsEstimate(tier, provider, comparisons),
    config: config,
    reason: reason,
    withinBudget: withinBudget,
    comparisons: comparisons,
    recommendation: withinBudget === false 
      ? `Estimated cost ($${estimatedCost.toFixed(6)}) exceeds budget ($${budget.toFixed(6)}). Consider using 'fast' tier.`
      : `Optimal configuration: ${provider} ${tier} tier (estimated: $${estimatedCost.toFixed(6)} per validation)`
  };
}

/**
 * Get savings estimate
 */
function getSavingsEstimate(tier, provider, comparisons) {
  if (tier === 'fast') {
    // Fast tier saves vs balanced/best
    const balancedSavings = comparisons.balanced?.savings || 0;
    const bestSavings = comparisons.best?.savings || 0;
    return {
      vsBalanced: balancedSavings > 0 ? `${(comparisons.balanced.savingsPercent || 0).toFixed(0)}%` : '0%',
      vsBest: bestSavings > 0 ? `${(comparisons.best.savingsPercent || 0).toFixed(0)}%` : '0%'
    };
  }
  if (tier === 'balanced') {
    const fastExtra = comparisons.fast?.savings || 0;
    const bestSavings = comparisons.best?.savings || 0;
    return {
      vsFast: fastExtra < 0 ? `${Math.abs(comparisons.fast?.savingsPercent || 0).toFixed(0)}% more expensive` : '0%',
      vsBest: bestSavings > 0 ? `${(comparisons.best.savingsPercent || 0).toFixed(0)}%` : '0%'
    };
  }
  return {
    vsFast: comparisons.fast ? `${Math.abs(comparisons.fast.savingsPercent || 0).toFixed(0)}% more expensive` : '0%',
    vsBalanced: comparisons.balanced ? `${Math.abs(comparisons.balanced.savingsPercent || 0).toFixed(0)}% more expensive` : '0%'
  };
}
