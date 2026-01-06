# Deployment Guide

## Overview

This guide covers deploying `@arclabs561/ai-visual-test` in production environments, including:
- Vercel serverless deployment
- Docker containerization
- Health checks and monitoring
- Graceful shutdown
- Environment variable validation

## Vercel Deployment

### Quick Deploy

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd /path/to/ai-visual-test
vercel
```

### Environment Variables

**Required** (at least one API key):
- `GEMINI_API_KEY` - For Gemini provider
- `OPENAI_API_KEY` - For OpenAI provider
- `ANTHROPIC_API_KEY` - For Claude/Anthropic provider
- `GROQ_API_KEY` - For Groq provider (high-frequency decisions)

**Optional**:
- `VLM_PROVIDER` - Provider to use (auto-detected if not set): `gemini`, `openai`, `claude`, `groq`
- `VLM_MODEL` - Explicit model override
- `VLM_MODEL_TIER` - Model tier: `fast`, `balanced`, `best`
- `API_KEY` or `VLLM_API_KEY` - For API endpoint authentication
- `REQUIRE_AUTH` - Set to `true` to enforce authentication (default: `true` if API_KEY is set)
- `RATE_LIMIT_MAX_REQUESTS` - Max requests per minute (default: 10)
- `DISABLE_LLM_CACHE` - Set to `true` to disable caching globally

### Startup Validation

The library automatically validates configuration at startup. If required environment variables are missing, you'll get clear error messages:

```javascript
import { validateStartup } from '@arclabs561/ai-visual-test';

// Strict validation (throws on missing vars)
try {
  validateStartup();
  console.log('✅ Configuration valid');
} catch (error) {
  console.error('❌ Configuration invalid:', error.message);
  // Error includes actionable guidance:
  // "Missing required environment variables for provider 'gemini': GEMINI_API_KEY"
}

// Soft validation (returns warnings)
const result = validateStartupSoft();
if (!result.valid) {
  console.warn('⚠️  Configuration warnings:', result.warnings);
}
```

### API Endpoints

After deployment, you'll have:

- `https://your-site.vercel.app/api/validate` - Validation endpoint (POST)
- `https://your-site.vercel.app/api/health` - Health check (GET)
- `https://your-site.vercel.app/` - Web interface

#### Health Check Endpoint

The health check endpoint provides comprehensive status:

```bash
curl https://your-site.vercel.app/api/health
```

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-17T12:00:00.000Z",
  "version": "0.5.5",
  "config": {
    "enabled": true,
    "provider": "gemini",
    "hasApiKey": true
  },
  "validation": {
    "valid": true,
    "warnings": []
  },
  "cache": {
    "enabled": true,
    "hits": 1234,
    "misses": 567,
    "hitRate": 0.685
  }
}
```

**Status Codes**:
- `200` - Healthy (all checks pass)
- `503` - Degraded (configuration issues, but service may still work)
- `500` - Error (health check itself failed)

Use this endpoint for:
- Load balancer health checks
- Monitoring and alerting
- Deployment verification

### Usage

```javascript
// Validate screenshot (without authentication)
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

// With authentication (if API_KEY is set)
const responseAuth = await fetch('https://your-site.vercel.app/api/validate', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'X-API-Key': 'your-api-key' // or 'Authorization': 'Bearer your-api-key'
  },
  body: JSON.stringify({
    image: base64Image,
    prompt: 'Evaluate this screenshot...',
    context: { testType: 'payment-screen' }
  })
});

// Check rate limit headers
const remaining = response.headers.get('X-RateLimit-Remaining');
const resetAt = response.headers.get('X-RateLimit-Reset');
```

## Docker Deployment

### Dockerfile Example

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY src ./src
COPY api ./api

# Set environment
ENV NODE_ENV=production

# Expose port (if running as server)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })"

# Start application
CMD ["node", "api/server.js"]
```

### Docker Compose Example

```yaml
version: '3.8'

services:
  ai-visual-test:
    build: .
    ports:
      - "3000:3000"
    environment:
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - VLM_PROVIDER=gemini
      - NODE_ENV=production
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

## Graceful Shutdown

The library includes graceful shutdown handling for long-running processes:

```javascript
import { initGracefulShutdown, registerShutdownHandler } from '@arclabs561/ai-visual-test';

// Initialize (automatically done in library, but can be customized)
initGracefulShutdown({ timeout: 30000 }); // 30 second timeout

// Register custom shutdown handlers
registerShutdownHandler(async () => {
  // Clean up your resources
  await closeDatabase();
  await flushLogs();
}, 10); // Priority (higher = called first)
```

**Features**:
- Handles `SIGTERM` and `SIGINT` signals
- Executes shutdown handlers in priority order
- Flushes caches and cleans up resources
- Timeout protection (default: 30s)
- Handles uncaught exceptions

## Monitoring and Observability

### Health Checks

Monitor the `/api/health` endpoint:
- **Interval**: Check every 30-60 seconds
- **Timeout**: 3-5 seconds
- **Alert on**: Status `503` (degraded) or `500` (error)

### Metrics to Monitor

1. **Health Check Status**
   - `status: "healthy"` vs `"degraded"` vs `"error"`
   - Validation warnings

2. **Cache Performance**
   - Hit rate (should be >50% in production)
   - Cache size

3. **API Performance**
   - Response times (via performance logger)
   - Error rates
   - Cost tracking

### Logging

The library includes comprehensive logging:
- API call performance (latency, retries, costs)
- Cache operations (hits, misses, evictions)
- Temporal decisions (when prompts trigger/skip)
- Error patterns

Enable debug logging:
```javascript
import { setDebugEnabled } from '@arclabs561/ai-visual-test';

setDebugEnabled(true);
```

## Local Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Use as library
import { validateScreenshot } from '@arclabs561/ai-visual-test';

# Validate startup configuration
import { validateStartup } from '@arclabs561/ai-visual-test';
validateStartup(); // Throws if configuration invalid
```

## Production Checklist

- [ ] Set required API keys in environment
- [ ] Configure `VLM_PROVIDER` if using specific provider
- [ ] Set `API_KEY` for endpoint authentication (if exposing API)
- [ ] Configure `RATE_LIMIT_MAX_REQUESTS` based on expected load
- [ ] Set up health check monitoring
- [ ] Configure logging aggregation
- [ ] Set up cost tracking and alerts
- [ ] Test graceful shutdown
- [ ] Verify cache directory permissions (if using file cache)
- [ ] Review security settings (`REQUIRE_AUTH`, rate limits)
