# Deep Validation Issues Found

## Critical Issues

### 1. WebUI Ground Truth Format Mismatch ❌

**Problem**: WebUI converter creates wrong ground truth structure
- Creates: `{ hasScreenshot: true, hasAccessibilityTree: true, ... }`
- Evaluator expects: `{ preciseScore: 8.0, structuredIssues: [...], structuredFeatures: {...} }`

**Root Cause**: WebUI dataset is for **accessibility tree validation**, not **score validation**
- WebUI has accessibility trees, bounding boxes, styles (structural data)
- WebUI does NOT have human scores or issue lists
- Two different evaluation paths needed:
  1. Score-based evaluation (real-dataset.json, ScreenAI with scores)
  2. Accessibility tree validation (WebUI dataset)

**Impact**: WebUI samples cannot be validated against scores (they don't have scores)

**Fix Needed**: 
- WebUI converter should NOT create score-based groundTruth
- Should use `validate-with-ground-truth.mjs` for accessibility tree validation instead
- Or mark groundTruth as `{ evaluationType: 'accessibility-tree', hasAccessibilityTree: true }`

### 2. ScreenAI Samples Missing Screenshots ⚠️

**Problem**: ScreenAI samples have `screenshot: null`
- ScreenAI uses `image_id` to reference Rico dataset images
- Rico dataset not downloaded/integrated
- Evaluator will fail: "Screenshot not found and no URL provided"

**Impact**: ScreenAI samples cannot be evaluated without Rico dataset

**Fix Needed**:
- Skip ScreenAI samples without screenshots gracefully
- Or download Rico dataset and map image_id to screenshot paths
- Or use URL-based evaluation if sample has URL

### 3. Evaluator Doesn't Handle Different Ground Truth Types

**Problem**: `validateAgainstGroundTruth` only handles score-based validation
- Expects `preciseScore` and `structuredIssues`
- WebUI samples have accessibility trees, not scores
- No fallback for different evaluation types

**Impact**: WebUI samples fail validation silently (no score to compare)

**Fix Needed**:
- Check `groundTruth.evaluationType` or presence of `accessibilityTree`
- Route to appropriate validation function:
  - Score-based → `validateAgainstGroundTruth` (current)
  - Accessibility tree → `validate-with-ground-truth.mjs` (exists but not used)

### 4. WebUI Adapter vs Converter Inconsistency

**Problem**: Adapter and converter create different structures
- **Adapter**: Creates `groundTruth.structuredFeatures.accessibility.accessibilityTree`
- **Converter**: Creates `groundTruth.hasAccessibilityTree` + `annotations.accessibilityTree`
- Inconsistent field locations

**Impact**: Code expecting one format won't work with the other

**Fix Needed**: Standardize on one format (prefer adapter format - it's cleaner)

## Data Quality Issues

### 5. WebUI Samples Don't Have Human Scores

**Finding**: WebUI dataset is structural, not evaluative
- Has accessibility trees (programmatic data)
- Has bounding boxes (layout data)
- Has styles (CSS data)
- Does NOT have human-annotated scores or issues

**Implication**: WebUI should be used for:
- Multi-modal validation (screenshot + HTML + CSS + accessibility tree)
- Accessibility tree accuracy validation
- Element detection validation
- NOT for score prediction validation

### 6. ScreenAI QA Format Mismatch

**Finding**: ScreenAI QA samples have different structure
- Has `groundTruth.structuredFeatures.question` and `.answer`
- Does NOT have `preciseScore` or `structuredIssues`
- This is correct for QA task, but evaluator doesn't handle it

**Implication**: Need QA-specific evaluation path

## Recommended Fixes

### Priority 1: Fix WebUI Ground Truth Format
1. Update converter to use proper format for accessibility tree validation
2. Add `evaluationType` field to distinguish evaluation types
3. Route to correct validation function based on type

### Priority 2: Handle Missing Screenshots
1. Skip samples without screenshots gracefully
2. Use URL-based evaluation if available
3. Document which datasets need additional downloads (Rico for ScreenAI)

### Priority 3: Support Multiple Evaluation Types
1. Add evaluation type detection
2. Route to appropriate validator:
   - Score-based → current `validateAgainstGroundTruth`
   - Accessibility tree → `validate-with-ground-truth.mjs`
   - QA → new QA validator (if needed)

### Priority 4: Standardize Formats
1. Make adapter and converter use same structure
2. Prefer adapter format (it's cleaner and more flexible)
3. Update all code to use consistent field locations

