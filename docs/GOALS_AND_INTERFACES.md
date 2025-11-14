# Goals, Interfaces, and Downstream Usage

## Core Goals

**Primary Purpose**: AI-powered visual testing using Vision Language Models (VLLM) for screenshot validation. Semantic visual regression testing that understands UI meaning, not just pixels.

**Key Problems Solved**:
1. **Semantic validation** - Understands UI meaning, not just pixel differences
2. **Dynamic content handling** - Handles feeds, timestamps, user data gracefully
3. **Accessibility validation** - Fast programmatic checks or VLLM semantic evaluation
4. **Design principle validation** - Validates brutalist, minimal, or other design styles
5. **Temporal testing** - Analyzes animations and gameplay over time
6. **State validation** - Fast programmatic or VLLM extraction from screenshots

**What it's NOT for**:
- Pixel-perfect brand consistency (use Percy/Chromatic)
- Very fast feedback loops (<1s) - AI calls take 1-3 seconds
- Offline testing - Requires API access

## Main Interfaces

### Primary API (Core Entry Point)

**`validateScreenshot(imagePath, prompt, context?)`**
- **Purpose**: Core validation function - this is what 90% of users call
- **Returns**: `ValidationResult` with `score`, `issues`, `reasoning`, `uncertainty`, `confidence`
- **Use when**: You have a screenshot and want to evaluate it
- **Example**:
```javascript
const result = await validateScreenshot(
  'payment-screen.png',
  'Check if this payment form is accessible and usable'
);
```

### Convenience Functions (High-Level Workflows)

**`validateWithGoals(imagePath, options)`**
- **Purpose**: Validate with variable goals (string, object, array, function)
- **Use when**: You want flexible goal specification
- **Example**:
```javascript
const result = await validateWithGoals('screenshot.png', {
  goal: 'Is the game fun?',
  gameState: { score: 100 }
});
```

**`testGameplay(page, options)`**
- **Purpose**: Complete workflow for game testing
- **Use when**: Testing games with variable goals
- **Requires**: Playwright page object
- **Originally motivated by**: [queeraoke](https://queeraoke.fyi) - interactive karaoke game requiring real-time validation
- **Supports**: `play: true` option to actually play the game (uses `playGame()` internally)

**`playGame(page, options)`** (Optional - Game Playing)
- **Purpose**: Actually play games using validation + decision-making + action execution
- **Use when**: You want the AI to play the game, not just test it
- **Requires**: Playwright page object
- **Note**: Slower than human gameplay (1-5 FPS for decision-making, not 60 FPS) because VLLM calls take 1-3 seconds

**`GameGym`** (Optional - Advanced Game Playing)
- **Purpose**: External iterator pattern (RL Gym-style) for advanced control
- **Use when**: You need explicit control, RL algorithm integration, or parallel game instances
- **Requires**: Playwright page object
- **Interface**: `reset()`, `step(action)` - caller controls the loop

**`testBrowserExperience(page, options)`**
- **Purpose**: Test browser experiences across stages
- **Use when**: Testing multi-stage user flows
- **Requires**: Playwright page object

### Smart Validators (Recommended)

**`validateAccessibilitySmart(options)`**
- **Purpose**: Automatically chooses programmatic (if page available) or VLLM (if only screenshot)
- **Use when**: You want the system to choose the best validator automatically

**`validateStateSmart(options)`**
- **Purpose**: Automatically chooses programmatic (if page available) or VLLM (if only screenshot)
- **Use when**: You want the system to choose the best validator automatically

**`validateSmart(options)`**
- **Purpose**: Universal smart validator with type parameter
- **Use when**: You want automatic validator selection

### Core Classes (Advanced)

**`VLLMJudge`**
- **Purpose**: Custom judge implementations
- **Use when**: You need fine-grained control over validation

**`EnsembleJudge`**
- **Purpose**: Multi-provider ensemble judging
- **Use when**: You want maximum reliability

**`BatchOptimizer`**
- **Purpose**: Batch request optimization with queuing and caching
- **Use when**: You have high-volume validation needs

### Programmatic Validators (Fast, Free)

**`checkElementContrast(page, selector, minContrast)`**
- **Purpose**: Fast contrast check (<100ms)
- **Use when**: You have page access and need fast feedback

**`validateStateProgrammatic(page, expectedState, options)`**
- **Purpose**: Fast state validation using direct state access
- **Use when**: You have page access (faster than VLLM)

## Downstream Usage Patterns

### Pattern 1: Standalone (No Playwright)

```javascript
import { validateScreenshot } from 'ai-visual-test';

// Works without Playwright - just needs screenshot
const result = await validateScreenshot('screenshot.png', 'Evaluate this page');
```

**Used by**: CI/CD pipelines, screenshot comparison tools, batch processing

### Pattern 2: Playwright Integration

```javascript
import { test } from '@playwright/test';
import { validateScreenshot } from 'ai-visual-test';

test('payment screen is accessible', async ({ page }) => {
  await page.goto('/checkout');
  await page.screenshot({ path: 'checkout.png' });
  const result = await validateScreenshot('checkout.png', 'Check accessibility');
  expect(result.score).toBeGreaterThan(7);
});
```

**Used by**: E2E test suites, Playwright-based testing frameworks

### Pattern 3: Python/Marimo (Language-Agnostic)

```python
# examples/marimo/comprehensive_apis.py
import subprocess
import json

# Calls Node.js script via subprocess
result = subprocess.run(['node', 'script.mjs'], capture_output=True)
```

**Used by**: Python developers, data science workflows, Marimo notebooks

### Pattern 4: HTTP API (Vercel)

```javascript
// api/validate.mjs - Vercel serverless function
export default async function handler(req, res) {
  const result = await validateScreenshot(imagePath, prompt);
  res.json(result);
}
```

**Used by**: Any language via HTTP, microservices, serverless deployments

### Pattern 5: Smart Validation (Automatic Selection)

```javascript
import { validateAccessibilitySmart } from 'ai-visual-test';

// Automatically uses programmatic if page available, VLLM if only screenshot
const result = await validateAccessibilitySmart({
  page: page,              // If available, uses programmatic (fast, free)
  screenshotPath: 'screenshot.png',  // If only this, uses VLLM (semantic)
});
```

**Used by**: Users who want the system to choose the best validator

## Critical Nuances

### 1. Result Structure Consistency

**Critical**: All validation functions return the same structure:
```javascript
{
  score: number | null,        // Always present, value may be null
  issues: Array<Issue>,        // Always present, array may be empty
  reasoning: string,           // Always present with a value
  enabled: boolean,            // Always present
  error: string | null,       // Present if error occurred
  // ... other fields
}
```

**Why**: Downstream code depends on consistent structure. Don't change this.

### 2. Smart Validator Selection Logic

**Critical**: Smart validators follow this decision tree:
1. Has page access + can measure programmatically → use programmatic (fast, free)
2. Has both + need semantic → use hybrid (best of both)
3. Only screenshot → use VLLM (semantic evaluation)

**Why**: Prevents common mistake of using VLLM for measurable things.

### 3. Model Tier Selection

**Critical**: Automatic tier selection based on context:
- High-frequency (10-60Hz) → `fast` tier
- Critical evaluations → `best` tier
- Cost-sensitive → `fast` tier
- Standard → `balanced` tier

**But**: Provider-specific quirks:
- Groq: "best" is actually fastest/cheapest (not highest quality)
- Gemini: "balanced" produces longest responses (not fastest)

**Why**: Different providers have different tier semantics.

### 4. Coherence Algorithm Invariants

**Critical**: Variance calculation must divide by N:
```javascript
const variance = scores.reduce((sum, score) => sum + Math.pow(score - meanScore, 2), 0) / scores.length;
```

**Why**: Without dividing by N, coherence scores would be systematically wrong.

### 5. Device Viewport Fallback

**Critical**: Check both `persona.device` AND `options.device`:
```javascript
const deviceToUse = persona.device || device;
```

**Why**: Persona diversity tests failed because viewports weren't set correctly.

### 6. Cache Architecture

**Critical**: Three separate caches with different purposes:
- **VLLM Cache** (`cache.mjs`): Persistent, file-based, process-scoped
- **BatchOptimizer Cache**: In-memory, request-scoped, for queuing
- **Temporal Preprocessing Cache**: In-memory, instance-scoped, for activity-based routing

**Why**: Different data types, lifecycles, and invalidation strategies.

### 7. Uncertainty Tier Logic

**Critical**: Tiered self-consistency based on context:
- Tier 1 (N=5): Critical scenarios (expert, medical, blocking issues)
- Tier 2 (N=3): Edge cases (extreme scores, high uncertainty, many issues)
- Tier 3 (N=0): Standard scenarios (logprobs + hallucination sufficient)

**Why**: Reduces API costs for common cases while ensuring quality for critical scenarios.

## What Matters for Goals

### 1. Semantic Understanding (Not Pixel-Perfect)

**Goal**: Understand UI meaning, not just pixel differences
**What matters**:
- VLLM-based validation (not pixel diffing)
- Context-aware evaluation (accessibility, design principles)
- Handles dynamic content gracefully

**What doesn't matter**:
- Exact pixel positions
- Brand consistency (use Percy for that)
- Offline operation

### 2. Fast Feedback When Possible

**Goal**: Use programmatic validators when available (fast, free)
**What matters**:
- Smart validator selection (automatic choice)
- Programmatic validators for measurable things
- VLLM only when semantic understanding needed

**What doesn't matter**:
- Using VLLM for everything (wasteful)
- Manual validator selection (error-prone)

### 3. Cost and Latency Optimization

**Goal**: Optimize for cost and latency while maintaining quality
**What matters**:
- Automatic tier selection (fast for high-frequency, best for critical)
- Caching (7-day TTL by default)
- Batch optimization (queuing, concurrency limits)
- Provider selection (auto-pick cheapest available)

**What doesn't matter**:
- Always using best model (too expensive)
- No caching (wasteful)
- Sequential processing (slow)

### 4. Research-Backed Quality

**Goal**: Implement research-backed techniques for reliability
**What matters**:
- Explicit rubrics (10-20% reliability improvement)
- Bias detection and mitigation
- Uncertainty reduction (logprobs, self-consistency)
- Temporal aggregation (coherence checking)

**What doesn't matter**:
- Implementing every paper exactly (pragmatic simplifications OK)
- Perfect research alignment (core concepts sufficient)

## Dataset Requirements

Based on goals, datasets should cover:

### 1. Semantic Validation Scenarios

**Good Examples** (High Quality):
- GitHub - Good accessibility, clear design
- MDN - Excellent accessibility, well-documented
- W3C - WCAG AAA compliant, reference implementation

**Bad Examples** (Known Issues):
- Low contrast sites
- Poor keyboard navigation
- Missing accessibility features
- Outdated design patterns

### 2. Dynamic Content Handling

**Scenarios**:
- Feeds with timestamps
- User-specific data
- Real-time updates
- Timezone-dependent content

### 3. Design Principle Validation

**Scenarios**:
- Brutalist design (21:1 contrast requirement)
- Minimal design
- Complex layouts
- Mobile vs desktop

### 4. Temporal Testing

**Scenarios**:
- Animations
- Gameplay sequences
- State changes over time
- User interactions

### 5. State Validation

**Scenarios**:
- Game state (ball position, score)
- Form state (input values, validation)
- UI state (modals, dropdowns)
- Navigation state (current page, breadcrumbs)

### 6. Accessibility Validation

**Scenarios**:
- WCAG compliance
- Contrast ratios
- Keyboard navigation
- Screen reader compatibility

## Current Dataset Gaps

**Missing**:
1. **Bad examples** - Sites with known accessibility issues
2. **Dynamic content** - Feeds, timestamps, user data
3. **Mobile views** - Currently all desktop (1280x720)
4. **Design principles** - Brutalist, minimal examples
5. **Temporal sequences** - Animation frames, gameplay sequences
6. **State validation** - Game states, form states
7. **Edge cases** - Error states, empty states, loading states

