/**
 * Session-Level Cost Tracker
 * 
 * Tracks costs per test run/session with detailed breakdown and transparency.
 * Provides "trap debug" hooks to show total ML API resources for usage tracking.
 * 
 * Usage:
 * ```javascript
 * import { startSession, endSession, getSessionCosts } from './session-cost-tracker.mjs';
 * 
 * const sessionId = startSession('comprehensive-evaluation');
 * // ... run tests ...
 * const summary = endSession(sessionId);
 * console.log(`Total cost: $${summary.totalCost.toFixed(4)}`);
 * ```
 */

import { getCostTracker, recordCost } from './cost-tracker.mjs';
import { getCacheStats } from './cache.js';
import { log, warn } from './logger.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Active sessions
 */
const activeSessions = new Map();

/**
 * Session cost data structure
 */
class SessionCostData {
  constructor(sessionId, name) {
    this.sessionId = sessionId;
    this.name = name;
    this.startTime = Date.now();
    this.endTime = null;
    this.costs = {
      total: 0,
      byProvider: {},
      byTest: {},
      apiCalls: 0,
      cacheHits: 0,
      cacheMisses: 0,
      tokens: {
        input: 0,
        output: 0,
        total: 0
      }
    };
    this.entries = [];
  }

  recordCostEntry(entry) {
    this.costs.total += entry.cost || 0;
    this.costs.apiCalls += 1;
    
    // Track by provider
    if (!this.costs.byProvider[entry.provider]) {
      this.costs.byProvider[entry.provider] = { total: 0, calls: 0, tokens: { input: 0, output: 0 } };
    }
    this.costs.byProvider[entry.provider].total += entry.cost || 0;
    this.costs.byProvider[entry.provider].calls += 1;
    this.costs.byProvider[entry.provider].tokens.input += entry.inputTokens || 0;
    this.costs.byProvider[entry.provider].tokens.output += entry.outputTokens || 0;
    
    // Track by test
    const testName = entry.testName || 'unknown';
    if (!this.costs.byTest[testName]) {
      this.costs.byTest[testName] = { total: 0, calls: 0 };
    }
    this.costs.byTest[testName].total += entry.cost || 0;
    this.costs.byTest[testName].calls += 1;
    
    // Track tokens
    this.costs.tokens.input += entry.inputTokens || 0;
    this.costs.tokens.output += entry.outputTokens || 0;
    this.costs.tokens.total = this.costs.tokens.input + this.costs.tokens.output;
    
    // Store entry
    this.entries.push({
      ...entry,
      timestamp: entry.timestamp || Date.now()
    });
  }

  recordCacheHit() {
    this.costs.cacheHits += 1;
  }

  recordCacheMiss() {
    this.costs.cacheMisses += 1;
  }

  getSummary() {
    const duration = (this.endTime || Date.now()) - this.startTime;
    const cacheHitRate = this.costs.cacheHits + this.costs.cacheMisses > 0
      ? (this.costs.cacheHits / (this.costs.cacheHits + this.costs.cacheMisses) * 100).toFixed(1)
      : 0;
    
    return {
      sessionId: this.sessionId,
      name: this.name,
      duration: duration,
      durationSeconds: (duration / 1000).toFixed(2),
      costs: {
        ...this.costs,
        cacheHitRate: `${cacheHitRate}%`,
        averageCostPerCall: this.costs.apiCalls > 0 
          ? (this.costs.total / this.costs.apiCalls).toFixed(6)
          : 0,
        costPerSecond: duration > 0
          ? ((this.costs.total / duration) * 1000).toFixed(6)
          : 0
      },
      startTime: new Date(this.startTime).toISOString(),
      endTime: this.endTime ? new Date(this.endTime).toISOString() : null
    };
  }
}

/**
 * Start a new cost tracking session
 * 
 * @param {string} name - Session name (e.g., 'comprehensive-evaluation')
 * @param {object} [options] - Session options
 * @returns {string} Session ID
 */
export function startSession(name, options = {}) {
  const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const session = new SessionCostData(sessionId, name);
  activeSessions.set(sessionId, session);
  
  if (options.verbose !== false) {
    log(`[CostTracker] Started session: ${name} (${sessionId})`);
  }
  
  return sessionId;
}

/**
 * End a cost tracking session
 * 
 * @param {string} sessionId - Session ID
 * @param {object} [options] - Options
 * @returns {object} Session summary
 */
export function endSession(sessionId, options = {}) {
  const session = activeSessions.get(sessionId);
  if (!session) {
    warn(`[CostTracker] Session not found: ${sessionId}`);
    return null;
  }
  
  session.endTime = Date.now();
  const summary = session.getSummary();
  
  // Get cache stats
  try {
    const cacheStats = getCacheStats();
    summary.cacheStats = cacheStats;
  } catch (error) {
    // Silently fail if cache stats unavailable
  }
  
  // Save session report
  if (options.saveReport !== false) {
    const reportsDir = join(process.cwd(), 'evaluation', 'results', 'cost-reports');
    if (!existsSync(reportsDir)) {
      mkdirSync(reportsDir, { recursive: true });
    }
    
    const reportFile = join(reportsDir, `cost-report-${sessionId}-${Date.now()}.json`);
    writeFileSync(reportFile, JSON.stringify({
      summary,
      entries: session.entries,
      timestamp: new Date().toISOString()
    }, null, 2));
    
    if (options.verbose !== false) {
      log(`[CostTracker] Session report saved: ${reportFile}`);
    }
  }
  
  // Print summary if verbose
  if (options.verbose !== false) {
    printSessionSummary(summary);
  }
  
  activeSessions.delete(sessionId);
  return summary;
}

/**
 * Record cost for current session
 * 
 * @param {string} sessionId - Session ID
 * @param {object} costData - Cost data
 */
export function recordSessionCost(sessionId, costData) {
  const session = activeSessions.get(sessionId);
  if (session) {
    session.recordCostEntry(costData);
    // Also record in global cost tracker
    recordCost(costData);
  } else {
    // No active session, just record globally
    recordCost(costData);
  }
}

/**
 * Record cache hit for current session
 * 
 * @param {string} sessionId - Session ID
 */
export function recordSessionCacheHit(sessionId) {
  const session = activeSessions.get(sessionId);
  if (session) {
    session.recordCacheHit();
  }
}

/**
 * Record cache miss for current session
 * 
 * @param {string} sessionId - Session ID
 */
export function recordSessionCacheMiss(sessionId) {
  const session = activeSessions.get(sessionId);
  if (session) {
    session.recordCacheMiss();
  }
}

/**
 * Get current session costs
 * 
 * @param {string} sessionId - Session ID
 * @returns {object} Current session costs
 */
export function getSessionCosts(sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session) {
    return null;
  }
  return session.getSummary();
}

/**
 * Print session summary
 */
function printSessionSummary(summary) {
  console.log('\n' + '='.repeat(70));
  console.log(`💰 Cost Report: ${summary.name}`);
  console.log('='.repeat(70));
  console.log(`Session ID: ${summary.sessionId}`);
  console.log(`Duration: ${summary.durationSeconds}s`);
  console.log(`\n📊 API Usage:`);
  console.log(`   Total Cost: $${summary.costs.total.toFixed(4)}`);
  console.log(`   API Calls: ${summary.costs.apiCalls}`);
  console.log(`   Average per Call: $${summary.costs.averageCostPerCall}`);
  console.log(`   Cost per Second: $${summary.costs.costPerSecond}/s`);
  
  console.log(`\n💾 Cache Performance:`);
  console.log(`   Cache Hits: ${summary.costs.cacheHits}`);
  console.log(`   Cache Misses: ${summary.costs.cacheMisses}`);
  console.log(`   Hit Rate: ${summary.costs.cacheHitRate}`);
  const cacheSavings = summary.costs.cacheHits * parseFloat(summary.costs.averageCostPerCall);
  if (cacheSavings > 0) {
    console.log(`   Estimated Savings: $${cacheSavings.toFixed(4)} (from cache hits)`);
  }
  
  console.log(`\n🔢 Token Usage:`);
  console.log(`   Input Tokens: ${summary.costs.tokens.input.toLocaleString()}`);
  console.log(`   Output Tokens: ${summary.costs.tokens.output.toLocaleString()}`);
  console.log(`   Total Tokens: ${summary.costs.tokens.total.toLocaleString()}`);
  
  if (Object.keys(summary.costs.byProvider).length > 0) {
    console.log(`\n📦 By Provider:`);
    for (const [provider, data] of Object.entries(summary.costs.byProvider)) {
      console.log(`   ${provider}:`);
      console.log(`      Cost: $${data.total.toFixed(4)}`);
      console.log(`      Calls: ${data.calls}`);
      console.log(`      Tokens: ${data.tokens.input.toLocaleString()} in, ${data.tokens.output.toLocaleString()} out`);
    }
  }
  
  if (Object.keys(summary.costs.byTest).length > 0) {
    console.log(`\n🧪 By Test (Top 10):`);
    const sortedTests = Object.entries(summary.costs.byTest)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10);
    for (const [testName, data] of sortedTests) {
      console.log(`   ${testName}: $${data.total.toFixed(4)} (${data.calls} calls)`);
    }
  }
  
  console.log('='.repeat(70) + '\n');
}

/**
 * Get all active sessions
 * 
 * @returns {Array} Active session IDs
 */
export function getActiveSessions() {
  return Array.from(activeSessions.keys());
}

/**
 * Get global cost stats (across all sessions)
 * 
 * @returns {object} Global cost statistics
 */
export function getGlobalCostStats() {
  const tracker = getCostTracker();
  return tracker.getStats();
}
