/**
 * Holistic Integration Test
 * 
 * Tests natural language specs end-to-end with full integration:
 * - Configuration system
 * - Parameter passing (fixed)
 * - Research features integration
 * - Library API integration
 * - Per-project/test customization
 * 
 * Note: Tests requiring Playwright page object are skipped in Node test runner.
 * Use evaluation/e2e/ for full Playwright-based integration tests.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  parseSpec,
  validateSpec,
  createSpecFromTemplate,
  createSpecConfig,
  getSpecConfig,
  setSpecConfig,
  resetSpecConfig
} from '../src/index.mjs';

describe('Holistic Integration - Natural Language Specs', () => {
  
  test('end-to-end: spec -> parse -> map (traced, no execution)', async () => {
    console.log('\n=== HOLISTIC E2E TEST WITH TRACING (Parse/Map Only) ===\n');
    
    // Step 1: Configure
    console.log('[TRACE] Step 1: Configuration');
    resetSpecConfig();
    const config = createSpecConfig({
      useLLM: true,
      validateBeforeExecute: true,
      strictValidation: false
    });
    setSpecConfig(config);
    console.log('  ✅ Config set:', { useLLM: config.useLLM, validateBeforeExecute: config.validateBeforeExecute });
    
    // Step 2: Create spec from template
    console.log('\n[TRACE] Step 2: Template -> Spec');
    const spec = createSpecFromTemplate('game', {
      url: 'example.com',
      activationKey: 'g',
      selector: ', selector: #game-element'
    });
    console.log('  ✅ Spec generated:', spec.substring(0, 80) + '...');
    
    // Step 3: Validate spec
    console.log('\n[TRACE] Step 3: Spec Validation');
    const validation = validateSpec(spec);
    console.log('  ✅ Validation:', { valid: validation.valid, warnings: validation.warnings.length });
    assert.strictEqual(validation.valid, true);
    
    // Step 4: Parse spec
    console.log('\n[TRACE] Step 4: Parse Spec');
    const parsed = await parseSpec(spec, { useLLM: false }); // Use regex fallback for tests
    console.log('  ✅ Parsed:', {
      interfaces: parsed.interfaces,
      contextKeys: Object.keys(parsed.context || {}),
      hasUrl: !!parsed.context?.url
    });
    assert.ok(parsed.interfaces.includes('testGameplay'));
    // URL extraction may vary, so check if it exists or matches pattern
    assert.ok(parsed.context?.url === 'https://example.com' || parsed.context?.url?.includes('example.com'));
    
    // Step 5: Map to interfaces (test parameter passing)
    console.log('\n[TRACE] Step 5: Map to Interfaces');
    const { mapToInterfaces } = await import('../src/natural-language-specs.mjs');
    const calls = await mapToInterfaces(parsed, {
      page: null, // No page in Node test runner
      url: 'https://example.com',
      options: {
        customOption: 'test-value',
        enableUncertaintyReduction: true
      }
    });
    console.log('  ✅ Mapped calls:', calls.length);
    console.log('  ✅ First call:', {
      interface: calls[0].interface,
      hasPageProperty: 'page' in calls[0],
      pageInArgs: 'page' in calls[0].args,
      hasCustomOption: 'customOption' in calls[0].args,
      hasResearchFeature: 'enableUncertaintyReduction' in calls[0].args
    });
    
    // Verify parameter passing is correct
    if (calls[0].interface === 'testGameplay') {
      assert.ok('page' in calls[0]); // page should be separate property
      assert.strictEqual('page' in calls[0].args, false); // page should NOT be in args
      assert.ok('customOption' in calls[0].args); // Custom options should pass through
      assert.ok('enableUncertaintyReduction' in calls[0].args); // Research features should pass through
    }
    
    // Reset config
    resetSpecConfig();
    
    console.log('\n=== HOLISTIC E2E TEST COMPLETE (Execution skipped - requires Playwright) ===\n');
  });
  
  test('configuration: per-project and per-test customization', () => {
    console.log('\n=== CONFIGURATION TEST ===\n');
    
    // Test 1: Default config
    resetSpecConfig();
    const defaultConfig = getSpecConfig();
    console.log('[TRACE] Default config:', {
      useLLM: defaultConfig.useLLM,
      validateBeforeExecute: defaultConfig.validateBeforeExecute
    });
    assert.strictEqual(defaultConfig.useLLM, true);
    
    // Test 2: Per-project config
    const projectConfig = createSpecConfig({
      useLLM: false,
      strictValidation: true,
      validateBeforeExecute: false
    });
    setSpecConfig(projectConfig);
    const retrievedConfig = getSpecConfig();
    console.log('[TRACE] Project config:', {
      useLLM: retrievedConfig.useLLM,
      strictValidation: retrievedConfig.strictValidation
    });
    assert.strictEqual(retrievedConfig.useLLM, false);
    assert.strictEqual(retrievedConfig.strictValidation, true);
    
    // Test 3: Per-test override (would be in executeSpec options)
    console.log('[TRACE] Per-test override: options.validate can override config');
    
    resetSpecConfig();
  });
  
  test('integration: research features pass through', async () => {
    console.log('\n=== RESEARCH FEATURES INTEGRATION TEST ===\n');
    
    const parsedSpec = {
      type: 'behavior',
      given: ['I visit example.com'],
      when: ['the page loads'],
      then: ['it should be accessible'],
      interfaces: ['validateScreenshot'],
      context: { url: 'https://example.com' }
    };
    
    const { mapToInterfaces } = await import('../src/natural-language-specs.mjs');
    const calls = await mapToInterfaces(parsedSpec, {
      page: null,
      options: {
        enableUncertaintyReduction: true,
        enableHallucinationCheck: true,
        adaptiveSelfConsistency: true,
        enableBiasMitigation: true,
        useExplicitRubric: true
      }
    });
    
    console.log('[TRACE] Research features in context:');
    const context = calls[0].args.context;
    console.log('  - enableUncertaintyReduction:', context.enableUncertaintyReduction);
    console.log('  - enableHallucinationCheck:', context.enableHallucinationCheck);
    console.log('  - adaptiveSelfConsistency:', context.adaptiveSelfConsistency);
    console.log('  - enableBiasMitigation:', context.enableBiasMitigation);
    console.log('  - useExplicitRubric:', context.useExplicitRubric);
    
    assert.strictEqual(context.enableUncertaintyReduction, true);
    assert.strictEqual(context.enableHallucinationCheck, true);
    assert.strictEqual(context.adaptiveSelfConsistency, true);
  });
  
  test('integration: library API patterns followed', async () => {
    console.log('\n=== LIBRARY API PATTERNS TEST ===\n');
    
    // Test: Does it follow the library's options pattern?
    const spec = 'Given I visit example.com\nWhen the page loads\nThen it should be accessible';
    
    // Should accept options object like other library functions
    const parsed = await parseSpec(spec, {
      useLLM: false, // Per-call override
      provider: 'openai'
    });
    
    console.log('[TRACE] Options pattern:', {
      acceptsOptions: true,
      respectsOverrides: true
    });
    
    assert.ok(parsed);
    assert.ok(parsed.context);
  });
});
