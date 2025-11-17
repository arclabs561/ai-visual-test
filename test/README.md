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

### Unit Tests (Fast, Isolated)
- `config.test.mjs` - Configuration loading
- `logger.test.mjs` - Logging functionality
- `constants.test.mjs` - Constants validation
- `errors.test.mjs` - Error handling
- `helpers/*` - Utility functions

### Integration Tests (Component Interaction)
- `integration-*.test.mjs` - Component integration
- `spec-*.test.mjs` - Spec parsing and validation
- `temporal-*.test.mjs` - Temporal features
- `ensemble-*.test.mjs` - Ensemble judge

### E2E Tests (Full Workflows)
- `game-playing.test.mjs` - Complete game testing workflow
- `accessibility-hybrid.test.mjs` - Hybrid accessibility validation
- `validation-*.test.mjs` - Full validation workflows

### Property Tests (Invariants)
- `calibration-degradation-comprehensive.test.mjs` - Calibration properties
- `temporal-graph-comprehensive.test.mjs` - Temporal graph properties
- `screenshot-selection-comprehensive.test.mjs` - Selection strategies

### Evaluation Tests
Located in `evaluation/test/`:
- Structure tests - Dataset validation
- Performance tests - Latency and batching
- Adversarial tests - Edge cases and bias

## Running Tests

```bash
# Run all tests
npm test

# Run unit tests only (fast)
node --test test/unit/*.test.mjs

# Run integration tests
node --test test/integration-*.test.mjs

# Run specific test
node --test test/game-playing.test.mjs
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

## Migration Notes

Tests are being reorganized from flat structure to pyramid:
- Old: All tests in `test/` root
- New: Organized by speed/scope in subdirectories

Old tests still work but will be gradually moved to appropriate directories.

