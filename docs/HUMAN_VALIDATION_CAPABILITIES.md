# Human Validation Capabilities: What We Want and Why

## Core Capabilities Needed

### 1. **Interactive Explanation (Late Interaction)** ⭐ Priority

**What**: Ability to ask the VLLM to explain its judgment after it's been made.

**Why**:
- Humans often don't understand why VLLM scored something a certain way
- Builds trust and transparency
- Helps humans provide better feedback
- Reduces disagreements by clarifying reasoning

**Example**:
```
Human: "Why did you score this 8/10?"
VLLM: "I scored it 8/10 because the design is clean and functional, 
       but I detected contrast issues in the header text (WCAG AA violation) 
       and spacing inconsistencies in the navigation menu."
```

### 2. **Question-Answering About Judgments**

**What**: Ask follow-up questions about specific aspects of the judgment.

**Why**:
- Humans might want to understand specific issues better
- Helps identify if VLLM misunderstood something
- Enables iterative clarification

**Example**:
```
Human: "What specific contrast issue did you find?"
VLLM: "The header text has a contrast ratio of 3.2:1, which is below 
       WCAG AA's minimum requirement of 4.5:1 for normal text."
```

### 3. **Visual Highlighting**

**What**: Show which parts of the screenshot the VLLM focused on.

**Why**:
- Makes it clear what evidence the VLLM used
- Helps humans verify if VLLM looked at the right things
- Reduces misunderstandings

**Implementation**: Could use bounding boxes, heatmaps, or annotated screenshots.

### 4. **Confidence Breakdown**

**What**: Show confidence levels for different aspects (score, issues, reasoning).

**Why**:
- Helps humans understand uncertainty
- Guides which judgments need more human review
- Improves calibration by focusing on uncertain cases

### 5. **Counterfactual Reasoning**

**What**: Ask "what if" questions about the judgment.

**Why**:
- Helps understand VLLM's reasoning process
- Useful for edge cases
- Educational for improving prompts

**Example**:
```
Human: "What if the contrast was fixed?"
VLLM: "If the contrast issue was resolved, I would likely increase 
       the score to 9/10, as that was the primary accessibility concern."
```

### 6. **Disagreement Explanation**

**What**: When human and VLLM disagree, explain the difference.

**Why**:
- Helps identify systematic biases
- Improves calibration
- Educational for both human and system

### 7. **Calibration Explanation**

**What**: Explain why calibration adjusted a score.

**Why**:
- Transparency in how scores are adjusted
- Builds trust in the calibration system
- Helps humans understand the calibration process

## Late Interaction for Explanations

### Why Late Interaction?

**Traditional Flow**:
1. VLLM makes judgment
2. Human reviews judgment
3. Human provides feedback
4. Done

**With Late Interaction**:
1. VLLM makes judgment
2. Human reviews judgment
3. **Human asks questions** ← NEW
4. **VLLM explains** ← NEW
5. Human provides feedback (now better informed)
6. Done

### Benefits

1. **Better Understanding**: Humans understand VLLM reasoning before providing feedback
2. **Reduced Disagreements**: Clarification reduces misunderstandings
3. **Better Calibration**: More informed human feedback improves calibration
4. **Trust Building**: Transparency builds confidence in the system
5. **Educational**: Humans learn what VLLM looks for

### Implementation Approach

**Option A: Interactive CLI**
- After showing judgment, prompt: "Ask a question about this judgment (or press Enter to continue)"
- Use VLLM to answer questions about its own judgment
- Continue until human is satisfied

**Option B: Web UI with Chat**
- Show judgment with a chat interface
- Human can ask questions
- VLLM responds with explanations
- Human provides feedback after understanding

**Option C: Explanation API**
- Store original judgment with ability to query for explanations
- Can be called anytime, not just during review
- Useful for debugging and analysis

## Recommended Priority

1. **Interactive Explanation** (Late Interaction) - Highest priority
2. **Question-Answering** - High priority
3. **Confidence Breakdown** - Medium priority
4. **Visual Highlighting** - Medium priority
5. **Disagreement Explanation** - Lower priority
6. **Counterfactual Reasoning** - Lower priority
7. **Calibration Explanation** - Lower priority

## Technical Considerations

### For Late Interaction:

- Need to store original prompt and context
- Need ability to call VLLM again with explanation requests
- Should cache explanations to avoid redundant API calls
- Should support both synchronous (during review) and asynchronous (later) queries

### For Visual Highlighting:

- Requires VLLM to output bounding boxes or regions
- May need additional API calls or model capabilities
- Could use attention maps if available

### For Confidence Breakdown:

- Requires logprobs or uncertainty estimates
- Some models provide this, others don't
- May need to estimate from model outputs

