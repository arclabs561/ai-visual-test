# Dataset Improvement Plan Based on Goals

## Current Dataset Status

**Current samples**: 4 (all good quality, desktop only)
- GitHub Homepage (good accessibility)
- MDN Web Docs (excellent accessibility)
- W3C Homepage (WCAG AAA)
- Example.com (minimal baseline)

**Gaps identified**:
1. ❌ No bad examples (sites with known issues)
2. ❌ No mobile views (all desktop 1280x720)
3. ❌ No design principle examples (brutalist, minimal)
4. ❌ No dynamic content examples (feeds, timestamps)
5. ❌ No form/state validation examples
6. ❌ No error states (404, empty, loading)
7. ❌ No complex layouts
8. ❌ No temporal sequences

## Goals-Based Dataset Requirements

### 1. Semantic Validation (Primary Goal)

**Need**: Good + bad examples to test semantic understanding

**Add**:
- ✅ Bad examples: Low contrast sites, poor keyboard navigation, outdated patterns
- ✅ Good examples: Already have (GitHub, MDN, W3C)

**Samples to add**:
- Craigslist (outdated design, basic accessibility)
- Low contrast example page
- Site with poor keyboard navigation

### 2. Dynamic Content Handling

**Need**: Sites with feeds, timestamps, user data

**Add**:
- Hacker News (dynamic feed with timestamps)
- Reddit (real-time updates, user data)
- Twitter/X (feed-based, dynamic content)

### 3. Design Principle Validation

**Need**: Examples of different design styles

**Add**:
- Brutalist design example (high contrast requirement: 21:1)
- Minimal design example
- Complex layout example

### 4. Mobile Views

**Need**: Test responsive design and mobile accessibility

**Add**:
- GitHub mobile (375x667)
- MDN mobile (375x667)
- Other sites on mobile viewport

### 5. State Validation

**Need**: Forms, games, interactive elements

**Add**:
- GitHub signup form (form validation)
- Game state example (if available)
- Interactive UI example

### 6. Error States

**Need**: 404 pages, empty states, loading states

**Add**:
- GitHub 404 page
- Empty state example
- Loading state example

### 7. Complex Layouts

**Need**: Sites with navigation, sidebars, complex structure

**Add**:
- Wikipedia article (complex layout)
- Documentation site with navigation
- Dashboard with multiple sections

## Proposed New Samples

### Bad Examples (Known Issues)
1. **Craigslist** - Outdated design, basic accessibility
2. **Low contrast example** - WCAG test page with contrast issues

### Mobile Views
3. **GitHub mobile** - 375x667 viewport
4. **MDN mobile** - 375x667 viewport

### Design Principles
5. **Brutalist design** - brutalistwebsites.com
6. **Minimal design** - minimal.gallery

### Dynamic Content
7. **Hacker News** - Dynamic feed with timestamps
8. **Reddit** - Real-time updates, user data

### Form/State
9. **GitHub signup** - Form validation example

### Error States
10. **GitHub 404** - Error state page

### Complex Layouts
11. **Wikipedia article** - Complex layout with navigation, sidebars

## Implementation

Use `scripts/improve-dataset.mjs` to:
1. Capture screenshots from new URLs
2. Add ground truth annotations
3. Categorize samples
4. Update dataset JSON

## Validation

After adding samples, validate:
1. ✅ All categories covered
2. ✅ Good + bad examples balanced
3. ✅ Mobile + desktop views
4. ✅ Diverse use cases
5. ✅ Ground truth annotations complete

## Next Steps

1. Run `node scripts/improve-dataset.mjs` (requires Playwright)
2. Review captured screenshots
3. Add human annotations for new samples
4. Update evaluation scripts to use new samples
5. Test validation accuracy on new samples

