/**
 * Compatibility entry point for the TypeScript game convenience implementation.
 *
 * The staged package emits `game-convenience.js` beside this module; source
 * package execution is intentionally verified through that same staged layout.
 */
export {
  testGameplay,
  testBrowserExperience,
  validateWithGoals,
} from '#game-convenience';
