/**
 * Game playing, goal-based validation, and gameplay testing.
 *
 * Import from `@arclabs561/ai-visual-test/game`.
 */

export { playGame, GameGym, decideGameAction, executeGameAction } from '#game-player';
export type {
  GameActionDecider,
  GameActionExecutionResult,
  GameActionExecutor,
  GameActionSelection,
  GameActionSelector,
  GameDecisionManager,
  GameEvaluation,
  GameGymInfo,
  GameGymOptions,
  GameGymState,
  GameHistoryEntry,
  GameLocator,
  GameLoopState,
  GameObservation,
  GameOptions,
  GamePage,
  GameReviewContext,
  GameReviewState,
  GameRunResult,
  GameServices,
  GameStateData,
  GameTerminalContext,
  GameTerminalPredicate,
} from '#game-player';
export type { GameAction } from '#game-action-contract';

export { generateGamePrompt, createGameGoal, createGameGoals } from '#game-goal-prompts';
export type {
  GameGoal,
  GamePersona,
  GamePromptContext,
  GamePromptInput,
  GameState,
  GoalOptions,
} from '#game-goal-prompts';

export { testGameplay, testBrowserExperience, validateWithGoals } from '#game-convenience';
export type {
  BrowserExperienceOptions,
  BrowserExperienceResult,
  GameConvenienceLocator,
  GameConveniencePage,
  GameplayOptions,
  GameplayPersona,
  GameplayResult,
  GameplayState,
  Goal,
  GoalObject,
  GoalValidationOptions,
  PlayGameResult,
} from '#game-convenience';
