/**
 * Test Setup - Auto-load .env file
 * 
 * Ensures environment variables are loaded from .env file before tests run.
 * This allows tests to run without manual environment variable setup.
 */

import { loadEnv } from '../src/load-env.mjs';

// Set NODE_ENV to 'test' to prevent automatic initialization of graceful shutdown
// This ensures library best practices tests pass (no side effects on import)
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test';
}

// Auto-load .env file on test setup
// This ensures all tests have access to environment variables
loadEnv();

// Re-export for convenience
export { loadEnv };

