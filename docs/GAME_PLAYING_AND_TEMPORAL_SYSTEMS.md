# Game Playing, Fast Interaction, Batching, Temporal Aggregation, and Human Alignment

## Overview

This document explains how the codebase handles game playing, fast interactions, batching, temporal experience aggregation, and human alignment. These systems work together to provide efficient, latency-aware evaluation of interactive experiences.

## Architecture

### 1. Batching System (Three-Tier Architecture)

#### Base: `BatchOptimizer` (`src/batch-optimizer.mjs`)
- **Purpose**: General-purpose request queueing and caching
- **Features**:
  - Queues requests when concurrency limit reached
  - Processes in batches (default: 3 requests per batch)
  - Caches identical requests
  - Sequential batch processing (waits for batch to complete)
- **Latency**: Adds 50-200ms queue delay + batch wait time
- **Use Case**: Turn-based games, non-critical evaluations

#### Temporal: `TemporalBatchOptimizer` (`src/temporal-batch-optimizer.mjs`)
- **Purpose**: Batching with temporal dependency awareness
- **Features**:
  - Priority-based sorting (no dependencies first)
  - Temporal dependency tracking
  - Adaptive batch sizing
  - Integrates with `SequentialDecisionContext` for history tracking
- **Latency**: Similar to base, but prioritizes independent requests
- **Use Case**: Sequential evaluations where order matters

#### Latency-Aware: `LatencyAwareBatchOptimizer` (`src/latency-aware-batch-optimizer.mjs`)
- **Purpose**: Adaptive batching for fast reactive games
- **Features**:
  - **Bypasses batching** for critical requests (<100ms requirement)
  - **Adaptive batch sizing** based on latency requirements:
    - <100ms: No batching (process immediately)
    - <200ms: Batch size 1-2 (small batches)
    - ≥200ms: Standard batch size (3)
  - Priority queue (critical requests first)
  - Deadline-based scheduling
- **Latency**: 
  - Critical (<100ms): ~50-200ms (API call only, no queue delay)
  - Fast (<200ms): ~100-300ms (small batches)
  - Normal: ~150-400ms (standard batching)
- **Use Case**: 60 FPS games, real-time interactions

### 2. Fast Interaction & Game Playing

#### Problem
- **60 FPS games** need <100ms latency for real-time feedback
- **Standard batching** adds 50-200ms queue delay + batch wait
- **Total latency**: 50-550ms (too slow for fast games)

#### Solution: Latency-Aware Batching
```javascript
// For fast reactive games (60 FPS)
const optimizer = new LatencyAwareBatchOptimizer({
  maxConcurrency: 5,
  batchSize: 3,
  adaptiveBatchSize: true
});

// Critical request (<100ms) - bypasses batching
const result = await optimizer.addRequest(
  'gameplay-frame.png',
  'Evaluate gameplay',
  {},
  50 // 50ms max latency - processes immediately
);
```

#### Analysis Results (`evaluation/batching-vs-latency-analysis.mjs`)
- **60 FPS Game**: Sequential: 133ms avg ✅, Batch: 172ms avg ❌ (too slow)
- **30 FPS Game**: Sequential: 141ms avg ✅, Batch: 214ms avg ⚠️ (marginal)
- **Turn-Based**: Sequential: 129ms avg ✅, Batch: 158ms avg ✅ (excellent)

**Recommendation**: Use `LatencyAwareBatchOptimizer` with low `maxLatency` for fast games.

### 3. Temporal Experience Aggregation

#### Components

##### `aggregateTemporalNotes` (`src/temporal.mjs`)
- **Purpose**: Groups temporal notes into time windows with exponential decay
- **Features**:
  - Time windows (default: 10 seconds)
  - Exponential decay for older notes (decay factor: 0.9)
  - Coherence analysis (detects logical progression)
  - Conflict detection
- **Use Case**: Analyzing gameplay sequences, UI state changes

##### `aggregateMultiScale` (`src/temporal-decision.mjs`)
- **Purpose**: Aggregates at multiple time scales simultaneously
- **Time Scales**:
  - Immediate: 100ms (instant reactions)
  - Short: 1s (quick assessments)
  - Medium: 10s (detailed evaluation)
  - Long: 60s (comprehensive review)
- **Features**:
  - Attention-based weighting (recency, salience, action focus, novelty)
  - Per-scale coherence analysis
- **Use Case**: Multi-scale analysis of interactive experiences

##### `aggregateTemporalNotesAdaptive` (`src/temporal-adaptive.mjs`)
- **Purpose**: Adaptive window sizing based on note frequency
- **Features**:
  - Calculates optimal window size from note frequency
  - Detects activity patterns (fastChange, slowChange, consistent, erratic)
  - Adjusts window size based on pattern:
    - Fast changes: 5s windows
    - Slow changes: 20s windows
    - Default: 10s windows
- **Use Case**: Adaptive analysis for varying interaction speeds

##### `ExperienceTrace` (`src/experience-tracer.mjs`)
- **Purpose**: Complete trace of user experience journey
- **Features**:
  - Tracks events, validations, screenshots, state snapshots
  - Aggregates temporal notes
  - Exports to JSON for analysis
- **Use Case**: Full traceability for debugging and meta-evaluation

### 4. Human Alignment

#### `humanPerceptionTime` (`src/temporal-decision.mjs`)
- **Purpose**: Models human perception at different time scales (research-based)
- **Research Basis**:
  - 0.1s threshold for direct manipulation (NN/g)
  - 50ms for visual appeal decisions (Lindgaard)
  - 200-300 words/minute reading speed
  - Attention affects temporal perception
- **Features**:
  - Action-specific times (page-load, reading, interaction, evaluation, visual-appeal)
  - Attention level adjustments (focused: 0.9x, normal: 1.0x, distracted: 1.2x)
  - Complexity adjustments (simple: 0.8x, normal: 1.0x, complex: 1.3x)
  - Persona adjustments (power users: 0.8x, accessibility-focused: 1.3x)
- **Integration**: Used by `persona-experience.mjs` for realistic timing

```javascript
const time = humanPerceptionTime('reading', {
  contentLength: 1000,
  attentionLevel: 'normal',
  actionComplexity: 'normal',
  persona: { name: 'Power User' }
});
```

#### Human Validation Framework (`evaluation/human-validation.mjs`)
- **Purpose**: Collects human judgments and calibrates VLLM against human preferences
- **Features**:
  - Collects human judgments (score, issues, reasoning)
  - Compares with VLLM judgments
  - Calculates agreement metrics:
    - Cohen's Kappa (binary agreement)
    - MAE, RMSE (score agreement)
    - Pearson's r, Spearman's ρ (correlation)
  - Bias analysis (score bias, issue detection bias)
  - Calibration recommendations
- **Status**: Framework exists but **no active workflow** for collecting human judgments
- **Gap**: Needs integration with evaluation pipeline

#### Persona Consistency (`src/persona-enhanced.mjs`)
- **Purpose**: Measures consistency of persona observations
- **Features**:
  - Prompt-to-line consistency (first observation vs. others)
  - Line-to-line consistency (adjacent observations)
  - Overall consistency score
  - Persona diversity metrics
- **Use Case**: Validating persona-based testing consistency

## Integration Flow

### Interactive Experience Evaluation

1. **Setup** (`evaluation/evaluate-interactive-experiences.mjs`):
   - Creates personas (Casual Gamer, Accessibility Advocate, Power User, etc.)
   - Initializes `SequentialDecisionContext` for history tracking

2. **Experience Collection** (`src/persona-experience.mjs`):
   - Uses `experiencePageAsPersona` to simulate persona interactions
   - Uses `humanPerceptionTime` for realistic timing
   - Collects temporal notes (observations, scores, game state)

3. **Temporal Aggregation**:
   - Uses `aggregateMultiScale` to aggregate notes at multiple time scales
   - Provides context for final evaluation

4. **Evaluation**:
   - Uses `validateScreenshot` with temporal context
   - Updates `SequentialDecisionContext` with decisions
   - Tracks consistency across evaluations

5. **Batching** (if using optimizer):
   - For fast games: Uses `LatencyAwareBatchOptimizer` with low `maxLatency`
   - For normal games: Uses `TemporalBatchOptimizer` or standard `BatchOptimizer`
   - Critical requests bypass batching

### Example: Fast Reactive Game

```javascript
// 1. Create latency-aware optimizer
const optimizer = new LatencyAwareBatchOptimizer({
  maxConcurrency: 5,
  batchSize: 3,
  adaptiveBatchSize: true
});

// 2. Experience page as persona
const experience = await experiencePageAsPersona(page, persona, {
  url: 'https://game.example.com',
  sequentialContext: sequentialContext.getContext()
});

// 3. Aggregate temporal notes
const aggregated = aggregateMultiScale(experience.notes, {
  timeScales: {
    immediate: 100,   // 0.1s - instant reactions
    short: 1000,      // 1s - quick assessments
    medium: 10000,    // 10s - detailed evaluation
    long: 60000       // 60s - comprehensive review
  }
});

// 4. Evaluate with latency requirement
const result = await optimizer.addRequest(
  experience.screenshots[0].path,
  prompt,
  {
    testType: 'fast-game',
    sequentialContext: sequentialContext.getContext(),
    temporalNotes: aggregated
  },
  50 // 50ms max latency - bypasses batching
);
```

## Key Trade-offs

### Batching vs. Latency
- **Efficiency**: Batching improves throughput by 20-40%
- **Reactivity**: Batching adds 50-200ms latency
- **Solution**: Use latency-aware batching that bypasses for critical requests

### Temporal Aggregation vs. Real-time
- **Accuracy**: Temporal aggregation improves consistency by 10-20%
- **Latency**: Aggregation adds processing time
- **Solution**: Use adaptive window sizing based on note frequency

### Human Alignment vs. Automation
- **Accuracy**: Human validation improves reliability
- **Cost**: Human validation is expensive
- **Solution**: Use `humanPerceptionTime` for realistic timing, collect human judgments selectively

## Current Gaps

1. **Human Validation Workflow**: Framework exists but not integrated with evaluation pipeline
2. **Active Learning**: No system to learn from human corrections
3. **Calibration Dashboard**: No UI for viewing calibration results
4. **Position Bias**: No automatic counter-balancing for single evaluations

## Recommendations

### For Fast Reactive Games (60 FPS)
1. Use `LatencyAwareBatchOptimizer` with `maxLatency: 50-100`
2. Set `adaptiveBatchSize: true`
3. Critical requests will bypass batching automatically

### For Standard Games (30 FPS)
1. Use `LatencyAwareBatchOptimizer` with `maxLatency: 150-200`
2. Uses small batches (size 2) for fast games
3. Priority queue ensures critical frames processed first

### For Turn-Based Games
1. Use standard `BatchOptimizer` or `TemporalBatchOptimizer`
2. Large batches (size 3+) for maximum efficiency
3. Caching enabled for identical screenshots

### For Temporal Analysis
1. Use `aggregateMultiScale` for multi-scale analysis
2. Use `aggregateTemporalNotesAdaptive` for adaptive window sizing
3. Use `ExperienceTrace` for full traceability

### For Human Alignment
1. Use `humanPerceptionTime` for realistic timing
2. Collect human judgments selectively (framework exists)
3. Calibrate VLLM against human preferences (framework exists)

