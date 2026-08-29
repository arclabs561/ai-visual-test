/** Cost comparison and configuration-selection helpers. */

import { selectModelTierAndProvider, type ProviderRequirements } from './model-tier-selector.js';
import { createConfig, getProvider, type Config } from './config.js';

export type ModelTier = 'fast' | 'balanced' | 'best';
export type Frequency = 'high' | 'medium' | 'low' | number;
export interface CostOptimizationContext {
  modelTier?: ModelTier | string;
  frequency?: Frequency;
  criticality?: string;
  costSensitive?: boolean;
}
export interface CurrentValidationResult {
  provider?: string | null;
  estimatedCost?: { totalCost?: string | number | null };
}
export interface TierCosts { fast: number; balanced: number; best: number; }
export interface TierSaving { absolute: number; percent: number; cost: number; }
export interface CostRecommendation { tier: ModelTier; cost: number; savings: number; savingsPercent: number; reason: string; }
export interface CostComparison {
  current: { tier: string; provider: string; cost: number };
  tiers: TierCosts;
  savings: Partial<Record<ModelTier, TierSaving>>;
  recommendation: CostRecommendation;
}
export interface OptimizeCostOptions extends CostOptimizationContext {
  budget?: number;
  requirements?: ProviderRequirements;
}
export interface CostComparisonEntry { cost: number; savings: number; savingsPercent: number; }
export interface CostOptimizationResult {
  recommendedTier: string;
  recommendedProvider: string;
  estimatedCost: number;
  savings: Record<string, string>;
  config: Config;
  reason: string;
  withinBudget: boolean | null;
  comparisons: Partial<Record<ModelTier, CostComparisonEntry>>;
  recommendation: string;
}

const TIERS: ModelTier[] = ['fast', 'balanced', 'best'];
const DEFAULT_PRICING = { input: 0, output: 0 };

function asCost(value: string | number | null | undefined): number {
  return Number.parseFloat(String(value ?? '0'));
}

function getCostOptimizationRecommendation(context: CostOptimizationContext, currentCost: number, tierCosts: TierCosts): CostRecommendation {
  const { frequency, criticality, costSensitive } = context;
  const tier: ModelTier = frequency === 'high' || (typeof frequency === 'number' && frequency >= 10) || costSensitive
    ? 'fast'
    : criticality === 'critical' ? 'best' : 'balanced';
  const cost = tierCosts[tier] || currentCost;
  const savings = currentCost - cost;
  return { tier, cost, savings, savingsPercent: currentCost > 0 ? (savings / currentCost) * 100 : 0, reason: getRecommendationReason(context, tier) };
}

function getRecommendationReason(context: CostOptimizationContext, tier: ModelTier): string {
  if (tier === 'fast') {
    if (context.frequency === 'high' || (typeof context.frequency === 'number' && context.frequency >= 10)) return 'High-frequency validation requires fast tier';
    if (context.costSensitive) return 'Cost-sensitive operation, use fast tier';
  }
  return tier === 'best' ? 'Critical evaluation requires best tier for quality' : 'Balanced tier provides speed/quality tradeoff';
}

/** Compare the current estimated spend against the three selection tiers. */
export function calculateCostComparison(context: CostOptimizationContext = {}, currentResult: CurrentValidationResult = {}): CostComparison {
  const currentCost = asCost(currentResult.estimatedCost?.totalCost);
  const provider = currentResult.provider || 'gemini';
  const pricing = getProvider(provider).pricing || DEFAULT_PRICING;
  const cost = (1_000 / 1_000_000) * pricing.input + (500 / 1_000_000) * pricing.output;
  const tiers: TierCosts = { fast: cost, balanced: cost, best: cost };
  const savings: Partial<Record<ModelTier, TierSaving>> = {};
  for (const tier of TIERS) {
    if (tiers[tier] && currentCost > 0) {
      const absolute = currentCost - tiers[tier];
      savings[tier] = { absolute, percent: (absolute / currentCost) * 100, cost: tiers[tier] };
    }
  }
  return { current: { tier: context.modelTier || 'balanced', provider, cost: currentCost }, tiers, savings, recommendation: getCostOptimizationRecommendation(context, currentCost, tiers) };
}

function getSavingsEstimate(tier: string, comparisons: Partial<Record<ModelTier, CostComparisonEntry>>): Record<string, string> {
  if (tier === 'fast') {
    const balanced = comparisons.balanced; const best = comparisons.best;
    return { vsBalanced: balanced && balanced.savings > 0 ? `${balanced.savingsPercent.toFixed(0)}%` : '0%', vsBest: best && best.savings > 0 ? `${best.savingsPercent.toFixed(0)}%` : '0%' };
  }
  if (tier === 'balanced') {
    const fast = comparisons.fast; const best = comparisons.best;
    return { vsFast: fast && fast.savings < 0 ? `${Math.abs(fast.savingsPercent).toFixed(0)}% more expensive` : '0%', vsBest: best && best.savings > 0 ? `${best.savingsPercent.toFixed(0)}%` : '0%' };
  }
  const fast = comparisons.fast; const balanced = comparisons.balanced;
  return { vsFast: fast ? `${Math.abs(fast.savingsPercent).toFixed(0)}% more expensive` : '0%', vsBalanced: balanced ? `${Math.abs(balanced.savingsPercent).toFixed(0)}% more expensive` : '0%' };
}

/** Select a provider and tier, reporting the intentionally rough per-call cost estimate. */
export function optimizeCost(options: OptimizeCostOptions = {}): CostOptimizationResult {
  const { frequency, criticality, costSensitive, budget, requirements = {} } = options;
  const tierContext = { ...(frequency === undefined ? {} : { frequency }), ...(criticality === undefined ? {} : { criticality }), ...(costSensitive === undefined ? {} : { costSensitive }) };
  const providerRequirements: ProviderRequirements = { ...requirements, ...(costSensitive === undefined ? {} : { costSensitive }) };
  const selected = selectModelTierAndProvider({ ...tierContext, requirements: providerRequirements });
  const config = createConfig({ modelTier: selected.tier, provider: selected.provider });
  const pricing = getProvider(selected.provider).pricing || DEFAULT_PRICING;
  const estimatedCost = (1_000 / 1_000_000) * pricing.input + (500 / 1_000_000) * pricing.output;
  const comparisons: Partial<Record<ModelTier, CostComparisonEntry>> = {};
  for (const tier of TIERS) {
    if (tier !== selected.tier) comparisons[tier] = { cost: estimatedCost, savings: 0, savingsPercent: 0 };
  }
  const withinBudget = budget ? estimatedCost <= budget : null;
  const budgetWarning = budget ?? 0;
  return {
    recommendedTier: selected.tier, recommendedProvider: selected.provider, estimatedCost,
    savings: getSavingsEstimate(selected.tier, comparisons), config, reason: selected.reason, withinBudget, comparisons,
    recommendation: withinBudget === false ? `Estimated cost ($${estimatedCost.toFixed(6)}) exceeds budget ($${budgetWarning.toFixed(6)}). Consider using 'fast' tier.` : `Optimal configuration: ${selected.provider} ${selected.tier} tier (estimated: $${estimatedCost.toFixed(6)} per validation)`
  };
}
