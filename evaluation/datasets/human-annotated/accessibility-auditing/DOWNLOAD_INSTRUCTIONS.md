# Download Instructions: Tabular Accessibility Dataset

## Source
https://www.mdpi.com/2306-5729/10/9/149

## Description
Benchmark for LLM-based web accessibility auditing with WCAG compliance annotations

## Annotations Included
- wcag
- violations
- ground-truth

## How to Download
1. Visit the source URL: https://www.mdpi.com/2306-5729/10/9/149
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
node evaluation/utils/convert-dataset.mjs --dataset accessibility-auditing
```
