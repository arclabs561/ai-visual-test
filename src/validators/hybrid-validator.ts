/**
 * Hybrid Validator
 * 
 * Combines programmatic validation with VLLM evaluation.
 * Programmatic data provides ground truth, VLLM provides semantic reasoning.
 * 
 * This follows the PROVE framework pattern: programmatic verification + LLM evaluation.
 */

import { validateScreenshot } from '#judge';
import { ValidationError } from '#errors';
import type { HybridValidationResult, ValidationContext, ValidationResult } from '#public-contract';
import { assertString, assertObject } from '../type-guards.js';
import {
  checkAllTextContrast,
  checkKeyboardNavigation
} from './accessibility-programmatic.js';
import {
  validateStateProgrammatic
} from './state-programmatic.js';

type HybridOptions = ValidationContext & {
  selectors?: Record<string, string>;
  tolerance?: number;
};

type HybridPage = {
  evaluate<T, Argument = undefined>(callback: (argument: Argument) => T | Promise<T>, argument?: Argument): Promise<T>;
};

type ContrastViolation = {
  element: string;
  ratio: string;
  required: number;
  foreground: string;
  background: string;
};

type KeyboardViolation = { element: string; issue: string };

type AccessibilityProgrammaticData = Record<string, unknown> & {
  contrast: {
    total: number;
    passing: number;
    failing: number;
    violations: ContrastViolation[];
  };
  keyboard: {
    focusableElements: number;
    violations: KeyboardViolation[];
  };
};

type StateProgrammaticData = Record<string, unknown> & {
  gameState: unknown;
  visualState: Record<string, unknown>;
  discrepancies: string[];
  matches: boolean;
};

type InjectedValidateScreenshot = typeof validateScreenshot;

// Allow dependency injection for testing.
let injectedValidateScreenshot: InjectedValidateScreenshot | null = null;

/**
 * Inject validateScreenshot function for testing
 * @internal
 * @param {Function} fn - Mock validateScreenshot function
 */
export function _injectValidateScreenshot(fn: InjectedValidateScreenshot): void {
  injectedValidateScreenshot = fn;
}

/**
 * Reset injected function
 * @internal
 */
export function _resetValidateScreenshot(): void {
  injectedValidateScreenshot = null;
}

function getValidateScreenshot(): InjectedValidateScreenshot {
  return injectedValidateScreenshot || validateScreenshot;
}

function deduplicateIssues(issues: unknown[]): unknown[] {
  const seen = new Set<string>();
  return issues.filter(issue => {
    const key = typeof issue === 'string' ? issue : JSON.stringify(issue);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function formatIssue(issue: unknown): string {
  if (typeof issue === 'string') return issue;
  if (typeof issue === 'object' && issue !== null) {
    const record = issue as Record<string, unknown>;
    if (typeof record.description === 'string') return record.description;
    if (typeof record.element === 'string' && typeof record.issue === 'string') {
      return `${record.element}: ${record.issue}`;
    }
    if (record.ratio !== undefined && record.required !== undefined) {
      return `Contrast ${String(record.ratio)}:1 (required: ${String(record.required)}:1)`;
    }
    if (typeof record.message === 'string') return record.message;
    return JSON.stringify(record);
  }
  return String(issue);
}

export type HybridContextResult = ValidationResult & {
  programmaticData: Record<string, unknown>;
  method: 'hybrid';
};

/**
 * Hybrid accessibility validation
 * 
 * Combines programmatic contrast/keyboard checks with VLLM semantic evaluation.
 * Programmatic data provides ground truth, VLLM evaluates context and criticality.
 * 
 * @param {any} page - Playwright page object
 * @param {string} screenshotPath - Path to screenshot
 * @param {number} minContrast - Minimum contrast ratio (default: 4.5)
 * @param {object} options - Validation options
 * @returns {Promise<import('#public-contract').HybridValidationResult>}
 * @throws {ValidationError} If inputs are invalid
 */
export async function validateAccessibilityHybrid(
  page: HybridPage | null | undefined,
  screenshotPath: string,
  minContrast = 4.5,
  options: HybridOptions = {}
): Promise<HybridValidationResult> {
  // Validate inputs
  if (!page || typeof page.evaluate !== 'function') {
    throw new ValidationError('validateAccessibilityHybrid requires a Playwright Page object', {
      received: typeof page,
      hasEvaluate: typeof page?.evaluate === 'function'
    });
  }
  
  assertString(screenshotPath, 'screenshotPath');
  
  if (typeof minContrast !== 'number' || minContrast < 1 || minContrast > 21) {
    throw new ValidationError('minContrast must be a number between 1 and 21', {
      received: minContrast
    });
  }
  
  // Extract programmatic data
  const programmaticData: AccessibilityProgrammaticData = {
    contrast: await checkAllTextContrast(page, minContrast) as AccessibilityProgrammaticData['contrast'],
    keyboard: await checkKeyboardNavigation(page) as AccessibilityProgrammaticData['keyboard']
  };
  
  // Build prompt with programmatic context
  const prompt = `
ACCESSIBILITY EVALUATION

PROGRAMMATIC DATA (GROUND TRUTH):
- Contrast: ${programmaticData.contrast.passing}/${programmaticData.contrast.total} elements pass (required: ${minContrast}:1)
- Violations: ${programmaticData.contrast.failing} elements fail
${programmaticData.contrast.violations.length > 0 ? `
  Top violations:
${programmaticData.contrast.violations.slice(0, 5).map(v => `  - ${v.element}: ${v.ratio}:1 (required: ${v.required}:1)`).join('\n')}
` : ''}
- Keyboard: ${programmaticData.keyboard.focusableElements} focusable elements
${programmaticData.keyboard.violations.length > 0 ? `
  Violations:
${programmaticData.keyboard.violations.map(v => `  - ${v.element}: ${v.issue}`).join('\n')}
` : ''}

EVALUATION TASK:
Use this programmatic data as ground truth (no hallucinations about measurements).
Evaluate semantic aspects:
1. Is contrast adequate for readability in context? (ratio alone doesn't tell you if it's readable)
2. Are contrast violations critical or minor? (some violations might be acceptable in context)
3. Is keyboard navigation usable? (semantic evaluation beyond just focusable elements)
4. Does overall accessibility support user goals? (holistic evaluation)
5. Are there accessibility issues that programmatic checks don't capture? (visual, semantic, contextual)

Provide actionable recommendations based on both programmatic and semantic analysis.
`;
  
  // VLLM evaluation with programmatic grounding
  const result = await getValidateScreenshot()(screenshotPath, prompt, {
    testType: options.testType || 'accessibility-hybrid',
    minContrast,
    ...options,
    programmaticData
  });
  
  // Calculate programmatic pass status
  const programmaticPassed = (programmaticData.contrast.failing === 0) && 
                             (programmaticData.keyboard.violations.length === 0);

  // Combine results
  const combined: HybridValidationResult = {
    ...result,
    passed: programmaticPassed && (result.score === null || result.score >= 6),
    programmaticData, // Required by tests/consumers
    programmatic: programmaticData, // Alias for clarity
    semantic: result,
    method: 'hybrid',
    issues: [
      ...(programmaticData.contrast.violations || []),
      ...(programmaticData.keyboard.violations || []),
      ...result.issues || []
    ],
    uniqueIssues: deduplicateIssues([
      ...(programmaticData.contrast.violations || []),
      ...(programmaticData.keyboard.violations || []),
      ...(result.issues || [])
    ]).map(formatIssue)
  };
  return combined;
}

/**
 * Hybrid state validation
 * 
 * Combines programmatic state extraction with VLLM semantic evaluation.
 * Programmatic data provides ground truth, VLLM evaluates visual consistency and context.
 * 
 * @param {any} page - Playwright page object
 * @param {string} screenshotPath - Path to screenshot
 * @param {object} expectedState - Expected state object
 * @param {object} options - Validation options
 * @param {object} options.selectors - Map of state keys to CSS selectors
 * @param {number} options.tolerance - Pixel tolerance (default: 5)
 * @returns {Promise<import('#public-contract').HybridValidationResult>}
 * @throws {ValidationError} If inputs are invalid
 */
export async function validateStateHybrid(
  page: HybridPage | null | undefined,
  screenshotPath: string,
  expectedState: Record<string, unknown>,
  options: HybridOptions = {}
): Promise<HybridContextResult> {
  // Validate inputs
  if (!page || typeof page.evaluate !== 'function') {
    throw new ValidationError('validateStateHybrid requires a Playwright Page object', {
      received: typeof page,
      hasEvaluate: typeof page?.evaluate === 'function'
    });
  }
  
  assertString(screenshotPath, 'screenshotPath');
  assertObject(expectedState, 'expectedState');
  
  const selectors = options.selectors || {};
  const tolerance = options.tolerance || 5;
  
  // Extract programmatic state
  // Note: validateStateProgrammatic will extract gameState internally if available
  // We also extract it separately for the prompt
  const gameState = await page.evaluate(() => (globalThis as typeof globalThis & { gameState?: unknown }).gameState || null);
  
  // validateStateProgrammatic doesn't throw by default, it returns matches: false
  const visualState = await validateStateProgrammatic(
    page,
    expectedState,
    { selectors, tolerance }
  );
  
  // visualState already includes gameState if extracted, but we want it in programmaticData too
  
  const programmaticData: StateProgrammaticData = {
    gameState,
    visualState: visualState.visualState,
    discrepancies: visualState.discrepancies,
    matches: visualState.matches
  };
  
  // Build prompt with programmatic context
  const prompt = `
STATE CONSISTENCY EVALUATION

PROGRAMMATIC DATA (GROUND TRUTH):
${gameState ? `Game State: ${JSON.stringify(gameState, null, 2)}` : 'Game State: Not available'}
Visual State: ${JSON.stringify(visualState.visualState, null, 2)}
Expected State: ${JSON.stringify(expectedState, null, 2)}
${visualState.discrepancies.length > 0 ? `
Discrepancies: ${visualState.discrepancies.join(', ')}
` : 'No discrepancies found (programmatic check passed)'}

EVALUATION TASK:
Use this programmatic data as ground truth (no hallucinations about positions/state).
Evaluate semantic aspects:
1. Does visual representation match programmatic state? (semantic check beyond exact positions)
2. Is game state consistent with gameplay? (context-aware evaluation)
3. Are there visual bugs that state data doesn't capture? (holistic evaluation)
4. Is the state transition smooth and coherent? (temporal/contextual evaluation)
5. Are discrepancies critical or acceptable? (context-aware criticality assessment)

Provide actionable recommendations based on both programmatic and semantic analysis.
`;
  
  // VLLM evaluation with programmatic grounding
  const result = await getValidateScreenshot()(screenshotPath, prompt, {
    testType: options.testType || 'state-hybrid',
    expectedState,
    ...options,
    programmaticData
  });
  
  return {
    ...result,
    programmaticData,
    method: 'hybrid'
  };
}

/**
 * Generic hybrid validator helper
 * 
 * Combines any programmatic data with VLLM evaluation.
 * 
 * @param {string} screenshotPath - Path to screenshot
 * @param {string} prompt - Base evaluation prompt
 * @param {object} programmaticData - Programmatic validation data
 * @param {object} options - Validation options
 * @returns {Promise<import('#public-contract').HybridValidationResult>}
 */
export async function validateWithProgrammaticContext(
  screenshotPath: string,
  prompt: string,
  programmaticData: Record<string, unknown>,
  options: HybridOptions = {}
): Promise<HybridContextResult> {
  assertString(screenshotPath, 'screenshotPath');
  assertString(prompt, 'prompt');
  assertObject(programmaticData, 'programmaticData');
  
  // Build enhanced prompt with programmatic context
  const enhancedPrompt = `
${prompt}

PROGRAMMATIC DATA (GROUND TRUTH):
${JSON.stringify(programmaticData, null, 2)}

EVALUATION INSTRUCTIONS:
- Use programmatic data as ground truth (no hallucinations about measurements)
- Evaluate semantic aspects: context, criticality, usability, consistency
- Report any discrepancies between programmatic data and visual appearance
- Provide actionable recommendations based on both programmatic and semantic analysis
`;
  
  const result = await getValidateScreenshot()(screenshotPath, enhancedPrompt, {
    ...options,
    programmaticData
  });
  
  return {
    ...result,
    programmaticData,
    method: 'hybrid'
  };
}
