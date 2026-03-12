import { test } from 'node:test';
import assert from 'node:assert';
import { validateSpec, generatePropertyTests } from '../../src/natural-language-specs.mjs';

// --- validateSpec ---

test('validateSpec returns valid for a well-formed Given/When/Then spec', () => {
  const spec = [
    'Given a news page with visible headlines',
    'When I take a screenshot',
    'Then the headlines should be readable'
  ].join('\n');

  const result = validateSpec(spec);

  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.errors.length, 0);
});

test('validateSpec result shape has expected fields', () => {
  const result = validateSpec('Given a page\nWhen loaded\nThen screenshot looks good');

  assert.ok('valid' in result);
  assert.ok('errors' in result);
  assert.ok('warnings' in result);
  assert.ok('suggestions' in result);
  assert.ok(Array.isArray(result.errors));
  assert.ok(Array.isArray(result.warnings));
  assert.ok(Array.isArray(result.suggestions));
});

test('validateSpec returns invalid for empty string', () => {
  const result = validateSpec('');

  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.length > 0);
  assert.ok(result.errors[0].includes('non-empty string'));
});

test('validateSpec returns invalid for null input', () => {
  const result = validateSpec(null);

  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.length > 0);
});

test('validateSpec returns invalid for non-string input (number)', () => {
  const result = validateSpec(42);

  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('string')));
});

test('validateSpec returns invalid for undefined', () => {
  const result = validateSpec(undefined);

  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.length > 0);
});

test('validateSpec warns when spec lacks Given/When/Then structure', () => {
  const spec = 'The page should load properly and show content';
  const result = validateSpec(spec);

  assert.strictEqual(result.valid, true);
  assert.ok(result.warnings.some(w => w.includes('Given/When/Then')));
  assert.ok(result.suggestions.length > 0);
});

test('validateSpec warns when no URL is detected', () => {
  const spec = 'Given a screenshot\nWhen validated\nThen it should look correct';
  const result = validateSpec(spec);

  assert.ok(result.warnings.some(w => w.toLowerCase().includes('url')));
});

test('validateSpec does not warn about URL when spec contains a URL', () => {
  const spec = 'Given I visit http://example.com\nWhen the page loads\nThen the screenshot should match';
  const result = validateSpec(spec);

  assert.ok(!result.warnings.some(w => w.toLowerCase().includes('no url')));
});

test('validateSpec does not warn about URL when spec uses navigate-to phrasing', () => {
  const spec = 'Given I navigate to mysite.com\nWhen loaded\nThen the game should render';
  const result = validateSpec(spec);

  assert.ok(!result.warnings.some(w => w.toLowerCase().includes('no url')));
});

test('validateSpec suggests Then instead of I should', () => {
  const spec = 'I should see a login form on the page';
  const result = validateSpec(spec);

  assert.ok(result.suggestions.some(s => s.includes("'Then'")));
});

test('validateSpec warns when no validation keywords detected', () => {
  const spec = 'Given a page\nWhen I click\nThen something happens';
  const result = validateSpec(spec);

  assert.ok(result.warnings.some(w => w.includes('validation keywords')));
});

test('validateSpec does not warn about keywords when spec mentions game', () => {
  const spec = 'Given a game page\nWhen the game loads\nThen the game should be playable';
  const result = validateSpec(spec);

  assert.ok(!result.warnings.some(w => w.includes('validation keywords')));
});

// --- generatePropertyTests ---

test('generatePropertyTests returns structure with properties array and run method', async () => {
  const result = await generatePropertyTests(['score should always be between 0 and 10']);

  assert.ok(Array.isArray(result.properties));
  assert.strictEqual(result.properties.length, 1);
  assert.strictEqual(typeof result.run, 'function');
  assert.strictEqual(result.generator, 'fast-check');
  assert.strictEqual(result.numRuns, 100);
});

test('generatePropertyTests classifies invariant property type', async () => {
  const result = await generatePropertyTests(['score should always be valid']);

  assert.strictEqual(result.properties[0].type, 'invariant');
});

test('generatePropertyTests classifies postcondition property type', async () => {
  const result = await generatePropertyTests(['issues should be an array']);

  assert.strictEqual(result.properties[0].type, 'postcondition');
});

test('generatePropertyTests run returns pending results', async () => {
  const result = await generatePropertyTests(['score should always be between 0 and 10']);
  const runResults = await result.run();

  assert.strictEqual(runResults.length, 1);
  assert.strictEqual(runResults[0].status, 'pending');
  assert.strictEqual(runResults[0].property, 'score should always be between 0 and 10');
});

test('generatePropertyTests generates working check for score between 0 and 10', async () => {
  const result = await generatePropertyTests(['score should always be between 0 and 10']);
  const check = result.properties[0].check;

  assert.strictEqual(check({ score: 5 }), true);
  assert.strictEqual(check({ score: 0 }), true);
  assert.strictEqual(check({ score: 10 }), true);
  assert.strictEqual(check({ score: -1 }), false);
  assert.strictEqual(check({ score: 11 }), false);
});

test('generatePropertyTests respects custom options', async () => {
  const result = await generatePropertyTests(['x must be non-negative'], {
    generator: 'hypothesis',
    numRuns: 50
  });

  assert.strictEqual(result.generator, 'hypothesis');
  assert.strictEqual(result.numRuns, 50);
});
