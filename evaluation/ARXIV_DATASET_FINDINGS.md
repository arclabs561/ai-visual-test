# arXiv Dataset Research Findings

## Summary

Searched arXiv for recent papers (2023-2025) on vision-language models, visual UI testing, and accessibility evaluation. Found **8 major datasets** relevant to our system capabilities.

## Key Findings

### High-Priority Datasets (Should Download)

1. **ScreenAI** (arXiv:2402.04615v3) - Google Research
   - Multiple new datasets released
   - Screen annotation, ScreenQA, navigation tasks
   - State-of-the-art UI understanding benchmark

2. **MultiUI** (arXiv:2410.13824v3)
   - 7.3M samples from 1M websites
   - Screenshot + accessibility tree pairs
   - Perfect for multi-modal validation

3. **A11YN** (arXiv:2510.13914v1)
   - Accessibility-focused
   - UIReq-6.8K + RealUIReq-300
   - WCAG compliance annotations

4. **GUIOdyssey** (arXiv:2406.08451v2)
   - Cross-app mobile navigation
   - 8,334 episodes with temporal sequences
   - Perfect for temporal and game testing

5. **Ferret-UI** (arXiv:2404.05719v1)
   - Mobile UI understanding
   - Comprehensive task coverage
   - Referring and grounding capabilities

### Medium-Priority Datasets

6. **ILuvUI** (arXiv:2310.04869v1)
   - 335K conversational examples
   - Generated from accessibility trees
   - Good for Q&A and planning tasks

7. **AutomotiveUI-Bench-4K** (arXiv:2505.05895v3)
   - 998 images, 4,208 annotations
   - Available on HuggingFace
   - Good for cross-domain generalization

### Additional Relevant Papers

- **LVLM-eHub** (arXiv:2306.09265v1) - Comprehensive VLM evaluation benchmark
- **WebUI** (arXiv:2301.13280v1) - Already have this!
- **Vision-Based Mobile App GUI Testing Survey** (arXiv:2310.13518v3) - 271 papers, 92 vision-based
- **METAL** (arXiv:2312.06056v1) - Metamorphic testing framework for LLMs

## Dataset Coverage Analysis

### What We're Missing

1. **High-Frequency (60Hz) Gameplay Dataset** - Still missing
   - Need 1000+ frames at 60Hz
   - Game state per frame
   - Temporal decision points

2. **Game Testing Dataset** - Partially covered by GUIOdyssey
   - GUIOdyssey has navigation but not game-specific
   - Need game screenshots with state

3. **Persona Diversity Dataset** - Still missing
   - Same UI from multiple perspectives
   - Need to create

4. **Ensemble Comparison Dataset** - Still missing
   - Same screenshot, multiple providers
   - Need to create

### What We Now Have Access To

1. **ScreenAI** - UI understanding, QA, navigation
2. **MultiUI** - Massive multi-modal dataset
3. **A11YN** - Accessibility-focused
4. **GUIOdyssey** - Temporal sequences, cross-app
5. **Ferret-UI** - Mobile UI, comprehensive tasks
6. **ILuvUI** - Conversational UI understanding
7. **AutomotiveUI-Bench-4K** - Specialized domain

## Recommendations

### Immediate Actions

1. **Download ScreenAI datasets** - State-of-the-art benchmark
2. **Download MultiUI** - Massive scale, multi-modal
3. **Download A11YN** - Accessibility focus
4. **Download GUIOdyssey** - Temporal sequences
5. **Download Ferret-UI** - Mobile UI comprehensive

### Integration Strategy

1. **ScreenAI** → Test UI understanding, QA, navigation
2. **MultiUI** → Test multi-modal validation, accessibility tree
3. **A11YN** → Test WCAG compliance, accessibility validation
4. **GUIOdyssey** → Test temporal sequences, cross-app navigation
5. **Ferret-UI** → Test mobile UI, element detection, grounding

### Still Need to Create

1. **60Hz Gameplay Dataset** - CRITICAL for core use case
2. **Persona Diversity Dataset** - Advanced feature
3. **Ensemble Comparison Dataset** - Advanced feature

## Next Steps

1. Download identified datasets
2. Integrate into evaluation suite
3. Map to capabilities
4. Run comprehensive evaluation
5. Create missing datasets (60Hz, persona, ensemble)


