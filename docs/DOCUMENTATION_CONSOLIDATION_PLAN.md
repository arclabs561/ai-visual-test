# Documentation Consolidation Plan

## Current State

- **265+ markdown files** across `docs/`, `archive/`, and root
- Many duplicate/overlapping documents
- Unclear which docs are current vs. historical
- Hard to find authoritative information

## Consolidation Strategy

### Keep in `docs/` (Current, Essential)

1. **Getting Started**
   - `GETTING_STARTED.md` ✅ (keep)
   - `README.md` ✅ (keep)

2. **API Documentation**
   - `api/API_ESSENTIALS.md` ✅ (keep)
   - `api/PRIMARY_API.md` ✅ (keep if exists)
   - Remove duplicates

3. **Architecture**
   - `ARCHITECTURE.md` ✅ (new, comprehensive)
   - `CACHE_ARCHITECTURE_DEEP_DIVE.md` → Archive (detailed but redundant)

4. **Features**
   - `features/` directory ✅ (keep organized)
   - Remove duplicate feature docs

5. **Research**
   - `research/HOW_AND_WHY_RESEARCH_WORKS.md` ✅ (keep)
   - `research/` directory ✅ (keep organized)
   - Archive old research analysis docs

### Archive to `archive/docs-consolidation-YYYY-MM-DD/`

1. **Status/Progress Documents** (Historical)
   - `*_COMPLETE.md`
   - `*_STATUS.md`
   - `*_SUMMARY.md`
   - `*_FINAL*.md`
   - `IMPLEMENTATION_*.md`
   - `INTEGRATION_*.md`
   - `SUCCESS_CRITERIA_*.md`

2. **Review Documents** (Historical)
   - `*_REVIEW*.md`
   - `*_CRITIQUE*.md`
   - `*_ANALYSIS*.md`
   - `COMPREHENSIVE_*.md`

3. **Duplicate Content**
   - Multiple versions of same topic
   - Outdated implementation details
   - Superseded by newer docs

### Consolidation Rules

1. **One Source of Truth**: Each topic should have ONE authoritative document
2. **Archive, Don't Delete**: Move to `archive/` with date prefix
3. **Update References**: Update links in remaining docs
4. **Preserve History**: Git history preserves all changes

## Action Plan

### Phase 1: Identify Duplicates

```bash
# Find duplicate content
find docs -name "*.md" -type f | xargs -I {} sh -c 'echo "=== {} ===" && head -20 {}'
```

### Phase 2: Create Archive Structure

```bash
mkdir -p archive/docs-consolidation-$(date +%Y-%m-%d)
```

### Phase 3: Move Historical Docs

Move status/progress/review docs to archive.

### Phase 4: Update Links

Update all references to archived docs.

### Phase 5: Create Index

Create `docs/INDEX.md` listing all current documentation.

## Target Structure

```
docs/
├── README.md                    # Overview
├── GETTING_STARTED.md           # Quick start
├── ARCHITECTURE.md              # System architecture
├── INDEX.md                     # Documentation index
├── api/
│   ├── API_ESSENTIALS.md        # Main API docs
│   └── ...
├── features/
│   └── ...                      # Feature guides
├── research/
│   ├── HOW_AND_WHY_RESEARCH_WORKS.md
│   └── ...
└── usage/
    └── ...                      # Usage examples
```

## Benefits

1. **Easier Navigation**: Clear structure, no duplicates
2. **Current Information**: Only current docs in `docs/`
3. **Preserved History**: All docs archived, not deleted
4. **Better Maintenance**: Less to maintain, clearer ownership

