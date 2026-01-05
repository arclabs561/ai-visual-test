# Dataset Requirements and Dependencies

## Overview

This document lists all dataset requirements, dependencies, and what needs to be downloaded for full functionality.

## Dataset Dependencies

### ScreenAI Dataset ⚠️ Requires Rico Dataset

**Status**: ✅ Integrated (697 samples)
**Location**: `evaluation/datasets/integrated/`

**Issue**: ScreenAI samples reference Rico dataset images via `image_id`
- Screenshots are **NOT** included in ScreenAI dataset
- Need to download Rico dataset separately to get actual screenshots
- Without Rico: Samples will be skipped during evaluation (graceful handling)

**Rico Dataset**:
- Source: https://interactionmining.org/rico
- Size: ~77,000 mobile UI screenshots
- Format: Images + metadata
- Usage: Map `image_id` from ScreenAI to Rico image paths

**Workaround**: 
- ScreenAI samples can be evaluated if they have URLs (URL-based evaluation)
- Or skip gracefully with note about Rico requirement

### WebUI Dataset ✅ Self-Contained

**Status**: ✅ Available (7,000 samples via adapter, 5,420 ready for conversion)
**Location**: `evaluation/datasets/human-annotated/visual-ui-understanding/webui-dataset/webui-7k/`

**No Dependencies**: All screenshots and annotations included
- Screenshots: `.webp` files in sample directories
- Accessibility trees: `.json.gz` files
- Bounding boxes: `.json.gz` files
- Styles: `.json.gz` files
- HTML: `.html` files

### WCAG Test Cases ⚠️ Needs Better Parsing

**Status**: ⚠️ HTML index downloaded, needs individual page scraping
**Location**: `evaluation/datasets/human-annotated/wcag-test-cases/`

**Issue**: W3C HTML page is just an index
- Individual test cases are on separate pages
- Current parser finds 0 test cases
- Need: Multi-page scraper or W3C API access

**Workaround**: Use WCAG adapter which attempts to parse HTML

### Real-World Dataset ✅ Self-Contained

**Status**: ✅ Ready (4 samples)
**Location**: `evaluation/datasets/real-dataset.json`

**No Dependencies**: All screenshots included

## Evaluation Type Requirements

### Score-Based Evaluation
**Requires**:
- `groundTruth.preciseScore` (number)
- OR `groundTruth.expectedScore` (object with min/max)
- `groundTruth.structuredIssues` (array) - optional but recommended

**Datasets**:
- ✅ Real-World Dataset
- ⚠️ ScreenAI (if scores added manually)

### Accessibility Tree Validation
**Requires**:
- `groundTruth.evaluationType: 'accessibility-tree'`
- `annotations.accessibilityTree` (accessibility tree data)
- OR `groundTruth.structuredFeatures.accessibility.accessibilityTree`

**Datasets**:
- ✅ WebUI Dataset (via adapter or converted)
- ✅ ScreenAI (has accessibility trees)

### QA Evaluation
**Requires**:
- `groundTruth.structuredFeatures.question` (string)
- `groundTruth.structuredFeatures.answer` (string or array)

**Datasets**:
- ✅ ScreenAI QA (400 samples)

## Download Instructions

### Rico Dataset (for ScreenAI)
```bash
# Download Rico dataset from:
# https://interactionmining.org/rico

# Extract to:
evaluation/datasets/human-annotated/rico-dataset/

# Update ScreenAI adapter to map image_id to Rico paths
```

### MultiUI Dataset
```bash
# Download from research paper
# Size: ~7.3M samples
# Place in: evaluation/datasets/human-annotated/multiui/
```

### A11YN Dataset
```bash
# Download from research paper
# Size: 6.8K + 300 samples
# Place in: evaluation/datasets/human-annotated/a11yn/
```

## Format Compatibility

### Adapter Format (Preferred)
- Uses `groundTruth.evaluationType` to indicate validation type
- Uses `groundTruth.structuredFeatures` for structured data
- Preserves original data structure

### Converted Format
- Compatible with adapter format
- May truncate large accessibility trees (use adapter for full data)
- Includes both new format and compatibility fields

## Testing

Run format compatibility tests:
```bash
node evaluation/test/test-dataset-formats.mjs
```

This will verify:
- ✅ All datasets have correct structure
- ✅ Required fields are present
- ✅ Screenshots exist (or are properly documented as missing)
- ✅ Ground truth format matches evaluation type

