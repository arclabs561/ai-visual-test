# Dataset Capability Mapping: Comprehensive Evaluation Strategy

## System Capabilities Overview

Based on codebase analysis, this system has the following capabilities that need testing:

### Core Validation
1. **Semantic Screenshot Validation** - Understands UI meaning, not just pixels
2. **Multi-Provider Support** - Gemini, OpenAI, Claude, Groq
3. **Score Extraction** - 0-10 scale with reasoning
4. **Issue Detection** - Identifies accessibility, design, UX issues

### High-Frequency Features (60Hz)
5. **Temporal Decision Making** - Reduces LLM calls by 98.5%
6. **Latency-Aware Batching** - <100ms latency for real-time games
7. **Activity-Based Preprocessing** - Fast path during high-Hz periods
8. **Model Tier Selection** - Auto-selects fast tier for high-frequency

### Temporal & Sequence Understanding
9. **Temporal Aggregation** - Understands gameplay over time
10. **Temporal Graph Building** - Entity/state tracking across frames
11. **Screenshot Selection** - Keyframe/diversity/uniform strategies
12. **Coherence Analysis** - Detects quality issues in sequences

### Multi-Modal
13. **Multi-Modal Validation** - Screenshot + HTML + CSS + rendered code
14. **Cross-Modal Consistency** - Validates consistency across modalities
15. **Rendered Code Extraction** - Extracts HTML/CSS from page

### Persona & Experience
16. **Persona-Based Testing** - Multiple perspectives on same UI
17. **Experience Tracing** - Tracks user experience over time
18. **Experience Propagation** - Tracks how changes propagate

### Game Testing
19. **Game Playing** - Actually plays games (not just testing)
20. **Variable Goals** - Different criteria based on game state
21. **State Extraction** - Extracts game state from screenshots
22. **Game Goal Prompts** - Generates prompts from goals

### Accessibility
23. **Hybrid Accessibility** - Programmatic + VLLM semantic
24. **WCAG Compliance** - Validates against WCAG standards
25. **Accessibility Tree Validation** - Compares against ground truth

### Advanced Features
26. **Ensemble Judging** - Multiple providers with consensus
27. **Uncertainty Reduction** - Estimates confidence/uncertainty
28. **Bias Detection & Mitigation** - Detects and mitigates bias
29. **Hallucination Detection** - Detects when VLLM makes things up
30. **Calibration Tracking** - Tracks calibration degradation over sequences
31. **Counterfactual Testing** - Detects memorization vs. visual analysis
32. **Capability Stratification** - Tests low/mid/high-level capabilities
33. **Baseline Validation** - Tests visual discriminative power

## Current Datasets

### 1. WebUI Dataset (webui-ground-truth.json)
**Status**: Available (400K web pages)
**Annotations**: Accessibility trees, layouts, computed styles, bounding boxes
**Capabilities to Test**:
- ✅ Semantic Screenshot Validation (core)
- ✅ Accessibility Tree Validation (#25)
- ✅ Element Detection (buttons, links, headings)
- ✅ Multi-Modal Validation (#13) - has HTML/CSS
- ✅ Cross-Modal Consistency (#14)
- ✅ Ground Truth Comparison
- ⚠️ Temporal Sequences - needs temporal annotations
- ❌ High-Frequency - not designed for 60Hz
- ❌ Game Testing - not game-focused

**Usage Strategy**:
- Primary dataset for accessibility validation
- Test element detection accuracy
- Validate multi-modal consistency
- Ground truth comparison for core validation

### 2. WCAG Test Cases (wcag-ground-truth.json)
**Status**: Available (1000+ test cases)
**Annotations**: Pass/fail, WCAG level, rule ID
**Capabilities to Test**:
- ✅ WCAG Compliance (#24)
- ✅ Hybrid Accessibility (#23)
- ✅ Issue Detection (#4) - specific WCAG violations
- ✅ Ground Truth Comparison
- ❌ Temporal Sequences
- ❌ High-Frequency
- ❌ Game Testing

**Usage Strategy**:
- Test WCAG-specific validation
- Validate issue detection for known violations
- Test hybrid accessibility (programmatic + VLLM)

### 3. Temporal Graph Dataset (temporal-graph.json)
**Status**: Available
**Annotations**: Temporal sequences, entity tracking
**Capabilities to Test**:
- ✅ Temporal Aggregation (#9)
- ✅ Temporal Graph Building (#10)
- ✅ Coherence Analysis (#12)
- ✅ Entity/State Tracking
- ⚠️ Screenshot Selection (#11) - if has multiple frames
- ❌ High-Frequency - needs 60Hz sequences
- ❌ Game Testing - not game-focused

**Usage Strategy**:
- Test temporal understanding
- Validate graph building
- Test coherence detection
- Test entity continuity

### 4. Screenshot Selection Dataset (screenshot-selection.json)
**Status**: Available
**Annotations**: Multiple frames, keyframes, diversity metrics
**Capabilities to Test**:
- ✅ Screenshot Selection (#11) - all strategies
- ✅ Keyframe Detection
- ✅ Diversity Selection
- ✅ Uniform Selection
- ⚠️ Temporal Aggregation (#9) - if has temporal notes
- ❌ High-Frequency - needs 60Hz sequences

**Usage Strategy**:
- Test all screenshot selection strategies
- Validate keyframe detection
- Test context window management

### 5. Calibration Degradation Dataset (calibration-degradation.json)
**Status**: Available
**Annotations**: Sequence scores, calibration metrics
**Capabilities to Test**:
- ✅ Calibration Tracking (#30)
- ✅ Sequence Calibration
- ✅ Degradation Detection
- ⚠️ Temporal Sequences (#9) - if has temporal notes
- ❌ High-Frequency - needs 60Hz sequences

**Usage Strategy**:
- Test calibration tracking
- Validate degradation detection
- Test recalibration recommendations

### 6. Natural Language Specs Dataset (natural-language-specs-dataset.json)
**Status**: Available
**Annotations**: BDD-style specs, expected interfaces
**Capabilities to Test**:
- ✅ Variable Goals (#20)
- ✅ Game Goal Prompts (#22)
- ✅ Game Testing (#19) - has game specs
- ✅ Spec Execution
- ⚠️ Temporal Sequences - if specs include temporal
- ❌ High-Frequency - not designed for 60Hz

**Usage Strategy**:
- Test variable goal handling
- Validate spec execution
- Test game testing workflows

### 7. Real Dataset (real-dataset.json)
**Status**: Available
**Annotations**: Real websites, expected scores
**Capabilities to Test**:
- ✅ Semantic Screenshot Validation (#1)
- ✅ Score Extraction (#3)
- ✅ Issue Detection (#4)
- ✅ Multi-Provider Support (#2)
- ✅ Real-World Scenarios
- ❌ Temporal Sequences
- ❌ High-Frequency
- ❌ Game Testing

**Usage Strategy**:
- Test core validation on real websites
- Validate score extraction
- Test issue detection
- Compare providers

### 8. Ablation Test Dataset (ablation-test-dataset.json)
**Status**: Available
**Annotations**: Known good/bad features, expected scores
**Capabilities to Test**:
- ✅ Semantic Screenshot Validation (#1)
- ✅ Score Extraction (#3)
- ✅ Issue Detection (#4)
- ✅ Known Good/Bad Validation
- ❌ Temporal Sequences
- ❌ High-Frequency
- ❌ Game Testing

**Usage Strategy**:
- Test core validation
- Validate known good/bad detection
- Test score accuracy

## Missing Datasets (Research-Based from arXiv)

### 1. ScreenAI Dataset ⭐ FOUND
**Source**: arXiv:2402.04615v3 (Google Research)
**Type**: Visual UI understanding
**Size**: Multiple datasets (screen annotation, QA, navigation, summarization)
**Annotations**: 
- Screen annotation (layout understanding) - NEW dataset
- ScreenQA Short and Complex ScreenQA - NEW datasets
- UI element type and location
- Question-answering pairs
- UI navigation tasks
**Capabilities to Test**:
- ✅ Semantic Screenshot Validation (#1)
- ✅ Layout Understanding
- ✅ Question Answering over screenshots
- ✅ UI Element Relationships
- ✅ Multi-Modal Understanding (#13)
- ✅ UI Navigation (#19)

**Priority**: HIGH - State-of-the-art benchmark, new datasets released
**Download**: Paper mentions datasets released, check Google Research or HuggingFace
**Paper**: https://arxiv.org/pdf/2402.04615v3

### 2. MultiUI Dataset ⭐ FOUND
**Source**: arXiv:2410.13824v3
**Type**: Text-rich visual understanding from web UIs
**Size**: 7.3 million samples from 1 million websites
**Annotations**:
- Screenshots + accessibility trees
- Multimodal tasks (Q&A, UI descriptions, planning)
- Diverse UI layouts
**Capabilities to Test**:
- ✅ Semantic Screenshot Validation (#1)
- ✅ Multi-Modal Validation (#13) - screenshot + accessibility tree
- ✅ Cross-Modal Consistency (#14)
- ✅ Accessibility Tree Validation (#25)
- ✅ Text-Rich Visual Understanding
- ✅ UI Understanding at scale

**Priority**: HIGH - Massive scale, multi-modal
**Download**: Check paper repository
**Paper**: https://arxiv.org/pdf/2410.13824v3

### 3. Ferret-UI Dataset ⭐ FOUND
**Source**: arXiv:2404.05719v1
**Type**: Mobile UI understanding
**Size**: Extensive training samples (elementary + advanced tasks)
**Annotations**:
- Icon recognition
- Find text
- Widget listing
- Detailed descriptions
- Perception/interaction conversations
- Function inference
- Region annotations for referring/grounding
**Capabilities to Test**:
- ✅ Mobile UI Understanding
- ✅ Element Detection (icons, widgets, text)
- ✅ Referring and Grounding
- ✅ Function Inference
- ✅ Interaction Understanding
- ✅ Advanced Reasoning

**Priority**: HIGH - Mobile UI focus, comprehensive tasks
**Download**: Check paper repository
**Paper**: https://arxiv.org/pdf/2404.05719v1

### 4. GUIOdyssey Dataset ⭐ FOUND
**Source**: arXiv:2406.08451v2
**Type**: Cross-app mobile GUI navigation
**Size**: 8,334 episodes, 15.3 steps/episode average
**Annotations**:
- Cross-app navigation tasks
- Semantic reasoning annotations
- 6 mobile devices, 212 apps, 1,357 app combinations
- Historical information (actions, screenshots, context)
**Capabilities to Test**:
- ✅ Cross-App Navigation (#19)
- ✅ Temporal Sequences (#9) - multi-step navigation
- ✅ Game Testing (#19) - navigation as gameplay
- ✅ State Extraction (#21) - app state tracking
- ✅ Long-Step Sequences
- ✅ Mobile UI Understanding

**Priority**: HIGH - Cross-app navigation, temporal sequences
**Download**: Check paper repository
**Paper**: https://arxiv.org/pdf/2406.08451v2

### 5. ILuvUI Dataset ⭐ FOUND
**Source**: arXiv:2310.04869v1
**Type**: UI understanding from machine conversations
**Size**: 335K conversational examples
**Annotations**:
- Q&A pairs
- UI descriptions
- Planning tasks
- Generated from accessibility trees (no human annotations needed)
**Capabilities to Test**:
- ✅ Semantic Screenshot Validation (#1)
- ✅ Question Answering
- ✅ UI Description
- ✅ Planning Tasks
- ✅ Accessibility Tree Integration (#25)

**Priority**: MEDIUM - Large scale, conversational format
**Download**: Check paper repository
**Paper**: https://arxiv.org/pdf/2310.04869v1

### 6. A11YN Dataset ⭐ FOUND
**Source**: arXiv:2510.13914v1
**Type**: Accessibility-focused UI generation
**Size**: 
- UIReq-6.8K: 6,800 diverse web UI generation instructions
- RealUIReq-300: 300 real-world web UI requests
**Annotations**:
- WCAG compliance annotations
- Accessibility violation severity
- Real-world web UI requests
**Capabilities to Test**:
- ✅ WCAG Compliance (#24)
- ✅ Accessibility Validation (#23)
- ✅ Issue Detection (#4) - WCAG violations
- ✅ Real-World Scenarios
- ✅ Severity Assessment

**Priority**: HIGH - Accessibility focus, real-world requests
**Download**: Check paper repository
**Paper**: https://arxiv.org/pdf/2510.13914v1

### 7. AutomotiveUI-Bench-4K ⭐ FOUND
**Source**: arXiv:2505.05895v3
**Type**: Automotive UI understanding
**Size**: 998 images, 4,208 annotations
**Annotations**:
- Visual grounding
- UI element detection
- Reasoning annotations
**Capabilities to Test**:
- ✅ Visual Grounding
- ✅ Element Detection
- ✅ Reasoning Capabilities
- ✅ Cross-Domain Generalization
- ✅ Specialized Domain (automotive)

**Priority**: MEDIUM - Specialized domain, good for generalization testing
**Download**: Available on HuggingFace (mentioned in paper)
**Paper**: https://arxiv.org/pdf/2505.05895v3

### 8. VisionDroid Bug Dataset
**Source**: Research paper (arXiv:2407.03037) - Need to verify exact paper
**Type**: Mobile app bug tracking
**Size**: 200+ curated bugs (expandable)
**Annotations**:
- Bug descriptions
- Bug screenshots
- Natural language reproduction paths
- Functional bug detection
**Capabilities to Test**:
- ✅ Issue Detection (#4)
- ✅ Functional Bug Detection
- ✅ Real-World Error Scenarios
- ✅ Mobile UI Understanding
- ✅ Bug Reproduction Paths

**Priority**: HIGH - Real-world functional testing
**Download**: Check paper repository
**Note**: Need to verify exact arXiv paper ID

### 3. RICO Dataset
**Source**: CHI 2017
**Type**: Mobile UI diversity
**Size**: 66,000+ Android app screens
**Annotations**:
- UI hierarchies
- Interaction traces
- Screenshots
**Capabilities to Test**:
- ✅ Mobile UI Understanding
- ✅ UI Hierarchy Understanding
- ✅ Interaction Understanding
- ✅ Diversity Testing

**Priority**: MEDIUM - Academic benchmark
**Download**: https://interactionmining.org/rico

### 4. High-Frequency Gameplay Dataset (MISSING)
**Type**: 60Hz gameplay sequences
**Size**: Need 1000+ frames at 60Hz
**Annotations**:
- 60Hz frame sequences
- Game state per frame
- Temporal decision points
- Activity patterns
**Capabilities to Test**:
- ✅ High-Frequency Validation (#5-8)
- ✅ Temporal Decision Making (#5)
- ✅ Latency-Aware Batching (#6)
- ✅ Activity-Based Preprocessing (#7)
- ✅ Model Tier Selection (#8)
- ✅ 60Hz Performance

**Priority**: CRITICAL - Core use case
**Action**: Need to create or find

### 5. Game Testing Dataset (MISSING)
**Type**: Game screenshots with state
**Size**: Need 100+ game scenarios
**Annotations**:
- Game screenshots
- Game state (score, level, position)
- Variable goals
- Temporal sequences
**Capabilities to Test**:
- ✅ Game Playing (#19)
- ✅ Variable Goals (#20)
- ✅ State Extraction (#21)
- ✅ Game Goal Prompts (#22)
- ✅ Temporal Sequences (#9)

**Priority**: HIGH - Core use case
**Action**: Need to create or find

### 6. Persona Diversity Dataset (MISSING)
**Type**: Same UI from multiple perspectives
**Size**: Need 50+ UIs with 3+ personas each
**Annotations**:
- Same screenshot
- Multiple persona evaluations
- Persona consistency metrics
**Capabilities to Test**:
- ✅ Persona-Based Testing (#16)
- ✅ Experience Tracing (#17)
- ✅ Persona Consistency
- ✅ Persona Diversity

**Priority**: MEDIUM - Advanced feature
**Action**: Need to create

### 7. Ensemble Comparison Dataset (MISSING)
**Type**: Screenshots with multi-provider results
**Size**: Need 100+ screenshots
**Annotations**:
- Same screenshot
- Results from multiple providers
- Consensus metrics
**Capabilities to Test**:
- ✅ Ensemble Judging (#26)
- ✅ Multi-Provider Support (#2)
- ✅ Consensus Validation
- ✅ Provider Comparison

**Priority**: MEDIUM - Advanced feature
**Action**: Need to create

## Capability Coverage Matrix

| Capability | WebUI | WCAG | Temporal | Screenshot | Calibration | Specs | Real | Ablation | ScreenAI | VisionDroid | RICO | 60Hz | Game | Persona | Ensemble |
|------------|-------|------|----------|------------|-------------|-------|------|----------|----------|------------|------|------|------|---------|----------|
| Semantic Validation | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| High-Frequency | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ⚠️ | ❌ | ❌ |
| Temporal Sequences | ⚠️ | ❌ | ✅ | ✅ | ✅ | ⚠️ | ❌ | ❌ | ⚠️ | ⚠️ | ⚠️ | ✅ | ✅ | ⚠️ | ❌ |
| Multi-Modal | ✅ | ⚠️ | ❌ | ❌ | ❌ | ⚠️ | ⚠️ | ❌ | ✅ | ⚠️ | ⚠️ | ❌ | ⚠️ | ⚠️ | ❌ |
| Persona | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Game Testing | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ⚠️ | ✅ | ❌ | ❌ |
| Accessibility | ✅ | ✅ | ❌ | ❌ | ❌ | ⚠️ | ⚠️ | ⚠️ | ✅ | ⚠️ | ⚠️ | ❌ | ❌ | ⚠️ | ⚠️ |
| Ensemble | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

**Legend**:
- ✅ Fully supports
- ⚠️ Partially supports
- ❌ Does not support

## Recommendations

### Immediate Actions
1. **Create 60Hz Gameplay Dataset** - CRITICAL for core use case
2. **Download ScreenAI Dataset** - State-of-the-art benchmark
3. **Download VisionDroid Dataset** - Real-world functional testing
4. **Create Game Testing Dataset** - Core use case

### Medium-Term Actions
5. **Download RICO Dataset** - Academic benchmark
6. **Create Persona Diversity Dataset** - Advanced feature testing
7. **Create Ensemble Comparison Dataset** - Advanced feature testing

### Dataset Usage Strategy
1. **WebUI** - Primary for accessibility and multi-modal
2. **WCAG** - Primary for WCAG compliance
3. **Temporal Graph** - Primary for temporal understanding
4. **60Hz Dataset** - Primary for high-frequency validation
5. **Game Dataset** - Primary for game testing
6. **ScreenAI** - Benchmark comparison
7. **VisionDroid** - Real-world bug detection
8. **RICO** - Mobile UI diversity

## Next Steps

1. Run comprehensive evaluation with current datasets
2. Identify gaps in capability coverage
3. Download/create missing datasets
4. Re-run evaluation with full dataset coverage
5. Generate comprehensive capability coverage report

