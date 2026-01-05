/**
 * Graceful Shutdown Handler
 * 
 * Handles graceful shutdown for long-running processes.
 * Ensures in-flight operations complete, caches are flushed, and resources are cleaned up.
 */

import { log, warn, error } from './logger.mjs';

let shutdownHandlers = [];
let isShuttingDown = false;
let shutdownTimeout = 30000; // 30 seconds default timeout

/**
 * Register a shutdown handler
 * 
 * @param {Function} handler - Async function to call during shutdown
 * @param {number} [priority=0] - Priority (higher = called first)
 */
export function registerShutdownHandler(handler, priority = 0) {
  if (typeof handler !== 'function') {
    throw new TypeError('Shutdown handler must be a function');
  }
  
  shutdownHandlers.push({ handler, priority });
  // Sort by priority (higher first)
  shutdownHandlers.sort((a, b) => b.priority - a.priority);
}

/**
 * Unregister a shutdown handler
 * 
 * @param {Function} handler - Handler to remove
 */
export function unregisterShutdownHandler(handler) {
  shutdownHandlers = shutdownHandlers.filter(h => h.handler !== handler);
}

/**
 * Perform graceful shutdown
 * 
 * @param {Object} [options={}] - Shutdown options
 * @param {number} [options.timeout=30000] - Timeout in milliseconds
 * @param {string} [options.signal='SIGTERM'] - Signal name for logging
 * @returns {Promise<void>}
 */
export async function gracefulShutdown(options = {}) {
  if (isShuttingDown) {
    warn('[GracefulShutdown] Shutdown already in progress');
    return;
  }
  
  isShuttingDown = true;
  const { timeout = shutdownTimeout, signal = 'SIGTERM' } = options;
  
  log(`[GracefulShutdown] Initiating graceful shutdown (signal: ${signal})...`);
  
  // Set timeout to force exit if shutdown takes too long
  const timeoutId = setTimeout(() => {
    warn('[GracefulShutdown] Shutdown timeout exceeded, forcing exit');
    process.exit(1);
  }, timeout);
  
  try {
    // Execute shutdown handlers in priority order
    for (const { handler } of shutdownHandlers) {
      try {
        await handler();
      } catch (err) {
        warn(`[GracefulShutdown] Handler failed:`, err);
        // Continue with other handlers even if one fails
      }
    }
    
    // Note: Cache is file-based and doesn't need explicit flushing
    // File writes are atomic, so no cleanup needed
    log('[GracefulShutdown] Cache is file-based, no flush needed');
    
    clearTimeout(timeoutId);
    log('[GracefulShutdown] Shutdown complete');
    process.exit(0);
  } catch (err) {
    clearTimeout(timeoutId);
    error('[GracefulShutdown] Shutdown failed:', err);
    process.exit(1);
  }
}

/**
 * Initialize graceful shutdown handlers
 * 
 * Registers signal handlers for SIGTERM and SIGINT.
 * 
 * @param {Object} [options={}] - Initialization options
 * @param {number} [options.timeout=30000] - Shutdown timeout
 */
export function initGracefulShutdown(options = {}) {
  shutdownTimeout = options.timeout || 30000;
  
  // Register signal handlers
  process.on('SIGTERM', () => {
    log('[GracefulShutdown] Received SIGTERM');
    gracefulShutdown({ signal: 'SIGTERM', timeout: shutdownTimeout });
  });
  
  process.on('SIGINT', () => {
    log('[GracefulShutdown] Received SIGINT (Ctrl+C)');
    gracefulShutdown({ signal: 'SIGINT', timeout: shutdownTimeout });
  });
  
  // Handle uncaught exceptions (best-effort cleanup)
  process.on('uncaughtException', (err) => {
    error('[GracefulShutdown] Uncaught exception:', err);
    gracefulShutdown({ signal: 'uncaughtException', timeout: 5000 }); // Shorter timeout for crashes
  });
  
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    warn('[GracefulShutdown] Unhandled promise rejection:', reason);
    // Don't shutdown on unhandled rejections (may be recoverable)
    // But log for monitoring
  });
  
  log('[GracefulShutdown] Graceful shutdown handlers initialized');
}

