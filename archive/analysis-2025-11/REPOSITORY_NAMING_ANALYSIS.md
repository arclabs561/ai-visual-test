# Multi-Perspective Repository Naming Analysis: vllm-testing → Recommended Name

## Executive Summary

After comprehensive research from multiple perspectives (npm conventions, GitHub SEO, developer search behavior, market positioning, internal analysis), **`ai-visual-testing`** emerges as the optimal name for the repository currently named `vllm-testing`.

**Current State:**
- Repository: `vllm-testing`
- Description: "Standalone visual testing utilities using Vision Language Models (VLLM) for screenshot validation. General-purpose package for AI-powered visual testing with Playwright."
- Related repo: `ai-browser-test` (chosen after extensive internal analysis)

**Recommended: `ai-visual-testing`**

---

## Research Perspectives Aggregated

### 1. npm Package Naming Conventions (2025)

**Key Findings:**
- All lowercase, hyphenated names are standard
- Descriptive names outperform technical abbreviations for discoverability
- Keywords in package name directly impact npm search ranking
- Scoped packages (`@org/name`) are preferred for organizational packages but add typing overhead

**Evidence:**
- Similar packages use descriptive patterns: `@percy/playwright`, `@argos-ci/playwright`, `chromatic`
- npm search algorithm prioritizes keyword matching in package names
- Technical abbreviations (like "VLLM") require prior knowledge, reducing discoverability

**Verdict:** `ai-visual-testing` aligns with npm best practices; `vllm-testing` requires specialized knowledge.

---

### 2. GitHub Repository SEO & Discoverability

**Key Findings:**
- Repository names, descriptions, and topics all impact Google/GitHub search ranking
- Natural language search terms (e.g., "visual testing") outperform technical acronyms
- About section functions as meta description for search engines
- Topics provide categorical metadata for filtered searches

**Evidence:**
- Developers search for "visual testing playwright" not "VLLM testing"
- GitHub's search algorithm examines repository names, descriptions, and topics
- Well-structured metadata (name + description + topics) maximizes visibility

**Verdict:** `ai-visual-testing` matches common search patterns; `vllm-testing` misses primary search terms.

---

### 3. Developer Search Behavior Patterns

**Key Findings:**
- QA engineers search: "visual testing", "screenshot validation", "visual regression"
- ML engineers search: "VLLM", "vision language models", "AI testing"
- Most discovery happens through Google/GitHub search, not direct npm queries
- Package names that match natural language queries rank higher

**Evidence:**
- npm search uses keyword matching from title, description, readme, keywords
- Search behavior research shows broader audience uses functional terms
- Technical terms appeal to niche audience but limit broader discovery

**Verdict:** `ai-visual-testing` captures broader QA audience; `vllm-testing` targets narrower ML audience.

---

### 4. Market Positioning & Competitive Analysis

**Key Findings:**
- Visual testing market uses brand-first naming (Percy, Chromatic, Applitools)
- Scoped packages with framework suffixes are standard: `@percy/playwright`, `@argos-ci/playwright`
- Functional names work for new entrants before brand recognition
- Technical names signal authority to specialists but reduce accessibility

**Evidence:**
- All major visual testing tools use scoped naming: `@percy/*`, `@argos-ci/*`, `@chromatic-com/*`
- Brand names (Percy, Chromatic) provide recognition but require marketing investment
- Functional names (`ai-visual-testing`) work for tools without established brands

**Verdict:** `ai-visual-testing` follows functional naming pattern appropriate for new/emerging tools.

---

### 5. Internal Repository Analysis (ai-browser-test)

**Key Findings:**
- Extensive internal analysis chose `ai-browser-test` over alternatives
- Analysis considered: `ai-visual-testing`, `semantic-screenshot`, `@visual-ai/validate`
- Final choice prioritized: descriptiveness, SEO, clarity, no org overhead
- Internal docs acknowledge trade-offs between technical accuracy and user-friendliness

**Evidence:**
- `NAME_DEEP_REVIEW.md` analyzed multiple options with scoring
- `NAME_CRITIQUE_FINAL.md` evaluated `ai-browser-test` vs alternatives
- Internal consensus: descriptive names win for discoverability

**Verdict:** Internal analysis supports descriptive naming; `ai-visual-testing` aligns with this philosophy.

---

### 6. Technical Accuracy vs User-Friendliness Trade-off

**Key Findings:**
- Technical names (vllm-testing) signal authority to specialists
- Descriptive names (ai-visual-testing) maximize accessibility
- VLLM is implementation detail; visual testing is user benefit
- Package names should communicate value, not implementation

**Evidence:**
- vLLM project uses technical name because audience is ML engineers
- Visual testing tools use functional/brand names because audience is QA engineers
- Research shows onboarding friction increases with technical abbreviations

**Verdict:** `ai-visual-testing` prioritizes user benefit over implementation detail.

---

### 7. Cognitive Load & Onboarding Analysis

**Key Findings:**
- Technical abbreviations require prior knowledge (VLLM = Vision Language Models)
- Descriptive names are self-explanatory
- Lower cognitive load improves adoption rates
- Documentation can explain technical details; name should communicate purpose

**Evidence:**
- Research on naming conventions emphasizes clarity over technical precision
- Developer experience studies show descriptive names reduce onboarding time
- Package names function as "headlines" - should communicate value immediately

**Verdict:** `ai-visual-testing` reduces cognitive load; `vllm-testing` requires explanation.

---

## Comparative Analysis: Name Options

| Factor | vllm-testing | ai-visual-testing | ai-browser-test |
|--------|--------------|-------------------|-----------------|
| **npm Compliance** | ✅ | ✅ | ✅ |
| **Technical Accuracy** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **User-Friendliness** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Discoverability** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **SEO Alignment** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Market Positioning** | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Cognitive Load** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Keyword Coverage** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Onboarding Speed** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

**Scoring Rationale:**
- `vllm-testing`: Technically accurate but requires VLLM knowledge, misses primary search terms
- `ai-visual-testing`: Optimal balance of clarity, discoverability, and user-friendliness
- `ai-browser-test`: Good but "browser" is less specific than "visual" for this use case

---

## Final Recommendation: `ai-visual-testing`

### Why This Name Wins

1. **Maximum Discoverability**
   - Matches primary search terms: "visual testing", "AI visual testing"
   - Appears in both QA engineer and general developer searches
   - Optimized for npm and GitHub search algorithms

2. **Clear Value Proposition**
   - Immediately communicates: AI-powered + visual + testing
   - No prior knowledge required
   - Self-explanatory to target audience

3. **Market Alignment**
   - Follows functional naming pattern (appropriate for new tools)
   - Aligns with similar packages in ecosystem
   - Leaves room for future branding if desired

4. **Low Cognitive Load**
   - No abbreviations to decode
   - Natural language structure
   - Reduces onboarding friction

5. **Technical Details in Documentation**
   - VLLM can be explained in README, description, keywords
   - Package name communicates user benefit, not implementation
   - Best practice: name = what, docs = how

6. **SEO Optimization**
   - High keyword density in name
   - Natural language matches search queries
   - Optimized for GitHub and Google indexing

### Implementation Strategy

**Repository Rename:**
```bash
gh repo rename arclabs561/vllm-testing --new-name ai-visual-testing
```

**Package.json Updates:**
- Name: `ai-visual-testing` (or `@arclabs561/ai-visual-testing` if scoped)
- Description: Keep VLLM mention: "AI-powered visual testing using Vision Language Models (VLLM) for screenshot validation with Playwright"
- Keywords: `["visual-testing", "ai-testing", "screenshot-validation", "VLLM", "playwright", "visual-regression"]`

**GitHub Repository:**
- Update About section to emphasize "AI-powered visual testing"
- Add topics: `visual-testing`, `ai-testing`, `playwright`, `screenshot-validation`, `vllm`
- Update README to maintain VLLM technical details while leading with user benefits

---

## Alternative Consideration: Scoped Package

If organizational branding is important:
- `@arclabs561/ai-visual-testing`
- Benefits: Namespace management, organizational clarity
- Trade-off: Additional typing, requires npm org

**Recommendation:** Start unscoped (`ai-visual-testing`), can migrate to scoped later if needed.

---

## Conclusion

After aggregating research from npm conventions, GitHub SEO, developer behavior, market positioning, internal analysis, and cognitive load considerations, **`ai-visual-testing`** is the optimal choice. It maximizes discoverability, reduces onboarding friction, aligns with market patterns, and communicates value clearly while allowing technical details (VLLM) to be explained in documentation.

The name `vllm-testing` is technically accurate but sacrifices discoverability and accessibility for a narrow audience. The recommended name balances all factors optimally.

