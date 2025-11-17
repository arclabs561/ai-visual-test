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

### ⚠️ Downloaded But Not Integrated

4. **WebUI Dataset** (`webui-7k/`)
   - Status: ⚠️ **DOWNLOADED, NOT CONVERTED**
   - Size: 2.70GB, ~7000 samples
   - Ground Truth: ✅ **REAL** - Accessibility trees, layouts, styles
   - Quality: ✅ **HIGH** - Research dataset with rich annotations
   - Action Required: Convert to usable format
   - Use: ⚠️ **NOT YET USABLE** - Needs conversion

5. **WCAG Test Cases** (`wcag-test-cases/testcases.json`)
   - Status: ⚠️ **DOWNLOADED, NOT PARSED**
   - Format: HTML page (not JSON)
   - Ground Truth: ✅ **REAL** - W3C official test cases
   - Quality: ✅ **HIGH** - Official WCAG test cases
   - Action Required: Parse HTML to extract test cases
   - Use: ⚠️ **NOT YET USABLE** - Needs parsing

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

### Immediate Actions
1. **Convert WebUI dataset** - 7000 samples with real annotations waiting
2. **Parse WCAG test cases** - Official test cases ready to use
3. **Use ScreenAI dataset** - Already integrated, 697 samples ready

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
- ✅ Use ScreenAI dataset (697 samples)
- ⚠️ Use WebUI dataset (once converted, 7000 samples)
- ⚠️ Use WCAG test cases (once parsed)

### For Development/Testing
- ✅ Use real-dataset.json (4 samples, quick tests)
- ✅ Use natural-language-specs-dataset.json (19 specs, parsing tests)

### Do NOT Use For Validation
- ❌ real-dataset.json with wide ranges (7-10) - too imprecise
- ❌ Placeholder datasets with 0 samples
- ❌ Datasets marked "pending-download"

## Statistics

- **Total Usable Samples**: 697 (ScreenAI only, until WebUI/WCAG converted)
- **Total Downloaded But Unused**: ~7000+ (WebUI + WCAG)
- **Total Placeholders**: 2 datasets, 0 samples
- **Validation Ready**: 1 dataset (ScreenAI)
- **Needs Conversion**: 2 datasets (WebUI, WCAG)

