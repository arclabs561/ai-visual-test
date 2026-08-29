/**
 * Validators Sub-Module
 *
 * All validation-related functionality grouped together.
 *
 * Import from 'ai-visual-test/validators'
 *
 * ## Which validator to use
 *
 * | Test type              | Validator                        | Speed  | Needs VLM? |
 * |------------------------|----------------------------------|--------|------------|
 * | Visual quality/design  | `validateWithRubric()`           | Slow   | Yes        |
 * | Accessibility (fast)   | `checkAllTextContrast()`,        | Fast   | No         |
 * |                        | `checkKeyboardNavigation()`      |        |            |
 * | Accessibility (full)   | `validateAccessibilityHybrid()`  | Medium | Yes        |
 * | Element position/size  | `validateElementPosition()`      | Fast   | No         |
 * | State correctness      | `validateStateProgrammatic()`    | Fast   | No         |
 * | State + visual context | `validateStateHybrid()`          | Medium | Yes        |
 * | Batch (many pages)     | `BatchValidator`                 | Varies | Yes        |
 * | Custom rubric scoring  | `validateWithRubric()`           | Slow   | Yes        |
 *
 * **Rule of thumb**: use programmatic validators for deterministic checks (contrast,
 * position, state), hybrid validators when you need both programmatic precision and
 * VLM judgment, and rubric-based validation for subjective quality assessment.
 *
 * VLM-based validators are slower and cost API tokens. Prefer programmatic validators
 * when the check can be expressed as a deterministic rule.
 */

export { StateValidator } from './state-validator.js';
export { AccessibilityValidator } from './accessibility-validator.js';
export { PromptBuilder } from './prompt-builder.js';
export { validateWithRubric } from './rubric.js';
export { BatchValidator } from './batch-validator.js';
export {
  getContrastRatio,
  checkElementContrast,
  checkAllTextContrast,
  checkKeyboardNavigation,
} from './accessibility-programmatic.js';
export type {
  ContrastCheckResult,
  KeyboardNavigationResult,
  TextContrastResult,
  ValidatorPage,
} from './accessibility-programmatic.js';
export {
  validateStateProgrammatic,
  validateElementPosition,
} from './state-programmatic.js';
export {
  validateAccessibilityHybrid,
  validateStateHybrid,
  validateWithProgrammaticContext,
} from './hybrid-validator.js';
export type { HybridContextResult } from './hybrid-validator.js';
