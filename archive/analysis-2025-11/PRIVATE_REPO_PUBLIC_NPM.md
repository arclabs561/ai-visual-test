# Private Repository + Public npm Package: Analysis & Recommendations

## Executive Summary

**Current State:**
- GitHub repository: `ai-visual-testing` (PRIVATE)
- npm package: `ai-browser-test` (PUBLIC)
- This is technically feasible and common, but requires careful consideration.

## Key Findings from Research

### 1. Technical Feasibility ✅

**Yes, you can publish public npm packages from private GitHub repositories.**

- npm and GitHub are separate systems with independent visibility controls
- Package visibility ≠ repository visibility
- Scoped packages require `--access=public` flag explicitly

### 2. Security Implications ⚠️

**Private repo does NOT protect against supply chain attacks.**

**Reality:**
- Attackers target maintainer accounts, not source code
- Once published, package contents are visible on npmjs.com anyway
- Recent attacks (Shai-Hulud, malicious packages) exploit compromised accounts
- Private repo provides false sense of security

**What actually matters:**
- Strong authentication (2FA with WebAuthn)
- Trusted publishing via OIDC (eliminates long-lived tokens)
- Code review requirements
- Security scanning before publish

### 3. Licensing Obligations 📜

**Public packages must comply with claimed license regardless of repo privacy.**

- If you claim MIT/Apache/GPL, you must honor those terms
- Private repo doesn't create license exceptions
- Use `"license": "UNLICENSED"` for proprietary packages
- All dependencies must be license-compatible

### 4. Developer Trust 🤝

**Transparency helps, but provenance/security practices matter more.**

**Developer concerns:**
- Can't inspect source code before installing
- May question why repo is private if package is public
- Need other trust signals

**How to build trust:**
- Clear documentation explaining strategy
- Provenance attestations (cryptographic proof of authenticity)
- Transparent security practices
- Security vulnerability disclosure policy
- Active maintenance signals

### 5. Source Code Visibility 🔍

**Package contents are visible on npmjs.com regardless of repo privacy.**

- Users can view published package code on npmjs.com
- `.npmignore` and `files` in package.json control what's published
- Source maps, tests, docs can be excluded
- But main code will be visible in published package

## Recommendations

### Option 1: Keep Private Repo + Public npm (Current)

**Pros:**
- Protects development process/internal discussions
- Can control when source becomes visible
- Maintains IP protection during development

**Cons:**
- May reduce developer trust
- Doesn't provide security benefits
- Requires extra transparency effort

**Best for:**
- Proprietary development processes
- Pre-release development
- Hybrid open-core models

**Required actions:**
1. Add clear README section explaining strategy
2. Enable trusted publishing (OIDC)
3. Enable 2FA with WebAuthn
4. Document security practices
5. Consider making repo public later for transparency

### Option 2: Make Repo Public

**Pros:**
- Maximum transparency and trust
- Community contributions possible
- Aligns with open-source norms
- Easier security auditing

**Cons:**
- Exposes development process
- Internal discussions visible
- Less IP protection

**Best for:**
- True open-source projects
- Community-driven development
- Maximum transparency goals

### Option 3: Private Registry

**Pros:**
- Complete control over distribution
- No public exposure
- Enterprise-friendly

**Cons:**
- No public npm distribution
- Requires registry setup
- Limited discoverability

**Best for:**
- Enterprise/internal tools
- Proprietary software
- Customer-specific packages

## Recommended Approach for Your Project

**Given your current setup, I recommend:**

1. **Short-term: Keep private, but be transparent**
   - Add README section explaining why repo is private
   - Document security practices
   - Enable trusted publishing
   - Enable 2FA

2. **Medium-term: Consider making public**
   - If package gains traction, make repo public
   - Benefits of transparency likely outweigh concerns
   - Community contributions become possible

3. **Security focus:**
   - Implement trusted publishing (OIDC)
   - Enable 2FA with WebAuthn
   - Use `npm publish --dry-run` before publishing
   - Audit dependencies regularly
   - Document security practices

## Implementation Checklist

- [ ] Add README section explaining private repo strategy
- [ ] Enable trusted publishing via GitHub Actions
- [ ] Enable 2FA with WebAuthn on npm account
- [ ] Review `.npmignore` and `files` in package.json
- [ ] Document security practices in SECURITY.md
- [ ] Add provenance attestations to CI/CD
- [ ] Consider security vulnerability disclosure policy
- [ ] Evaluate making repo public in future

## Key Takeaway

**Private repo + public npm is fine, but:**
- It doesn't provide security benefits
- It requires extra transparency effort
- Focus security on account protection, not repo privacy
- Consider making repo public if package gains traction

The decision should be based on development process preferences and IP strategy, not security assumptions.

