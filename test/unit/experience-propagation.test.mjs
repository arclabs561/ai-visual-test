/**
 * Tests for experience-propagation.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert';
import {
  ExperiencePropagationTracker,
  getPropagationTracker,
  trackPropagation
} from '../../src/experience-propagation.js';

test('constructor creates tracker with default options', () => {
  const tracker = new ExperiencePropagationTracker();
  assert.strictEqual(tracker.enabled, true);
  assert.strictEqual(tracker.logLevel, 'info');
  assert.deepStrictEqual(tracker.propagationPath, []);
});

test('constructor respects custom options', () => {
  const tracker = new ExperiencePropagationTracker({ enabled: false, logLevel: 'debug' });
  assert.strictEqual(tracker.enabled, false);
  assert.strictEqual(tracker.logLevel, 'debug');
});

test('track() with full context returns correct entry', () => {
  const tracker = new ExperiencePropagationTracker({ logLevel: 'warn' });
  const context = {
    renderedCode: {
      html: '<div>hello</div>',
      criticalCSS: 'div { color: red; }',
      domStructure: { tag: 'div' }
    },
    screenshot: '/path/to/screenshot.png',
    gameState: { score: 100 }
  };

  const entry = tracker.track('capture', context);

  assert.strictEqual(entry.stage, 'capture');
  assert.strictEqual(entry.hasRenderedCode, true);
  assert.strictEqual(entry.hasHTML, true);
  assert.strictEqual(entry.hasCSS, true);
  assert.strictEqual(entry.hasDOM, true);
  assert.strictEqual(entry.htmlLength, '<div>hello</div>'.length);
  assert.strictEqual(entry.hasScreenshot, true);
  assert.strictEqual(entry.hasState, true);
  assert.strictEqual(entry.description, '');
  assert.strictEqual(typeof entry.timestamp, 'number');
});

test('track() with partial context (no CSS, no DOM)', () => {
  const tracker = new ExperiencePropagationTracker({ logLevel: 'warn' });
  const context = {
    renderedCode: {
      html: '<p>partial</p>'
    },
    screenshot: '/img.png'
  };

  const entry = tracker.track('notes', context);

  assert.strictEqual(entry.hasRenderedCode, true);
  assert.strictEqual(entry.hasHTML, true);
  assert.strictEqual(entry.hasCSS, false);
  assert.strictEqual(entry.hasDOM, false);
  assert.strictEqual(entry.htmlLength, '<p>partial</p>'.length);
  assert.strictEqual(entry.hasScreenshot, true);
  assert.strictEqual(entry.hasState, false);
});

test('track() with empty context', () => {
  const tracker = new ExperiencePropagationTracker({ logLevel: 'warn' });
  const entry = tracker.track('evaluation', {});

  assert.strictEqual(entry.hasRenderedCode, false);
  assert.strictEqual(entry.hasHTML, false);
  assert.strictEqual(entry.hasCSS, false);
  assert.strictEqual(entry.hasDOM, false);
  assert.strictEqual(entry.htmlLength, 0);
  assert.strictEqual(entry.hasScreenshot, false);
  assert.strictEqual(entry.hasState, false);
});

test('track() with description', () => {
  const tracker = new ExperiencePropagationTracker({ logLevel: 'warn' });
  const entry = tracker.track('aggregation', {}, 'merging results');

  assert.strictEqual(entry.stage, 'aggregation');
  assert.strictEqual(entry.description, 'merging results');
});

test('track() recognizes state from state, pageState, and gameState', () => {
  const tracker = new ExperiencePropagationTracker({ logLevel: 'warn' });

  const e1 = tracker.track('s1', { state: { x: 1 } });
  assert.strictEqual(e1.hasState, true);

  const tracker2 = new ExperiencePropagationTracker({ logLevel: 'warn' });
  const e2 = tracker2.track('s2', { pageState: { url: '/' } });
  assert.strictEqual(e2.hasState, true);

  const tracker3 = new ExperiencePropagationTracker({ logLevel: 'warn' });
  const e3 = tracker3.track('s3', { gameState: { score: 0 } });
  assert.strictEqual(e3.hasState, true);
});

test('track() does nothing when disabled', () => {
  const tracker = new ExperiencePropagationTracker({ enabled: false });
  const result = tracker.track('capture', { screenshot: '/img.png' });

  assert.strictEqual(result, undefined);
  assert.strictEqual(tracker.propagationPath.length, 0);
});

test('multiple stages tracked in sequence', () => {
  const tracker = new ExperiencePropagationTracker({ logLevel: 'warn' });
  const html = '<div>test</div>';

  tracker.track('capture', { renderedCode: { html }, screenshot: '/a.png' });
  tracker.track('notes', { renderedCode: { html } });
  tracker.track('evaluation', { screenshot: '/b.png' });

  assert.strictEqual(tracker.propagationPath.length, 3);
  assert.strictEqual(tracker.propagationPath[0].stage, 'capture');
  assert.strictEqual(tracker.propagationPath[1].stage, 'notes');
  assert.strictEqual(tracker.propagationPath[2].stage, 'evaluation');
});

test('getSummary() returns correct path and stages', () => {
  const tracker = new ExperiencePropagationTracker({ logLevel: 'warn' });
  const html = '<div>content</div>';
  const css = 'div {}';

  tracker.track('capture', { renderedCode: { html, criticalCSS: css } });
  tracker.track('context', { renderedCode: { html, criticalCSS: css } });

  const summary = tracker.getSummary();

  assert.deepStrictEqual(summary.stages, ['capture', 'context']);
  assert.strictEqual(summary.path.length, 2);
  assert.strictEqual(summary.hasRenderedCodeAtAllStages, true);
  assert.strictEqual(summary.hasHTMLAtAllStages, true);
  assert.strictEqual(summary.hasCSSAtAllStages, true);
});

test('getSummary() detects propagation loss', () => {
  const tracker = new ExperiencePropagationTracker({ logLevel: 'warn' });

  tracker.track('capture', { renderedCode: { html: '<div>x</div>', criticalCSS: 'a{}' } });
  tracker.track('evaluation', { screenshot: '/img.png' });

  const summary = tracker.getSummary();

  assert.strictEqual(summary.hasRenderedCodeAtAllStages, false);
  assert.strictEqual(summary.hasHTMLAtAllStages, false);
  assert.strictEqual(summary.hasCSSAtAllStages, false);
});

test('getSummary() reports htmlLengthProgression', () => {
  const tracker = new ExperiencePropagationTracker({ logLevel: 'warn' });

  tracker.track('capture', { renderedCode: { html: '<div>short</div>' } });
  tracker.track('context', { renderedCode: { html: '<div>much longer content here</div>' } });
  tracker.track('evaluation', {});

  const summary = tracker.getSummary();

  assert.strictEqual(summary.htmlLengthProgression.length, 3);
  assert.strictEqual(summary.htmlLengthProgression[0], '<div>short</div>'.length);
  assert.strictEqual(summary.htmlLengthProgression[1], '<div>much longer content here</div>'.length);
  assert.strictEqual(summary.htmlLengthProgression[2], 0);
});

test('reset() clears all stages', () => {
  const tracker = new ExperiencePropagationTracker({ logLevel: 'warn' });

  tracker.track('capture', { screenshot: '/a.png' });
  tracker.track('notes', { screenshot: '/b.png' });
  assert.strictEqual(tracker.propagationPath.length, 2);

  tracker.reset();
  assert.deepStrictEqual(tracker.propagationPath, []);

  const summary = tracker.getSummary();
  assert.deepStrictEqual(summary.stages, []);
  assert.deepStrictEqual(summary.path, []);
});

test('getPropagationTracker() returns singleton', () => {
  const t1 = getPropagationTracker();
  const t2 = getPropagationTracker();
  assert.strictEqual(t1, t2);
});

test('trackPropagation() convenience function works', () => {
  const tracker = getPropagationTracker();
  tracker.reset();

  const entry = trackPropagation('capture', {
    renderedCode: { html: '<p>test</p>' },
    screenshot: '/shot.png'
  }, 'convenience test');

  assert.strictEqual(entry.stage, 'capture');
  assert.strictEqual(entry.hasHTML, true);
  assert.strictEqual(entry.hasScreenshot, true);
  assert.strictEqual(entry.description, 'convenience test');

  // Clean up singleton state
  tracker.reset();
});
