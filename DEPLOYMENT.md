# Deployment Guide

## Vercel Deployment

### Quick Deploy

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd /path/to/ai-browser-test
vercel
```

### Environment Variables

Set these in Vercel dashboard:

- `GEMINI_API_KEY` (or `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`)
- `VLM_PROVIDER` (optional)

### API Endpoints

After deployment, you'll have:

- `https://your-site.vercel.app/api/validate` - Validation endpoint
- `https://your-site.vercel.app/api/health` - Health check
- `https://your-site.vercel.app/` - Web interface

### Usage

```javascript
// Validate screenshot
const response = await fetch('https://your-site.vercel.app/api/validate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    image: base64Image,
    prompt: 'Evaluate this screenshot...',
    context: { testType: 'payment-screen' }
  })
});

const result = await response.json();
```

## Local Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Use as library
import { validateScreenshot } from '@ai-browser-test/core';
```
