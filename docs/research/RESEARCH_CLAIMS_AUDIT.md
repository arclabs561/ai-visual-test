# Research Claims Audit: What's Real vs. Snake Oil

## Executive Summary

This audit reviews all research citations in the codebase to identify:
1. **What we actually implement** (real, backed by code)
2. **What we cite but don't implement** (overclaimed, snake oil)
3. **What we should implement** (gaps)

## Critical Findings

### 🚨 Overclaimed (Snake Oil)

#### 1. arXiv:2406.12125 - "Efficient Sequential Decision Making"
**What we cite**: "Online model selection achieves 6x gains with 1.5% LLM calls"
**What we actually implement**: 
- ✅ Multi-scale temporal aggregation (inspired by temporal aspects)
- ❌ **NOT** the core online model selection algorithm
- ❌ **NOT** the decision logic for when to prompt

**Status**: **OVERCLAIMED** - We cite the paper but don't implement its core contribution

**Fix**: Either:
- Remove citation or clarify "inspired by temporal aspects, not implementing core algorithm"
- Actually implement the online model selection logic

#### 2. arXiv:2505.13326 - "Serving LLM Reasoning Efficiently"
**What we cite**: "Short and right thinking management", "Adaptive batching improves efficiency"
**What we actually implement**:
- ✅ Temporal batch optimizer with dependencies
- ❌ **NOT** the "short and right" thinking management
- ❌ **NOT** the specific adaptive batching strategy from the paper

**Status**: **LOOSELY RELATED** - We do batching, but not the paper's specific method

**Fix**: Clarify as "loosely related" or implement the actual method

#### 3. arXiv:2505.17663 - "DynToM" / arXiv:2507.15851 - "Human Temporal Cognition"
**What we cite**: "Weber-Fechner law, logarithmic compression", "Temporal reference points"
**What we actually implement**:
- ✅ Multi-scale temporal aggregation
- ✅ Exponential decay (not logarithmic)
- ❌ **NOT** logarithmic compression (Weber-Fechner law)
- ❌ **NOT** temporal reference points

**Status**: **PARTIALLY IMPLEMENTED** - We do temporal aggregation but not the specific research findings

**Fix**: Document that we use exponential decay, not logarithmic compression

### ✅ Properly Implemented

#### 1. arXiv:2406.07791 - Position Bias Study
**What we cite**: Systematic study of position bias
**What we implement**:
- ✅ Position bias detection
- ✅ Quality gap analysis
- ✅ Position Consistency (PC) and Preference Fairness (PF) metrics
- ✅ Counter-balancing

**Status**: **PROPERLY IMPLEMENTED**

#### 2. arXiv:2508.02020 - Counter-Balancing Effectiveness
**What we cite**: Effectiveness of counter-balancing
**What we implement**:
- ✅ Counter-balancing in position-counterbalance.mjs
- ✅ Swapped order evaluations

**Status**: **PROPERLY IMPLEMENTED**

#### 3. arXiv:2412.05579 - Explicit Rubrics
**What we cite**: "Explicit rubrics improve reliability by 10-20%"
**What we implement**:
- ✅ Rubric system in rubrics.mjs
- ✅ Rubric inclusion in prompts
- ✅ Default includeRubric: true

**Status**: **PROPERLY IMPLEMENTED**

#### 4. arXiv:2510.01499 - Optimal Ensemble Weighting
**What we cite**: Generalized sigmoid for N>2 models
**What we implement**:
- ✅ calculateOptimalWeights with correct formula
- ✅ Inverse generalized sigmoid

**Status**: **PROPERLY IMPLEMENTED**

## Detailed Audit by Module

### src/temporal-decision.mjs

**Citations**:
- arXiv:2406.12125 (Efficient Sequential Decision Making)
- Human Time Perception (PMC, NN/g)

**Claims**:
- "Multi-scale temporal aggregation"
- "Sequential decision context"
- "Human perception time modeling"
- "Attention-based weighting"

**Reality Check**:
- ✅ Multi-scale aggregation: **REAL** - `aggregateMultiScale()` exists
- ✅ Sequential decision context: **REAL** - `SequentialDecisionContext` class exists
- ✅ Human perception time: **REAL** - `humanPerceptionTime()` exists
- ✅ Attention-based weighting: **REAL** - `calculateAttentionWeight()` exists
- ❌ Online model selection: **NOT IMPLEMENTED** - We cite but don't implement
- ❌ When to prompt decision: **NOT IMPLEMENTED** - No decision logic

**Verdict**: **MOSTLY REAL**, but overclaims on arXiv:2406.12125

### src/temporal-batch-optimizer.mjs

**Citations**:
- arXiv:2406.12125 (Efficient Sequential Decision Making)
- arXiv:2505.13326 (Serving LLM Reasoning Efficiently)
- Human Time Perception (NN/g, PMC)

**Claims**:
- "Adaptive batching that considers temporal dependencies"
- "Online model selection achieves 6x gains"

**Reality Check**:
- ✅ Temporal dependencies: **REAL** - `temporalDependencies` Map exists
- ✅ Priority calculation: **REAL** - `calculatePriority()` exists
- ✅ Adaptive batching: **REAL** - `selectTemporalBatch()` exists
- ❌ Online model selection: **NOT IMPLEMENTED** - We cite but don't implement
- ❌ 6x gains claim: **NOT VALIDATED** - We don't measure this

**Verdict**: **REAL** batching, but **OVERCLAIMS** on arXiv:2406.12125

### src/temporal.mjs

**Citations**:
- arXiv:2505.17663 (DynToM)
- arXiv:2507.15851 (Human Temporal Cognition)

**Claims**:
- "Weber-Fechner law, logarithmic compression"
- "Temporal reference points"

**Reality Check**:
- ✅ Temporal aggregation: **REAL** - `aggregateTemporalNotes()` exists
- ✅ Exponential decay: **REAL** - `Math.pow(decayFactor, age / windowSize)`
- ❌ Logarithmic compression: **NOT IMPLEMENTED** - We use exponential, not logarithmic
- ❌ Temporal reference points: **NOT IMPLEMENTED** - We don't use reference points

**Verdict**: **PARTIALLY REAL** - We do aggregation but not the specific research findings

### src/bias-detector.mjs

**Citations**:
- arXiv:2406.07791 (Position Bias Study)
- arXiv:2508.02020 (Counter-Balancing)
- arXiv:2310.10076 (Verbosity Bias)
- arXiv:2407.01085 (AdapAlpaca)

**Claims**:
- Position bias detection with quality gap analysis
- PC and PF metrics
- Verbosity bias detection

**Reality Check**:
- ✅ Position bias detection: **REAL** - `detectPositionBias()` exists
- ✅ Quality gap analysis: **REAL** - Quality gap calculation exists
- ✅ PC and PF metrics: **REAL** - Implemented in `detectPositionBias()`
- ✅ Verbosity bias: **REAL** - Detection exists
- ⚠️ AdapAlpaca length alignment: **SIMPLIFIED** - We mention it but don't fully implement

**Verdict**: **MOSTLY REAL**, but AdapAlpaca is simplified

### src/ensemble-judge.mjs

**Citations**:
- arXiv:2510.01499 (Optimal Ensemble Weighting)

**Claims**:
- "Generalized sigmoid for N>2 models"

**Reality Check**:
- ✅ Optimal weighting: **REAL** - `calculateOptimalWeights()` exists
- ✅ Correct formula: **REAL** - Uses inverse generalized sigmoid

**Verdict**: **PROPERLY IMPLEMENTED**

## Fixes Needed

### 1. Clarify arXiv:2406.12125 Citation

**Current**: Claims we implement "online model selection"
**Reality**: We implement temporal aggregation inspired by temporal aspects

**Fix**: Update documentation to clarify:
- We use multi-scale temporal aggregation (inspired by temporal aspects)
- We do NOT implement the core online model selection algorithm
- We do NOT implement the decision logic for when to prompt

### 2. Clarify arXiv:2505.13326 Citation

**Current**: Claims "adaptive batching improves efficiency"
**Reality**: We do adaptive batching, but not the paper's specific method

**Fix**: Clarify as "loosely related" - we do batching with temporal awareness

### 3. Fix arXiv:2505.17663 / 2507.15851 Citations

**Current**: Claims "Weber-Fechner law, logarithmic compression"
**Reality**: We use exponential decay, not logarithmic

**Fix**: Document that we use exponential decay, not logarithmic compression

### 4. Implement Missing Decision Logic

**Gap**: We don't implement "when to prompt" decision logic from arXiv:2406.12125

**Fix**: Either:
- Remove the citation, OR
- Implement the decision logic

## Action Plan

1. **Audit all citations** - Review every arXiv citation
2. **Fix overclaims** - Update documentation to be accurate
3. **Implement missing pieces** - Add decision logic, note pruning, adaptive timing
4. **Validate claims** - Test that implementations match citations

