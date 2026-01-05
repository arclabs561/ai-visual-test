# Critical Bugs Found During Scrutiny

## 🚨 Critical Bug #1: Wrong Function Name

**Location**: `evaluation/runners/evaluate.mjs:497`
**Issue**: Trying to import `validateWithGroundTruth` but actual export is `evaluateWithGroundTruth`
**Impact**: Accessibility tree validation will always fail with "function not found"
**Status**: ❌ BROKEN

```javascript
// WRONG:
const { validateWithGroundTruth } = await import('../utils/validate-with-ground-truth.mjs');

// CORRECT:
const { evaluateWithGroundTruth } = await import('../utils/validate-with-ground-truth.mjs');
```

## 🚨 Critical Bug #2: Function Signature Mismatch

**Location**: `evaluation/runners/evaluate.mjs:498-501`
**Issue**: `evaluateWithGroundTruth` expects `(sample, { provider })` but we're passing `{ vllmResult, provider }`
**Impact**: Function will fail or ignore the VLLM result we already have
**Status**: ❌ BROKEN

**Actual signature**:
```javascript
async function evaluateWithGroundTruth(sample, options = {}) {
  const { provider = null } = options;
  // ... runs its own validateScreenshot call
}
```

**What we're doing**:
```javascript
const axtreeValidation = await validateWithGroundTruth(sample, {
  vllmResult: result,  // ❌ This parameter doesn't exist
  provider
});
```

## 🚨 Critical Bug #3: Accessibility Tree Location Mismatch

**Location**: `evaluation/runners/evaluate.mjs:493`
**Issue**: Checking `sample.annotations?.accessibilityTree` but:
- **Adapter samples**: Tree is in `groundTruth.structuredFeatures.accessibility.accessibilityTree` (NO `annotations` field)
- **Converted samples**: Tree is in `annotations.accessibilityTree` (but may be truncated)

**Impact**: Adapter samples will never trigger accessibility tree validation
**Status**: ❌ BROKEN

**Test Results**:
- Adapter sample: `annotations` field = false, tree in `groundTruth.structuredFeatures.accessibility.accessibilityTree`
- Converted sample: `annotations.accessibilityTree` = true (but truncated)

## 🚨 Critical Bug #4: Duplicate VLLM Calls

**Location**: `evaluation/runners/evaluate.mjs:448-457` + `evaluateWithGroundTruth`
**Issue**: We call `validateScreenshot` in `evaluateSample`, then `evaluateWithGroundTruth` calls it again
**Impact**: Double API costs, slower evaluation, unnecessary calls
**Status**: ⚠️ INEFFICIENT

## 🚨 Critical Bug #5: Truncated Accessibility Trees

**Location**: `evaluation/utils/convert-webui-dataset.mjs:255-260`
**Issue**: Large accessibility trees are truncated to `{ _truncated: true, _note: '...', nodeCount: N }`
**Impact**: Converted samples can't be validated (tree is not usable)
**Status**: ❌ BROKEN

**Test Result**:
```
annotations.accessibilityTree._truncated: true
```

## 🚨 Critical Bug #6: Inconsistent Tree Access

**Location**: Multiple files
**Issue**: Different code paths expect tree in different locations:
- `evaluate.mjs`: Checks `sample.annotations?.accessibilityTree`
- `validate-with-ground-truth.mjs`: Checks `sample.annotations?.accessibilityTree`
- `accessibility-tree-validator.mjs`: Checks `sample.annotations?.accessibilityTree`
- Adapter: Provides tree in `groundTruth.structuredFeatures.accessibility.accessibilityTree`

**Impact**: Adapter samples can't use accessibility tree validation
**Status**: ❌ BROKEN

## 🚨 Critical Bug #7: Missing Error Handling

**Location**: `evaluation/runners/evaluate.mjs:493-512`
**Issue**: If accessibility tree validation fails, we catch error but don't check if tree was actually found
**Impact**: Silent failures, unclear error messages
**Status**: ⚠️ POOR UX

## Summary

**Total Critical Bugs**: 7
- ❌ **Broken**: 5 (function name, signature, tree location, truncation, inconsistent access)
- ⚠️ **Inefficient/Poor UX**: 2 (duplicate calls, error handling)

**Impact**: Accessibility tree validation is **completely broken** for adapter samples and **partially broken** for converted samples.

