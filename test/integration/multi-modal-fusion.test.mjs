/**
 * Integration tests for multi-modal-fusion.mjs
 */

import '../test-setup.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  calculateModalityWeights,
  buildStructuredFusionPrompt,
  compareFusionStrategies
} from '../../src/multi-modal-fusion.mjs';

describe('Multi-Modal Fusion', () => {
  describe('calculateModalityWeights', () => {
    it('should return default weights for generic prompt', () => {
      const modalities = {
        screenshot: 'test.png',
        renderedCode: { html: '<div>test</div>' }
      };
      
      const weights = calculateModalityWeights(modalities, 'Evaluate this page');
      
      assert.ok(weights);
      assert.ok(typeof weights.screenshot === 'number');
      assert.ok(typeof weights.html === 'number');
      assert.ok(typeof weights.css === 'number');
      assert.ok(typeof weights.dom === 'number');
      assert.ok(typeof weights.gameState === 'number');
      
      // Weights should sum to ~1.0 (normalized)
      const total = Object.values(weights).reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(total - 1.0) < 0.01);
    });

    it('should increase screenshot weight for visual prompts', () => {
      const modalities = {
        screenshot: 'test.png'
      };
      
      const weights = calculateModalityWeights(modalities, 'Evaluate the visual design and appearance');
      
      assert.ok(weights.screenshot >= 0.4);
    });

    it('should increase HTML/DOM weight for structure prompts', () => {
      const modalities = {
        screenshot: 'test.png',
        renderedCode: { html: '<div>test</div>' }
      };
      
      const weights = calculateModalityWeights(modalities, 'Evaluate the HTML structure and layout');
      
      assert.ok(weights.html >= 0.2);
      assert.ok(weights.dom >= 0.1);
    });

    it('should increase CSS weight for styling prompts', () => {
      const modalities = {
        screenshot: 'test.png',
        renderedCode: { criticalCSS: '.test { color: red; }' }
      };
      
      const weights = calculateModalityWeights(modalities, 'Evaluate the CSS styling');
      
      assert.ok(weights.css >= 0.2);
    });

    it('should increase gameState weight for state prompts', () => {
      const modalities = {
        screenshot: 'test.png',
        gameState: { score: 100 }
      };
      
      const weights = calculateModalityWeights(modalities, 'Evaluate the game state and functionality');
      
      assert.ok(weights.gameState >= 0.1);
    });

    it('should normalize weights to sum to 1.0', () => {
      const modalities = {
        screenshot: 'test.png'
      };
      
      const weights = calculateModalityWeights(modalities, 'Test prompt');
      
      const total = Object.values(weights).reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(total - 1.0) < 0.01);
    });
  });

  describe('buildStructuredFusionPrompt', () => {
    it('should build prompt with screenshot', () => {
      const modalities = {
        screenshot: 'test.png'
      };
      
      const prompt = buildStructuredFusionPrompt('Evaluate this page', modalities);
      
      assert.ok(typeof prompt === 'string');
      assert.ok(prompt.includes('test.png'));
      assert.ok(prompt.includes('MULTI-MODAL CONTEXT'));
    });

    it('should include HTML when provided', () => {
      const modalities = {
        screenshot: 'test.png',
        renderedCode: {
          html: '<div>Test HTML</div>'
        }
      };
      
      const prompt = buildStructuredFusionPrompt('Evaluate', modalities);
      
      assert.ok(prompt.includes('HTML Structure'));
      assert.ok(prompt.includes('Test HTML'));
    });

    it('should include CSS when provided', () => {
      const modalities = {
        screenshot: 'test.png',
        renderedCode: {
          criticalCSS: '.test { color: red; }'
        }
      };
      
      const prompt = buildStructuredFusionPrompt('Evaluate', modalities);
      
      assert.ok(prompt.includes('Critical CSS'));
      assert.ok(prompt.includes('color: red'));
    });

    it('should include DOM structure when provided', () => {
      const modalities = {
        screenshot: 'test.png',
        renderedCode: {
          domStructure: { tag: 'div', children: [] }
        }
      };
      
      const prompt = buildStructuredFusionPrompt('Evaluate', modalities);
      
      assert.ok(prompt.includes('DOM Structure'));
    });

    it('should include game state when provided', () => {
      const modalities = {
        screenshot: 'test.png',
        gameState: { score: 100, level: 1 }
      };
      
      const prompt = buildStructuredFusionPrompt('Evaluate', modalities);
      
      assert.ok(prompt.includes('Game State'));
      assert.ok(prompt.includes('score'));
    });

    it('should include evaluation instructions', () => {
      const modalities = {
        screenshot: 'test.png'
      };
      
      const prompt = buildStructuredFusionPrompt('Evaluate', modalities);
      
      assert.ok(prompt.includes('EVALUATION INSTRUCTIONS'));
    });

    it('should handle missing modalities gracefully', () => {
      const modalities = {};
      
      const prompt = buildStructuredFusionPrompt('Evaluate', modalities);
      
      assert.ok(typeof prompt === 'string');
      assert.ok(prompt.length > 0);
    });
  });

  describe('compareFusionStrategies', () => {
    it('should compare simple vs structured fusion', () => {
      const modalities = {
        screenshot: 'test.png',
        renderedCode: { html: '<div>test</div>' },
        gameState: { score: 100 }
      };
      
      const comparison = compareFusionStrategies('Evaluate', modalities);
      
      assert.ok(comparison);
      assert.ok(comparison.simple);
      assert.ok(comparison.structured);
      assert.ok(comparison.recommendation);
      
      assert.ok(typeof comparison.simple.length === 'number');
      assert.ok(typeof comparison.structured.length === 'number');
      assert.strictEqual(comparison.simple.hasWeights, false);
      assert.strictEqual(comparison.structured.hasWeights, true);
      assert.ok(comparison.structured.weights);
    });

    it('should include weights in structured strategy', () => {
      const modalities = {
        screenshot: 'test.png'
      };
      
      const comparison = compareFusionStrategies('Evaluate', modalities);
      
      assert.ok(comparison.structured.weights);
      assert.ok(comparison.structured.weights.screenshot);
    });

    it('should handle empty modalities', () => {
      const comparison = compareFusionStrategies('Evaluate', {});
      
      assert.ok(comparison);
      assert.ok(comparison.simple);
      assert.ok(comparison.structured);
    });
  });
});

