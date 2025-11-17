# Critique: Wording, Phrasing, Framing, and Design

> **Generated**: Based on 2024 best practices for technical documentation, API design, and research communication
> **Sources**: Perplexity research, Tavily search, industry best practices

## Executive Summary

Our documentation is **strong in accessibility and conversational tone** but has **gaps in structure, progressive disclosure, and feature presentation**. This critique identifies specific issues and provides actionable recommendations.

---

## 1. Documentation Structure Issues

### ❌ Problem: Missing Clear Hierarchy

**Current State**: Our docs jump between concepts without clear progression.

**Best Practice** (from research): Documentation should follow a standard structure:
- Overview → Getting Started → Authentication → Endpoints → Examples → Error Handling → Release Notes

**Our Gaps**:
- `GETTING_STARTED.md` mixes "what it does" with "how to use it" with "research features"
- No clear separation between "quick start" and "deep dive"
- Research features appear too early (before users understand basics)

**Recommendation**:
```markdown
# Getting Started (Restructured)

## What This Package Does (30 seconds)
[Brief explanation]

## Quick Start (2 minutes)
[Install, configure, first validation]

## Common Use Cases (5 minutes)
[Accessibility, design, gameplay]

## Research Features (Optional - 10 minutes)
[Move this section later, after users understand basics]
```

### ❌ Problem: Inconsistent Section Organization

**Current State**: Different docs use different organizational patterns.

**Best Practice**: Use consistent heading hierarchy (H1 → H2 → H3) with semantic meaning.

**Our Gaps**:
- `API_ESSENTIALS.md` uses "The Core Function" (descriptive) vs "Error Handling" (functional)
- `GETTING_STARTED.md` mixes "What This Package Does" (conceptual) with "Quick Start" (actionable)

**Recommendation**: Standardize on functional headings:
- "Installation" (not "Install")
- "Configuration" (not "Set an API Key")
- "Basic Usage" (not "Use It")
- "Advanced Features" (not "Research-Backed Features")

---

## 2. Wording and Phrasing Issues

### ❌ Problem: Overuse of Conversational Tone in Technical Contexts

**Current State**: We use phrases like "That's it" and "You're validating screenshots with AI" which can feel dismissive of complexity.

**Best Practice**: Balance accessibility with respect for complexity. Conversational tone works for getting started, but technical sections need precision.

**Examples**:
- ❌ "**That's it.** You're validating screenshots with AI."
- ✅ "This completes basic setup. You can now validate screenshots using AI-powered semantic analysis."

- ❌ "Everything else is optimization."
- ✅ "Additional features optimize performance, accuracy, and cost."

**Recommendation**: Use conversational tone for:
- Getting started guides
- High-level explanations
- Motivation sections

Use precise language for:
- API documentation
- Technical specifications
- Error messages

### ❌ Problem: Vague Research Claims

**Current State**: We say "98.5% reduction" and "10-20% improvement" without context.

**Best Practice**: Provide context for research claims. When? Under what conditions? Compared to what?

**Examples**:
- ❌ "Reduces LLM calls by 98.5%"
- ✅ "Reduces LLM calls by 98.5% when context is stable (from research: arXiv:2406.12125). In high-frequency scenarios (60Hz), this means calling AI ~1 time per second instead of 60 times per second."

- ❌ "Improves accuracy by 10-20%"
- ✅ "Improves accuracy by 10-20% for critical evaluations when using ensemble judging with 3+ models (from research: arXiv:2510.01499). Best for accessibility and quality checks where accuracy matters more than speed."

**Recommendation**: Always include:
1. The condition ("when...")
2. The baseline ("compared to...")
3. The source ("from research...")
4. When to use it ("best for...")

### ❌ Problem: Jargon Without Definition

**Current State**: We use terms like "semantic validation", "temporal notes", "ensemble judging" without defining them first.

**Best Practice**: Define specialized terms on first use, then use them consistently.

**Examples**:
- ❌ "Use semantic validation to understand UI meaning"
- ✅ "Use semantic validation (understanding what UI elements mean, not just pixel differences) to understand UI meaning"

**Recommendation**: Add a glossary or inline definitions for:
- Semantic validation
- Temporal notes
- Ensemble judging
- Counter-balancing
- Multi-scale aggregation

---

## 3. Framing Issues

### ❌ Problem: Features Presented as "Optional" When They Should Be Default

**Current State**: We say "Optional, but recommended" for features that should be auto-enabled.

**Best Practice** (from API design research): Auto-enable features that:
- Are backward-compatible
- Improve outcomes without changing behavior
- Have minimal performance impact

**Our Gaps**:
- `useTemporalDecision` is optional but should auto-enable for high-frequency scenarios
- `useEnsemble` is optional but should auto-enable for critical evaluations
- Explicit rubrics are "always included" but not clearly presented as default

**Recommendation**: Reframe as:
```markdown
## Smart Defaults

Features are automatically enabled based on context:

- **High-frequency scenarios** (fps > 10): Temporal decision making auto-enabled
- **Critical evaluations** (accessibility, quality): Ensemble judging auto-enabled
- **All evaluations**: Explicit rubrics always included

You can override defaults:
```javascript
{
  useTemporalDecision: false, // Disable for testing
  useEnsemble: false // Disable for speed
}
```
```

### ❌ Problem: Research Features Framed as "Advanced" When They're Core

**Current State**: Research features appear in a separate section, implying they're optional extras.

**Best Practice**: If research features are core to the value proposition, integrate them into main flows, not separate sections.

**Our Gaps**:
- Research features are in "Research-Backed Features (Optional, But Recommended)" section
- This implies they're add-ons, not core functionality

**Recommendation**: Integrate research features into use cases:
```markdown
## Common Use Cases

### 1. Accessibility Testing

```javascript
const result = await validateScreenshot('form.png', 'Evaluate accessibility');
// Uses explicit rubrics (automatic)
// Uses ensemble judging for critical evaluations (automatic)
// Returns structured results with confidence scores
```
```

### ❌ Problem: "What It's Not Good For" Framed Negatively

**Current State**: README has a "What it's not good for" section that feels defensive.

**Best Practice**: Frame limitations positively as "Use Cases" and "When to Use Other Tools".

**Examples**:
- ❌ "What it's not good for: Pixel-perfect layout testing"
- ✅ "For pixel-perfect layout testing, use pixel-diffing tools like Percy or Chromatic. This tool focuses on semantic understanding."

**Recommendation**: Reframe as "When to Use Other Tools" with positive guidance.

---

## 4. Design and Presentation Issues

### ❌ Problem: Code Examples Without Expected Outputs

**Current State**: Code examples show inputs but not expected outputs.

**Best Practice**: Show both request and response, including edge cases and error handling.

**Examples**:
- ❌ Shows `validateScreenshot()` call but not what `result` looks like
- ✅ Shows call + expected result structure + error handling

**Recommendation**: Every code example should include:
1. Input (what you call)
2. Expected output (what you get)
3. Error handling (what can go wrong)

### ❌ Problem: Missing Interactive Elements

**Current State**: Documentation is static text with code blocks.

**Best Practice**: Modern documentation includes interactive elements (API consoles, runnable examples).

**Recommendation**: Consider adding:
- Runnable code examples (if possible)
- API reference with search
- Interactive examples showing request/response

### ❌ Problem: No Clear Entry Points for Different Audiences

**Current State**: All users see the same documentation flow.

**Best Practice**: Provide multiple entry points for different skill levels and use cases.

**Recommendation**: Add clear navigation:
```markdown
## Choose Your Path

- **New to AI testing?** → Start with [Getting Started](./GETTING_STARTED.md)
- **Experienced developer?** → Jump to [API Reference](./api/API_ESSENTIALS.md)
- **Research-focused?** → See [Research Integration](./research/HOW_AND_WHY_RESEARCH_WORKS.md)
- **Specific use case?** → Browse [Use Cases](./features/)
```

---

## 5. API Design and Naming Issues

### ❌ Problem: Inconsistent Naming Conventions

**Current State**: Mix of patterns:
- `validateScreenshot` (verb + noun)
- `testGameplay` (verb + noun)
- `createGameGoal` (verb + noun + noun)
- `aggregateTemporalNotes` (verb + adjective + noun)

**Best Practice**: Use consistent patterns. REST APIs use nouns for resources, but functions can use verb-noun patterns consistently.

**Recommendation**: Standardize on verb-noun pattern:
- ✅ `validateScreenshot`
- ✅ `testGameplay`
- ✅ `createGoal` (not `createGameGoal`)
- ✅ `aggregateNotes` (not `aggregateTemporalNotes` - temporal is context, not part of name)

### ❌ Problem: Optional Features Not Clearly Presented

**Current State**: Optional features are buried in context objects with unclear defaults.

**Best Practice**: Make optional features obvious with clear defaults and documentation.

**Examples**:
- ❌ `{ useTemporalDecision: true }` - What's the default? When should I use this?
- ✅ Document: "Temporal decision making is auto-enabled for high-frequency scenarios (fps > 10). Set `useTemporalDecision: false` to disable."

**Recommendation**: For each optional feature, document:
1. Default behavior
2. When it's auto-enabled
3. When to override
4. Performance implications

---

## 6. Research Communication Issues

### ❌ Problem: Research Papers Cited Without Context

**Current State**: We cite papers (arXiv:2406.12125) but don't explain what they say or why they matter.

**Best Practice**: When citing research, explain:
1. What the paper found
2. Why it matters for users
3. How we implement it
4. What the limitations are

**Examples**:
- ❌ "98.5% reduction (from research: arXiv:2406.12125)"
- ✅ "98.5% reduction in LLM calls when context is stable. This comes from research (arXiv:2406.12125) showing that calling LLMs only when decisions are needed (not on every state change) achieves 6x performance gains. We implement this through `TemporalDecisionManager`, which decides when to prompt based on temporal context and state changes."

**Recommendation**: Every research citation should include:
1. What the research says (briefly)
2. Why it matters (practical impact)
3. How we use it (implementation)
4. Limitations (when it doesn't apply)

### ❌ Problem: Research Features Presented as "Magic"

**Current State**: We say "research-backed" without explaining what that means.

**Best Practice**: Explain the research connection clearly. Users should understand what research says, how we implement it, and why it helps.

**Recommendation**: Replace "research-backed" with specific explanations:
- ❌ "Research-backed features"
- ✅ "Features based on peer-reviewed research that improve accuracy, reduce costs, and optimize performance"

---

## 7. Specific Recommendations by Document

### GETTING_STARTED.md

**Issues**:
1. Research features appear too early (before users understand basics)
2. "That's it" phrasing dismisses complexity
3. Missing clear progression from simple to complex

**Recommendations**:
1. Move research features to end or separate section
2. Replace dismissive phrases with clear completion markers
3. Add "Next Steps" with clear progression

### API_ESSENTIALS.md

**Issues**:
1. Mix of descriptive and functional headings
2. Code examples without expected outputs
3. Missing error handling examples

**Recommendations**:
1. Standardize headings (all functional)
2. Add expected output to every code example
3. Add error handling section with examples

### README.md

**Issues**:
1. "What it's not good for" feels defensive
2. Missing clear value proposition
3. API examples don't show results

**Recommendations**:
1. Reframe limitations positively
2. Add value proposition section
3. Show complete request/response examples

### Research Documentation

**Issues**:
1. Papers cited without explanation
2. Implementation gaps not clearly marked
3. Claims not contextualized

**Recommendations**:
1. Explain what each paper says before citing
2. Clearly mark what's implemented vs. inspired by
3. Always include conditions and baselines for claims

---

## 8. Priority Actions

### High Priority (Do Now)

1. **Restructure GETTING_STARTED.md**
   - Move research features later
   - Add clear progression
   - Replace dismissive phrases

2. **Add Context to Research Claims**
   - Include conditions ("when...")
   - Include baselines ("compared to...")
   - Include sources ("from research...")

3. **Standardize Headings**
   - Use functional headings consistently
   - Follow H1 → H2 → H3 hierarchy

### Medium Priority (Do Soon)

1. **Reframe Optional Features**
   - Document defaults clearly
   - Explain auto-enable conditions
   - Show when to override

2. **Add Expected Outputs to Examples**
   - Show request + response
   - Include error handling
   - Add edge cases

3. **Create Multiple Entry Points**
   - Different paths for different audiences
   - Clear navigation
   - Quick reference sections

### Low Priority (Nice to Have)

1. **Add Interactive Elements**
   - Runnable examples (if possible)
   - API reference with search
   - Interactive tutorials

2. **Create Glossary**
   - Define specialized terms
   - Link from first use
   - Keep updated

3. **Add User Feedback Mechanisms**
   - "Was this helpful?" buttons
   - Issue templates
   - Documentation analytics

---

## 9. Examples of Improved Wording

### Before → After

**Getting Started**:
- ❌ "**That's it.** You're validating screenshots with AI."
- ✅ "**Setup complete.** You can now validate screenshots using AI-powered semantic analysis."

**Research Features**:
- ❌ "Reduces LLM calls by 98.5% (from research: arXiv:2406.12125)"
- ✅ "Reduces LLM calls by 98.5% when context is stable. Based on research (arXiv:2406.12125) showing that calling LLMs only when decisions are needed achieves 6x performance gains. Automatically enabled for high-frequency scenarios (fps > 10)."

**API Documentation**:
- ❌ "Everything in this package starts with one function: `validateScreenshot()`."
- ✅ "The core API is `validateScreenshot()`, which takes a screenshot path and evaluation prompt, and returns structured validation results."

**Feature Presentation**:
- ❌ "Optional, but recommended"
- ✅ "Automatically enabled for [condition]. Set `[flag]: false` to disable."

---

## 10. Conclusion

Our documentation is **strong in accessibility and conversational tone** but needs **structural improvements, clearer research communication, and better feature presentation**. The recommendations above provide a roadmap for improvement.

**Key Principles**:
1. **Progressive disclosure**: Simple first, complex later
2. **Context for claims**: Always include conditions and baselines
3. **Clear defaults**: Document when features auto-enable
4. **Complete examples**: Show input, output, and error handling
5. **Multiple entry points**: Different paths for different audiences

**Next Steps**: Prioritize high-priority items, then iterate based on user feedback.


