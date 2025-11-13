# Uncertainty Reduction Tier Logic: Implementation Details

## Overview

The `shouldUseSelfConsistency` function in `src/uncertainty-reducer.mjs` implements a tiered decision system for when to use self-consistency checking. This document explains the complex reasoning to prevent future breakage.

## Tier Structure

### Tier 1: Critical Scenarios (N=5, always use)

**Conditions**:
1. `testType === 'expert-evaluation' || testType === 'medical'`
2. `importance === 'critical' && impact === 'blocks-use'`

**Rationale**: 
- Critical scenarios require highest accuracy
- Expert evaluations and medical contexts have high stakes
- Blocking issues with critical importance need maximum confidence
- N=5 provides strong consensus (majority of 5 judges)

**What breaks if changed**: Critical validations might not have sufficient confidence, leading to incorrect judgments in high-stakes scenarios.

### Tier 2: Edge Cases and High Uncertainty (N=3)

**Conditions** (any of):
1. `score <= 3 || score >= 9` - Extreme scores
2. `uncertainty > 0.3` - High uncertainty
3. `issues.length >= 5` - Many issues (over-detection risk)
4. `importance === 'high' && impact === 'degrades-experience'` - High-impact degradation

**Rationale**:
- Edge cases (extreme scores) are where models are most likely to be wrong
- High uncertainty indicates model confidence is low
- Many issues might indicate over-detection (hallucination)
- High-impact issues need extra validation
- N=3 provides moderate consensus without excessive cost

**What breaks if changed**: Edge cases might not be properly validated, leading to incorrect judgments for unusual scenarios.

### Tier 3: Standard Scenarios (N=0, no self-consistency)

**Default**: All other cases

**Rationale**:
- Standard validations don't need extra self-consistency
- Logprobs + hallucination detection are sufficient
- Reduces API costs for common cases
- Faster response times

**What breaks if changed**: Unnecessary API calls would increase cost and latency without meaningful benefit.

## Research Basis

Based on "Uncertainty × Payout Analysis":
- Self-consistency provides highest ROI for critical/high-stakes scenarios
- Edge cases benefit most from additional validation
- Standard cases don't need extra validation (diminishing returns)

## Threshold Values

### Score Thresholds
- `score <= 3`: Very low score (likely issues)
- `score >= 9`: Very high score (might be over-optimistic)

**Why these values**: Scores 0-10 scale, so 3 and 9 represent the bottom and top 30% respectively. These are where models are most likely to be incorrect.

### Uncertainty Threshold
- `uncertainty > 0.3`: High uncertainty

**Why 0.3**: Research shows uncertainty > 0.3 indicates low model confidence. This is where self-consistency helps most.

### Issue Count Threshold
- `issues.length >= 5`: Many issues

**Why 5**: More than 5 issues might indicate over-detection (hallucination). Self-consistency helps validate if issues are real.

## Testing Requirements

Any changes must:
1. Test Tier 1 conditions (should always return N=5)
2. Test Tier 2 conditions (should return N=3)
3. Test Tier 3 default (should return N=0)
4. Validate that thresholds are appropriate for the use case
5. Measure cost/benefit of self-consistency usage

## Related Code

- `src/uncertainty-reducer.mjs:281-345` - Full implementation
- `docs/research/UNCERTAINTY_X_PAYOUT_ANALYSIS.md` - Research basis
- `src/judge.mjs` - Integration point

