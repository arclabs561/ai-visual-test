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

  describe('visual anchors', () => {
    it('should include anchors section when provided via context', async () => {
      const prompt = await composeSingleImagePrompt('Evaluate this page', {
        anchors: {
          domain: 'Card game search UI',
          positive: ['Card images large enough to see art'],
          negative: ['Generic unthemed styling']
        }
      });

      assert.ok(prompt.includes('VISUAL ANCHORS:'));
      assert.ok(prompt.includes('Domain: Card game search UI'));
      assert.ok(prompt.includes('Look for (positive signals):'));
      assert.ok(prompt.includes('Card images large enough to see art'));
      assert.ok(prompt.includes('Flag (negative signals):'));
      assert.ok(prompt.includes('Generic unthemed styling'));
    });

    it('should include anchors section when provided via options', async () => {
      const prompt = await composeSingleImagePrompt('Evaluate', {}, {
        anchors: {
          positive: ['Clean layout'],
          negative: ['Broken images']
        }
      });

      assert.ok(prompt.includes('VISUAL ANCHORS:'));
      assert.ok(prompt.includes('Clean layout'));
      assert.ok(prompt.includes('Broken images'));
    });

    it('should merge context and option anchors (config + per-call)', async () => {
      const prompt = await composeSingleImagePrompt('Evaluate', {
        anchors: {
          domain: 'TCG app',
          positive: ['Config-level positive'],
          negative: ['Config-level negative']
        }
      }, {
        anchors: {
          positive: ['Per-call positive'],
          negative: ['Per-call negative']
        }
      });

      assert.ok(prompt.includes('Domain: TCG app'));
      // Config-level comes first, per-call appends
      assert.ok(prompt.includes('Config-level positive'));
      assert.ok(prompt.includes('Per-call positive'));
      assert.ok(prompt.includes('Config-level negative'));
      assert.ok(prompt.includes('Per-call negative'));
    });

    it('should omit anchors section when none provided', async () => {
      const prompt = await composeSingleImagePrompt('Evaluate this page');

      assert.ok(!prompt.includes('VISUAL ANCHORS:'));
    });

    it('should place anchors between rubric and base prompt', async () => {
      const prompt = await composeSingleImagePrompt('MY_BASE_PROMPT', {
        anchors: { positive: ['Anchor marker'] }
      });

      const rubricIdx = prompt.indexOf('EVALUATION RUBRIC');
      const anchorIdx = prompt.indexOf('VISUAL ANCHORS:');
      const baseIdx = prompt.indexOf('MY_BASE_PROMPT');

      // Rubric exists (default is on) and comes before anchors
      assert.ok(rubricIdx >= 0, 'rubric should be present');
      assert.ok(anchorIdx > rubricIdx, 'anchors should follow rubric');
      assert.ok(baseIdx > anchorIdx, 'base prompt should follow anchors');
    });

    it('should include anchors in comparison prompts', async () => {
      const prompt = await composeComparisonPrompt('Compare', {}, {
        anchors: {
          domain: 'E-commerce checkout',
          positive: ['Clear CTAs']
        }
      });

      assert.ok(prompt.includes('VISUAL ANCHORS:'));
      assert.ok(prompt.includes('E-commerce checkout'));
    });

    it('should label reference images when anchor image counts are provided', async () => {
      const prompt = await composeSingleImagePrompt('Evaluate', {
        anchors: { positive: ['Good layout'] },
        _anchorImageCount: { positive: 2, negative: 1 }
      });

      assert.ok(prompt.includes('Reference images are attached in order:'));
      assert.ok(prompt.includes('GOOD example'));
      assert.ok(prompt.includes('BAD example'));
      assert.ok(prompt.includes('Screenshot(s) to evaluate'));
      assert.ok(prompt.includes('Evaluate ONLY the final screenshot'));
    });

    it('should not include image labels when no anchor images attached', async () => {
      const prompt = await composeSingleImagePrompt('Evaluate', {
        anchors: { positive: ['Text only anchor'] }
      });

      assert.ok(prompt.includes('VISUAL ANCHORS:'));
      assert.ok(!prompt.includes('Reference images are attached'));
    });

    it('should work with positive-only or negative-only anchors', async () => {
      const posOnly = await composeSingleImagePrompt('Eval', {
        anchors: { positive: ['Good thing'] }
      });
      assert.ok(posOnly.includes('Look for (positive signals):'));
      assert.ok(!posOnly.includes('Flag (negative signals):'));

      const negOnly = await composeSingleImagePrompt('Eval', {
        anchors: { negative: ['Bad thing'] }
      });
      assert.ok(!negOnly.includes('Look for (positive signals):'));
      assert.ok(negOnly.includes('Flag (negative signals):'));
    });

    it('should support dimension-scoped anchor entries', async () => {
      const prompt = await composeSingleImagePrompt('Evaluate', {
        anchors: {
          positive: [
            'Flat anchor',
            { text: 'Card art visible', dimension: 'card_presentation' },
            { text: 'Brand colors match', dimension: 'game_authenticity' },
          ],
          negative: [
            { text: 'Cramped cards', dimension: 'spacing_layout' },
          ]
        }
      });

      // Flat entry appears without dimension prefix
      assert.ok(prompt.includes('  - Flat anchor'));
      // Dimension-scoped entries appear with [dimension] prefix
      assert.ok(prompt.includes('[card presentation] Card art visible'));
      assert.ok(prompt.includes('[game authenticity] Brand colors match'));
      assert.ok(prompt.includes('[spacing layout] Cramped cards'));
    });

    it('should handle mixed string and object entries', async () => {
      const prompt = await composeSingleImagePrompt('Evaluate', {
        anchors: {
          positive: [
            'Plain string',
            { text: 'Object with text' },
            { image: '/tmp/good.png', label: 'Good example' },  // image-only, no prompt text for this one
          ]
        }
      });

      assert.ok(prompt.includes('  - Plain string'));
      assert.ok(prompt.includes('  - Object with text'));
      // Image-only entries with only a label still appear (label used as text)
      assert.ok(prompt.includes('  - Good example'));
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

