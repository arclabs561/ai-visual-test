# The Art and Science of Temporal Prompting

## Overview

Yes, there is significant art and science to **when** and **how** to prompt, and it's deeply connected to:
- **Temporal weighting** (recency, decay, attention)
- **Note propagation** through time
- **Batching strategies** (when to batch, when to wait)
- **Adaptive prompting** (when context is sufficient vs. when to wait for more)

## The Science: When to Prompt

### 1. Temporal Decision-Making

**Research**: `arXiv:2406.12125` - "Efficient Sequential Decision Making"
- LLMs need **explicit mechanisms** for sequential decisions
- **Online model selection** achieves 6x gains with 1.5% LLM calls
- Key insight: Don't prompt on every state change - prompt when **decision is needed**

**Our Implementation**: `src/temporal-decision.mjs`
- Multi-scale temporal aggregation
- Sequential decision context
- But: We don't yet implement the **when to prompt** decision logic

### 2. Human Time Perception

**Research**: Human perception time scales (PMC, NN/g)
- **0.1s threshold**: Direct manipulation, instant feedback
- **1s threshold**: Quick interaction, button response
- **5s threshold**: Short task completion
- **30s+ threshold**: Longer session, overall experience

**Our Implementation**: Multi-scale windows
```javascript
timeScales: {
  immediate: 100,   // 0.1s - instant perception
  short: 1000,      // 1s - quick interaction
  medium: 5000,     // 5s - short task
  long: 30000       // 30s - longer session
}
```

### 3. Attention and Recency

**Research**: Human attention affects temporal perception
- **Recency bias**: Recent events weighted more heavily
- **Salience**: Important events attract attention
- **Novelty**: Context changes attract attention

**Our Implementation**: `src/temporal-decision.mjs` - `calculateAttentionWeight()`
```javascript
function calculateAttentionWeight(note, context) {
  // Recency weight (exponential decay)
  const recencyWeight = Math.pow(0.9, elapsed / windowSize);
  
  // Salience weight (important events)
  const salienceWeight = calculateSalience(note);
  
  // Action weight (user actions focus attention)
  const actionWeight = note.step?.includes('interaction') ? 1.5 : 1.0;
  
  // Novelty weight (context changes attract attention)
  const noveltyWeight = note.observation?.includes('change') ? 1.3 : 1.0;
  
  return recencyWeight * salienceWeight * actionWeight * noveltyWeight;
}
```

## The Art: How to Prompt

### 1. Temporal Weighting in Prompts

**Current Implementation**: `src/temporal.mjs`
```javascript
// Exponential decay for older notes
const weight = Math.pow(decayFactor, age / windowSize);
// decayFactor = 0.9 (default)
```

**What This Means**:
- Recent notes get **higher weight** in aggregation
- Older notes **decay exponentially**
- But: We don't yet use this in **prompt construction** - we aggregate first, then format

### 2. Note Propagation Through Time

**Current State**: Notes are captured and aggregated, but:
- ❌ We don't explicitly **propagate** notes forward in time
- ❌ We don't track **note relevance** over time
- ❌ We don't **prune** irrelevant notes

**What We Should Do**:
```javascript
// Propagate notes forward with decay
function propagateNotes(notes, currentTime) {
  return notes.map(note => ({
    ...note,
    weight: calculateDecay(note.timestamp, currentTime),
    relevance: calculateRelevance(note, currentContext)
  })).filter(note => note.relevance > threshold);
}
```

### 3. Batching and Timing

**Current Implementation**: `src/temporal-batch-optimizer.mjs`
- Tracks **temporal dependencies**
- Calculates **priority** based on:
  - Dependencies (no deps = higher priority)
  - Timestamp age (earlier = higher priority, but decays)
  - Criticality (critical = higher priority)

**What's Missing**:
- ❌ **When to wait** for more context before prompting
- ❌ **When to batch** vs. when to prompt immediately
- ❌ **Adaptive batching** based on temporal patterns

## The Gap: When to Prompt Decision Logic

### What We Have

1. **Temporal Aggregation**: Multi-scale windows, coherence checking
2. **Temporal Weighting**: Recency, salience, novelty, action weights
3. **Batching**: Dependency tracking, priority calculation
4. **Prompt Formatting**: Natural language temporal context

### What We're Missing

1. **Decision Logic**: When is context sufficient to prompt?
2. **Adaptive Timing**: When to wait for more context vs. prompt now?
3. **Note Propagation**: How to carry forward relevant notes?
4. **Temporal Pruning**: When to drop old/irrelevant notes?

## Research-Based Prompting Strategies

### 1. Online Model Selection (arXiv:2406.12125)

**Strategy**: Only prompt when decision is needed, not on every state change

**Implementation**:
```javascript
function shouldPrompt(currentState, previousState, temporalContext) {
  // Prompt if:
  // 1. Significant state change (threshold-based)
  // 2. Decision point reached (goal-based)
  // 3. Temporal coherence drops (quality-based)
  // 4. User action occurred (interaction-based)
  
  const stateChange = calculateStateChange(currentState, previousState);
  const decisionNeeded = isDecisionPoint(currentState);
  const coherenceDrop = temporalContext.coherence < threshold;
  const userAction = hasRecentUserAction(temporalContext);
  
  return stateChange > threshold || decisionNeeded || coherenceDrop || userAction;
}
```

### 2. Adaptive Batching (arXiv:2505.13326)

**Strategy**: Batch requests adaptively based on temporal patterns

**Implementation**:
```javascript
function adaptiveBatch(requests, temporalContext) {
  // Batch if:
  // 1. Requests are independent (no dependencies)
  // 2. Temporal context is stable (high coherence)
  // 3. No urgent decisions needed
  
  const independent = requests.every(r => r.dependencies.length === 0);
  const stable = temporalContext.coherence > 0.7;
  const noUrgent = !requests.some(r => r.critical);
  
  return independent && stable && noUrgent;
}
```

### 3. Temporal Attention Weighting

**Strategy**: Weight prompt context by temporal attention

**Implementation**:
```javascript
function buildTemporalPrompt(basePrompt, notes, currentTime) {
  // Weight notes by:
  // 1. Recency (exponential decay)
  // 2. Salience (importance)
  // 3. Novelty (context changes)
  // 4. Action (user interactions)
  
  const weightedNotes = notes.map(note => ({
    ...note,
    weight: calculateAttentionWeight(note, currentTime)
  })).sort((a, b) => b.weight - a.weight);
  
  // Include top-weighted notes in prompt
  const topNotes = weightedNotes.slice(0, 5);
  return formatTemporalContext(basePrompt, topNotes);
}
```

## Proposed Implementation

### 1. Temporal Decision Manager

```javascript
// src/temporal-decision-manager.mjs
export class TemporalDecisionManager {
  shouldPrompt(currentState, temporalContext) {
    // Decision logic based on:
    // - State change magnitude
    // - Temporal coherence
    // - User actions
    // - Decision points
  }
  
  calculatePromptUrgency(temporalContext) {
    // Urgency based on:
    // - Coherence drop
    // - Critical events
    // - Time since last prompt
  }
  
  selectOptimalTiming(requests, temporalContext) {
    // When to batch vs. prompt immediately
    // When to wait for more context
  }
}
```

### 2. Note Propagation System

```javascript
// src/temporal-propagation.mjs
export function propagateNotes(notes, currentTime, context) {
  return notes
    .map(note => ({
      ...note,
      weight: calculateDecay(note.timestamp, currentTime),
      relevance: calculateRelevance(note, context)
    }))
    .filter(note => note.relevance > threshold)
    .sort((a, b) => b.weight - a.weight);
}
```

### 3. Adaptive Prompting

```javascript
// src/adaptive-prompting.mjs
export class AdaptivePrompter {
  async promptWhenReady(basePrompt, context) {
    // Wait for sufficient context
    while (!this.hasSufficientContext(context)) {
      await this.waitForMoreContext();
      context = await this.updateContext();
    }
    
    // Build prompt with optimal temporal context
    const temporalContext = this.buildOptimalTemporalContext(context);
    return this.buildPrompt(basePrompt, temporalContext);
  }
  
  hasSufficientContext(context) {
    // Sufficient if:
    // - Minimum notes collected
    // - Temporal coherence stable
    // - No urgent decisions pending
  }
}
```

## Current State vs. Ideal State

### Current State
- ✅ Temporal aggregation (multi-scale)
- ✅ Temporal weighting (recency, attention)
- ✅ Batching (dependencies, priority)
- ✅ Prompt formatting (natural language)
- ❌ Decision logic (when to prompt)
- ❌ Note propagation (carrying forward)
- ❌ Adaptive timing (when to wait)

### Ideal State
- ✅ Temporal aggregation
- ✅ Temporal weighting
- ✅ Batching
- ✅ Prompt formatting
- ✅ **Decision logic**: When context is sufficient
- ✅ **Note propagation**: Relevant notes carried forward
- ✅ **Adaptive timing**: Wait vs. prompt now
- ✅ **Temporal pruning**: Drop irrelevant notes

## Key Insights

1. **When to Prompt**: Not on every state change, but when:
   - Decision is needed
   - Context is sufficient
   - Temporal coherence drops
   - User action occurred

2. **How to Weight**: Use attention-based weighting:
   - Recency (exponential decay)
   - Salience (importance)
   - Novelty (context changes)
   - Action (user interactions)

3. **Note Propagation**: Carry forward relevant notes with decay:
   - Weight by recency
   - Filter by relevance
   - Prune old/irrelevant

4. **Batching Strategy**: Batch when:
   - Requests are independent
   - Context is stable
   - No urgent decisions

## Next Steps

1. **Implement Decision Logic**: `TemporalDecisionManager` for when to prompt
2. **Implement Note Propagation**: Carry forward relevant notes with decay
3. **Implement Adaptive Timing**: Wait vs. prompt now logic
4. **Integrate with Batching**: Combine decision logic with batching
5. **Validate Effectiveness**: A/B test different prompting strategies

## References

- `arXiv:2406.12125` - Efficient Sequential Decision Making
- `arXiv:2505.13326` - Serving LLM Reasoning Efficiently
- Human Time Perception (PMC, NN/g)
- Attention mechanisms in temporal processing

