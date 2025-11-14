# API Design for Natural Language Specifications

## Current API Structure

```javascript
// Current API (3-step process)
const parsedSpec = await parseSpec(spec);
const calls = await mapToInterfaces(parsedSpec, context);
const result = await executeSpec(page, spec, options);

// Or simplified (1-step)
const result = await executeSpec(page, spec, options);
```

## API Design Principles (From Research)

### 1. Design-First Approach
- **Principle**: API specification should be clear and consistent before implementation
- **Application**: Natural language specs should have a clear structure that maps predictably to validation interfaces
- **Current State**: ✅ We have structure (Given/When/Then), but could be more explicit

### 2. Consistent Naming Conventions
- **Principle**: Use consistent naming (snake_case recommended for specs)
- **Application**: Spec keywords should follow consistent patterns
- **Current State**: ⚠️ Mixed - we use camelCase in code, but specs are natural language

### 3. Reusable Component Architecture
- **Principle**: Abstract common patterns into reusable components
- **Application**: Common spec patterns (game testing, accessibility, etc.) should be reusable
- **Current State**: ⚠️ Partially - we extract patterns but don't have reusable templates

### 4. Hierarchical Resource Representation
- **Principle**: Clear hierarchical structure reflecting relationships
- **Application**: Specs should clearly show relationships (page → game → state)
- **Current State**: ✅ Given/When/Then provides hierarchy

### 5. Metadata and Context Layers
- **Principle**: Include metadata for scope, purpose, version
- **Application**: Specs should include context (viewport, device, persona, etc.)
- **Current State**: ⚠️ Context passed separately in options, not in spec

## Proposed API Improvements

### Option 1: Fluent Builder API

```javascript
import { SpecBuilder } from 'ai-visual-test';

const result = await SpecBuilder
  .given('I visit queeraoke.fyi')
  .when('I activate the easter egg game (press "g")')
  .then('the game should be playable')
  .and('the score should update')
  .and('the game should be accessible')
  .withContext({
    url: 'https://queeraoke.fyi',
    gameActivationKey: 'g',
    gameSelector: '#game-paddle'
  })
  .execute(page);
```

**Pros:**
- Type-safe
- Clear structure
- IDE autocomplete

**Cons:**
- More verbose
- Less natural language feel

### Option 2: Enhanced Options Object

```javascript
import { executeSpec } from 'ai-visual-test';

const result = await executeSpec(page, {
  spec: `
    Given I visit queeraoke.fyi
    When I activate the easter egg game
    Then the game should be playable
  `,
  context: {
    url: 'https://queeraoke.fyi',
    gameActivationKey: 'g',
    gameSelector: '#game-paddle',
    viewport: { width: 1280, height: 720 },
    device: 'desktop',
    persona: { name: 'Casual Gamer' }
  },
  options: {
    captureTemporal: true,
    fps: 2,
    duration: 10000,
    captureCode: true,
    checkConsistency: true
  }
});
```

**Pros:**
- Single function call
- All context in one place
- Backward compatible

**Cons:**
- Large options object
- Less discoverable

### Option 3: Spec Templates (Reusable Components)

```javascript
import { SpecTemplates, executeSpec } from 'ai-visual-test';

// Define reusable template
const gameTestTemplate = SpecTemplates.create({
  name: 'game-test',
  structure: {
    given: 'I visit {url}',
    when: 'I activate the game',
    then: [
      'the game should be {goals}',
      'the score should update',
      'visual state should match game state'
    ]
  },
  defaults: {
    captureTemporal: true,
    fps: 2,
    captureCode: true
  }
});

// Use template
const result = await executeSpec(page, gameTestTemplate, {
  url: 'https://queeraoke.fyi',
  goals: ['fun', 'accessibility'],
  gameActivationKey: 'g'
});
```

**Pros:**
- Reusable patterns
- Consistent structure
- Easy to extend

**Cons:**
- More setup
- Less flexible

### Option 4: Hybrid (Recommended)

Combine all approaches - provide multiple ways to use the API:

```javascript
// 1. Simple string spec (current, most natural)
const result = await executeSpec(page, spec, options);

// 2. Structured spec object (more control)
const result = await executeSpec(page, {
  spec: { given: [...], when: [...], then: [...] },
  context: { ... },
  options: { ... }
});

// 3. Template-based (reusable patterns)
const result = await executeSpec(page, gameTestTemplate, options);

// 4. Fluent builder (type-safe)
const result = await SpecBuilder
  .given(...)
  .when(...)
  .then(...)
  .execute(page);
```

## Context Extraction Improvements

### Current: Manual Context Passing

```javascript
await executeSpec(page, spec, {
  url: 'https://queeraoke.fyi',
  gameActivationKey: 'g',
  gameSelector: '#game-paddle',
  // ... many options
});
```

### Proposed: Auto-Extract from Spec

```javascript
// Spec includes context
const spec = `
  Given I visit queeraoke.fyi
  When I activate the easter egg game (press 'g', selector: #game-paddle)
  Then the game should be playable
  Context: viewport=1280x720, device=desktop, persona=Casual Gamer
`;

// System auto-extracts:
// - url: 'queeraoke.fyi'
// - gameActivationKey: 'g'
// - gameSelector: '#game-paddle'
// - viewport: { width: 1280, height: 720 }
// - device: 'desktop'
// - persona: 'Casual Gamer'
```

## Interface Mapping Improvements

### Current: Keyword-Based Detection

```javascript
// Detects "game" → testGameplay
// Detects "accessible" → validateAccessibilitySmart
```

### Proposed: Explicit Interface Declaration

```javascript
const spec = `
  Given I visit queeraoke.fyi
  When I activate the game
  Then the game should be playable
  
  Interfaces: testGameplay, validateAccessibilitySmart
  Options: { captureTemporal: true, fps: 2 }
`;
```

## Property Testing API Improvements

### Current: Basic Property Generation

```javascript
const properties = ['Game score should always be non-negative'];
const tests = await generatePropertyTests(properties);
await tests.run();
```

### Proposed: Enhanced Property API

```javascript
import { PropertySpec } from 'ai-visual-test';

const propertySpec = PropertySpec
  .invariant('Game score should always be non-negative')
  .check((result) => result.score >= 0)
  .generator('fast-check')
  .runs(100);

await propertySpec.test(page);
```

## Recommendations

### Short Term (Keep Current API, Enhance)

1. **Enhance `executeSpec()` options** - Add structured context object
2. **Auto-extract context from spec** - Parse URL, viewport, etc. from spec text
3. **Better error messages** - Show which part of spec failed
4. **Spec validation** - Validate spec structure before execution

### Medium Term (Add New APIs)

1. **Spec templates** - Reusable spec patterns
2. **Fluent builder** - Type-safe spec construction
3. **Enhanced property API** - More control over property tests

### Long Term (Consider)

1. **Spec DSL** - Domain-specific language for specs
2. **Spec versioning** - Track spec changes over time
3. **Spec testing** - Test the specs themselves

## Integration with Existing APIs

### Current Integration

```javascript
// Natural language spec → existing interfaces
executeSpec(page, spec) → testGameplay() → validateScreenshot()
```

### Proposed: Direct Integration

```javascript
// Natural language spec can directly call any interface
executeSpec(page, spec, {
  interfaces: ['testGameplay', 'validateAccessibilitySmart'],
  // Or auto-detect from spec keywords
});
```

## Backward Compatibility

**Critical**: All changes must be backward compatible.

- ✅ Keep `executeSpec(page, spec, options)` signature
- ✅ Keep `parseSpec()`, `mapToInterfaces()` as separate functions
- ✅ Add new APIs alongside existing ones
- ✅ Don't break existing usage patterns

## Queeraoke Patterns Integration

Based on queeraoke's real-world usage:

1. **Direct prompts** - Most common pattern, keep simple
2. **testGameplay with goals** - Well-established pattern, enhance
3. **Multi-modal validation** - Default behavior, make explicit
4. **Temporal sequences** - Common pattern, improve extraction
5. **Property-based testing** - Used for invariants, enhance API

## Next Steps

1. ✅ Document current API design
2. ⏳ Implement enhanced options object
3. ⏳ Add auto-context extraction
4. ⏳ Create spec templates
5. ⏳ Add fluent builder (optional)


