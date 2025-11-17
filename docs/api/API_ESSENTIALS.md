# API Essentials: Core Functions and Usage

## Core Function

The core API is `validateScreenshot()`, which takes a screenshot path and evaluation prompt, and returns structured validation results.

**Function signature**:
```javascript
validateScreenshot(imagePath: string, prompt: string, context?: object): Promise<ValidationResult>
```

**Example**:
```javascript
import { validateScreenshot } from '@arclabs561/ai-visual-test';

const result = await validateScreenshot('screenshot.png', 'Evaluate this page');

// Expected output:
console.log(result.score);      // 7 (0-10 scale, how good is it?)
console.log(result.issues);     // ['Missing error messages', 'Low contrast'] (what's wrong?)
console.log(result.reasoning);  // "The form is mostly accessible, but..." (why this score?)
console.log(result.uncertainty); // 0.15 (how uncertain? lower = more confident)
console.log(result.confidence);  // 0.85 (how confident? higher = more confident)
```

**This is the foundation.** Everything else builds on top of this.

---

## Using Goals

Goals enhance your prompts automatically. Instead of asking "Evaluate this", you ask "Evaluate accessibility" and the system automatically enhances the prompt with specific criteria.

**Why goals help**: They give the AI context about what you care about. "Accessibility" means "check contrast, labels, keyboard navigation" - the AI knows what to look for.

**Example**:
```javascript
import { validateScreenshot, createGameGoal } from '@arclabs561/ai-visual-test';

const goal = createGameGoal('accessibility');
const result = await validateScreenshot('screenshot.png', 'Evaluate', {
  goal: goal // Automatically enhances prompt with accessibility criteria
});

// Expected output:
console.log(result.score); // 8.2
console.log(result.issues); // ['Low contrast on submit button', 'Missing form label for email']
// The prompt becomes: "Evaluate this screenshot for accessibility. 
// Check: contrast, labels, keyboard navigation, error messages, etc."
```

**What goals do**: They enhance your prompt automatically. You don't need to write long, detailed prompts - just specify the goal and the system fills in the details.

---

## Convenience Functions

These functions do common workflows for you. Instead of manually capturing screenshots, calling `validateScreenshot()`, and managing temporal notes, you just call one function.

**The idea**: Common patterns should be easy. Complex workflows should be simple.

### Gameplay Testing

**Function**: `testGameplay(page, options)`

**Example**:
```javascript
import { testGameplay } from '@arclabs561/ai-visual-test';

// Complete workflow: capture screenshots, evaluate goals, return results
const gameplay = await testGameplay(page, {
  url: 'https://game.example.com',
  goals: ['fun', 'accessibility', 'performance']
});

// Expected output:
console.log(gameplay.experiences);     // Persona experiences with screenshots
console.log(gameplay.aggregated);      // Temporal aggregation (coherence: 0.92, patterns: ['score increasing'])
console.log(gameplay.evaluations);     // Goal evaluations with scores
console.log(gameplay.temporalScreenshots); // Frame-by-frame screenshots (if enabled)
```

**What this does**:
1. Navigates to the game URL
2. Captures screenshots over time
3. Evaluates each goal (fun, accessibility, performance)
4. Aggregates temporal notes (understands gameplay over time)
5. Returns everything in one object

**Why this exists**: Testing games manually is tedious. This does it for you.

### Game Playing

**Function**: `playGame(page, options)`

**Example**:
```javascript
import { playGame } from '@arclabs561/ai-visual-test';

// Actually plays the game (makes decisions, takes actions)
const playResult = await playGame(page, {
  goal: 'Maximize score',
  maxSteps: 50,
  fps: 2 // 2 decisions per second (not 60 FPS - that's for validation)
});

// Expected output:
console.log(playResult.history);    // All actions taken and results
console.log(playResult.finalScore); // 1250 (final game score)
console.log(playResult.actions);    // Array of actions (keyboard, mouse, etc.)
```

**What this does**: Uses AI to understand game state, decide what action to take, and execute it. It's like having an AI player.

**When to use**: When you want to test gameplay, not just validate screenshots.

### Browser Experience Testing

**Function**: `testBrowserExperience(page, options)`

**Example**:
```javascript
import { testBrowserExperience } from '@arclabs561/ai-visual-test';

// Tests multi-stage user flows
const experience = await testBrowserExperience(page, {
  url: 'https://example.com',
  stages: ['initial', 'form', 'payment']
});

// Expected output:
console.log(experience.stages);     // Evaluation for each stage
// [
//   { stage: 'initial', score: 8.5, issues: [] },
//   { stage: 'form', score: 7.2, issues: ['Missing error messages'] },
//   { stage: 'payment', score: 9.1, issues: [] }
// ]
console.log(experience.aggregated);  // Cross-stage aggregation
console.log(experience.consistency); // 0.88 (consistency across stages)
```

**What this does**: Tests complete user flows (not just single pages). Useful for checkout flows, onboarding, etc.

### Validation with Goals

**Function**: `validateWithGoals(screenshotPath, options)`

**Example**:
```javascript
import { validateWithGoals } from '@arclabs561/ai-visual-test';

// Simpler API - just pass goal and screenshot
const validation = await validateWithGoals('screenshot.png', {
  goal: 'accessibility',
  gameState: { score: 100 } // Optional context
});

// Expected output:
console.log(validation.score);  // 8.2
console.log(validation.issues); // ['Low contrast', 'Missing label']
// Same result as validateScreenshot(), but simpler API
```

**What this does**: Wrapper around `validateScreenshot()` that makes goals easier to use.

---

## Error Handling

All functions throw `ValidationError` for invalid inputs. This is a specific error type you can catch and handle.

**Common errors**:
- File not found (screenshot doesn't exist)
- Invalid API key (no key or wrong key)
- API rate limit (too many requests)
- Invalid prompt (empty or malformed)

**Example**:
```javascript
import { ValidationError } from '@arclabs561/ai-visual-test';

try {
  await validateScreenshot('missing.png', 'prompt');
} catch (error) {
  if (error instanceof ValidationError) {
    // This is a validation error (expected)
    console.error('Validation error:', error.message);
    // Expected output: "Validation error: Screenshot not found: missing.png"
    console.error('Details:', error.details);
    // Expected output: { file: 'missing.png', code: 'FILE_NOT_FOUND' }
  } else {
    // This is an unexpected error (network, etc.)
    console.error('Unexpected error:', error);
    // Report to monitoring
  }
}
```

**Why this matters**: Validation errors are expected (bad input, API issues). Other errors are unexpected (bugs, network failures). Handle them differently.

---

## Return Types

### ValidationResult

Every `validateScreenshot()` call returns a `ValidationResult` object.

**Structure**:
```typescript
{
  score: number | null;        // 0-10, how good is it? null if couldn't determine
  issues: Array<Issue>;        // What's wrong? Always an array (may be empty)
  reasoning: string;           // Why this score? Always present
  assessment: string | null;   // Detailed assessment? May be null
  uncertainty: number | null;  // 0-1, how uncertain? Lower = more certain
  confidence: number | null;   // 0-1, how confident? Higher = more confident
  // ... other fields (metadata, timing, etc.)
}
```

**Example output**:
```javascript
{
  score: 7.5,
  issues: [
    {
      description: 'Missing error messages',
      importance: 'high',
      impact: 'degrades-experience'
    },
    {
      description: 'Low contrast on button',
      importance: 'medium',
      impact: 'minor-inconvenience'
    }
  ],
  reasoning: 'The form is mostly accessible, but missing error messages and low contrast on the submit button reduce usability.',
  assessment: 'Overall good accessibility with minor issues.',
  uncertainty: 0.15,
  confidence: 0.85
}
```

**Important**: `score` and `issues` are the most important fields. Everything else is metadata.

**When fields are null**:
- `score` is null → AI couldn't determine a score (rare, but possible)
- `uncertainty` is null → Uncertainty reduction not enabled
- `confidence` is null → Confidence calculation not available

### Issue Object

Each issue tells you what's wrong.

**Structure**:
```typescript
{
  description: string;  // "Missing error messages" (what's wrong?)
  importance: 'critical' | 'high' | 'medium' | 'low';  // How important?
  annoyance: 'very-high' | 'high' | 'medium' | 'low';  // How annoying?
  impact: 'blocks-use' | 'degrades-experience' | 'minor-inconvenience' | 'cosmetic';
  evidence?: string;    // "Submit button has no error message" (proof)
  suggestion?: string;  // "Add error message below submit button" (how to fix)
}
```

**Example output**:
```javascript
{
  description: 'Missing error messages',
  importance: 'high',
  annoyance: 'high',
  impact: 'degrades-experience',
  evidence: 'Submit button has no error message when form is invalid',
  suggestion: 'Add error message below submit button when validation fails'
}
```

**How to use**: Sort by `importance` to fix critical issues first. Use `suggestion` to know how to fix it.

---

## Goals

Goals enhance your prompts automatically. Instead of writing long, detailed prompts, you specify a goal and the system fills in the details.

**The idea**: Common evaluation types (accessibility, performance, design) have standard criteria. Goals provide those criteria automatically.

### String Goals

Just pass a string. The system knows what "accessibility" means.

**Example**:
```javascript
const result = await validateScreenshot(path, 'prompt', { goal: 'accessibility' });

// Expected output:
console.log(result.score); // 8.2
// The prompt becomes: "Evaluate this screenshot for accessibility. 
// Check: contrast, labels, keyboard navigation, error messages, etc."
```

**Available goals**: `'accessibility'`, `'performance'`, `'design'`, `'usability'`, `'fun'`, etc.

**Why this works**: Each goal has a predefined template. "Accessibility" means "check WCAG compliance, keyboard navigation, contrast, labels" - the system knows this.

### Object Goals

Define your own goal with custom criteria.

**Example**:
```javascript
const result = await validateScreenshot(path, 'prompt', {
  goal: {
    description: 'Evaluate accessibility',
    criteria: ['WCAG compliance', 'keyboard navigation', 'screen reader support']
  }
});

// Expected output:
console.log(result.score); // 7.8
// The prompt uses your custom description and criteria
```

**When to use**: When predefined goals don't fit your needs. You want specific criteria.

### Array Goals

Combine multiple goals into one evaluation.

**Example**:
```javascript
const result = await validateScreenshot(path, 'prompt', {
  goal: ['accessibility', 'performance']
});

// Expected output:
console.log(result.score); // 7.5
// The prompt combines both goal templates
// Evaluates: accessibility AND performance
```

**When to use**: When you care about multiple aspects. "Is it accessible AND performant?"

### Function Goals

Goals that change based on context.

**Example**:
```javascript
const result = await validateScreenshot(path, 'prompt', {
  goal: (context) => {
    // Context includes: gameState, renderedCode, persona, testType, etc.
    if (context.gameState?.level > 5) {
      return 'advanced'; // Use advanced evaluation template
    }
    return 'basic'; // Use basic evaluation template
  }
});

// Expected output:
console.log(result.score); // 8.5 (for advanced level)
```

**When to use**: When your evaluation criteria depend on game state, user persona, or other context.

**The context object** includes:
- `gameState`: Current game state (score, level, etc.)
- `renderedCode`: HTML/CSS/DOM (if available)
- `persona`: User persona (if available)
- `testType`: Type of test ('gameplay', 'accessibility', etc.)
- Other validation context

**The function should return**: A string (goal name) or object (custom goal).

---

## Uncertainty Reduction

By default, the system tells you how confident it is in its judgment. This helps you know when to trust the AI and when to ask a human.

**The problem**: AI judgments aren't always right. Sometimes the AI is uncertain, sometimes it hallucinates, sometimes it's just wrong.

**The solution**: The system estimates uncertainty and confidence, then tells you.

**Example**:
```javascript
const result = await validateScreenshot('screenshot.png', 'prompt', {
  enableUncertaintyReduction: true, // Default - tells you how confident
  enableHallucinationCheck: true     // Default - checks for hallucinations
});

// Expected output:
console.log(result.uncertainty); // 0.15 (0-1, higher = more uncertain)
//   - 0.0 = very certain
//   - 0.5 = somewhat uncertain
//   - 1.0 = very uncertain
console.log(result.confidence);  // 0.85 (0-1, higher = more confident)
//   - 0.0 = not confident
//   - 0.5 = somewhat confident
//   - 1.0 = very confident
```

**How to use**:
- `uncertainty > 0.3` → Consider asking a human
- `confidence < 0.7` → The AI isn't sure, get a second opinion
- `uncertainty < 0.1` → The AI is very certain, probably safe to trust

**Why this matters**: Not all AI judgments are equal. Some are confident, some are guesses. Uncertainty reduction tells you which is which.

---

## Temporal Aggregation

When you capture multiple screenshots over time (like during gameplay), the system aggregates them to understand patterns.

**The idea**: A single screenshot tells you what's happening now. Multiple screenshots tell you what's happening over time.

**Example**:
```javascript
const gameplay = await testGameplay(page, { url: '...' });

// Expected output:
console.log(gameplay.aggregated);
// {
//   coherence: 0.92,  // 0-1, how consistent is the gameplay?
//   patterns: ['score increasing', 'button clicked frequently'],
//   conflicts: []     // Contradictory observations
// }

console.log(gameplay.aggregatedMultiScale);
// {
//   immediate: { ... },  // 0.1s windows (instant reactions)
//   short: { ... },      // 1s windows (quick assessments)
//   medium: { ... },     // 10s windows (detailed evaluation)
//   long: { ... }        // 60s windows (comprehensive review)
// }
```

**Why this matters**: Understanding gameplay over time helps you catch issues that only appear in sequences (animations, state transitions, etc.).

**When to use**: Always enabled in `testGameplay()`. You don't need to do anything - it just works.

---

## Best Practices

These aren't rules—they're patterns that work well in practice.

### Use Goals

**Instead of**:
```javascript
const result = await validateScreenshot(path, 
  'Evaluate this screenshot for accessibility. Check contrast, labels, keyboard navigation, error messages, etc.'
);
```

**Do this**:
```javascript
const result = await validateScreenshot(path, 'Evaluate', { goal: 'accessibility' });
```

**Why**: Goals provide standard criteria automatically. You don't need to write long prompts.

### Check Uncertainty

```javascript
const result = await validateScreenshot(path, 'Evaluate');
if (result.uncertainty > 0.3) {
  // AI is uncertain - ask a human
  await requestHumanValidation(result);
}
```

**Why**: Not all AI judgments are equal. Some are confident, some are guesses. Check uncertainty to know which is which.

### Use Convenience Functions

**Instead of**:
```javascript
const screenshot = await page.screenshot();
const notes = [];
for (let i = 0; i < 60; i++) {
  const frame = await page.screenshot();
  notes.push({ timestamp: Date.now(), frame });
  await page.waitForTimeout(16);
}
const aggregated = aggregateTemporalNotes(notes);
const result = await validateScreenshot(screenshot, 'Evaluate', { temporalNotes: aggregated });
```

**Do this**:
```javascript
const gameplay = await testGameplay(page, { url: '...' });
```

**Why**: Convenience functions do common workflows for you. Less code, fewer bugs.

### Handle Errors

```javascript
try {
  const result = await validateScreenshot(path, 'prompt');
} catch (error) {
  if (error instanceof ValidationError) {
    // Expected error (bad input, API issue)
    console.error('Validation failed:', error.message);
  } else {
    // Unexpected error (bug, network failure)
    console.error('Unexpected error:', error);
    // Report to monitoring
  }
}
```

**Why**: Validation errors are expected (bad input, API issues). Other errors are unexpected (bugs). Handle them differently.

### Check Return Structure

```javascript
const result = await validateScreenshot(path, 'prompt');
if (result.score === null) {
  // AI couldn't determine score - handle gracefully
  console.warn('Score unavailable, checking issues instead');
  if (result.issues.length > 0) {
    // Use issues to determine quality
  }
}
```

**Why**: Sometimes `score` is null (AI couldn't determine it). Always check before using it.

---

## Common Patterns

### Interactive Game Testing

**The problem**: You want to test a game, but manually capturing screenshots and evaluating them is tedious.

**The solution**: Use `testGameplay()` to do it all.

**Example**:
```javascript
import { testGameplay, validateWithGoals } from '@arclabs561/ai-visual-test';

// Complete workflow: capture, evaluate, aggregate
const gameplay = await testGameplay(page, {
  url: 'https://game.example.com',
  goals: ['fun', 'accessibility']
});

// Expected output:
console.log(gameplay.experiences); // Persona experiences with screenshots
console.log(gameplay.aggregated);  // Temporal aggregation (coherence: 0.92, patterns: [...])
console.log(gameplay.evaluations); // Goal evaluations with scores

// Validate specific frame with temporal context
const validation = await validateWithGoals(
  gameplay.experiences[0].screenshots[0].path,
  {
    goal: 'accessibility',
    context: {
      temporalNotes: gameplay.aggregated // Use aggregated notes for context
    }
  }
);

// Expected output:
console.log(validation.score); // 8.5
```

**Why this works**: `testGameplay()` does everything for you. You just specify goals and get results.

### Multi-Perspective Testing

**The problem**: Different users care about different things. A gamer cares about fun, an accessibility advocate cares about accessibility.

**The solution**: Test with multiple personas.

**Example**:
```javascript
import { experiencePageWithPersonas, validateScreenshot } from '@arclabs561/ai-visual-test';

// Test from multiple perspectives
const experiences = await experiencePageWithPersonas(page, [
  { name: 'Gamer', goals: ['fun'] },
  { name: 'Accessibility Advocate', goals: ['accessibility'] }
]);

// Expected output:
experiences.forEach(exp => {
  console.log(`${exp.persona.name}: coherence ${exp.aggregated.coherence}`);
  // Output: "Gamer: coherence 0.88"
  // Output: "Accessibility Advocate: coherence 0.92"
  console.log(`Score: ${exp.evaluations[0].score}`);
  // Output: "Score: 8.5" (Gamer)
  // Output: "Score: 7.2" (Accessibility Advocate)
});
```

**Why this works**: Different personas evaluate differently. A gamer might give high scores for fun, while an accessibility advocate might give low scores for accessibility. Both perspectives matter.

### High-Frequency Validation (60Hz Games)

**The problem**: Real-time games need validation at 60 frames per second, but calling AI 60 times per second is expensive and slow.

**The solution**: Use temporal decision making to only call AI when needed.

**Example**:
```javascript
import { testGameplay } from '@arclabs561/ai-visual-test';

const gameplay = await testGameplay(page, {
  url: 'https://game.example.com',
  goals: ['Maximize score'],
  captureTemporal: true,
  fps: 60,
  useTemporalDecision: true, // Only call AI when decision needed
  useEnsemble: true // Multiple models for consensus
});

// Expected output:
console.log(gameplay.evaluations[0].score); // 8.5
// Result: Fast (<100ms latency), accurate validation
// LLM calls reduced by 98.5% when context is stable (only on decision points)
// Based on research: arXiv:2406.12125 - "Efficient Sequential Decision Making"
```

**Why this works**: Most frames don't need validation. Only decision points do. By skipping unnecessary calls, we achieve <100ms latency while maintaining accuracy.

**Performance**: Temporal decision making reduces LLM calls by 98.5% when context is stable (from research: arXiv:2406.12125). In high-frequency scenarios (60Hz), this means calling AI ~1 time per second instead of 60 times per second.

---

## Configuration

### API Keys

The package needs an API key to call AI models. Set it in a `.env` file:

```bash
# .env file
GEMINI_API_KEY=your-key-here
# or
OPENAI_API_KEY=your-key-here
# or
ANTHROPIC_API_KEY=your-key-here
```

**The package auto-loads `.env` files** - you don't need to do anything. Just create the file and set your key.

**Or set programmatically** (if you prefer):
```javascript
import { setConfig } from '@arclabs561/ai-visual-test';

setConfig({
  provider: 'gemini',
  apiKey: 'your-key-here'
});
```

**Which provider to use**:
- **Gemini**: Fast, cheap, good quality (recommended for most use cases)
- **OpenAI**: High quality, more expensive
- **Anthropic (Claude)**: High quality, good for complex reasoning
- **Groq**: Very fast, good for high-frequency scenarios (60Hz)

**For ensemble judging**: Use multiple providers. The system calls all of them and aggregates results.
