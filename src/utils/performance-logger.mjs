/**
 * Performance Logger
 * 
 * Provides structured logging for critical performance metrics:
 * - API call performance (latency, retries, errors, costs)
 * - Cache effectiveness (hit rates, eviction patterns)
 * - Temporal decision reasoning (why prompts triggered/skipped)
 * - Batch optimizer metrics (queue depth, timeouts, rejections)
 * - Error patterns (frequency, types, recovery)
 * 
 * Weighted logging: More detail for critical paths (API calls, cache misses, errors)
 */

import { log, warn, error, isDebugEnabled } from '../logger.mjs';

/**
 * Log API call performance
 * 
 * @param {Object} params - Performance data
 * @param {string} params.provider - Provider name (gemini, openai, claude, groq)
 * @param {number} params.latency - Response time in ms
 * @param {number} params.retries - Number of retries
 * @param {number} params.cost - Estimated cost
 * @param {number} params.inputTokens - Input tokens
 * @param {number} params.outputTokens - Output tokens
 * @param {boolean} params.success - Whether call succeeded
 * @param {Error} [params.error] - Error if failed
 * @param {string} [params.testName] - Test name for context
 */
export function logAPICallPerformance(params) {
  const {
    provider,
    latency,
    retries = 0,
    cost = null,
    inputTokens = 0,
    outputTokens = 0,
    success = true,
    error: err = null,
    testName = 'unknown'
  } = params;

  // Always log errors (critical visibility)
  if (!success && err) {
    error(`[API] ${provider} call failed`, {
      provider,
      latency,
      retries,
      error: err.message,
      testName,
      stack: err.stack
    });
    return;
  }

  // Log retries (important for debugging)
  if (retries > 0) {
    warn(`[API] ${provider} call succeeded after ${retries} retries`, {
      provider,
      latency,
      retries,
      cost,
      testName
    });
  }

  // Detailed logging in debug mode (weighted: always log for critical paths)
  if (isDebugEnabled() || latency > 5000 || retries > 0) {
    log(`[API] ${provider} call`, {
      provider,
      latency: `${latency}ms`,
      retries,
      cost: cost ? `$${cost.toFixed(6)}` : null,
      tokens: `${inputTokens} in, ${outputTokens} out`,
      testName,
      performance: latency < 1000 ? 'fast' : latency < 3000 ? 'normal' : 'slow'
    });
  }
}

/**
 * Log cache operation
 * 
 * @param {Object} params - Cache operation data
 * @param {string} params.operation - Operation type (hit, miss, set, evict, expire)
 * @param {boolean} params.hit - Whether it was a hit
 * @param {number} [params.latency] - Lookup latency in ms
 * @param {number} [params.cacheSize] - Current cache size
 * @param {number} [params.maxSize] - Max cache size
 * @param {string} [params.reason] - Reason for eviction/expiration
 */
export function logCacheOperation(params) {
  const {
    operation,
    hit = false,
    latency = null,
    cacheSize = null,
    maxSize = null,
    reason = null
  } = params;

  // Always log evictions and expirations (important for cache health)
  if (operation === 'evict' || operation === 'expire') {
    warn(`[Cache] ${operation}`, {
      operation,
      cacheSize,
      maxSize,
      reason,
      utilization: maxSize ? `${((cacheSize / maxSize) * 100).toFixed(1)}%` : null
    });
    return;
  }

  // Log misses in debug mode (weighted: cache misses are important)
  if (operation === 'miss' && isDebugEnabled()) {
    log(`[Cache] miss`, {
      operation,
      latency: latency ? `${latency}ms` : null,
      cacheSize,
      maxSize
    });
  }

  // Log hits only in verbose debug mode (less critical)
  if (operation === 'hit' && isDebugEnabled()) {
    log(`[Cache] hit`, {
      operation,
      latency: latency ? `${latency}ms` : null,
      cacheSize
    });
  }
}

/**
 * Log temporal decision reasoning
 * 
 * @param {Object} params - Decision data
 * @param {boolean} params.shouldPrompt - Whether to prompt
 * @param {string} params.reason - Reason for decision
 * @param {string} params.urgency - Urgency level (low, medium, high)
 * @param {number} [params.coherence] - Temporal coherence score
 * @param {number} [params.stateChange] - State change magnitude
 * @param {number} [params.noteCount] - Number of temporal notes
 * @param {boolean} [params.isDecisionPoint] - Whether this is a decision point
 * @param {boolean} [params.hasUserAction] - Whether user action occurred
 */
export function logTemporalDecision(params) {
  const {
    shouldPrompt,
    reason,
    urgency,
    coherence = null,
    stateChange = null,
    noteCount = null,
    isDecisionPoint = false,
    hasUserAction = false
  } = params;

  // Always log high-urgency decisions (critical visibility)
  if (urgency === 'high') {
    log(`[Temporal] Decision: ${shouldPrompt ? 'PROMPT' : 'WAIT'} (${urgency})`, {
      shouldPrompt,
      reason,
      urgency,
      coherence,
      stateChange,
      noteCount,
      isDecisionPoint,
      hasUserAction
    });
    return;
  }

  // Log medium-urgency in debug mode
  if (urgency === 'medium' && isDebugEnabled()) {
    log(`[Temporal] Decision: ${shouldPrompt ? 'PROMPT' : 'WAIT'} (${urgency})`, {
      shouldPrompt,
      reason,
      urgency,
      coherence,
      stateChange,
      noteCount
    });
  }

  // Log low-urgency only in verbose debug mode
  if (urgency === 'low' && isDebugEnabled()) {
    log(`[Temporal] Decision: ${shouldPrompt ? 'PROMPT' : 'WAIT'} (${urgency})`, {
      shouldPrompt,
      reason,
      urgency
    });
  }
}

/**
 * Log batch optimizer metrics
 * 
 * @param {Object} params - Batch optimizer data
 * @param {string} params.event - Event type (queue, process, timeout, reject)
 * @param {number} [params.queueDepth] - Current queue depth
 * @param {number} [params.maxQueueSize] - Max queue size
 * @param {number} [params.activeRequests] - Active concurrent requests
 * @param {number} [params.maxConcurrency] - Max concurrency
 * @param {number} [params.waitTime] - Wait time in ms
 * @param {string} [params.reason] - Reason for timeout/rejection
 */
export function logBatchOptimizer(params) {
  const {
    event,
    queueDepth = null,
    maxQueueSize = null,
    activeRequests = null,
    maxConcurrency = null,
    waitTime = null,
    reason = null
  } = params;

  // Always log rejections and timeouts (critical visibility)
  if (event === 'reject' || event === 'timeout') {
    warn(`[BatchOptimizer] ${event}`, {
      event,
      queueDepth,
      maxQueueSize,
      activeRequests,
      maxConcurrency,
      waitTime: waitTime ? `${waitTime}ms` : null,
      reason,
      utilization: maxQueueSize ? `${((queueDepth / maxQueueSize) * 100).toFixed(1)}%` : null
    });
    return;
  }

  // Log queue depth when high (important for monitoring)
  if (event === 'queue' && queueDepth && maxQueueSize && queueDepth > maxQueueSize * 0.8) {
    warn(`[BatchOptimizer] High queue depth`, {
      event,
      queueDepth,
      maxQueueSize,
      utilization: `${((queueDepth / maxQueueSize) * 100).toFixed(1)}%`
    });
  }

  // Log processing in debug mode
  if (event === 'process' && isDebugEnabled()) {
    log(`[BatchOptimizer] ${event}`, {
      event,
      queueDepth,
      activeRequests,
      maxConcurrency,
      waitTime: waitTime ? `${waitTime}ms` : null
    });
  }
}

/**
 * Log error pattern
 * 
 * @param {Object} params - Error data
 * @param {Error} params.error - Error object
 * @param {string} params.context - Context where error occurred
 * @param {string} [params.recovery] - Recovery strategy attempted
 * @param {boolean} [params.recovered] - Whether recovery succeeded
 * @param {number} [params.retryCount] - Number of retries
 */
export function logErrorPattern(params) {
  const {
    error: err,
    context,
    recovery = null,
    recovered = false,
    retryCount = 0
  } = params;

  // Always log errors (critical visibility)
  error(`[Error] ${context}`, {
    context,
    error: err.message,
    errorType: err.constructor.name,
    recovery,
    recovered,
    retryCount,
    stack: err.stack
  });
}

