/**
 * Multi-Modal Sub-Module
 * 
 * Multi-modal validation features (screenshot + HTML + CSS + rendered code).
 * 
 * Import from 'ai-visual-test/multi-modal'
 */

// Core multi-modal functions
export {
  multiModalValidation,
  captureTemporalScreenshots,
  extractRenderedCode,
  multiPerspectiveEvaluation
} from '../multi-modal.mjs';

// Cross-modal consistency (used by convenience.mjs and persona-experience.mjs)
export {
  checkCrossModalConsistency,
  validateExperienceConsistency
} from '../cross-modal-consistency.mjs';

// Prompt composition
export {
  composeSingleImagePrompt,
  composeComparisonPrompt,
  composeMultiModalPrompt
} from '../prompt-composer.mjs';

