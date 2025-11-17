# Evaluation Tests

Tests for the evaluation system and datasets.

## Requirements

### Optional Dependencies
- **Playwright**: Required for some tests that use browser automation
  - Install: `npm run playwright:install`
  - Tests will skip gracefully if not available

### Test Categories

1. **Structure Tests** - Validate dataset and website structures
   - `test-challenging-websites.mjs`
   - `test-interactive-experiences.mjs`

2. **Integration Tests** - Test system integration
   - `test-cohesive-goals.mjs` (requires Playwright)
   - `test-all-experiences.mjs`

3. **Performance Tests** - Test high-frequency scenarios
   - `test-latency-aware-batching.mjs`
   - `test-fast-changing-pages.mjs`
   - `test-adaptive-windows.mjs`

4. **Adversarial Tests** - Test edge cases and bias
   - `test-adversarial-evaluations.mjs`
   - `test-extreme-position-bias.mjs`

5. **Research Tests** - Test research-backed features
   - `test-research-enhanced-api.mjs`

6. **Game Tests** - Test game playing functionality
   - `test-janky-games.mjs` (requires Playwright)

## Running Tests

```bash
# Run all evaluation tests
node evaluation/test/test-*.mjs

# Run specific test
node evaluation/test/test-challenging-websites.mjs
```

## Notes

- Tests that require Playwright will skip if not installed (expected behavior)
- Some tests require API keys (will skip if not available)
- Tests are designed to be independent and can run in any order

