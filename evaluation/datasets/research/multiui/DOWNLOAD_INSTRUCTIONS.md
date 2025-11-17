# MultiUI Dataset Download Instructions

## HuggingFace Dataset

**Dataset**: neulab/MultiUI
**URL**: https://huggingface.co/datasets/neulab/MultiUI
**Size**: 7.3M samples

## Download Methods

### Method 1: HuggingFace CLI

```bash
# Install huggingface-cli
pip install huggingface_hub

# Download full dataset
huggingface-cli download neulab/MultiUI --local-dir /Users/arc/Documents/dev/ai-visual-test/evaluation/datasets/research/multiui

# Or download specific splits
huggingface-cli download neulab/MultiUI --local-dir /Users/arc/Documents/dev/ai-visual-test/evaluation/datasets/research/multiui --repo-type dataset
```

### Method 2: Python

```python
from datasets import load_dataset

# Load dataset
dataset = load_dataset("neulab/MultiUI")

# Save to disk
dataset.save_to_disk("/Users/arc/Documents/dev/ai-visual-test/evaluation/datasets/research/multiui")
```

### Method 3: Web Interface

Visit: https://huggingface.co/datasets/neulab/MultiUI
Click "Files and versions" to download specific files.

## Integration

After downloading, run:
```bash
node evaluation/utils/integrate-research-datasets.mjs
```

## Note

The dataset is large (7.3M samples). Consider downloading a subset initially for testing.
