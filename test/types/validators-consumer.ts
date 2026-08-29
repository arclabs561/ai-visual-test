import {
  AccessibilityValidator,
  BatchValidator,
  PromptBuilder,
  StateValidator,
  checkElementContrast,
  checkAllTextContrast,
  checkKeyboardNavigation,
  getContrastRatio,
  validateAccessibilityHybrid,
  validateElementPosition,
  validateWithRubric,
  validateStateHybrid,
  validateStateProgrammatic,
  validateWithProgrammaticContext,
} from '@arclabs561/ai-visual-test/validators';
import type { HybridContextResult } from '@arclabs561/ai-visual-test/validators';

const page = {
  async evaluate<T, Argument = undefined>(callback: (argument: Argument) => T | Promise<T>, argument?: Argument): Promise<T> {
    return await callback(argument as Argument);
  },
};

const ratio: number = getContrastRatio('#000', '#fff');
const elementContrast = checkElementContrast(page, '#title');
const contrast = checkAllTextContrast(page);
const keyboard = checkKeyboardNavigation(page);
const state = validateStateProgrammatic(page, {});
const position = validateElementPosition(page, '#title', { x: 0, y: 0 });
const accessibilityHybrid = validateAccessibilityHybrid(page, 'screen.png');
const stateHybrid: Promise<HybridContextResult> = validateStateHybrid(page, 'screen.png', {});
const contextual: Promise<HybridContextResult> = validateWithProgrammaticContext('screen.png', 'Evaluate the screen', {});
const rubric = { score: { criteria: { 10: 'excellent' } } };
const stateValidator = new StateValidator();
const batchValidator = new BatchValidator();
const accessibilityValidator = new AccessibilityValidator({ minContrast: 4.5 });
const promptBuilder = new PromptBuilder({ rubric });
const rubricValidation = validateWithRubric('screen.png', 'Evaluate the screen', rubric);

void ratio;
void elementContrast;
void contrast;
void keyboard;
void state;
void position;
void accessibilityHybrid;
void stateHybrid;
void contextual;
void rubric;
void stateValidator;
void batchValidator;
void accessibilityValidator;
void promptBuilder;
void rubricValidation;
