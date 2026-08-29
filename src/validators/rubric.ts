/**
 * Rubric System
 * 
 * Generic rubric-based validation with zero tolerance support
 * 
 * Provides:
 * - Rubric-based validation
 * - Zero tolerance violation enforcement
 * - Research-enhanced validation integration
 */

import { validateWithResearchEnhancements } from '#research-enhanced-validation';
import { PromptBuilder } from './prompt-builder.js';
import { ValidationError } from '#errors';
import { assertString, assertObject } from '../type-guards.mjs';
import type { Rubric, ValidationContext, ValidationResult } from '#public-contract';

interface RubricCriterion {
  id: string;
  zeroTolerance?: boolean;
  [key: string]: unknown;
}

type ValidationRubric = Rubric & { criteria?: RubricCriterion[] };
type RubricOptions = ValidationContext & { enforceZeroTolerance?: boolean };

/**
 * Validate with rubric (generic, not project-specific)
 */
export async function validateWithRubric(
  screenshotPath: string,
  prompt: string,
  rubric: ValidationRubric,
  context: ValidationContext = {},
  options: RubricOptions = {},
): Promise<ValidationResult & { zeroToleranceViolation?: boolean }> {
  // Input validation
  assertString(screenshotPath, 'screenshotPath');
  assertString(prompt, 'prompt');
  assertObject(rubric, 'rubric');
  
  if (!rubric.score || !rubric.score.criteria) {
    throw new ValidationError(
      'Rubric must have score.criteria property',
      { rubric: Object.keys(rubric) }
    );
  }
  
  const builder = new PromptBuilder({ rubric });
  const enhancedPrompt = builder.buildPrompt(prompt, {
    enforceZeroTolerance: options.enforceZeroTolerance !== false,
    ...options
  });
  
  try {
    const result = await validateWithResearchEnhancements(
      screenshotPath,
      enhancedPrompt,
      {
        ...context,
        rubric,
        testType: context.testType || 'rubric-validation'
      }
    );
  
    // Check for zero tolerance violations if rubric has them
    const hasZeroTolerance = rubric.criteria?.some((criterion) => criterion.zeroTolerance) || false;
    if (hasZeroTolerance && options.enforceZeroTolerance !== false) {
      // Ensure issues is an array before calling .some()
      const issues = Array.isArray(result.issues) ? result.issues : [];
      const hasZeroToleranceViolation = issues.some((issue) =>
        typeof issue === 'string' && (
          issue.toLowerCase().includes('zero tolerance') ||
          issue.toLowerCase().includes('instant fail') ||
          rubric.criteria?.some((criterion) => criterion.zeroTolerance && issue.includes(criterion.id))
        )
      );
      
      if (hasZeroToleranceViolation) {
        return {
          ...result,
          score: 0,
          assessment: 'fail',
          zeroToleranceViolation: true
        };
      }
    }
    
    return result;
  } catch (error: unknown) {
    // Re-throw ValidationError as-is, wrap others
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError(
      `Rubric validation failed: ${error instanceof Error ? error.message : String(error)}`,
      {
        screenshotPath,
        rubricName: typeof rubric.name === 'string' ? rubric.name : undefined,
        originalError: error instanceof Error ? error.message : String(error),
      }
    );
  }
}
