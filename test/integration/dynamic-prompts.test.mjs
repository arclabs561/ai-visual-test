/**
 * Integration tests for dynamic-prompts.mjs
 */

import '../test-setup.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  generateDynamicPrompt,
  generatePromptVariations,
  generateInteractionPrompt,
  generateGameplayPrompt
} from '../../src/dynamic-prompts.mjs';

describe('Dynamic Prompts', () => {
  describe('generateDynamicPrompt', () => {
    it('should generate prompt from context', () => {
      const prompt = generateDynamicPrompt({
        stage: 'initial',
        testingGoal: 'ux-improvement'
      });
      
      assert.ok(typeof prompt === 'string');
      assert.ok(prompt.length > 0);
    });

    it('should handle different stages', () => {
      const prompt1 = generateDynamicPrompt({ stage: 'initial' });
      const prompt2 = generateDynamicPrompt({ stage: 'mid-game' });
      
      assert.ok(typeof prompt1 === 'string');
      assert.ok(typeof prompt2 === 'string');
    });

    it('should handle different testing goals', () => {
      const prompt = generateDynamicPrompt({
        testingGoal: 'accessibility'
      });
      
      assert.ok(typeof prompt === 'string');
    });
  });

  describe('generatePromptVariations', () => {
    it('should generate variations from context', () => {
      const variations = generatePromptVariations({
        stage: 'initial',
        testingGoal: 'ux-improvement'
      });
      
      assert.ok(Array.isArray(variations));
      assert.ok(variations.length > 0);
    });

    it('should generate custom variations', () => {
      const variations = generatePromptVariations(
        { stage: 'initial' },
        ['variation1', 'variation2']
      );
      
      assert.ok(Array.isArray(variations));
    });
  });

  describe('generateInteractionPrompt', () => {
    it('should generate prompt for interaction', () => {
      const prompt = generateInteractionPrompt(
        { type: 'click', target: 'button' },
        { before: 'state1' },
        { after: 'state2' }
      );
      
      assert.ok(typeof prompt === 'string');
      assert.ok(prompt.length > 0);
    });

    it('should handle different interaction types', () => {
      const prompt = generateInteractionPrompt(
        { type: 'keyboard', key: 'Enter' },
        {},
        {}
      );
      
      assert.ok(typeof prompt === 'string');
    });
  });

  describe('generateGameplayPrompt', () => {
    it('should generate prompt from game state', async () => {
      const prompt = await generateGameplayPrompt({
        score: 100,
        level: 1
      });
      
      assert.ok(typeof prompt === 'string');
      assert.ok(prompt.length > 0);
    });

    it('should include previous state when provided', async () => {
      const prompt = await generateGameplayPrompt(
        { score: 100 },
        { score: 50 }
      );
      
      assert.ok(typeof prompt === 'string');
    });

    it('should handle goal or prompt parameter', async () => {
      const prompt1 = await generateGameplayPrompt({ score: 100 }, null, 'mechanics');
      const prompt2 = await generateGameplayPrompt({ score: 100 }, null, 'Evaluate gameplay');
      
      assert.ok(typeof prompt1 === 'string');
      assert.ok(typeof prompt2 === 'string');
    });
  });
});

