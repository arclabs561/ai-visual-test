# Attention, Evidence, Late Interaction, and Citations in VLLM vs LLM

## Overview

This document explains how attention mechanisms, evidence grounding, late interaction, and citations work differently in Vision-Language Models (VLLMs) versus text-only LLMs, and how these features vary across providers (Gemini, OpenAI, Claude).

## Key Differences: VLLM vs LLM

### 1. Attention Mechanisms

#### Text-Only LLMs
- **Self-attention**: Attention over token sequences
- **Cross-attention**: Attention between different text segments
- **Logprobs**: Token-level probability distributions available
- **Attention maps**: Can visualize which tokens attend to which

#### Vision-Language Models (VLLMs)
- **Multi-modal attention**: Attention across both visual patches and text tokens
- **Visual attention**: Attention over image regions/patches
- **Cross-modal attention**: Attention between visual and textual features
- **Spatial attention**: Attention over spatial regions in images
- **Logprobs**: Often **not available** for vision models (API limitation)

**Current Implementation**:
- `src/multi-modal-fusion.mjs`: Heuristic-based attention weighting for modalities
- `src/temporal-decision.mjs`: Attention-based weighting for temporal notes
- **Limitation**: No direct access to model attention weights (API limitation)

### 2. Evidence Grounding

#### Text-Only LLMs
- **Evidence**: Text passages, citations, references
- **Grounding**: Can cite specific text spans
- **Verification**: Can check if claims match source text
- **Examples**: RAG systems, citation-based QA

#### Vision-Language Models (VLLMs)
- **Evidence**: Image regions, visual features, spatial locations
- **Grounding**: Can reference image regions (bounding boxes, coordinates)
- **Verification**: Cross-modal consistency checking (visual vs. structural)
- **Challenges**: 
  - Hallucination is more common (arXiv papers on VLLM hallucination)
  - Visual evidence harder to verify than text
  - Spatial grounding requires coordinate systems

**Current Implementation**:
- `src/cross-modal-consistency.mjs`: Checks consistency between screenshot and HTML/CSS
- `src/hallucination-detector.mjs`: Detects unfaithful outputs
- **Research**: "Cross-Modal Consistency in Multimodal Large Language Models", "Hallucination Detection in Vision-Language Models"

### 3. Late Interaction

#### Concept
**Late interaction** refers to the ability to query a model's reasoning after it has made a judgment, enabling:
- Explanation of decisions
- Answering follow-up questions
- Counterfactual reasoning ("What if X changed?")
- Confidence breakdown

#### Text-Only LLMs
- **Logprobs available**: Can analyze uncertainty at token level
- **Token-level explanations**: Can explain why specific tokens were chosen
- **Confidence estimation**: From logprobs → uncertainty scores

#### Vision-Language Models (VLLMs)
- **Logprobs often unavailable**: Most VLLM APIs don't provide logprobs
- **Visual explanations**: Can explain which image regions influenced decisions
- **Spatial reasoning**: Can reference specific visual elements
- **Challenges**: Harder to quantify uncertainty without logprobs

**Current Implementation**:
- `src/explanation-manager.mjs`: Manages explanations and late interaction
- `src/human-validation-manager.mjs`: Supports question-answering about judgments
- `docs/HUMAN_VALIDATION_CAPABILITIES.md`: Documents late interaction features

### 4. Citations

#### Text-Only LLMs
- **Text citations**: Can cite specific passages, line numbers, documents
- **Structured citations**: Can format as [1], [2], etc.
- **Source attribution**: Can link claims to sources

#### Vision-Language Models (VLLMs)
- **Visual citations**: Can reference image regions (e.g., "the button in the top-right")
- **Spatial citations**: Can use coordinates or bounding boxes
- **Multi-modal citations**: Can cite both visual and textual evidence
- **Challenges**: 
  - No standard citation format for visual regions
  - Spatial references are less precise than text line numbers
  - Cross-modal citations require both visual and text evidence

**Current Implementation**:
- Citations are implicit in reasoning/assessment fields
- No explicit citation format yet (future enhancement)

## Provider-Specific Capabilities

### Gemini (Google)

#### Logprobs
- **Status**: ✅ Available for text-only models
- **VLLM**: ❌ Not available for vision models (gemini-2.5-pro, gemini-2.0-flash)
- **Access**: `apiData.candidates?.[0]?.content?.parts?.[0]?.logprobs`

#### Attention
- **Status**: ❌ Not exposed via API
- **Workaround**: Use heuristic attention weighting (current implementation)

#### Evidence/Citations
- **Status**: ⚠️ Implicit in responses
- **Visual grounding**: Can reference image regions in natural language
- **No structured citations**: No bounding box coordinates or explicit citations

#### Late Interaction
- **Status**: ✅ Supported (via follow-up API calls)
- **Implementation**: `explanation-manager.mjs` can query Gemini for explanations

### OpenAI (GPT-4o, GPT-5)

#### Logprobs
- **Status**: ⚠️ Conditional
  - ✅ Available for text-only models (gpt-4, gpt-3.5-turbo)
  - ❌ **Not available for vision models** (gpt-4o, gpt-4-vision-preview)
  - **Error**: "You are not allowed to request logprobs from this model"
- **Fix Applied**: Removed `logprobs: true` from OpenAI API calls (see `src/judge.mjs:713`)

#### Attention
- **Status**: ❌ Not exposed via API
- **Workaround**: Use heuristic attention weighting

#### Evidence/Citations
- **Status**: ⚠️ Implicit in responses
- **Visual grounding**: Can reference image regions
- **No structured citations**: No explicit citation format

#### Late Interaction
- **Status**: ✅ Supported
- **Implementation**: Can query for explanations

### Claude (Anthropic)

#### Logprobs
- **Status**: ❌ Not available
- **Note**: Claude API doesn't provide logprobs in standard API
- **Code**: `src/judge.mjs:199` sets `logprobs = null` for Claude

#### Attention
- **Status**: ❌ Not exposed via API

#### Evidence/Citations
- **Status**: ⚠️ Implicit in responses
- **Visual grounding**: Can reference image regions
- **No structured citations**: No explicit citation format

#### Late Interaction
- **Status**: ✅ Supported
- **Implementation**: Can query for explanations

## Current Implementation Status

### ✅ Implemented

1. **Heuristic Attention Weighting**
   - `src/multi-modal-fusion.mjs`: Modality-based attention weights
   - `src/temporal-decision.mjs`: Temporal attention weights
   - Based on prompt content and context

2. **Uncertainty Estimation**
   - `src/uncertainty-reducer.mjs`: Estimates uncertainty from logprobs (when available)
   - Falls back to heuristic estimation when logprobs unavailable
   - Works across all providers (with fallback)

3. **Cross-Modal Consistency**
   - `src/cross-modal-consistency.mjs`: Validates visual vs. structural consistency
   - Detects mismatches between screenshot and HTML/CSS

4. **Late Interaction**
   - `src/explanation-manager.mjs`: Manages explanations
   - `src/human-validation-manager.mjs`: Supports Q&A about judgments
   - Works with all providers

5. **Evidence Grounding**
   - Implicit in reasoning/assessment fields
   - Cross-modal consistency checking
   - Hallucination detection

### ⚠️ Limitations

1. **No Direct Attention Access**
   - APIs don't expose attention weights
   - Using heuristic weighting as workaround
   - **Research gap**: Would benefit from learned cross-attention mechanisms

2. **Logprobs Unavailable for VLLMs**
   - Gemini: Not available for vision models
   - OpenAI: Not available for vision models (error if requested)
   - Claude: Not available at all
   - **Impact**: Uncertainty estimation must use fallback methods

3. **No Structured Citations**
   - Citations are implicit in text responses
   - No bounding box coordinates or explicit citation format
   - **Future enhancement**: Add structured citation format

4. **Limited Visual Grounding**
   - Can reference regions in natural language
   - No precise coordinate system
   - **Research opportunity**: Implement spatial grounding with coordinates

## Research-Backed Approaches

### Attention Mechanisms
- **Research**: "Attention-Based Multimodal Fusion" (various papers)
- **Finding**: Cross-attention enables selective information integration
- **Current**: Heuristic weighting (research-backed but not learned)
- **Future**: Learned cross-attention mechanisms

### Evidence Grounding
- **Research**: "Cross-Modal Consistency in Multimodal Large Language Models"
- **Finding**: Consistency is a major challenge, entity verification is critical
- **Current**: Heuristic consistency checking
- **Future**: VLLM-based verification (as in LVLM4CEC)

### Uncertainty Estimation
- **Research**: Multiple papers on uncertainty in LLMs
- **Finding**: Logprobs provide best uncertainty estimates
- **Current**: Logprobs when available, fallback heuristics otherwise
- **Future**: Better fallback methods when logprobs unavailable

### Late Interaction
- **Research**: Human-in-the-loop evaluation, explanation generation
- **Finding**: Explanations improve trust and calibration
- **Current**: Question-answering about judgments
- **Future**: More structured explanation formats

## Recommendations

### Short-Term (Current Implementation)
1. ✅ **Keep heuristic attention weighting** - Works across all providers
2. ✅ **Use logprobs when available** - Best uncertainty estimation
3. ✅ **Fallback uncertainty estimation** - When logprobs unavailable
4. ✅ **Cross-modal consistency checking** - Detects hallucinations

### Medium-Term (Future Enhancements)
1. **Structured Citations**: Add explicit citation format for visual regions
2. **Spatial Grounding**: Add coordinate-based visual references
3. **Better Uncertainty Fallbacks**: Improve heuristics when logprobs unavailable
4. **Attention Visualization**: Visualize heuristic attention weights

### Long-Term (Research Integration)
1. **Learned Cross-Attention**: Replace heuristics with learned mechanisms
2. **VLLM-Based Verification**: Use VLLMs for cross-modal consistency (as in LVLM4CEC)
3. **Attention Extraction**: If APIs add attention access, integrate it
4. **Citation Standards**: Develop standard format for visual citations

## Code References

### Attention Implementation
- `src/multi-modal-fusion.mjs`: Modality attention weights
- `src/temporal-decision.mjs`: Temporal attention weights
- `src/temporal-constants.mjs`: Attention multipliers

### Evidence/Consistency
- `src/cross-modal-consistency.mjs`: Cross-modal consistency checking
- `src/hallucination-detector.mjs`: Hallucination detection

### Uncertainty/Logprobs
- `src/judge.mjs`: Logprob extraction (lines 145-206)
- `src/uncertainty-reducer.mjs`: Uncertainty estimation from logprobs
- `src/judge.mjs:713`: OpenAI logprobs removed (not supported for vision models)

### Late Interaction
- `src/explanation-manager.mjs`: Explanation management
- `src/human-validation-manager.mjs`: Q&A about judgments
- `docs/HUMAN_VALIDATION_CAPABILITIES.md`: Late interaction documentation

## Summary

| Feature | LLM (Text) | VLLM (Vision) | Gemini | OpenAI | Claude |
|---------|------------|---------------|--------|--------|--------|
| **Logprobs** | ✅ Available | ❌ Limited | ✅ Text only | ⚠️ Text only | ❌ None |
| **Attention** | ✅ Internal | ✅ Internal | ❌ Not exposed | ❌ Not exposed | ❌ Not exposed |
| **Evidence** | ✅ Text citations | ⚠️ Visual refs | ⚠️ Implicit | ⚠️ Implicit | ⚠️ Implicit |
| **Citations** | ✅ Structured | ⚠️ Natural lang | ⚠️ Implicit | ⚠️ Implicit | ⚠️ Implicit |
| **Late Interaction** | ✅ Supported | ✅ Supported | ✅ Yes | ✅ Yes | ✅ Yes |

**Key Takeaway**: VLLMs have more limited access to internal mechanisms (logprobs, attention) compared to text-only LLMs, but support richer evidence types (visual regions, spatial references). Our implementation uses heuristic workarounds and fallbacks to provide consistent functionality across all providers.

