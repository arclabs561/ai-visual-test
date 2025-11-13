/**
 * Tests for enhanced template features (conditionals, loops, partials)
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { PromptBuilder } from '../src/validators/prompt-builder.mjs';

test('PromptBuilder - conditionals (#if)', () => {
  const builder = new PromptBuilder({
    templates: {
      test: 'Hello {{#if name}}{{name}}{{else}}Guest{{/if}}!'
    }
  });
  
  const result1 = builder.buildFromTemplate('test', { name: 'Alice' });
  assert.ok(result1.includes('Alice'));
  assert.ok(!result1.includes('Guest'));
  
  const result2 = builder.buildFromTemplate('test', {});
  assert.ok(result2.includes('Guest'));
  assert.ok(!result2.includes('Alice'));
});

test('PromptBuilder - conditionals (#unless)', () => {
  const builder = new PromptBuilder({
    templates: {
      test: '{{#unless disabled}}Feature enabled{{/unless}}'
    }
  });
  
  const result1 = builder.buildFromTemplate('test', { disabled: false });
  assert.ok(result1.includes('Feature enabled'));
  
  const result2 = builder.buildFromTemplate('test', { disabled: true });
  assert.ok(!result2.includes('Feature enabled'));
});

test('PromptBuilder - loops (#each)', () => {
  const builder = new PromptBuilder({
    templates: {
      test: 'Items: {{#each items}}{{@index}}: {{@value}}\n{{/each}}'
    }
  });
  
  const result = builder.buildFromTemplate('test', { items: ['apple', 'banana', 'cherry'] });
  assert.ok(result.includes('0: apple'));
  assert.ok(result.includes('1: banana'));
  assert.ok(result.includes('2: cherry'));
});

test('PromptBuilder - loops with objects', () => {
  const builder = new PromptBuilder({
    templates: {
      test: '{{#each items}}{{name}}: {{value}}\n{{/each}}'
    }
  });
  
  const result = builder.buildFromTemplate('test', {
    items: [
      { name: 'item1', value: 'value1' },
      { name: 'item2', value: 'value2' }
    ]
  });
  assert.ok(result.includes('item1: value1'));
  assert.ok(result.includes('item2: value2'));
});

test('PromptBuilder - nested templates (partials)', () => {
  const builder = new PromptBuilder({
    templates: {
      header: 'Header: {{title}}',
      footer: 'Footer: {{year}}',
      page: '{{>header}}\nContent\n{{>footer}}'
    }
  });
  
  const result = builder.buildFromTemplate('page', { title: 'My Page', year: 2024 });
  assert.ok(result.includes('Header: My Page'));
  assert.ok(result.includes('Footer: 2024'));
  assert.ok(result.includes('Content'));
});

test('PromptBuilder - dot notation', () => {
  const builder = new PromptBuilder({
    templates: {
      test: 'User: {{user.name}}, Age: {{user.age}}'
    }
  });
  
  const result = builder.buildFromTemplate('test', {
    user: { name: 'Alice', age: 30 }
  });
  assert.ok(result.includes('User: Alice'));
  assert.ok(result.includes('Age: 30'));
});

test('PromptBuilder - loop helpers (@first, @last, @index)', () => {
  const builder = new PromptBuilder({
    templates: {
      test: '{{#each items}}{{#if @first}}First: {{@value}}{{/if}}{{#if @last}}Last: {{@value}}{{/if}}{{/each}}'
    }
  });
  
  const result = builder.buildFromTemplate('test', { items: ['a', 'b', 'c'] });
  assert.ok(result.includes('First: a'));
  assert.ok(result.includes('Last: c'));
});

