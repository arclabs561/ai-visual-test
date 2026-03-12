import { test } from 'node:test';
import assert from 'node:assert';
import {
  calculateModalityWeights,
  buildStructuredFusionPrompt,
  compareFusionStrategies
} from '../../src/multi-modal-fusion.mjs';

// --- calculateModalityWeights ---

test('calculateModalityWeights base weights sum to ~1.0', () => {
  const weights = calculateModalityWeights({ screenshot: 'img.png' }, 'check this page');
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1.0) < 0.01, `expected sum ~1.0, got ${sum}`);
});

test('calculateModalityWeights visual prompt increases screenshot weight', () => {
  const base = calculateModalityWeights({ screenshot: 'img.png' }, 'check this page');
  const visual = calculateModalityWeights({ screenshot: 'img.png' }, 'check the visual design');
  assert.ok(visual.screenshot > base.screenshot,
    `visual screenshot ${visual.screenshot} should exceed base ${base.screenshot}`);
});

test('calculateModalityWeights structure prompt increases html and dom weight', () => {
  const base = calculateModalityWeights({ screenshot: 'img.png' }, 'check this page');
  const struct = calculateModalityWeights({ screenshot: 'img.png' }, 'verify html structure');
  assert.ok(struct.html > base.html, `structure html ${struct.html} should exceed base ${base.html}`);
  assert.ok(struct.dom > base.dom, `structure dom ${struct.dom} should exceed base ${base.dom}`);
});

test('calculateModalityWeights style prompt increases css weight', () => {
  const base = calculateModalityWeights({ screenshot: 'img.png' }, 'check this page');
  const style = calculateModalityWeights({ screenshot: 'img.png' }, 'check the css styling');
  assert.ok(style.css > base.css, `style css ${style.css} should exceed base ${base.css}`);
});

test('calculateModalityWeights state prompt increases gameState weight', () => {
  const base = calculateModalityWeights({ screenshot: 'img.png' }, 'check this page');
  const state = calculateModalityWeights({ screenshot: 'img.png' }, 'verify game state');
  assert.ok(state.gameState > base.gameState,
    `state gameState ${state.gameState} should exceed base ${base.gameState}`);
});

test('calculateModalityWeights returns all five keys', () => {
  const weights = calculateModalityWeights({}, 'test');
  const keys = Object.keys(weights).sort();
  assert.deepStrictEqual(keys, ['css', 'dom', 'gameState', 'html', 'screenshot']);
});

// --- buildStructuredFusionPrompt ---

test('buildStructuredFusionPrompt includes base prompt', () => {
  const prompt = buildStructuredFusionPrompt('Evaluate the page', { screenshot: 'img.png' });
  assert.ok(prompt.includes('Evaluate the page'));
});

test('buildStructuredFusionPrompt includes screenshot section when provided', () => {
  const prompt = buildStructuredFusionPrompt('test', { screenshot: 'img.png' });
  assert.ok(prompt.includes('[VISUAL'));
  assert.ok(prompt.includes('img.png'));
});

test('buildStructuredFusionPrompt includes HTML section when renderedCode.html present', () => {
  const prompt = buildStructuredFusionPrompt('test', {
    renderedCode: { html: '<div>hello</div>' }
  });
  assert.ok(prompt.includes('[STRUCTURE'));
  assert.ok(prompt.includes('<div>hello</div>'));
});

test('buildStructuredFusionPrompt includes CSS section when renderedCode.criticalCSS present', () => {
  const prompt = buildStructuredFusionPrompt('test', {
    renderedCode: { criticalCSS: 'body { color: red; }' }
  });
  assert.ok(prompt.includes('[STYLING'));
  assert.ok(prompt.includes('body { color: red; }'));
});

test('buildStructuredFusionPrompt includes game state section', () => {
  const prompt = buildStructuredFusionPrompt('test', {
    gameState: { score: 42, level: 3 }
  });
  assert.ok(prompt.includes('[STATE'));
  assert.ok(prompt.includes('"score": 42'));
});

test('buildStructuredFusionPrompt omits sections for missing modalities', () => {
  const prompt = buildStructuredFusionPrompt('test', {});
  assert.ok(!prompt.includes('[VISUAL'));
  assert.ok(!prompt.includes('[STRUCTURE'));
  assert.ok(!prompt.includes('[STYLING'));
  assert.ok(!prompt.includes('[STATE'));
});

// --- compareFusionStrategies ---

test('compareFusionStrategies returns simple and structured with lengths', () => {
  const result = compareFusionStrategies('test', { screenshot: 'img.png' });
  assert.ok(typeof result.simple.length === 'number');
  assert.ok(typeof result.structured.length === 'number');
  assert.ok(result.simple.length > 0);
  assert.ok(result.structured.length > 0);
});

test('compareFusionStrategies structured has weights, simple does not', () => {
  const result = compareFusionStrategies('test', { screenshot: 'img.png' });
  assert.strictEqual(result.simple.hasWeights, false);
  assert.strictEqual(result.structured.hasWeights, true);
  assert.ok(result.structured.weights);
  assert.ok(typeof result.structured.weights.screenshot === 'number');
});

test('compareFusionStrategies includes recommendation string', () => {
  const result = compareFusionStrategies('test', { screenshot: 'img.png' });
  assert.ok(typeof result.recommendation === 'string');
  assert.ok(result.recommendation.length > 0);
});
