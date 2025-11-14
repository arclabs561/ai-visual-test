#!/usr/bin/env node
/**
 * Analyze Test Performance
 * 
 * Hookwise-integrated test performance analysis.
 * Parses test output to identify slow tests and performance bottlenecks.
 * Helps optimize test suite by finding tests that take too long.
 * 
 * This is part of hookwise's code quality checks.
 * Run with: npm run check:test-performance or npm run garden
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';

const SLOW_TEST_THRESHOLD_MS = 1000; // 1 second
const VERY_SLOW_TEST_THRESHOLD_MS = 5000; // 5 seconds

/**
 * Parse test output to extract test names and durations
 */
function parseTestOutput(output) {
  const tests = [];
  const lines = output.split('\n');
  
  // Pattern: ✔ test name (123.456ms) or nested tests with indentation
  const testPattern = /^[✔✖]\s+(.+?)\s+\(([0-9]+\.[0-9]+)ms\)$/;
  
  // Also match nested test output (indented)
  const nestedTestPattern = /^\s+[✔✖]\s+(.+?)\s+\(([0-9]+\.[0-9]+)ms\)$/;
  
  for (const line of lines) {
    // Try main pattern first
    let match = line.match(testPattern);
    if (match) {
      const [, name, duration] = match;
      tests.push({
        name: name.trim(),
        duration: parseFloat(duration),
        passed: line.trim().startsWith('✔'),
      });
      continue;
    }
    
    // Try nested pattern
    match = line.match(nestedTestPattern);
    if (match) {
      const [, name, duration] = match;
      tests.push({
        name: name.trim(),
        duration: parseFloat(duration),
        passed: line.trim().startsWith('✔'),
      });
    }
  }
  
  return tests;
}

/**
 * Analyze test performance
 */
function analyzeTestPerformance() {
  console.log('Running tests and analyzing performance...\n');
  
  try {
    let output;
    try {
      output = execSync('npm test', { 
        encoding: 'utf-8',
        stdio: 'pipe',
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });
    } catch (error) {
      // Tests may fail, but we still want to analyze performance
      output = error.stdout || error.stderr || '';
      if (!output) {
        throw error;
      }
    }
    
    const tests = parseTestOutput(output);
    
    if (tests.length === 0) {
      console.log('⚠️  No test timing data found. Make sure tests are running with timing enabled.');
      return;
    }
    
    // Sort by duration (slowest first)
    const sortedTests = [...tests].sort((a, b) => b.duration - a.duration);
    
    // Calculate statistics
    const totalDuration = tests.reduce((sum, t) => sum + t.duration, 0);
    const avgDuration = totalDuration / tests.length;
    const medianDuration = sortedTests[Math.floor(sortedTests.length / 2)].duration;
    const slowTests = tests.filter(t => t.duration >= SLOW_TEST_THRESHOLD_MS);
    const verySlowTests = tests.filter(t => t.duration >= VERY_SLOW_TEST_THRESHOLD_MS);
    const failedTests = tests.filter(t => !t.passed);
    
    // Print summary
    console.log('📊 Test Performance Summary\n');
    console.log(`Total tests: ${tests.length}`);
    console.log(`Total duration: ${totalDuration.toFixed(2)}ms (${(totalDuration / 1000).toFixed(2)}s)`);
    console.log(`Average duration: ${avgDuration.toFixed(2)}ms`);
    console.log(`Median duration: ${medianDuration.toFixed(2)}ms`);
    console.log(`Slow tests (>${SLOW_TEST_THRESHOLD_MS}ms): ${slowTests.length}`);
    console.log(`Very slow tests (>${VERY_SLOW_TEST_THRESHOLD_MS}ms): ${verySlowTests.length}`);
    console.log(`Failed tests: ${failedTests.length}\n`);
    
    // Print slowest tests
    if (sortedTests.length > 0) {
      console.log('🐌 Slowest Tests (Top 20)\n');
      sortedTests.slice(0, 20).forEach((test, index) => {
        const emoji = test.duration >= VERY_SLOW_TEST_THRESHOLD_MS ? '🔴' :
                     test.duration >= SLOW_TEST_THRESHOLD_MS ? '🟡' : '🟢';
        const status = test.passed ? '✔' : '✖';
        console.log(`${emoji} ${index + 1}. ${status} ${test.name}`);
        console.log(`   Duration: ${test.duration.toFixed(2)}ms (${(test.duration / 1000).toFixed(2)}s)`);
        console.log(`   % of total: ${((test.duration / totalDuration) * 100).toFixed(2)}%`);
        console.log('');
      });
    }
    
    // Print very slow tests with details
    if (verySlowTests.length > 0) {
      console.log('🔴 Very Slow Tests (>5s) - Consider Optimizing\n');
      verySlowTests.forEach((test, index) => {
        console.log(`${index + 1}. ${test.passed ? '✔' : '✖'} ${test.name}`);
        console.log(`   Duration: ${test.duration.toFixed(2)}ms (${(test.duration / 1000).toFixed(2)}s)`);
        console.log(`   % of total: ${((test.duration / totalDuration) * 100).toFixed(2)}%`);
        console.log('');
      });
    }
    
    // Print failed tests
    if (failedTests.length > 0) {
      console.log('❌ Failed Tests\n');
      failedTests.forEach((test, index) => {
        console.log(`${index + 1}. ${test.name}`);
        console.log(`   Duration: ${test.duration.toFixed(2)}ms`);
        console.log('');
      });
    }
    
    // Performance recommendations
    console.log('💡 Performance Recommendations\n');
    
    if (verySlowTests.length > 0) {
      console.log(`- ${verySlowTests.length} test(s) take >5s each. Consider:`);
      console.log('  * Using mocks/stubs instead of real API calls');
      console.log('  * Reducing test data size');
      console.log('  * Parallelizing independent tests');
      console.log('  * Caching expensive operations');
      console.log('');
    }
    
    if (slowTests.length > 10) {
      console.log(`- ${slowTests.length} test(s) take >1s each. Consider optimizing frequently run tests.`);
      console.log('');
    }
    
    const top10PercentDuration = sortedTests.slice(0, Math.ceil(sortedTests.length * 0.1))
      .reduce((sum, t) => sum + t.duration, 0);
    const top10PercentPct = (top10PercentDuration / totalDuration) * 100;
    
    if (top10PercentPct > 50) {
      console.log(`- Top 10% of tests account for ${top10PercentPct.toFixed(1)}% of total time.`);
      console.log('  Focus optimization efforts on these tests for maximum impact.');
      console.log('');
    }
    
    // Save detailed report
    const report = {
      summary: {
        totalTests: tests.length,
        totalDuration,
        avgDuration,
        medianDuration,
        slowTestsCount: slowTests.length,
        verySlowTestsCount: verySlowTests.length,
        failedTestsCount: failedTests.length,
      },
      slowestTests: sortedTests.slice(0, 20).map(t => ({
        name: t.name,
        duration: t.duration,
        passed: t.passed,
        percentOfTotal: (t.duration / totalDuration) * 100,
      })),
      verySlowTests: verySlowTests.map(t => ({
        name: t.name,
        duration: t.duration,
        passed: t.passed,
      })),
      failedTests: failedTests.map(t => ({
        name: t.name,
        duration: t.duration,
      })),
    };
    
    writeFileSync('test-performance-report.json', JSON.stringify(report, null, 2));
    console.log('📄 Detailed report saved to test-performance-report.json');
    
  } catch (error) {
    console.error('Error running tests:', error.message);
    if (error.stdout) {
      console.error('Test output:', error.stdout);
    }
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  analyzeTestPerformance();
}

export { analyzeTestPerformance, parseTestOutput };

