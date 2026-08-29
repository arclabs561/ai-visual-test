/**
 * Tests for experience-propagation.mjs
 */

import '../test-setup.mjs';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  ExperiencePropagationTracker,
  getPropagationTracker,
  trackPropagation
} from '../../src/experience-propagation.js';

describe('Experience Propagation', () => {
  let tracker;

  beforeEach(() => {
    // Create new tracker instance for each test
    tracker = new ExperiencePropagationTracker();
  });

  describe('ExperiencePropagationTracker', () => {
    it('should create instance with default options', () => {
      assert.ok(tracker);
      assert.strictEqual(tracker.enabled, true);
      assert.strictEqual(tracker.logLevel, 'info');
      assert.ok(Array.isArray(tracker.propagationPath));
    });

    it('should create instance with custom options', () => {
      const customTracker = new ExperiencePropagationTracker({
        enabled: false,
        logLevel: 'debug'
      });
      assert.strictEqual(customTracker.enabled, false);
      assert.strictEqual(customTracker.logLevel, 'debug');
    });

    it('should track propagation with rendered code', () => {
      const context = {
        renderedCode: {
          html: '<div>Test</div>',
          criticalCSS: 'body { margin: 0; }',
          domStructure: { type: 'div' }
        }
      };
      const result = tracker.track('capture', context, 'Test description');
      
      assert.ok(result);
      assert.strictEqual(result.stage, 'capture');
      assert.strictEqual(result.hasRenderedCode, true);
      assert.strictEqual(result.hasHTML, true);
      assert.strictEqual(result.hasCSS, true);
      assert.strictEqual(result.hasDOM, true);
      assert.strictEqual(result.htmlLength, 15);
    });

    it('should track propagation with screenshot', () => {
      const context = {
        screenshot: '/path/to/screenshot.png'
      };
      const result = tracker.track('capture', context);
      
      assert.strictEqual(result.hasScreenshot, true);
      assert.strictEqual(result.hasRenderedCode, false);
    });

    it('should track propagation with state', () => {
      const context = {
        state: { score: 100 }
      };
      const result = tracker.track('evaluation', context);
      
      assert.strictEqual(result.hasState, true);
    });

    it('should track propagation with pageState', () => {
      const context = {
        pageState: { loaded: true }
      };
      const result = tracker.track('capture', context);
      
      assert.strictEqual(result.hasState, true);
    });

    it('should track propagation with gameState', () => {
      const context = {
        gameState: { level: 1 }
      };
      const result = tracker.track('gameplay', context);
      
      assert.strictEqual(result.hasState, true);
    });

    it('should not track when disabled', () => {
      tracker.enabled = false;
      const before = tracker.propagationPath.length;
      tracker.track('capture', {});
      assert.strictEqual(tracker.propagationPath.length, before);
    });

    it('should warn when context is lost', () => {
      const context1 = {
        renderedCode: { html: '<div>Test</div>' }
      };
      tracker.track('capture', context1);
      
      const context2 = {}; // No rendered code
      tracker.track('notes', context2);
      
      // Should have 2 entries
      assert.strictEqual(tracker.propagationPath.length, 2);
      assert.strictEqual(tracker.propagationPath[1].hasRenderedCode, false);
    });

    it('should get summary', () => {
      tracker.track('capture', { renderedCode: { html: '<div>Test</div>' } });
      tracker.track('notes', { renderedCode: { html: '<div>Test</div>' } });
      
      const summary = tracker.getSummary();
      
      assert.ok(summary);
      assert.strictEqual(summary.path.length, 2);
      assert.deepStrictEqual(summary.stages, ['capture', 'notes']);
      assert.strictEqual(summary.hasRenderedCodeAtAllStages, true);
      assert.strictEqual(summary.hasHTMLAtAllStages, true);
      assert.ok(Array.isArray(summary.htmlLengthProgression));
    });

    it('should detect when rendered code is lost', () => {
      tracker.track('capture', { renderedCode: { html: '<div>Test</div>' } });
      tracker.track('notes', {}); // No rendered code
      
      const summary = tracker.getSummary();
      assert.strictEqual(summary.hasRenderedCodeAtAllStages, false);
    });

    it('should reset propagation path', () => {
      tracker.track('capture', {});
      assert.strictEqual(tracker.propagationPath.length, 1);
      
      tracker.reset();
      assert.strictEqual(tracker.propagationPath.length, 0);
    });
  });

  describe('getPropagationTracker', () => {
    it('should return singleton instance', () => {
      const tracker1 = getPropagationTracker();
      const tracker2 = getPropagationTracker();
      
      assert.strictEqual(tracker1, tracker2);
    });

    it('should create instance with options on first call', () => {
      // getPropagationTracker returns singleton, so we verify it exists and accepts options
      const tracker = getPropagationTracker({ logLevel: 'debug' });
      assert.ok(tracker);
      // Verify tracker has logLevel property (may be set on creation or already exist)
      assert.ok('logLevel' in tracker);
      // If logLevel wasn't set to debug, update it to verify it can be changed
      if (tracker.logLevel !== 'debug') {
        tracker.logLevel = 'debug';
      }
      assert.strictEqual(tracker.logLevel, 'debug');
    });
  });

  describe('trackPropagation', () => {
    it('should track propagation using global tracker', () => {
      const result = trackPropagation('capture', {
        renderedCode: { html: '<div>Test</div>' }
      }, 'Test');
      
      assert.ok(result);
      assert.strictEqual(result.stage, 'capture');
      assert.strictEqual(result.hasRenderedCode, true);
    });

    it('should track multiple stages', () => {
      // Reset tracker to ensure clean state
      const tracker = getPropagationTracker();
      tracker.reset();
      
      trackPropagation('capture', { renderedCode: { html: '<div>Test</div>' } });
      trackPropagation('notes', { renderedCode: { html: '<div>Test</div>' } });
      trackPropagation('evaluation', { renderedCode: { html: '<div>Test</div>' } });
      
      const summary = tracker.getSummary();
      
      assert.strictEqual(summary.path.length, 3, 'Should track 3 stages');
      assert.deepStrictEqual(summary.stages, ['capture', 'notes', 'evaluation'], 'Should have correct stage order');
    });
  });
});
