# Dataset Adapter System

## Philosophy

**Keep datasets in original form. Use adapters to read them. Never duplicate data.**

## Architecture

```
Original Dataset (WebUI, ScreenAI, WCAG, etc.)
    ↓
Adapter (reads original format)
    ↓
Common Evaluation Format (in-memory, not saved)
    ↓
Evaluation Runner
```

## Adapters

### WebUI Adapter
- **Original Format**: Directory structure with screenshots, gzipped JSON files
- **Location**: `evaluation/datasets/human-annotated/visual-ui-understanding/webui-dataset/webui-7k/`
- **Adapter**: `WebUIAdapter`
- **Reads**: Directories with `screenshot_*.webp`, `axtree_*.json.gz`, etc.

### ScreenAI Adapter
- **Original Format**: CSV (annotations) + JSON (QA)
- **Location**: `evaluation/datasets/research/screenai/`
- **Adapter**: `ScreenAIAdapter`
- **Reads**: `screen_annotation/train.csv`, `screen_qa/short_answers/train.json`

### WCAG Adapter
- **Original Format**: JSON file from W3C (preferred) or HTML page
- **Location**: `evaluation/datasets/human-annotated/wcag-test-cases/testcases-actual.json`
- **Adapter**: `WCAGAdapter`
- **Reads**: JSON file with 1,189 test cases (or HTML as fallback)

### Real Dataset Adapter
- **Original Format**: Screenshot files + optional metadata file
- **Location**: `evaluation/datasets/screenshots/`
- **Adapter**: `RealDatasetAdapter`
- **Reads**: PNG/WebP files, optional `real-dataset-metadata.json`

## Usage

```javascript
import { loadDataset, listAvailableDatasets } from './dataset-adapters.mjs';

// List available datasets
const available = listAvailableDatasets();
console.log(available);

// Load dataset using adapter - flexible scaling
const dataset = await loadDataset('webui', { limit: 100 });
console.log(`Loaded ${dataset.loaded} samples from ${dataset.name} (${dataset.totalAvailable} total available)`);

// Arbitrary scaling via options
const small = await loadDataset('webui', { limit: 10 });  // Quick test
const medium = await loadDataset('webui', { limit: 100 });  // Development
const large = await loadDataset('webui', { limit: 1000 });  // Full evaluation
const all = await loadDataset('webui');  // Everything

// Pagination
const batch1 = await loadDataset('webui', { limit: 100, offset: 0 });
const batch2 = await loadDataset('webui', { limit: 100, offset: 100 });

// Random sampling (reproducible with seed)
const random = await loadDataset('webui', { 
  limit: 500, 
  strategy: 'random', 
  seed: 42 
});

// Use in evaluation
for (const sample of dataset.samples) {
  // sample is in common evaluation format
  await evaluateSample(sample);
}
```

## Scaling Options

All adapters support flexible scaling via options:

- **`limit`**: Maximum samples to load (null = all)
- **`offset`**: Skip first N samples (for pagination)
- **`strategy`**: 'sequential' (default), 'random', 'stratified'
- **`seed`**: Random seed for reproducible sampling

This allows arbitrary scaling from small tests (10 samples) to full evaluations (all 7000+ WebUI samples) via config or flags.

## Common Evaluation Format

All adapters output this format:

```typescript
{
  id: string;
  screenshot: string; // Path to screenshot
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

## Migration from Manual JSON

### Before (Manual JSON - DON'T DO THIS)
```json
// real-dataset.json - manually written, duplicates data
{
  "samples": [
    {
      "screenshot": "/path/to/screenshot.png",
      "groundTruth": { ... }
    }
  ]
}
```

### After (Adapter - DO THIS)
```javascript
// Adapter reads from original format
const adapter = new RealDatasetAdapter();
const samples = adapter.loadSamples(); // Reads from screenshots/ directory
```

## Benefits

1. **Single Source of Truth**: Original dataset files are authoritative
2. **No Duplication**: Don't create JSON files that duplicate data
3. **Format Independence**: Adapters handle format differences
4. **Easy Updates**: Update original dataset, adapter handles rest
5. **Version Control**: Only track original datasets, not generated files

## Files to Remove/Archive

These are manually written duplicates (should be removed):

- ❌ `evaluation/datasets/real-dataset.json` - Use `RealDatasetAdapter` instead
- ❌ `evaluation/datasets/webui-ground-truth.json` - Use `WebUIAdapter` instead
- ❌ `evaluation/datasets/integrated/screenai-*.json` - Use `ScreenAIAdapter` instead
- ❌ `evaluation/datasets/wcag-ground-truth.json` - Use `WCAGAdapter` instead

Keep these (original data):

- ✅ `evaluation/datasets/screenshots/*.png` - Original screenshots
- ✅ `evaluation/datasets/research/screenai/**/*.csv` - Original CSV files
- ✅ `evaluation/datasets/research/screenai/**/*.json` - Original JSON files
- ✅ `evaluation/datasets/human-annotated/visual-ui-understanding/webui-dataset/webui-7k/` - Original WebUI data

## Adding New Adapters

1. Create adapter class extending pattern:
```javascript
export class MyDatasetAdapter {
  constructor(basePath) { ... }
  isAvailable() { ... }
  loadSamples(limit) { ... }
}
```

2. Register in `DATASET_ADAPTERS`:
```javascript
export const DATASET_ADAPTERS = {
  ...
  'my-dataset': MyDatasetAdapter
};
```

3. Document original format and location

