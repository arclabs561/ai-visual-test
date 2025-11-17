# Success Criteria Refinement Summary

## What Changed

We refined the success criteria from **academic/research-focused** to **game-focused and practical**, aligning with the repository's macro purpose.

## Why It Matters

### Original Approach (Too Academic)
- Focused on abstract benchmarks (counterfactual images, capability stratification)
- Measured against research papers, not real use cases
- Success criteria didn't directly validate the primary goal (60Hz game validation)

### Refined Approach (Game-Focused)
- Focused on actual game testing scenarios (2048, Snake, Queeraoke)
- Measured against real-world performance (latency, throughput, accuracy)
- Success criteria directly validate the primary goal (60Hz game validation)

## Key Insights from Macro Purpose Review

### 1. Primary Goal: 60Hz Real-Time Game Validation
**Not**: General-purpose VLLM evaluation framework
**But**: Specific tool for validating games at 60Hz with semantic understanding

**Implication**: Success must be measured in terms of:
- Can it validate games at 60Hz? (<100ms latency)
- Does it work with real games? (2048, Snake, Queeraoke)
- Is it easy to integrate? (Playwright test suites)

### 2. Core Value: Semantic Understanding
**Not**: Pixel-perfect testing
**But**: Understanding UI meaning (playability, accessibility, fun)

**Implication**: Success must validate:
- Game state extraction accuracy (score, level, board state)
- Semantic validation accuracy (playability, accessibility, fun)
- Dynamic content handling (scores, timers, user data)

### 3. Primary Use Case: Interactive Games
**Not**: General web testing
**But**: Game testing with temporal sequences, state extraction, variable goals

**Implication**: Success must validate:
- Temporal sequence handling (gameplay over time)
- State extraction (score, level, position)
- Variable goals (fun, accessibility, performance)

## Refined Success Criteria

### Primary Goals (Must Succeed)

1. **60Hz Validation Works**
   - <100ms latency (95th percentile)
   - 60 validations/second throughput
   - >95% success rate

2. **Semantic Understanding Works**
   - >85% game state extraction accuracy
   - >80% semantic validation accuracy
   - Handles dynamic content gracefully

3. **Temporal Sequences Work**
   - >70% gameplay coherence
   - >80% state transition accuracy
   - Provides actionable insights

4. **Real-World Game Testing Works**
   - Works with >90% of tested games
   - Easy integration (<10 lines of code)
   - Usable in <5 minutes

### Improvements (Support Primary Goals)

All improvements are now evaluated in **game contexts**, not abstract benchmarks:

- **Calibration Degradation**: Detects degradation during actual 60Hz gameplay
- **Temporal Graph**: Identifies coherent game state transitions
- **Screenshot Selection**: Captures significant game events (score milestones, level changes)
- **Counterfactual Testing**: Detects memorization vs. visual analysis in game contexts
- **Capability Stratification**: Identifies gaps in game-specific capabilities
- **Baseline Validation**: Validates game state extraction requires visual analysis
- **Hybrid Accessibility**: Detects game-specific accessibility issues

## Evaluation Datasets (Game-Focused)

### Before (Abstract)
- Counterfactual images (5-legged dog)
- Capability stratification datasets
- Baseline validation datasets

### After (Game-Focused)
- Real game sequences (2048, Snake gameplay)
- Game state extraction datasets (known game states)
- Game accessibility datasets (game-specific accessibility issues)

## Test Suites (Game-Focused)

### Before (Abstract)
- Counterfactual memorization tests
- Capability stratification tests
- Baseline validation tests

### After (Game-Focused)
- 60Hz validation tests (actual latency measurement)
- Game state extraction tests (real game screenshots)
- Temporal gameplay tests (real gameplay sequences)

## Impact on Implementation Plan

### What Stays the Same
- Implementation approach (extend existing code)
- Code structure (build on existing patterns)
- Integration points (judge.mjs, convenience.mjs)

### What Changes
- **Evaluation focus**: Test with real games, not abstract benchmarks
- **Success metrics**: Measure game-specific performance, not academic metrics
- **Validation approach**: Validate against primary goals first, improvements second

## Next Steps

1. **Create Real Game Datasets**
   - Capture actual gameplay sequences from 2048, Snake, etc.
   - Annotate with known game states (score, level, board state)

2. **Implement 60Hz Tests**
   - Create tests that validate 60Hz capability
   - Measure actual latency and throughput

3. **Validate Game State Extraction**
   - Test with real game screenshots
   - Measure extraction accuracy

4. **Test Real-World Integration**
   - Validate integration with Playwright test suites
   - Measure usability and ease of integration

## Conclusion

The refined success criteria align with the repository's macro purpose: **enabling 60Hz real-time game validation with semantic understanding**. All improvements are evaluated in game contexts, and success is measured by practical impact on game testing workflows, not academic metrics.

This ensures that:
- Success criteria validate the primary goal
- Improvements support real-world use cases
- Evaluation uses actual game scenarios
- Metrics measure practical impact

The refinement makes success criteria **actionable, measurable, and aligned with the actual purpose** of the repository.

