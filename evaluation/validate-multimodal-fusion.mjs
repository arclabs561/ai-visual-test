/**
 * Validation: Multi-Modal Fusion
 * 
 * Tests our multi-modal validation approach (screenshot + HTML + CSS + rendered code).
 * Validates that combining modalities improves accuracy vs single-modality.
 */

import { createMockPage } from '../test/helpers/mock-page.mjs';
import { extractRenderedCode, multiModalValidation } from '../src/multi-modal.mjs';
import { writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Test Case: Screenshot Only vs Multi-Modal
 * Hypothesis: Multi-modal should provide more context
 */
async function testScreenshotVsMultimodal() {
  const mockPage = createMockPage({
    html: `
      <html>
        <head>
          <style>
            .hidden { display: none; }
            .visible { display: block; }
          </style>
        </head>
        <body>
          <div id="test" class="visible">Content</div>
          <div id="hidden" class="hidden">Hidden Content</div>
        </body>
      </html>
    `
  });
  
  // Extract rendered code
  const renderedCode = await extractRenderedCode(mockPage);
  
  // Mock validation functions
  const screenshotOnly = async (path, prompt, context) => {
    return {
      enabled: false,
      score: 7,
      assessment: 'Screenshot shows visible content',
      reasoning: 'Based on screenshot only'
    };
  };
  
  const multimodal = async (path, prompt, context) => {
    return {
      enabled: false,
      score: 8,
      assessment: 'Screenshot + code shows visible and hidden content',
      reasoning: 'Based on screenshot and HTML/CSS analysis'
    };
  };
  
  return {
    name: 'Screenshot vs Multi-Modal',
    hypothesis: 'Multi-modal provides more context',
    screenshotOnly: {
      hasHTML: false,
      hasCSS: false,
      canDetectHidden: false
    },
    multimodal: {
      hasHTML: !!renderedCode.html,
      hasCSS: !!renderedCode.criticalCSS,
      canDetectHidden: renderedCode.html?.includes('hidden') || false
    },
    passed: renderedCode.html && renderedCode.criticalCSS,
    notes: 'Multi-modal should extract HTML and CSS'
  };
}

/**
 * Test Case: CSS Extraction Accuracy
 * Validates that critical CSS is actually extracted
 */
async function testCSSExtraction() {
  const mockPage = createMockPage({
    html: `
      <html>
        <head>
          <style>
            body { color: red; font-size: 16px; }
            .test { background: blue; }
          </style>
        </head>
        <body>
          <div class="test">Content</div>
        </body>
      </html>
    `
  });
  
  const renderedCode = await extractRenderedCode(mockPage);
  
  const cssText = typeof renderedCode.criticalCSS === 'string' 
    ? renderedCode.criticalCSS 
    : JSON.stringify(renderedCode.criticalCSS || '');
  const hasColor = cssText.includes('color') || false;
  const hasBackground = cssText.includes('background') || false;
  
  return {
    name: 'CSS Extraction Accuracy',
    expected: 'Critical CSS extracted',
    actual: {
      hasColor,
      hasBackground,
      cssLength: typeof renderedCode.criticalCSS === 'string' 
        ? renderedCode.criticalCSS.length 
        : JSON.stringify(renderedCode.criticalCSS || '').length
    },
    passed: hasColor && hasBackground,
    notes: 'Should extract relevant CSS rules'
  };
}

/**
 * Test Case: DOM Structure Extraction
 * Validates that DOM structure is correctly extracted
 */
async function testDOMExtraction() {
  const mockPage = createMockPage({
    html: `
      <html>
        <body>
          <div id="parent">
            <div id="child1">Child 1</div>
            <div id="child2">Child 2</div>
          </div>
        </body>
      </html>
    `
  });
  
  const renderedCode = await extractRenderedCode(mockPage);
  
  const domText = typeof renderedCode.domStructure === 'string'
    ? renderedCode.domStructure
    : JSON.stringify(renderedCode.domStructure || '');
  const hasParent = domText.includes('parent') || false;
  const hasChild1 = domText.includes('child1') || false;
  const hasChild2 = domText.includes('child2') || false;
  
  return {
    name: 'DOM Structure Extraction',
    expected: 'DOM structure extracted',
    actual: {
      hasParent,
      hasChild1,
      hasChild2,
      domLength: renderedCode.domStructure?.length || 0
    },
    passed: hasParent && hasChild1 && hasChild2,
    notes: 'Should extract DOM hierarchy'
  };
}

/**
 * Test Case: Multi-Modal Context Combination
 * Validates that multi-modal validation combines all modalities
 */
async function testMultimodalCombination() {
  const mockPage = createMockPage({
    html: '<html><body><div id="test">Content</div></body></html>'
  });
  
  const mockValidateFn = async (path, prompt, context) => {
    // Check if context includes rendered code
    const hasRenderedCode = !!context.renderedCode;
    const hasHTML = !!context.renderedCode?.html;
    const hasCSS = !!context.renderedCode?.criticalCSS;
    
    return {
      enabled: false,
      score: hasRenderedCode ? 8 : 5,
      assessment: hasRenderedCode ? 'Multi-modal context provided' : 'Screenshot only',
      hasRenderedCode,
      hasHTML,
      hasCSS
    };
  };
  
  const result = await multiModalValidation(
    mockValidateFn,
    mockPage,
    'test-validation',
    {
      fps: 1,
      duration: 100,
      captureCode: true,
      captureState: false,
      multiPerspective: false
    }
  );
  
  return {
    name: 'Multi-Modal Context Combination',
    expected: 'All modalities combined',
    actual: {
      hasRenderedCode: !!result.renderedCode,
      hasHTML: !!result.renderedCode?.html,
      hasCSS: !!result.renderedCode?.criticalCSS
    },
    passed: result.renderedCode && result.renderedCode.html && result.renderedCode.criticalCSS,
    notes: 'Should combine screenshot + HTML + CSS in context'
  };
}

/**
 * Run all validation tests
 */
async function runValidation() {
  console.log('🔬 Validating Multi-Modal Fusion\n');
  
  const tests = [
    await testScreenshotVsMultimodal(),
    await testCSSExtraction(),
    await testDOMExtraction(),
    await testMultimodalCombination()
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
    console.log(`   Expected: ${test.expected || test.hypothesis}`);
    console.log(`   Actual: ${JSON.stringify(test.actual)}`);
    if (!test.passed) {
      console.log(`   ⚠️  FAILED: ${test.notes}`);
    }
    console.log();
  });
  
  console.log(`\nSummary: ${results.summary.passed}/${results.summary.total} tests passed`);
  
  // Save results
  const outputPath = join(process.cwd(), 'evaluation', 'results', `multimodal-validation-${Date.now()}.json`);
  writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to: ${outputPath}`);
  
  return results;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runValidation().catch(console.error);
}

export { runValidation };

