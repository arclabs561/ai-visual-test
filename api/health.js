/**
 * Health check endpoint
 * 
 * GET /api/health
 * 
 * Returns comprehensive health status including:
 * - Service status
 * - Configuration validation
 * - Provider availability
 * - Cache status (if available)
 */

import { createConfig, getConfig } from '../src/index.mjs';
import { validateStartupSoft } from '../src/startup-validation.mjs';
import { getCacheStats } from '../src/cache.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const config = createConfig();
    const validation = validateStartupSoft();
    
    // Get cache stats if available
    let cacheStats = null;
    try {
      cacheStats = getCacheStats();
    } catch (err) {
      // Cache not initialized or unavailable - not critical
    }
    
    const health = {
      status: validation.valid ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      version: '0.5.5',
      config: {
        enabled: config.enabled,
        provider: config.provider || null,
        hasApiKey: !!(
          process.env.GEMINI_API_KEY ||
          process.env.OPENAI_API_KEY ||
          process.env.ANTHROPIC_API_KEY ||
          process.env.GROQ_API_KEY
        )
      },
      validation: {
        valid: validation.valid,
        warnings: validation.warnings || []
      },
      cache: cacheStats ? {
        enabled: true,
        hits: cacheStats.hits || 0,
        misses: cacheStats.misses || 0,
        hitRate: cacheStats.hitRate || 0
      } : {
        enabled: false
      }
    };
    
    // Return appropriate status code based on health
    const statusCode = validation.valid ? 200 : 503; // 503 Service Unavailable if degraded
    
    return res.status(statusCode).json(health);
  } catch (error) {
    // SECURITY: Don't expose internal error details
    // Log server-side for debugging, return generic message to client
    console.error('[Health] Error:', error);
    return res.status(500).json({
      status: 'error',
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
}

