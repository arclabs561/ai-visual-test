# Interactive Experiences Testing

## Overview

This directory contains websites and evaluation scenarios specifically designed for testing **interactive experiences and gameplay**, not just static screenshots.

## What Makes Interactive Experiences Different?

### Static Screenshot Testing
- Single screenshot
- Single evaluation
- No temporal context
- No interaction testing

### Interactive Experience Testing
- Multiple screenshots over time
- Temporal aggregation of notes
- Persona-based experience testing
- Real-time interaction evaluation
- State change tracking
- Animation and transition analysis

## Interactive Experience Types

### 1. Gameplay (2 sites)
- **Cool Math Games** - Interactive game platform
- **Wordle** - Puzzle game

**Focus:**
- Game controls accessibility
- Real-time gameplay evaluation
- Score tracking
- Animation sequences

### 2. Interactive Apps (6 sites)
- **AutoDraw** - Drawing tool
- **Spotify** - Music player
- **Google Analytics** - Interactive dashboard
- **TurboTax** - Multi-step form
- **Khan Academy** - Learning platform
- **CodeSandbox** - Code playground

**Focus:**
- Interactive element accessibility
- Keyboard navigation
- Real-time feedback
- State management

### 3. Collaborative (2 sites)
- **Miro** - Collaborative whiteboard
- **Discord** - Real-time chat

**Focus:**
- Real-time collaboration
- Multi-user interactions
- Dynamic content updates
- Notification systems

## Usage

### Test Structure
```bash
# Test interactive experiences structure
node evaluation/test-interactive-experiences.mjs
```

### Run Evaluations
```bash
# Evaluate all interactive experiences
node evaluation/evaluate-interactive-experiences.mjs

# Evaluate specific type
import { evaluateAllInteractiveExperiences } from './evaluate-interactive-experiences.mjs';
await evaluateAllInteractiveExperiences({ experienceType: 'gameplay' });
```

### Combined Testing
```bash
# Test both challenging and interactive
node evaluation/test-all-experiences.mjs
```

## Persona-Based Testing

Each interactive website includes recommended personas:

**Common Personas:**
- Casual Gamer
- Accessibility Advocate
- Power User
- Keyboard User
- Screen Reader User

**Usage:**
```javascript
import { experiencePageAsPersona } from '../src/persona-experience.mjs';

const result = await experiencePageAsPersona(
  page,
  {
    name: 'Casual Gamer',
    goals: ['play game', 'understand controls'],
    concerns: ['ease of use', 'clear feedback']
  },
  {
    url: website.url
  }
);
```

## Temporal Features Used

### Actually Used in Interactive Testing:
- ✅ `experiencePageAsPersona` - Persona-based experience
- ✅ `aggregateTemporalNotes` - Temporal note aggregation
- ✅ `captureTemporalScreenshots` - Temporal screenshot capture
- ✅ `aggregateMultiScale` - Multi-scale temporal analysis
- ✅ `humanPerceptionTime` - Human-interpreted time scales

### Why Interactive Testing Needs These:
- **Temporal sequences** - Games and apps have state changes over time
- **Persona perspectives** - Different users interact differently
- **Multi-scale analysis** - Immediate reactions vs. long-term patterns
- **Human perception** - Realistic timing for interactions

## Comparison with Queeraoke

**Queeraoke Uses:**
- ✅ `aggregateTemporalNotes` - Temporal aggregation
- ✅ `captureTemporalScreenshots` - Temporal capture
- ✅ `multiPerspectiveEvaluation` - Multiple personas

**Interactive Experience Testing Uses:**
- ✅ All of the above
- ✅ `experiencePageAsPersona` - Full persona experience
- ✅ `aggregateMultiScale` - Multi-scale analysis
- ✅ `humanPerceptionTime` - Human timing

**Key Difference:**
- Queeraoke: Simple temporal aggregation (sufficient for gameplay)
- Interactive Testing: Full temporal decision-making (comprehensive evaluation)

## Test Results

### Structure Tests
- ✅ 10 interactive websites defined
- ✅ All experience types present (gameplay, interactive-app, collaborative)
- ✅ All websites have personas
- ✅ Proper difficulty distribution

### Prompt Tests
- ✅ Interactive prompts generated
- ✅ Prompts include challenges
- ✅ Prompts include experience types

### Integration Tests
- ✅ Combined with challenging websites
- ✅ Proper sorting by difficulty
- ✅ Experience type filtering works

## Adding New Interactive Websites

Add to `evaluation/interactive-experiences.mjs`:

```javascript
{
  id: 'unique-id',
  name: 'Website Name',
  url: 'https://example.com',
  difficulty: 'hard' | 'very-hard' | 'extreme' | 'expert' | 'nightmare',
  experienceType: 'gameplay' | 'interactive-app' | 'collaborative',
  challenges: [
    'Challenge 1',
    'Challenge 2'
  ],
  expectedScore: { min: 4, max: 7 },
  focusAreas: ['area1', 'area2'],
  personas: ['Persona 1', 'Persona 2']
}
```

## Key Features

1. **Persona-Based Testing** - Test from different user perspectives
2. **Temporal Analysis** - Track interactions over time
3. **Multi-Scale Aggregation** - Immediate vs. long-term patterns
4. **Interactive Focus** - Specifically designed for interactive elements
5. **Experience Types** - Gameplay, apps, collaborative tools


