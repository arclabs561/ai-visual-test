# Implementation vs. Research: Honest Documentation

This document provides detailed context on research papers cited in the codebase, what they claim, what we actually implement, and why.

## Temporal Decision Making

### arXiv:2406.12125 - "Efficient Sequential Decision Making with Large Language Models"

**What the Paper Claims:**
- Core algorithm: Online model selection using multiplicative weights update (MWU) framework
- Key innovation: 6x performance gain with only 1.5% LLM calls (vs. calling at every time step)
- Algorithm 1: Converts LLMs to decision-making agents via embedding + similarity matching
- Algorithm 2: Online model selection that adaptively balances LLM policies vs. contextual bandit algorithms
- Temporal aspects: Temporal aggregation operates at multiple timescales, maintaining statistics over time windows

**What We Actually Implement:**
- ✅ Decision logic for WHEN to prompt (core insight: "Don't prompt on every state change")
- ✅ Temporal coherence-based decision making
- ✅ State change detection
- ✅ Urgency-based prioritization
- ❌ NOT: Online model selection (which LLM to use)
- ❌ NOT: Multiplicative weights update (MWU) algorithm
- ❌ NOT: Embedding-based similarity matching for action selection

**Why We Adapted:**
- Paper focuses on selecting WHICH LLM agent to use (model selection)
- We focus on WHEN to call (decision timing) - same core insight, different application
- Our use case: Single LLM provider, but need to reduce call frequency
- Our adaptation: Simple decision logic based on temporal context, coherence, state changes

**Implementation Location:**
- `src/temporal-decision-manager.mjs` - Simple decision logic
- `src/judge.mjs` - Integration point (skips LLM call if shouldPrompt=false)
- `src/game-player.mjs` - Reduces LLM calls during gameplay

**Research Value:**
The paper's core insight ("don't prompt on every state change") is valuable and we implement that. The specific algorithms (MWU, embedding matching) are not needed for our use case.

## Temporal Aggregation

### arXiv:2505.17663 - "DynToM" / arXiv:2507.15851 - "Human Temporal Cognition"

**What the Papers Claim:**
- DynToM: Temporal progression of mental states, optimal window sizes vary by activity pattern
- Human Temporal Cognition: Weber-Fechner law (logarithmic compression of temporal perception), temporal reference points, hierarchical construction

**What We Actually Implement:**
- ✅ Multi-scale temporal aggregation (100ms, 1s, 10s, 60s windows)
- ✅ Exponential decay weighting (decayFactor^age)
- ✅ Activity-based preprocessing (high/medium/low activity detection)
- ❌ NOT: Logarithmic compression (Weber-Fechner law) - we use exponential decay
- ❌ NOT: Temporal reference points
- ❌ NOT: DynToM benchmark or specific methods

**Why We Adapted:**
- Exponential decay is simpler and sufficient for our use case
- Multi-scale windows capture different aspects of perception without needing logarithmic compression
- Activity detection provides practical optimization without complex reference point tracking

**Implementation Location:**
- `src/temporal.mjs` - Temporal aggregation with exponential decay
- `src/temporal-decision.mjs` - Multi-scale aggregation
- `src/temporal-preprocessor.mjs` - Activity-based preprocessing

**Research Value:**
The papers provide valuable insights into human temporal perception, but our simpler exponential decay approach works well for practical browser automation.

## Intent Recognition

**Research Context:**
- Intent recognition accuracy >85% is often cited as critical for browser automation agents
- Ambiguous tasks require disambiguation (e.g., "Buy this product" = add to cart + checkout)
- Multi-step tasks need workflow decomposition

**What We Actually Implement:**
- ✅ Simple keyword-based recognition (fast, sufficient for most cases)
- ❌ NOT: LLM-based intent recognition (adds latency/cost without clear benefit)
- ❌ NOT: Multi-step workflow decomposition
- ❌ NOT: Ambiguity disambiguation

**Why We Simplified:**
- Keyword-based recognition is fast (<1ms) vs. LLM-based (>1s)
- Most browser automation tasks have clear keywords (navigate, click, fill, validate)
- Complex disambiguation can be handled by the VLLM during action execution, not intent recognition

**Implementation Location:**
- `src/utils/intent-recognizer.mjs` - Simple keyword matching

**Research Value:**
Research shows intent recognition is important, but for our use case, simple keyword matching is sufficient. Complex disambiguation happens during action execution, not intent parsing.

## Action Hallucination Detection

**Research Context:**
- Hallucination rate <15% is often cited as critical for browser automation agents
- Agents often claim actions completed when elements don't exist
- Need to verify action execution actually succeeded

**What We Actually Implement:**
- ✅ Simple element existence check before clicking
- ✅ Element visibility check
- ✅ Element enabled check
- ❌ NOT: Complex hallucination detection algorithms
- ❌ NOT: Post-action verification (we check before, not after)

**Why We Simplified:**
- Pre-action verification (check before clicking) is simpler and more effective than post-action verification
- Element existence/visibility/enabled checks are sufficient to prevent most hallucinations
- Complex algorithms add latency without clear benefit

**Implementation Location:**
- `src/game-player.mjs:executeGameAction()` - Simple element checks
- `src/utils/action-hallucination-detector.mjs` - More detailed checks (optional)

**Research Value:**
Research emphasizes the importance of hallucination detection, but simple pre-action checks are sufficient for our use case.

## Exploratory Automation

**Research Context:**
- Exploratory success rate >60% is often cited as critical for browser automation agents
- Agents should try alternative approaches when initial attempts fail
- Need to track exploration attempts and avoid infinite loops

**What We Actually Implement:**
- ✅ Simple retry logic: wait, try different action type
- ✅ Max attempts limit (prevents infinite loops)
- ✅ Attempt history tracking
- ❌ NOT: Complex exploration strategies
- ❌ NOT: Goal-specific alternative generation
- ❌ NOT: Multi-step exploration planning

**Why We Simplified:**
- Simple wait + alternative action type is sufficient for most failures
- Complex exploration strategies add complexity without clear benefit
- The VLLM can handle complex decision-making during action execution

**Implementation Location:**
- `src/utils/exploratory-automation.mjs` - Simple wait + alternative actions
- `src/game-player.mjs` - Integration with retry logic

**Research Value:**
Research shows exploration is important, but simple retry + alternative actions work well in practice.

## Error Recovery

**Research Context:**
- Error recovery success rate >70% is often cited as critical for browser automation agents
- Agents should gracefully handle failures and try alternatives
- Need to avoid infinite retry loops

**What We Actually Implement:**
- ✅ Simple retry logic: wait longer for timeouts/network, wait and retry for others
- ✅ Max retries limit
- ✅ Recovery history tracking
- ❌ NOT: Complex error type classification
- ❌ NOT: Sophisticated recovery strategies
- ❌ NOT: Error pattern learning

**Why We Simplified:**
- Most errors are timeouts or element not found - simple wait + retry handles these
- Complex error classification adds complexity without clear benefit
- The VLLM can handle complex error recovery during action execution

**Implementation Location:**
- `src/utils/error-recovery.mjs` - Simple wait + retry logic

**Research Value:**
Research emphasizes error recovery, but simple wait + retry is sufficient for most cases.

## Explainability Scoring

**Research Context:**
- Explainability score >80% is often cited as critical for browser automation agents
- Users need to understand agent reasoning for trust and debugging
- Transparency scores measure communication quality

**What We Actually Implement:**
- ✅ Simple heuristic: checks if reasoning exists, mentions action, not too technical
- ✅ Reasonable length check
- ❌ NOT: Complex clarity/completeness/relevance scoring
- ❌ NOT: Multi-dimensional explainability metrics
- ❌ NOT: User feedback integration

**Why We Simplified:**
- Simple checks (has action, has target, not too technical, reasonable length) are sufficient
- Complex scoring adds computation without clear benefit
- The VLLM's reasoning is already human-readable

**Implementation Location:**
- `src/utils/explainability-scorer.mjs` - Simple heuristic scoring

**Research Value:**
Research emphasizes explainability, but simple heuristics are sufficient to ensure reasoning quality.

## Summary

**Philosophy:**
- Research provides valuable insights and context
- We implement the core insights, not necessarily the specific algorithms
- Simple implementations are often sufficient and more maintainable
- Complex algorithms can be added later if needed

**Key Principles:**
1. **Core insights over algorithms**: We take the key insights from research, not necessarily the specific algorithms
2. **Simplicity over complexity**: Simple implementations are easier to understand, maintain, and debug
3. **Practical over theoretical**: We prioritize what works in practice over theoretical optimality
4. **Honest documentation**: We clearly document what we implement vs. what papers claim







