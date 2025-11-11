# Challenging Websites Testing

## Overview

This directory contains progressively harder websites for testing the `ai-browser-test` system's ability to handle complex, challenging UI patterns and subtle accessibility issues.

## Difficulty Levels

### Medium Difficulty
- **Complex Dashboard** (Bloomberg) - Complex data tables, dynamic content
- **Complex E-commerce** (Etsy) - Multi-level navigation, dynamic listings

### Hard Difficulty
- **Complex News Site** (BBC) - Image carousels, dynamic content updates
- **Complex Portfolio** (Behance) - Image-heavy layouts, ambiguous link text

### Very Hard Difficulty
- **Government Portal** (USA.gov) - Complex forms, multi-step processes
- **Academic Portal** (arXiv) - Complex data tables, mathematical notation

### Extreme Difficulty
- **Social Media Platform** (Reddit) - Infinite scroll, dynamic comment threads
- **Video Platform** (YouTube) - Video player accessibility, complex controls

### Expert Difficulty
- **Financial Dashboard** (TradingView) - Complex data visualizations, real-time updates
- **Design Tool** (Figma) - Complex canvas interactions, custom controls

## Usage

### Test Structure
```bash
# Test challenging websites structure
node evaluation/test-challenging-websites.mjs
```

### Run Evaluations
```bash
# Evaluate all challenging websites
node evaluation/expert-evaluation-scenarios.mjs

# Or use the dedicated function
import { evaluateChallengingWebsites } from './expert-evaluation-scenarios.mjs';
await evaluateChallengingWebsites({ maxDifficulty: 'expert' });
```

### Progressive Testing
```bash
# Test progressively from medium to expert
node evaluation/run-challenging-tests.mjs
```

## Test Cases

Each website includes:
- **Challenges**: Specific UI patterns that make it difficult
- **Focus Areas**: What to evaluate (e.g., 'data-tables', 'navigation')
- **Expected Score Range**: Expected VLLM score range
- **Difficulty Level**: Progressive difficulty rating

## Validation

The test suite validates:
1. ✅ Website structure (all required fields)
2. ✅ Challenge prompt building
3. ✅ Difficulty filtering and sorting
4. ✅ Expected results structure
5. ✅ Progressive difficulty testing

## Results

Results are saved to `evaluation/results/challenging-websites-{timestamp}.json` with:
- Individual website evaluations
- Scores and issues detected
- Difficulty level
- Challenge-specific analysis
- Sequential context tracking

## Adding New Challenging Websites

Add to `evaluation/challenging-websites.mjs`:

```javascript
{
  id: 'unique-id',
  name: 'Website Name',
  url: 'https://example.com',
  difficulty: 'medium' | 'hard' | 'very-hard' | 'extreme' | 'expert',
  challenges: [
    'Challenge 1',
    'Challenge 2'
  ],
  expectedScore: { min: 4, max: 7 },
  focusAreas: ['area1', 'area2']
}
```

## Key Features

1. **Progressive Difficulty**: Test from medium to expert
2. **Challenge-Specific Prompts**: Custom prompts for each difficulty level
3. **Expected Results Validation**: Compare against expected score ranges
4. **Focus Area Tracking**: Track specific evaluation areas
5. **Sequential Context**: Maintain context across evaluations

