/**
 * Cost Tracking Utilities
 * 
 * Tracks API costs over time, provides cost estimates, and helps optimize spending.
 * Includes budget limits and alerting.
 */

import { getCached, setCached } from './cache.mjs';
import { warn, log } from './logger.mjs';
import { PROVIDER_CONFIGS, MODEL_TIERS } from './provider-data.mjs';

/**
 * Cost Tracker Class
 * 
 * Tracks costs across multiple validations and provides cost analysis.
 */
export class CostTracker {
  constructor(options = {}) {
    this.storageKey = options.storageKey || 'ai-visual-test-costs';
    this.maxHistory = options.maxHistory || 1000;
    this.costs = this.loadCosts();
  }

  /**
   * Load costs from cache/storage
   */
  loadCosts() {
    const defaultCosts = { history: [], totals: { total: 0, count: 0 }, byProvider: {}, byDate: {} };
    try {
      const cached = getCached(this.storageKey, 'cost-tracker', {});
      if (cached && typeof cached === 'object' && cached.history) {
        // Ensure all required properties exist
        return {
          history: cached.history || [],
          totals: { total: 0, count: 0, ...cached.totals },
          byProvider: cached.byProvider || {},
          byDate: cached.byDate || {}
        };
      }
      return defaultCosts;
    } catch {
      return defaultCosts;
    }
  }

  /**
   * Save costs to cache/storage
   */
  saveCosts() {
    try {
      setCached(this.storageKey, 'cost-tracker', this.costs, {});
    } catch {
      // Silently fail if cache unavailable
    }
  }

  /**
   * Record a cost
   * 
   * @param {{
   *   provider: string;
   *   cost: number;
   *   inputTokens?: number;
   *   outputTokens?: number;
   *   timestamp?: number;
   *   testName?: string;
   * }} costData - Cost data to record
   */
  recordCost(costData) {
    const {
      provider,
      cost,
      inputTokens = 0,
      outputTokens = 0,
      timestamp = Date.now(),
      testName = 'unknown'
    } = costData;

    if (cost === null || cost === undefined) return; // Skip null costs

    const entry = {
      provider,
      cost,
      inputTokens,
      outputTokens,
      timestamp,
      testName,
      date: new Date(timestamp).toISOString().split('T')[0] // YYYY-MM-DD
    };

    // Add to history
    this.costs.history.push(entry);

    // Trim history if too long
    if (this.costs.history.length > this.maxHistory) {
      this.costs.history = this.costs.history.slice(-this.maxHistory);
    }

    // Update totals
    this.costs.totals.total = (this.costs.totals.total || 0) + cost;
    this.costs.totals.count = (this.costs.totals.count || 0) + 1;

    // Update by provider
    if (!this.costs.byProvider[provider]) {
      this.costs.byProvider[provider] = { total: 0, count: 0, inputTokens: 0, outputTokens: 0 };
    }
    this.costs.byProvider[provider].total += cost;
    this.costs.byProvider[provider].count += 1;
    this.costs.byProvider[provider].inputTokens += inputTokens;
    this.costs.byProvider[provider].outputTokens += outputTokens;

    // Update by date
    if (!this.costs.byDate) {
      this.costs.byDate = {};
    }
    if (!this.costs.byDate[entry.date]) {
      this.costs.byDate[entry.date] = { total: 0, count: 0 };
    }
    this.costs.byDate[entry.date].total += cost;
    this.costs.byDate[entry.date].count += 1;

    this.saveCosts();
  }

  /**
   * Get cost statistics
   * 
   * @returns {{
   *   total: number;
   *   count: number;
   *   average: number;
   *   byProvider: Record<string, { total: number; count: number; average: number }>;
   *   byDate: Record<string, { total: number; count: number }>;
   *   recent: Array<{ provider: string; cost: number; timestamp: number }>;
   * }} Cost statistics
   */
  getStats() {
    const stats = {
      total: this.costs.totals.total || 0,
      count: this.costs.totals.count || 0,
      average: 0,
      byProvider: {},
      byDate: this.costs.byDate || {},
      recent: this.costs.history.slice(-10).map(e => ({
        provider: e.provider,
        cost: e.cost,
        timestamp: e.timestamp,
        testName: e.testName
      }))
    };

    if (stats.count > 0) {
      stats.average = stats.total / stats.count;
    }

    // Calculate averages by provider
    for (const [provider, data] of Object.entries(this.costs.byProvider)) {
      stats.byProvider[provider] = {
        total: data.total,
        count: data.count,
        average: data.count > 0 ? data.total / data.count : 0,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens
      };
    }

    return stats;
  }

  /**
   * Get cost projection
   * 
   * @param {number} [days=30] - Number of days to project
   * @returns {{ projected: number; dailyAverage: number; trend: 'increasing' | 'decreasing' | 'stable' }} Projection
   */
  getProjection(days = 30) {
    const stats = this.getStats();
    const dailyAverage = stats.byDate ? 
      Object.values(stats.byDate).reduce((sum, day) => sum + day.total, 0) / 
      Math.max(Object.keys(stats.byDate).length, 1) : 0;
    
    const projected = dailyAverage * days;

    // Simple trend detection (last 7 days vs previous 7 days)
    const dates = Object.keys(stats.byDate || {}).sort().slice(-14);
    let trend = 'stable';
    if (dates.length >= 14) {
      const recent = dates.slice(-7).reduce((sum, d) => sum + (stats.byDate[d]?.total || 0), 0);
      const previous = dates.slice(0, 7).reduce((sum, d) => sum + (stats.byDate[d]?.total || 0), 0);
      if (recent > previous * 1.1) trend = 'increasing';
      else if (recent < previous * 0.9) trend = 'decreasing';
    }

    return { projected, dailyAverage, trend };
  }

  /**
   * Check if cost exceeds threshold
   * 
   * @param {number} threshold - Cost threshold
   * @returns {{ exceeded: boolean; current: number; remaining: number }} Threshold check
   */
  checkThreshold(threshold) {
    const current = this.getStats().total;
    return {
      exceeded: current >= threshold,
      current,
      remaining: Math.max(0, threshold - current)
    };
  }

  /**
   * Set budget limit with alert thresholds
   * 
   * @param {number} budgetLimit - Total budget limit (USD)
   * @param {Object} [options={}] - Budget options
   * @param {number} [options.warningThreshold=0.8] - Warn at this percentage (0-1)
   * @param {Function} [options.onWarning] - Callback when warning threshold reached
   * @param {Function} [options.onExceeded] - Callback when budget exceeded
   */
  setBudgetLimit(budgetLimit, options = {}) {
    const { warningThreshold = 0.8, onWarning = null, onExceeded = null } = options;
    
    if (!this.costs.budgets) {
      this.costs.budgets = [];
    }
    
    const budget = {
      limit: budgetLimit,
      warningThreshold,
      onWarning,
      onExceeded,
      createdAt: Date.now()
    };
    
    this.costs.budgets.push(budget);
    this.saveCosts();
    
    // Check immediately
    this.checkBudgets();
  }

  /**
   * Check all budget limits and trigger alerts
   * 
   * @returns {Array} Array of budget status objects
   */
  checkBudgets() {
    if (!this.costs.budgets || this.costs.budgets.length === 0) {
      return [];
    }
    
    const stats = this.getStats();
    const current = stats.total;
    const statuses = [];
    
    for (const budget of this.costs.budgets) {
      const percentage = current / budget.limit;
      const status = {
        limit: budget.limit,
        current,
        percentage,
        remaining: Math.max(0, budget.limit - current),
        warningThreshold: budget.warningThreshold,
        status: percentage >= 1 ? 'exceeded' : (percentage >= budget.warningThreshold ? 'warning' : 'ok')
      };
      
      statuses.push(status);
      
      // Trigger callbacks
      if (percentage >= 1 && budget.onExceeded) {
        try {
          budget.onExceeded(status);
        } catch (err) {
          // Don't fail if callback errors
        }
      } else if (percentage >= budget.warningThreshold && budget.onWarning) {
        try {
          budget.onWarning(status);
        } catch (err) {
          // Don't fail if callback errors
        }
      }
    }
    
    return statuses;
  }

  /**
   * Get budget status
   * 
   * @returns {Object} Budget status summary
   */
  getBudgetStatus() {
    const statuses = this.checkBudgets();
    if (statuses.length === 0) {
      return { hasBudgets: false };
    }
    
    const exceeded = statuses.filter(s => s.status === 'exceeded');
    const warnings = statuses.filter(s => s.status === 'warning');
    
    return {
      hasBudgets: true,
      totalBudgets: statuses.length,
      exceeded: exceeded.length,
      warnings: warnings.length,
      statuses
    };
  }

  /**
   * Reset cost tracking
   */
  reset() {
    this.costs = { history: [], totals: {}, byProvider: {}, byDate: {} };
    this.saveCosts();
  }

  /**
   * Export cost data
   * 
   * @returns {object} Cost data for export
   */
  export() {
    return {
      ...this.costs,
      stats: this.getStats(),
      projection: this.getProjection(30)
    };
  }
}

/**
 * Global cost tracker instance
 */
let globalCostTracker = null;

/**
 * Get or create global cost tracker
 * 
 * @param {object} [options] - Cost tracker options
 * @returns {CostTracker} Cost tracker instance
 */
export function getCostTracker(options = {}) {
  if (!globalCostTracker) {
    globalCostTracker = new CostTracker(options);
  }
  return globalCostTracker;
}

/**
 * Record cost (convenience function)
 * 
 * @param {object} costData - Cost data
 */
export function recordCost(costData) {
  const tracker = getCostTracker();
  tracker.recordCost(costData);
}

/**
 * Get cost statistics (convenience function)
 * 
 * @returns {object} Cost statistics
 */
export function getCostStats() {
  return getCostTracker().getStats();
}

/**
 * Set budget limit (convenience function)
 * 
 * @param {number} budgetLimit - Budget limit in USD
 * @param {Object} [options={}] - Budget options
 */
export function setBudgetLimit(budgetLimit, options = {}) {
  const tracker = getCostTracker();
  tracker.setBudgetLimit(budgetLimit, options);
}

/**
 * Get budget status (convenience function)
 * 
 * @returns {Object} Budget status
 */
export function getBudgetStatus() {
  return getCostTracker().getBudgetStatus();
}

// Token estimation defaults for pre-call cost estimation
const DEFAULT_TOKENS_PER_IMAGE = 1500;
const DEFAULT_PROMPT_TOKENS = 50;
const DEFAULT_OUTPUT_TOKENS = 500;

/**
 * Estimate cost of a validation call before making it.
 *
 * Uses PROVIDER_CONFIGS pricing (per 1M tokens) and rough token estimates
 * for images and prompts. Intended for CI budgeting, not exact billing.
 *
 * @param {string} provider - Provider name (gemini, openai, claude, groq, openrouter)
 * @param {Object} [options={}] - Estimation options
 * @param {number} [options.imageCount=1] - Number of images to validate
 * @param {number} [options.promptLength=100] - Approximate prompt character length
 * @param {string|null} [options.model=null] - Model override (defaults to provider default)
 * @returns {{
 *   provider: string;
 *   model: string;
 *   estimatedInputTokens: number;
 *   estimatedOutputTokens: number;
 *   estimatedCost: string;
 *   currency: string;
 * }}
 */
export function estimateCost(provider, options = {}) {
  const {
    imageCount = 1,
    promptLength = 100,
    model = null
  } = options;

  const config = PROVIDER_CONFIGS[provider];
  if (!config) {
    const known = Object.keys(PROVIDER_CONFIGS).join(', ');
    throw new Error(`Unknown provider "${provider}". Known providers: ${known}`);
  }

  const resolvedModel = model || config.model;

  // Estimate prompt tokens: ~4 chars per token is a common heuristic
  const promptTokens = Math.max(DEFAULT_PROMPT_TOKENS, Math.ceil(promptLength / 4));
  const imageTokens = imageCount * DEFAULT_TOKENS_PER_IMAGE;
  const estimatedInputTokens = promptTokens + imageTokens;
  const estimatedOutputTokens = DEFAULT_OUTPUT_TOKENS;

  const inputCost = (estimatedInputTokens / 1_000_000) * config.pricing.input;
  const outputCost = (estimatedOutputTokens / 1_000_000) * config.pricing.output;
  const totalCost = inputCost + outputCost;

  return {
    provider,
    model: resolvedModel,
    estimatedInputTokens,
    estimatedOutputTokens,
    estimatedCost: totalCost.toFixed(6),
    currency: 'USD'
  };
}

