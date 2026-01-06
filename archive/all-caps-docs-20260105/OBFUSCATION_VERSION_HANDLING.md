# Obfuscation and Version Handling

**Date:** 2025-01-17  
**Status:** Documentation for obfuscation strategy across package versions

## Current Situation

### Published Packages

1. **@arclabs561/ai-visual-test** (Current)
   - **Latest Version:** 0.5.1
   - **Status:** Published (NOT obfuscated)
   - **Obfuscation:** Will start with next version (0.5.6+)

2. **ai-browser-test** (Deprecated)
   - **Status:** Deprecated (old package name)
   - **Action:** Already deprecated with migration message
   - **Obfuscation:** N/A (deprecated, no new versions)

## Obfuscation Strategy

### ✅ Future Versions (0.5.6+)
- **All new versions** will be obfuscated before publishing
- Build script automatically obfuscates during CI/CD
- Published from `dist/` directory with obfuscated code

### ⚠️ Prior Published Versions (0.5.1 and earlier)
- **Cannot be retroactively obfuscated**
- Already published with plain text source code
- Users who install old versions will get unobfuscated code
- **Recommendation:** Encourage users to upgrade to latest version

### 📦 Deprecated Package (ai-browser-test)
- **Status:** Deprecated with migration message
- **Obfuscation:** Not applicable (no new versions)
- **Action:** Users should migrate to `@arclabs561/ai-visual-test`

## Impact Assessment

### What's Exposed in Prior Versions

**Version 0.5.1 (Current Published):**
- ✅ All source code in plain text
- ✅ Implementation details visible
- ✅ Algorithms and heuristics exposed
- ✅ Internal architecture visible

**Risk Level:** MEDIUM
- Code is already public (was in public GitHub repo)
- Now GitHub is private, but old npm versions remain
- Users can still install old versions

### Mitigation Strategies

1. **Version Deprecation (Recommended)**
   ```bash
   # Deprecate old unobfuscated versions
   npm deprecate @arclabs561/ai-visual-test@0.5.1 "This version contains unobfuscated source code. Please upgrade to the latest version for improved security."
   ```

2. **Documentation**
   - Update README to recommend latest version
   - Add security notice about obfuscation in CHANGELOG
   - Document that versions < 0.5.6 are not obfuscated

3. **Version Strategy**
   - **Option A:** Keep 0.5.1 as-is, start obfuscation at 0.5.6
   - **Option B:** Deprecate 0.5.1, publish 0.5.6 as obfuscated
   - **Option C:** Publish 0.6.0 as major version with obfuscation

## Recommended Actions

### Immediate (Before Next Publish)

1. **Decide on Version Strategy**
   - [ ] Keep 0.5.x series with obfuscation starting at 0.5.6?
   - [ ] Or bump to 0.6.0 for obfuscation milestone?

2. **Update Documentation**
   - [ ] Add note in README about obfuscation starting at version X
   - [ ] Update CHANGELOG with obfuscation notice
   - [ ] Document security improvements

3. **Consider Deprecating Old Versions**
   - [ ] Deprecate 0.5.1 with security notice?
   - [ ] Or leave as-is for backward compatibility?

### Long-term

1. **Version Management**
   - Monitor usage of old versions
   - Encourage upgrades through deprecation messages
   - Consider security advisories for critical vulnerabilities

2. **Package Cleanup**
   - Keep `ai-browser-test` deprecated (already done)
   - Ensure migration path is clear
   - Update all documentation references

## Commands for Version Management

### Check Current Versions
```bash
# List all versions
npm view @arclabs561/ai-visual-test versions --json

# Check specific version
npm view @arclabs561/ai-visual-test@0.5.1 --json
```

### Deprecate Old Version
```bash
# Deprecate specific version
npm deprecate @arclabs561/ai-visual-test@0.5.1 "Security: This version contains unobfuscated source code. Please upgrade to the latest version."

# Check deprecation status
npm view @arclabs561/ai-visual-test@0.5.1 deprecated
```

### Check Deprecated Package
```bash
# Check ai-browser-test status
npm view ai-browser-test deprecated

# Verify deprecation message
npm view ai-browser-test --json | jq .deprecated
```

## Decision Matrix

| Action | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| **Deprecate 0.5.1** | Encourages upgrades, security notice | May break existing users | ⚠️ Consider if security-critical |
| **Leave 0.5.1 as-is** | Backward compatibility | Old code remains exposed | ✅ Recommended if not security-critical |
| **Bump to 0.6.0** | Clear milestone, major feature | Version jump | ✅ Recommended for obfuscation milestone |
| **Keep 0.5.x** | Incremental updates | Less clear obfuscation start | ⚠️ Acceptable but less clear |

## Conclusion

- **Prior versions (0.5.1):** Cannot be retroactively obfuscated, but impact is limited since code was already public
- **Future versions:** Will be obfuscated automatically via build script
- **Deprecated package:** Already handled, no action needed
- **Recommendation:** Publish next version (0.5.6 or 0.6.0) with obfuscation and document the change

