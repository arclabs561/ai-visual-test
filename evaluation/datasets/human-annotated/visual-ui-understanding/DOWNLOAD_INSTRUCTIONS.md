# Download Instructions: WebUI Dataset

## Source
https://uimodeling.github.io/

## Description
Visual UI understanding with web semantics, HTML/CSS annotations, accessibility metadata

## Annotations Included
- html
- css
- semantic
- accessibility

## How to Download
1. Visit the source URL: https://uimodeling.github.io/
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
node evaluation/utils/convert-dataset.mjs --dataset visual-ui-understanding
```
