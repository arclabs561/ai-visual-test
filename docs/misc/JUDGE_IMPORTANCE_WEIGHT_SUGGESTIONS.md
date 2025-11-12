# Judge Importance, Weight, Annoyance, Suggestions, and Evidence

## Overview

The judge (VLLM) evaluates screenshots and provides structured feedback including:
- **Importance levels** for issues (critical, high, medium, low)
- **Annoyance levels** for issues (very-high, high, medium, low)
- **Impact assessment** (blocks-use, degrades-experience, minor-inconvenience, cosmetic)
- **Specific suggestions** with priority and expected impact
- **Evidence** supporting judgments (visual, functional, accessibility)

## How the Judge Determines Importance/Weight/Annoyance

### 1. **Importance** (Criticality)

The judge determines importance based on:
- **Functional impact**: Does this issue prevent the user from completing their goal?
- **Accessibility impact**: Does this issue prevent accessibility (WCAG violations)?
- **Usability impact**: Does this issue significantly degrade the user experience?
- **Frequency**: How often does this issue occur?

**Levels:**
- **critical**: Blocks core functionality, prevents accessibility, violates zero-tolerance rules
- **high**: Significantly degrades experience, major usability issues
- **medium**: Noticeable issues that affect some users
- **low**: Minor issues, cosmetic problems

### 2. **Annoyance** (User Frustration)

The judge determines annoyance based on:
- **User frustration**: How frustrating would this be to a real user?
- **Frequency of encounter**: How often would users encounter this?
- **Recovery difficulty**: How hard is it to recover from this issue?
- **Expectation violation**: Does this violate user expectations?

**Levels:**
- **very-high**: Extremely frustrating, users would abandon the task
- **high**: Very annoying, significantly impacts satisfaction
- **medium**: Noticeably annoying but manageable
- **low**: Slightly annoying, minor inconvenience

### 3. **Impact** (User Experience Impact)

The judge determines impact based on:
- **blocks-use**: Prevents users from completing their goal
- **degrades-experience**: Significantly worsens the experience
- **minor-inconvenience**: Small annoyance but doesn't prevent use
- **cosmetic**: Visual issue that doesn't affect functionality

## How the Judge Generates Suggestions and Evidence

### 1. **Suggestions**

The judge generates suggestions by:
1. **Identifying root causes**: What is causing the issue?
2. **Proposing concrete fixes**: Specific, actionable improvements
3. **Prioritizing**: Which fixes would have the most impact?
4. **Considering context**: What makes sense given the screenshot and context?

**Format:**
```json
{
  "priority": "high|medium|low",
  "suggestion": "Specific, actionable recommendation",
  "evidence": "What in the screenshot supports this recommendation",
  "expectedImpact": "What improvement this would bring"
}
```

### 2. **Evidence**

The judge provides evidence by:
1. **Visual analysis**: What does the screenshot show?
2. **Functional analysis**: What functionality is affected?
3. **Accessibility analysis**: What accessibility issues are present?
4. **Contextual analysis**: How does this relate to the overall experience?

**Format:**
```json
{
  "visual": "Visual evidence from screenshot (e.g., 'Low contrast text on gray background')",
  "functional": "Functional evidence (e.g., 'Submit button is disabled but no error message')",
  "accessibility": "Accessibility evidence (e.g., 'Color contrast ratio is 2.1:1, below WCAG AA 4.5:1 requirement')"
}
```

## Example Output

```json
{
  "score": 6,
  "assessment": "needs-improvement",
  "issues": [
    {
      "description": "Low contrast text on gray background",
      "importance": "high",
      "annoyance": "high",
      "impact": "degrades-experience",
      "evidence": "Text color #888888 on background #CCCCCC has contrast ratio 2.1:1",
      "suggestion": "Increase text contrast to at least 4.5:1 (WCAG AA) by using darker text (#333333 or darker)"
    },
    {
      "description": "Submit button is disabled with no explanation",
      "importance": "critical",
      "annoyance": "very-high",
      "impact": "blocks-use",
      "evidence": "Submit button has disabled attribute but no error message or explanation visible",
      "suggestion": "Add error message explaining why submit is disabled (e.g., 'Please fill in all required fields')"
    }
  ],
  "reasoning": "Functional design but has critical accessibility and usability issues that prevent some users from completing their goals.",
  "strengths": ["Clear layout", "Intuitive navigation"],
  "recommendations": [
    {
      "priority": "high",
      "suggestion": "Fix contrast ratio to meet WCAG AA standards",
      "evidence": "Current contrast 2.1:1 is below 4.5:1 requirement",
      "expectedImpact": "Improved readability for users with visual impairments"
    },
    {
      "priority": "critical",
      "suggestion": "Add error messages for disabled form elements",
      "evidence": "Submit button disabled without explanation",
      "expectedImpact": "Users can understand why they can't submit and fix the issue"
    }
  ],
  "evidence": {
    "visual": "Low contrast text visible in screenshot, disabled submit button",
    "functional": "Submit button disabled, no error messages visible",
    "accessibility": "Contrast ratio 2.1:1 violates WCAG AA 4.5:1 requirement"
  }
}
```

## Integration with Existing Systems

### 1. **Temporal Aggregation**

Importance and annoyance levels are used in temporal aggregation:
- **High importance** issues are weighted more heavily
- **High annoyance** issues are prioritized in recommendations
- **Critical** issues are flagged immediately

### 2. **Feedback Aggregation**

The `feedback-aggregator.mjs` aggregates:
- Issues by frequency and importance
- Recommendations by priority
- Evidence by type (visual, functional, accessibility)

### 3. **Human Validation**

Human validators can:
- Review judge's importance/annoyance assessments
- Provide their own importance/annoyance ratings
- Compare with judge's assessments for calibration

## Research Foundation

This approach is based on:
- **WCAG Guidelines**: Accessibility importance levels
- **Usability Heuristics**: Nielsen's 10 heuristics for importance
- **User Frustration Research**: Studies on what annoys users most
- **Evidence-Based Design**: Providing concrete evidence for judgments

## Usage

The enhanced rubric is automatically used when:
- `validateScreenshot` is called (default rubric includes importance/annoyance)
- `composePrompt` is called with `includeRubric: true` (default)
- Custom rubrics can be provided but should follow the same structure

The judge automatically extracts:
- Importance/annoyance from structured JSON responses
- Suggestions with priority and evidence
- Evidence from visual, functional, and accessibility analysis

