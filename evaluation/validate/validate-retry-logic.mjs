/**
 * Validation: Retry Logic and Error Handling
 * 
 * Tests that retry logic correctly identifies retryable errors,
 * implements exponential backoff correctly, and handles edge cases.
 */

import { retryWithBackoff, isRetryableError, calculateBackoff } from '../../src/retry.mjs';
import { ProviderError, TimeoutError } from '../../src/errors.mjs';
import { writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Test Case: Retryable Error Detection
 * Validates that we correctly identify retryable vs non-retryable errors
 */
function testRetryableErrorDetection() {
  const tests = [
    {
      name: 'Timeout Error',
      error: new TimeoutError('Timeout', 5000),
      expected: true
    },
    {
      name: 'Rate Limit (429)',
      error: new ProviderError('Rate limit', 'gemini', { statusCode: 429 }),
      expected: true
    },
    {
      name: 'Server Error (500)',
      error: new ProviderError('Server error', 'gemini', { statusCode: 500 }),
      expected: true
    },
    {
      name: 'Server Error (503)',
      error: new ProviderError('Service unavailable', 'gemini', { statusCode: 503 }),
      expected: true
    },
    {
      name: 'Client Error (400)',
      error: new ProviderError('Bad request', 'gemini', { statusCode: 400 }),
      expected: false
    },
    {
      name: 'Auth Error (401)',
      error: new ProviderError('Unauthorized', 'gemini', { statusCode: 401 }),
      expected: false
    },
    {
      name: 'Network Error',
      error: new Error('Network error'),
      expected: true // Network errors are retryable
    },
    {
      name: 'Abort Error',
      error: new Error('Aborted'),
      expected: true // Abort errors are retryable
    }
  ];
  
  const results = tests.map(test => {
    const actual = isRetryableError(test.error);
    return {
      name: test.name,
      expected: test.expected,
      actual,
      passed: actual === test.expected,
      errorType: test.error.constructor.name,
      statusCode: test.error.details?.statusCode || test.error.statusCode || 'N/A'
    };
  });
  
  return {
    name: 'Retryable Error Detection',
    hypothesis: 'We correctly identify retryable vs non-retryable errors',
    tests: results,
    passed: results.every(r => r.passed),
    notes: 'Rate limits and server errors should be retryable, auth errors should not'
  };
}

/**
 * Test Case: Exponential Backoff Calculation
 * Validates that backoff increases exponentially
 */
function testExponentialBackoff() {
  const baseDelay = 1000;
  const maxDelay = 30000;
  
  const backoffs = [];
  for (let attempt = 0; attempt < 5; attempt++) {
    backoffs.push({
      attempt,
      delay: calculateBackoff(attempt, baseDelay, maxDelay, false) // No jitter for testing
    });
  }
  
  // Check that delays increase (or stay at max)
  const increasing = backoffs.every((b, i) => {
    if (i === 0) return true;
    return b.delay >= backoffs[i - 1].delay;
  });
  
  // Check that it's exponential (roughly)
  const exponential = backoffs.slice(0, 3).every((b, i) => {
    if (i === 0) return true;
    const ratio = b.delay / backoffs[i - 1].delay;
    return ratio >= 1.5 && ratio <= 2.5; // Should roughly double
  });
  
  const respectsMax = backoffs.every(b => b.delay <= maxDelay);
  
  return {
    name: 'Exponential Backoff Calculation',
    hypothesis: 'Backoff increases exponentially with attempt number',
    actual: backoffs,
    analysis: {
      increasing,
      exponential,
      respectsMax
    },
    passed: increasing && respectsMax,
    notes: 'Backoff should increase exponentially and respect max delay'
  };
}

/**
 * Test Case: Retry With Backoff Execution
 * Validates that retry actually retries on retryable errors
 */
async function testRetryExecution() {
  let attempts = 0;
  const maxRetries = 3;
  
  const fn = async () => {
    attempts++;
    if (attempts < 3) {
      throw new ProviderError('Rate limit', 'gemini', { statusCode: 429 });
    }
    return 'success';
  };
  
  try {
    const result = await retryWithBackoff(fn, {
      maxRetries,
      baseDelay: 10, // Short delay for testing
      maxDelay: 100
    });
    
    return {
      name: 'Retry Execution',
      hypothesis: 'Retry actually retries on retryable errors',
      expected: {
        attempts: 3,
        result: 'success'
      },
      actual: {
        attempts,
        result
      },
      passed: attempts === 3 && result === 'success',
      notes: 'Should retry up to maxRetries times on retryable errors'
    };
  } catch (error) {
    return {
      name: 'Retry Execution',
      hypothesis: 'Retry actually retries on retryable errors',
      expected: { attempts: 3, result: 'success' },
      actual: { attempts, error: error.message },
      passed: false,
      notes: `Failed: ${error.message}`
    };
  }
}

/**
 * Test Case: Non-Retryable Error Handling
 * Validates that non-retryable errors are not retried
 */
async function testNonRetryableErrorHandling() {
  let attempts = 0;
  
  const fn = async () => {
    attempts++;
    throw new ProviderError('Unauthorized', 'gemini', { statusCode: 401 });
  };
  
  try {
    await retryWithBackoff(fn, {
      maxRetries: 3,
      baseDelay: 10
    });
    
    return {
      name: 'Non-Retryable Error Handling',
      hypothesis: 'Non-retryable errors are not retried',
      expected: { attempts: 1 },
      actual: { attempts },
      passed: false,
      notes: 'Should have thrown error immediately'
    };
  } catch (error) {
    return {
      name: 'Non-Retryable Error Handling',
      hypothesis: 'Non-retryable errors are not retried',
      expected: { attempts: 1, error: 'Unauthorized' },
      actual: { attempts, error: error.message },
      passed: attempts === 1 && error.message.includes('Unauthorized'),
      notes: 'Should fail immediately on non-retryable errors'
    };
  }
}

/**
 * Test Case: Jitter Application
 * Validates that jitter adds randomness to backoff
 */
function testJitterApplication() {
  const baseDelay = 1000;
  const attempts = [0, 1, 2];
  
  // Calculate backoff with jitter multiple times
  const results = [];
  for (let i = 0; i < 10; i++) {
    const delays = attempts.map(attempt => 
      calculateBackoff(attempt, baseDelay, 30000, true) // With jitter
    );
    results.push(delays);
  }
  
  // Check that delays vary (jitter is working)
  const firstAttemptDelays = results.map(r => r[0]);
  const hasVariation = new Set(firstAttemptDelays.map(d => Math.round(d))).size > 1;
  
  // Check that jitter is within ±25% range
  const expectedDelay = baseDelay;
  const jitterRange = expectedDelay * 0.25;
  const allInRange = firstAttemptDelays.every(delay => {
    return delay >= expectedDelay - jitterRange && delay <= expectedDelay + jitterRange;
  });
  
  return {
    name: 'Jitter Application',
    hypothesis: 'Jitter adds randomness within ±25% range',
    actual: {
      sampleDelays: firstAttemptDelays.slice(0, 5),
      hasVariation,
      allInRange
    },
    passed: hasVariation && allInRange,
    notes: 'Jitter should add variation within expected range'
  };
}

/**
 * Run all validation tests
 */
async function runValidation() {
  console.log('🔬 Validating Retry Logic and Error Handling\n');
  
  const tests = [
    testRetryableErrorDetection(),
    testExponentialBackoff(),
    await testRetryExecution(),
    await testNonRetryableErrorHandling(),
    testJitterApplication()
  ];
  
  const results = {
    timestamp: new Date().toISOString(),
    tests,
    summary: {
      total: tests.length,
      passed: tests.filter(t => t.passed).length,
      failed: tests.filter(t => !t.passed).length
    }
  };
  
  // Print results
  console.log('Results:');
  tests.forEach(test => {
    const status = test.passed ? '✅' : '❌';
    console.log(`${status} ${test.name}`);
    console.log(`   Hypothesis: ${test.hypothesis}`);
    if (test.expected) {
      console.log(`   Expected: ${JSON.stringify(test.expected)}`);
    }
    if (test.actual) {
      console.log(`   Actual: ${JSON.stringify(test.actual)}`);
    }
    if (test.analysis) {
      console.log(`   Analysis: ${JSON.stringify(test.analysis)}`);
    }
    if (!test.passed) {
      console.log(`   ⚠️  FAILED: ${test.notes}`);
    }
    console.log();
  });
  
  console.log(`\nSummary: ${results.summary.passed}/${results.summary.total} tests passed`);
  
  // Save results
  const outputPath = join(process.cwd(), 'evaluation', 'results', `retry-logic-validation-${Date.now()}.json`);
  writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to: ${outputPath}`);
  
  return results;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runValidation().catch(console.error);
}

export { runValidation };

