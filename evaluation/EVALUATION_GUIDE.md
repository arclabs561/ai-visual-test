# Evaluation Guide

## Overview

This guide explains how to properly evaluate `ai-visual-test` using the consolidated evaluation system.

## Quick Start

```bash
# Evaluate with default dataset (real-dataset.json)
node evaluation/runners/evaluate.mjs

# Evaluate with specific dataset
node evaluation/runners/evaluate.mjs --dataset=webui-ground-truth.json --limit=50

# Evaluate with specific provider
node evaluation/runners/evaluate.mjs --provider=gemini
```

## Available Datasets

### For Development/Testing (Small, Quick)
- `real-dataset.json` - 4 samples, updated with precise scores
  - ⚠️ **Too small for statistical validation**
  - ✅ Good for development and quick tests

### For Proper Validation (Large, Real Ground Truth)
- `webui-ground-truth.json` - ~7000 samples (once converted)
  - ✅ Real accessibility trees and annotations
  - ✅ Suitable for statistical validation
  - ⚠️ Requires conversion: `node evaluation/utils/convert-webui-dataset.mjs`

- `evaluation/datasets/integrated/screenai-*.json` - 697 samples
  - ✅ Real human annotations
  - ✅ Ready to use
  - ✅ Suitable for validation

## Evaluation Metrics

The consolidated runner calculates proper statistical metrics:

### Score Metrics
- **MAE (Mean Absolute Error)**: Average difference between predicted and actual scores
- **RMSE (Root Mean Squared Error)**: Penalizes larger errors more
- **Correlation**: How well predictions correlate with actual scores
- **Within Tolerance**: Percentage of predictions within acceptable error range
- **95% Confidence Interval**: Statistical confidence in mean error

### Issue Detection Metrics
- **Precision**: Of detected issues, how many were correct?
- **Recall**: Of actual issues, how many were detected?
- **F1 Score**: Harmonic mean of precision and recall

## Ground Truth Format

### New Format (Precise)
```json
{
  "groundTruth": {
    "preciseScore": 8.0,
    "scoreTolerance": 1.0,
    "structuredIssues": ["low contrast", "missing alt text"],
    "structuredFeatures": {
      "accessibility": {
        "level": "good",
        "wcagCompliance": "AA",
        "keyboardNavigation": true
      }
    }
  }
}
```

### Legacy Format (Still Supported)
```json
{
  "groundTruth": {
    "expectedScore": { "min": 7, "max": 10 },
    "expectedIssues": [],
    "knownGood": ["high contrast"]
  }
}
```

## Runner Consolidation

The new `evaluate.mjs` runner replaces:
- `run-evaluation.mjs` - Basic evaluation
- `run-real-evaluation.mjs` - Real dataset evaluation
- `run-comprehensive-evaluation.mjs` - Comprehensive evaluation

**Old runners are deprecated** but still work for backward compatibility.

## Statistical Validity

### Minimum Sample Sizes
- **Development/Testing**: 4-10 samples (quick feedback)
- **Validation**: 100+ samples (statistical significance)
- **Research**: 500+ samples (publication quality)

### Current Status
- ✅ `real-dataset.json`: 4 samples (development only)
- ✅ `screenai-*.json`: 697 samples (validation ready)
- ⚠️ `webui-ground-truth.json`: ~7000 samples (needs conversion)

## Best Practices

1. **Use appropriate datasets**
   - Development: `real-dataset.json` (quick)
   - Validation: `screenai-*.json` or `webui-ground-truth.json` (proper)

2. **Check sample size**
   - Runner warns if < 30 samples
   - For proper validation, use 100+ samples

3. **Review metrics**
   - MAE < 1.0: Good score prediction
   - Precision/Recall > 0.7: Good issue detection
   - Check confidence intervals for statistical validity

4. **Compare across runs**
   - Save results with timestamps
   - Compare metrics over time
   - Track improvements/regressions

## Migration from Old Runners

### Old Way
```bash
node evaluation/runners/run-evaluation.mjs
node evaluation/runners/run-real-evaluation.mjs
```

### New Way
```bash
node evaluation/runners/evaluate.mjs --dataset=real-dataset.json
```

The new runner provides:
- ✅ Proper statistical metrics
- ✅ Precise ground truth validation
- ✅ Confidence intervals
- ✅ Better error reporting

