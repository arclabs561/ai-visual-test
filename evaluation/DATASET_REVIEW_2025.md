# Dataset Review: Current Status and Missing Gaps

**Date**: 2025-01-XX  
**Purpose**: Comprehensive review of available datasets and identification of critical gaps

## Executive Summary

**Available Datasets**: 7,306+ samples across 3 high-quality datasets  
**Missing Critical Datasets**: 4 core use case datasets  
**Research Datasets Not Downloaded**: 6 major datasets from recent papers

---

## ✅ Currently Available and Working

### 1. WebUI Dataset
- **Status**: ✅ **FULLY OPERATIONAL**
- **Samples**: 5,420+ (from ~7,000 total)
- **Location**: `evaluation/datasets/human-annotated/visual-ui-understanding/webui-dataset/webui-7k/`
- **Adapter**: `WebUIAdapter` - `loadDataset('webui', { limit: N })`
- **Ground Truth**: ✅ Real - Accessibility trees, layouts, computed styles, bounding boxes
- **Quality**: ✅ HIGH - Research dataset with rich annotations
- **Use Cases**:
  - Semantic screenshot validation
  - Accessibility tree validation
  - Multi-modal validation (screenshot + HTML + CSS)
  - Element detection
  - Cross-modal consistency

### 2. ScreenAI Dataset
- **Status**: ✅ **FULLY OPERATIONAL**
- **Samples**: 697 total
  - 297 screen annotation samples
  - 400 QA pairs
- **Location**: `evaluation/datasets/integrated/`
- **Adapter**: `ScreenAIAdapter` - `loadDataset('screenai', { limit: N })`
- **Ground Truth**: ✅ Real - Human annotations
- **Quality**: ✅ HIGH - State-of-the-art benchmark
- **Use Cases**:
  - UI understanding
  - Question answering over screenshots
  - UI element relationships
  - Layout understanding
- **⚠️ Dependency**: Screenshots require Rico dataset (stored as `image_id` references)

### 3. WCAG Test Cases
- **Status**: ✅ **FULLY OPERATIONAL**
- **Samples**: 1,189 test cases
- **Location**: `evaluation/datasets/human-annotated/wcag-test-cases/testcases-actual.json`
- **Adapter**: `WCAGAdapter` - `loadDataset('wcag', { limit: N })`
- **Ground Truth**: ✅ Real - W3C official test cases
- **Quality**: ✅ HIGH - Official WCAG compliance test cases
- **Use Cases**:
  - WCAG compliance validation
  - Hybrid accessibility (programmatic + VLLM)
  - Issue detection for known violations
  - Accessibility auditing

### 4. Real-World Dataset
- **Status**: ✅ Available but ⚠️ **LOW QUALITY**
- **Samples**: 4
- **Location**: `evaluation/datasets/real-dataset.json`
- **Adapter**: `RealDatasetAdapter` - `loadDataset('real')`
- **Ground Truth**: ⚠️ Imprecise ranges (7-10), not true annotations
- **Quality**: ⚠️ LOW - Too small, ranges too wide
- **Use Cases**: Development/testing only, not for validation

### 5. Natural Language Specs Dataset
- **Status**: ✅ Available but ⚠️ **LIMITED SCOPE**
- **Samples**: 19 synthetic specs
- **Location**: `evaluation/datasets/natural-language-specs-dataset.json`
- **Ground Truth**: Expected interfaces, not validation results
- **Quality**: ⚠️ MEDIUM - Useful for spec parsing tests
- **Use Cases**: Testing spec parsing, not VLLM validation

### 6. Other Synthetic Datasets
- **Ablation Test Dataset**: Available
- **Temporal Graph Dataset**: Available
- **Screenshot Selection Dataset**: Available
- **Calibration Degradation Dataset**: Available

**Total Usable Samples**: 7,306+ (WebUI: 5,420+ + ScreenAI: 697 + WCAG: 1,189)

---

## ⚠️ Download Attempts (2025-01-XX)

### 1. MultiUI Dataset
- **Status**: ❌ **DOWNLOAD FAILED** - Requires authentication
- **HuggingFace**: `neulab/MultiUI`
- **Issue**: Gated repository, requires HuggingFace account with access
- **Adapter**: ✅ Created (`MultiUIAdapter`)
- **Action**: Authenticate with HuggingFace and request access

### 2. GUIOdyssey Dataset
- **Status**: ⚠️ **PARTIAL DOWNLOAD** - Rate limited
- **HuggingFace**: `hflqf88888/GUIOdyssey`
- **Progress**: ~33% downloaded (2,785/8,350 files)
- **Issue**: Rate limited (429 errors) - need authentication
- **Adapter**: ✅ Created (`GUIOdysseyAdapter`)
- **Action**: Authenticate with HuggingFace and resume download

## ⚠️ Partially Available (Downloaded but Not Integrated)

### 1. ScreenAI Research Data
- **Status**: ⚠️ Downloaded but needs adapter enhancement
- **Location**: `evaluation/datasets/research/screenai/`
- **Contents**:
  - `screen_annotation/` - CSV files (train/test/valid)
  - `screen_qa/answers_and_bboxes/` - JSON files
  - `screen_qa/short_answers/` - JSON files
  - `screen_qa/complex_qa/` - JSON file
- **Issue**: Current adapter only uses integrated format (697 samples), not full research data
- **Potential**: Could expand to 86K+ QA pairs if fully integrated
- **Action**: Enhance `ScreenAIAdapter` to read from research directory

### 2. MultiUI Dataset
- **Status**: ❌ **NOT DOWNLOADED** - Only instructions exist
- **Location**: `evaluation/datasets/research/multiui/DOWNLOAD_INSTRUCTIONS.md`
- **Size**: 7.3M samples from 1M websites
- **Source**: HuggingFace - `neulab/MultiUI`
- **Annotations**: Screenshots + accessibility trees, multimodal tasks
- **Priority**: HIGH - Massive scale, multi-modal
- **Action**: Download from HuggingFace

### 3. A11YN Dataset
- **Status**: ❌ **NOT DOWNLOADED** - Only metadata exists
- **Location**: `evaluation/datasets/research/a11yn/A11YN_DATASET_INFO.json`
- **Size**: 
  - UIReq-6.8K: 6,800 samples
  - RealUIReq-300: 300 samples
- **Source**: Paper supplement, OpenReview, or HuggingFace
- **Annotations**: WCAG compliance annotations, accessibility violations
- **Priority**: HIGH - Accessibility focus, real-world requests
- **Action**: Download from paper supplement or HuggingFace

---

## ❌ Missing Critical Datasets (Core Use Cases)

### 1. High-Frequency (60Hz) Gameplay Dataset ⚠️ **CRITICAL**
- **Status**: ❌ **MISSING**
- **Required Size**: 1000+ frames at 60Hz (16.67ms intervals)
- **Required Annotations**:
  - 60Hz frame sequences
  - Game state per frame (score, level, position)
  - Temporal decision points
  - Activity patterns
- **Capabilities to Test**:
  - High-Frequency Validation (core feature)
  - Temporal Decision Making (reduces LLM calls by 98.5%)
  - Latency-Aware Batching (<100ms latency)
  - Activity-Based Preprocessing
  - Model Tier Selection
- **Priority**: **CRITICAL** - Core use case, no existing dataset
- **Action**: **MUST CREATE** - No existing research dataset has 60Hz sequences

### 2. Game Testing Dataset
- **Status**: ❌ **MISSING**
- **Required Size**: 100+ game scenarios
- **Required Annotations**:
  - Game screenshots
  - Game state (score, level, position)
  - Variable goals
  - Temporal sequences
- **Capabilities to Test**:
  - Game Playing (actually plays games)
  - Variable Goals (different criteria based on game state)
  - State Extraction (extracts game state from screenshots)
  - Game Goal Prompts (generates prompts from goals)
- **Priority**: HIGH - Core use case
- **Action**: Create or find existing game testing datasets

### 3. Persona Diversity Dataset
- **Status**: ❌ **MISSING**
- **Required Size**: 50+ UIs with 3+ personas each
- **Required Annotations**:
  - Same screenshot
  - Multiple persona evaluations
  - Persona consistency metrics
- **Capabilities to Test**:
  - Persona-Based Testing (multiple perspectives)
  - Experience Tracing (tracks user experience over time)
  - Persona Consistency
  - Persona Diversity
- **Priority**: MEDIUM - Advanced feature
- **Action**: Create custom dataset

### 4. Ensemble Comparison Dataset
- **Status**: ❌ **MISSING**
- **Required Size**: 100+ screenshots
- **Required Annotations**:
  - Same screenshot
  - Results from multiple providers (Gemini, OpenAI, Claude, Groq)
  - Consensus metrics
- **Capabilities to Test**:
  - Ensemble Judging (multiple providers with consensus)
  - Multi-Provider Support
  - Consensus Validation
  - Provider Comparison
- **Priority**: MEDIUM - Advanced feature
- **Action**: Create custom dataset by running same screenshots through all providers

---

## ❌ Missing Research Datasets (From arXiv Papers)

### 1. GUIOdyssey Dataset
- **Source**: arXiv:2406.08451v2
- **Size**: 8,334 episodes, 15.3 steps/episode average
- **Annotations**: Cross-app navigation, temporal sequences, semantic reasoning
- **Capabilities**: Cross-app navigation, temporal sequences, game testing
- **Priority**: HIGH - Temporal sequences, cross-app navigation
- **Status**: ❌ Not downloaded
- **Action**: Download from paper repository

### 2. Ferret-UI Dataset
- **Source**: arXiv:2404.05719v1
- **Size**: Extensive training samples (elementary + advanced tasks)
- **Annotations**: Icon recognition, widget listing, referring/grounding, function inference
- **Capabilities**: Mobile UI understanding, element detection, referring/grounding
- **Priority**: HIGH - Mobile UI focus, comprehensive tasks
- **Status**: ❌ Not downloaded
- **Action**: Download from paper repository

### 3. ILuvUI Dataset
- **Source**: arXiv:2310.04869v1
- **Size**: 335K conversational examples
- **Annotations**: Q&A pairs, UI descriptions, planning tasks (from accessibility trees)
- **Capabilities**: Conversational UI understanding, Q&A, planning
- **Priority**: MEDIUM - Large scale, conversational format
- **Status**: ❌ Not downloaded
- **Action**: Download from paper repository

### 4. AutomotiveUI-Bench-4K
- **Source**: arXiv:2505.05895v3
- **Size**: 998 images, 4,208 annotations
- **Annotations**: Visual grounding, UI element detection, reasoning
- **Capabilities**: Cross-domain generalization, specialized domain
- **Priority**: MEDIUM - Specialized domain, good for generalization
- **Status**: ❌ Not downloaded
- **Action**: Download from HuggingFace (mentioned in paper)

### 5. Rico Dataset (Dependency)
- **Source**: CHI 2017 - https://interactionmining.org/rico
- **Size**: 66,000+ Android app screens
- **Annotations**: UI hierarchies, interaction traces, screenshots
- **Purpose**: Required for ScreenAI dataset screenshots (ScreenAI references Rico via `image_id`)
- **Status**: ❌ Not downloaded
- **Priority**: MEDIUM - Needed for full ScreenAI dataset usage
- **Action**: Download Rico dataset to enable ScreenAI screenshot access

### 6. VisionDroid Bug Dataset
- **Source**: Research paper (need to verify exact arXiv ID)
- **Size**: 200+ curated bugs (expandable)
- **Annotations**: Bug descriptions, screenshots, natural language reproduction paths
- **Capabilities**: Real-world functional bug detection, issue detection
- **Priority**: HIGH - Real-world functional testing
- **Status**: ❌ Not downloaded
- **Action**: Verify paper and download from repository

---

## Capability Coverage Analysis

### Fully Covered Capabilities ✅
- Semantic Screenshot Validation (WebUI, ScreenAI, WCAG, Real)
- Multi-Provider Support (all datasets)
- Score Extraction (Real, WebUI)
- Issue Detection (WCAG, WebUI)
- Accessibility Tree Validation (WebUI, ScreenAI)
- WCAG Compliance (WCAG)
- Multi-Modal Validation (WebUI, ScreenAI)
- QA Evaluation (ScreenAI)

### Partially Covered Capabilities ⚠️
- Temporal Sequences (Temporal Graph dataset, but not 60Hz)
- Game Testing (Natural Language Specs, but not actual game screenshots)
- Persona Testing (no dataset)
- Ensemble Judging (no dataset)

### Not Covered Capabilities ❌
- **High-Frequency (60Hz) Validation** - CRITICAL GAP
- **60Hz Gameplay Sequences** - CRITICAL GAP
- **Game State Extraction** - Missing game-specific dataset
- **Persona Diversity** - No dataset
- **Ensemble Comparison** - No dataset

---

## Priority Actions

### Immediate (Critical for Core Use Cases)
1. **Create 60Hz Gameplay Dataset** - CRITICAL
   - No existing dataset has 60Hz frame sequences
   - Required for high-frequency validation (core feature)
   - Action: Record gameplay sequences at 60Hz, annotate game state per frame

2. **Create Game Testing Dataset** - HIGH
   - Required for game playing and state extraction features
   - Action: Collect game screenshots with state annotations

### Short-Term (Enhance Existing Coverage)
3. **Download Rico Dataset** - MEDIUM
   - Enables full ScreenAI dataset usage (screenshots)
   - Action: Download from https://interactionmining.org/rico

4. **Enhance ScreenAI Adapter** - MEDIUM
   - Integrate full research data (86K+ QA pairs vs current 697)
   - Action: Update `ScreenAIAdapter` to read from research directory

5. **Download MultiUI Dataset** - HIGH
   - Massive scale (7.3M samples), multi-modal
   - Action: Download from HuggingFace `neulab/MultiUI`

6. **Download A11YN Dataset** - HIGH
   - Accessibility focus, real-world requests
   - Action: Download from paper supplement or HuggingFace

### Medium-Term (Research Datasets)
7. **Download GUIOdyssey** - HIGH
   - Temporal sequences, cross-app navigation
   - Action: Download from paper repository

8. **Download Ferret-UI** - HIGH
   - Mobile UI, comprehensive tasks
   - Action: Download from paper repository

9. **Download ILuvUI** - MEDIUM
   - Large scale, conversational format
   - Action: Download from paper repository

10. **Download AutomotiveUI-Bench-4K** - MEDIUM
    - Cross-domain generalization
    - Action: Download from HuggingFace

### Long-Term (Advanced Features)
11. **Create Persona Diversity Dataset** - MEDIUM
    - Advanced feature testing
    - Action: Run same screenshots through multiple persona prompts

12. **Create Ensemble Comparison Dataset** - MEDIUM
    - Advanced feature testing
    - Action: Run same screenshots through all providers (Gemini, OpenAI, Claude, Groq)

---

## Dataset Statistics Summary

| Category | Available | Missing | Total Needed |
|----------|-----------|---------|--------------|
| **High-Quality Datasets** | 3 (7,306+ samples) | 0 | 3 |
| **Low-Quality Datasets** | 2 (23 samples) | 0 | 2 |
| **Critical Use Case Datasets** | 0 | 2 | 2 |
| **Advanced Feature Datasets** | 0 | 2 | 2 |
| **Research Datasets (Downloaded)** | 1 (partial) | 5 | 6 |
| **Research Datasets (Not Downloaded)** | 0 | 6 | 6 |

**Total Available**: 7,329+ samples  
**Total Missing**: 15+ datasets (2 critical, 2 advanced, 11 research)

---

## Recommendations

### For Immediate Validation
- ✅ Use WebUI dataset (5,420+ samples) for accessibility and multi-modal validation
- ✅ Use ScreenAI dataset (697 samples) for UI understanding and QA
- ✅ Use WCAG test cases (1,189) for WCAG compliance validation

### For Core Use Cases (60Hz, Games)
- ❌ **CRITICAL**: Must create 60Hz gameplay dataset - no existing alternative
- ❌ **HIGH**: Must create game testing dataset - no suitable existing alternative

### For Research Comparison
- Download MultiUI (7.3M samples) for scale comparison
- Download A11YN for accessibility-focused comparison
- Download GUIOdyssey for temporal sequence comparison

### For Advanced Features
- Create persona diversity dataset (run same screenshots with different personas)
- Create ensemble comparison dataset (run same screenshots with all providers)

---

## Next Steps

1. **Immediate**: Create 60Hz gameplay dataset (critical gap)
2. **Short-term**: Download Rico dataset (enables ScreenAI screenshots)
3. **Short-term**: Download MultiUI and A11YN (high-priority research datasets)
4. **Medium-term**: Download remaining research datasets (GUIOdyssey, Ferret-UI, etc.)
5. **Long-term**: Create advanced feature datasets (persona, ensemble)

---

## Notes

- All available datasets use adapter pattern (`loadDataset(name, options)`)
- Adapters preserve original data format, transform on-the-fly
- No data duplication - original datasets are source of truth
- Flexible scaling via `limit` and `offset` options
- Current coverage: Good for accessibility, UI understanding, WCAG compliance
- Current gaps: Critical for 60Hz gameplay, game testing, persona, ensemble

