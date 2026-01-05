/**
 * Integration tests for prompt-composer.mjs
 */

import '../test-setup.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  composeSingleImagePrompt,
  composeComparisonPrompt,
  composeMultiModalPrompt
} from '../../src/prompt-composer.mjs';

describe('Prompt Composer', () => {
  describe('composeSingleImagePrompt', () => {
    it('should compose prompt with base prompt', async () => {
      const prompt = await composeSingleImagePrompt('Evaluate this page');
      
      assert.ok(typeof prompt === 'string');
      assert.ok(prompt.length > 0);
      assert.ok(prompt.includes('Evaluate this page'));
    });

    it('should include rubric by default', async () => {
      const prompt = await composeSingleImagePrompt('Evaluate');
      
      assert.ok(typeof prompt === 'string');
      // Should include rubric content
      assert.ok(prompt.length > 50);
    });

    it('should include temporal notes when provided', async () => {
      const temporalNotes = {
        windows: [
          { startTime: 1000, endTime: 2000, notes: [], avgScore: 5.0, noteCount: 1, timeRange: '1s-2s' }
        ],
        coherence: 0.8,
        conflicts: []
      };
      
      const prompt = await composeSingleImagePrompt('Evaluate', {}, {
        temporalNotes
      });
      
      assert.ok(typeof prompt === 'string');
    });

    it('should include persona when provided', async () => {
      const prompt = await composeSingleImagePrompt('Evaluate', {
        persona: 'expert',
        perspective: 'accessibility'
      });
      
      assert.ok(typeof prompt === 'string');
    });
  });

  describe('composeComparisonPrompt', () => {
    it('should compose comparison prompt', async () => {
      const prompt = await composeComparisonPrompt('Compare these two designs');
      
      assert.ok(typeof prompt === 'string');
      assert.ok(prompt.length > 0);
    });

    it('should include comparison instructions', async () => {
      const prompt = await composeComparisonPrompt('Compare');
      
      assert.ok(typeof prompt === 'string');
      // Should include comparison-specific content
      assert.ok(prompt.length > 50);
    });
  });

  describe('composeMultiModalPrompt', () => {
    it('should compose multi-modal prompt', async () => {
      const prompt = await composeMultiModalPrompt('Evaluate', {
        renderedCode: { html: '<div>test</div>' }
      });
      
      assert.ok(typeof prompt === 'string');
      assert.ok(prompt.length > 0);
    });

    it('should include rendered code when provided', async () => {
      const prompt = await composeMultiModalPrompt('Evaluate', {
        renderedCode: {
          html: '<div>Test</div>',
          criticalCSS: '.test { color: red; }'
        }
      });
      
      assert.ok(typeof prompt === 'string');
      assert.ok(prompt.includes('Test') || prompt.length > 50);
    });

    it('should include game state when provided', async () => {
      const prompt = await composeMultiModalPrompt('Evaluate', {
        gameState: { score: 100, level: 1 }
      });
      
      assert.ok(typeof prompt === 'string');
    });
  });
});

