# Security Rotation Checklist

## CRITICAL: Rotate All Exposed Credentials

These credentials were exposed in git history (`.env.bak`) and MUST be rotated immediately.

### Vercel
- [ ] Edge Config Token: `07b8397b-d4d5-4168-8453-f5f4c8238fde`
  - Action: Rotate in Vercel Dashboard → Edge Config → Settings
- [ ] Deployment Token: `mwlQzaJLhg3rqdo4MpURxq1O`
  - Action: Rotate in Vercel Dashboard → Settings → Tokens

### Redis/Upstash
- [ ] Redis Connection String: `aTxbfwRXbh4MBwRcb4d8kLzPmwkSKloV`
  - Action: Rotate in Upstash Dashboard → Redis → Settings
- [ ] Upstash KV Token: `AYnUAAIncDI1ZjJlYmUyYjNjNTA0MjRkOTNhODJiYzU0ZmQyNDYxYXAyMzUyODQ`
  - Action: Rotate in Upstash Dashboard → KV → Settings

### API Keys
- [ ] OpenAI API Key: `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`
  - Action: Rotate in OpenAI Dashboard → API Keys → Revoke & Create New
- [ ] Anthropic API Key: `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`
  - Action: Rotate in Anthropic Dashboard → API Keys → Revoke & Create New

### Admin Tokens
- [ ] Admin Token: `7fe482cae4e8020597cb332b86aae9e93e90e03b75cf9d93b3c8662ecbc95272`
  - Action: Identify service and rotate accordingly

## Notes
- Git history has been cleaned (credentials removed from history)
- However, credentials are still valid and accessible to anyone who cloned before cleanup
- Rotation is CRITICAL to prevent unauthorized access
- Update all environment variables and secrets after rotation

## Priority
**DO THIS TODAY** - These credentials are publicly exposed in git history.
