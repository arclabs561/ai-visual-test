/**
 * Prompt Builder
 * 
 * Template-based prompt construction with rubric integration
 * 
 * Provides:
 * - Reusable prompt templates
 * - Rubric integration
 * - Context injection
 * - Variable substitution
 */

import { buildRubricPrompt } from '../rubrics.js';
import { ValidationError } from '#errors';
import type { Rubric as PublicRubric } from '#public-contract';

type TemplateVariables = Record<string, unknown>;
type Template = string | ((variables: TemplateVariables) => string);
type Templates = Record<string, Template>;

interface RubricCriterion {
  id: string;
  zeroTolerance?: boolean;
  [key: string]: unknown;
}

type PromptRubric = PublicRubric & { criteria?: RubricCriterion[] };

export interface PromptBuilderOptions {
  templates?: Templates;
  rubric?: PromptRubric | null;
  defaultContext?: Record<string, unknown>;
}

export interface PromptOptions {
  rubric?: PromptRubric | null;
  includeZeroTolerance?: boolean;
  includeScoring?: boolean;
  enforceZeroTolerance?: boolean;
  context?: Record<string, unknown>;
  skipRubric?: boolean;
  [key: string]: unknown;
}

/**
 * Generic prompt builder with template support
 */
export class PromptBuilder {
  templates: Templates;
  rubric: PromptRubric | null;
  defaultContext: Record<string, unknown>;

  constructor(options: PromptBuilderOptions = {}) {
    // Validate templates
    if (options.templates !== undefined) {
      if (typeof options.templates !== 'object' || options.templates === null || Array.isArray(options.templates)) {
        throw new ValidationError(
          'templates must be a non-null object',
          { received: typeof options.templates }
        );
      }
      this.templates = options.templates as Templates;
    } else {
      this.templates = {};
    }
    
    this.rubric = options.rubric || null;
    
    // Validate defaultContext
    if (options.defaultContext !== undefined) {
      if (typeof options.defaultContext !== 'object' || options.defaultContext === null || Array.isArray(options.defaultContext)) {
        throw new ValidationError(
          'defaultContext must be a non-null object',
          { received: typeof options.defaultContext }
        );
      }
      this.defaultContext = options.defaultContext as Record<string, unknown>;
    } else {
      this.defaultContext = {};
    }
  }

  /**
   * Build prompt with optional rubric
   */
  buildPrompt(basePrompt: string, options: PromptOptions = {}): string {
    let prompt = basePrompt;
    
    // Add rubric if provided
    const rubric = options.rubric || this.rubric;
    if (rubric) {
      // `buildRubricPrompt` takes its rubric as the first argument and the
      // dimensions switch as the second. The legacy option object was truthy,
      // so passing `true` preserves its emitted prompt exactly.
      const rubricPrompt = buildRubricPrompt(rubric, true);
      prompt = `${prompt}\n\n${rubricPrompt}`;
      
      // Add zero tolerance enforcement if applicable
      if (options.enforceZeroTolerance !== false && rubric.criteria?.some(c => c.zeroTolerance)) {
        prompt = `${prompt}\n\nZERO TOLERANCE ENFORCEMENT:
Any zero tolerance violation results in automatic failure.
Score is automatically set to 0 if any zero tolerance violation is detected.`;
      }
    }
    
    // Add context if provided
    if (options.context || this.defaultContext) {
      const context = { ...this.defaultContext, ...options.context };
      if (Object.keys(context).length > 0) {
        prompt = `${prompt}\n\nCONTEXT:
${JSON.stringify(context, null, 2)}`;
      }
    }
    
    return prompt;
  }

  /**
   * Build prompt from template with support for conditionals and loops
   * 
   * Supports:
   * - Variables: {{variable}}
   * - Conditionals: {{#if condition}}...{{/if}}, {{#unless condition}}...{{/unless}}
   * - Loops: {{#each items}}...{{/each}}
   * - Nested templates: {{>templateName}}
   */
  buildFromTemplate(templateName: string, variables: TemplateVariables = {}, options: PromptOptions = {}): string {
    const template = this.templates[templateName];
    if (!template) {
      throw new ValidationError(
        `Template "${templateName}" not found. Available templates: ${Object.keys(this.templates).join(', ') || 'none'}`,
        { templateName, availableTemplates: Object.keys(this.templates) }
      );
    }
    
    // Get template string
    let templateStr: string = typeof template === 'function'
      ? template(variables)
      : template;
    
    // Process nested templates (partials) first: {{>templateName}}
    templateStr = templateStr.replace(/\{\{>([^}]+)\}\}/g, (match: string, partialName: string) => {
      const trimmedName = partialName.trim();
      if (this.templates[trimmedName]) {
        return this.buildFromTemplate(trimmedName, variables, { ...options, skipRubric: true });
      }
      return match; // Return original if partial not found
    });
    
    // Process loops: {{#each items}}...{{/each}}
    // Need to process nested conditionals inside loops, so we need to handle this carefully
    templateStr = templateStr.replace(/\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (match: string, arrayKey: string, loopBody: string) => {
      const trimmedKey = arrayKey.trim();
      const array = variables[trimmedKey];
      if (Array.isArray(array)) {
        return array.map((item: unknown, index: number) => {
          const itemVars: TemplateVariables = {
            ...variables, 
            '@index': index, 
            '@first': index === 0, 
            '@last': index === array.length - 1 
          };
          // If item is an object, merge its properties
          if (typeof item === 'object' && item !== null) {
            Object.assign(itemVars, item);
          } else {
            itemVars['@value'] = item;
          }
          // Process the loop body with item variables, including nested conditionals
          let processedBody = loopBody;
          // Process nested conditionals in loop body
          processedBody = processedBody.replace(/\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_match: string, condKey: string, body: string) => {
            const trimmedCond = condKey.trim();
            const condValue = itemVars[trimmedCond];
            const isTruthy = condValue !== undefined && condValue !== null && condValue !== false && condValue !== '';
            return isTruthy ? this._processTemplate(body, itemVars) : '';
          });
          return this._processTemplate(processedBody, itemVars);
        }).join('');
      }
      return ''; // Return empty if not an array
    });
    
    // Process conditionals: {{#if condition}}...{{else}}...{{/if}} and {{#unless condition}}...{{/unless}}
    templateStr = templateStr.replace(/\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_match: string, conditionKey: string, body: string) => {
      const trimmedKey = conditionKey.trim();
      const value = variables[trimmedKey];
      const isTruthy = value !== undefined && value !== null && value !== false && value !== '';
      
      // Check for {{else}} block
      const elseMatch = body.match(/^([\s\S]*?)\{\{else\}\}([\s\S]*)$/);
      if (elseMatch) {
        const trueBody = elseMatch[1] ?? '';
        const falseBody = elseMatch[2] ?? '';
        return isTruthy 
          ? this._processTemplate(trueBody, variables)
          : this._processTemplate(falseBody, variables);
      }
      
      return isTruthy ? this._processTemplate(body, variables) : '';
    });
    
    templateStr = templateStr.replace(/\{\{#unless\s+([^}]+)\}\}([\s\S]*?)\{\{\/unless\}\}/g, (_match: string, conditionKey: string, body: string) => {
      const trimmedKey = conditionKey.trim();
      const value = variables[trimmedKey];
      const isFalsy = value === undefined || value === null || value === false || value === '';
      return isFalsy ? this._processTemplate(body, variables) : '';
    });
    
    // Process variables: {{variable}}
    let prompt = this._processTemplate(templateStr, variables);
    
    // Apply rubric and context (unless skipRubric is set for nested templates)
    if (options.skipRubric) {
      return prompt;
    }
    return this.buildPrompt(prompt, options);
  }

  /**
   * Internal method to process template variables
   * @private
   */
  _processTemplate(templateStr: string, variables: TemplateVariables): string {
    return templateStr.replace(/\{\{([^}]+)\}\}/g, (match: string, key: string) => {
      const trimmedKey = key.trim();
      // Support dot notation: {{object.property}}
      if (trimmedKey.includes('.')) {
        const parts = trimmedKey.split('.');
        let value: unknown = variables;
        for (const part of parts) {
          if (value && typeof value === 'object' && part in value) {
            value = (value as Record<string, unknown>)[part];
          } else {
            return match; // Return original if path not found
          }
        }
        return value !== undefined ? String(value) : match;
      }
      return variables[trimmedKey] !== undefined ? String(variables[trimmedKey]) : match;
    });
  }

  /**
   * Register a template
   */
  registerTemplate(name: string, template: Template): void {
    this.templates[name] = template;
  }
}
