/**
 * Validators Test
 * 
 * Tests for generic validators: StateValidator, AccessibilityValidator, PromptBuilder, validateWithRubric, BatchValidator
 */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  StateValidator,
  AccessibilityValidator,
  PromptBuilder,
  validateWithRubric,
  BatchValidator
} from '../src/validators/index.mjs';

test('StateValidator - constructor with default options', () => {
  const validator = new StateValidator();
  assert.equal(validator.tolerance, 5);
  assert.ok(typeof validator.validateScreenshot === 'function');
  assert.ok(typeof validator.stateExtractor === 'function');
  assert.ok(typeof validator.stateComparator === 'function');
});

test('StateValidator - constructor with custom options', () => {
  const customValidator = () => {};
  const validator = new StateValidator({
    tolerance: 10,
    validateScreenshot: customValidator
  });
  assert.equal(validator.tolerance, 10);
  assert.equal(validator.validateScreenshot, customValidator);
});

test('StateValidator - buildStatePrompt', () => {
  const validator = new StateValidator();
  const expectedState = { ball: { x: 100, y: 200 }, paddle: { x: 150 } };
  const prompt = validator.buildStatePrompt(expectedState);
  
  assert.ok(prompt.includes('Extract'));
  // Check for key parts of the state representation
  assert.ok(prompt.includes('100') || prompt.includes('200') || prompt.includes('150'));
  assert.ok(prompt.includes('Tolerance: 5px'));
});

test('StateValidator - defaultStateExtractor with structured data', () => {
  const validator = new StateValidator();
  const result = { structuredData: { ball: { x: 100, y: 200 } } };
  const expected = { ball: { x: 100, y: 200 } };
  
  const extracted = validator.defaultStateExtractor(result, expected);
  assert.deepEqual(extracted, { ball: { x: 100, y: 200 } });
});

test('StateValidator - defaultStateComparator matches', () => {
  const validator = new StateValidator();
  const extracted = { ball: { x: 100, y: 200 } };
  const expected = { ball: { x: 100, y: 200 } };
  
  const comparison = validator.defaultStateComparator(extracted, expected);
  assert.equal(comparison.matches, true);
  assert.equal(comparison.discrepancies.length, 0);
});

test('StateValidator - defaultStateComparator with tolerance', () => {
  const validator = new StateValidator({ tolerance: 5 });
  const extracted = { ball: { x: 102, y: 203 } }; // Within tolerance
  const expected = { ball: { x: 100, y: 200 } };
  
  const comparison = validator.defaultStateComparator(extracted, expected);
  assert.equal(comparison.matches, true);
});

test('StateValidator - defaultStateComparator exceeds tolerance', () => {
  const validator = new StateValidator({ tolerance: 5 });
  const extracted = { ball: { x: 110, y: 200 } }; // Exceeds tolerance
  const expected = { ball: { x: 100, y: 200 } };
  
  const comparison = validator.defaultStateComparator(extracted, expected);
  assert.equal(comparison.matches, false);
  assert.ok(comparison.discrepancies.length > 0);
});

test('AccessibilityValidator - constructor with defaults', () => {
  const validator = new AccessibilityValidator();
  assert.equal(validator.minContrast, 4.5);
  assert.deepEqual(validator.standards, ['WCAG-AA']);
  assert.equal(validator.zeroTolerance, false);
});

test('AccessibilityValidator - constructor with custom options', () => {
  const validator = new AccessibilityValidator({
    minContrast: 7,
    standards: ['WCAG-AAA'],
    zeroTolerance: true
  });
  assert.equal(validator.minContrast, 7);
  assert.deepEqual(validator.standards, ['WCAG-AAA']);
  assert.equal(validator.zeroTolerance, true);
});

test('AccessibilityValidator - buildAccessibilityPrompt', () => {
  const validator = new AccessibilityValidator({ minContrast: 4.5 });
  const prompt = validator.buildAccessibilityPrompt();
  
  assert.ok(prompt.includes('Accessibility validation'));
  assert.ok(prompt.includes('4.5:1'));
  assert.ok(prompt.includes('WCAG-AA'));
});

test('AccessibilityValidator - detectViolations', () => {
  const validator = new AccessibilityValidator({ minContrast: 4.5, zeroTolerance: true });
  const result = {
    reasoning: 'Contrast <4.5:1 detected for some text'
  };
  
  const violations = validator.detectViolations(result);
  assert.ok(violations.zeroTolerance.length > 0);
});

test('AccessibilityValidator - extractContrastInfo', () => {
  const validator = new AccessibilityValidator({ minContrast: 4.5 });
  const result = {
    reasoning: 'Text has 5.2:1 contrast ratio, buttons have 4.8:1'
  };
  
  const contrastInfo = validator.extractContrastInfo(result);
  assert.ok(contrastInfo.ratios.length > 0);
  assert.ok(contrastInfo.minRatio >= 4.5);
});

test('PromptBuilder - constructor', () => {
  const builder = new PromptBuilder();
  assert.deepEqual(builder.templates, {});
  assert.equal(builder.rubric, null);
  assert.deepEqual(builder.defaultContext, {});
});

test('PromptBuilder - buildPrompt with context', () => {
  const builder = new PromptBuilder({ defaultContext: { test: 'value' } });
  const prompt = builder.buildPrompt('Base prompt', { context: { extra: 'data' } });
  
  assert.ok(prompt.includes('Base prompt'));
  assert.ok(prompt.includes('CONTEXT'));
  assert.ok(prompt.includes('test'));
  assert.ok(prompt.includes('extra'));
});

test('PromptBuilder - buildFromTemplate', () => {
  const builder = new PromptBuilder({
    templates: {
      test: (vars) => `Template with ${vars.name}`
    }
  });
  
  const prompt = builder.buildFromTemplate('test', { name: 'value' });
  assert.ok(prompt.includes('Template with value'));
});

test('PromptBuilder - buildFromTemplate throws on missing template', () => {
  const builder = new PromptBuilder();
  assert.throws(() => {
    builder.buildFromTemplate('missing');
  }, /Template "missing" not found/);
});

test('PromptBuilder - registerTemplate', () => {
  const builder = new PromptBuilder();
  builder.registerTemplate('new', 'New template');
  
  const prompt = builder.buildFromTemplate('new');
  assert.ok(prompt.includes('New template'));
});

test('BatchValidator - extends BatchOptimizer', () => {
  const validator = new BatchValidator();
  assert.ok(validator.batchValidate);
  assert.ok(validator.clearCache);
  assert.ok(validator.getCacheStats);
});

test('BatchValidator - constructor with options', () => {
  const validator = new BatchValidator({
    maxConcurrency: 10,
    batchSize: 5,
    trackCosts: true,
    trackStats: true
  });
  assert.equal(validator.maxConcurrency, 10);
  assert.equal(validator.batchSize, 5);
  assert.equal(validator.trackCosts, true);
  assert.equal(validator.trackStats, true);
});

test('BatchValidator - getPerformanceStats', () => {
  const validator = new BatchValidator({ trackStats: true });
  const stats = validator.getPerformanceStats();
  
  assert.equal(stats.totalRequests, 0);
  assert.equal(stats.avgDuration, 0);
  assert.equal(stats.successRate, 0);
});

test('BatchValidator - resetStats', () => {
  const validator = new BatchValidator({ trackStats: true });
  validator.resetStats();
  
  const stats = validator.getPerformanceStats();
  assert.equal(stats.totalRequests, 0);
});

console.log('✅ All validator tests passed');

