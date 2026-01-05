#!/usr/bin/env node
/**
 * Parse WCAG Test Cases from HTML
 * 
 * Extracts test case information from the downloaded WCAG HTML page.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const WCAG_HTML_FILE = join(process.cwd(), 'evaluation', 'datasets', 'human-annotated', 'wcag-test-cases', 'testcases.json');
const WCAG_JSON_FILE = join(process.cwd(), 'evaluation', 'datasets', 'human-annotated', 'wcag-test-cases', 'testcases-actual.json');
const OUTPUT_FILE = join(process.cwd(), 'evaluation', 'datasets', 'wcag-ground-truth.json');

/**
 * Parse WCAG test cases from HTML
 */
function parseWCAGTestCases() {
  console.log('🔄 Parsing WCAG Test Cases\n');
  
  // Try JSON file first (actual test cases)
  if (existsSync(WCAG_JSON_FILE)) {
    return parseWCAGJSON();
  }
  
  // Fallback to HTML parsing
  if (!existsSync(WCAG_HTML_FILE)) {
    console.error(`❌ WCAG file not found: ${WCAG_HTML_FILE} or ${WCAG_JSON_FILE}`);
    console.error(`   Download testcases.json from: https://www.w3.org/WAI/content-assets/wcag-act-rules/testcases.json`);
    process.exit(1);
  }
  
  const html = readFileSync(WCAG_HTML_FILE, 'utf-8');
  
  // The file is actually HTML, not JSON
  // Extract test case links and information
  const testCases = [];
  
  // Look for test case links - multiple patterns
  // Pattern 1: Direct rule links (both relative and absolute)
  const rulePattern = /<a[^>]*href=["']([^"']*\/WAI\/standards-guidelines\/act\/rules\/[^"']+)["'][^>]*>([^<]+)<\/a>/gi;
  // Pattern 2: Links in tables or lists (any href with act/rules)
  const tableLinkPattern = /href=["']([^"']*\/WAI\/standards-guidelines\/act\/rules\/[^"']+)["']/gi;
  // Pattern 3: Test case specific links
  const testCaseLinkPattern = /href=["']([^"']*\/WAI\/standards-guidelines\/act\/rules\/[^"']+\/testcases\/[^"']+)["']/gi;
  // Pattern 4: Links to testcase pages
  const testCasePagePattern = /href=["']([^"']*\/testcases\/[^"']+)["']/gi;
  
  const seen = new Set();
  
  // Extract rule links
  let match;
  while ((match = rulePattern.exec(html)) !== null) {
    let url = match[1];
    const name = match[2] ? match[2].trim() : '';
    
    // Normalize URL (handle both relative and absolute)
    if (url.startsWith('http')) {
      // Absolute URL - extract path
      try {
        const urlObj = new URL(url);
        url = urlObj.pathname;
      } catch {
        // Invalid URL, skip
        continue;
      }
    } else if (!url.startsWith('/')) {
      // Relative URL, make absolute
      url = url.startsWith('WAI') ? `/${url}` : `/WAI/${url}`;
    }
    
    // Skip common non-test-case links
    if (url.includes('/about') || url.includes('/index') || url.includes('/report') || 
        url.includes('/assets') || url.includes('/css') || url.includes('/js')) {
      continue;
    }
    
    // Generate name if missing
    const finalName = name || url.split('/').pop().replace(/-/g, ' ').replace(/\.html$/, '');
    
    if (!seen.has(url) && finalName && finalName.length > 0 && finalName.length < 200) {
      seen.add(url);
      testCases.push({
        id: `wcag-rule-${testCases.length + 1}`,
        name: finalName,
        url: url.startsWith('http') ? url : `https://www.w3.org${url}`,
        source: 'W3C WCAG ACT Rules',
        type: 'accessibility_rule',
        hasTestCases: url.includes('/testcases')
      });
    }
  }
  
  // Extract test case specific links
  while ((match = testCaseLinkPattern.exec(html)) !== null) {
    const url = match[1];
    if (!seen.has(url)) {
      seen.add(url);
      testCases.push({
        id: `wcag-testcase-${testCases.length + 1}`,
        name: url.split('/').pop().replace(/-/g, ' '),
        url: `https://www.w3.org${url}`,
        source: 'W3C WCAG ACT Rules',
        type: 'accessibility_test_case'
      });
    }
  }
  
  // Also extract all rule URLs (even without names) for completeness
  while ((match = tableLinkPattern.exec(html)) !== null) {
    const url = match[1];
    if (!seen.has(url) && !url.includes('/about') && !url.includes('/index') && !url.includes('/report')) {
      seen.add(url);
      const ruleName = url.split('/').pop().replace(/-/g, ' ').replace(/\//g, '');
      if (ruleName.length > 0 && ruleName.length < 100) {
        testCases.push({
          id: `wcag-${testCases.length + 1}`,
          name: ruleName,
          url: `https://www.w3.org${url}`,
          source: 'W3C WCAG ACT Rules',
          type: 'accessibility_rule'
        });
      }
    }
  }
  
  // Also look for test case references in the page
  const testCaseRefPattern = /test[_\s-]?case[s]?/gi;
  const hasTestCases = testCaseRefPattern.test(html);
  
  const dataset = {
    name: 'WCAG Test Cases',
    source: 'W3C WCAG ACT Rules',
    version: '1.0.0',
    created: new Date().toISOString(),
    description: 'WCAG accessibility test cases extracted from W3C ACT Rules',
    totalTestCases: testCases.length,
    testCases,
    note: hasTestCases 
      ? 'Test cases extracted from W3C page. Individual test case details may require additional parsing.'
      : 'Limited test case information extracted. May need to visit individual rule pages for full test cases.'
  };
  
  // Write output
  writeFileSync(OUTPUT_FILE, JSON.stringify(dataset, null, 2));
  
  console.log(`✅ Parsing completed!`);
  console.log(`   Found ${testCases.length} test case references`);
  console.log(`   Output: ${OUTPUT_FILE}`);
  
  return dataset;
}

/**
 * Parse WCAG test cases from JSON file (preferred method)
 */
function parseWCAGJSON() {
  console.log('📄 Reading WCAG test cases from JSON file\n');
  
  const data = JSON.parse(readFileSync(WCAG_JSON_FILE, 'utf-8'));
  const testCases = [];
  
  if (data.testcases && Array.isArray(data.testcases)) {
    data.testcases.forEach((tc, index) => {
      testCases.push({
        id: tc.id || `wcag-${tc.ruleId || index}`,
        name: tc.ruleName || tc.description || `Test Case ${index + 1}`,
        ruleId: tc.ruleId,
        ruleName: tc.ruleName,
        description: tc.description,
        url: tc.url || `https://www.w3.org/WAI/standards-guidelines/act/rules/${tc.ruleId}/testcases/${tc.id}`,
        source: 'W3C WCAG ACT Rules',
        type: 'accessibility_test_case',
        accessibilityRequirements: tc.ruleAccessibilityRequirements || {},
        expectedOutcome: tc.expectedOutcome,
        testCaseType: tc.testCaseType
      });
    });
  }
  
  const dataset = {
    name: 'WCAG Test Cases',
    source: data.website || 'W3C WCAG ACT Rules',
    version: '1.0.0',
    created: new Date().toISOString(),
    description: data.description || 'WCAG accessibility test cases from W3C ACT Rules',
    totalTestCases: testCases.length,
    testCases,
    license: data.license,
    count: data.count || testCases.length
  };
  
  writeFileSync(OUTPUT_FILE, JSON.stringify(dataset, null, 2));
  
  console.log(`✅ Parsing completed!`);
  console.log(`   Found ${testCases.length} test cases`);
  console.log(`   Output: ${OUTPUT_FILE}`);
  
  return dataset;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  parseWCAGTestCases();
}

export { parseWCAGTestCases };

