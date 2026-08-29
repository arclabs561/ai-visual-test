/**
 * Integration tests for game-goal-prompts.mjs
 */

import '../test-setup.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  generateGamePrompt,
  createGameGoal,
  createGameGoals
} from '#game-goal-prompts';

describe('Game Goal Prompts', () => {
  describe('generateGamePrompt', () => {
    it('should generate prompt from string goal', () => {
      const prompt = generateGamePrompt('Evaluate the gameplay mechanics');
      
      assert.ok(typeof prompt === 'string');
      assert.ok(prompt.length > 0);
    });

    it('should generate prompt from goal object', () => {
      const goal = {
        type: 'mechanics',
        focus: ['controls']
      };
      
      const prompt = generateGamePrompt(goal);
      
      assert.ok(typeof prompt === 'string');
      assert.ok(prompt.length > 0);
    });

    it('should include context in prompt', () => {
      const prompt = generateGamePrompt('Evaluate gameplay', {
        gameState: { score: 100 },
        stage: 'mid-game'
      });
      
      assert.ok(typeof prompt === 'string');
      assert.ok(prompt.length > 0);
    });
  });

  describe('createGameGoal', () => {
    it('should create goal from type string', () => {
      const goal = createGameGoal('mechanics');
      
      assert.ok(goal);
      assert.ok(typeof goal === 'object');
    });

    it('should create goal with options', () => {
      const goal = createGameGoal('mechanics', {
        focus: 'controls',
        priority: 'high'
      });
      
      assert.ok(goal);
      assert.ok(typeof goal === 'object');
    });
  });

  describe('createGameGoals', () => {
    it('should create multiple goals', () => {
      const goals = createGameGoals(['mechanics', 'visual']);
      
      assert.ok(Array.isArray(goals));
      assert.ok(goals.length === 2);
    });

    it('should create goals with shared options', () => {
      const goals = createGameGoals(['mechanics', 'visual'], {
        priority: 'high'
      });
      
      assert.ok(Array.isArray(goals));
      assert.ok(goals.length === 2);
    });
  });
});
