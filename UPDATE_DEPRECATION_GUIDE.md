# Update Deprecation Message - Complete Guide

**Date**: 2025-11-14  
**Package**: ai-browser-test

## Current Status

You've already deprecated the package. Now you want to update the deprecation message.

## Quick Method: GitHub Actions Workflow

I've created/updated `.github/workflows/deprecate-old-package.yml` to update the deprecation message.

### Steps:

1. **Commit and push the workflow** (if not already):
   ```bash
   git add .github/workflows/deprecate-old-package.yml
   git commit -m "Add workflow to update package deprecation message"
   git push origin main
   ```

2. **Go to GitHub Actions**:
   - Visit: https://github.com/arclabs561/ai-visual-test/actions
   - Find: "Update Package Deprecation Message" workflow
   - Click: "Run workflow"

3. **Enter OTP**:
   - Get OTP from your authenticator app
   - Paste it in the "otp" field
   - (Optional) Customize message in "message" field, or leave empty for default
   - Click: "Run workflow"

4. **Verify**:
   - Workflow will show current message
   - Update the message
   - Verify the new message
   - Test installation warning

## Default Message

The workflow uses this default message (which you can customize):
```
This package has been renamed to ai-visual-test. Please use npm install ai-visual-test instead. See https://www.npmjs.com/package/ai-visual-test for the latest version.
```

## Manual Method (If Needed)

If you prefer to do it manually:

```bash
npm deprecate ai-browser-test "This package has been renamed to ai-visual-test. Please use npm install ai-visual-test instead. See https://www.npmjs.com/package/ai-visual-test for the latest version." --otp=<YOUR_OTP>
```

## Verification

After updating, verify:

```bash
npm view ai-browser-test deprecated
```

Should show your updated message.

Test installation:
```bash
npm install ai-browser-test@0.3.1 --dry-run
```

Should show deprecation warning with your message.

## What the Workflow Does

1. ✅ Shows current deprecation message
2. ✅ Updates message for all versions
3. ✅ Verifies the update worked
4. ✅ Tests that users will see the warning

## Next Steps

1. Push the workflow file to GitHub
2. Run the workflow from GitHub Actions UI
3. Enter your OTP
4. Done! ✅

