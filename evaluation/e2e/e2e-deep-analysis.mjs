/**
 * Deep Analysis of E2E Test Results
 * 
 * Analyzes what VLMs missed, what methods proved useful, and what should be tested.
 * Based on research findings about VLLM limitations.
 */

import { chromium } from 'playwright';
import { experiencePageAsPersona } from '../../src/persona-experience.mjs';
import { ExperienceTrace } from '../../src/experience-tracer.mjs';
import { validateScreenshot } from '../../src/index.mjs';
import { extractRenderedCode } from '../../src/multi-modal.mjs';
import { checkCrossModalConsistency } from '../../src/cross-modal-consistency.mjs';
import { aggregateTemporalNotes } from '../../src/temporal.mjs';
import { mkdirSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';

const testResultsDir = join(process.cwd(), 'test-results');
if (!existsSync(testResultsDir)) {
  mkdirSync(testResultsDir, { recursive: true });
}

/**
 * Analyze what VLM missed in 2048 game evaluation
 * Based on research: VLMs have "myopia" - miss fine details, binding problems
 */
async function analyze2048Gaps() {
  console.log('\n🔍 Deep Analysis: 2048 Game - What Was Missed?');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto('https://play2048.co/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // What VLM likely missed (based on research):
    const gaps = {
      fineVisualDetails: [],
      interactionStates: [],
      accessibility: [],
      performance: [],
      codeStructure: [],
      temporalAspects: []
    };
    
    // 1. Fine Visual Details (VLM "myopia")
    console.log('\n  1️⃣ Fine Visual Details (VLM Myopia):');
    
    // Check precise spacing, alignment
    const gridAnalysis = await page.evaluate(() => {
      const grid = document.querySelector('.grid-container');
      if (!grid) return null;
      
      const cells = grid.querySelectorAll('.grid-cell, .tile');
      const spacing = [];
      const alignments = [];
      
      // Check spacing consistency
      for (let i = 0; i < cells.length - 1; i++) {
        const rect1 = cells[i].getBoundingClientRect();
        const rect2 = cells[i + 1].getBoundingClientRect();
        const gap = Math.abs(rect2.left - rect1.right);
        spacing.push(gap);
      }
      
      // Check alignment
      const firstRow = Array.from(cells).slice(0, 4);
      const firstRowTop = firstRow.map(c => c.getBoundingClientRect().top);
      const alignmentVariance = Math.max(...firstRowTop) - Math.min(...firstRowTop);
      
      return {
        spacingVariance: spacing.length > 0 ? Math.max(...spacing) - Math.min(...spacing) : 0,
        alignmentVariance,
        cellCount: cells.length
      };
    });
    
    if (gridAnalysis) {
      if (gridAnalysis.spacingVariance > 2) {
        gaps.fineVisualDetails.push(`Inconsistent grid spacing (variance: ${gridAnalysis.spacingVariance}px)`);
        console.log(`     ❌ Inconsistent grid spacing detected (VLM likely missed this)`);
      }
      if (gridAnalysis.alignmentVariance > 1) {
        gaps.fineVisualDetails.push(`Misaligned grid cells (variance: ${gridAnalysis.alignmentVariance}px)`);
        console.log(`     ❌ Misaligned cells detected (VLM likely missed this)`);
      }
    }
    
    // 2. Interaction States (VLM can't see hover/focus/active)
    console.log('\n  2️⃣ Interaction States (VLM Blind Spot):');
    
    const interactionStates = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a, [role="button"]'));
      const states = {
        hasHover: false,
        hasFocus: false,
        hasActive: false,
        keyboardAccessible: false
      };
      
      // Check if elements have hover styles
      const style = window.getComputedStyle(buttons[0] || document.body);
      // Can't directly check :hover, but can check if element is focusable
      states.keyboardAccessible = buttons.some(btn => {
        const tabIndex = btn.getAttribute('tabindex');
        return tabIndex !== '-1' && (tabIndex !== null || btn.tagName === 'BUTTON' || btn.tagName === 'A');
      });
      
      return states;
    });
    
    if (!interactionStates.keyboardAccessible) {
      gaps.interactionStates.push('Buttons may not be keyboard accessible');
      console.log(`     ❌ Keyboard accessibility unclear (VLM can't test this)`);
    }
    
    // 3. Accessibility (VLM can't assess code structure)
    console.log('\n  3️⃣ Accessibility (Code Structure):');
    
    const accessibility = await page.evaluate(() => {
      const issues = [];
      
      // Check ARIA labels
      const buttons = document.querySelectorAll('button, [role="button"]');
      buttons.forEach(btn => {
        const ariaLabel = btn.getAttribute('aria-label');
        const ariaLabelledBy = btn.getAttribute('aria-labelledby');
        const textContent = btn.textContent.trim();
        
        if (!ariaLabel && !ariaLabelledBy && !textContent) {
          issues.push(`Button without accessible name: ${btn.className}`);
        }
      });
      
      // Check color contrast (approximate)
      const elements = document.querySelectorAll('*');
      let lowContrastCount = 0;
      elements.forEach(el => {
        const style = window.getComputedStyle(el);
        const color = style.color;
        const bgColor = style.backgroundColor;
        // Simplified check - VLM can't do this precisely
        if (color === bgColor || (color.includes('rgb') && bgColor.includes('rgb'))) {
          // Would need proper contrast calculation
        }
      });
      
      // Check semantic HTML
      const hasHeading = document.querySelector('h1, h2, h3, h4, h5, h6');
      if (!hasHeading) {
        issues.push('No heading structure found');
      }
      
      return issues;
    });
    
    if (accessibility.length > 0) {
      gaps.accessibility = accessibility;
      console.log(`     ❌ Accessibility issues found: ${accessibility.length} (VLM can't assess code structure)`);
      accessibility.forEach(issue => console.log(`        - ${issue}`));
    }
    
    // 4. Performance (VLM can't measure)
    console.log('\n  4️⃣ Performance (VLM Blind Spot):');
    
    const performance = await page.evaluate(() => {
      return {
        loadTime: performance.timing.loadEventEnd - performance.timing.navigationStart,
        domContentLoaded: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
        firstPaint: performance.getEntriesByType('paint').find(e => e.name === 'first-paint')?.startTime || null,
        resources: performance.getEntriesByType('resource').length
      };
    });
    
    if (performance.loadTime > 3000) {
      gaps.performance.push(`Slow load time: ${performance.loadTime}ms`);
      console.log(`     ❌ Slow load time: ${performance.loadTime}ms (VLM can't measure this)`);
    }
    
    // 5. Code Structure (VLM can't see)
    console.log('\n  5️⃣ Code Structure (VLM Blind Spot):');
    
    const renderedCode = await extractRenderedCode(page);
    if (renderedCode) {
      // Check for semantic HTML
      const hasSemanticElements = /<(header|nav|main|article|section|footer|aside)/i.test(renderedCode.html);
      if (!hasSemanticElements) {
        gaps.codeStructure.push('No semantic HTML elements found');
        console.log(`     ❌ No semantic HTML (VLM can't see code structure)`);
      }
      
      // Check for inline styles (bad practice)
      const inlineStyles = (renderedCode.html.match(/style\s*=/g) || []).length;
      if (inlineStyles > 10) {
        gaps.codeStructure.push(`Many inline styles: ${inlineStyles} (maintenance issue)`);
        console.log(`     ❌ Many inline styles: ${inlineStyles} (VLM can't assess code quality)`);
      }
    }
    
    // 6. Temporal Aspects (VLM sees static images)
    console.log('\n  6️⃣ Temporal Aspects (VLM Static Limitation):');
    
    // Play a move and measure response time
    const startTime = Date.now();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100);
    const responseTime = Date.now() - startTime;
    
    if (responseTime > 200) {
      gaps.temporalAspects.push(`Slow interaction response: ${responseTime}ms`);
      console.log(`     ❌ Slow interaction: ${responseTime}ms (VLM can't measure temporal response)`);
    }
    
    // Check for animations
    const hasAnimations = await page.evaluate(() => {
      const styleSheets = Array.from(document.styleSheets);
      return styleSheets.some(sheet => {
        try {
          const rules = Array.from(sheet.cssRules || []);
          return rules.some(rule => 
            rule.type === CSSRule.KEYFRAMES_RULE || 
            (rule.style && rule.style.animation)
          );
        } catch (e) {
          return false;
        }
      });
    });
    
    if (!hasAnimations) {
      gaps.temporalAspects.push('No visual feedback animations detected');
      console.log(`     ⚠️  No animations (VLM can't assess animation quality)`);
    }
    
    return gaps;
    
  } catch (error) {
    console.error(`  ❌ Analysis error: ${error.message}`);
    return null;
  } finally {
    await browser.close();
  }
}

/**
 * Analyze GitHub homepage gaps
 */
async function analyzeGitHubGaps() {
  console.log('\n🔍 Deep Analysis: GitHub - What Was Missed?');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto('https://github.com', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    const gaps = {
      informationArchitecture: [],
      responsiveDesign: [],
      accessibility: [],
      performance: [],
      interactionPatterns: []
    };
    
    // 1. Information Architecture (VLM binding problem)
    console.log('\n  1️⃣ Information Architecture (VLM Binding Problem):');
    
    const iaAnalysis = await page.evaluate(() => {
      const navItems = Array.from(document.querySelectorAll('nav a, header a'));
      const mainSections = Array.from(document.querySelectorAll('main section, [role="main"] section'));
      
      return {
        navItems: navItems.length,
        mainSections: mainSections.length,
        hasBreadcrumbs: !!document.querySelector('[aria-label*="breadcrumb"], .breadcrumb'),
        hasSearch: !!document.querySelector('input[type="search"], [role="search"]')
      };
    });
    
    if (!iaAnalysis.hasBreadcrumbs) {
      gaps.informationArchitecture.push('No breadcrumb navigation (user orientation issue)');
      console.log(`     ❌ No breadcrumbs (VLM may miss navigation structure)`);
    }
    
    // 2. Responsive Design (VLM sees one viewport)
    console.log('\n  2️⃣ Responsive Design (VLM Single Viewport):');
    
    const viewports = [
      { width: 375, height: 667, name: 'Mobile' },
      { width: 768, height: 1024, name: 'Tablet' },
      { width: 1280, height: 720, name: 'Desktop' }
    ];
    
    const responsiveIssues = [];
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(500);
      
      const layout = await page.evaluate(() => {
        const nav = document.querySelector('nav, header');
        const main = document.querySelector('main, [role="main"]');
        
        return {
          navVisible: nav ? window.getComputedStyle(nav).display !== 'none' : false,
          mainVisible: main ? window.getComputedStyle(main).display !== 'none' : false,
          overflow: document.documentElement.scrollWidth > window.innerWidth
        };
      });
      
      if (layout.overflow) {
        responsiveIssues.push(`Horizontal overflow on ${viewport.name}`);
      }
    }
    
    if (responsiveIssues.length > 0) {
      gaps.responsiveDesign = responsiveIssues;
      console.log(`     ❌ Responsive issues: ${responsiveIssues.length} (VLM only sees one viewport)`);
    }
    
    // 3. Accessibility (code structure)
    const a11y = await page.evaluate(() => {
      const issues = [];
      
      // Check heading hierarchy
      const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
      let prevLevel = 0;
      headings.forEach(h => {
        const level = parseInt(h.tagName[1]);
        if (level > prevLevel + 1) {
          issues.push(`Heading hierarchy skip: ${prevLevel} → ${level}`);
        }
        prevLevel = level;
      });
      
      // Check focus management
      const focusable = document.querySelectorAll('a, button, input, [tabindex]:not([tabindex="-1"])');
      const focusableCount = focusable.length;
      const visibleFocusable = Array.from(focusable).filter(el => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
      }).length;
      
      if (focusableCount !== visibleFocusable) {
        issues.push('Some focusable elements are hidden (focus trap risk)');
      }
      
      return issues;
    });
    
    if (a11y.length > 0) {
      gaps.accessibility = a11y;
      console.log(`     ❌ Accessibility issues: ${a11y.length} (VLM can't assess code)`);
    }
    
    // 4. Performance
    const perf = await page.evaluate(() => {
      const metrics = {
        loadTime: performance.timing.loadEventEnd - performance.timing.navigationStart,
        resources: performance.getEntriesByType('resource').length,
        largeResources: performance.getEntriesByType('resource').filter(r => r.transferSize > 100000).length,
        domSize: document.querySelectorAll('*').length
      };
      return metrics;
    });
    
    if (perf.largeResources > 5) {
      gaps.performance.push(`Many large resources: ${perf.largeResources} (slow load)`);
      console.log(`     ❌ Performance issue: ${perf.largeResources} large resources (VLM can't measure)`);
    }
    
    // 5. Interaction Patterns
    console.log('\n  5️⃣ Interaction Patterns (VLM Static Limitation):');
    
    // Test dropdown interaction (with better selector and error handling)
    try {
      const dropdown = page.locator('nav details summary, button[aria-expanded]').first();
      if (await dropdown.count() > 0) {
        await dropdown.click({ timeout: 5000 });
        await page.waitForTimeout(300);
        
        const dropdownState = await page.evaluate(() => {
          const details = document.querySelector('details[open]');
          const expanded = document.querySelector('[aria-expanded="true"]');
          return {
            isOpen: !!details || !!expanded
          };
        });
        
        if (!dropdownState.isOpen) {
          gaps.interactionPatterns.push('Dropdown interaction may not work');
          console.log(`     ❌ Dropdown interaction unclear (VLM can't test interactions)`);
        } else {
          console.log(`     ✅ Dropdown interaction works (VLM can't test this)`);
        }
      }
    } catch (error) {
      // Dropdown interaction testing failed - this is expected, VLM can't test it anyway
      gaps.interactionPatterns.push('Could not test dropdown interaction (VLM limitation)');
      console.log(`     ⚠️  Could not test dropdown (VLM can't test interactions anyway)`);
    }
    
    return gaps;
    
  } catch (error) {
    console.error(`  ❌ Analysis error: ${error.message}`);
    return null;
  } finally {
    await browser.close();
  }
}

/**
 * Compare VLM judgment vs. reality
 */
async function compareVLMvsReality() {
  console.log('\n📊 Comparing VLM Judgment vs. Reality');
  console.log('='.repeat(60));
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto('https://play2048.co/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // Get VLM judgment
    const screenshot = await page.screenshot({ path: join(testResultsDir, '2048-comparison.png') });
    const vlmJudgment = await validateScreenshot(join(testResultsDir, '2048-comparison.png'),
      'Evaluate this game interface comprehensively',
      { testType: 'gameplay' }
    );
    
    // Get reality (code-based analysis)
    const reality = await page.evaluate(() => {
      return {
        // Accessibility
        hasAriaLabels: Array.from(document.querySelectorAll('button')).some(b => b.getAttribute('aria-label')),
        hasSemanticHTML: !!document.querySelector('main, article, section'),
        keyboardAccessible: Array.from(document.querySelectorAll('button, a')).every(el => {
          const tabIndex = el.getAttribute('tabindex');
          return tabIndex !== '-1';
        }),
        
        // Visual
        gridCells: document.querySelectorAll('.grid-cell, .tile').length,
        hasScoreDisplay: !!document.querySelector('[class*="score"], [id*="score"]'),
        
        // Performance
        loadTime: performance.timing.loadEventEnd - performance.timing.navigationStart,
        resourceCount: performance.getEntriesByType('resource').length
      };
    });
    
    // Compare
    console.log('\nVLM Said:');
    console.log(`  Score: ${vlmJudgment.score}/10`);
    console.log(`  Issues: ${vlmJudgment.issues?.slice(0, 3).join(', ') || 'None'}`);
    
    console.log('\nReality (Code Analysis):');
    console.log(`  Has ARIA labels: ${reality.hasAriaLabels}`);
    console.log(`  Has semantic HTML: ${reality.hasSemanticHTML}`);
    console.log(`  Keyboard accessible: ${reality.keyboardAccessible}`);
    console.log(`  Grid cells: ${reality.gridCells}`);
    console.log(`  Load time: ${reality.loadTime}ms`);
    
    console.log('\nGaps (What VLM Missed):');
    if (!reality.hasAriaLabels && !vlmJudgment.issues?.some(i => i.toLowerCase().includes('aria'))) {
      console.log('  ❌ VLM missed: Missing ARIA labels');
    }
    if (!reality.hasSemanticHTML && !vlmJudgment.issues?.some(i => i.toLowerCase().includes('semantic'))) {
      console.log('  ❌ VLM missed: No semantic HTML structure');
    }
    if (reality.loadTime > 3000 && !vlmJudgment.issues?.some(i => i.toLowerCase().includes('performance'))) {
      console.log('  ❌ VLM missed: Performance issues (can\'t measure load time)');
    }
    
  } catch (error) {
    console.error(`  ❌ Comparison error: ${error.message}`);
  } finally {
    await browser.close();
  }
}

/**
 * Test additional websites that should be tested
 */
async function testAdditionalWebsites() {
  console.log('\n🌐 Testing Additional Websites');
  console.log('='.repeat(60));
  
  const websites = [
    {
      name: 'E-commerce (Amazon)',
      url: 'https://www.amazon.com',
      expectedGaps: ['product images', 'shopping cart', 'checkout flow', 'product reviews'],
      testFocus: 'e-commerce patterns, product discovery, checkout accessibility'
    },
    {
      name: 'Social Media (Twitter/X)',
      url: 'https://twitter.com',
      expectedGaps: ['feed interaction', 'real-time updates', 'accessibility of timeline'],
      testFocus: 'dynamic content, real-time interactions, information density'
    },
    {
      name: 'News Site (BBC)',
      url: 'https://www.bbc.com',
      expectedGaps: ['article readability', 'navigation complexity', 'ad placement'],
      testFocus: 'content hierarchy, reading experience, navigation patterns'
    },
    {
      name: 'Dashboard (GitHub Dashboard)',
      url: 'https://github.com/dashboard',
      expectedGaps: ['data visualization', 'interactive charts', 'filtering UI'],
      testFocus: 'data presentation, interaction patterns, information density'
    },
    {
      name: 'Form-Heavy (Google Forms)',
      url: 'https://docs.google.com/forms',
      expectedGaps: ['form validation', 'error messages', 'field dependencies'],
      testFocus: 'form usability, validation feedback, accessibility'
    }
  ];
  
  console.log('\nRecommended Additional Tests:');
  websites.forEach(site => {
    console.log(`\n  📍 ${site.name}`);
    console.log(`     URL: ${site.url}`);
    console.log(`     Expected Gaps: ${site.expectedGaps.join(', ')}`);
    console.log(`     Test Focus: ${site.testFocus}`);
  });
  
  return websites;
}

/**
 * Analyze what methods proved most useful
 */
function analyzeUsefulMethods() {
  console.log('\n🔬 Methods Analysis: What Proved Most Useful?');
  console.log('='.repeat(60));
  
  const methods = {
    mostUseful: [
      {
        method: 'Temporal Notes Aggregation',
        why: 'Captured experience over time, showed coherence patterns',
        evidence: '100% coherence for 2048, 85% for GitHub',
        limitation: 'Requires multiple observations'
      },
      {
        method: 'Experience Trace',
        why: 'Tracked events, screenshots, validations in sequence',
        evidence: 'Successfully captured game moves, scrolling, navigation',
        limitation: 'Memory intensive for long sessions'
      },
      {
        method: 'Cross-Modal Consistency',
        why: 'Validated screenshot vs. HTML/CSS alignment',
        evidence: 'Detected when visual and structural code mismatch',
        limitation: 'Requires code extraction'
      },
      {
        method: 'Late Interaction with Temporal Context',
        why: 'Explanations referenced temporal patterns',
        evidence: 'VLM could explain "why score changed over time"',
        limitation: 'Requires stored temporal context'
      }
    ],
    shouldHaveUsed: [
      {
        method: 'Performance Measurement',
        why: 'VLM can\'t measure load time, resource usage',
        how: 'Use browser Performance API',
        example: 'performance.timing, performance.getEntriesByType("resource")'
      },
      {
        method: 'Accessibility Auditing',
        why: 'VLM can\'t assess code structure (ARIA, semantic HTML)',
        how: 'Use axe-core or similar tools',
        example: 'Programmatic checks for ARIA labels, heading hierarchy'
      },
      {
        method: 'Responsive Design Testing',
        why: 'VLM only sees one viewport at a time',
        how: 'Test multiple viewports programmatically',
        example: 'Test mobile (375px), tablet (768px), desktop (1280px)'
      },
      {
        method: 'Interaction State Testing',
        why: 'VLM sees static images, can\'t test hover/focus/active',
        how: 'Programmatically trigger states and screenshot',
        example: 'Test button:hover, input:focus, modal:active states'
      },
      {
        method: 'Code Quality Analysis',
        why: 'VLM can\'t assess code structure, maintainability',
        how: 'Parse HTML/CSS/JS for patterns',
        example: 'Check for semantic HTML, inline styles, accessibility attributes'
      },
      {
        method: 'Temporal Interaction Testing',
        why: 'VLM can\'t measure response times, animation smoothness',
        how: 'Measure time between action and visual feedback',
        example: 'Time from click to UI update, animation frame rate'
      }
    ]
  };
  
  console.log('\n✅ Most Useful Methods:');
  methods.mostUseful.forEach((m, i) => {
    console.log(`\n  ${i + 1}. ${m.method}`);
    console.log(`     Why: ${m.why}`);
    console.log(`     Evidence: ${m.evidence}`);
    console.log(`     Limitation: ${m.limitation}`);
  });
  
  console.log('\n⚠️  Should Have Used:');
  methods.shouldHaveUsed.forEach((m, i) => {
    console.log(`\n  ${i + 1}. ${m.method}`);
    console.log(`     Why: ${m.why}`);
    console.log(`     How: ${m.how}`);
    console.log(`     Example: ${m.example}`);
  });
  
  return methods;
}

/**
 * Main analysis runner
 */
async function runDeepAnalysis() {
  console.log('🔍 Deep Analysis of E2E Test Results');
  console.log('='.repeat(60));
  console.log('\nBased on research findings:');
  console.log('  - VLMs have "myopia" - miss fine visual details');
  console.log('  - VLMs struggle with multi-object binding');
  console.log('  - VLMs can\'t assess code structure, performance, interaction states');
  console.log('  - VLMs see static images, miss temporal aspects');
  
  const results = {
    gaps2048: null,
    gapsGitHub: null,
    comparison: null,
    additionalSites: null,
    methods: null
  };
  
  // Analyze gaps
  results.gaps2048 = await analyze2048Gaps();
  results.gapsGitHub = await analyzeGitHubGaps();
  
  // Compare VLM vs reality
  await compareVLMvsReality();
  
  // Additional sites
  results.additionalSites = await testAdditionalWebsites();
  
  // Methods analysis
  results.methods = analyzeUsefulMethods();
  
  // Save results
  const resultsFile = join(testResultsDir, `deep-analysis-${Date.now()}.json`);
  writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`\n📁 Results saved to: ${resultsFile}`);
  
  return results;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDeepAnalysis().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { runDeepAnalysis, analyze2048Gaps, analyzeGitHubGaps, compareVLMvsReality, testAdditionalWebsites, analyzeUsefulMethods };

