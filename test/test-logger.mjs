/**
 * Structured Test Logging Utility
 * 
 * Provides consistent, debuggable logging for tests with:
 * - Structured output (JSON for complex data)
 * - Debug mode (only when DEBUG_TESTS=1)
 * - Clear prefixes (ℹ️, ✅, ❌, 🔍)
 * - Stack traces in debug mode
 */

export const testLog = {
  /**
   * Info-level logging (always shown)
   */
  info: (msg, data = {}) => {
    const prefix = '   ℹ️  ';
    if (Object.keys(data).length > 0) {
      console.log(`${prefix}${msg}`, JSON.stringify(data, null, 2));
    } else {
      console.log(`${prefix}${msg}`);
    }
  },

  /**
   * Debug-level logging (only when DEBUG_TESTS=1)
   */
  debug: (msg, data = {}) => {
    if (process.env.DEBUG_TESTS) {
      const prefix = '   🔍 [DEBUG] ';
      if (Object.keys(data).length > 0) {
        console.log(`${prefix}${msg}`, JSON.stringify(data, null, 2));
      } else {
        console.log(`${prefix}${msg}`);
      }
    }
  },

  /**
   * Error logging with optional stack trace
   */
  error: (msg, error) => {
    const prefix = '   ❌ ';
    console.log(`${prefix}${msg}`, error?.message || error);
    if (error?.stack && process.env.DEBUG_TESTS) {
      console.log('   Stack:', error.stack);
    }
  },

  /**
   * Success logging
   */
  success: (msg) => {
    const prefix = '   ✅ ';
    console.log(`${prefix}${msg}`);
  },

  /**
   * Warning logging
   */
  warn: (msg, data = {}) => {
    const prefix = '   ⚠️  ';
    if (Object.keys(data).length > 0) {
      console.log(`${prefix}${msg}`, JSON.stringify(data, null, 2));
    } else {
      console.log(`${prefix}${msg}`);
    }
  },

  /**
   * Skip logging (for skipped tests)
   */
  skip: (reason, data = {}) => {
    const prefix = '   ⏭️  ';
    if (Object.keys(data).length > 0) {
      console.log(`${prefix}Skipping: ${reason}`, JSON.stringify(data, null, 2));
    } else {
      console.log(`${prefix}Skipping: ${reason}`);
    }
  }
};

