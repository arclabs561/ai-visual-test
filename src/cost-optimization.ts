/** Cost comparison and configuration-selection helpers. */

import { selectModelTierAndProvider, type ProviderRequirements } from './model-tier-selector.js';
import { createConfig, getProvider, type Config } from './config.js';

export type ModelTier = 'fast' | 'balanced' | 'best';
export type Frequency = 'high' | 'medium' | 'low' | number;
export interface CostOptimizationContext {
  /** Per-million-token rates keyed by the provider's model IDs. */
  modelPrices?: Record<string, { input: number; output: number }>;
  modelTier?: ModelTier | string;
  frequency?: Frequency;
  criticality?: string;
  costSensitive?: boolean;
}
export interface CurrentValidationResult {
  provider?: string | null;
  model?: string | null;
  estimatedCost?: { totalCost?: string | number | null; inputTokens?: number; outputTokens?: number };
}
export type TierCosts = Record<ModelTier, number | null>;
export interface TierSaving { absolute: number; percent: number; cost: number; }
export interface CostRecommendation { tier: ModelTier; cost: number | null; savings: number | null; savingsPercent: number | null; reason: string; }
export interface CostComparison {
  current: { tier: string; provider: string; cost: number | null };
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
  estimatedCost: number | null;
  savings: Record<string, string>;
  config: Config;
  reason: string;
  withinBudget: boolean | null;
  comparisons: Partial<Record<ModelTier, CostComparisonEntry>>;
  recommendation: string;
}

const TIERS: ModelTier[] = ['fast', 'balanced', 'best'];
function priceFor(provider: string, model: string, context: CostOptimizationContext, input?: number, output?: number): number | null {
  const base = getProvider(provider);
  const rate = context.modelPrices?.[model] ?? (base.model === model ? base.pricing : undefined);
  if (!rate || input === undefined || output === undefined ||
      ![rate.input, rate.output, input, output].every(n => Number.isFinite(n) && n >= 0)) return null;
  return (rate.input * input + rate.output * output) / 1_000_000;
}

function getCostOptimizationRecommendation(context: CostOptimizationContext, currentCost: number | null, tierCosts: TierCosts): CostRecommendation {
  const { frequency, criticality, costSensitive } = context;
  const tier: ModelTier = frequency === 'high' || (typeof frequency === 'number' && frequency >= 10) || costSensitive
    ? 'fast'
    : criticality === 'critical' ? 'best' : 'balanced';
  const cost = tierCosts[tier];
  const savings = currentCost !== null && cost !== null ? currentCost - cost : null;
  return { tier, cost, savings, savingsPercent: currentCost && savings !== null ? 100 * savings / currentCost : null, reason: getRecommendationReason(context, tier) };
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
  const usage = currentResult.estimatedCost;
  const raw = usage?.totalCost;
  const parsed = raw == null || String(raw).trim() === '' ? NaN : Number(raw);
  const currentCost = Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  const provider = currentResult.provider || 'gemini';
  const selectedTier = TIERS.find(tier => tier === context.modelTier) ?? 'balanced';
  const observed = currentResult.model ?? createConfig({ provider, modelTier: selectedTier }).providerConfig.model;
  const tiers: TierCosts = { fast: null, balanced: null, best: null };
  const savings: Partial<Record<ModelTier, TierSaving>> = {};
  for (const tier of TIERS) {
    const model = createConfig({ provider, modelTier: tier }).providerConfig.model;
    const cost = model === observed && currentCost !== null ? currentCost
      : priceFor(provider, model, context, usage?.inputTokens, usage?.outputTokens);
    tiers[tier] = cost;
    if (cost !== null && currentCost !== null && currentCost > 0) {
      const absolute = currentCost - cost;
      savings[tier] = { absolute, percent: (absolute / currentCost) * 100, cost };
    }
  }
  return { current: { tier: context.modelTier || 'balanced', provider, cost: currentCost }, tiers, savings, recommendation: getCostOptimizationRecommendation(context, currentCost, tiers) };
}

/** Select a provider and tier, reporting the intentionally rough per-call cost estimate. */
export function optimizeCost(options: OptimizeCostOptions = {}): CostOptimizationResult {
  const { frequency, criticality, costSensitive, budget, requirements = {} } = options;
  const tierContext = { ...(frequency === undefined ? {} : { frequency }), ...(criticality === undefined ? {} : { criticality }), ...(costSensitive === undefined ? {} : { costSensitive }) };
  const providerRequirements: ProviderRequirements = { ...requirements, ...(costSensitive === undefined ? {} : { costSensitive }) };
  const selected = selectModelTierAndProvider({ ...tierContext, requirements: providerRequirements });
  const config = createConfig({ modelTier: selected.tier, provider: selected.provider });
  const estimatedCost = priceFor(selected.provider, config.providerConfig.model, options, 1000, 500);
  const comparisons: Partial<Record<ModelTier, CostComparisonEntry>> = {};
  const savings: Record<string, string> = {};
  for (const tier of TIERS) {
    if (tier === selected.tier || estimatedCost === null) continue;
    const model = createConfig({ provider: selected.provider, modelTier: tier }).providerConfig.model;
    const cost = priceFor(selected.provider, model, options, 1000, 500);
    if (cost === null || cost === 0) continue;
    const difference = cost - estimatedCost;
    const percent = difference / cost * 100;
    comparisons[tier] = { cost, savings: difference, savingsPercent: percent };
    savings['vs' + tier[0]!.toUpperCase() + tier.slice(1)] = percent < 0
      ? `${Math.abs(percent).toFixed(0)}% more expensive` : `${percent.toFixed(0)}%`;
  }
  const withinBudget = budget === undefined || estimatedCost === null ? null : estimatedCost <= budget;
  const recommendation = estimatedCost === null ? `Price unavailable for ${config.providerConfig.model}`
    : `${config.providerConfig.model}: $${estimatedCost.toFixed(6)} for 1,000 input and 500 output tokens`;
  return {
    recommendedTier: selected.tier, recommendedProvider: selected.provider, estimatedCost,
    savings, config, reason: selected.reason, withinBudget, comparisons, recommendation
  };
}
