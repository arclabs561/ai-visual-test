/**
 * Structured Test Logging Utility
 * 
 * Modern best practices (2024):
 * - Structured JSON output for machine parsing
 * - Timestamps for correlation across test runs
 * - Contextual metadata (test suite, test case, request IDs)
 * - Log levels (info, warn, error, debug)
 * - Stack traces in debug mode
 * - Performance metrics (latency, duration)
 * 
 * Provides consistent, debuggable logging for tests with:
 * - Structured output (JSON for complex data)
 * - Debug mode (only when DEBUG_TESTS=1)
 * - Clear prefixes (ℹ️, ✅, ❌, 🔍, ⚠️, ⏭️)
 * - Stack traces in debug mode
 * - Timestamps and contextual metadata
 */

// Track test context for correlation
let testContext = {
  suite: null,
  test: null,
  startTime: null
};

/**
 * Create structured log entry
 */
function createLogEntry(level, msg, data = {}, error = null) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message: msg,
    ...(Object.keys(data).length > 0 && { data }),
    ...(testContext.suite && { test_suite: testContext.suite }),
    ...(testContext.test && { test_case: testContext.test }),
    ...(error && {
      error: {
        message: error.message,
        name: error.name,
        ...(process.env.DEBUG_TESTS && error.stack && { stack: error.stack })
      }
    })
  };
  
  // Add duration if test context has start time
  if (testContext.startTime) {
    entry.duration_ms = Date.now() - testContext.startTime;
  }
  
  return entry;
}

/**
 * Format log output (structured JSON in debug mode, human-readable otherwise)
 */
function formatLog(entry, prefix) {
  if (process.env.DEBUG_TESTS || process.env.STRUCTURED_LOGS) {
    // Structured JSON for machine parsing (CI/CD, monitoring)
    return JSON.stringify(entry);
  } else {
    // Human-readable format for development
    const parts = [prefix + entry.message];
    if (entry.data && Object.keys(entry.data).length > 0) {
      parts.push(JSON.stringify(entry.data, null, 2));
    }
    if (entry.error) {
      parts.push(entry.error.message);
      if (entry.error.stack) {
        parts.push('Stack: ' + entry.error.stack);
      }
    }
    return parts.join(' ');
  }
}

export const testLog = {
  /**
   * Set test context for correlation
   */
  setContext: (suite, test) => {
    testContext = {
      suite,
      test,
      startTime: Date.now()
    };
  },

  /**
   * Clear test context
   */
  clearContext: () => {
    testContext = {
      suite: null,
      test: null,
      startTime: null
    };
  },

  /**
   * Info-level logging (always shown)
   */
  info: (msg, data = {}) => {
    const entry = createLogEntry('info', msg, data);
    console.log(formatLog(entry, '   ℹ️  '));
  },

  /**
   * Debug-level logging (only when DEBUG_TESTS=1)
   */
  debug: (msg, data = {}) => {
    if (process.env.DEBUG_TESTS) {
      const entry = createLogEntry('debug', msg, data);
      console.log(formatLog(entry, '   🔍 [DEBUG] '));
    }
  },

  /**
   * Error logging with optional stack trace
   */
  error: (msg, error) => {
    const entry = createLogEntry('error', msg, {}, error);
    console.log(formatLog(entry, '   ❌ '));
  },

  /**
   * Success logging
   */
  success: (msg, data = {}) => {
    const entry = createLogEntry('success', msg, data);
    console.log(formatLog(entry, '   ✅ '));
  },

  /**
   * Warning logging
   */
  warn: (msg, data = {}) => {
    const entry = createLogEntry('warn', msg, data);
    console.log(formatLog(entry, '   ⚠️  '));
  },

  /**
   * Skip logging (for skipped tests)
   */
  skip: (reason, data = {}) => {
    const entry = createLogEntry('skip', `Skipping: ${reason}`, data);
    console.log(formatLog(entry, '   ⏭️  '));
  },

  /**
   * Performance logging (latency, duration)
   */
  performance: (operation, durationMs, metadata = {}) => {
    const entry = createLogEntry('performance', `${operation} took ${durationMs}ms`, {
      operation,
      duration_ms: durationMs,
      ...metadata
    });
    console.log(formatLog(entry, '   ⏱️  '));
  }
};

