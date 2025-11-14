/**
 * Spec Templates Tests
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  createSpecFromTemplate,
  composeTemplates,
  inheritTemplate,
  registerTemplate,
  listTemplates,
  getTemplate,
  validateTemplate,
  TEMPLATES
} from '../src/spec-templates.mjs';

describe('Spec Templates', () => {
  
  test('createSpecFromTemplate - basic game template', () => {
    const spec = createSpecFromTemplate('game', {
      url: 'queeraoke.fyi',
      activationKey: 'g',
      selector: ', selector: #game-paddle'
    });
    
    assert.ok(spec.includes('queeraoke.fyi'));
    assert.ok(spec.includes("press 'g'"));
    assert.ok(spec.includes('#game-paddle'));
    assert.ok(spec.includes('Given I visit'));
    assert.ok(spec.includes('When I activate'));
    assert.ok(spec.includes('Then the game should be playable'));
  });
  
  test('createSpecFromTemplate - accessibility template', () => {
    const spec = createSpecFromTemplate('accessibility', {
      url: 'example.com'
    });
    
    assert.ok(spec.includes('example.com'));
    assert.ok(spec.includes('should be accessible'));
    assert.ok(spec.includes('WCAG standards'));
  });
  
  test('createSpecFromTemplate - with temporal', () => {
    const spec = createSpecFromTemplate('game', {
      url: 'game.example.com',
      activationKey: 'g',
      selector: ', selector: #game-element',
      temporal: ', fps: 2, duration: 10 seconds, temporal: true'
    });
    
    assert.ok(spec.includes('fps: 2'));
    assert.ok(spec.includes('duration: 10 seconds'));
    assert.ok(spec.includes('temporal: true'));
  });
  
  test('createSpecFromTemplate - throws on invalid template', () => {
    assert.throws(() => {
      createSpecFromTemplate('nonexistent');
    }, /Template "nonexistent" not found/);
  });
  
  test('listTemplates - returns all templates', () => {
    const templates = listTemplates();
    
    assert.ok(templates.length > 0);
    assert.ok(templates.some(t => t.name === 'Game Testing'));
    assert.ok(templates.some(t => t.name === 'Accessibility Testing'));
  });
  
  test('getTemplate - returns template by name', () => {
    const template = getTemplate('game');
    
    assert.ok(template);
    assert.strictEqual(template.name, 'Game Testing');
    assert.ok(template.spec);
    assert.ok(template.variables);
  });
  
  test('getTemplate - throws on invalid template', () => {
    assert.throws(() => {
      getTemplate('nonexistent');
    }, /Template "nonexistent" not found/);
  });
  
  test('registerTemplate - registers custom template', () => {
    const customTemplate = {
      name: 'Custom Test',
      description: 'A custom template',
      spec: 'Given {action}\nThen {result}',
      variables: {
        action: 'I do something',
        result: 'something happens'
      }
    };
    
    registerTemplate('custom', customTemplate);
    
    const retrieved = getTemplate('custom');
    assert.strictEqual(retrieved.name, 'Custom Test');
  });
  
  test('validateTemplate - validates correct template', () => {
    const template = {
      name: 'Test Template',
      spec: 'Given {action}\nThen {result}',
      variables: {
        action: 'I do something',
        result: 'something happens'
      }
    };
    
    const validation = validateTemplate(template);
    
    assert.strictEqual(validation.valid, true);
    assert.strictEqual(validation.errors.length, 0);
  });
  
  test('validateTemplate - detects missing name', () => {
    const template = {
      spec: 'Given {action}',
      variables: { action: 'test' }
    };
    
    const validation = validateTemplate(template);
    
    assert.strictEqual(validation.valid, false);
    assert.ok(validation.errors.some(e => e.includes('name')));
  });
  
  test('validateTemplate - detects missing placeholder variable', () => {
    const template = {
      name: 'Test',
      spec: 'Given {action}\nThen {result}',
      variables: {
        action: 'test'
        // Missing 'result' variable
      }
    };
    
    const validation = validateTemplate(template);
    
    assert.strictEqual(validation.valid, false);
    assert.ok(validation.errors.some(e => e.includes('result')));
  });
  
  test('inheritTemplate - inherits from base template', () => {
    const inherited = inheritTemplate('game', {
      name: 'Custom Game',
      variables: {
        url: 'custom-game.com'
      }
    });
    
    assert.strictEqual(inherited.name, 'Custom Game');
    assert.strictEqual(inherited.variables.url, 'custom-game.com');
    // Should inherit other variables from base
    assert.strictEqual(inherited.variables.activationKey, 'g');
  });
  
  test('composeTemplates - sequential composition', () => {
    const template1 = { spec: 'Given step 1' };
    const template2 = { spec: 'Then step 2' };
    
    const composed = composeTemplates([template1, template2], 'sequential');
    
    assert.ok(composed.includes('Given step 1'));
    assert.ok(composed.includes('Then step 2'));
  });
  
  test('composeTemplates - throws on invalid composition type', () => {
    assert.throws(() => {
      composeTemplates([], 'invalid');
    }, /Unknown composition type: invalid/);
  });
  
  test('all built-in templates are valid', () => {
    for (const [name, template] of Object.entries(TEMPLATES)) {
      const validation = validateTemplate(template);
      assert.strictEqual(validation.valid, true);
    }
  });
});

