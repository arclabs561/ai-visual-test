# NPM Publish Guide

## Should You Publish to npm?

### For vllm-testing as Standalone Service
**No npm publish needed** - The package is deployed as its own Vercel service and doesn't need to be on npm.

### For queeraoke to Use vllm-testing
**Yes, you need a solution** - Vercel builds cannot resolve `file:../vllm-testing` dependencies.

## Options

### Option A: GitHub Repository (Easiest)
Update queeraoke `package.json`:
```json
{
  "dependencies": {
    "@queeraoke/vllm-testing": "git+https://github.com/henrywallace/vllm-testing.git#main"
  }
}
```

**Pros:**
- ✅ No npm account needed
- ✅ Works with private repos
- ✅ Can use git tags for versions
- ✅ Works with Vercel builds

**Cons:**
- Slightly slower installs than npm

### Option B: Private npm Package
1. Create npm account (if needed)
2. Login: `npm login`
3. Publish: `npm publish --access private`
4. Update queeraoke to use version: `"@vllm-testing/core": "^0.1.0"`

**Pros:**
- ✅ Fast installs
- ✅ Version control via semver
- ✅ Standard approach

**Cons:**
- Requires npm account
- Need to publish updates

### Option C: Keep file: for Local Only
If queeraoke doesn't need vllm-testing during Vercel builds (only for local tests), you can:
- Keep `file:../vllm-testing` for local development
- Make it a devDependency
- Use the deployed Vercel service API for production

## Recommendation

**Use GitHub repository** (Option A) - It's the simplest and works immediately with Vercel builds.

