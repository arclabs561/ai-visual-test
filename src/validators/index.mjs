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

// Re-export everything from validators
export { StateValidator } from './state-validator.mjs';
export { AccessibilityValidator } from './accessibility-validator.mjs';
export { PromptBuilder } from './prompt-builder.mjs';
export { validateWithRubric } from './rubric.mjs';
export { BatchValidator } from './batch-validator.mjs';

// Programmatic validators (fast, deterministic)
export {
  getContrastRatio,
  checkElementContrast,
  checkAllTextContrast,
  checkKeyboardNavigation
} from './accessibility-programmatic.mjs';

export {
  validateStateProgrammatic,
  validateElementPosition
} from './state-programmatic.mjs';

// Hybrid validators (programmatic + VLLM)
export {
  validateAccessibilityHybrid,
  validateStateHybrid,
  validateWithProgrammaticContext
} from './hybrid-validator.mjs';
