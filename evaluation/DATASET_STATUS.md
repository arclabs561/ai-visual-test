# Dataset Status - Honest Assessment

## Current Reality

### ✅ Actually Available and Usable

1. **Real-World Dataset** (`real-dataset.json`)
   - Status: ✅ **ACTIVE**
   - Samples: 4
   - Ground Truth: Imprecise ranges (7-10), not true annotations
   - Quality: ⚠️ **LOW** - Too small, ranges too wide
   - Use: Development/testing only, not for validation

2. **Natural Language Specs** (`natural-language-specs-dataset.json`)
   - Status: ✅ **ACTIVE**
   - Samples: 19 synthetic specs
   - Ground Truth: Expected interfaces, not validation results
   - Quality: ⚠️ **MEDIUM** - Useful for spec parsing tests
   - Use: Testing spec parsing, not VLLM validation

3. **ScreenAI Dataset** (`evaluation/datasets/integrated/`)
   - Status: ✅ **INTEGRATED**
   - Samples: 697 (297 annotation + 400 QA)
   - Ground Truth: ✅ **REAL** - Human annotations
   - Quality: ✅ **HIGH** - Actual human-annotated data
   - Use: ✅ **VALIDATION READY**

### ✅ Downloaded and Available via Adapters

4. **WebUI Dataset** (`webui-7k/`)
   - Status: ✅ **AVAILABLE VIA ADAPTER**
   - Size: 2.70GB, ~7000 samples (5,420 extracted)
   - Ground Truth: ✅ **REAL** - Accessibility trees, layouts, styles
   - Quality: ✅ **HIGH** - Research dataset with rich annotations
   - Usage: ✅ **USE ADAPTER** - `loadDataset('webui', { limit: N })`
   - Adapter: `WebUIAdapter` - Reads from original directories, transforms on-the-fly
   - Use: ✅ **READY** - No conversion needed, adapter handles it

5. **WCAG Test Cases** (`wcag-test-cases/testcases-actual.json`)
   - Status: ✅ **AVAILABLE VIA ADAPTER**
   - Format: JSON (1,189 test cases)
   - Ground Truth: ✅ **REAL** - W3C official test cases
   - Quality: ✅ **HIGH** - Official WCAG test cases
   - Usage: ✅ **USE ADAPTER** - `loadDataset('wcag', { limit: N })`
   - Adapter: `WCAGAdapter` - Reads from JSON file
   - Use: ✅ **READY** - No parsing needed, adapter handles it

### ❌ Placeholders (No Data)

6. **Tabular Accessibility Dataset**
   - Status: ❌ **PLACEHOLDER**
   - Samples: 0
   - Action Required: Download from MDPI repository

7. **Apple Screen Recognition Dataset**
   - Status: ❌ **PLACEHOLDER**
   - Samples: 0
   - Action Required: Download from source

## Ground Truth Quality

### High Quality (Real Annotations)
- ✅ ScreenAI: Human-annotated screens with QA pairs
- ✅ WebUI: Accessibility trees, layouts, computed styles (once converted)
- ✅ WCAG: Official W3C test cases with known pass/fail (once parsed)

### Low Quality (Imprecise/Incomplete)
- ⚠️ Real-World Dataset: Wide score ranges (7-10), no structured annotations
- ⚠️ Natural Language Specs: Interface expectations, not validation results

## Recommendations

### ✅ All Datasets Ready via Adapters
1. ✅ **WebUI dataset** - Use `loadDataset('webui')` - 5,420+ samples available
2. ✅ **WCAG test cases** - Use `loadDataset('wcag')` - 1,189 test cases available
3. ✅ **ScreenAI dataset** - Use `loadDataset('screenai')` - 697 samples available

**No conversion needed** - Adapters handle transformation on-the-fly!

### Short-Term Actions
1. **Improve real-dataset.json** - Replace ranges with precise scores or structured annotations
2. **Create validation dataset** - 100+ samples with precise ground truth
3. **Document annotation methodology** - How ground truth was created

### Long-Term Actions
1. **Download remaining datasets** - Tabular Accessibility, Apple Screen Recognition
2. **Build custom dataset** - 500+ samples with validated annotations
3. **Validate annotation quality** - Inter-annotator agreement, consistency checks

## Usage Guidelines

### For Validation (Requires Real Ground Truth)
- ✅ Use ScreenAI dataset (697 samples) - `loadDataset('screenai')`
- ✅ Use WebUI dataset (5,420+ samples) - `loadDataset('webui', { limit: N })`
- ✅ Use WCAG test cases (1,189 test cases) - `loadDataset('wcag', { limit: N })`

### For Development/Testing
- ✅ Use real-dataset.json (4 samples, quick tests)
- ✅ Use natural-language-specs-dataset.json (19 specs, parsing tests)

### Do NOT Use For Validation
- ❌ real-dataset.json with wide ranges (7-10) - too imprecise
- ❌ Placeholder datasets with 0 samples
- ❌ Datasets marked "pending-download"

## Statistics

- **Total Usable Samples**: 7,306+ (ScreenAI: 697 + WebUI: 5,420+ + WCAG: 1,189)
- **Total Available via Adapters**: 7,306+ samples
- **Total Placeholders**: 2 datasets, 0 samples
- **Validation Ready**: 3 datasets (ScreenAI, WebUI, WCAG)
- **Needs Conversion**: 0 datasets - All use adapters!

