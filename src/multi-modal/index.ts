/** Public multi-modal validation API. */

export {
  multiModalValidation,
  extractRenderedCode,
  multiPerspectiveEvaluation,
  captureTemporalScreenshots,
} from '../multi-modal.js';
export type {
  DOMStructure,
  MultiModalPage,
  MultiModalValidationOptions,
  MultiModalValidationResult,
  RenderedCode,
  RenderedCodeOptions,
  RenderedElement,
  RenderedStylesheet,
  RenderedStylesheetRule,
  Viewport,
} from '../multi-modal.js';

export {
  checkCrossModalConsistency,
  validateExperienceConsistency,
} from '../cross-modal-consistency.mjs';

export {
  composeSingleImagePrompt,
  composeComparisonPrompt,
  composeMultiModalPrompt,
} from '../prompt-composer.mjs';

// Capture remains the same implementation exported from /temporal; expose its
// deliberately narrower screenshot-only page contract alongside full-page APIs.
export type {
  Page,
  ScreenshotOptions,
  TemporalCaptureOptions,
  TemporalScreenshot,
} from '#temporal-capture';
