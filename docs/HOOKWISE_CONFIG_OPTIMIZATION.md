# Hookwise Configuration Optimization

**Date:** 2025-01-17  
**Status:** Optimized and Validated

## Summary

Optimized `.hookwise.config.mjs` for this project's specific use cases:
- npm package with security requirements
- Research-heavy project with extensive documentation
- AI/ML codebase with specific patterns
- Temporal and evaluation features

## Key Optimizations

### 1. Commit Message Validation

**Settings:**
- `tier: 'simple'` - Fast validation for pre-commit (can switch to 'advanced' for thorough analysis)
- `minScore: 7` - Higher threshold for npm package quality (default is 5)
- `timeout: 10000` - 10s timeout (sufficient for simple tier)
- `agentic: false` - Disabled for speed (enable for deep analysis if needed)

**Rationale:**
- npm packages need high-quality commit messages for changelog generation
- Fast tier ensures pre-commit hooks don't slow down development
- Higher minScore ensures only well-written commits pass
- Agentic mode available if needed for thorough analysis

### 2. Code Quality Checks

**Console.log:**
- `severity: 'warning'` - Not blocking (logger.mjs is intentional)
- Excludes: test files, evaluation scripts, logger.mjs, session-cost-tracker.mjs

**TODOs:**
- `requireContext: true` - Must explain why TODO exists
- Excludes: test files, evaluation scripts, docs, archives

**Test Anti-patterns:**
- `severity: 'error'` - Blocking (critical for test quality)
- No exclusions - all tests should follow best practices

**Rationale:**
- Intentional console.log usage (logger, cost tracking) is allowed
- TODOs require context to prevent abandoned work
- Test anti-patterns are blocking to maintain test suite quality

### 3. Documentation Bloat Detection

**Settings:**
- `maxRootFiles: 6` - Strict limit (README, CHANGELOG, CONTRIBUTING, DEPLOYMENT, SECURITY, openmemory)
- `archiveAgeDays: 30` - Archive docs older than 30 days

**Archive Patterns:**
- High priority: FINAL_, CRITICAL_, DEEP_, MCP_, COMMIT_, GIT_, REPOSITORY_, SESSION_
- Suffix patterns: _SUMMARY.md, _REPORT.md, _ANALYSIS.md, _PLAN.md, _STATUS.md, _REVIEW.md, _FIXES.md, _COMPLETE.md
- Research-specific: RESEARCH_, EVALUATION_ (medium priority)

**Essential Files:**
- Standard npm package files + `openmemory.md` (project memory file)

**Rationale:**
- Research-heavy project generates many temporary analysis documents
- Aggressive archiving prevents root directory bloat
- openmemory.md is essential for project context and stays in root

### 4. Security Checks

**Settings:**
- `blocking: true` - Security issues must block commits
- `severity: 'error'` - Critical - secrets in code are dangerous
- Excludes: test files, .secretsignore, .env.example

**Rationale:**
- npm packages must not contain secrets
- Security is non-negotiable for published packages

### 5. Ignore Patterns

**Comprehensive exclusions:**
- Build artifacts: `dist/`, `build/`, `node_modules/`
- Archives and generated: `archive/`, `docs-generated/`, `test-results/`
- Evaluation outputs: `evaluation/results/`, `evaluation/cache/`, `evaluation/datasets/`
- Tooling: `.husky/`, `.git/`
- Logs and temp: `*.log`, `*.tmp`, `temp-*/`

**Rationale:**
- Large generated files shouldn't be checked
- Evaluation datasets are large and shouldn't be scanned
- Build artifacts are temporary

## Configuration Validation

✅ All checks passing:
- Code Quality: No issues found
- Documentation Bloat: No issues detected
- Security: Enabled and blocking

## Usage

### Run All Checks (Garden Mode)
```bash
npm run garden
```

### Run Individual Checks
```bash
npm run check:quality
npm run check:docs
npm run check:security
```

### View Current Configuration
```bash
npx hookwise config
```

### Get Recommendations
```bash
npx hookwise recommend
```

## Customization Notes

### For Thorough Commit Analysis
If you need deeper commit message analysis, update config:
```javascript
commitMessage: {
  tier: 'advanced', // More thorough analysis
  agentic: true,    // Use tool-calling for deep analysis
  timeout: 30000,   // More time for agentic mode
}
```

### For Faster Pre-commit
Current settings are optimized for speed. If hooks are too slow:
- Keep `tier: 'simple'`
- Keep `agentic: false`
- Consider lowering `minScore` if too strict

### For Documentation-Heavy Work
If working on documentation and need more root files:
```javascript
documentation: {
  maxRootFiles: 8, // Increase limit temporarily
}
```

## Project-Specific Considerations

### Research Features
- Evaluation scripts excluded from console.log checks
- Research docs have medium-priority archive patterns
- Evaluation datasets excluded from all checks

### npm Package Requirements
- High commit message quality (minScore: 7)
- Security checks are blocking
- Breaking changes must be documented (handled by LLM analysis)

### AI/ML Codebase
- Logger usage is intentional and excluded
- Cost tracking needs console output (excluded)
- Test anti-patterns are critical (blocking)

## Future Enhancements

Consider adding:
1. Custom prompts for commit message analysis (project-specific context)
2. Custom rules for conventional commits (project-specific types)
3. Metrics tracking for optimization over time
4. Adaptive thresholds based on project history

See hookwise docs for customization:
- `docs/CUSTOMIZATION.md` - Custom prompts and rules
- `docs/HOW_IT_WORKS.md` - System architecture
- `docs/AGENTIC_LOOP.md` - Advanced analysis

