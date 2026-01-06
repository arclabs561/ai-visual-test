# Dataset Usage Guide

## Overview

This guide explains how to use the newly downloaded datasets effectively in evaluations and validation workflows.

## Available Datasets

### 1. WebUI Dataset

**Location**: `evaluation/datasets/human-annotated/visual-ui-understanding/webui-dataset/webui-7k`

**Contents**:
- ~6,920 real web UI screenshots
- Multiple viewports per sample (desktop, mobile, tablet)
- Accessibility trees (axtree.json.gz)
- Bounding boxes (box.json.gz)
- Computed styles (style.json.gz)
- HTML source (html.html)
- Links data (links.json)
- URL information

**Usage via Adapter** (No conversion needed!):
```javascript
import { loadDataset } from './evaluation/utils/dataset-adapters.mjs';

// Load any number of samples - adapter handles transformation on-the-fly
const dataset = await loadDataset('webui', { limit: 100 });
```

**Usage in Evaluations**:
```bash
# Run WebUI evaluation
node evaluation/runners/run-webui-evaluation.mjs 50

# Use in comprehensive evaluation
node evaluation/runners/comprehensive-evaluation.mjs --datasets webui
```

**Programmatic Usage** (Recommended - Adapter Pattern):
```javascript
import { loadDataset } from './evaluation/utils/dataset-adapters.mjs';

// Load dataset via adapter (no conversion needed)
const result = await loadDataset('webui', { limit: 100 });

// Access samples
const samples = result.samples;
console.log(`Loaded ${result.loaded} of ${result.totalAvailable} samples`);

// Filter samples (in-memory after loading)
const desktopSamples = samples.filter(s => 
  s.metadata?.viewport?.width === 1920 && 
  s.groundTruth?.hasAccessibilityTree
);
```

### 2. WCAG Test Cases

**Location**: `evaluation/datasets/human-annotated/wcag-test-cases/testcases.json`

**Contents**:
- HTML page with test case references
- Links to W3C ACT Rules test cases

**Usage via Adapter** (No parsing needed!):
```javascript
import { loadDataset } from './evaluation/utils/dataset-adapters.mjs';

// Load WCAG test cases - adapter reads from JSON file
const wcag = await loadDataset('wcag', { limit: 50 });
```

**Note**: The adapter reads from `testcases-actual.json` (original W3C data source).

## Integration Points

### Evaluation Runners

1. **Comprehensive Evaluation** (`evaluation/runners/comprehensive-evaluation.mjs`)
   - Supports `--datasets webui` flag
   - Automatically loads converted WebUI dataset

2. **WebUI Evaluation** (`evaluation/runners/run-webui-evaluation.mjs`)
   - Dedicated runner for WebUI dataset
   - Supports filtering and random sampling

3. **Dataset Evaluations** (`evaluation/runners/run-dataset-evaluations.mjs`)
   - Orchestrates evaluations across all datasets
   - Provides summary and next steps

### Evaluation Rig

The `evaluation/utils/evaluation-rig.mjs` has been updated to:
- Load WebUI dataset using the new converter
- Handle missing datasets gracefully
- Provide helpful error messages

## Ground Truth Format

Both datasets are converted to a standardized format:

```json
{
  "name": "Dataset Name",
  "source": "Source information",
  "version": "1.0.0",
  "created": "ISO timestamp",
  "totalSamples": 100,
  "samples": [
    {
      "id": "sample-id",
      "url": "https://example.com",
      "screenshot": "path/to/screenshot.webp",
      "viewport": { "width": 1920, "height": 1080 },
      "metadata": { ... },
      "annotations": {
        "accessibilityTree": { ... },
        "boundingBoxes": { ... },
        "styles": { ... },
        "html": "..."
      },
      "groundTruth": {
        "hasScreenshot": true,
        "hasAccessibilityTree": true,
        "hasBoundingBoxes": true,
        "hasStyles": true,
        "hasHtml": true
      }
    }
  ]
}
```

## Ground Truth Validation

The WebUI dataset includes rich ground truth annotations that can be used to validate VLLM outputs:

### Validate VLLM Claims

```bash
# Compare VLLM accessibility claims with actual accessibility tree data
node evaluation/utils/validate-with-ground-truth.mjs 20
```

This validates VLLM claims (button counts, link counts, etc.) against actual counts from accessibility trees.

### Use Accessibility Trees

```bash
# Use accessibility trees for programmatic + VLLM hybrid validation
node evaluation/utils/accessibility-tree-validator.mjs 20
```

This extracts programmatic data from accessibility trees and uses it to ground VLLM evaluation.

### Element Detection Accuracy

```bash
# Validate element detection against bounding box ground truth
node evaluation/utils/element-detection-accuracy.mjs 15
```

This compares VLLM element detection with actual bounding box locations.

### Comprehensive Evaluation

```bash
# Run all ground truth validation methods
node evaluation/utils/comprehensive-ground-truth-evaluation.mjs 10
```

This runs all validation methods and provides comprehensive accuracy analysis.

See `docs/GROUND_TRUTH_USAGE.md` for detailed documentation.

## Best Practices

1. **Start Small**: Convert and evaluate a small subset first (50-100 samples)
2. **Use Caching**: The loaders cache converted datasets for faster subsequent loads
3. **Filter Strategically**: Filter samples by viewport, annotations, or URL patterns
4. **Random Sampling**: Use random sampling for unbiased evaluation
5. **Incremental Conversion**: Convert more samples as needed rather than all at once
6. **Validate with Ground Truth**: Use ground truth annotations to validate VLLM outputs, not just report they exist
7. **Enhance Prompts**: Include ground truth context in prompts for better accuracy
8. **Calculate Metrics**: Track accuracy over time to measure improvement

## Example Workflows

### Quick Start: Evaluate 10 WebUI Samples

```bash
# 1. Convert 10 samples
node evaluation/utils/convert-webui-dataset.mjs 10

# 2. Run evaluation
node evaluation/runners/run-webui-evaluation.mjs 10
```

### Full Evaluation Pipeline

```bash
# 1. Convert datasets
node evaluation/utils/convert-webui-dataset.mjs 500
node evaluation/utils/parse-wcag-testcases.mjs

# 2. Run all evaluations
node scripts/run-all-evaluations.mjs

# 3. Check results
ls -lh evaluation/results/
```

### Programmatic Usage

```javascript
import { loadWebUIDataset } from './evaluation/utils/load-webui-dataset.mjs';
import { validateScreenshot } from './src/convenience.mjs';

// Load dataset
const dataset = await loadWebUIDataset({ limit: 50 });

// Evaluate samples
for (const sample of dataset.samples) {
  const result = await validateScreenshot(
    sample.screenshot,
    'Evaluate this webpage for accessibility and design quality'
  );
  console.log(`Sample ${sample.id}: ${result.score}/10`);
}
```

## Performance Considerations

- **Conversion Time**: ~1-2 seconds per sample (depends on file I/O)
- **Evaluation Time**: ~2-5 seconds per sample (depends on VLLM provider)
- **Storage**: Each converted sample is ~50-200KB (depends on annotations)
- **Memory**: Loading 1000 samples uses ~100-200MB

## Troubleshooting

**Issue**: "WebUI dataset not available"
- **Solution**: Run `node evaluation/utils/convert-webui-dataset.mjs` first

**Issue**: "require is not defined"
- **Solution**: Use ES module imports (`import`) instead of `require`

**Issue**: "Screenshot not found"
- **Solution**: Check that WebUI dataset was extracted correctly

**Issue**: "gzip decompression failed"
- **Solution**: Some files may be corrupted, the converter skips them automatically

## Next Steps

1. Convert more samples as needed
2. Create custom evaluation scripts using the dataset loaders
3. Integrate datasets into existing evaluation workflows
4. Use ground truth annotations for validation accuracy metrics

