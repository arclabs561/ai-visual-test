# Downstream Use Cases and Original Motivation

## Original Motivation: Queeraoke

**Queeraoke** (https://queeraoke.fyi) is the original project that motivated this package. It's an interactive karaoke game that requires:

1. **Real-time gameplay validation** - 60Hz frame-by-frame validation during gameplay
2. **Variable goals** - Different evaluation criteria based on game state (fun, accessibility, visual clarity)
3. **Temporal sequences** - Understanding gameplay over time, not just single frames
4. **State validation** - Extracting game state (score, level, ball position) from screenshots
5. **Interactive experience testing** - Testing the full user journey, not just static screenshots
6. **Game playing** - Actually playing the game, not just testing it (NEW - implemented)

**Implementation Status:**
- ✅ Game testing (`testGameplay()`) - Validates gameplay screenshots
- ✅ Game playing (`playGame()`) - Actually plays games using validation + decision-making
- ✅ External iterator (`GameGym`) - RL Gym-style interface for advanced control
- ✅ Variable goals - Supports string, object, array, function goals
- ✅ Temporal sequences - Captures and analyzes gameplay over time
- ✅ State validation - Extracts game state from screenshots

### Queeraoke Requirements

**From `src/convenience.mjs` comments:**
- Better support for queeraoke-style game testing
- Better integration with queeraoke's game testing patterns
- Game activation key handling (e.g., 'g' for queeraoke)
- Game selector support (e.g., '#game-paddle' for queeraoke)
- Better game state extraction (handles queeraoke's gameState structure)

**From evaluation results:**
- Queeraoke-reactive-gameplay scenarios
- Blank white screen detection (non-functional game state)
- Gameplay element validation (lyrics, visual cues, player feedback, background)

## Downstream Use Cases

### 1. Interactive Games (Primary Use Case)

**Examples:**
- Queeraoke (karaoke game)
- 2048 (puzzle game)
- Snake (classic game)
- Wordle (puzzle game)
- Interactive drawing tools
- Real-time collaborative games

**Requirements:**
- **High-frequency validation** (10-60Hz) for real-time gameplay
- **Variable goals** based on game state (fun, accessibility, performance)
- **Temporal sequences** to understand gameplay over time
- **State extraction** from screenshots (score, level, position)
- **Fast latency** (<100ms) for reactive games

**What this package provides:**
- `testGameplay()` - Complete workflow for game testing
- `validateWithGoals()` - Variable goal specification
- `captureTemporalScreenshots()` - Temporal sequence capture
- `LatencyAwareBatchOptimizer` - Fast validation for 60Hz games
- `selectModelTier()` - Automatic fast tier for high-frequency decisions

### 2. Interactive Applications

**Examples:**
- Real-time collaboration tools (Miro, Figma)
- Live chat applications
- Streaming dashboards
- Interactive forms with real-time validation
- Drag-and-drop interfaces
- Auto-complete/search interfaces

**Requirements:**
- **Real-time feedback** (<100ms latency)
- **State validation** (form state, UI state)
- **Temporal understanding** (user journey, interaction sequences)
- **Accessibility validation** (keyboard navigation, screen reader support)

**What this package provides:**
- `testBrowserExperience()` - Multi-stage user flow testing
- `validateStateSmart()` - Automatic state validation (programmatic or VLLM)
- `experiencePageAsPersona()` - Persona-based experience testing
- `aggregateMultiScale()` - Multi-scale temporal analysis

### 3. Accessibility Auditing

**Examples:**
- WCAG compliance checking
- Contrast ratio validation
- Keyboard navigation testing
- Screen reader compatibility
- Form accessibility validation

**Requirements:**
- **Fast programmatic checks** (<100ms) when page available
- **VLLM semantic evaluation** when only screenshot available
- **Comprehensive coverage** (WCAG A, AA, AAA)
- **Critical validation** (legal compliance, user exclusion prevention)

**What this package provides:**
- `validateAccessibilitySmart()` - Automatic validator selection
- `checkElementContrast()` - Fast programmatic contrast check
- `shouldUseSelfConsistency()` - Critical scenarios get N=5 self-consistency
- `selectModelTier()` - Best tier for critical accessibility evaluations

### 4. Design System Validation

**Examples:**
- Brutalist design validation (21:1 contrast requirement)
- Minimal design validation
- Typography expert evaluation
- Color theory expert evaluation
- Information architecture evaluation

**Requirements:**
- **Design principle validation** (brutalist, minimal, etc.)
- **Expert-level evaluation** (typography, color, IA)
- **Multi-scale temporal analysis** (immediate, short, medium, long)
- **Persona-based testing** (different perspectives)

**What this package provides:**
- `validateWithExplicitRubric()` - Design principle validation
- `experiencePageAsPersona()` - Persona-based evaluation
- `aggregateMultiScale()` - Multi-scale analysis (0.1s, 1s, 10s, 60s)
- `createEnhancedPersona()` - Expert persona creation

### 5. Continuous Integration / Visual Regression

**Examples:**
- Nightly test suites (5,000+ screenshot validations)
- Component variant comparison (100+ variants)
- User flow validation (50+ steps)
- Visual regression detection

**Requirements:**
- **High-volume validation** (thousands of screenshots)
- **Cost-effective** (batch optimization, caching)
- **Fast execution** (fits in CI window)
- **Reliable results** (consistent scoring, issue detection)

**What this package provides:**
- `BatchOptimizer` - Queuing, batching, caching for high volume
- `Cache` - Persistent caching with LRU eviction
- `selectModelTier()` - Fast tier for cost-sensitive operations
- `selectProvider()` - Automatic provider selection (Groq for speed/cost)

### 6. User Flow Validation

**Examples:**
- End-to-end user journey (50+ steps)
- Multi-stage workflows
- Form completion flows
- Checkout processes
- Onboarding sequences

**Requirements:**
- **Temporal understanding** (user journey over time)
- **State validation** (form state, navigation state)
- **Experience tracing** (full traceability)
- **Persona-based testing** (different user types)

**What this package provides:**
- `testBrowserExperience()` - Multi-stage workflow testing
- `ExperienceTrace` - Complete trace of user journey
- `experiencePageAsPersona()` - Persona-based experience
- `aggregateTemporalNotes()` - Temporal aggregation with coherence checking

## What Should Motivate Core Features

### 1. High-Frequency Decisions (10-60Hz)

**Motivation:** Queeraoke and other interactive games need real-time validation at 60Hz.

**Core Features:**
- `LatencyAwareBatchOptimizer` - Bypasses batching for <100ms requests
- `selectModelTier()` - Auto-selects fast tier for high-frequency
- `selectProvider()` - Auto-selects Groq for ultra-fast/cost-sensitive
- `captureTemporalScreenshots()` - High-FPS capture (1-60fps+)

**Dataset Requirements:**
- Real gameplay sequences (2048, Snake, Queeraoke)
- High-FPS temporal sequences
- Interactive experience scenarios

### 2. Variable Goals

**Motivation:** Games need different evaluation criteria based on game state (fun, accessibility, performance).

**Core Features:**
- `validateWithGoals()` - Variable goal specification (string, object, array, function)
- `generateGamePrompt()` - Goal-based prompt generation
- `createGameGoal()` - Predefined goal templates
- `testGameplay()` - Complete game testing workflow

**Dataset Requirements:**
- Game state examples (score, level, position)
- Variable goal scenarios
- Good vs. bad game examples

### 3. Temporal Sequences

**Motivation:** Understanding gameplay over time, not just single frames.

**Core Features:**
- `captureTemporalScreenshots()` - Temporal sequence capture
- `aggregateTemporalNotes()` - Temporal aggregation with coherence
- `aggregateMultiScale()` - Multi-scale temporal analysis
- `TemporalPreprocessingManager` - Activity-based preprocessing

**Dataset Requirements:**
- Animation sequences
- Gameplay sequences (multiple frames)
- State change sequences
- User interaction sequences

### 4. State Validation

**Motivation:** Extracting game state (score, level, ball position) from screenshots.

**Core Features:**
- `validateStateSmart()` - Automatic state validation (programmatic or VLLM)
- `validateStateProgrammatic()` - Fast programmatic state validation
- `extractRenderedCode()` - HTML/CSS extraction for state understanding

**Dataset Requirements:**
- Game state examples (score, level, position)
- Form state examples
- UI state examples (modals, dropdowns)
- Navigation state examples

### 5. Interactive Experience Testing

**Motivation:** Testing the full user journey, not just static screenshots.

**Core Features:**
- `testBrowserExperience()` - Multi-stage workflow testing
- `experiencePageAsPersona()` - Persona-based experience
- `ExperienceTrace` - Complete trace of user journey
- `humanPerceptionTime()` - Realistic timing for human perception

**Dataset Requirements:**
- Multi-stage user flows
- Persona-based scenarios
- Interactive experience examples
- Real-world website examples

## Missing or Not Well-Supported Use Cases

### 1. Mobile Views

**Gap:** Current dataset is all desktop (1280x720).

**Needed:**
- Mobile screenshots (375x667, 390x844, etc.)
- Responsive design validation
- Touch interaction testing
- Mobile accessibility validation

### 2. Bad Examples

**Gap:** Current dataset is all good examples (GitHub, MDN, W3C).

**Needed:**
- Low contrast sites
- Poor keyboard navigation
- Missing accessibility features
- Outdated design patterns
- Error states (404, empty, loading)

### 3. Dynamic Content

**Gap:** Limited dynamic content examples.

**Needed:**
- Feeds with timestamps
- User-specific data
- Real-time updates
- Timezone-dependent content

### 4. Design Principles

**Gap:** Limited design principle examples.

**Needed:**
- Brutalist design examples (21:1 contrast)
- Minimal design examples
- Complex layout examples
- Typography expert examples
- Color theory examples

### 5. Temporal Sequences

**Gap:** Limited temporal sequence examples.

**Needed:**
- Animation sequences (multiple frames)
- Gameplay sequences (2048, Snake, Queeraoke)
- State change sequences
- User interaction sequences

## Recommendations

### 1. Expand Dataset Based on Downstream Use Cases

**Priority 1 (Critical for Queeraoke):**
- Real gameplay sequences (2048, Snake, Queeraoke)
- High-FPS temporal sequences (60fps)
- Game state examples (score, level, position)
- Variable goal scenarios

**Priority 2 (Important for Interactive Apps):**
- Mobile views (375x667, 390x844)
- Real-time collaboration examples
- Interactive form examples
- Drag-and-drop examples

**Priority 3 (Important for Accessibility):**
- Bad examples (low contrast, poor navigation)
- WCAG violation examples
- Error states (404, empty, loading)
- Screen reader compatibility examples

### 2. Improve Core Features for Downstream Use Cases

**For Queeraoke:**
- Better game state extraction
- Better game activation handling
- Better temporal sequence support
- Better variable goal support

**For Interactive Apps:**
- Better real-time feedback (<100ms)
- Better state validation
- Better temporal understanding
- Better accessibility validation

**For CI/Visual Regression:**
- Better high-volume support (caching, batching)
- Better cost optimization (Groq integration)
- Better reliability (self-consistency for critical)

### 3. Document Downstream Use Cases

**Create:**
- `docs/DOWNSTREAM_USE_CASES.md` - Comprehensive use case documentation
- `examples/queeraoke/` - Queeraoke integration examples
- `examples/games/` - Game testing examples
- `examples/interactive-apps/` - Interactive app examples

## Conclusion

**Original Motivation:** Queeraoke (https://queeraoke.fyi) - interactive karaoke game requiring real-time gameplay validation, variable goals, temporal sequences, state validation, and interactive experience testing.

**Implementation Status:**
- ✅ **Game testing** - `testGameplay()` validates gameplay screenshots
- ✅ **Game playing** - `playGame()` actually plays games (NEW)
- ✅ **External iterator** - `GameGym` for RL integration (NEW)
- ✅ **Variable goals** - `validateWithGoals()`, `generateGamePrompt()`
- ✅ **Temporal sequences** - `captureTemporalScreenshots()`, `aggregateTemporalNotes()`
- ✅ **State validation** - `validateStateSmart()`, `extractRenderedCode()`
- ✅ **Interactive experience** - `testBrowserExperience()`, `experiencePageAsPersona()`
- ✅ **High-frequency decisions** - Fast tier, Groq integration, `selectModelTier()`

**Downstream Use Cases:**
1. Interactive games (Queeraoke, 2048, Snake, Wordle) - ✅ Supported
2. Interactive applications (Miro, Figma, live chat) - ✅ Supported
3. Accessibility auditing (WCAG compliance) - ✅ Supported
4. Design system validation (brutalist, minimal, typography) - ✅ Supported
5. CI/Visual regression (high-volume testing) - ✅ Supported
6. User flow validation (end-to-end journeys) - ✅ Supported

**What Should Motivate Core Features:**
- High-frequency decisions (10-60Hz) → Fast tier, Groq integration ✅
- Variable goals → `validateWithGoals()`, `generateGamePrompt()` ✅
- Temporal sequences → `captureTemporalScreenshots()`, `aggregateTemporalNotes()` ✅
- State validation → `validateStateSmart()`, `extractRenderedCode()` ✅
- Interactive experience testing → `testBrowserExperience()`, `experiencePageAsPersona()` ✅
- Game playing → `playGame()`, `GameGym` ✅ (NEW)

**Dataset Gaps (Still Missing):**
- Mobile views (all desktop currently)
- Bad examples (all good currently)
- Dynamic content (feeds, timestamps)
- Design principles (brutalist, minimal examples)
- Temporal sequences (animation frames, gameplay sequences)

