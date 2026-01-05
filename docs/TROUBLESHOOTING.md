# Troubleshooting Guide

## Common Issues and Solutions

### Configuration Issues

#### Missing API Keys

**Error**: `Missing required environment variables for provider 'gemini': GEMINI_API_KEY`

**Solution**:
1. Set the API key in your `.env` file:
   ```bash
   GEMINI_API_KEY=your-api-key-here
   ```
2. Or set it as an environment variable:
   ```bash
   export GEMINI_API_KEY=your-api-key-here
   ```
3. For other providers:
   - `OPENAI_API_KEY` for OpenAI
   - `ANTHROPIC_API_KEY` for Claude
   - `GROQ_API_KEY` for Groq

#### Invalid Provider

**Error**: `Invalid provider: xyz`

**Solution**: Valid providers are: `gemini`, `openai`, `claude`, `groq`. Check your `VLM_PROVIDER` environment variable.

#### Provider Not Enabled

**Error**: `VLLM validation is disabled`

**Solution**: The library is disabled when no API keys are found. Set at least one API key to enable validation.

### API Call Issues

#### Rate Limiting

**Error**: `Rate limit exceeded`

**Solution**:
1. Check your API provider's rate limits
2. Increase `RATE_LIMIT_MAX_REQUESTS` if using the built-in rate limiter
3. Use caching to reduce API calls
4. For high-frequency scenarios, use Groq (faster, higher rate limits)

#### Timeout Errors

**Error**: `Request timeout` or `Operation timed out`

**Solution**:
1. Increase timeout in config:
   ```javascript
   const config = createConfig({ timeout: 60000 }); // 60 seconds
   ```
2. Check network connectivity
3. For slow providers, consider using Groq for high-frequency decisions

#### Image Size Errors (Groq)

**Error**: `Image must have at least 2 pixels in each dimension`

**Solution**: Groq has specific image size requirements. Ensure images are at least 2x2 pixels. For very small images, use a different provider or resize the image.

### Performance Issues

#### Slow Validation

**Symptoms**: Validation takes >5 seconds per screenshot

**Solutions**:
1. **Use caching**: Enable cache to avoid repeated API calls
   ```javascript
   const result = await validateScreenshot(path, prompt, { useCache: true });
   ```
2. **Use faster provider**: Switch to Groq for high-frequency scenarios
   ```javascript
   const result = await validateScreenshot(path, prompt, { 
     provider: 'groq',
     modelTier: 'fast'
   });
   ```
3. **Use batch validation**: Process multiple screenshots together
   ```javascript
   const results = await batchValidate(screenshots, prompt, context);
   ```
4. **Check cache hit rate**: Low cache hit rate indicates cache isn't working
   ```javascript
   const stats = getCacheStats();
   console.log(`Cache hit rate: ${stats.hitRate}`);
   ```

#### High Memory Usage

**Symptoms**: Process uses excessive memory

**Solutions**:
1. Reduce batch size in `BatchOptimizer`
2. Clear cache periodically
3. Use streaming for large datasets
4. Process in smaller chunks

### Cache Issues

#### Cache Not Working

**Symptoms**: Same screenshots always hit API, cache hit rate is 0%

**Solutions**:
1. Check cache directory permissions
2. Verify cache is enabled:
   ```javascript
   const config = createConfig();
   console.log(config.cache.enabled); // Should be true
   ```
3. Check cache directory exists and is writable
4. Review cache logs for errors

#### Cache Corruption

**Symptoms**: Errors reading from cache, validation fails

**Solutions**:
1. Clear cache directory:
   ```bash
   rm -rf .cache/vllm-cache
   ```
2. Cache will rebuild automatically
3. Check disk space (cache may be full)

### Temporal Features

#### Temporal Notes Not Aggregating

**Symptoms**: Temporal aggregation returns empty results

**Solutions**:
1. Ensure temporal notes have timestamps
2. Check minimum notes threshold (default: 3)
3. Verify coherence calculation is working
4. Review temporal decision manager logs

#### High-Frequency Detection Not Working

**Symptoms**: System not detecting high-frequency scenarios

**Solutions**:
1. Provide frequency explicitly:
   ```javascript
   await validateScreenshot(path, prompt, { frequency: 'high' });
   ```
2. Ensure temporal notes are being recorded
3. Check model tier selector is using frequency
4. Verify Groq is selected for high-frequency (if available)

### Cost Management

#### Unexpected Costs

**Symptoms**: Costs higher than expected

**Solutions**:
1. **Check budget limits**:
   ```javascript
   import { getBudgetStatus } from '@arclabs561/ai-visual-test';
   const status = getBudgetStatus();
   console.log(status);
   ```
2. **Set budget alerts**:
   ```javascript
   import { setBudgetLimit } from '@arclabs561/ai-visual-test';
   setBudgetLimit(10.0, {
     warningThreshold: 0.8,
     onWarning: (status) => console.warn(`Budget warning: ${status.percentage * 100}% used`),
     onExceeded: (status) => console.error(`Budget exceeded!`)
   });
   ```
3. **Review cost stats**:
   ```javascript
   import { getCostStats } from '@arclabs561/ai-visual-test';
   const stats = getCostStats();
   console.log(`Total cost: $${stats.total}`);
   ```
4. **Enable caching** to reduce API calls
5. **Use cheaper providers** for non-critical validations

### Health Check Issues

#### Health Check Returns 503 (Degraded)

**Symptoms**: `/api/health` returns status `degraded`

**Solutions**:
1. Check health check response for warnings:
   ```bash
   curl http://localhost:3000/api/health
   ```
2. Review validation warnings in response
3. Fix configuration issues (missing API keys, invalid provider)
4. Check cache status

#### Health Check Returns 500 (Error)

**Symptoms**: `/api/health` returns status `error`

**Solutions**:
1. Check server logs for errors
2. Verify all dependencies are installed
3. Check environment variables are set correctly
4. Review startup validation errors

### Testing Issues

#### Tests Fail with "Provider not enabled"

**Solution**: Set API keys in test environment or use mocks:
```javascript
// In test setup
process.env.GEMINI_API_KEY = 'test-key';
```

#### Tests Timeout

**Solution**: Increase test timeout or use faster providers:
```javascript
it('test name', async () => {
  // ... test code
}, { timeout: 30000 }); // 30 seconds
```

## Getting Help

1. **Check logs**: Enable debug logging:
   ```javascript
   import { setDebugEnabled } from '@arclabs561/ai-visual-test';
   setDebugEnabled(true);
   ```

2. **Review documentation**:
   - `DEPLOYMENT.md` - Deployment guide
   - `docs/LOGGING_AND_VISIBILITY.md` - Logging system
   - `docs/COST_TRACKING_AND_TRANSPARENCY.md` - Cost tracking

3. **Check health endpoint**: `/api/health` provides system status

4. **Review error messages**: Error messages include actionable guidance

## Reporting Issues

When reporting issues, include:
- Error message and stack trace
- Configuration (provider, model tier)
- Environment (Node.js version, OS)
- Steps to reproduce
- Relevant logs (with sensitive data redacted)

