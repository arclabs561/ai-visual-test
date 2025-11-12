/**
 * Comprehensive E2E Testing with All Recommended Methods
 * 
 * Tests real websites using:
 * - VLLM visual assessment (what we have)
 * - Performance measurement (what we should add)
 * - Accessibility auditing (what we should add)
 * - Responsive design testing (what we should add)
 * - Interaction state testing (what we should add)
 * - Code quality analysis (what we should add)
 */

import { chromium } from 'playwright';
import { experiencePageAsPersona } from '../src/persona-experience.mjs';
import { ExperienceTrace } from '../src/experience-tracer.mjs';
import { validateScreenshot } from '../src/index.mjs';
import { extractRenderedCode } from '../src/multi-modal.mjs';
import { aggregateTemporalNotes } from '../src/temporal.mjs';
import { mkdirSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';

const testResultsDir = join(process.cwd(), 'test-results');
if (!existsSync(testResultsDir)) {
  mkdirSync(testResultsDir, { recursive: true });
}

/**
 * Measure performance metrics (VLM cannot do this)
 */
async function measurePerformance(page) {
  return await page.evaluate(() => {
    const timing = performance.timing;
    const navigation = timing.navigationStart;
    
    return {
      loadTime: timing.loadEventEnd - navigation,
      domContentLoaded: timing.domContentLoadedEventEnd - navigation,
      firstPaint: performance.getEntriesByType('paint').find(e => e.name === 'first-paint')?.startTime || null,
      firstContentfulPaint: performance.getEntriesByType('paint').find(e => e.name === 'first-contentful-paint')?.startTime || null,
      resources: performance.getEntriesByType('resource').length,
      largeResources: performance.getEntriesByType('resource').filter(r => r.transferSize > 100000).length,
      totalTransferSize: performance.getEntriesByType('resource').reduce((sum, r) => sum + (r.transferSize || 0), 0),
      domSize: document.querySelectorAll('*').length
    };
  });
}

/**
 * Audit accessibility (VLM cannot assess code structure)
 */
async function auditAccessibility(page) {
  return await page.evaluate(() => {
    const issues = [];
    
    // Check ARIA labels
    const interactiveElements = document.querySelectorAll('button, a, input, [role="button"], [role="link"]');
    interactiveElements.forEach(el => {
      const ariaLabel = el.getAttribute('aria-label');
      const ariaLabelledBy = el.getAttribute('aria-labelledby');
      const textContent = el.textContent.trim();
      const altText = el.getAttribute('alt');
      
      if (!ariaLabel && !ariaLabelledBy && !textContent && !altText) {
        const tagName = el.tagName.toLowerCase();
        const role = el.getAttribute('role') || tagName;
        issues.push({
          type: 'missing-accessible-name',
          element: role,
          severity: 'high',
          message: `${role} element without accessible name`
        });
      }
    });
    
    // Check heading hierarchy
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    let prevLevel = 0;
    headings.forEach(h => {
      const level = parseInt(h.tagName[1]);
      if (level > prevLevel + 1 && prevLevel > 0) {
        issues.push({
          type: 'heading-hierarchy-skip',
          element: h.tagName,
          severity: 'medium',
          message: `Heading hierarchy skip: h${prevLevel} → h${level}`
        });
      }
      prevLevel = level;
    });
    
    // Check semantic HTML
    const semanticElements = document.querySelectorAll('main, article, section, nav, header, footer, aside');
    if (semanticElements.length === 0) {
      issues.push({
        type: 'no-semantic-html',
        severity: 'medium',
        message: 'No semantic HTML elements found (main, article, section, etc.)'
      });
    }
    
    // Check focus management
    const focusable = document.querySelectorAll('a, button, input, [tabindex]:not([tabindex="-1"])');
    const hiddenFocusable = Array.from(focusable).filter(el => {
      const style = window.getComputedStyle(el);
      return style.display === 'none' || style.visibility === 'hidden';
    });
    
    if (hiddenFocusable.length > 0) {
      issues.push({
        type: 'hidden-focusable',
        severity: 'high',
        message: `${hiddenFocusable.length} focusable elements are hidden (focus trap risk)`
      });
    }
    
    return {
      issues,
      summary: {
        total: issues.length,
        high: issues.filter(i => i.severity === 'high').length,
        medium: issues.filter(i => i.severity === 'medium').length,
        low: issues.filter(i => i.severity === 'low').length
      }
    };
  });
}

/**
 * Test responsive design (VLM only sees one viewport)
 */
async function testResponsiveDesign(page, url) {
  const viewports = [
    { width: 375, height: 667, name: 'Mobile' },
    { width: 768, height: 1024, name: 'Tablet' },
    { width: 1280, height: 720, name: 'Desktop' }
  ];
  
  const results = [];
  
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1000);
    
    const layout = await page.evaluate(() => {
      return {
        width: window.innerWidth,
        height: window.innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        overflowX: document.documentElement.scrollWidth > window.innerWidth,
        overflowY: document.documentElement.scrollHeight > window.innerHeight
      };
    });
    
    const issues = [];
    if (layout.overflowX) {
      issues.push('Horizontal overflow detected');
    }
    if (layout.scrollWidth > viewport.width * 1.1) {
      issues.push(`Content width (${layout.scrollWidth}px) significantly exceeds viewport (${viewport.width}px)`);
    }
    
    results.push({
      viewport: viewport.name,
      size: `${viewport.width}x${viewport.height}`,
      issues,
      layout
    });
  }
  
  return results;
}

/**
 * Test interaction states (VLM sees static images)
 */
async function testInteractionStates(page) {
  const states = {
    hover: [],
    focus: [],
    active: []
  };
  
  // Test button hover states
  const buttons = await page.locator('button, a, [role="button"]').all();
  for (let i = 0; i < Math.min(buttons.length, 5); i++) {
    try {
      const button = buttons[i];
      await button.hover();
      await page.waitForTimeout(100);
      
      const hoverState = await button.evaluate(el => {
        const style = window.getComputedStyle(el);
        return {
          backgroundColor: style.backgroundColor,
          color: style.color,
          transform: style.transform,
          boxShadow: style.boxShadow
        };
      });
      
      states.hover.push({
        element: i,
        hasChange: hoverState.backgroundColor !== 'rgba(0, 0, 0, 0)' || hoverState.transform !== 'none'
      });
    } catch (error) {
      // Skip if hover fails
    }
  }
  
  // Test focus states
  const focusable = await page.locator('input, button, a, [tabindex]:not([tabindex="-1"])').first();
  if (await focusable.count() > 0) {
    await focusable.focus();
    await page.waitForTimeout(100);
    
    const focusState = await focusable.evaluate(el => {
      const style = window.getComputedStyle(el);
      return {
        outline: style.outline,
        outlineWidth: style.outlineWidth,
        outlineColor: style.outlineColor
      };
    });
    
    states.focus.push({
      hasVisibleOutline: focusState.outlineWidth !== '0px' && focusState.outlineColor !== 'transparent'
    });
  }
  
  return states;
}

/**
 * Analyze code quality (VLM cannot see code)
 */
async function analyzeCodeQuality(page) {
  const renderedCode = await extractRenderedCode(page);
  if (!renderedCode) {
    return null;
  }
  
  const analysis = {
    semanticHTML: {
      hasMain: /<main/i.test(renderedCode.html),
      hasArticle: /<article/i.test(renderedCode.html),
      hasSection: /<section/i.test(renderedCode.html),
      hasNav: /<nav/i.test(renderedCode.html),
      hasHeader: /<header/i.test(renderedCode.html),
      hasFooter: /<footer/i.test(renderedCode.html)
    },
    inlineStyles: (renderedCode.html.match(/style\s*=/g) || []).length,
    inlineScripts: (renderedCode.html.match(/<script[^>]*>/gi) || []).length,
    cssRules: renderedCode.css ? renderedCode.css.split('}').length - 1 : 0,
    issues: []
  };
  
  // Check for issues
  if (analysis.inlineStyles > 20) {
    analysis.issues.push({
      type: 'too-many-inline-styles',
      severity: 'medium',
      message: `${analysis.inlineStyles} inline styles found (maintenance issue)`
    });
  }
  
  const semanticCount = Object.values(analysis.semanticHTML).filter(v => v).length;
  if (semanticCount === 0) {
    analysis.issues.push({
      type: 'no-semantic-html',
      severity: 'medium',
      message: 'No semantic HTML elements found'
    });
  }
  
  return analysis;
}

/**
 * Comprehensive test of a website
 */
async function testWebsiteComprehensively(name, url, expectedGaps = []) {
  console.log(`\n🌐 Comprehensive Test: ${name}`);
  console.log(`   URL: ${url}`);
  console.log(`   Expected Gaps: ${expectedGaps.join(', ') || 'none'}`);
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const results = {
    name,
    url,
    vlmAssessment: null,
    performance: null,
    accessibility: null,
    responsive: null,
    interactionStates: null,
    codeQuality: null,
    gaps: {
      vlmMissed: [],
      shouldHaveTested: []
    }
  };
  
  try {
    // Navigate
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // 1. VLLM Assessment (what we have)
    console.log('\n  1️⃣ VLLM Visual Assessment:');
    const trace = new ExperienceTrace(`${name.toLowerCase().replace(/\s+/g, '-')}-test`);
    const experience = await experiencePageAsPersona(page, {
      name: 'Comprehensive Tester',
      perspective: 'Evaluating website comprehensively',
      goals: ['accessibility', 'usability', 'visual clarity']
    }, {
      url,
      captureScreenshots: true,
      captureCode: true,
      trace: trace
    });
    
    if (experience.screenshots.length > 0) {
      const screenshot = experience.screenshots[0].path;
      const vlmResult = await validateScreenshot(screenshot,
        'Evaluate this website comprehensively. Check for: 1) Visual clarity, 2) Layout quality, 3) Accessibility, 4) Usability',
        {
          testType: 'comprehensive',
          temporalNotes: experience.notes,
          experienceTrace: trace
        }
      );
      
      results.vlmAssessment = {
        score: vlmResult.score,
        issues: vlmResult.issues || [],
        reasoning: vlmResult.reasoning
      };
      
      console.log(`     ✅ Score: ${vlmResult.score}/10`);
      console.log(`     ✅ Issues: ${vlmResult.issues?.length || 0}`);
    }
    
    // 2. Performance Measurement (what we should add)
    console.log('\n  2️⃣ Performance Measurement (VLM Cannot Do This):');
    results.performance = await measurePerformance(page);
    console.log(`     ✅ Load time: ${results.performance.loadTime}ms`);
    console.log(`     ✅ Resources: ${results.performance.resources}`);
    console.log(`     ✅ Large resources: ${results.performance.largeResources}`);
    
    if (results.performance.loadTime > 3000) {
      results.gaps.vlmMissed.push(`Slow load time: ${results.performance.loadTime}ms (VLM cannot measure)`);
      console.log(`     ❌ VLM missed: Slow load time`);
    }
    
    // 3. Accessibility Auditing (what we should add)
    console.log('\n  3️⃣ Accessibility Auditing (VLM Cannot Assess Code):');
    results.accessibility = await auditAccessibility(page);
    console.log(`     ✅ Issues found: ${results.accessibility.summary.total}`);
    console.log(`     ✅ High severity: ${results.accessibility.summary.high}`);
    
    if (results.accessibility.summary.total > 0) {
      results.gaps.vlmMissed.push(`${results.accessibility.summary.total} accessibility issues (VLM cannot assess code structure)`);
      console.log(`     ❌ VLM missed: ${results.accessibility.summary.total} accessibility issues`);
    }
    
    // 4. Responsive Design Testing (what we should add)
    console.log('\n  4️⃣ Responsive Design Testing (VLM Sees Only One Viewport):');
    results.responsive = await testResponsiveDesign(page, url);
    const responsiveIssues = results.responsive.filter(r => r.issues.length > 0);
    console.log(`     ✅ Tested ${results.responsive.length} viewports`);
    console.log(`     ✅ Issues: ${responsiveIssues.length} viewports with problems`);
    
    if (responsiveIssues.length > 0) {
      results.gaps.vlmMissed.push(`Responsive issues on ${responsiveIssues.length} viewports (VLM only sees one)`);
      console.log(`     ❌ VLM missed: Responsive design issues`);
    }
    
    // 5. Interaction State Testing (what we should add)
    console.log('\n  5️⃣ Interaction State Testing (VLM Sees Static Images):');
    results.interactionStates = await testInteractionStates(page);
    console.log(`     ✅ Tested hover states: ${results.interactionStates.hover.length}`);
    console.log(`     ✅ Tested focus states: ${results.interactionStates.focus.length}`);
    
    if (results.interactionStates.focus.length > 0 && !results.interactionStates.focus[0].hasVisibleOutline) {
      results.gaps.vlmMissed.push('No visible focus indicators (VLM cannot test interactions)');
      console.log(`     ❌ VLM missed: Focus state issues`);
    }
    
    // 6. Code Quality Analysis (what we should add)
    console.log('\n  6️⃣ Code Quality Analysis (VLM Cannot See Code):');
    results.codeQuality = await analyzeCodeQuality(page);
    if (results.codeQuality) {
      console.log(`     ✅ Semantic HTML elements: ${Object.values(results.codeQuality.semanticHTML).filter(v => v).length}`);
      console.log(`     ✅ Inline styles: ${results.codeQuality.inlineStyles}`);
      console.log(`     ✅ Code quality issues: ${results.codeQuality.issues.length}`);
      
      if (results.codeQuality.issues.length > 0) {
        results.gaps.vlmMissed.push(`${results.codeQuality.issues.length} code quality issues (VLM cannot see code)`);
        console.log(`     ❌ VLM missed: Code quality issues`);
      }
    }
    
    // Summary
    console.log('\n  📊 Summary:');
    console.log(`     VLM Assessment: ${results.vlmAssessment?.score || 'N/A'}/10`);
    console.log(`     Performance: ${results.performance?.loadTime || 'N/A'}ms`);
    console.log(`     Accessibility: ${results.accessibility?.summary.total || 0} issues`);
    console.log(`     Responsive: ${responsiveIssues.length} viewports with issues`);
    console.log(`     Gaps VLM Missed: ${results.gaps.vlmMissed.length}`);
    
    return results;
    
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    results.error = error.message;
    return results;
  } finally {
    await browser.close();
  }
}

/**
 * Main comprehensive test runner
 */
async function runComprehensiveTests() {
  console.log('🚀 Comprehensive E2E Testing with All Methods');
  console.log('='.repeat(60));
  console.log('\nTesting with:');
  console.log('  ✅ VLLM visual assessment (what we have)');
  console.log('  ✅ Performance measurement (what we should add)');
  console.log('  ✅ Accessibility auditing (what we should add)');
  console.log('  ✅ Responsive design testing (what we should add)');
  console.log('  ✅ Interaction state testing (what we should add)');
  console.log('  ✅ Code quality analysis (what we should add)');
  
  const websites = [
    {
      name: '2048 Game',
      url: 'https://play2048.co/',
      expectedGaps: ['performance', 'accessibility', 'code quality']
    },
    {
      name: 'GitHub Homepage',
      url: 'https://github.com',
      expectedGaps: ['responsive design', 'interaction states']
    }
  ];
  
  const allResults = [];
  
  for (const site of websites) {
    const result = await testWebsiteComprehensively(site.name, site.url, site.expectedGaps);
    allResults.push(result);
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Save results
  const resultsFile = join(testResultsDir, `comprehensive-tests-${Date.now()}.json`);
  writeFileSync(resultsFile, JSON.stringify(allResults, null, 2));
  console.log(`\n📁 Results saved to: ${resultsFile}`);
  
  // Summary
  console.log('\n📊 Overall Summary');
  console.log('='.repeat(60));
  allResults.forEach(result => {
    console.log(`\n${result.name}:`);
    console.log(`  VLM Score: ${result.vlmAssessment?.score || 'N/A'}/10`);
    console.log(`  Performance: ${result.performance?.loadTime || 'N/A'}ms`);
    console.log(`  Accessibility Issues: ${result.accessibility?.summary.total || 0}`);
    console.log(`  Gaps VLM Missed: ${result.gaps.vlmMissed.length}`);
    if (result.gaps.vlmMissed.length > 0) {
      result.gaps.vlmMissed.forEach(gap => console.log(`    - ${gap}`));
    }
  });
  
  return allResults;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runComprehensiveTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { runComprehensiveTests, testWebsiteComprehensively, measurePerformance, auditAccessibility, testResponsiveDesign, testInteractionStates, analyzeCodeQuality };

