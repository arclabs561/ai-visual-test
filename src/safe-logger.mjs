/**
 * Performance Logger Service
 * 
 * Handles optional performance logging without fire-and-forget race conditions.
 * Provides a safe, non-blocking interface for metrics.
 */

let loggerImplementation = null;
let isEnabled = false;

/**
 * Initialize the logger (lazy load)
 */
async function initLogger() {
  if (loggerImplementation) return loggerImplementation;
  
  try {
    // Only load if actually needed/configured
    const { logCacheOperation, logTemporalDecision } = await import('./utils/performance-logger.mjs');
    loggerImplementation = { logCacheOperation, logTemporalDecision };
    isEnabled = true;
  } catch (error) {
    // Graceful degradation - if logger fails to load, we just don't log
    // This is better than crashing or hanging
    isEnabled = false;
    loggerImplementation = {
      logCacheOperation: () => {},
      logTemporalDecision: () => {}
    };
  }
  return loggerImplementation;
}

/**
 * Log a cache operation safely
 */
export function safeLogCacheOperation(data) {
  // Non-blocking check
  if (!isEnabled && !loggerImplementation) {
    // Trigger init but don't wait for it (fire and forget INIT, not the log itself)
    initLogger().then(logger => logger?.logCacheOperation(data)).catch(() => {});
    return;
  }
  
  if (isEnabled && loggerImplementation) {
    try {
      loggerImplementation.logCacheOperation(data);
    } catch {
      // Swallow logging errors to prevent disrupting main flow
    }
  }
}

/**
 * Log a temporal decision safely
 */
export function safeLogTemporalDecision(data) {
  if (!isEnabled && !loggerImplementation) {
    initLogger().then(logger => logger?.logTemporalDecision(data)).catch(() => {});
    return;
  }
  
  if (isEnabled && loggerImplementation) {
    try {
      loggerImplementation.logTemporalDecision(data);
    } catch {
      // Swallow logging errors
    }
  }
}

