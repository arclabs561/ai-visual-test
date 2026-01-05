# Usage Examples

Real-world examples demonstrating how to use `@arclabs561/ai-visual-test` for different use cases.

## Running Examples

All examples require API keys. Set one of the following in `.env`:
- `GEMINI_API_KEY=your-key`
- `OPENAI_API_KEY=your-key`
- `ANTHROPIC_API_KEY=your-key`

Then run:
```bash
node examples/use-case-1-enterprise-qa.mjs
node examples/use-case-2-indie-game-dev.mjs
node examples/use-case-3-playwright-integration.mjs
node examples/use-case-4-real-website.mjs
```

## Use Cases

### 0. Playwright Setup (`playwright-setup.mjs`)

**Scenario**: Setting up and verifying Playwright integration

**Key Features**:
- `createMatchers()` setup
- Custom matchers: `toHaveVisualScore()`, `toBeAccessibleHybrid()`
- Verification that integration works

**What it demonstrates**:
- How to set up Playwright custom matchers
- How to use matchers in tests
- Error handling and provider information

### 1. Enterprise QA Team (`use-case-1-enterprise-qa.mjs`)

**Scenario**: Testing a payment form for accessibility and visual bugs

**Key Features**:
- `validatePage()` for Playwright integration
- `validateAccessibilityHybrid()` for programmatic + AI validation
- Real-world error handling

**What it demonstrates**:
- Basic visual validation
- Hybrid accessibility validation (programmatic contrast + AI semantic)
- Specific accessibility checks

### 2. Indie Game Developer (`use-case-2-indie-game-dev.mjs`)

**Scenario**: Testing a simple game for fun, playability, and visual polish

**Key Features**:
- `playGame()` for AI-driven gameplay
- `validateWithGoals()` for goal-based evaluation
- `testGameplay()` for complete workflow

**What it demonstrates**:
- AI gameplay testing
- Goal-based evaluation (fun, visual polish, playability)
- Temporal capture and analysis

### 3. Playwright Integration (`use-case-3-playwright-integration.mjs`)

**Scenario**: Using custom matchers in Playwright tests

**Key Features**:
- `createMatchers()` to extend Playwright's `expect`
- Custom matchers: `toHaveVisualScore()`, `toBeAccessibleHybrid()`

**What it demonstrates**:
- How to set up custom matchers
- Using matchers in test context
- Real test workflow patterns

### 4. Real Website Testing (`use-case-4-real-website.mjs`)

**Scenario**: Testing a real website (public URL) for visual quality

**Key Features**:
- `validatePage()` with real URLs
- Network error handling
- Multiple validation types

**What it demonstrates**:
- Testing real websites
- Visual quality checks
- Accessibility evaluation

## Key Learnings from Running Examples

### What Works Well

1. **`validatePage()` is intuitive**: Reduces boilerplate significantly
   ```javascript
   // Before: Manual screenshot + validate
   await page.screenshot({ path: 'shot.png' });
   const result = await validateScreenshot('shot.png', prompt);
   
   // After: One function call
   const result = await validatePage(page, prompt);
   ```

2. **Hybrid validation is powerful**: Combines programmatic checks (fast, deterministic) with AI semantic evaluation (comprehensive, contextual)

3. **Error handling is robust**: Examples handle missing API keys gracefully

### Areas for Improvement

1. **Issue formatting**: Some issues are objects, need better stringification
   - Fixed in examples with custom formatting logic
   - Could be improved in the library itself

2. **Gameplay testing**: `playGame()` needs better game state detection
   - Currently returns 0 steps for simple games
   - May need more robust game state extraction

3. **Documentation**: Examples reveal API patterns that should be in main docs
   - `validatePage()` is now in API_QUICK_REFERENCE.md
   - Playwright matchers documented

## Next Steps

Based on running these examples:

1. ✅ Add `validatePage()` to convenience functions
2. ✅ Create Playwright matchers
3. ✅ Improve issue formatting in examples
4. ⏳ Consider improving `playGame()` game state detection
5. ⏳ Add more examples for temporal analysis
6. ⏳ Add example for ensemble judging

