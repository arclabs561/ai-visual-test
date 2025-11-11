# Git History Cleanup Plan

## Current State

- 79 commits total
- Many commits are documentation/research related (now archived)
- Some commits could be squashed together

## Recommended Approach

### Option 1: Interactive Rebase (Recommended)

Squash related commits together:

```bash
# Interactive rebase from initial commit
git rebase -i --root

# Or rebase last 30 commits
git rebase -i HEAD~30
```

**Commits to squash:**
- Multiple "docs:" commits about research → one "docs: add research documentation"
- Multiple "feat:" commits for same feature → combine
- "fix:" commits that are minor → squash with related feat

### Option 2: Create Clean Branch

If history is too messy, create a clean branch:

```bash
# Create orphan branch (no history)
git checkout --orphan clean-main

# Add all current files
git add -A
git commit -m "Initial commit: AI-powered visual testing package"

# Force push (if you want to replace main)
# WARNING: This rewrites history
git branch -D main
git branch -m main
git push -f origin main
```

### Option 3: Keep History, Just Clean Messages

If you want to keep history but clean messages:

```bash
# Interactive rebase to edit messages
git rebase -i HEAD~30

# Change "pick" to "reword" for commits with bad messages
```

## Recommended Squash Groups

1. **Research docs** (commits 7b960dd, be5a7e6, 9f9b5a0, etc.)
   → "docs: add research documentation and comparisons"

2. **Validation/scrutiny** (commits 5940063, 8bf89c7, etc.)
   → "feat: add validation tests and security analysis"

3. **Evaluation system** (commits 527e000, efddfad, 78b2c23, 2da6dd8)
   → "feat: add comprehensive evaluation system"

4. **Security fixes** (commits 4fd53bb, d492ade, d45dd5c, 7028612)
   → "security: implement security hardening and fixes"

## Current Commit Categories

**Feature commits (keep):**
- feat: unified prompt composition
- feat: add retry logic, cost tracking
- feat: add logger utility
- feat: enhance pre-commit hook

**Documentation (squash):**
- Multiple "docs:" commits about research
- Multiple "docs:" commits about examples

**Fixes (squash with related):**
- Minor fixes can be squashed with related features

## Warning

⚠️ **If you've already pushed to remote and others are using the repo:**
- Don't force push without coordination
- Consider keeping history as-is
- Or create a new clean branch and deprecate old one

## Recommendation

For a private repo that's not widely used:
- Use Option 1 (interactive rebase)
- Squash related commits
- Keep meaningful feature commits separate
- Clean up commit messages

This keeps useful history while removing noise.

