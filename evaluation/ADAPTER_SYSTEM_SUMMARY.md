# Dataset Adapter System - Summary

## Philosophy

**Keep datasets in original form. Use adapters to read them. Never duplicate data.**

Hand-crafted datasets (like `real-dataset.json`) are valuable and trustworthy - they're supported as first-class citizens while maintaining original data as source of truth.

## Key Features

### 1. Original Format Preservation
- WebUI: Reads from directory structure + `train_split_web7k.json`
- ScreenAI: Reads from CSV/JSON files directly
- WCAG: Parses HTML from W3C
- Real Dataset: Supports hand-crafted JSON (trustworthy) + screenshot directories

### 2. Arbitrary Scaling
All adapters support flexible scaling via options:

```javascript
// Quick test
await loadDataset('webui', { limit: 10 });

// Development
await loadDataset('webui', { limit: 100 });

// Full evaluation
await loadDataset('webui', { limit: 1000 });

// Everything
await loadDataset('webui');

// Pagination
await loadDataset('webui', { limit: 100, offset: 500 });

// Random sampling (reproducible)
await loadDataset('webui', { limit: 500, strategy: 'random', seed: 42 });
```

### 3. Hand-Crafted Dataset Support
The `RealDatasetAdapter` recognizes that hand-crafted datasets are valuable:
- Prefers `real-dataset.json` if it exists (trustworthy, manually curated)
- Falls back to screenshot directory scan
- Marks hand-crafted datasets with `originalFormat: 'hand-crafted-json'`

### 4. Common Evaluation Format
All adapters output the same format:
```typescript
{
  id: string;
  screenshot: string; // Path
  groundTruth: {
    preciseScore?: number;
    scoreTolerance?: number;
    structuredIssues?: string[];
    structuredFeatures?: object;
    humanAnnotations?: object;
  };
  metadata: {
    dataset: string;
    source: string;
    originalFormat: string;
  };
}
```

## Fixed Issues

1. **WebUI Adapter**: Now reads from `train_split_web7k.json` (official split file)
2. **Statistical Bugs**: Fixed stdDev calculation, t-distribution for small samples, correlation export
3. **Scaling**: Added configurable sample sizes via options/flags
4. **Hand-Crafted Support**: RealDatasetAdapter now properly supports trustworthy hand-crafted JSON

## Migration Path

### Before (Manual JSON - DON'T DO THIS)
```json
// webui-ground-truth.json - manually written, duplicates data
{
  "samples": [...]
}
```

### After (Adapter - DO THIS)
```javascript
// Adapter reads from original format
const dataset = await loadDataset('webui', { limit: 100 });
// Reads from webui-7k/ directory structure
```

## Benefits

1. **Single Source of Truth**: Original dataset files are authoritative
2. **No Duplication**: Don't create JSON files that duplicate data
3. **Format Independence**: Adapters handle format differences
4. **Easy Updates**: Update original dataset, adapter handles rest
5. **Version Control**: Only track original datasets, not generated files
6. **Arbitrary Scaling**: Scale from 10 to 7000+ samples via config/flags
7. **Hand-Crafted Support**: Trustworthy manually curated datasets are first-class

## Files to Remove/Archive

These are manually written duplicates (should be removed):

- ❌ `evaluation/datasets/webui-ground-truth.json` - Use `WebUIAdapter` instead
- ❌ `evaluation/datasets/integrated/screenai-*.json` - Use `ScreenAIAdapter` instead
- ❌ `evaluation/datasets/wcag-ground-truth.json` - Use `WCAGAdapter` instead

Keep these (original data):

- ✅ `evaluation/datasets/real-dataset.json` - Hand-crafted, trustworthy
- ✅ `evaluation/datasets/screenshots/*.png` - Original screenshots
- ✅ `evaluation/datasets/research/screenai/**/*.csv` - Original CSV files
- ✅ `evaluation/datasets/human-annotated/visual-ui-understanding/webui-dataset/webui-7k/` - Original WebUI data

