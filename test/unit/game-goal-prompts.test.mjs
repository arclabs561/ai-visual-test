/**
 * Unit tests for game-goal-prompts.mjs
 *
 * Tests generateGamePrompt (string, object, array, function, invalid inputs),
 * createGameGoal (all types + unknown fallback + options override),
 * and createGameGoals (multiple types).
 */

import '../test-setup.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  generateGamePrompt,
  createGameGoal,
  createGameGoals
} from '../../src/game-goal-prompts.mjs';

describe('generateGamePrompt', () => {
  describe('string input', () => {
    it('should return prompt containing the string', () => {
      const result = generateGamePrompt('Is the game fun?', {});
      assert.ok(result.includes('Is the game fun?'));
    });

    it('should interpolate ${gameState.*} variables', () => {
      const result = generateGamePrompt(
        'The current score is ${gameState.score} points',
        { gameState: { score: 42 } }
      );
      assert.ok(result.includes('The current score is 42 points'));
      assert.ok(!result.includes('${gameState.score}'));
    });

    it('should leave unmatched ${gameState.*} tokens intact', () => {
      const result = generateGamePrompt(
        'Score: ${gameState.score}',
        { gameState: {} }
      );
      assert.ok(result.includes('${gameState.score}'));
    });

    it('should append CURRENT GAME STATE when gameState has keys', () => {
      const result = generateGamePrompt('Evaluate gameplay', {
        gameState: { score: 10, level: 2 }
      });
      assert.ok(result.includes('CURRENT GAME STATE'));
      assert.ok(result.includes('Score: 10'));
      assert.ok(result.includes('Level: 2'));
    });

    it('should not duplicate CURRENT GAME STATE if already in prompt', () => {
      const prompt = 'Check the CURRENT GAME STATE section';
      const result = generateGamePrompt(prompt, {
        gameState: { score: 5 }
      });
      // Should appear exactly once (only the original)
      const count = result.split('CURRENT GAME STATE').length - 1;
      assert.strictEqual(count, 1);
    });
  });

  describe('goal object input', () => {
    it('should include GOAL description', () => {
      const goal = { description: 'Test the fun factor' };
      const result = generateGamePrompt(goal, {});
      assert.ok(result.includes('GOAL: Test the fun factor'));
    });

    it('should include numbered EVALUATION CRITERIA', () => {
      const goal = {
        description: 'Test',
        criteria: ['Is it fun?', 'Is it balanced?']
      };
      const result = generateGamePrompt(goal, {});
      assert.ok(result.includes('EVALUATION CRITERIA'));
      assert.ok(result.includes('1. Is it fun?'));
      assert.ok(result.includes('2. Is it balanced?'));
    });

    it('should include FOCUS AREAS as comma-separated list', () => {
      const goal = { description: 'Test', focus: ['engagement', 'pacing'] };
      const result = generateGamePrompt(goal, {});
      assert.ok(result.includes('FOCUS AREAS: engagement, pacing'));
    });

    it('should include numbered QUESTIONS TO ANSWER', () => {
      const goal = {
        description: 'Test',
        questions: ['Is it replayable?', 'Is it intuitive?']
      };
      const result = generateGamePrompt(goal, {});
      assert.ok(result.includes('QUESTIONS TO ANSWER'));
      assert.ok(result.includes('1. Is it replayable?'));
    });

    it('should format minScore and maxScore range', () => {
      const goal = { description: 'Test', minScore: 6, maxScore: 9 };
      const result = generateGamePrompt(goal, {});
      assert.ok(result.includes('EXPECTED SCORE RANGE: 6-9/10'));
    });

    it('should format minScore only', () => {
      const goal = { description: 'Test', minScore: 7 };
      const result = generateGamePrompt(goal, {});
      assert.ok(result.includes('EXPECTED SCORE RANGE: ≥7/10'));
    });

    it('should format maxScore only', () => {
      const goal = { description: 'Test', maxScore: 5 };
      const result = generateGamePrompt(goal, {});
      assert.ok(result.includes('EXPECTED SCORE RANGE: ≤5/10'));
    });
  });

  describe('array input', () => {
    it('should delegate single-element array to generateGamePrompt', () => {
      const goals = ['Is it fun?'];
      const result = generateGamePrompt(goals, {});
      // Single string goal is processed as a string prompt
      assert.ok(result.includes('Is it fun?'));
    });

    it('should produce EVALUATE THE FOLLOWING GOALS header for multiple goals', () => {
      const goals = [
        'Check accessibility',
        { description: 'Evaluate balance', criteria: ['difficulty'] }
      ];
      const result = generateGamePrompt(goals, { gameState: { score: 10 } });
      assert.ok(result.includes('EVALUATE THE FOLLOWING GOALS'));
      assert.ok(result.includes('1. Check accessibility'));
      assert.ok(result.includes('2. Evaluate balance'));
      assert.ok(result.includes('Criteria: difficulty'));
    });

    it('should fall back to default prompt for empty array', () => {
      const result = generateGamePrompt([], {});
      assert.ok(result.includes('Evaluate the gameplay experience'));
    });
  });

  describe('function input', () => {
    it('should call function with context and return its result', () => {
      const fn = (ctx) => `Score is ${ctx.gameState.score}`;
      const result = generateGamePrompt(fn, { gameState: { score: 99 } });
      assert.strictEqual(result, 'Score is 99');
    });
  });

  describe('invalid input', () => {
    it('should fall back to default gameplay prompt for null', () => {
      const result = generateGamePrompt(null, {});
      assert.ok(result.includes('Evaluate the gameplay experience'));
    });

    it('should fall back to default gameplay prompt for undefined', () => {
      const result = generateGamePrompt(undefined, {});
      assert.ok(result.includes('Evaluate the gameplay experience'));
    });

    it('should fall back to default gameplay prompt for number', () => {
      const result = generateGamePrompt(42, {});
      assert.ok(result.includes('Evaluate the gameplay experience'));
    });
  });

  describe('persona context', () => {
    it('should append PERSONA PERSPECTIVE for string input', () => {
      const result = generateGamePrompt('Evaluate', {
        persona: { name: 'Casual Gamer', perspective: 'Likes easy games' }
      });
      assert.ok(result.includes('PERSONA PERSPECTIVE: Casual Gamer'));
      assert.ok(result.includes('Likes easy games'));
    });

    it('should append persona goals for goal object input', () => {
      const goal = { description: 'Test' };
      const result = generateGamePrompt(goal, {
        persona: { name: 'Speedrunner', goals: ['fast completion', 'glitch usage'] }
      });
      assert.ok(result.includes('PERSONA PERSPECTIVE: Speedrunner'));
      assert.ok(result.includes('GOALS: fast completion, glitch usage'));
    });
  });

  describe('previousState', () => {
    it('should show state changes in goal object prompt', () => {
      const goal = { description: 'Track progress' };
      const result = generateGamePrompt(goal, {
        gameState: { score: 50, level: 3 },
        previousState: { score: 30, level: 2 }
      });
      assert.ok(result.includes('PREVIOUS STATE'));
      assert.ok(result.includes('CHANGES'));
      assert.ok(result.includes('Score: 30'));
      assert.ok(result.includes('50'));
      assert.ok(result.includes('Level: 2'));
    });
  });
});

describe('createGameGoal', () => {
  const validTypes = ['fun', 'accessibility', 'performance', 'balance', 'visuals', 'controls'];

  for (const type of validTypes) {
    it(`should create a '${type}' goal with description, criteria, focus, questions`, () => {
      const goal = createGameGoal(type);
      assert.ok(typeof goal.description === 'string' && goal.description.length > 0);
      assert.ok(Array.isArray(goal.criteria) && goal.criteria.length > 0);
      assert.ok(Array.isArray(goal.focus) && goal.focus.length > 0);
      assert.ok(Array.isArray(goal.questions) && goal.questions.length > 0);
    });
  }

  it('should fall back to fun goal for unknown type', () => {
    const unknown = createGameGoal('nonexistent');
    const fun = createGameGoal('fun');
    assert.strictEqual(unknown.description, fun.description);
    assert.deepStrictEqual(unknown.criteria, fun.criteria);
  });

  it('should allow custom options to override template fields', () => {
    const goal = createGameGoal('fun', {
      description: 'Custom description',
      criteria: ['Custom criterion'],
      minScore: 5
    });
    assert.strictEqual(goal.description, 'Custom description');
    assert.deepStrictEqual(goal.criteria, ['Custom criterion']);
    assert.strictEqual(goal.minScore, 5);
    // Focus should still come from the template since we did not override it
    assert.ok(goal.focus.includes('engagement'));
  });
});

describe('createGameGoals', () => {
  it('should return an array of goal objects for multiple types', () => {
    const goals = createGameGoals(['fun', 'visuals', 'controls']);
    assert.strictEqual(goals.length, 3);
    assert.ok(goals[0].description.toLowerCase().includes('fun'));
    assert.ok(goals[1].description.toLowerCase().includes('visual'));
    assert.ok(goals[2].description.toLowerCase().includes('control'));
  });

  it('should apply shared options to all created goals', () => {
    const goals = createGameGoals(['fun', 'balance'], { minScore: 7 });
    for (const goal of goals) {
      assert.strictEqual(goal.minScore, 7);
    }
  });
});
