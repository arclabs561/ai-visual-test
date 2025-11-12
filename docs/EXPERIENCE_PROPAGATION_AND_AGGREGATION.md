# Experience Propagation and Aggregation

## Core Philosophy

**HTML + CSS is Experience** - Not just screenshots. The rendered code (HTML structure, CSS styling, DOM state) is part of the complete browser experience.

**Experience Propagates** - Experience flows through the system: capture → notes → aggregation → context → evaluation → propagation.

**Experience Aggregates** - Multiple experiences combine temporally, across personas, and across modalities to form complete understanding.

## The Complete Experience

### What Constitutes Experience

1. **Screenshots** (Visual Sense)
   - What the browser looks like
   - Visual state at a moment in time
   - Captured via `page.screenshot()`

2. **HTML + CSS** (Structural Sense)
   - How the browser is structured
   - Semantic HTML, computed CSS, DOM structure
   - Captured via `extractRenderedCode()`

3. **State** (Internal Sense)
   - Game state, page state, application state
   - Internal state of the browser/application
   - Captured via `page.evaluate()`

4. **Temporal Context** (Sequence Sense)
   - How experience changes over time
   - Sequences of screenshots, notes, interactions
   - Captured via `captureTemporalScreenshots()` and `ExperienceTrace`

### How Experience is Captured

```javascript
// In experiencePageAsPersona()
const experience = {
  // Visual experience (screenshots)
  screenshots: [
    { path: 'page-load.png', step: 'page-load', timestamp: ... },
    { path: 'after-reading.png', step: 'after-reading', timestamp: ... }
  ],
  
  // Structural experience (HTML/CSS)
  renderedCode: {
    html: '<html>...</html>',
    criticalCSS: { '#button': { color: 'red', ... } },
    domStructure: { button: { exists: true, position: {...} } }
  },
  
  // State experience
  pageState: {
    title: 'Game Page',
    viewport: { width: 1280, height: 720 },
    darkMode: false
  },
  
  // Temporal experience (notes)
  notes: [
    {
      step: 'initial_experience',
      observation: 'Arrived at page',
      renderedCode: { html: '...' }, // HTML/CSS included in notes
      pageState: {...},
      timestamp: ...,
      elapsed: ...
    }
  ]
};
```

## Experience Propagation

### Flow: Capture → Notes → Trace → Aggregation → Context → Evaluation

```
1. Capture Experience
   ↓
2. Create Notes (with HTML/CSS/State)
   ↓
3. Add to Trace (ExperienceTrace)
   ↓
4. Aggregate Notes (temporal aggregation)
   ↓
5. Format for Context (prompt inclusion)
   ↓
6. Use in Evaluation (validateScreenshot with context)
   ↓
7. Propagate to Next Step (sequential context)
```

### 1. Capture Experience

**Location**: `src/persona-experience.mjs`

```javascript
// Capture all modalities
const screenshot = await page.screenshot(); // Visual
const renderedCode = await extractRenderedCode(page); // HTML/CSS
const pageState = await page.evaluate(() => ({ ... })); // State
```

**Key Point**: All three modalities (screenshot, HTML/CSS, state) are captured together as part of the experience.

### 2. Create Notes

**Location**: `src/persona-experience.mjs`

```javascript
const initialNote = {
  step: 'initial_experience',
  observation: `Arrived at page - ${pageState?.title || 'unknown'}`,
  pageState, // State included
  renderedCode: renderedCode ? { html: renderedCode.html?.substring(0, 500) } : null, // HTML/CSS included
  timestamp: Date.now(),
  elapsed: Date.now() - startTime
};
experienceNotes.push(initialNote);
```

**Key Point**: Notes include HTML/CSS (`renderedCode`) as part of the experience, not just screenshots.

### 3. Add to Trace

**Location**: `src/experience-tracer.mjs`

```javascript
// If trace provided, add experience to trace
if (trace) {
  trace.addEvent('observation', {
    step: 'initial_experience',
    observation: initialNote.observation,
    pageState: initialNote.pageState,
    renderedCode: initialNote.renderedCode // HTML/CSS propagated to trace
  });
  if (pageState) {
    trace.addStateSnapshot(pageState, 'initial_experience');
  }
}
```

**Key Point**: Experience (including HTML/CSS) propagates to `ExperienceTrace` for full traceability.

### 4. Aggregate Notes

**Location**: `src/temporal.mjs`, `src/temporal-decision.mjs`

```javascript
// Aggregate temporal notes (includes HTML/CSS from notes)
const aggregated = aggregateTemporalNotes(experience.notes, {
  windowSize: 10000,
  decayFactor: 0.9
});

// Or multi-scale aggregation
const aggregated = aggregateMultiScale(experience.notes, {
  timeScales: {
    immediate: 100,
    short: 1000,
    medium: 10000,
    long: 60000
  }
});
```

**Key Point**: Aggregation preserves HTML/CSS context from notes, allowing temporal understanding of structural changes.

### 5. Format for Context

**Location**: `src/temporal.mjs`, `src/prompt-composer.mjs`

```javascript
// Format aggregated notes for prompt inclusion
const formattedNotes = formatNotesForPrompt(aggregated);
// Result includes HTML/CSS context from notes

// Or use prompt composer
const prompt = composeSingleImagePrompt(basePrompt, {
  temporalNotes: aggregated, // Includes HTML/CSS from notes
  renderedCode: experience.renderedCode, // Direct HTML/CSS
  gameState: experience.pageState
});
```

**Key Point**: HTML/CSS propagates through aggregation and formatting into evaluation context.

### 6. Use in Evaluation

**Location**: `src/multi-modal.mjs`, `src/judge.mjs`

```javascript
// Multi-modal validation with HTML/CSS
const result = await validateScreenshot(screenshotPath, prompt, {
  renderedCode: experience.renderedCode, // HTML/CSS context
  temporalNotes: aggregated, // Temporal context (includes HTML/CSS from notes)
  gameState: experience.pageState
});

// Or use multi-modal fusion
const fusionPrompt = buildStructuredFusionPrompt(prompt, {
  screenshot: screenshotPath,
  renderedCode: experience.renderedCode, // HTML/CSS as separate modality
  gameState: experience.pageState
});
```

**Key Point**: HTML/CSS is used in evaluation both directly (`renderedCode`) and through temporal context (`temporalNotes`).

### 7. Propagate to Next Step

**Location**: `src/temporal-decision.mjs`, `src/experience-tracer.mjs`

```javascript
// Sequential context propagation
const sequentialContext = new SequentialDecisionContext({
  maxHistory: 10
});

// Add decision to context
sequentialContext.addDecision({
  prompt: prompt,
  result: evaluation,
  context: {
    renderedCode: experience.renderedCode, // HTML/CSS propagated
    temporalNotes: aggregated
  }
});

// Next evaluation uses this context
const nextPrompt = sequentialContext.adaptPrompt(nextPrompt, {
  renderedCode: previousExperience.renderedCode // HTML/CSS from previous step
});
```

**Key Point**: HTML/CSS propagates through sequential context to inform future evaluations.

## Experience Aggregation

### Types of Aggregation

1. **Temporal Aggregation** - Aggregates experience over time
2. **Multi-Scale Aggregation** - Aggregates at multiple time scales
3. **Multi-Modal Aggregation** - Aggregates across modalities (screenshot + HTML/CSS + state)
4. **Multi-Perspective Aggregation** - Aggregates across personas
5. **Cross-Session Aggregation** - Aggregates across multiple experiences

### 1. Temporal Aggregation

**Location**: `src/temporal.mjs`

```javascript
// Aggregate notes over time windows
const aggregated = aggregateTemporalNotes(experience.notes, {
  windowSize: 10000, // 10 second windows
  decayFactor: 0.9 // Exponential decay
});

// Result includes HTML/CSS from notes
// aggregated.windows[0].notes[0].renderedCode
```

**How HTML/CSS Aggregates**:
- HTML/CSS from each note is preserved in aggregated windows
- Structural changes over time are visible in aggregated notes
- Coherence analysis considers HTML/CSS consistency

### 2. Multi-Scale Aggregation

**Location**: `src/temporal-decision.mjs`

```javascript
// Aggregate at multiple time scales
const aggregated = aggregateMultiScale(experience.notes, {
  timeScales: {
    immediate: 100,   // 0.1s - instant reactions
    short: 1000,       // 1s - quick assessments
    medium: 10000,     // 10s - detailed evaluation
    long: 60000       // 60s - comprehensive review
  }
});

// HTML/CSS aggregated at each scale
// aggregated.scales.immediate.windows[0].notes[0].renderedCode
```

**How HTML/CSS Aggregates**:
- HTML/CSS aggregated at each time scale
- Immediate scale: recent HTML/CSS changes
- Long scale: overall HTML/CSS structure

### 3. Multi-Modal Aggregation

**Location**: `src/multi-modal-fusion.mjs`

```javascript
// Aggregate across modalities with attention weights
const weights = calculateModalityWeights({
  screenshot: screenshotPath,
  renderedCode: experience.renderedCode, // HTML/CSS as separate modality
  gameState: experience.pageState
}, prompt);

// Build fusion prompt
const fusionPrompt = buildStructuredFusionPrompt(prompt, {
  screenshot: screenshotPath,
  renderedCode: experience.renderedCode, // HTML/CSS weighted by relevance
  gameState: experience.pageState
});
```

**How HTML/CSS Aggregates**:
- HTML/CSS weighted by prompt relevance
- Visual prompts: screenshot weight higher
- Structure prompts: HTML/CSS weight higher
- Combined understanding across modalities

### 4. Multi-Perspective Aggregation

**Location**: `src/multi-modal.mjs`

```javascript
// Multiple personas evaluate same state
const perspectives = await multiPerspectiveEvaluation(
  validateFn,
  screenshotPath,
  renderedCode, // HTML/CSS shared across personas
  gameState
);

// Aggregate perspectives
const aggregatedScore = perspectives.reduce((sum, p) => sum + p.evaluation.score, 0) / perspectives.length;
const aggregatedIssues = [...new Set(perspectives.flatMap(p => p.evaluation.issues))];
```

**How HTML/CSS Aggregates**:
- Same HTML/CSS evaluated from multiple perspectives
- Different personas focus on different aspects
- Aggregated understanding combines perspectives

### 5. Cross-Session Aggregation

**Location**: `src/experience-tracer.mjs`, `src/feedback-aggregator.mjs`

```javascript
// Aggregate across multiple experience traces
const traces = [trace1, trace2, trace3];

// Extract notes from all traces
const allNotes = traces.flatMap(t => t.aggregateNotes(aggregateTemporalNotes));

// Aggregate across sessions
const crossSessionAggregated = aggregateTemporalNotes(allNotes, {
  windowSize: 60000 // 1 minute windows across sessions
});
```

**How HTML/CSS Aggregates**:
- HTML/CSS from multiple experiences combined
- Structural patterns across sessions identified
- Long-term HTML/CSS evolution tracked

## Current Implementation Review

### ✅ What Works Well

1. **HTML/CSS Capture** (`extractRenderedCode()`)
   - Captures HTML, critical CSS, DOM structure
   - Included in experience notes
   - Propagates through trace

2. **Experience Notes Include HTML/CSS**
   - `renderedCode` included in notes
   - Preserved through aggregation
   - Available in temporal context

3. **Multi-Modal Fusion**
   - HTML/CSS as separate modality
   - Attention-based weighting
   - Structured fusion prompts

4. **Temporal Aggregation**
   - Preserves HTML/CSS from notes
   - Aggregates structural changes over time
   - Coherence analysis considers structure

5. **Experience Propagation**
   - Notes → Trace → Aggregation → Context → Evaluation
   - HTML/CSS propagates through all stages
   - Sequential context includes HTML/CSS

### ⚠️ What Could Be Better

1. **HTML/CSS Truncation**
   - Currently truncates HTML to 500 chars in notes
   - Could preserve more context
   - Could use compression instead of truncation

2. **HTML/CSS Change Detection**
   - No explicit HTML/CSS diff tracking
   - Could track structural changes over time
   - Could identify what changed in HTML/CSS

3. **HTML/CSS Weighting**
   - Weights are prompt-based (good)
   - Could be adaptive based on evaluation results
   - Could learn optimal weights from human feedback

4. **Cross-Modal Consistency**
   - No explicit consistency checking between screenshot and HTML/CSS
   - Could detect when visual doesn't match structure
   - Could flag inconsistencies

5. **HTML/CSS Propagation Visibility**
   - Hard to see how HTML/CSS propagates through system
   - Could add logging/tracing
   - Could visualize propagation path

## Recommendations

### For HTML/CSS as Experience

1. **Preserve More Context**
   - Increase HTML truncation limit or use compression
   - Preserve critical CSS completely
   - Track DOM structure changes

2. **Track Structural Changes**
   - Add HTML/CSS diff tracking
   - Identify what changed between steps
   - Include change summary in notes

3. **Cross-Modal Validation**
   - Check screenshot matches HTML/CSS
   - Flag inconsistencies
   - Use for quality assurance

### For Experience Propagation

1. **Explicit Propagation Path**
   - Document propagation flow
   - Add tracing/logging
   - Visualize propagation

2. **Context Preservation**
   - Ensure HTML/CSS preserved through all stages
   - Don't lose context in aggregation
   - Include in sequential context

3. **Propagation Efficiency**
   - Compress HTML/CSS for propagation
   - Cache rendered code
   - Reuse across evaluations

### For Experience Aggregation

1. **Multi-Modal Aggregation**
   - Better integration of screenshot + HTML/CSS
   - Attention-based weighting
   - Cross-modal consistency checking

2. **Temporal Aggregation**
   - Preserve HTML/CSS through time windows
   - Track structural evolution
   - Aggregate structural changes

3. **Cross-Session Aggregation**
   - Aggregate HTML/CSS across sessions
   - Identify structural patterns
   - Track long-term evolution

## The Bottom Line

**HTML + CSS is Experience** - It's captured, included in notes, propagated through the system, and aggregated with screenshots and state.

**Experience Propagates** - From capture → notes → trace → aggregation → context → evaluation → next step.

**Experience Aggregates** - Temporally, multi-scale, multi-modal, multi-perspective, and cross-session.

**Current Implementation**: ✅ Good foundation, ⚠️ Could improve HTML/CSS preservation, change tracking, and cross-modal consistency.

