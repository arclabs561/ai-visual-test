# Dataset Reality Check: What We Actually Have vs. What We Claim

## Critical Finding: Human Annotations Are Placeholders

### What We Claim

- ✅ "Human-annotated datasets"
- ✅ "Ground truth annotations"
- ✅ "Real human annotations, not just expected ranges"

### What We Actually Have

**Status: ALL DATASETS ARE PLACEHOLDERS**

1. **WebUI Dataset** - Status: `pending-download`
   - ❌ Not downloaded
   - ❌ No actual data
   - ✅ Only has `DOWNLOAD_INSTRUCTIONS.md`
   - ✅ Only has `metadata.json` (empty structure)

2. **Tabular Accessibility Dataset** - Status: `pending-download`
   - ❌ Not downloaded
   - ❌ No actual data
   - ✅ Only has `DOWNLOAD_INSTRUCTIONS.md`

3. **WCAG Test Cases** - Status: `pending-download`
   - ❌ Not downloaded
   - ❌ No actual data
   - ✅ Only has `DOWNLOAD_INSTRUCTIONS.md`

4. **Apple Screen Recognition Dataset** - Status: `pending-download`
   - ❌ Not downloaded
   - ❌ No actual data
   - ✅ Only has `DOWNLOAD_INSTRUCTIONS.md`

### Evidence

```json
// evaluation/datasets/human-annotated/integrated-dataset.json
{
  "datasets": [
    {
      "status": "pending-download",  // ← NOT DOWNLOADED
      "instructionsPath": ".../DOWNLOAD_INSTRUCTIONS.md"  // ← Just instructions
    }
  ],
  "samples": []  // ← EMPTY - NO SAMPLES
}
```

### What This Means

1. **No Ground Truth** - We have NO human annotations
2. **No Validation Data** - We can't validate anything
3. **Placeholder Infrastructure** - We built the structure but didn't download data
4. **Overclaiming** - We claim "human-annotated" but have none

## Available Datasets We Could Actually Use

### 1. HuggingFace Datasets (Easily Accessible)

#### WebUI Dataset
- **Source**: `huggingface.co/datasets/js0nwu/webui` (if available)
- **Size**: 400K web pages
- **Annotations**: Accessibility trees, layouts, computed styles
- **Download**: `pip install datasets && datasets.load_dataset("js0nwu/webui")`
- **Status**: Need to verify if on HuggingFace

#### Common Crawl Web Data
- **Source**: `huggingface.co/datasets/c4` or `commoncrawl.org`
- **Size**: Petabytes
- **Annotations**: None (raw web data)
- **Use**: Could capture screenshots and annotate ourselves

### 2. Papers with Code Datasets

#### UI Element Detection
- **Source**: Papers with Code → Computer Vision → UI Understanding
- **Examples**:
  - Rico Dataset (Android UI screenshots)
  - WebScreenshots Dataset
  - UI Screenshot Datasets
- **Download**: Usually GitHub repos with download scripts

### 3. Academic Datasets

#### WebUI Dataset (CHI 2023)
- **Source**: `github.com/js0nwu/webui`
- **Size**: 400K web pages
- **Annotations**: Accessibility trees, layouts, computed styles
- **Download**: GitHub repo with download instructions
- **Status**: ✅ **ACTUALLY AVAILABLE** - Just need to download

#### Tabular Accessibility Dataset (MDPI 2024)
- **Source**: `mdpi.com/2306-5729/10/9/149`
- **Annotations**: WCAG violations, ground truth labels
- **Download**: MDPI data repository (may require registration)
- **Status**: ⚠️ Need to check if publicly available

#### WCAG Test Cases (W3C)
- **Source**: `w3.org/WAI/standards-guidelines/act/report/testcases/`
- **Annotations**: Known pass/fail outcomes
- **Download**: W3C website (HTML/JSON format)
- **Status**: ✅ **PUBLICLY AVAILABLE** - Just need to scrape/download

### 4. Vision-Language Model Datasets

#### COCO (Common Objects in Context)
- **Source**: `cocodataset.org`
- **Size**: 330K images, 2.5M object instances
- **Annotations**: Object detection, segmentation, captions
- **Use**: Could adapt for UI element detection

#### Open Images Dataset
- **Source**: `storage.googleapis.com/openimages/web/index.html`
- **Size**: 9M images, 36M bounding boxes
- **Annotations**: Object detection, relationships
- **Use**: Could filter for UI/web screenshots

### 5. Accessibility-Specific Datasets

#### A11y Dataset
- **Source**: Various research papers
- **Annotations**: Accessibility violations, WCAG compliance
- **Status**: Need to search for specific papers

#### WebAIM Million
- **Source**: `webaim.org/projects/million/`
- **Size**: 1M home pages analyzed
- **Annotations**: Automated accessibility scans
- **Use**: Could use as baseline/comparison

### 6. UI/UX Testing Datasets

#### Rico Dataset (Android)
- **Source**: `interactionmining.org/rico`
- **Size**: 72K Android app screens
- **Annotations**: UI hierarchies, interactions
- **Use**: Mobile UI understanding

#### Screen2Vec Dataset
- **Source**: Research papers on screen understanding
- **Annotations**: Screen embeddings, UI element detection
- **Status**: Need to find specific papers

## What We Should Do

### Immediate Actions

1. **Download WebUI Dataset**
   ```bash
   git clone https://github.com/js0nwu/webui.git
   # Follow their download instructions
   ```

2. **Download WCAG Test Cases**
   ```bash
   # Scrape or download from W3C
   wget https://www.w3.org/WAI/standards-guidelines/act/report/testcases/
   ```

3. **Search HuggingFace**
   ```bash
   # Check if datasets are on HuggingFace
   pip install datasets
   datasets.list_datasets(search="webui")
   datasets.list_datasets(search="accessibility")
   datasets.list_datasets(search="ui")
   ```

4. **Update Documentation**
   - Change "human-annotated" to "pending-download"
   - Remove claims about ground truth
   - Document what's actually available

### Short-Term Actions

1. **Create Dataset Downloader**
   - Script to download from GitHub repos
   - Script to scrape W3C test cases
   - Script to download from HuggingFace

2. **Validate Downloads**
   - Check if downloaded data matches expected format
   - Convert to our format
   - Validate annotations exist

3. **Build Ground Truth**
   - Use downloaded annotations as ground truth
   - Supplement with our own annotations if needed
   - Validate annotation quality

### Long-Term Actions

1. **Continuous Dataset Updates**
   - Monitor for new datasets
   - Automate downloads where possible
   - Keep dataset versions

2. **Dataset Quality Validation**
   - Check annotation completeness
   - Validate annotation accuracy
   - Measure inter-annotator agreement (if multiple annotators)

3. **Dataset Documentation**
   - Document what's actually downloaded
   - Document annotation quality
   - Document usage rights/licenses

## Honest Assessment

### What We Have

- ✅ Infrastructure for dataset integration
- ✅ Conversion scripts (templates)
- ✅ Documentation structure
- ❌ **NO ACTUAL DATA** - All placeholders

### What We Need

- ❌ Download actual datasets
- ❌ Convert to our format
- ❌ Validate annotations
- ❌ Build ground truth

### What We Should Say

**Instead of:**
- "Human-annotated datasets"
- "Ground truth annotations"
- "Real human annotations"

**Say:**
- "Dataset integration infrastructure (pending downloads)"
- "Placeholder structure for human-annotated datasets"
- "Download instructions for known datasets"

## Conclusion

**Reality**: We have infrastructure but NO DATA.

**Action**: Download actual datasets before claiming we have ground truth.

**Priority**: High - Can't validate anything without data.

