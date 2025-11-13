# Download Instructions: WCAG Test Cases

## Source
W3C WCAG Test Cases

## Description
Official WCAG test cases with known pass/fail outcomes

## Annotations Included
- pass
- fail
- wcag-level

## How to Download
1. Visit the source URL: W3C WCAG Test Cases
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
node evaluation/utils/convert-dataset.mjs --dataset wcag-test-cases
```
