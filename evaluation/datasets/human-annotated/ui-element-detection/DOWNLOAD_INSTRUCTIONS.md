# Download Instructions: Apple Screen Recognition Dataset

## Source
Apple Research

## Description
77,637 screens from 4,068 iPhone apps with UI element annotations

## Annotations Included
- ui-elements
- accessibility
- screen-annotations

## How to Download
1. Visit the source URL: Apple Research
2. Follow their download instructions
3. Place downloaded files in this directory
4. Run the conversion script to integrate with our format

## Expected Format
The dataset should include:
- Screenshots or images
- Human annotations (scores, issues, reasoning)
- Metadata (URLs, categories, etc.)

## Conversion
After downloading, run:
```bash
node evaluation/utils/convert-dataset.mjs --dataset ui-element-detection
```
