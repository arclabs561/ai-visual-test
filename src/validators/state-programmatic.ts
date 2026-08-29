/**
 * Programmatic State Validator
 * 
 * Fast, deterministic state validation using direct state access and DOM inspection.
 * Use this when you have Playwright page access and direct state access (e.g., window.gameState).
 * 
 * For state extraction from screenshots (when you don't have direct state access), use StateValidator (VLLM-based).
 */

import { ValidationError } from '#errors';
import { assertString, assertObject, assertNumber } from '../type-guards.mjs';

type StateRecord = Record<string, unknown>;

interface BrowserRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface BrowserElement {
  getBoundingClientRect(): BrowserRect;
}

interface VisualStateEntry extends BrowserRect {
  visible: boolean;
}

type VisualState = Record<string, VisualStateEntry | null>;

interface ProgrammaticPage {
  evaluate<T, Argument = undefined>(callback: (argument: Argument) => T | Promise<T>, argument?: Argument): Promise<T>;
}

interface ProgrammaticStateOptions {
  [key: string]: unknown;
  selectors?: Record<string, string>;
  tolerance?: number;
  stateExtractor?: (page: ProgrammaticPage) => unknown | Promise<unknown>;
}

interface ElementPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Validate state matches visual representation
 * 
 * @param {any} page - Playwright page object
 * @param {object} expectedState - Expected state object
 * @param {object} options - Validation options
 * @param {object} options.selectors - Map of state keys to CSS selectors (e.g., { ball: '#game-ball', paddle: '#game-paddle' })
 * @param {number} options.tolerance - Pixel tolerance for position comparison (default: 5)
 * @param {function} options.stateExtractor - Optional function to extract state from page (default: uses window.gameState)
 * @returns {Promise<{matches: boolean, discrepancies: string[], visualState: object, expectedState: object}>}
 * @throws {ValidationError} If page is not a valid Playwright Page object or inputs are invalid
 */
export async function validateStateProgrammatic(
  page: ProgrammaticPage | null | undefined,
  expectedState: StateRecord,
  options: ProgrammaticStateOptions = {},
) {
  // Validate inputs
  if (!page || typeof page.evaluate !== 'function') {
    throw new ValidationError('validateStateProgrammatic requires a Playwright Page object', {
      received: typeof page,
      hasEvaluate: typeof page?.evaluate === 'function'
    });
  }
  
  assertObject(expectedState, 'expectedState');
  
  const selectors = options.selectors || {};
  const tolerance = options.tolerance || 5;
  const stateExtractor = options.stateExtractor || ((targetPage: ProgrammaticPage) => targetPage.evaluate(() => (
    (globalThis as { gameState?: unknown }).gameState || null
  )));
  
  if (typeof tolerance !== 'number' || tolerance < 0 || isNaN(tolerance)) {
    throw new ValidationError('tolerance must be a non-negative number', { received: tolerance });
  }
  
  // Extract state from page
  let gameState;
  if (typeof stateExtractor === 'function') {
    gameState = await stateExtractor(page);
  } else {
    gameState = await page.evaluate(() => (globalThis as { gameState?: unknown }).gameState || null);
  }
  
  // Extract visual state from DOM
  const visualState = await page.evaluate<VisualState, { selectors: Record<string, string> }>(({ selectors }) => {
    const state: VisualState = {};
    const browser = globalThis as unknown as {
      document: { querySelector(selector: string): BrowserElement | null };
      getComputedStyle(element: BrowserElement): { visibility: string; display: string };
    };
    
    for (const [key, selector] of Object.entries(selectors)) {
      const element = browser.document.querySelector(selector);
      if (element) {
        const rect = element.getBoundingClientRect();
        const style = browser.getComputedStyle(element);
        state[key] = {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          visible: rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
        };
      } else {
        state[key] = null;
      }
    }
    
    return state;
  }, { selectors });
  
  // Compare gameState with expectedState
  const discrepancies: string[] = [];
  
  // If we have gameState, compare it with expectedState
  if (gameState && typeof gameState === 'object') {
    compareObjects(gameState, expectedState, '', discrepancies, tolerance);
  }
  
  // Compare visualState with expectedState (for position-based validation)
  if (Object.keys(selectors).length > 0) {
    for (const [key, expected] of Object.entries(expectedState)) {
      if (selectors[key]) {
        const actual = visualState[key];
        if (!actual) {
          discrepancies.push(`${key}: Element not found (selector: ${selectors[key]})`);
          continue;
        }
        
        if (!actual.visible) {
          discrepancies.push(`${key}: Element not visible (selector: ${selectors[key]})`);
          continue;
        }
        
        if (isRecord(expected) && typeof expected.x === 'number') {
          const diff = Math.abs(actual.x - expected.x);
          if (diff > tolerance) {
            discrepancies.push(`${key}.x: Expected ${expected.x}, got ${actual.x} (diff: ${diff}px, tolerance: ${tolerance}px)`);
          }
        }
        
        if (isRecord(expected) && typeof expected.y === 'number') {
          const diff = Math.abs(actual.y - expected.y);
          if (diff > tolerance) {
            discrepancies.push(`${key}.y: Expected ${expected.y}, got ${actual.y} (diff: ${diff}px, tolerance: ${tolerance}px)`);
          }
        }
      }
    }
  }
  
  return {
    matches: discrepancies.length === 0,
    discrepancies,
    visualState,
    expectedState,
    gameState
  };
}

/**
 * Validate element position matches expected position
 * 
 * @param {any} page - Playwright page object
 * @param {string} selector - CSS selector for element
 * @param {object} expectedPosition - Expected position {x, y} or {x, y, width, height}
 * @param {number} tolerance - Pixel tolerance (default: 5)
 * @returns {Promise<{matches: boolean, actual: object, expected: object, diff: object, error?: string}>}
 * @throws {ValidationError} If page is not a valid Playwright Page object or inputs are invalid
 */
export async function validateElementPosition(
  page: ProgrammaticPage | null | undefined,
  selector: string,
  expectedPosition: StateRecord,
  tolerance = 5,
) {
  // Validate inputs
  if (!page || typeof page.evaluate !== 'function') {
    throw new ValidationError('validateElementPosition requires a Playwright Page object', {
      received: typeof page,
      hasEvaluate: typeof page?.evaluate === 'function'
    });
  }
  
  assertString(selector, 'selector');
  assertObject(expectedPosition, 'expectedPosition');
  assertNumber(tolerance, 'tolerance');
  
  if (tolerance < 0 || isNaN(tolerance)) {
    throw new ValidationError('tolerance must be a non-negative number', { received: tolerance });
  }
  
  const actual = await page.evaluate<ElementPosition | null, string>((sel) => {
    const browser = globalThis as unknown as {
      document: { querySelector(selector: string): BrowserElement | null };
    };
    const element = browser.document.querySelector(sel);
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }, selector);
  
  if (!actual) {
    return { matches: false, error: 'Element not found', selector, expected: expectedPosition };
  }
  
  const diff: { x: number; y: number; width?: number; height?: number } = {
    x: Math.abs(actual.x - (typeof expectedPosition.x === 'number' ? expectedPosition.x : 0)),
    y: Math.abs(actual.y - (typeof expectedPosition.y === 'number' ? expectedPosition.y : 0)),
  };
  
  if (typeof expectedPosition.width === 'number') {
    diff.width = Math.abs(actual.width - expectedPosition.width);
  }
  if (typeof expectedPosition.height === 'number') {
    diff.height = Math.abs(actual.height - expectedPosition.height);
  }
  
  const matches = diff.x <= tolerance && diff.y <= tolerance &&
    (typeof expectedPosition.width !== 'number' || (diff.width !== undefined && diff.width <= tolerance)) &&
    (typeof expectedPosition.height !== 'number' || (diff.height !== undefined && diff.height <= tolerance));
  
  return {
    matches,
    actual,
    expected: expectedPosition,
    diff,
    tolerance
  };
}

/**
 * Recursive object comparison helper
 * 
 * @param {unknown} extracted - Extracted state
 * @param {unknown} expected - Expected state
 * @param {string} path - Current path in object tree
 * @param {string[]} discrepancies - Array to collect discrepancies
 * @param {number} tolerance - Pixel tolerance for numeric comparisons
 * @param {number} depth - Current recursion depth (prevents stack overflow)
 */
function compareObjects(extracted: unknown, expected: unknown, path: string, discrepancies: string[], tolerance: number, depth = 0): void {
  // Prevent stack overflow on deeply nested objects
  if (depth > 100) {
    discrepancies.push(`${path}: Maximum comparison depth (100) exceeded - possible circular reference or extremely deep nesting`);
    return;
  }
  
  if (typeof expected !== typeof extracted) {
    discrepancies.push(`${path}: Type mismatch (expected ${typeof expected}, got ${typeof extracted})`);
    return;
  }
  
  if (Array.isArray(expected)) {
    if (!Array.isArray(extracted)) {
      discrepancies.push(`${path}: Expected array, got ${typeof extracted}`);
      return;
    }
    if (expected.length !== extracted.length) {
      discrepancies.push(`${path}: Array length mismatch (expected ${expected.length}, got ${extracted.length})`);
    }
    expected.forEach((item, i) => {
      compareObjects(extracted[i], item, `${path}[${i}]`, discrepancies, tolerance, depth + 1);
    });
  } else if (isRecord(expected) && isRecord(extracted)) {
    const allKeys = new Set([...Object.keys(expected), ...Object.keys(extracted)]);
    allKeys.forEach(key => {
      const newPath = path ? `${path}.${key}` : key;
      if (!(key in expected)) {
        discrepancies.push(`${newPath}: Unexpected key in extracted state`);
      } else if (!(key in extracted)) {
        discrepancies.push(`${newPath}: Missing key in extracted state`);
      } else {
        compareObjects(extracted[key], expected[key], newPath, discrepancies, tolerance, depth + 1);
      }
    });
  } else if (typeof expected === 'number' && typeof extracted === 'number') {
    // Handle NaN values
    if (isNaN(expected) || isNaN(extracted)) {
      if (!(isNaN(expected) && isNaN(extracted))) {
        discrepancies.push(`${path}: NaN value detected (expected ${expected}, got ${extracted})`);
      }
      return;
    }
    
    // Handle Infinity values
    if (!isFinite(expected) || !isFinite(extracted)) {
      if (expected !== extracted) {
        discrepancies.push(`${path}: Infinity value mismatch (expected ${expected}, got ${extracted})`);
      }
      return;
    }
    
    const diff = Math.abs(extracted - expected);
    if (diff > tolerance) {
      discrepancies.push(`${path}: Value differs by ${diff} (expected ${expected}, got ${extracted}, tolerance: ${tolerance})`);
    }
  } else if (extracted !== expected) {
    discrepancies.push(`${path}: Value mismatch (expected ${expected}, got ${extracted})`);
  }
}

function isRecord(value: unknown): value is StateRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
