/**
 * Game Sub-Module
 *
 * Game playing, goal-based validation, and gameplay testing.
 *
 * Import from '@arclabs561/ai-visual-test/game'
 */

// Game playing (requires Playwright)
export {
  playGame,
  GameGym,
  decideGameAction,
  executeGameAction
} from '../game-player.mjs';

// Game goal prompts
export {
  generateGamePrompt,
  createGameGoal,
  createGameGoals
} from '../game-goal-prompts.mjs';

// Convenience functions for gameplay testing
export {
  testGameplay,
  testBrowserExperience,
  validateWithGoals
} from '../convenience.mjs';
