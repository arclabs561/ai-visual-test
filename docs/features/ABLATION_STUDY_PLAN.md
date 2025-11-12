# Ablation Study Plan: What Actually Works?

## Problem Statement

We've implemented many techniques from arXiv papers, but we haven't validated which ones actually improve outcomes in our specific use case. Rather than "Frankensteining" all relevant papers, we should:

1. **Test each technique in isolation** to measure individual impact
2. **Compare against baseline** to see if technique helps
3. **Measure cost-benefit** (accuracy gain vs. cost/latency increase)
4. **Remove techniques that don't help** to reduce complexity

## Techniques to Test

### High Priority (Core Techniques)

1. **Explicit Rubrics** (arXiv:2412.05579)
   - **Claim**: 10-20% reliability improvement
   - **Test**: Baseline vs. with explicit rubric
   - **Metrics**: Score accuracy, consistency, issue detection

2. **Hallucination Detection** (arXiv:2506.19513+)
   - **Claim**: 10-15% false positive reduction
   - **Test**: Baseline vs. with hallucination detection
   - **Metrics**: False positive rate, precision

3. **Uncertainty Reduction - Logprobs**
   - **Claim**: 5-10% calibration improvement
   - **Test**: Baseline vs. with logprob analysis
   - **Metrics**: Calibration error, confidence accuracy

4. **Bias Mitigation** (arXiv:2406.07791)
   - **Claim**: Reduces position/verbosity/length bias
   - **Test**: Baseline vs. with bias mitigation
   - **Metrics**: Bias metrics, score consistency

5. **Position Counter-Balancing** (arXiv:2508.02020)
   - **Claim**: Eliminates 70-80% position bias
   - **Test**: Baseline vs. with counter-balancing
   - **Metrics**: Position bias reduction, score stability

### Medium Priority (Expensive Techniques)

6. **Self-Consistency** (arXiv:2203.11171)
   - **Claim**: 5-15% accuracy improvement
   - **Cost**: 3-5× API calls
   - **Test**: Baseline vs. with self-consistency (N=3, N=5)
   - **Metrics**: Accuracy improvement, cost increase

7. **Ensemble Judging** (arXiv:2510.01499)
   - **Claim**: Optimal aggregation improves reliability
   - **Cost**: Multiple providers
   - **Test**: Single provider vs. ensemble
   - **Metrics**: Accuracy, consistency, cost

### Lower Priority (Context-Dependent)

8. **Temporal Aggregation**
   - **Test**: Without vs. with temporal notes
   - **Metrics**: Score accuracy, coherence

9. **Multi-Scale Temporal Aggregation**
   - **Test**: Standard vs. multi-scale
   - **Metrics**: Coherence, accuracy

10. **Pair Comparison** (arXiv:2402.04788)
    - **Claim**: More reliable than absolute scoring
    - **Test**: Absolute scoring vs. pair comparison
    - **Metrics**: Reliability, consistency

11. **Few-Shot Examples**
    - **Test**: Without vs. with dynamic few-shot
    - **Metrics**: Accuracy, consistency

12. **Multi-Modal Fusion**
    - **Test**: Screenshot only vs. screenshot + HTML + CSS
    - **Metrics**: Accuracy, cross-modal consistency

13. **Persona-Based Evaluation**
    - **Test**: Generic vs. persona-specific
    - **Metrics**: Diversity, accuracy

## Evaluation Metrics

### Primary Metrics

1. **Accuracy**
   - Score MAE (Mean Absolute Error) vs. ground truth
   - Issue detection precision/recall/F1
   - Correlation with human judgments

2. **Consistency**
   - Inter-run agreement (same input, multiple runs)
   - Score variance
   - Issue detection consistency

3. **Cost**
   - API call count
   - Total cost ($)
   - Latency (ms)

4. **Calibration**
   - Uncertainty calibration (if uncertainty provided)
   - Confidence accuracy

### Secondary Metrics

5. **Bias Reduction**
   - Position bias metrics
   - Verbosity bias metrics
   - Length bias metrics

6. **Robustness**
   - Performance on edge cases
   - Performance on adversarial inputs
   - Error rate

## Test Dataset Requirements

### Minimum Dataset

- **10-20 test cases** with ground truth annotations
- **Diverse scenarios**: Good sites, bad sites, edge cases
- **Known characteristics**: Expected scores, known issues
- **Multiple runs**: Each test case evaluated 3-5 times for consistency

### Ground Truth

- **Human-annotated scores** (0-10 scale)
- **Human-identified issues** (list of issues with importance)
- **Consensus scores**: Average of 3+ human evaluators

## Ablation Study Design

### Phase 1: Individual Technique Testing

For each technique:
1. Run baseline (no techniques)
2. Run with single technique enabled
3. Compare metrics (accuracy, consistency, cost)
4. Calculate improvement vs. baseline

### Phase 2: Combination Testing

Test combinations of top-performing techniques:
1. Baseline
2. Best single technique
3. Best 2-technique combination
4. Best 3-technique combination
5. All techniques (current "Frankenstein" approach)

### Phase 3: Cost-Benefit Analysis

For each technique/combination:
- Calculate **ROI** = (Accuracy Improvement) / (Cost Increase)
- Identify **pareto-optimal** combinations (best accuracy for given cost)
- Recommend **optimal configuration** based on use case

## Success Criteria

### Technique is "Worth Keeping" if:

1. **Improves accuracy** by ≥2% (statistically significant)
2. **Improves consistency** (reduces variance by ≥10%)
3. **Cost-benefit positive** (ROI > 1.0)
4. **Robust** (improves on ≥70% of test cases)

### Technique is "Remove" if:

1. **No improvement** or **worse** than baseline
2. **High cost** with **minimal benefit** (ROI < 0.5)
3. **Inconsistent** (helps on some cases, hurts on others)
4. **Redundant** (another technique provides same benefit)

## Implementation

See `evaluation/ablation-framework.mjs` for:
- Individual technique test functions
- Ablation study runner
- Results aggregation and analysis
- Summary reporting

## Expected Outcomes

1. **Identify top 3-5 techniques** that actually help
2. **Remove 5-10 techniques** that don't help or are redundant
3. **Recommend optimal configuration** for different use cases
4. **Reduce complexity** by 30-50% while maintaining or improving accuracy

## Timeline

- **Week 1**: Set up ablation framework, create test dataset
- **Week 2**: Run individual technique tests
- **Week 3**: Run combination tests, analyze results
- **Week 4**: Document findings, remove ineffective techniques, update codebase

## Next Steps

1. ✅ Create ablation framework (`evaluation/ablation-framework.mjs`)
2. ⏳ Create/expand test dataset with ground truth
3. ⏳ Run ablation studies
4. ⏳ Analyze results and make recommendations
5. ⏳ Remove ineffective techniques
6. ⏳ Update documentation with validated techniques only

