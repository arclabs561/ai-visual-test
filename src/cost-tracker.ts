/** Cost tracking, projections, budget alerts, and pre-call estimates. */

import { getCached, setCached } from './cache.js';
import { PROVIDER_CONFIGS } from './provider-data.mjs';
import { ConfigError } from '#errors';

export interface CostRecord {
  provider: string;
  cost: number | null | undefined;
  inputTokens?: number;
  outputTokens?: number;
  timestamp?: number;
  testName?: string;
}
export interface CostEntry { provider: string; cost: number; inputTokens: number; outputTokens: number; timestamp: number; testName: string; date: string; }
export interface CostTotals { total: number; count: number; }
export interface ProviderCosts extends CostTotals { inputTokens: number; outputTokens: number; }
export type DateCosts = CostTotals;
export type BudgetStatusKind = 'ok' | 'warning' | 'exceeded';
export interface BudgetStatus { limit: number; current: number; percentage: number; remaining: number; warningThreshold: number; status: BudgetStatusKind; }
export interface BudgetOptions { warningThreshold?: number; onWarning?: ((status: BudgetStatus) => void) | null; onExceeded?: ((status: BudgetStatus) => void) | null; }
interface Budget extends Required<Pick<BudgetOptions, 'warningThreshold'>> { onWarning: BudgetOptions['onWarning']; onExceeded: BudgetOptions['onExceeded']; limit: number; createdAt: number; }
export interface CostTrackerData extends Record<string, unknown> { history: CostEntry[]; totals: CostTotals; byProvider: Record<string, ProviderCosts>; byDate: Record<string, DateCosts>; budgets?: Budget[]; }
export interface CostTrackerOptions { storageKey?: string; maxHistory?: number; }
export interface CostStats { total: number; count: number; average: number; byProvider: Record<string, ProviderCosts & { average: number }>; byDate: Record<string, DateCosts>; recent: Array<Pick<CostEntry, 'provider' | 'cost' | 'timestamp' | 'testName'>>; }
export interface CostProjection { projected: number; dailyAverage: number; trend: 'increasing' | 'decreasing' | 'stable'; }
export interface ThresholdStatus { exceeded: boolean; current: number; remaining: number; }
export type BudgetSummary = { hasBudgets: false } | { hasBudgets: true; totalBudgets: number; exceeded: number; warnings: number; statuses: BudgetStatus[] };
export interface ExportedCostData extends CostTrackerData { stats: CostStats; projection: CostProjection; }
export interface EstimateCostOptions { imageCount?: number; promptLength?: number; model?: string | null; }
export interface CostEstimate { provider: string; model: string; estimatedInputTokens: number; estimatedOutputTokens: number; estimatedCost: string; currency: 'USD'; }

function defaultCosts(): CostTrackerData { return { history: [], totals: { total: 0, count: 0 }, byProvider: {}, byDate: {} }; }
function asStoredCosts(value: unknown): CostTrackerData | null {
  if (!value || typeof value !== 'object') return null;
  const cached = value as Partial<CostTrackerData>;
  if (!Array.isArray(cached.history)) return null;
  return { history: cached.history, totals: { total: 0, count: 0, ...cached.totals }, byProvider: cached.byProvider ?? {}, byDate: cached.byDate ?? {}, ...(Array.isArray(cached.budgets) ? { budgets: cached.budgets } : {}) };
}

/** Tracks API costs across validations and persists a bounded history. */
export class CostTracker {
  public storageKey: string;
  public maxHistory: number;
  public costs: CostTrackerData;
  constructor(options: CostTrackerOptions = {}) { this.storageKey = options.storageKey || 'ai-visual-test-costs'; this.maxHistory = options.maxHistory || 1000; this.costs = this.loadCosts(); }
  loadCosts(): CostTrackerData { try { return asStoredCosts(getCached(this.storageKey, 'cost-tracker', {})) ?? defaultCosts(); } catch { return defaultCosts(); } }
  saveCosts(): void { try { setCached(this.storageKey, 'cost-tracker', {}, this.costs); } catch { /* cache is optional */ } }
  recordCost(costData: CostRecord): void {
    const { provider, cost, inputTokens = 0, outputTokens = 0, timestamp = Date.now(), testName = 'unknown' } = costData;
    if (cost === null || cost === undefined) return;
    const entry: CostEntry = { provider, cost, inputTokens, outputTokens, timestamp, testName, date: new Date(timestamp).toISOString().split('T')[0]! };
    this.costs.history.push(entry);
    if (this.costs.history.length > this.maxHistory) this.costs.history = this.costs.history.slice(-this.maxHistory);
    this.costs.totals.total = (this.costs.totals.total || 0) + cost;
    this.costs.totals.count = (this.costs.totals.count || 0) + 1;
    const providerCosts = this.costs.byProvider[provider] ?? (this.costs.byProvider[provider] = { total: 0, count: 0, inputTokens: 0, outputTokens: 0 });
    providerCosts.total += cost; providerCosts.count += 1; providerCosts.inputTokens += inputTokens; providerCosts.outputTokens += outputTokens;
    const dateCosts = this.costs.byDate[entry.date] ?? (this.costs.byDate[entry.date] = { total: 0, count: 0 });
    dateCosts.total += cost; dateCosts.count += 1; this.saveCosts();
  }
  getStats(): CostStats {
    const byProvider: CostStats['byProvider'] = {};
    for (const [provider, data] of Object.entries(this.costs.byProvider)) byProvider[provider] = { ...data, average: data.count > 0 ? data.total / data.count : 0 };
    const total = this.costs.totals.total || 0; const count = this.costs.totals.count || 0;
    return { total, count, average: count > 0 ? total / count : 0, byProvider, byDate: this.costs.byDate || {}, recent: this.costs.history.slice(-10).map(({ provider, cost, timestamp, testName }) => ({ provider, cost, timestamp, testName })) };
  }
  getProjection(days = 30): CostProjection {
    const stats = this.getStats(); const dates = Object.keys(stats.byDate);
    const dailyAverage = Object.values(stats.byDate).reduce((sum, day) => sum + day.total, 0) / Math.max(dates.length, 1);
    const trendDates = dates.sort().slice(-14); let trend: CostProjection['trend'] = 'stable';
    if (trendDates.length >= 14) {
      const recent = trendDates.slice(-7).reduce((sum, date) => sum + (stats.byDate[date]?.total || 0), 0);
      const previous = trendDates.slice(0, 7).reduce((sum, date) => sum + (stats.byDate[date]?.total || 0), 0);
      if (recent > previous * 1.1) trend = 'increasing'; else if (recent < previous * 0.9) trend = 'decreasing';
    }
    return { projected: dailyAverage * days, dailyAverage, trend };
  }
  checkThreshold(threshold: number): ThresholdStatus { const current = this.getStats().total; return { exceeded: current >= threshold, current, remaining: Math.max(0, threshold - current) }; }
  setBudgetLimit(budgetLimit: number, options: BudgetOptions = {}): void {
    const { warningThreshold = 0.8, onWarning = null, onExceeded = null } = options;
    if (!this.costs.budgets) this.costs.budgets = [];
    this.costs.budgets.push({ limit: budgetLimit, warningThreshold, onWarning, onExceeded, createdAt: Date.now() }); this.saveCosts(); this.checkBudgets();
  }
  checkBudgets(): BudgetStatus[] {
    if (!this.costs.budgets?.length) return [];
    const current = this.getStats().total;
    return this.costs.budgets.map((budget) => {
      const percentage = current / budget.limit;
      const status: BudgetStatus = { limit: budget.limit, current, percentage, remaining: Math.max(0, budget.limit - current), warningThreshold: budget.warningThreshold, status: percentage >= 1 ? 'exceeded' : percentage >= budget.warningThreshold ? 'warning' : 'ok' };
      const callback = percentage >= 1 ? budget.onExceeded : percentage >= budget.warningThreshold ? budget.onWarning : null;
      try { callback?.(status); } catch { /* callbacks must not disrupt validation */ }
      return status;
    });
  }
  getBudgetStatus(): BudgetSummary {
    const statuses = this.checkBudgets(); if (statuses.length === 0) return { hasBudgets: false };
    return { hasBudgets: true, totalBudgets: statuses.length, exceeded: statuses.filter((status) => status.status === 'exceeded').length, warnings: statuses.filter((status) => status.status === 'warning').length, statuses };
  }
  reset(): void { this.costs = defaultCosts(); this.saveCosts(); }
  export(): ExportedCostData { return { ...this.costs, stats: this.getStats(), projection: this.getProjection(30) }; }
}

let globalCostTracker: CostTracker | null = null;
export function getCostTracker(options: CostTrackerOptions = {}): CostTracker { globalCostTracker ??= new CostTracker(options); return globalCostTracker; }
export function recordCost(costData: CostRecord): void { getCostTracker().recordCost(costData); }
export function getCostStats(): CostStats { return getCostTracker().getStats(); }
export function setBudgetLimit(budgetLimit: number, options: BudgetOptions = {}): void { getCostTracker().setBudgetLimit(budgetLimit, options); }
export function getBudgetStatus(): BudgetSummary { return getCostTracker().getBudgetStatus(); }

const DEFAULT_TOKENS_PER_IMAGE = 1500;
const DEFAULT_PROMPT_TOKENS = 50;
const DEFAULT_OUTPUT_TOKENS = 500;
interface ProviderPricingConfig { model: string; pricing: { input: number; output: number }; }
const providerConfigs = PROVIDER_CONFIGS as Record<string, ProviderPricingConfig>;

/** Estimate a validation call before execution; this is an approximate CI budget, not billing data. */
export function estimateCost(provider: string, options: EstimateCostOptions = {}): CostEstimate {
  const { imageCount = 1, promptLength = 100, model = null } = options;
  const config = providerConfigs[provider];
  if (!config) throw new ConfigError(`Unknown provider "${provider}". Known providers: ${Object.keys(providerConfigs).join(', ')}`);
  const estimatedInputTokens = Math.max(DEFAULT_PROMPT_TOKENS, Math.ceil(promptLength / 4)) + imageCount * DEFAULT_TOKENS_PER_IMAGE;
  const estimatedOutputTokens = DEFAULT_OUTPUT_TOKENS;
  const totalCost = (estimatedInputTokens / 1_000_000) * config.pricing.input + (estimatedOutputTokens / 1_000_000) * config.pricing.output;
  return { provider, model: model || config.model, estimatedInputTokens, estimatedOutputTokens, estimatedCost: totalCost.toFixed(6), currency: 'USD' };
}
