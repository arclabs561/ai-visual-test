# Vercel Configuration Removal from npm Package

**Date:** 2025-01-17  
**Status:** ✅ Removed

## Issue

The npm package was including `vercel.json` and `api/**/*.js` files, which are:
- **Deployment-specific** (only needed for Vercel deployment)
- **Not needed** for library usage (most users just import the package)
- **Already excluded** by `.npmignore` (but listed in `package.json` files array)

## Changes Made

### 1. Removed from package.json files array
- ❌ Removed `api/**/*.js`
- ❌ Removed `public/**/*.html`
- ❌ Removed `vercel.json`

### 2. Updated build script
- Removed copying of `api/` and `public/` directories
- Removed `vercel.json` from files to copy
- Added comments explaining these are deployment-only

## Rationale

### What Users Need
- ✅ `src/**/*.mjs` - Source code (obfuscated)
- ✅ `index.d.ts` - TypeScript definitions
- ✅ Documentation files (README, CHANGELOG, etc.)

### What Users Don't Need
- ❌ `api/**/*.js` - Serverless functions (deployment-specific)
- ❌ `public/**/*.html` - Web interface (deployment-specific)
- ❌ `vercel.json` - Vercel deployment config (deployment-specific)

### For Deployment
Users who want to deploy can:
1. Clone the repository (now private, but deployment configs are there)
2. Or copy `api/`, `public/`, and `vercel.json` from the repo
3. Or use the package as a library and build their own API layer

## Impact

### Before
- Package included deployment files (but `.npmignore` excluded them anyway)
- Confusing: files listed in `package.json` but excluded by `.npmignore`
- Larger package size (if included)

### After
- Package only includes library code
- Clear separation: library vs deployment
- Smaller, cleaner package

## Files Modified

- ✅ `package.json` - Removed `api/**/*.js`, `public/**/*.html`, `vercel.json` from files array
- ✅ `scripts/build-obfuscated.mjs` - Removed copying of deployment files

## Note

The `api/`, `public/`, and `vercel.json` files remain in the repository for deployment purposes, but are no longer included in the npm package. This is the correct approach for a library package.

