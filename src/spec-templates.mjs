/**
 * Natural Language Spec Templates
 * 
 * Reusable templates for common testing patterns based on real-world BDD usage.
 * Supports template inheritance and composition.
 * 
 * Based on research findings:
 * - Real-world BDD patterns (Cucumber, SpecFlow, Behave)
 * - Real-world usage patterns (200+ tests)
 * - Best practices (scenario independence, domain language, living documentation)
 */

import { log } from './logger.mjs';
import { ValidationError } from './errors.mjs';

/**
 * Built-in templates for common patterns
 */
export const TEMPLATES = {
  /**
   * Game Testing Template
   * Based on real-world interactive game patterns
   */
  game: {
    name: 'Game Testing',
    description: 'Template for testing interactive games with activation keys',
    spec: `Given I visit {url}
When I activate the game (press '{activationKey}'{selector})
Then the game should be playable
{goals}
Context: viewport={viewport}, device={device}{temporal}`,
    variables: {
      url: 'game.example.com',
      activationKey: 'g',
      selector: '',
      viewport: '1280x720',
      device: 'desktop',
      goals: '',
      temporal: ''
    },
    examples: [
      {
        name: 'Basic Game',
        values: {
          url: 'example.com',
          activationKey: 'g',
          selector: ', selector: #game-paddle'
        }
      },
      {
        name: 'Game with Temporal',
        values: {
          url: 'game.example.com',
          activationKey: 'g',
          selector: ', selector: #game-element',
          temporal: ', fps: 2, duration: 10 seconds, temporal: true'
        }
      }
    ]
  },
  
  /**
   * Accessibility Template
   */
  accessibility: {
    name: 'Accessibility Testing',
    description: 'Template for accessibility validation',
    spec: `Given I visit {url}{persona}
When the page loads
Then it should be accessible
{checks}
Context: viewport={viewport}, device={device}`,
    variables: {
      url: 'example.com',
      persona: '',
      viewport: '1280x720',
      device: 'desktop',
      checks: 'And contrast should meet WCAG standards'
    },
    examples: [
      {
        name: 'Basic Accessibility',
        values: {
          url: 'example.com'
        }
      },
      {
        name: 'Accessibility with Persona',
        values: {
          url: 'example.com',
          persona: ' as a visually impaired user'
        }
      }
    ]
  },
  
  /**
   * Browser Experience Template
   */
  browser_experience: {
    name: 'Browser Experience',
    description: 'Template for complete user journey testing',
    spec: `Given I visit {url}
{steps}
Then {outcome}
Context: viewport={viewport}, device={device}`,
    variables: {
      url: 'example.com',
      steps: 'When the page loads',
      outcome: 'the page should be usable',
      viewport: '1280x720',
      device: 'desktop'
    },
    examples: [
      {
        name: 'E-commerce Journey',
        values: {
          url: 'shop.example.com',
          steps: `When I browse products
And I add items to cart
And I proceed to checkout`,
          outcome: 'the checkout form should be usable'
        }
      }
    ]
  },
  
  /**
   * State Validation Template
   */
  state_validation: {
    name: 'State Validation',
    description: 'Template for validating state consistency',
    spec: `Given {initialState}
When {action}
Then the state should be consistent
{checks}
Context: viewport={viewport}`,
    variables: {
      initialState: 'I visit a page',
      action: 'the state changes',
      checks: 'And the visual representation should match the internal state',
      viewport: '1280x720'
    },
    examples: [
      {
        name: 'Game State',
        values: {
          initialState: 'I play a game',
          action: 'the game state changes',
          checks: 'And cleared elements should be visually removed'
        }
      }
    ]
  },
  
  /**
   * Temporal Sequence Template
   */
  temporal: {
    name: 'Temporal Sequence',
    description: 'Template for testing sequences over time',
    spec: `Given {initial}
When I observe {target} for {duration}
Then {expected}
Context: fps={fps}, duration={duration} seconds, temporal: true`,
    variables: {
      initial: 'I visit a page with animations',
      target: 'the page',
      duration: '5',
      fps: '2',
      expected: 'animations should be smooth'
    },
    examples: [
      {
        name: 'Animation Validation',
        values: {
          initial: 'I visit a page with animations',
          target: 'the page',
          duration: '5',
          fps: '2',
          expected: 'animations should be smooth'
        }
      }
    ]
  },
  
  /**
   * Property-Based Template
   */
  property: {
    name: 'Property-Based Testing',
    description: 'Template for property/invariant testing',
    spec: 'For all {scope}, {property}',
    variables: {
      scope: 'screenshots',
      property: 'the validation score should be between 0 and 10'
    },
    examples: [
      {
        name: 'Score Range',
        values: {
          scope: 'screenshots',
          property: 'the validation score should be between 0 and 10'
        }
      },
      {
        name: 'State Consistency',
        values: {
          scope: 'game states',
          property: 'the visual representation should match the internal state'
        }
      }
    ]
  }
};

/**
 * Create a spec from a template
 */
export function createSpecFromTemplate(templateName, variables = {}) {
  const template = TEMPLATES[templateName];
  
  if (!template) {
    throw new ValidationError(
      `Template "${templateName}" not found. ` +
      `Available templates: ${Object.keys(TEMPLATES).join(', ')}. ` +
      `Use listTemplates() to see all available templates, or registerTemplate() to create a custom one.`,
      {
        templateName,
        availableTemplates: Object.keys(TEMPLATES),
        function: 'createSpecFromTemplate'
      }
    );
  }
  
  // Merge template variables with provided variables
  const mergedVars = {
    ...template.variables,
    ...variables
  };
  
  // Replace variables in spec
  let spec = template.spec;
  for (const [key, value] of Object.entries(mergedVars)) {
    const placeholder = `{${key}}`;
    spec = spec.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), String(value));
  }
  
  return spec;
}

/**
 * Compose multiple templates
 */
export function composeTemplates(templates, composition = 'sequential') {
  if (composition === 'sequential') {
    // Sequential: execute one after another
    return templates.map(t => t.spec).join('\n\n');
  } else if (composition === 'parallel') {
    // Parallel: execute all (would need execution framework support)
    return templates.map(t => t.spec).join('\n\n---\n\n');
  } else {
    throw new ValidationError(
      `Unknown composition type: "${composition}". ` +
      `Supported types: "sequential" (execute one after another) or "parallel" (execute all).`,
      {
        composition,
        supportedTypes: ['sequential', 'parallel'],
        function: 'composeTemplates'
      }
    );
  }
}

/**
 * Inherit from a base template
 */
export function inheritTemplate(baseTemplateName, overrides = {}) {
  const base = TEMPLATES[baseTemplateName];
  
  if (!base) {
    throw new ValidationError(
      `Base template "${baseTemplateName}" not found. ` +
      `Available templates: ${Object.keys(TEMPLATES).join(', ')}. ` +
      `Use listTemplates() to see all available templates.`,
      {
        baseTemplateName,
        availableTemplates: Object.keys(TEMPLATES),
        function: 'inheritTemplate'
      }
    );
  }
  
  return {
    ...base,
    ...overrides,
    variables: {
      ...base.variables,
      ...(overrides.variables || {})
    }
  };
}

/**
 * Register a custom template
 */
export function registerTemplate(name, template) {
  if (!template.name || !template.spec || !template.variables) {
    throw new ValidationError(
      'Template must have name, spec, and variables properties. ' +
      'Template structure: { name: string, spec: string, variables: object }. ' +
      'All three properties are required for template registration.',
      {
        hasName: !!template.name,
        hasSpec: !!template.spec,
        hasVariables: !!template.variables,
        function: 'registerTemplate'
      }
    );
  }
  
  TEMPLATES[name] = template;
  log(`[SpecTemplates] Registered custom template: ${name}`);
}

/**
 * List available templates
 */
export function listTemplates() {
  return Object.keys(TEMPLATES).map(name => ({
    name,
    ...TEMPLATES[name]
  }));
}

/**
 * Get template by name
 */
export function getTemplate(name) {
  const template = TEMPLATES[name];
  
  if (!template) {
    throw new ValidationError(
      `Template "${name}" not found. ` +
      `Available templates: ${Object.keys(TEMPLATES).join(', ')}. ` +
      `Use listTemplates() to see all available templates, or registerTemplate() to create a custom one.`,
      {
        templateName: name,
        availableTemplates: Object.keys(TEMPLATES),
        function: 'getTemplate'
      }
    );
  }
  
  return template;
}

/**
 * Validate template structure
 */
export function validateTemplate(template) {
  const errors = [];
  
  if (!template.name) {
    errors.push('Template must have a name');
  }
  
  if (!template.spec) {
    errors.push('Template must have a spec');
  }
  
  if (!template.variables || typeof template.variables !== 'object') {
    errors.push('Template must have variables object');
  }
  
  // Check that all placeholders in spec have corresponding variables
  const placeholders = template.spec.match(/\{(\w+)\}/g) || [];
  const placeholderNames = placeholders.map(p => p.slice(1, -1));
  const variableNames = Object.keys(template.variables || {});
  
  for (const placeholder of placeholderNames) {
    if (!variableNames.includes(placeholder)) {
      errors.push(`Placeholder {${placeholder}} in spec has no corresponding variable`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

