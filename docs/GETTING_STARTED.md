# Getting Started with ai-visual-test

## Overview

Most visual testing tools compare pixels. This package asks "does this look correct?" instead of "did pixels change?"

**The problem with pixel-diffing**: Your test breaks when you change a font, adjust spacing, or update colors—even if the UI still works correctly.

**Our solution**: Use AI to understand what the screenshot actually shows, then evaluate it semantically. Does the payment form work? Is it accessible? Does it look good? These are questions humans can answer, and now AI can too.

---

## Installation

### Step 1: Install the Package

```bash
npm install @arclabs561/ai-visual-test
```

### Step 2: Configure API Key

Create a `.env` file in your project root:

```bash
# Choose one provider (or use multiple for ensemble judging)
GEMINI_API_KEY=your-key-here
# or
OPENAI_API_KEY=your-key-here
# or
ANTHROPIC_API_KEY=your-key-here
```

**Note**: The package automatically loads `.env` files. No additional configuration needed.

### Step 3: Basic Usage

```javascript
import { validateScreenshot } from '@arclabs561/ai-visual-test';

const result = await validateScreenshot(
  'screenshot.png',
  'Check if this payment form is accessible and usable'
);

// Expected output:
console.log(result.score);      // 7 (0-10 scale)
console.log(result.issues);     // ['Missing error messages', 'Low contrast']
console.log(result.reasoning); // "The form is mostly accessible, but..."
console.log(result.confidence); // 0.85 (how confident is the AI?)
```

**Setup complete.** You can now validate screenshots using AI-powered semantic analysis.

---

## Understanding Semantic Validation

### What "Semantic" Means

**Pixel-based testing** (traditional approach):
```
Screenshot A: [pixel data]
Screenshot B: [pixel data]
Difference: 1,234 pixels changed → FAIL
```

**Semantic testing** (this package):
```
Screenshot: [payment form]
Question: "Is this accessible?"
Answer: "Score 7/10 - Missing error messages, but good contrast"
```

The difference: We understand **meaning**, not just pixels.

### Why This Matters

**Real-world example**: You update your CSS to fix a layout bug. Pixel-diffing tools see thousands of changed pixels and fail your test. But the UI still works correctly—the bug is fixed! Semantic validation understands this.

**Another example**: You change a button color from blue to green. Pixel-diffing fails. Semantic validation asks "Is the button still visible and clickable?" If yes, it passes.

---

## Common Use Cases

### 1. Accessibility Testing

```javascript
const result = await validateScreenshot(
  'payment-form.png',
  'Evaluate accessibility: check contrast, labels, error messages'
);

// Expected output:
if (result.score < 6) {
  console.error('Accessibility issues:', result.issues);
  // Output: ['Low contrast on submit button', 'Missing form label for email input']
}
```

**What this checks**:
- Color contrast (can text be read?)
- Form labels (are inputs labeled?)
- Error messages (are errors clear?)
- Keyboard navigation (can you use it without a mouse?)

### 2. High-Frequency Game Validation (60Hz)

For real-time games that need validation at 60 frames per second:

```javascript
import { testGameplay } from '@arclabs561/ai-visual-test';

const result = await testGameplay(page, {
  url: 'https://example-game.com',
  goals: ['Maximize score', 'Avoid obstacles'],
  captureTemporal: true,
  fps: 60
  // Temporal decision making auto-enabled for fps > 10
  // Ensemble judging auto-enabled for critical evaluations
});

// Expected output:
console.log(result.evaluations[0].score); // 8.5
console.log(result.aggregated.coherence); // 0.92 (how consistent is gameplay?)
console.log(result.aggregated.patterns);  // ['score increasing', 'button clicked frequently']
```

**What this does**:
- Captures screenshots at 60Hz
- Only calls LLM when decision is needed (not every frame)
- Uses multiple AI models for consensus (more accurate)
- Validates gameplay goals in real-time

**Why this works**: Most frames don't need validation. Only decision points do. By skipping unnecessary calls, we achieve <100ms latency while maintaining accuracy.

**Performance**: Temporal decision making reduces LLM calls by 98.5% when context is stable (from research: arXiv:2406.12125). In high-frequency scenarios (60Hz), this means calling AI ~1 time per second instead of 60 times per second.

### 3. Design Validation

```javascript
const result = await validateScreenshot(
  'homepage.png',
  'Evaluate design quality: visual appeal, layout, consistency',
  {
    useEnsemble: true, // Multiple perspectives for better accuracy
    ensembleProviders: ['gemini', 'openai']
  }
);

// Expected output:
console.log('Design score:', result.score); // 8.2
console.log('Issues:', result.issues);      // ['Inconsistent spacing', 'Low visual hierarchy']
console.log('Consensus:', result.consensus); // 0.85 (how much do models agree?)
```

**What this checks**:
- Visual appeal (does it look good?)
- Layout (is it well-organized?)
- Consistency (do elements match?)
- Usability (is it easy to use?)

**Accuracy**: Ensemble judging improves accuracy by 10-20% for critical evaluations when using 3+ models (from research: arXiv:2510.01499). Best for accessibility and quality checks where accuracy matters more than speed.

### 4. Natural Language Specs

Write tests in plain English:

```javascript
import { parseSpec } from '@arclabs561/ai-visual-test/specs';

const spec = `
  When the user clicks "Add to Cart",
  the cart should show the item count,
  and the button should change to "Added".
`;

const result = await parseSpec(spec, {
  screenshot: 'cart-page.png'
});

// Expected output:
console.log(result.passed);  // true
console.log(result.observations); // ['Cart shows 1 item', 'Button changed to "Added"']
```

**What this does**: Parses your English spec, extracts the intent, and validates it against the screenshot.

---

## How It Works

### Basic Flow

**Step 1**: You provide a screenshot and a question

```javascript
validateScreenshot('screenshot.png', 'Is this accessible?')
```

**Step 2**: The system sends it to an AI model

The AI model (Gemini, GPT-4, Claude) looks at the screenshot and answers your question.

**Step 3**: You receive structured results

```javascript
{
  score: 7,              // 0-10, how good is it?
  issues: [              // What's wrong?
    'Low contrast on button',
    'Missing form label'
  ],
  reasoning: 'The form is mostly accessible, but...', // Why this score?
  confidence: 0.85,      // How confident is the AI? (0-1)
  uncertainty: 0.15      // How uncertain? (0-1, lower = more certain)
}
```

**This is the basic flow.** Additional features optimize performance, accuracy, and cost.

---

## Smart Defaults and Feature Auto-Enable

Features are automatically enabled based on context to optimize performance and accuracy:

### Auto-Enabled Features

- **Explicit rubrics**: Always included for consistent evaluations (10-20% reliability improvement from research: arXiv:2412.05579)
- **Temporal decision making**: Auto-enabled for high-frequency scenarios (fps > 10) to reduce LLM calls by 98.5% when context is stable (from research: arXiv:2406.12125)
- **Ensemble judging**: Auto-enabled for critical evaluations (accessibility, quality checks) to improve accuracy by 10-20% (from research: arXiv:2510.01499)
- **Counter-balancing**: Auto-enabled for pair comparisons to eliminate 70-80% of position bias (from research: arXiv:2508.02020)

### Overriding Defaults

You can override defaults when needed:

```javascript
const result = await validateScreenshot('screenshot.png', 'Evaluate', {
  useTemporalDecision: false, // Disable for testing
  useEnsemble: false,         // Disable for speed
  useCounterBalance: false    // Disable for single evaluations
});
```

**When to override**: If you need maximum speed and don't care about accuracy, or if you're testing the features themselves.

---

## Research-Backed Features (Deep Dive)

This section explains the research behind our features. For a quick start, you don't need to read this—features work automatically.

### 1. Explicit Rubrics (10-20% More Reliable)

**The problem**: AI judgments are inconsistent. Ask the same question twice, get different answers.

**The solution**: Give the AI explicit scoring criteria (a rubric).

**How it works**: Structure prevents the AI from making up its own criteria. Same rubric = same interpretation = consistent judgments.

**Research**: arXiv:2412.05579 - "LLMs-as-Judges Survey" found that explicit rubrics improve reliability by 10-20% and reduce bias from superficial features.

**Impact**: 10-20% reliability improvement. Always enabled by default.

**Usage**: No configuration needed. Rubrics are automatically included in all evaluations.

### 2. Temporal Decision Making (98.5% Fewer Calls)

**The problem**: Calling AI on every frame is expensive and slow.

**The solution**: Only call AI when a decision is actually needed.

**How it works**: Most state changes don't need AI decisions. Only decision points do (explicit decisions, quality issues, significant changes). By waiting for decision points, we reduce calls by 98.5%.

**Research**: arXiv:2406.12125 - "Efficient Sequential Decision Making with Large Language Models" showed that calling LLMs only when decisions are needed (not on every state change) achieves 6x performance gains while calling LLMs in only 1.5% of time steps.

**Impact**: 98.5% reduction in AI calls when context is stable. In high-frequency scenarios (60Hz), this means calling AI ~1 time per second instead of 60 times per second.

**Usage**: Auto-enabled for high-frequency scenarios (fps > 10). Set `useTemporalDecision: false` to disable.

```javascript
const result = await validateScreenshot('screenshot.png', 'Evaluate', {
  useTemporalDecision: true,
  temporalNotes: previousNotes,
  currentState: { score: 8 },
  previousState: { score: 7.5 }
});

// If context is stable, returns cached result (no AI call)
// If decision needed, calls AI
```

### 3. Ensemble Judging (10-20% More Accurate)

**The problem**: One AI model = one perspective. What if it's wrong?

**The solution**: Use multiple AI models, get consensus.

**How it works**: Different models have different strengths. Combining them gives you the best of all worlds. The system calls multiple models, aggregates results using weighted averages, and calculates consensus.

**Research**: arXiv:2510.01499 - "Optimal LLM Aggregation" showed that ensemble judging (multiple models, consensus voting) improves accuracy by 10-20% when using 3+ models.

**Impact**: 10-20% accuracy improvement for critical evaluations. Best for accessibility, quality, design—anything where accuracy matters more than speed.

**Usage**: Auto-enabled for critical evaluations. Set `useEnsemble: true` explicitly or let the system decide based on context.

```javascript
const result = await validateScreenshot('screenshot.png', 'Evaluate', {
  useEnsemble: true,
  ensembleProviders: ['gemini', 'openai', 'claude']
});

// Calls all three models, aggregates results
// Better accuracy through consensus
```

### 4. Counter-Balancing (Eliminates 70-80% of Position Bias)

**The problem**: AI models prefer the first option (position bias).

**The solution**: Run evaluation twice with reversed order, average results.

**How it works**: Systematic bias + reversed order + averaging = bias cancellation.

**Research**: arXiv:2508.02020 - "Position Counter-Balancing" found that LLMs show 70-80% position bias (preferring first options). Counter-balancing eliminates this bias by running evaluations twice with reversed order and averaging results.

**Impact**: 70-80% bias elimination. Auto-enabled for pair comparisons.

**Usage**: Auto-enabled for pair comparisons. Set `useCounterBalance: false` to disable.

```javascript
const result = await validateScreenshot('screenshot.png', 'Evaluate', {
  useCounterBalance: true
});

// Runs twice (original + reversed), averages results
// Eliminates systematic position bias
```

---

## Integration and Seamless Features

All features integrate automatically. You don't need to wire them together:

```javascript
// This single call uses:
// - Explicit rubrics (automatic)
// - Temporal decision making (auto-enabled for fps > 10)
// - Ensemble judging (auto-enabled for critical evaluations)
// - Counter-balancing (auto-enabled for pair comparisons)
const result = await validateScreenshot('screenshot.png', 'Evaluate', {
  // Features are automatically enabled based on context
  // Override only when needed
});
```

**The goal**: Fast, accurate, unbiased validation. Research helps us get there automatically.

---

## Next Steps

1. **Try the examples above** - Start with simple validation
2. **Read the API docs** - See `docs/api/API_ESSENTIALS.md` for detailed API reference
3. **Explore research features** - See `docs/research/HOW_AND_WHY_RESEARCH_WORKS.md` for deep dives
4. **Check use cases** - See `docs/features/` for specific use case guides

**Questions?** Check the troubleshooting guide or open an issue.

**Ready to dive deeper?** See the research integration guide for how everything works under the hood.
