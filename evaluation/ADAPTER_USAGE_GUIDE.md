# Dataset Adapter Usage Guide

## Quick Start

**Don't convert datasets - use adapters!**

```javascript
import { loadDataset } from './evaluation/utils/dataset-adapters.mjs';

// Load any dataset - adapters handle transformation on-the-fly
const webui = await loadDataset('webui', { limit: 100 });
const wcag = await loadDataset('wcag', { limit: 50 });
const screenai = await loadDataset('screenai', { limit: 200 });
```

## Why Adapters?

### ❌ Don't Do This (Conversion)
```bash
# Creates 600MB duplicate file - NOT NEEDED!
node evaluation/utils/convert-webui-dataset.mjs
```

### ✅ Do This (Adapter)
```javascript
// Reads from original format, transforms on-the-fly
const dataset = await loadDataset('webui', { limit: 100 });
```

## Benefits

1. **No Data Duplication**: Original datasets are source of truth
2. **Flexible Scaling**: Load 10, 100, or 1000 samples via `limit`
3. **Always Current**: Changes to original dataset automatically reflected
4. **Memory Efficient**: Only loads what you need, when you need it
5. **No Maintenance**: Don't keep JSON files in sync

## Available Datasets

| Dataset | Adapter | Samples | Usage |
|---------|---------|---------|-------|
| WebUI | `WebUIAdapter` | 5,420+ | `loadDataset('webui', { limit: N })` |
| ScreenAI | `ScreenAIAdapter` | 697 | `loadDataset('screenai', { limit: N })` |
| WCAG | `WCAGAdapter` | 1,189 | `loadDataset('wcag', { limit: N })` |
| Real | `RealDatasetAdapter` | 4 | `loadDataset('real')` |

## Flexible Scaling

```javascript
// Quick test (10 samples)
const quick = await loadDataset('webui', { limit: 10 });

// Development (100 samples)
const dev = await loadDataset('webui', { limit: 100 });

// Full evaluation (1000 samples)
const full = await loadDataset('webui', { limit: 1000 });

// Everything (no limit)
const all = await loadDataset('webui');

// Pagination
const page2 = await loadDataset('webui', { limit: 100, offset: 100 });

// Random sampling (reproducible)
const random = await loadDataset('webui', { 
  limit: 500, 
  strategy: 'random', 
  seed: 42 
});
```

## Evaluation Runner Usage

```bash
# Use adapter directly (recommended)
node evaluation/runners/evaluate.mjs --dataset=webui --limit=100

# Or in code
const result = await loadDataset('webui', { limit: 100 });
// Use result.samples for evaluation
```

## What Files to Keep

### ✅ Keep (Original Data - Source of Truth)
- `evaluation/datasets/human-annotated/visual-ui-understanding/webui-dataset/webui-7k/` - WebUI original
- `evaluation/datasets/human-annotated/wcag-test-cases/testcases-actual.json` - WCAG original
- `evaluation/datasets/research/screenai/` - ScreenAI original
- `evaluation/datasets/real-dataset.json` - Hand-crafted, trustworthy

### ❌ Don't Create (Use Adapters Instead)
- `evaluation/datasets/webui-ground-truth.json` - Use `WebUIAdapter`
- `evaluation/datasets/wcag-ground-truth.json` - Use `WCAGAdapter`
- `evaluation/datasets/integrated/screenai-*.json` - Use `ScreenAIAdapter`

## Migration from Converted Files

If you have converted JSON files:

1. **Delete them** - They're duplicates
2. **Use adapters** - `loadDataset('webui')` instead
3. **Update code** - Replace file reads with adapter calls

### Before (Using Converted File)
```javascript
const data = JSON.parse(readFileSync('webui-ground-truth.json'));
const samples = data.samples.slice(0, 100);
```

### After (Using Adapter)
```javascript
const { loadDataset } = await import('./evaluation/utils/dataset-adapters.mjs');
const result = await loadDataset('webui', { limit: 100 });
const samples = result.samples;
```

## Troubleshooting

### "Dataset not available"
```javascript
import { listAvailableDatasets } from './evaluation/utils/dataset-adapters.mjs';

const available = listAvailableDatasets();
console.log(available);
// Check which datasets are available and why
```

### "Need to extract dataset"
Some datasets come as zip files. Extract first:
```bash
# WebUI comes as split zip files
node evaluation/utils/extract-webui-dataset.mjs
```

### "Adapter not found"
Make sure the dataset is registered:
```javascript
import { DATASET_ADAPTERS } from './evaluation/utils/dataset-adapters.mjs';
console.log(Object.keys(DATASET_ADAPTERS));
// ['webui', 'screenai', 'wcag', 'real', ...]
```

## Summary

**Remember**: Adapters = Just-in-time transformation. No conversion needed!

