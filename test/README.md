# Test Organization

## Test Pyramid Structure

Tests are organized by speed and scope:

```
test/
├── unit/              # Fast, isolated tests (<100ms each)
├── integration/       # Component interaction tests (<1s each)
├── e2e/              # Full workflow tests (<30s each)
└── property/         # Invariant/property tests
```

## Current Organization

Tests are organized into subdirectories by type:

### Unit Tests (`test/unit/`) - Fast, Isolated
- `config.test.mjs` - Configuration loading
- `logger.test.mjs` - Logging functionality
- `constants.test.mjs` - Constants validation
- `errors.test.mjs` - Error handling
- `cache.test.mjs` - Cache functionality
- `rubrics.test.mjs` - Rubric system
- `bias-detector.test.mjs` - Bias detection
- And 19 more unit tests

### Integration Tests (`test/integration/`) - Component Interaction
- `integration-*.test.mjs` - Component integration
- `spec-*.test.mjs` - Spec parsing and validation
- `temporal-*.test.mjs` - Temporal features
- `ensemble-*.test.mjs` - Ensemble judge
- `validators-*.test.mjs` - Validator tests
- And 50+ more integration tests

### E2E Tests (`test/e2e/`) - Full Workflows
- `game-playing.test.mjs` - Complete game testing workflow
- `playwright-setup.test.mjs` - Playwright integration

### Security Tests (`test/security/`) - Security-Focused
- `red-team-security.test.mjs` - Security testing
- `cache-race-conditions.test.mjs` - Race condition testing

### Test Utilities
- `test-setup.mjs` - Auto-loads .env (shared by all tests)
- `test-image-utils.mjs` - Image test utilities
- `test-logger.mjs` - Test logging utilities
- `helpers/` - Mock utilities and helpers

## Running Tests

```bash
# Run all tests
npm test

# Run by category
npm run test:unit          # Fast unit tests
npm run test:integration   # Integration tests
npm run test:e2e          # End-to-end tests
npm run test:security     # Security tests

# Run specific test
node --test test/integration/judge.test.mjs
node --test test/unit/config.test.mjs
```

## Test Quality Guidelines

### Unit Tests
- ✅ Test single functions/classes in isolation
- ✅ Mock external dependencies
- ✅ Fast execution (<100ms each)
- ✅ No network/IO operations

### Integration Tests
- ✅ Test component interactions
- ✅ Use real dependencies where possible
- ✅ Moderate execution time (<1s each)
- ✅ May use test fixtures

### E2E Tests
- ✅ Test complete workflows
- ✅ Use real APIs/services
- ✅ Longer execution time (<30s each)
- ✅ May require Playwright/browser

### Property Tests
- ✅ Test invariants that should always hold
- ✅ Use property-based testing (Hypothesis-like)
- ✅ Test edge cases and boundaries
- ✅ Document expected properties

## Test Coverage Goals

- **Unit Tests**: 80%+ coverage of core logic
- **Integration Tests**: All major component interactions
- **E2E Tests**: All user-facing workflows
- **Property Tests**: All critical invariants

## Test Organization

Tests are organized into a pyramid structure:
- **Unit tests** (`test/unit/`) - Fast, isolated, no external dependencies
- **Integration tests** (`test/integration/`) - Component interactions
- **E2E tests** (`test/e2e/`) - Full workflows
- **Security tests** (`test/security/`) - Security-focused

All tests import shared utilities from `test/` root:
- `test-setup.mjs` - Auto-loads .env
- `test-image-utils.mjs` - Image utilities
- `test-logger.mjs` - Logging utilities
- `helpers/` - Mock utilities
