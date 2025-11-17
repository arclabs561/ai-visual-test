# Repository Cleanup Plan

**Date:** 2025-01-17  
**Scope:** npm package + GitHub repository cleanup

## Issues Identified

### 1. Temporary/Status Markdown Files in Root
Many temporary documentation files that should be archived:
- `ANALYSIS_REPORT.md`
- `COMMIT_PLAN.md`
- `COMPREHENSIVE_REVIEW.md`
- `COMPREHENSIVE_VALIDATION_REPORT.md`
- `E2E_VERIFICATION_REPORT.md`
- `FINAL_VALIDATION_REPORT.md`
- `HOOKWISE_USAGE_REVIEW.md`
- `OBFUSCATION_AND_CLEANUP_COMPLETE.md`
- `OBFUSCATION_VERSION_SUMMARY.md`
- `PUBLISH_CHECKLIST.md`
- `PUBLISH_REVIEW.md`
- `RELEASE_v0.5.3.md`
- `UPDATE_DEPRECATION_GUIDE.md`
- `VALIDATION_ISSUES.md`
- `WORK_COMPLETED.md`
- `SECURITY_REVIEW_FIXES.md`

### 2. Security Reports (Some May Be Keepers)
- `SECURITY_ADVANCED_ANALYSIS.md` - Historical reference?
- `SECURITY_AUDIT_REPORT.md` - Historical reference?
- `SECURITY_DEEP_DIVE_REPORT.md` - Historical reference?
- `SECURITY_FIXES_COMPLETE.md` - Historical reference?
- `SECURITY_FIXES.md` - Historical reference?
- `SECURITY_LOCKDOWN_COMPLETE.md` - Historical reference?
- `SECURITY_RED_TEAM_REPORT_2025.md` - Historical reference?
- `SECURITY_ROTATION_CHECKLIST.md` - Active checklist?

### 3. Temporary Files Not in .gitignore
- `test.png` - Test file (should be ignored)
- `testcases.json` - Test data (should be ignored)
- `test-results-full.log` - Log file (should be ignored)
- `temp-gameplay/` - Temporary directory (should be ignored)

### 4. npm Package Perspective
- ✅ Already cleaned: `vercel.json`, `api/`, `public/` removed
- ✅ Files array is clean
- ✅ .npmignore properly excludes development files

## Recommended Actions

### High Priority (Do Now)

1. **Archive Temporary Documentation**
   - Move status/completion/report files to `archive/status-docs-2025-01-17/`
   - Keep only essential docs in root

2. **Update .gitignore**
   - Add `test.png`
   - Add `testcases.json`
   - Add `test-results-full.log`
   - Add `temp-gameplay/`

3. **Review Security Docs**
   - Keep `SECURITY.md` (essential)
   - Archive historical security reports to `archive/security-reports/`
   - Keep `SECURITY_ROTATION_CHECKLIST.md` if actively used

### Medium Priority (Consider)

1. **Consolidate Security Documentation**
   - Multiple security reports could be consolidated
   - Or archived if historical

2. **Review Release Notes**
   - `RELEASE_v0.5.3.md` - Should be in CHANGELOG or archived

3. **Check for Redundant Scripts**
   - Some scripts might be obsolete
   - Review `scripts/` directory

## Files to Keep in Root

**Essential (Keep):**
- `README.md`
- `CHANGELOG.md`
- `CONTRIBUTING.md`
- `DEPLOYMENT.md`
- `SECURITY.md`
- `LICENSE`
- `openmemory.md` (project memory)

**Optional (Review):**
- `SECURITY_ROTATION_CHECKLIST.md` - If actively used
- `RELEASE_v0.5.3.md` - If needed for reference

## Archive Structure

```
archive/
  status-docs-2025-01-17/
    - ANALYSIS_REPORT.md
    - COMMIT_PLAN.md
    - COMPREHENSIVE_REVIEW.md
    - ... (all temporary status docs)
  security-reports-2025-01-17/
    - SECURITY_ADVANCED_ANALYSIS.md
    - SECURITY_AUDIT_REPORT.md
    - SECURITY_DEEP_DIVE_REPORT.md
    - SECURITY_FIXES_COMPLETE.md
    - SECURITY_FIXES.md
    - SECURITY_LOCKDOWN_COMPLETE.md
    - SECURITY_RED_TEAM_REPORT_2025.md
    - SECURITY_REVIEW_FIXES.md
```

## .gitignore Updates Needed

```gitignore
# Test files and temporary data
test.png
testcases.json
test-results-full.log
temp-gameplay/
```

## Impact

### Before Cleanup
- ~20+ temporary markdown files in root
- Temporary test files tracked in git
- Cluttered root directory

### After Cleanup
- Clean root with only essential docs
- Temporary files properly ignored
- Better organization
- Easier navigation

## Implementation

1. Create archive directories
2. Move temporary docs to archive
3. Update .gitignore
4. Remove tracked temporary files from git
5. Verify npm package is still clean

