# Natural Language Specs Integration Guide

## Overview

The natural language specs system is fully integrated with the library's configuration and API patterns. This document explains how to use and customize it.

## Configuration

### Per-Project Configuration

Configure spec behavior per project using `createSpecConfig`:

```javascript
import { createSpecConfig, setSpecConfig } from 'ai-visual-test';

// Configure for your project
const config = createSpecConfig({
  useLLM: true,              // Use LLM for context extraction
  fallback: 'regex',         // Fallback to regex if LLM fails
  validateBeforeExecute: true, // Validate specs before execution
  strictValidation: false,   // Throw on validation errors (default: warn)
  enableErrorAnalysis: true,  // Enable error analysis
  timeout: 30000             // Execution timeout
});

setSpecConfig(config);
```

### Environment Variables

Configure via environment variables:

```bash
export SPEC_USE_LLM=true
export SPEC_VALIDATE_BEFORE_EXECUTE=true
export SPEC_STRICT_VALIDATION=false
export SPEC_TEMPLATE_DIR=./my-templates
```

### Per-Test Configuration

Override config per test:

```javascript
import { executeSpec } from 'ai-visual-test';

// Override config for this test
await executeSpec(page, spec, {
  validate: false,  // Skip validation for this test
  useLLM: false     // Use regex fallback for this test
});
```

## API Integration

### Exported Functions

All natural language spec functions are exported from the main package:

```javascript
import {
  // Core functions
  parseSpec,
  executeSpec,
  validateSpec,
  
  // Templates
  createSpecFromTemplate,
  listTemplates,
  registerTemplate,
  
  // Configuration
  createSpecConfig,
  getSpecConfig,
  setSpecConfig
} from 'ai-visual-test';
```

### Integration with Existing APIs

Natural language specs integrate seamlessly with existing validation APIs:

```javascript
import { executeSpec, validateScreenshot, testGameplay } from 'ai-visual-test';

// Spec automatically maps to appropriate interface
const spec = `
  Given I visit game.example.com
  When I activate the game
  Then the game should be fun
`;

// Maps to testGameplay() internally
await executeSpec(page, spec);
```

## Customization Points

### 1. Custom Templates

Register project-specific templates:

```javascript
import { registerTemplate } from 'ai-visual-test';

registerTemplate('my-project', {
  name: 'My Project Template',
  spec: `
    Given I visit {url}
    When I {action}
    Then {expected}
  `,
  variables: {
    url: 'example.com',
    action: 'do something',
    expected: 'something happens'
  }
});

// Use it
const spec = createSpecFromTemplate('my-project', {
  url: 'my-site.com',
  action: 'test the feature',
  expected: 'it works'
});
```

### 2. Custom Error Analysis

Extend error analysis for your project:

```javascript
import { analyzeSpecQuality } from 'ai-visual-test';
import { runErrorAnalysis } from './evaluation/utils/spec-error-analysis.mjs';

// Analyze spec quality
const quality = analyzeSpecQuality(spec);
console.log(`Quality: ${quality.score}/100`);

// Run comprehensive error analysis
const report = await runErrorAnalysis(specs, {
  saveReport: true,
  outputPath: './my-error-report.json'
});
```

### 3. Custom Context Extraction

Override context extraction:

```javascript
import { parseSpec } from 'ai-visual-test';

// Pass custom extraction options
const parsed = await parseSpec(spec, {
  useLLM: true,
  provider: 'openai',  // Use specific provider
  fallback: 'regex'    // Fallback strategy
});
```

## Research Integration

The natural language specs system aligns with:

1. **BDD Best Practices**: Given/When/Then structure, scenario independence, domain language
2. **AI-Powered Testing**: LLM-based parsing, semantic understanding
3. **Real-World Patterns**: Based on queeraoke usage (200+ tests)

See `docs/RESEARCH_COMPARISON.md` for detailed comparison.

## Library Design Principles

The implementation follows the library's design principles:

1. **Configurable**: Use `createSpecConfig` to customize per project
2. **Composable**: Templates can be composed and inherited
3. **Backward Compatible**: String specs still work (no breaking changes)
4. **Research-Backed**: Aligned with BDD best practices and AI-powered testing trends

## Examples

### Basic Usage

```javascript
import { executeSpec } from 'ai-visual-test';

const spec = `
  Given I visit example.com
  When the page loads
  Then it should be accessible
`;

await executeSpec(page, spec, {
  url: 'https://example.com'
});
```

### With Templates

```javascript
import { createSpecFromTemplate, executeSpec } from 'ai-visual-test';

const spec = createSpecFromTemplate('game', {
  url: 'game.example.com',
  activationKey: 'g',
  selector: ', selector: #game-element'
});

await executeSpec(page, spec);
```

### With Configuration

```javascript
import { createSpecConfig, setSpecConfig, executeSpec } from 'ai-visual-test';

// Configure once per project
setSpecConfig(createSpecConfig({
  strictValidation: true,  // Throw on validation errors
  useLLM: true             // Use LLM for extraction
}));

// Use in tests
await executeSpec(page, spec);
```

## Testing

Run integration tests with tracing:

```bash
npm test -- test/spec-integration-trace.test.mjs
```

The tests trace execution to ensure everything works together.

## Next Steps

1. **Customize Templates**: Create templates for your project patterns
2. **Configure Per Project**: Set up `createSpecConfig` in your test setup
3. **Extend Error Analysis**: Add project-specific error categories
4. **Integrate with CI/CD**: Use error analysis reports in your pipeline

