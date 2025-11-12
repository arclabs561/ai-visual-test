# Human Validation for Queeraoke

## Quick Start

### 1. Setup (One Time)

Run the setup script to create the integration file:

```bash
node evaluation/setup-queeraoke-human-validation.mjs
```

This creates `human-validation-setup.mjs` in the Queeraoke directory.

### 2. Enable in Your Tests

Add to the top of your test files:

```javascript
import { initQueeraokeHumanValidation } from './human-validation-setup.mjs';

// Initialize at the start
initQueeraokeHumanValidation();
```

### 3. Use Normally

All your existing `validateScreenshot()` calls will automatically:
- Collect VLLM judgments
- Request human validation for interesting cases
- Apply calibration when available

**No code changes needed!** Just initialize and it works.

## Queeraoke Usage Patterns Supported

### 1. Interactive Gameplay Testing

```javascript
// Your existing code
const evaluations = await multiPerspectiveEvaluation(
  validateVLLM,
  screenshotPath,
  renderedCode,
  gameState
);

// Temporal aggregation
const aggregated = aggregateTemporalNotes(notes);

// Final evaluation (human validation collected automatically)
const result = await validateScreenshot(
  finalScreenshot,
  prompt,
  {
    testType: 'queeraoke-interactive-gameplay',
    temporalNotes: aggregated
  }
);
```

### 2. Reactive Gameplay Testing

```javascript
// Capture temporal screenshots
const screenshots = await captureTemporalScreenshots(page, 2, 5000);

// Evaluate each (human validation collected automatically)
for (const screenshot of screenshots) {
  const result = await validateScreenshot(
    screenshot.path,
    'Evaluate gameplay frame',
    {
      testType: 'queeraoke-reactive-gameplay',
      enableHumanValidation: true // Enabled by default
    }
  );
}
```

### 3. Multi-Perspective Evaluation

```javascript
// Your existing personas
const personas = [
  { name: 'Casual Gamer', goals: ['fun'], concerns: ['enjoyment'] },
  { name: 'Accessibility Advocate', goals: ['accessibility'], concerns: ['keyboard'] }
];

// Multi-perspective (human validation collected for each)
const evaluations = await multiPerspectiveEvaluation(
  validateVLLM,
  screenshotPath,
  renderedCode,
  gameState,
  personas
);
```

## Custom Human Validator

Implement your own human validator function:

```javascript
import { initQueeraokeHumanValidation } from './human-validation-setup.mjs';

initQueeraokeHumanValidation({
  humanValidatorFn: async (vllmJudgment) => {
    // Your UI to collect human feedback
    // Show screenshot, VLLM judgment, collect human input
    
    return {
      score: humanScore, // 0-10
      issues: humanIssues, // string[]
      reasoning: humanReasoning, // string
      evaluatorId: 'reviewer-id' // optional
    };
  }
});
```

## Check Calibration Status

```javascript
import { getQueeraokeCalibrationStatus } from './human-validation-setup.mjs';

const status = getQueeraokeCalibrationStatus();

if (status.calibrated) {
  console.log(`Correlation: ${status.correlation}`);
  console.log(`Kappa: ${status.kappa}`);
  console.log(`Status: ${status.isGood ? 'Good' : 'Needs Improvement'}`);
}
```

## Manual Calibration

```javascript
import { calibrateQueeraokeHumanValidation } from './human-validation-setup.mjs';

const result = await calibrateQueeraokeHumanValidation();

if (result.success) {
  console.log(`Calibrated with ${result.sampleSize} judgments`);
}
```

## What Gets Collected

The system automatically collects:
- **VLLM judgments**: All `validateScreenshot()` results
- **Human validations**: For interesting cases (edge scores, many issues, etc.)
- **Test context**: Test type, personas, game state, temporal notes

## Smart Sampling

Human validation is requested for:
- Edge cases (score ≤ 3 or ≥ 9)
- Many issues (≥ 5 issues)
- Low score with no issues (potential under-detection)
- Random 10% of normal cases

This focuses human review effort on the most valuable cases.

## Benefits for Queeraoke

1. **Zero overhead**: Doesn't slow down tests
2. **Automatic**: No code changes needed
3. **Learning**: Improves accuracy over time
4. **Smart**: Focuses on interesting cases
5. **Integrated**: Works with all Queeraoke patterns

## Files Created

- `human-validation-setup.mjs` - Integration file for Queeraoke
- `evaluation/human-validation/` - Collected judgments and calibration data

## Next Steps

1. Run setup script
2. Add `initQueeraokeHumanValidation()` to your test files
3. Implement your human validator UI
4. Run tests - data collected automatically
5. Check calibration status periodically

The system will automatically calibrate after 10+ human judgments are collected!

